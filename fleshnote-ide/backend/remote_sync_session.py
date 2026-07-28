"""
FleshNote — Remote (QR/LAN) Sync Session

Transport scaffolding for phone <-> desktop sync. The desktop stays the single
authority that runs the merge (see routes/sync.py) — this module only gets a
copy of the phone's project onto local disk (as a zip) so the existing
folder-based sync_preview/sync_apply can run against it unchanged, then hands
back a zip of the merged desktop project for the phone to pull down.

Two FastAPI apps are involved:
- The main app (main.py), bound to 127.0.0.1 only, reachable from Electron.
  Its /api/project/remote-sync/* routes (routes/remote_sync.py) start/stop
  sessions and drive preview/apply — same trust boundary as everything else.
- `remote_app` below, bound to 0.0.0.0 on an ephemeral port, started ONLY
  while a pairing session is active (never at backend boot — binding 0.0.0.0
  early would trip the Windows Firewall prompt before the user asked for
  sync). Every route on it requires the session's token.

Download-back contract: the zip returned by /remote-sync/download is a full
project folder (fleshnote.db + md/ + fleshnote_project.json), the same shape
sync_apply already expects as a `remote_path`. The companion app MUST feed it
into its OWN sync engine as `remote_path` (a directional pull, same as the
desktop did) rather than overwriting its local fleshnote.db wholesale — a raw
overwrite would destroy device-local pentimento_sessions/pentimento_ops/
chapter_snapshots (never synced, see PENTIMENTO.md) and clobber sync_meta.
"""

import os
import json
import time
import socket
import secrets
import shutil
import tempfile
import threading
import zipfile
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse

SESSION_TTL_SECONDS = 10 * 60
MAX_UPLOAD_BYTES = 200 * 1024 * 1024
PORT_CANDIDATES = list(range(8420, 8430))


class RemoteSyncSession:
    def __init__(self, project_path: Optional[str], project_id: str, project_name: str,
                 mode: str = "merge", workspace_path: Optional[str] = None):
        self.token = secrets.token_urlsafe(24)
        self.project_path = project_path
        self.project_id = project_id
        self.project_name = project_name
        # "merge"        -> phone uploads, desktop merges, phone downloads back (§9)
        # "clone_send"   -> desktop serves its whole project to a fresh phone
        # "clone_receive"-> phone uploads a whole project the desktop lacks; desktop registers it
        self.mode = mode
        self.workspace_path = workspace_path       # where clone_receive lands the new project
        self.cloned_project_path: Optional[str] = None  # set after a clone_receive
        self.created_at = time.time()
        self.expires_at = self.created_at + SESSION_TTL_SECONDS
        # waiting -> uploaded -> ready -> applying -> applied -> downloaded
        #                                          \-> error / cancelled / expired
        self.status = "waiting"
        self.error_message: Optional[str] = None
        self.remote_tmp_root: Optional[str] = None   # whole temp dir (holds extracted project)
        self.remote_tmp_dir: Optional[str] = None     # extracted phone project (sync_preview remote_path)
        self.download_zip_path: Optional[str] = None
        self.preview: Optional[dict] = None

    def is_expired(self) -> bool:
        return time.time() > self.expires_at

    def touch_error(self, msg: str):
        self.status = "error"
        self.error_message = msg


_active_session: Optional[RemoteSyncSession] = None
_session_lock = threading.Lock()
_server: Optional[uvicorn.Server] = None
_server_thread: Optional[threading.Thread] = None
_server_port: Optional[int] = None


# ── helpers ──────────────────────────────────────────────────────────────

def _ip_rank(ip: str) -> int:
    """Lower = more likely reachable by a phone on the same Wi-Fi. Real private
    LAN ranges first; the CGNAT range (100.64.0.0/10, used by Tailscale and
    carrier NAT — NOT reachable from a phone on the LAN) last."""
    try:
        a, b = (int(x) for x in ip.split(".")[:2])
    except Exception:
        return 3
    if a == 192 and b == 168:
        return 0
    if a == 10:
        return 1
    if a == 172 and 16 <= b <= 31:
        return 2
    if a == 100 and 64 <= b <= 127:   # CGNAT / Tailscale — try only as a last resort
        return 5
    return 3


def _enumerate_ipv4() -> set[str]:
    """All local IPv4 addresses, via the OS command (locale-tolerant) plus
    stdlib fallbacks — stdlib alone misses the Wi-Fi IP when a VPN like
    Tailscale owns hostname resolution and the default route."""
    ips: set[str] = set()
    # Default-route interface (often the VPN when one is up — still a candidate).
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        ips.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except Exception:
        pass
    # OS command: enumerates every adapter, not just what the hostname resolves to.
    try:
        import subprocess, re, sys
        if sys.platform.startswith("win"):
            out = subprocess.run(["ipconfig"], capture_output=True, text=True, timeout=5).stdout
            # The IPv4 line keeps "IPv4" across latin-script locales (EN "IPv4 Address",
            # HU "IPv4-cím", PL "Adres IPv4", DE "IPv4-Adresse"...), so match those lines
            # only — avoids picking up subnet masks / gateways.
            for line in out.splitlines():
                if "IPv4" in line:
                    m = re.search(r"(\d{1,3}(?:\.\d{1,3}){3})", line)
                    if m:
                        ips.add(m.group(1))
        else:
            out = subprocess.run(["ip", "-4", "-o", "addr", "show"],
                                 capture_output=True, text=True, timeout=5).stdout
            if not out:
                out = subprocess.run(["ifconfig"], capture_output=True, text=True, timeout=5).stdout
            for m in re.finditer(r"inet\s+(\d{1,3}(?:\.\d{1,3}){3})", out):
                ips.add(m.group(1))
    except Exception:
        pass
    return ips


def _get_local_ips() -> list[str]:
    candidates = {
        ip for ip in _enumerate_ipv4()
        if ip and not ip.startswith("127.") and not ip.startswith("169.254.")
        and not ip.startswith("255.") and ip != "0.0.0.0"
    }
    if not candidates:
        return ["127.0.0.1"]
    # Real LAN first, CGNAT/Tailscale last, so the phone tries a reachable host first.
    return sorted(candidates, key=lambda ip: (_ip_rank(ip), ip))


def _safe_extract_zip(zip_path: str, dest_dir: str):
    """Extract with a zip-slip guard — every member must resolve inside dest_dir."""
    dest_dir = os.path.realpath(dest_dir)
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            member_path = os.path.realpath(os.path.join(dest_dir, member.filename))
            if member_path != dest_dir and not member_path.startswith(dest_dir + os.sep):
                raise ValueError(f"Unsafe path in uploaded archive: {member.filename}")
        zf.extractall(dest_dir)


def _zip_project(project_path: str) -> str:
    """Zip fleshnote.db + md/ + fleshnote_project.json for the phone to download."""
    fd, zip_path = tempfile.mkstemp(prefix="fleshnote_merged_", suffix=".zip")
    os.close(fd)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        db_path = os.path.join(project_path, "fleshnote.db")
        if os.path.exists(db_path):
            zf.write(db_path, "fleshnote.db")
        json_path = os.path.join(project_path, "fleshnote_project.json")
        if os.path.exists(json_path):
            zf.write(json_path, "fleshnote_project.json")
        md_dir = os.path.join(project_path, "md")
        if os.path.isdir(md_dir):
            for root, _dirs, files in os.walk(md_dir):
                for fname in files:
                    full = os.path.join(root, fname)
                    rel = os.path.relpath(full, project_path)
                    zf.write(full, rel)
    return zip_path


def _register_cloned_project(extract_dir: str, workspace_path: Optional[str]) -> str:
    """Copy a phone-uploaded project into the desktop's workspace as a NEW
    project folder (unique name from its project_name). Returns the new path."""
    if not workspace_path or not os.path.isdir(workspace_path):
        raise ValueError("No workspace folder available to receive the project.")
    meta_path = os.path.join(extract_dir, "fleshnote_project.json")
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)
    raw_name = str(meta.get("project_name") or "Received Project").strip()
    base = "".join(c for c in raw_name if c.isalnum() or c in " -_").strip() or "Received_Project"

    target = os.path.join(workspace_path, base)
    i = 2
    while os.path.exists(target):
        target = os.path.join(workspace_path, f"{base} ({i})")
        i += 1
    shutil.copytree(extract_dir, target)
    return target


def _cleanup_session(session: RemoteSyncSession):
    if session.remote_tmp_root and os.path.isdir(session.remote_tmp_root):
        shutil.rmtree(session.remote_tmp_root, ignore_errors=True)
    if session.download_zip_path and os.path.isfile(session.download_zip_path):
        try:
            os.remove(session.download_zip_path)
        except OSError:
            pass


def _pick_port() -> int:
    for p in PORT_CANDIDATES:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("0.0.0.0", p))
            s.close()
            return p
        except OSError:
            continue
    raise RuntimeError("No free port available for remote sync (8420-8429 all busy)")


# ── LAN-facing app (phone talks to this one) ────────────────────────────────

remote_app = FastAPI(title="FleshNote Remote Sync")


def _session_for_token(token: str) -> RemoteSyncSession:
    session = _active_session
    if not session or session.token != token:
        raise HTTPException(status_code=403, detail="Invalid or expired sync session")
    if session.is_expired() and session.status not in ("applied", "downloaded"):
        session.status = "expired"
    if session.status == "expired":
        raise HTTPException(status_code=403, detail="Sync session expired")
    return session


@remote_app.get("/remote-sync/pair")
def remote_pair(token: str = Query(...)):
    session = _session_for_token(token)
    return {"status": "ok", "project_id": session.project_id, "project_name": session.project_name}


@remote_app.post("/remote-sync/upload")
async def remote_upload(token: str = Query(...), file: UploadFile = File(...)):
    session = _session_for_token(token)
    with _session_lock:
        if session.status != "waiting":
            raise HTTPException(status_code=409, detail=f"Session not accepting uploads (status={session.status})")
        session.status = "uploaded"

    tmp_root = tempfile.mkdtemp(prefix="fleshnote_remote_")
    zip_path = os.path.join(tmp_root, "upload.zip")
    extract_dir = os.path.join(tmp_root, "project")
    try:
        size = 0
        with open(zip_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Upload too large")
                f.write(chunk)

        os.makedirs(extract_dir, exist_ok=True)
        try:
            _safe_extract_zip(zip_path, extract_dir)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        os.remove(zip_path)

        if not os.path.exists(os.path.join(extract_dir, "fleshnote.db")):
            raise HTTPException(status_code=400, detail="Uploaded project is missing fleshnote.db")
        if not os.path.exists(os.path.join(extract_dir, "fleshnote_project.json")):
            raise HTTPException(status_code=400, detail="Uploaded project is missing fleshnote_project.json")

        session.remote_tmp_root = tmp_root
        session.remote_tmp_dir = extract_dir
    except HTTPException as e:
        shutil.rmtree(tmp_root, ignore_errors=True)
        session.touch_error(str(e.detail))
        raise
    except Exception as e:
        shutil.rmtree(tmp_root, ignore_errors=True)
        session.touch_error(str(e))
        raise HTTPException(status_code=500, detail=str(e))

    # Clone-receive: the phone is sending a whole project the desktop doesn't
    # have yet. Register it as a NEW project rather than merging.
    if session.mode == "clone_receive":
        try:
            session.cloned_project_path = _register_cloned_project(
                extract_dir, session.workspace_path)
        except Exception as e:
            session.touch_error(str(e))
            raise HTTPException(status_code=500, detail=str(e))
        session.status = "applied"  # nothing to download back
        return {"status": "ok"}

    # Reuse the exact desktop folder-based diff engine — no duplicated merge logic.
    from routes.sync import sync_preview, SyncPreviewRequest
    try:
        result = sync_preview(SyncPreviewRequest(local_path=session.project_path, remote_path=session.remote_tmp_dir))
    except HTTPException as e:
        session.touch_error(str(e.detail))
        raise

    if result.get("status") == "error":
        session.touch_error(result.get("message", "Sync preview failed"))
        raise HTTPException(status_code=400, detail=session.error_message)

    session.preview = result
    session.status = "ready"
    return {"status": "ok"}


@remote_app.get("/remote-sync/result")
def remote_result(token: str = Query(...)):
    session = _session_for_token(token)
    return {"status": session.status, "error": session.error_message}


@remote_app.get("/remote-sync/download")
def remote_download(token: str = Query(...)):
    session = _session_for_token(token)
    # clone_send has the zip ready from session start (nothing to merge first);
    # merge mode only has it after the desktop applies.
    ready = os.path.isfile(session.download_zip_path or "") and (
        session.mode == "clone_send" or session.status == "applied")
    if not ready:
        raise HTTPException(status_code=409, detail="Project not ready for download yet")
    return FileResponse(session.download_zip_path, media_type="application/zip", filename="fleshnote_project.zip")


@remote_app.post("/remote-sync/complete")
def remote_complete(token: str = Query(...)):
    session = _session_for_token(token)
    session.status = "downloaded"
    return {"status": "ok"}


# ── lifecycle, called from routes/remote_sync.py (loopback-only) ───────────

def start_session(project_path: Optional[str], project_id: str, project_name: str,
                  mode: str = "merge", workspace_path: Optional[str] = None) -> dict:
    global _active_session, _server, _server_thread, _server_port
    with _session_lock:
        if _active_session:
            _cleanup_session(_active_session)
        _stop_server_locked()

        session = RemoteSyncSession(project_path, project_id, project_name,
                                    mode=mode, workspace_path=workspace_path)
        # clone_send serves the whole project immediately, so zip it up front.
        if mode == "clone_send" and project_path:
            session.download_zip_path = _zip_project(project_path)
        _active_session = session

        port = _pick_port()
        config = uvicorn.Config(remote_app, host="0.0.0.0", port=port, log_level="warning")
        server = uvicorn.Server(config)
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()

        deadline = time.time() + 5
        while not server.started and time.time() < deadline:
            time.sleep(0.05)

        _server = server
        _server_thread = thread
        _server_port = port

        return {
            "token": session.token,
            "port": port,
            "hosts": _get_local_ips(),
            "project_id": project_id,
            "project_name": project_name,
            "mode": mode,
            "expires_at": session.expires_at,
        }


def _stop_server_locked():
    global _server, _server_thread, _server_port
    if _server:
        _server.should_exit = True
        if _server_thread:
            _server_thread.join(timeout=5)
    _server = None
    _server_thread = None
    _server_port = None


def cancel_session(token: Optional[str] = None) -> dict:
    """Cancel the active session. If `token` is given, it must match — a stale token
    from a session that start_session() already replaced is a no-op, not a takedown
    of whatever session is active now."""
    global _active_session
    with _session_lock:
        if _active_session and (token is None or _active_session.token == token):
            _cleanup_session(_active_session)
            _active_session = None
            _stop_server_locked()
    return {"status": "ok"}


def get_session() -> Optional[RemoteSyncSession]:
    session = _active_session
    if session and session.is_expired() and session.status not in ("applied", "downloaded"):
        session.status = "expired"
    return session

import hashlib
import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from project_io import safe_md_path
import review_crypto as rc

router = APIRouter()

FORMAT = "fleshnote-review/1"
ENTITY_MARKER_RE = re.compile(
    r"\{\{(?:char|loc|item|lore|group|quicknote|annotation):([^|]+)\|([^}]+)\}\}"
)

SECRET_FIELDS = {
    "char": {"true_goal", "bio"},
    "loc": set(),
    "lore": {"origin"},
    "group": {"true_agenda", "philosophy", "internal_rules"},
}
PUBLIC_FIELDS = {
    "char": {"role", "status", "species", "surface_goal"},
    "loc": {"region", "description"},
    "lore": {"category", "classification", "description", "rules", "limitations"},
    "group": {"group_type", "description", "surface_agenda"},
}

NOTE_CATEGORIES = {"typo", "rewrite", "remove", "praise", "question", "comment"}
NOTE_QUOTE_MAX = 600
NOTE_BODY_MAX = 4000
LABEL_MAX = 120
MESSAGE_MAX = 2000
SCORE_KEYS = ("pacing", "prose", "dialogue", "characters", "plot", "engagement", "overall")
PACKAGE_MAX_BYTES = 64 * 1024 * 1024
REANCHOR_MIN = 0.70


class ReviewScope(BaseModel):
    manuscript: bool = True
    entities: bool = False
    with_secrets: bool = False
    plot: bool = False
    chapter_ids: list[str] | None = None


class ExportReviewRequest(BaseModel):
    project_path: str
    dest_path: str
    scope: ReviewScope = ReviewScope()
    reviewer_label: str = ""
    author_label: str = ""
    message: str = ""
    # 0: a plain copy with no expiry (works offline). 1..365: a locked copy
    # whose key half lives on the key server until then.
    expires_days: int = 0
    key_server: str = ""


class OpenReviewRequest(BaseModel):
    path: str


class StartReviewRequest(BaseModel):
    path: str
    store_dir: str


class StoreRequest(BaseModel):
    store_dir: str


class SaveReviewRequest(BaseModel):
    path: str
    package: dict
    store_dir: str


class FinishReviewRequest(BaseModel):
    path: str
    dest_path: str
    store_dir: str


class DiscardReviewRequest(BaseModel):
    path: str
    store_dir: str


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _effective_scope(scope: ReviewScope) -> ReviewScope:
    data = scope.model_dump()
    data["manuscript"] = True
    if not data["entities"]:
        data["with_secrets"] = False
    return ReviewScope(**data)


def _project_meta(project_path: str):
    json_path = os.path.join(project_path, "fleshnote_project.json")
    meta = {}
    if os.path.exists(json_path):
        with open(json_path, encoding="utf-8") as f:
            meta = json.load(f)
    return meta.get("project_id") or "", meta.get("project_name") or "Untitled"


def _read_md(project_path: str, md_filename: str | None) -> str:
    if not md_filename:
        return ""
    path = safe_md_path(os.path.join(project_path, "md"), md_filename)
    if not path or not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read()


def _parse_aliases(raw) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw if x]
    try:
        val = json.loads(raw)
        if isinstance(val, list):
            return [str(x) for x in val if x]
    except Exception:
        pass
    return []


def _entity_rows(conn, sql: str, typ: str, with_secrets: bool) -> list[dict]:
    try:
        rows = conn.execute(sql).fetchall()
    except sqlite3.OperationalError:
        return []
    secret = SECRET_FIELDS[typ]
    public = PUBLIC_FIELDS[typ]
    out = []
    for row in rows:
        keys = row.keys()
        entity = {"id": "", "type": typ, "name": "", "fields": {}, "aliases": []}
        for col in keys:
            val = row[col]
            if col == "id":
                entity["id"] = str(val or "")
            elif col == "name":
                entity["name"] = str(val or "").strip()
            elif col == "aliases":
                entity["aliases"] = _parse_aliases(val)
            else:
                if col in secret and not with_secrets:
                    continue
                if col not in secret and col not in public:
                    continue
                text = "" if val is None else str(val).strip()
                if text:
                    entity["fields"][col] = text
        if entity["id"] and entity["name"]:
            if not entity["fields"]:
                entity.pop("fields")
            if not entity["aliases"]:
                entity.pop("aliases")
            out.append(entity)
    return out


def _read_plot(conn) -> dict:
    plot = {"twists": []}
    try:
        twist_rows = conn.execute(
            """SELECT id, title, COALESCE(description,''), COALESCE(twist_type,''), COALESCE(status,'')
               FROM twists WHERE deleted = 0"""
        ).fetchall()
    except sqlite3.OperationalError:
        return plot
    twists = {}
    order = []
    for row in twist_rows:
        tid = row[0]
        twists[tid] = {
            "id": tid,
            "title": row[1] or "",
            "description": row[2] or "",
            "twist_type": row[3] or "",
            "status": row[4] or "",
            "foreshadowing": [],
        }
        order.append(tid)
    try:
        fs_rows = conn.execute(
            """SELECT twist_id, COALESCE(chapter_id,''), COALESCE(selected_text,'')
               FROM foreshadowings WHERE deleted = 0"""
        ).fetchall()
        for twist_id, chapter_id, text in fs_rows:
            if twist_id in twists:
                twists[twist_id]["foreshadowing"].append(
                    {"chapter_id": chapter_id, "selected_text": text}
                )
    except sqlite3.OperationalError:
        pass
    plot["twists"] = [twists[i] for i in order]
    return plot


def build_snapshot(project_path: str, scope: ReviewScope) -> dict:
    scope = _effective_scope(scope)
    desktop_id, title = _project_meta(project_path)
    conn = _get_db(project_path)
    try:
        chapters = conn.execute(
            """SELECT id, chapter_number, title, word_count, md_filename
               FROM chapters WHERE deleted = 0 ORDER BY chapter_number ASC"""
        ).fetchall()
        want = None
        if scope.chapter_ids:
            want = set(str(x) for x in scope.chapter_ids)
        snap_chapters = []
        checkpoints = []
        for ch in chapters:
            cid = str(ch["id"])
            if want is not None and cid not in want:
                continue
            text = _read_md(project_path, ch["md_filename"])
            if not scope.entities:
                text = ENTITY_MARKER_RE.sub(r"\2", text)
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            snap_chapters.append({
                "id": cid,
                "number": ch["chapter_number"] or 0,
                "title": ch["title"] or "",
                "word_count": ch["word_count"] or 0,
                "text_md": text,
            })
            checkpoints.append({"chapter_id": cid, "sha256": digest})

        snap = {
            "version": 1,
            "project": {"desktop_id": desktop_id, "title": title},
            "scope": {
                "manuscript": True,
                "entities": scope.entities,
                "with_secrets": scope.with_secrets,
                "plot": scope.plot,
                "chapter_ids": list(scope.chapter_ids or []),
            },
            "chapters": snap_chapters,
            "checkpoints": {
                "captured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "chapters": checkpoints,
            },
        }
        if scope.entities:
            snap["entities"] = {
                "characters": _entity_rows(conn, "SELECT * FROM characters WHERE deleted = 0", "char", scope.with_secrets),
                "locations": _entity_rows(conn, "SELECT * FROM locations WHERE deleted = 0", "loc", scope.with_secrets),
                "lore": _entity_rows(conn, "SELECT * FROM lore_entities WHERE deleted = 0", "lore", scope.with_secrets),
                "groups": _entity_rows(conn, "SELECT * FROM groups WHERE deleted = 0", "group", scope.with_secrets),
            }
        if scope.plot:
            snap["plot"] = _read_plot(conn)
        return snap
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _text(value, limit: int) -> str:
    return str(value or "").strip()[:limit]


def empty_package(snapshot: dict, reviewer_label: str = "", author_label: str = "", message: str = "") -> dict:
    # review_id names one export, so a reviewer who opens the same file twice
    # resumes their notes instead of starting over.
    return {
        "format": FORMAT,
        "crypto": None,
        "review_id": str(uuid.uuid4()),
        "created_at": _now(),
        "author_label": _text(author_label, LABEL_MAX),
        "message": _text(message, MESSAGE_MAX),
        "reviewer_label": _text(reviewer_label, LABEL_MAX),
        "snapshot": snapshot,
        "notes": [],
        "scores": [],
        "published": False,
    }


def review_id_of(pkg: dict) -> str:
    """Files exported before review_id existed get a stable id from their snapshot."""
    if pkg.get("review_id"):
        return str(pkg["review_id"])[:64]
    snap = pkg.get("snapshot") or {}
    seed = "%s|%s" % ((snap.get("project") or {}).get("desktop_id") or "",
                      (snap.get("checkpoints") or {}).get("captured_at") or "")
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:32]


# Fields a locked copy keeps readable outside the encryption: what the apps need
# to list it and route it to the right project before (or without) the key.
HEADER_KEYS = ("format", "crypto", "review_id", "created_at", "title", "author_label",
               "desktop_id", "copy_id", "finished_at")


def plain_view(raw: dict, key) -> dict:
    """A locked copy's header plus its decrypted content, shaped like a plain copy."""
    if not rc.is_sealed(raw):
        return raw
    plain = {k: raw[k] for k in HEADER_KEYS if k in raw}
    plain.update(rc.unseal(raw, key))
    return plain


def write_package(path: str, plain: dict, key=None):
    """Save a package; locked copies (key given) are re-encrypted, never written in the clear."""
    if not key:
        save_package(path, plain)
        return
    header = {k: plain[k] for k in HEADER_KEYS if k in plain}
    header["format"] = rc.SEALED_FORMAT
    inner = {k: v for k, v in plain.items() if k not in HEADER_KEYS and k != "sealed"}
    _write_json(path, rc.seal(header, inner, key))


def peek(raw: dict) -> dict:
    """What can be read from a review file without its key."""
    snap = raw.get("snapshot") or {}
    sealed = rc.is_sealed(raw)
    return {
        "sealed": sealed,
        "title": raw.get("title") if sealed else (snap.get("project") or {}).get("title") or "",
        "desktop_id": raw.get("desktop_id") if sealed else (snap.get("project") or {}).get("desktop_id") or "",
        "author_label": raw.get("author_label") or "",
        "reviewer_label": "" if sealed else raw.get("reviewer_label") or "",
        "notes": None if sealed else len(raw.get("notes") or []),
        "finished_at": raw.get("finished_at") or "",
        "expires_at": (raw.get("crypto") or {}).get("expires_at", "") if sealed else "",
    }


def load_package(path: str) -> dict:
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Review file not found")
    if os.path.getsize(path) > PACKAGE_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Review file is too large")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Not a FleshNote review file")
    if not isinstance(data, dict) or data.get("format") not in (FORMAT, rc.SEALED_FORMAT):
        raise HTTPException(status_code=400, detail="Not a FleshNote review file")
    return data


def clean_notes(notes) -> list[dict]:
    """Reviewer notes come from a file someone else edited: keep known fields
    only, cap every length and drop anything malformed."""
    out = []
    for n in notes if isinstance(notes, list) else []:
        if not isinstance(n, dict) or n.get("category") not in NOTE_CATEGORIES:
            continue
        try:
            start, end = int(n.get("anchor_start") or 0), int(n.get("anchor_end") or 0)
        except (TypeError, ValueError):
            continue
        body = _text(n.get("body"), NOTE_BODY_MAX)
        suggestion = _text(n.get("suggestion"), NOTE_BODY_MAX)
        if not body and not suggestion and n.get("category") != "remove":
            continue
        out.append({
            "id": _text(n.get("id"), 64) or str(uuid.uuid4()),
            "chapter_id": _text(n.get("chapter_id"), 64),
            "category": n["category"],
            "body": body,
            "suggestion": suggestion,
            "anchor_start": max(0, start),
            "anchor_end": max(0, end),
            "anchor_quote": str(n.get("anchor_quote") or "")[:NOTE_QUOTE_MAX],
            "created_at": _text(n.get("created_at"), 40),
            "updated_at": _text(n.get("updated_at"), 40),
        })
    return out


def clean_scores(scores) -> list[dict]:
    out = []
    for s in scores if isinstance(scores, list) else []:
        if not isinstance(s, dict) or not s.get("chapter_id"):
            continue
        row = {"chapter_id": _text(s.get("chapter_id"), 64)}
        for key in SCORE_KEYS:
            try:
                v = int(s.get(key) or 0)
            except (TypeError, ValueError):
                v = 0
            if 1 <= v <= 5:
                row[key] = v
        if len(row) > 1:
            out.append(row)
    return out


def _in_store(path: str, store_dir: str) -> str:
    """Reviews in progress live in the app's own folder; refuse writes anywhere else."""
    store = os.path.realpath(store_dir)
    real = os.path.realpath(path)
    if os.path.dirname(real) != store or not real.endswith(".flreview"):
        raise HTTPException(status_code=400, detail="Not a review in progress")
    return real


def save_package(path: str, package: dict):
    package["format"] = FORMAT
    if "crypto" not in package:
        package["crypto"] = None
    _write_json(path, package)


def _write_json(path: str, data: dict):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _utf16_units(s: str) -> list[int]:
    raw = s.encode("utf-16-le")
    return [raw[i] | (raw[i + 1] << 8) for i in range(0, len(raw), 2)]


def _u16_index_of(hay: list[int], needle: list[int]) -> int:
    n = len(needle)
    if n == 0 or n > len(hay):
        return -1
    for i in range(0, len(hay) - n + 1):
        if hay[i:i + n] == needle:
            return i
    return -1


def _u16_similarity(a: list[int], b: list[int], min_ratio: float) -> float:
    if len(a) != len(b) or not b:
        return 0.0
    max_dist = int((1 - min_ratio) * len(b))
    if a == b:
        return 1.0
    prev = list(range(len(b) + 1))
    curr = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        curr[0] = i
        row_min = curr[0]
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            v = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
            curr[j] = v
            if v < row_min:
                row_min = v
        if row_min > max_dist:
            return 0.0
        prev, curr = curr, prev
    d = prev[len(b)]
    if d > max_dist:
        return 0.0
    return 1 - d / len(b)


def reanchor_quote(text: str, quote: str):
    t = _utf16_units(text)
    q = _utf16_units(quote)
    if not q or len(q) > NOTE_QUOTE_MAX or len(t) < len(q):
        return None
    i = _u16_index_of(t, q)
    if i >= 0:
        return {"start": i, "end": i + len(q), "ratio": 1.0}
    step = max(1, len(q) // 8)
    best = {"start": 0, "end": 0, "ratio": 0.0}
    for i in range(0, len(t) - len(q) + 1, step):
        r = _u16_similarity(t[i:i + len(q)], q, REANCHOR_MIN)
        if r > best["ratio"]:
            best = {"start": i, "end": i + len(q), "ratio": r}
            if r == 1:
                break
    if best["ratio"] >= REANCHOR_MIN:
        return best
    return None


def _record_copy(project_path: str, row: dict):
    """The author's list of copies sent, with what's needed to read returned
    locked copies (the server half) and to revoke them. Synced to the author's
    other devices like any project data."""
    from db_setup import ensure_review_tables
    from sync_core import log_change
    conn = _get_db(project_path)
    try:
        cur = conn.cursor()
        ensure_review_tables(cur)
        cols = ", ".join(row)
        cur.execute("INSERT INTO review_copies (%s) VALUES (%s)" % (cols, ", ".join("?" * len(row))), tuple(row.values()))
        log_change(cur, "review_copies", row["id"], {k: v for k, v in row.items() if k != "id"})
        conn.commit()
    finally:
        conn.close()


@router.post("/api/review/export")
def export_review(req: ExportReviewRequest):
    if not os.path.exists(req.project_path):
        raise HTTPException(status_code=404, detail="Project path not found")
    snap = build_snapshot(req.project_path, req.scope)
    pkg = empty_package(snap, req.reviewer_label, req.author_label, req.message)
    row = {
        "id": pkg["review_id"], "reviewer_label": pkg["reviewer_label"],
        "chapter_count": len(snap["chapters"]), "created_at": pkg["created_at"], "updated_at": pkg["created_at"],
        "deleted": 0,
    }
    days = int(req.expires_days or 0)
    if days <= 0:
        save_package(req.dest_path, pkg)
        _record_copy(req.project_path, row)
        return {"status": "ok", "path": req.dest_path, "review_id": pkg["review_id"], "expires_at": ""}

    server = req.key_server or rc.DEFAULT_KEY_SERVER
    file_half, server_half = os.urandom(32), os.urandom(32)
    try:
        made = rc.create_server_key(server, server_half, min(days, 365))
    except rc.NotTrusted:
        return {"status": "error", "error": "untrusted_server", "message": server}
    except rc.KeyServerError as e:
        return {"status": "error", "error": "key_server_unreachable", "message": str(e)}
    key_id = made["key_id"]
    pkg.update({
        "format": rc.SEALED_FORMAT,
        "title": snap["project"]["title"],
        "desktop_id": snap["project"]["desktop_id"],
        "crypto": {"v": 1, "alg": "AES-256-GCM", "kdf": "HKDF-SHA256", "server": rc.check_trusted(server),
                   "key_id": key_id, "file_half": rc.b64(file_half), "expires_at": made["expires_at"]},
    })
    write_package(req.dest_path, pkg, rc.derive_key(file_half, server_half, key_id))
    row.update({"key_id": key_id, "server": rc.check_trusted(server), "server_half": rc.b64(server_half),
                "revoke_token": made.get("revoke_token", ""), "expires_at": made["expires_at"]})
    _record_copy(req.project_path, row)
    return {"status": "ok", "path": req.dest_path, "review_id": pkg["review_id"], "expires_at": made["expires_at"]}


@router.post("/api/review/open")
def open_review(req: OpenReviewRequest):
    raw = load_package(req.path)
    return {"status": "ok", "path": req.path, "peek": peek(raw)}


def _summary(path: str, raw: dict, cache) -> dict:
    """One row of the reviewer's list. Locked copies are only opened with a
    key already cached here: listing never contacts the key server."""
    info = peek(raw)
    pkg, locked = raw, False
    if info["sealed"]:
        cached = cache.get((raw.get("crypto") or {}).get("key_id", ""))
        if cached:
            try:
                key = rc.derive_key(rc.unb64(raw["crypto"]["file_half"]), cached[0], raw["crypto"]["key_id"])
                pkg = plain_view(raw, key)
            except (ValueError, KeyError):
                locked = True
        else:
            locked = True
    snap = pkg.get("snapshot") or {}
    return {
        "path": path,
        "review_id": review_id_of(raw),
        "title": info["title"],
        "author_label": info["author_label"],
        "reviewer_label": "" if locked else pkg.get("reviewer_label") or "",
        "chapters": len(snap.get("chapters") or []),
        "notes": None if locked else len(pkg.get("notes") or []),
        "finished_at": info["finished_at"],
        "expires_at": info["expires_at"],
        "locked": locked,
        "updated_at": datetime.fromtimestamp(os.path.getmtime(path), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _working_copies(store_dir: str) -> list[dict]:
    if not os.path.isdir(store_dir):
        return []
    cache = rc.KeyCache(store_dir)
    out = []
    for name in os.listdir(store_dir):
        if not name.endswith(".flreview"):
            continue
        path = os.path.join(store_dir, name)
        try:
            out.append(_summary(path, load_package(path), cache))
        except HTTPException:
            continue
    out.sort(key=lambda r: r["updated_at"], reverse=True)
    return out


def _key_problem(e: Exception, raw: dict) -> dict:
    """Why a locked copy can't be opened, for the reviewer's screen."""
    info = peek(raw)
    if isinstance(e, rc.KeyGone):
        return {"status": "expired", "title": info["title"], "author_label": info["author_label"],
                "expires_at": info["expires_at"]}
    if isinstance(e, rc.NotTrusted):
        return {"status": "untrusted", "title": info["title"], "server": (raw.get("crypto") or {}).get("server", "")}
    if isinstance(e, ValueError):
        return {"status": "error", "message": str(e)}
    return {"status": "offline", "title": info["title"]}


def _open_key(raw: dict, store: str, online: bool):
    """The content key of a locked copy (None for a plain one). Online: ask the
    server, so an expired or revoked copy stops opening; offline-only: the
    cached half (autosave must never wait on the network)."""
    if not rc.is_sealed(raw):
        return None
    cache = rc.KeyCache(store)
    if online:
        return rc.reviewer_key(raw, cache)[0]
    crypto = raw.get("crypto") or {}
    cached = cache.get(crypto.get("key_id", ""))
    if not cached:
        raise rc.KeyGone(crypto.get("key_id", ""))
    return rc.derive_key(rc.unb64(crypto.get("file_half", "")), cached[0], crypto["key_id"])


@router.post("/api/review/start")
def start_review(req: StartReviewRequest):
    """Open a review file for reviewing. The reviewer never works in the file
    they were sent (it may sit in an email client's temp folder): notes go to a
    working copy in the app's folder, and opening the same review again later
    resumes that copy. Locked copies stay encrypted on disk."""
    store = os.path.realpath(req.store_dir)
    os.makedirs(store, exist_ok=True)
    raw = load_package(req.path)
    path = None
    if os.path.dirname(os.path.realpath(req.path)) == store:
        path = os.path.realpath(req.path)
    else:
        rid = review_id_of(raw)
        for row in _working_copies(store):
            if row["review_id"] == rid:
                path = row["path"]
                raw = load_package(path)
                break
    try:
        key = _open_key(raw, store, online=True)
        pkg = plain_view(raw, key)
    except (rc.KeyGone, rc.NotTrusted, rc.KeyServerError, ValueError) as e:
        return _key_problem(e, raw)
    if path:
        return {"status": "ok", "path": path, "package": pkg, "resumed": True}
    pkg["review_id"] = review_id_of(raw)
    # several people can review the same file; each copy is told apart on return
    pkg["copy_id"] = str(uuid.uuid4())
    pkg["notes"] = clean_notes(pkg.get("notes"))
    pkg["scores"] = clean_scores(pkg.get("scores"))
    pkg.pop("finished_at", None)
    dest = os.path.join(store, "%s.flreview" % uuid.uuid4())
    write_package(dest, pkg, key)
    return {"status": "ok", "path": dest, "package": pkg, "resumed": False}


@router.post("/api/review/list")
def list_reviews(req: StoreRequest):
    return {"status": "ok", "reviews": _working_copies(os.path.realpath(req.store_dir))}


@router.post("/api/review/save")
def save_review(req: SaveReviewRequest):
    path = _in_store(req.path, req.store_dir)
    raw = load_package(path)
    try:
        key = _open_key(raw, os.path.realpath(req.store_dir), online=False)
        current = plain_view(raw, key)
    except (rc.KeyGone, ValueError) as e:
        return _key_problem(e, raw)
    incoming = req.package or {}
    # only the reviewer's own fields change; the manuscript snapshot stays as sent
    current["reviewer_label"] = _text(incoming.get("reviewer_label"), LABEL_MAX)
    current["notes"] = clean_notes(incoming.get("notes"))
    current["scores"] = clean_scores(incoming.get("scores"))
    write_package(path, current, key)
    return {"status": "ok", "path": path}


@router.post("/api/review/finish")
def finish_review(req: FinishReviewRequest):
    """Write the reviewed copy the reviewer sends back to the author (still
    locked, if it was: the author's app holds both key halves)."""
    path = _in_store(req.path, req.store_dir)
    raw = load_package(path)
    try:
        key = _open_key(raw, os.path.realpath(req.store_dir), online=False)
        pkg = plain_view(raw, key)
    except (rc.KeyGone, ValueError) as e:
        return _key_problem(e, raw)
    pkg["finished_at"] = _now()
    write_package(path, pkg, key)
    write_package(req.dest_path, pkg, key)
    return {"status": "ok", "path": req.dest_path}


@router.post("/api/review/discard")
def discard_review(req: DiscardReviewRequest):
    path = _in_store(req.path, req.store_dir)
    os.remove(path)
    return {"status": "ok"}

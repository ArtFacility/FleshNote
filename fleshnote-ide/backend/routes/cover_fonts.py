"""
FleshNote API — Cover Font Pack (runtime download) & Custom Font Helpers

Curated cover fonts are NOT bundled in the git repo or installer; users can
download the optional "Cover Font Pack" on demand into OS app-data
(e.g. %APPDATA%/FleshNote/CoverFonts). Users can also import their own
.ttf/.otf/.woff2/.woff font files into a project's assets/cover/ folder so
custom fonts travel inside .flnote archives and sync.
"""
import base64
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.request
from urllib.parse import quote_plus

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

FONT_EXTS = {".ttf", ".otf", ".woff2", ".woff"}
MAX_FONT_BYTES = 15 * 1024 * 1024
MAX_PACK_FILE_BYTES = 5 * 1024 * 1024
_SAFE_FONT_FILE = re.compile(r"^[a-z0-9_]+\.ttf$")
_ALLOWED_HOST_PREFIX = "https://fonts.gstatic.com/"

# Curated open-licensed (OFL) cover font pack catalog
FONT_PACK_FAMILIES = {
    "cinzel": {
        "id": "cinzel",
        "label": "Cinzel",
        "gf_family": "Cinzel",
        "query": "Cinzel:wght@400;700",
        "category": "Fantasy / Classical",
        "bold": True,
        "italic": False,
    },
    "cormorant": {
        "id": "cormorant",
        "label": "Cormorant Garamond",
        "gf_family": "Cormorant Garamond",
        "query": "Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700",
        "category": "Literary Serif",
        "bold": True,
        "italic": True,
    },
    "playfair": {
        "id": "playfair",
        "label": "Playfair Display",
        "gf_family": "Playfair Display",
        "query": "Playfair+Display:ital,wght@0,400;0,700;1,400;1,700",
        "category": "Editorial / Romance",
        "bold": True,
        "italic": True,
    },
    "unifraktur": {
        "id": "unifraktur",
        "label": "UnifrakturMaguntia",
        "gf_family": "UnifrakturMaguntia",
        "query": "UnifrakturMaguntia",
        "category": "Gothic / Dark",
        "bold": False,
        "italic": False,
    },
    "oswald": {
        "id": "oswald",
        "label": "Oswald",
        "gf_family": "Oswald",
        "query": "Oswald:wght@400;700",
        "category": "Thriller / Condensed",
        "bold": True,
        "italic": False,
    },
    "bebas": {
        "id": "bebas",
        "label": "Bebas Neue",
        "gf_family": "Bebas Neue",
        "query": "Bebas+Neue",
        "category": "Bold Display",
        "bold": False,
        "italic": False,
    },
    "caveat": {
        "id": "caveat",
        "label": "Caveat",
        "gf_family": "Caveat",
        "query": "Caveat:wght@400;700",
        "category": "Handwritten",
        "bold": True,
        "italic": False,
    },
    "abril": {
        "id": "abril",
        "label": "Abril Fatface",
        "gf_family": "Abril Fatface",
        "query": "Abril+Fatface",
        "category": "Modern Fiction",
        "bold": False,
        "italic": False,
    },
}

FONT_PACK_IDS = tuple(FONT_PACK_FAMILIES.keys())


def get_cover_fonts_dir() -> str:
    """Persistent OS-level directory for the runtime-downloaded cover font pack."""
    if sys.platform == "win32":
        base = os.getenv("APPDATA") or os.path.expanduser("~\\AppData\\Roaming")
        return os.path.join(base, "FleshNote", "CoverFonts")
    elif sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/FleshNote/CoverFonts")
    return os.path.expanduser("~/.config/FleshNote/CoverFonts")


def is_valid_font_bytes(raw: bytes) -> bool:
    """Checks TTF, OTF, WOFF, or WOFF2 magic bytes."""
    if len(raw) < 12:
        return False
    head = raw[:4]
    return head in (
        b"\x00\x01\x00\x00",
        b"true",
        b"typ1",
        b"ttcf",
        b"OTTO",
        b"wOFF",
        b"wOF2",
    )


def _manifest_path(fonts_dir: str | None = None) -> str:
    return os.path.join(fonts_dir or get_cover_fonts_dir(), "manifest.json")


def _load_manifest(fonts_dir: str | None = None) -> dict | None:
    d = fonts_dir or get_cover_fonts_dir()
    path = _manifest_path(d)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("files"), dict):
            return data
    except Exception:
        pass
    return None


def pack_status(fonts_dir: str | None = None) -> dict:
    d = fonts_dir or get_cover_fonts_dir()
    manifest = _load_manifest(d)
    if not manifest:
        return {
            "installed": False,
            "families": [],
            "totalBytes": 0,
            "catalog": [
                {
                    "id": v["id"],
                    "label": v["label"],
                    "category": v["category"],
                    "bold": v["bold"],
                    "italic": v["italic"],
                }
                for v in FONT_PACK_FAMILIES.values()
            ],
        }
    installed_families = []
    total_bytes = 0
    for fid, entries in manifest["files"].items():
        if fid not in FONT_PACK_FAMILIES or not isinstance(entries, list) or not entries:
            continue
        ok = True
        for entry in entries:
            fname = entry.get("file", "")
            full = os.path.join(d, fname)
            if not _SAFE_FONT_FILE.match(fname) or not os.path.isfile(full):
                ok = False
                break
            total_bytes += os.path.getsize(full)
        if ok:
            installed_families.append(fid)
    return {
        "installed": len(installed_families) == len(FONT_PACK_FAMILIES),
        "families": installed_families,
        "totalBytes": total_bytes,
        "catalog": [
            {
                "id": v["id"],
                "label": v["label"],
                "category": v["category"],
                "bold": v["bold"],
                "italic": v["italic"],
            }
            for v in FONT_PACK_FAMILIES.values()
        ],
    }


def _fetch_bytes(url: str, max_bytes: int, headers: dict | None = None) -> bytes:
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "FleshNote/2.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ValueError("Downloaded file exceeds size limit.")
    return data


def _parse_css2_faces(css_text: str) -> list[dict]:
    by_gf = {v["gf_family"].lower(): k for k, v in FONT_PACK_FAMILIES.items()}
    faces = []
    for block in re.findall(r"@font-face\s*\{([^}]+)\}", css_text):
        fam_m = re.search(r"font-family:\s*['\"]([^'\"]+)['\"]", block)
        sty_m = re.search(r"font-style:\s*(normal|italic)", block)
        wgt_m = re.search(r"font-weight:\s*(\d+)", block)
        url_m = re.search(r"url\((https://[^)\s]+)\)", block)
        if not (fam_m and url_m):
            continue
        fid = by_gf.get(fam_m.group(1).strip().lower())
        url = url_m.group(1).strip()
        if not fid or not url.startswith(_ALLOWED_HOST_PREFIX):
            continue
        faces.append({
            "id": fid,
            "style": sty_m.group(1) if sty_m else "normal",
            "weight": int(wgt_m.group(1)) if wgt_m else 400,
            "url": url,
        })
    return faces


def download_font_pack(fonts_dir: str | None = None, fetch_fn=_fetch_bytes) -> dict:
    """Downloads the curated Cover Font Pack into OS app-data atomically."""
    target_dir = fonts_dir or get_cover_fonts_dir()
    os.makedirs(target_dir, exist_ok=True)
    query_parts = "&".join(f"family={v['query']}" for v in FONT_PACK_FAMILIES.values())
    css_url = f"https://fonts.googleapis.com/css2?{query_parts}"
    css_bytes = fetch_fn(css_url, 256 * 1024, {"User-Agent": "FleshNote/2.0"})
    faces = _parse_css2_faces(css_bytes.decode("utf-8", errors="replace"))
    if not faces:
        raise RuntimeError("Could not resolve font files from font pack manifest.")

    staging = tempfile.mkdtemp(prefix="fn_fontpack_", dir=target_dir)
    manifest_files: dict[str, list[dict]] = {}
    try:
        for face in faces:
            raw = fetch_fn(face["url"], MAX_PACK_FILE_BYTES, {"User-Agent": "FleshNote/2.0"})
            if not is_valid_font_bytes(raw):
                raise RuntimeError(f"Invalid font data for {face['id']}")
            fname = f"{face['id']}_{face['style']}_{face['weight']}.ttf"
            with open(os.path.join(staging, fname), "wb") as out:
                out.write(raw)
            manifest_files.setdefault(face["id"], []).append({
                "style": face["style"],
                "weight": face["weight"],
                "file": fname,
            })

        if set(manifest_files.keys()) != set(FONT_PACK_FAMILIES.keys()):
            missing = sorted(set(FONT_PACK_FAMILIES.keys()) - set(manifest_files.keys()))
            raise RuntimeError(f"Font pack incomplete; missing: {', '.join(missing)}")

        for entries in manifest_files.values():
            for entry in entries:
                shutil.move(os.path.join(staging, entry["file"]), os.path.join(target_dir, entry["file"]))
        tmp_manifest = os.path.join(staging, "manifest.json")
        with open(tmp_manifest, "w", encoding="utf-8") as mf:
            json.dump({"version": 1, "files": manifest_files}, mf)
        shutil.move(tmp_manifest, _manifest_path(target_dir))
    finally:
        shutil.rmtree(staging, ignore_errors=True)

    return pack_status(target_dir)


def remove_font_pack(fonts_dir: str | None = None) -> dict:
    d = fonts_dir or get_cover_fonts_dir()
    if os.path.isdir(d):
        shutil.rmtree(d, ignore_errors=True)
    return pack_status(d)


def read_pack_font_faces(font_id: str, fonts_dir: str | None = None) -> list[dict]:
    if font_id not in FONT_PACK_FAMILIES:
        return []
    d = fonts_dir or get_cover_fonts_dir()
    manifest = _load_manifest(d)
    if not manifest:
        return []
    out = []
    for entry in manifest["files"].get(font_id, []):
        fname = entry.get("file", "")
        if not _SAFE_FONT_FILE.match(fname):
            continue
        full = os.path.join(d, fname)
        if os.path.isfile(full) and not os.path.islink(full):
            with open(full, "rb") as f:
                out.append({
                    "style": entry.get("style", "normal"),
                    "weight": int(entry.get("weight", 400)),
                    "data": base64.b64encode(f.read()).decode("ascii"),
                })
    return out


# ── Endpoints ─────────────────────────────────────────────────────────────────

class FontReadReq(BaseModel):
    project_path: str | None = None
    font_id: str
    path: str | None = None


@router.post("/api/cover/font-pack/status")
def api_font_pack_status():
    return {"status": "success", **pack_status()}


@router.post("/api/cover/font-pack/download")
def api_font_pack_download():
    try:
        res = download_font_pack()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not download font pack: {e}")
    return {"status": "success", **res}


@router.post("/api/cover/font-pack/remove")
def api_font_pack_remove():
    return {"status": "success", **remove_font_pack()}


@router.post("/api/cover/read-font")
def api_read_font(req: FontReadReq):
    if req.font_id in FONT_PACK_FAMILIES:
        faces = read_pack_font_faces(req.font_id)
        return {"status": "success", "installed": len(faces) > 0, "faces": faces}
    if req.path and req.project_path:
        if not re.match(r"^assets/cover/font_[0-9a-f]{12}\.(ttf|otf|woff2|woff)$", req.path):
            return {"status": "success", "installed": False, "faces": []}
        full = os.path.join(req.project_path, *req.path.split("/"))
        if os.path.isfile(full) and not os.path.islink(full):
            with open(full, "rb") as f:
                return {
                    "status": "success",
                    "installed": True,
                    "faces": [{"style": "normal", "weight": 400, "data": base64.b64encode(f.read()).decode("ascii")}],
                }
    return {"status": "success", "installed": False, "faces": []}

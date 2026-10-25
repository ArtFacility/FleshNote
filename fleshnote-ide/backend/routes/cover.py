"""
FleshNote API — Book cover (alpha)

The cover is a small JSON document stored in project_config under "cover"
(so it syncs and travels inside .flnote files like the rest of the project's
settings). Its images live in assets/cover/ under unique names, which keeps
copy-if-absent asset sync and .flnote packing correct.

Document (version 1):
    {
      "version": 1,
      "faces": {
        "front" | "spine" | "back": {
          "bg": "#rrggbb",
          "image": "assets/cover/img_<hex>.png" | null,
          "fit": "fill" | "fit",
          "texts": [{ "id", "text", "x", "y", "w", "size", "font", "bold",
                      "italic", "upper", "spacing", "align", "color" }]
        }
      },
      "render": { "front": "assets/cover/front_<hex>.png", "spine": ... }
    }

Positions are fractions of the face (x, y = the centre of a text box, w = its
width); size is a fraction of the face's shorter side, so a cover keeps its
layout when the trim size or spine width changes. The spine is laid out lying
on its side (its long edge horizontal) and turned 90° when shown.

"render" holds images the editor drew from the document: the front cover is
used on the bookshelf and as the EPUB cover, the spine on the export window's
book. Cover documents can come from someone else's project (sync, shared
.flnote files), so everything is validated on the way in and out.
"""
import base64
import json
import os
import re
import shutil
import sqlite3
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

COVER_DIR = "assets/cover"
FACES = ("front", "spine", "back")
FONTS = ("serif", "sans", "mono", "runes")
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
MAX_IMAGE_BYTES = 40 * 1024 * 1024
MAX_RENDER_BYTES = 25 * 1024 * 1024
MAX_TEXTS = 12
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_ASSET = re.compile(r"^assets/cover/(img|front|spine)_[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif|bmp)$")
_ID = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


# ── Validation ────────────────────────────────────────────────────────────────

def _num(v, lo, hi, default):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return default
    if v != v:  # NaN
        return default
    return min(hi, max(lo, v))


def _asset(project_path: str, rel) -> str | None:
    """A cover asset path, only if it is one of ours and the file exists."""
    if not isinstance(rel, str) or not _ASSET.match(rel):
        return None
    full = os.path.join(project_path, *rel.split("/"))
    return rel if os.path.isfile(full) and not os.path.islink(full) else None


def _text(t) -> dict | None:
    if not isinstance(t, dict):
        return None
    tid = t.get("id")
    return {
        "id": tid if isinstance(tid, str) and _ID.match(tid) else uuid.uuid4().hex[:12],
        "text": str(t.get("text") or "")[:2000],
        "x": _num(t.get("x"), 0, 1, 0.5),
        "y": _num(t.get("y"), 0, 1, 0.5),
        "w": _num(t.get("w"), 0.05, 1, 0.8),
        "size": _num(t.get("size"), 0.01, 0.6, 0.08),
        "font": t.get("font") if t.get("font") in FONTS else "serif",
        "bold": bool(t.get("bold")),
        "italic": bool(t.get("italic")),
        "upper": bool(t.get("upper")),
        "spacing": _num(t.get("spacing"), -0.05, 0.5, 0),
        "align": t.get("align") if t.get("align") in ("left", "center", "right") else "center",
        "color": t.get("color") if isinstance(t.get("color"), str) and _HEX.match(t.get("color")) else "#f3ead8",
    }


def sanitize_cover(doc, project_path: str) -> dict | None:
    """A clean cover document, or None when there is no usable cover."""
    if not isinstance(doc, dict) or not isinstance(doc.get("faces"), dict):
        return None
    faces = {}
    for name in FACES:
        f = doc["faces"].get(name)
        f = f if isinstance(f, dict) else {}
        texts = [x for x in (_text(t) for t in (f.get("texts") or [])[:MAX_TEXTS]) if x]
        faces[name] = {
            "bg": f.get("bg") if isinstance(f.get("bg"), str) and _HEX.match(f.get("bg")) else "#2c3d5c",
            "image": _asset(project_path, f.get("image")),
            "fit": "fit" if f.get("fit") == "fit" else "fill",
            "texts": texts,
        }
    render = doc.get("render") if isinstance(doc.get("render"), dict) else {}
    return {
        "version": 1,
        "faces": faces,
        "render": {k: _asset(project_path, render.get(k)) for k in ("front", "spine")},
    }


def load_cover(project_path: str) -> dict | None:
    """The project's cover document (validated), or None."""
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        return None
    try:
        conn = sqlite3.connect(db_path)
        try:
            row = conn.execute("SELECT config_value FROM project_config WHERE config_key = 'cover'").fetchone()
        finally:
            conn.close()
        return sanitize_cover(json.loads(row[0]), project_path) if row and row[0] else None
    except Exception:
        return None


def front_render_path(project_path: str) -> str | None:
    """Absolute path of the drawn front cover, if the project has one."""
    cover = load_cover(project_path)
    rel = cover and cover["render"].get("front")
    return os.path.join(project_path, *rel.split("/")) if rel else None


def _save_config(project_path: str, value: str):
    from sync_core import log_change
    conn = sqlite3.connect(os.path.join(project_path, "fleshnote.db"))
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO project_config (config_key, config_value, config_type) VALUES ('cover', ?, 'json')
            ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value,
                                                  config_type = excluded.config_type
        """, (value,))
        log_change(cursor, "project_config", "cover", {"config_value": value, "config_type": "json"})
        conn.commit()
    finally:
        conn.close()


def _write_render(project_path: str, kind: str, data_url) -> str | None:
    """Stores a PNG the editor drew (a data: URL) under a new unique name."""
    if not isinstance(data_url, str) or not data_url.startswith("data:image/png;base64,"):
        return None
    raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    if len(raw) > MAX_RENDER_BYTES or not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=400, detail="The cover image is not a valid PNG.")
    rel = "%s/%s_%s.png" % (COVER_DIR, kind, uuid.uuid4().hex[:12])
    with open(os.path.join(project_path, *rel.split("/")), "wb") as f:
        f.write(raw)
    return rel


def _prune(project_path: str, keep: set):
    """Removes cover files no longer referenced by this device's cover."""
    folder = os.path.join(project_path, *COVER_DIR.split("/"))
    if not os.path.isdir(folder):
        return
    for name in os.listdir(folder):
        rel = "%s/%s" % (COVER_DIR, name)
        if _ASSET.match(rel) and rel not in keep:
            try:
                os.remove(os.path.join(folder, name))
            except OSError:
                pass


# ── Endpoints ─────────────────────────────────────────────────────────────────

class CoverGet(BaseModel):
    project_path: str


class CoverImageAdd(BaseModel):
    project_path: str
    source_path: str


class CoverSave(BaseModel):
    project_path: str
    cover: dict | None = None
    front_png: str | None = None   # data:image/png;base64,…
    spine_png: str | None = None


@router.post("/api/project/cover/get")
def get_cover(req: CoverGet):
    return {"status": "success", "cover": load_cover(req.project_path)}


@router.post("/api/project/cover/add-image")
def add_cover_image(req: CoverImageAdd):
    """Copies an image into assets/cover/ and returns its project-relative path."""
    src = req.source_path
    ext = os.path.splitext(src)[1].lower()
    if ext not in IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="Use a PNG, JPEG, WebP, GIF or BMP image.")
    if not os.path.isfile(src) or os.path.islink(src):
        raise HTTPException(status_code=400, detail="The image file was not found.")
    if os.path.getsize(src) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="The image is larger than 40 MB.")
    folder = os.path.join(req.project_path, *COVER_DIR.split("/"))
    os.makedirs(folder, exist_ok=True)
    rel = "%s/img_%s%s" % (COVER_DIR, uuid.uuid4().hex[:12], ext)
    shutil.copyfile(src, os.path.join(req.project_path, *rel.split("/")))
    return {"status": "success", "path": rel}


def _referenced(cover: dict | None) -> set:
    if not cover:
        return set()
    keep = {f["image"] for f in cover["faces"].values() if f["image"]}
    return keep | {v for v in cover["render"].values() if v}


@router.post("/api/project/cover/cleanup")
def cleanup_cover(req: CoverGet):
    """Removes cover files the saved cover does not use: images tried in the
    editor and then discarded. They would otherwise travel with every sync and
    shared .flnote file."""
    _prune(req.project_path, _referenced(load_cover(req.project_path)))
    return {"status": "success"}


@router.post("/api/project/cover/save")
def save_cover(req: CoverSave):
    """Saves the cover document and the drawn front/spine images.
    cover: null removes the cover."""
    if not os.path.exists(os.path.join(req.project_path, "fleshnote.db")):
        raise HTTPException(status_code=404, detail="Project not found")
    if req.cover is None:
        _save_config(req.project_path, "null")
        _prune(req.project_path, set())
        return {"status": "success", "cover": None}

    os.makedirs(os.path.join(req.project_path, *COVER_DIR.split("/")), exist_ok=True)
    doc = dict(req.cover)
    written = []
    try:
        doc["render"] = {}
        for kind, data in (("front", req.front_png), ("spine", req.spine_png)):
            doc["render"][kind] = _write_render(req.project_path, kind, data)
            written.append(doc["render"][kind])
        clean = sanitize_cover(doc, req.project_path)
        if clean is None:
            raise HTTPException(status_code=400, detail="The cover could not be read.")
    except Exception:
        # nothing half-saved stays behind
        for rel in filter(None, written):
            try:
                os.remove(os.path.join(req.project_path, *rel.split("/")))
            except OSError:
                pass
        raise
    _save_config(req.project_path, json.dumps(clean, ensure_ascii=False))
    _prune(req.project_path, _referenced(clean))
    return {"status": "success", "cover": clean}

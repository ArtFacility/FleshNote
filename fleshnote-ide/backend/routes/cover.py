"""
FleshNote API — Book cover (v2)

The cover is a small JSON document stored in project_config under "cover"
(so it syncs and travels inside .flnote files like the rest of the project's
settings). Its images live in assets/cover/ under unique names, which keeps
copy-if-absent asset sync and .flnote packing correct.

Document (version 2):
    {
      "version": 2,
      "faces": {
        "front" | "spine" | "back": {
          "bg": "#rrggbb",
          "bgType": "solid" | "linear" | "radial",
          "bg2": "#rrggbb",
          "bgAngle": 0..360,
          "image": "assets/cover/img_<hex>.png" | null,
          "fit": "fill" | "fit",
          "imageOpacity": 0..1,
          "imageScale": 0.5..3,
          "imageX": 0..1,
          "imageY": 0..1,
          "vignette": 0..1,
          "layers": [
            { "id", "type": "text" | "shape", "x", "y", "w", "rotation",
              "opacity", "visible", "locked", ... }
          ]
        }
      },
      "render": { "front": "assets/cover/front_<hex>.png", "spine": ... }
    }

v1 documents (using "texts" instead of "layers") are migrated automatically on
sanitization. Positions are fractions of the face (x, y = the centre of a
layer box, w = its width); size and strokeWidth are fractions of the face's
shorter side, so a cover keeps its layout when the trim size or spine width
changes. The spine is laid out lying on its side (its long edge horizontal) and
turned 90° when shown.

"render" holds images the editor drew from the document: the front cover is
used on the bookshelf and as the EPUB cover, the spine on the export window's
book. Cover documents can come from someone else's project (sync, shared
.flnote files), so everything is validated on the way in and out.
"""
import base64
import datetime
import json
import os
import re
import shutil
import sqlite3
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from routes.cover_fonts import (
    FONT_EXTS,
    FONT_PACK_IDS,
    MAX_FONT_BYTES,
    is_valid_font_bytes,
    router as cover_fonts_router,
)

router = APIRouter()
router.include_router(cover_fonts_router)

COVER_DIR = "assets/cover"
FACES = ("front", "spine", "back")
BG_TYPES = ("solid", "linear", "radial")
FONTS = ("serif", "sans", "mono", "runes")
SHAPES = (
    "rect", "double-frame", "circle", "diamond", "triangle",
    "line", "star", "crescent", "corners",
)
LINE_STYLES = ("solid", "double", "ornate")
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
MAX_IMAGE_BYTES = 40 * 1024 * 1024
MAX_RENDER_BYTES = 25 * 1024 * 1024
MAX_WRAP_BYTES = 45 * 1024 * 1024
MAX_LAYERS = 40
MAX_CUSTOM_FONTS = 20
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_IMAGE_ASSET = re.compile(r"^assets/cover/(img|front|spine|back)_[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif|bmp)$")
_FONT_ASSET = re.compile(r"^assets/cover/font_[0-9a-f]{12}\.(ttf|otf|woff2|woff)$")
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


def _hex(v, default):
    return v if isinstance(v, str) and _HEX.match(v) else default


def _paint(v, default):
    if v == "none":
        return "none"
    return _hex(v, default)


def _asset(project_path: str, rel, pattern=_IMAGE_ASSET) -> str | None:
    """A cover asset path, only if it is one of ours and the file exists."""
    if not isinstance(rel, str) or not pattern.match(rel):
        return None
    full = os.path.join(project_path, *rel.split("/"))
    return rel if os.path.isfile(full) and not os.path.islink(full) else None


def _layer_id(raw) -> str:
    return raw if isinstance(raw, str) and _ID.match(raw) else uuid.uuid4().hex[:12]


def _fonts(raw, project_path: str) -> dict:
    if not isinstance(raw, dict):
        return {}
    out = {}
    for fid, entry in list(raw.items())[:MAX_CUSTOM_FONTS]:
        if not isinstance(fid, str) or not _ID.match(fid) or not isinstance(entry, dict):
            continue
        path = _asset(project_path, entry.get("path"), _FONT_ASSET)
        if not path:
            continue
        label = str(entry.get("label") or fid).strip()[:80] or fid
        out[fid] = {"id": fid, "label": label, "path": path}
    return out


def _text_layer(t: dict, allowed_fonts: set[str]) -> dict:
    return {
        "id": _layer_id(t.get("id")),
        "type": "text",
        "text": str(t.get("text") or "")[:2000],
        "x": _num(t.get("x"), 0, 1, 0.5),
        "y": _num(t.get("y"), 0, 1, 0.5),
        "w": _num(t.get("w"), 0.02, 1.5, 0.8),
        "size": _num(t.get("size"), 0.01, 0.6, 0.08),
        "font": t.get("font") if t.get("font") in allowed_fonts else "serif",
        "bold": bool(t.get("bold")),
        "italic": bool(t.get("italic")),
        "upper": bool(t.get("upper")),
        "spacing": _num(t.get("spacing"), -0.05, 0.5, 0),
        "lineHeight": _num(t.get("lineHeight"), 0.7, 2.5, 1.2),
        "align": t.get("align") if t.get("align") in ("left", "center", "right") else "center",
        "color": _hex(t.get("color"), "#f3ead8"),
        "shadow": _num(t.get("shadow"), 0, 1, 0),
        "shadowColor": _hex(t.get("shadowColor"), "#000000"),
        "rotation": _num(t.get("rotation"), -180, 180, 0),
        "opacity": _num(t.get("opacity"), 0, 1, 1),
        "visible": True if t.get("visible") is None else bool(t.get("visible")),
        "locked": bool(t.get("locked")),
    }


def _shape_layer(s: dict) -> dict:
    return {
        "id": _layer_id(s.get("id")),
        "type": "shape",
        "shape": s.get("shape") if s.get("shape") in SHAPES else "rect",
        "x": _num(s.get("x"), 0, 1, 0.5),
        "y": _num(s.get("y"), 0, 1, 0.5),
        "w": _num(s.get("w"), 0.02, 1.5, 0.5),
        "h": _num(s.get("h"), 0.005, 1.5, 0.25),
        "fill": _paint(s.get("fill"), "#d4a052"),
        "stroke": _paint(s.get("stroke"), "#f3ead8"),
        "strokeWidth": _num(s.get("strokeWidth"), 0, 0.05, 0.004),
        "radius": _num(s.get("radius"), 0, 0.5, 0),
        "lineStyle": s.get("lineStyle") if s.get("lineStyle") in LINE_STYLES else "solid",
        "rotation": _num(s.get("rotation"), -180, 180, 0),
        "opacity": _num(s.get("opacity"), 0, 1, 1),
        "visible": True if s.get("visible") is None else bool(s.get("visible")),
        "locked": bool(s.get("locked")),
    }


def _layer(raw, allowed_fonts: set[str]) -> dict | None:
    if not isinstance(raw, dict):
        return None
    if raw.get("type") == "shape":
        return _shape_layer(raw)
    return _text_layer(raw, allowed_fonts)


def sanitize_cover(doc, project_path: str) -> dict | None:
    """A clean cover document (migrating v1 texts -> v2 layers), or None when invalid."""
    if not isinstance(doc, dict) or not isinstance(doc.get("faces"), dict):
        return None
    fonts = _fonts(doc.get("fonts"), project_path)
    allowed_fonts = set(FONTS) | set(FONT_PACK_IDS) | set(fonts.keys())
    faces = {}
    for name in FACES:
        f = doc["faces"].get(name)
        f = f if isinstance(f, dict) else {}
        if isinstance(f.get("layers"), list):
            raw_layers = f["layers"][:MAX_LAYERS]
        elif isinstance(f.get("texts"), list):
            # v1 migration: convert legacy texts array into text layers
            raw_layers = [{"type": "text", **t} for t in f["texts"][:MAX_LAYERS] if isinstance(t, dict)]
        else:
            raw_layers = []
        layers = [x for x in (_layer(item, allowed_fonts) for item in raw_layers) if x]
        faces[name] = {
            "bg": _hex(f.get("bg"), "#2c3d5c"),
            "bgType": f.get("bgType") if f.get("bgType") in BG_TYPES else "solid",
            "bg2": _hex(f.get("bg2"), "#141c2b"),
            "bgAngle": _num(f.get("bgAngle"), 0, 360, 180),
            "image": _asset(project_path, f.get("image")),
            "fit": "fit" if f.get("fit") == "fit" else "fill",
            "imageOpacity": _num(f.get("imageOpacity"), 0, 1, 1),
            "imageScale": _num(f.get("imageScale"), 0.5, 3, 1),
            "imageX": _num(f.get("imageX"), 0, 1, 0.5),
            "imageY": _num(f.get("imageY"), 0, 1, 0.5),
            "vignette": _num(f.get("vignette"), 0, 1, 0),
            "layers": layers,
        }
    render = doc.get("render") if isinstance(doc.get("render"), dict) else {}
    return {
        "version": 2,
        "fonts": fonts,
        "faces": faces,
        "render": {k: _asset(project_path, render.get(k)) for k in ("front", "spine", "back")},
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
        if (_IMAGE_ASSET.match(rel) or _FONT_ASSET.match(rel)) and rel not in keep:
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
    back_png: str | None = None


class CoverWrapExport(BaseModel):
    project_path: str
    png_data: str                  # data:image/png;base64,…
    format: str = "pdf"            # "pdf" | "png"
    width_in: float
    height_in: float


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


@router.post("/api/project/cover/add-font")
def add_cover_font(req: CoverImageAdd):
    """Copies a custom font file (.ttf/.otf/.woff2/.woff) into assets/cover/."""
    src = req.source_path
    ext = os.path.splitext(src)[1].lower()
    if ext not in FONT_EXTS:
        raise HTTPException(status_code=400, detail="Use a TTF, OTF, WOFF2, or WOFF font file.")
    if not os.path.isfile(src) or os.path.islink(src):
        raise HTTPException(status_code=400, detail="The font file was not found.")
    if os.path.getsize(src) > MAX_FONT_BYTES:
        raise HTTPException(status_code=400, detail="The font file is larger than 15 MB.")
    with open(src, "rb") as f:
        head = f.read(16)
    if not is_valid_font_bytes(head):
        raise HTTPException(status_code=400, detail="The file does not look like a valid font.")
    folder = os.path.join(req.project_path, *COVER_DIR.split("/"))
    os.makedirs(folder, exist_ok=True)
    fid = "cf_%s" % uuid.uuid4().hex[:12]
    rel = "%s/font_%s%s" % (COVER_DIR, uuid.uuid4().hex[:12], ext)
    shutil.copyfile(src, os.path.join(req.project_path, *rel.split("/")))
    raw_name = os.path.splitext(os.path.basename(src))[0]
    label = re.sub(r"[-_]+", " ", raw_name).strip()[:60] or fid
    return {"status": "success", "font": {"id": fid, "label": label, "path": rel}}


def _referenced(cover: dict | None) -> set:
    if not cover:
        return set()
    keep = {f["image"] for f in cover["faces"].values() if f["image"]}
    fonts = {f["path"] for f in (cover.get("fonts") or {}).values() if f.get("path")}
    return keep | fonts | {v for v in cover["render"].values() if v}


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
        for kind, data in (("front", req.front_png), ("spine", req.spine_png), ("back", req.back_png)):
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


@router.post("/api/project/cover/export-wrap")
def export_cover_wrap(req: CoverWrapExport):
    """Exports the full 300 DPI cover wrap (back + spine + front + bleed) to exports/."""
    if not os.path.exists(os.path.join(req.project_path, "fleshnote.db")):
        raise HTTPException(status_code=404, detail="Project not found")
    if req.format not in ("png", "pdf"):
        raise HTTPException(status_code=400, detail="Use 'png' or 'pdf' format.")
    if not isinstance(req.png_data, str) or not req.png_data.startswith("data:image/png;base64,"):
        raise HTTPException(status_code=400, detail="Invalid PNG image data.")
    raw = base64.b64decode(req.png_data.split(",", 1)[1], validate=True)
    if len(raw) > MAX_WRAP_BYTES or not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=400, detail="The cover wrap image is not a valid PNG.")

    w_in = _num(req.width_in, 1.0, 40.0, 11.0)
    h_in = _num(req.height_in, 1.0, 40.0, 8.5)

    from export.pipeline import ExportPipeline
    pipe = ExportPipeline(req.project_path)
    slug = re.sub(r"[^A-Z0-9_\-]+", "_", pipe.project_title, flags=re.IGNORECASE).strip("_") or "export"
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    base = "%s_cover_wrap_%s" % (slug, stamp)
    filepath = os.path.join(pipe.export_dir, "%s.%s" % (base, req.format))
    n = 2
    while os.path.exists(filepath):
        filepath = os.path.join(pipe.export_dir, "%s_%d.%s" % (base, n, req.format))
        n += 1

    if req.format == "png":
        with open(filepath, "wb") as f:
            f.write(raw)
        return {"status": "success", "filepath": filepath}

    b64 = base64.b64encode(raw).decode("ascii")
    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8' />"
        "<style>@page { size: %.4fin %.4fin; margin: 0; } "
        "html, body { margin: 0; padding: 0; width: %.4fin; height: %.4fin; overflow: hidden; } "
        "img { display: block; width: 100%%; height: 100%%; }</style>"
        "</head><body><img src='data:image/png;base64,%s' alt='' /></body></html>"
        % (w_in, h_in, w_in, h_in, b64)
    )
    return {"status": "print", "filepath": filepath, "html": html}

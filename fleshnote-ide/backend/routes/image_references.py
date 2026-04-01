"""
FleshNote API — Image Reference Routes
CRUD operations for entity reference images and icons.

Supports world-time filtering (author mode shows all, world_time mode
filters by in-universe chronological time — same as knowledge states).
"""

import os
import re
import uuid
import base64
import shutil
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class ImageUploadRequest(BaseModel):
    project_path: str
    source_path: str


class IconCropSaveRequest(BaseModel):
    project_path: str
    entity_id: int
    entity_type: str
    image_data: str           # base64-encoded PNG from canvas crop


class ImageRefCreate(BaseModel):
    project_path: str
    entity_id: int
    entity_type: str              # 'char', 'loc', 'item'
    image_path: str               # relative path inside project (e.g. 'assets/img_xxx.png')
    is_icon: int = 0
    world_time: str | None = None
    caption: str | None = None


class ImageRefUpdate(BaseModel):
    project_path: str
    image_ref_id: int
    is_icon: int | None = None
    world_time: str | None = None
    caption: str | None = None
    sort_order: int | None = None


class ImageRefDelete(BaseModel):
    project_path: str
    image_ref_id: int
    delete_file: bool = False


class ImageRefsForEntity(BaseModel):
    project_path: str
    entity_type: str
    entity_id: int
    filter_mode: str = "author"         # 'author' or 'world_time'
    current_world_time: str | None = None


class BulkIconsRequest(BaseModel):
    project_path: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _row_to_dict(row) -> dict:
    return dict(row)


def _extract_year(text: str | None) -> int | None:
    if not text:
        return None
    patterns = [
        r'[Yy]ear\s+(\d+)',
        r'(\d+)\s*[Ee]',
        r'[Ee]\s*-?\s*(\d+)',
        r'\b(\d{2,})\b',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return int(match.group(1))
    return None


def _filter_by_world_time(refs: list[dict], current_world_time: str | None) -> list[dict]:
    if not current_world_time:
        return refs
    current_year = _extract_year(current_world_time)
    if current_year is None:
        return refs
    filtered = []
    for ref in refs:
        ref_year = _extract_year(ref.get("world_time"))
        if ref_year is None:
            filtered.append(ref)
        elif ref_year <= current_year:
            filtered.append(ref)
    return filtered


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/api/project/image-ref/upload")
def upload_image(req: ImageUploadRequest):
    """Copy an image file into the project's assets directory."""
    if not os.path.isfile(req.source_path):
        raise HTTPException(status_code=400, detail="Source file does not exist")

    assets_dir = os.path.join(req.project_path, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    ext = os.path.splitext(req.source_path)[1].lower()
    filename = f"img_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = os.path.join(assets_dir, filename)

    shutil.copy2(req.source_path, dest_path)

    return {"image_path": f"assets/{filename}"}


@router.post("/api/project/image-ref/save-icon")
def save_cropped_icon(req: IconCropSaveRequest):
    """Save a cropped icon from base64 data. Replaces any existing icon for the entity."""
    assets_dir = os.path.join(req.project_path, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    # Decode base64 image data (strip data:image/png;base64, prefix if present)
    img_data = req.image_data
    if "," in img_data:
        img_data = img_data.split(",", 1)[1]
    raw = base64.b64decode(img_data)

    filename = f"icon_{req.entity_type}_{req.entity_id}_{uuid.uuid4().hex[:8]}.png"
    dest_path = os.path.join(assets_dir, filename)
    with open(dest_path, "wb") as f:
        f.write(raw)

    relative_path = f"assets/{filename}"

    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Delete previous icon image reference and file for this entity
    cursor.execute(
        "SELECT id, image_path FROM image_references WHERE entity_type = ? AND entity_id = ? AND is_icon = 1",
        (req.entity_type, req.entity_id)
    )
    old_icon = cursor.fetchone()
    if old_icon:
        cursor.execute("DELETE FROM image_references WHERE id = ?", (old_icon["id"],))
        old_file = os.path.join(req.project_path, old_icon["image_path"])
        try:
            os.remove(old_file)
        except OSError:
            pass

    # Create new icon reference
    cursor.execute(
        """INSERT INTO image_references (entity_id, entity_type, image_path, is_icon, world_time, caption)
           VALUES (?, ?, ?, 1, NULL, 'Icon')""",
        (req.entity_id, req.entity_type, relative_path)
    )
    conn.commit()
    conn.close()

    return {"image_path": relative_path}


@router.post("/api/project/image-ref/create")
def create_image_ref(req: ImageRefCreate):
    """Create a new image reference for an entity."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # If setting as icon, clear any existing icon for this entity
    if req.is_icon:
        cursor.execute(
            "UPDATE image_references SET is_icon = 0 WHERE entity_type = ? AND entity_id = ? AND is_icon = 1",
            (req.entity_type, req.entity_id)
        )

    # Auto-icon: if this is the first image for the entity, make it the icon
    cursor.execute(
        "SELECT COUNT(*) FROM image_references WHERE entity_type = ? AND entity_id = ?",
        (req.entity_type, req.entity_id)
    )
    count = cursor.fetchone()[0]
    is_icon = req.is_icon if count > 0 else 1

    cursor.execute(
        """INSERT INTO image_references (entity_id, entity_type, image_path, is_icon, world_time, caption)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (req.entity_id, req.entity_type, req.image_path, is_icon, req.world_time, req.caption)
    )
    ref_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM image_references WHERE id = ?", (ref_id,))
    row = cursor.fetchone()
    conn.close()

    return {"image_ref": _row_to_dict(row)}


@router.post("/api/project/image-ref/update")
def update_image_ref(req: ImageRefUpdate):
    """Update an image reference (caption, world_time, is_icon, sort_order)."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # If setting as icon, first clear other icons for the same entity
    if req.is_icon == 1:
        cursor.execute("SELECT entity_type, entity_id FROM image_references WHERE id = ?", (req.image_ref_id,))
        row = cursor.fetchone()
        if row:
            cursor.execute(
                "UPDATE image_references SET is_icon = 0 WHERE entity_type = ? AND entity_id = ? AND is_icon = 1",
                (row["entity_type"], row["entity_id"])
            )

    fields = []
    values = []
    for field_name in ["is_icon", "world_time", "caption", "sort_order"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)

    if not fields:
        conn.close()
        return {"ok": True}

    values.append(req.image_ref_id)
    cursor.execute(f"UPDATE image_references SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()

    cursor.execute("SELECT * FROM image_references WHERE id = ?", (req.image_ref_id,))
    row = cursor.fetchone()
    conn.close()

    return {"image_ref": _row_to_dict(row) if row else None}


@router.post("/api/project/image-ref/delete")
def delete_image_ref(req: ImageRefDelete):
    """Delete an image reference, optionally removing the file from disk."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM image_references WHERE id = ?", (req.image_ref_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Image reference not found")

    image_path = row["image_path"]
    was_icon = row["is_icon"]
    entity_type = row["entity_type"]
    entity_id = row["entity_id"]

    cursor.execute("DELETE FROM image_references WHERE id = ?", (req.image_ref_id,))

    # If we deleted the icon, promote the next image as icon
    if was_icon:
        cursor.execute(
            "SELECT id FROM image_references WHERE entity_type = ? AND entity_id = ? ORDER BY sort_order, id LIMIT 1",
            (entity_type, entity_id)
        )
        next_row = cursor.fetchone()
        if next_row:
            cursor.execute("UPDATE image_references SET is_icon = 1 WHERE id = ?", (next_row["id"],))

    conn.commit()
    conn.close()

    if req.delete_file:
        full_path = os.path.join(req.project_path, image_path)
        try:
            os.remove(full_path)
        except OSError:
            pass

    return {"ok": True}


@router.post("/api/project/image-refs/for-entity")
def get_image_refs_for_entity(req: ImageRefsForEntity):
    """Get all image references for an entity, with optional world-time filtering."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM image_references WHERE entity_type = ? AND entity_id = ? ORDER BY sort_order, id",
        (req.entity_type, req.entity_id)
    )
    rows = cursor.fetchall()
    conn.close()

    refs = [_row_to_dict(r) for r in rows]

    if req.filter_mode == "world_time":
        refs = _filter_by_world_time(refs, req.current_world_time)

    return {"image_refs": refs}


@router.post("/api/project/image-refs/bulk-icons")
def get_bulk_icons(req: BulkIconsRequest):
    """Get all entity icons in one query for the entity manager."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("SELECT entity_type, entity_id, image_path FROM image_references WHERE is_icon = 1")
    rows = cursor.fetchall()
    conn.close()

    icons = {}
    for row in rows:
        key = f"{row['entity_type']}:{row['entity_id']}"
        icons[key] = row["image_path"]

    return {"icons": icons}

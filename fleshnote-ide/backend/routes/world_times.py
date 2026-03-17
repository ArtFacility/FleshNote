"""
FleshNote API — World Times Routes
CRUD for world_times: paragraph-level time overrides per chapter (flashbacks, timeskips, memories).
"""

import os
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class WorldTimeList(BaseModel):
    project_path: str
    chapter_id: int


class WorldTimeCreate(BaseModel):
    project_path: str
    chapter_id: int
    world_date: str
    label: Optional[str] = None
    color_index: Optional[int] = None


class WorldTimeUpdate(BaseModel):
    project_path: str
    marker_id: int
    world_date: Optional[str] = None
    label: Optional[str] = None
    color_index: Optional[int] = None


class WorldTimeDelete(BaseModel):
    project_path: str
    marker_id: int


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


@router.post("/api/project/world-times/list")
async def list_world_times(req: WorldTimeList):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM world_times WHERE chapter_id = ? ORDER BY id",
        (req.chapter_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return {"markers": [dict(row) for row in rows]}


@router.post("/api/project/world-times/create")
async def create_world_time(req: WorldTimeCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Auto-assign color_index if not provided
    if req.color_index is None:
        cursor.execute("SELECT COUNT(*) FROM world_times WHERE chapter_id = ?", (req.chapter_id,))
        count = cursor.fetchone()[0]
        color_index = count % 8
    else:
        color_index = req.color_index

    cursor.execute("""
        INSERT INTO world_times (chapter_id, world_date, label, color_index)
        VALUES (?, ?, ?, ?)
    """, (
        req.chapter_id, req.world_date, req.label, color_index,
    ))
    conn.commit()

    marker_id = cursor.lastrowid
    cursor.execute("SELECT * FROM world_times WHERE id = ?", (marker_id,))
    marker = dict(cursor.fetchone())
    conn.close()

    return {"marker": marker}


@router.post("/api/project/world-times/update")
async def update_world_time(req: WorldTimeUpdate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    params = []
    for field_name in ["world_date", "label", "color_index"]:
        value = getattr(req, field_name)
        if value is not None:
            fields.append(f"{field_name} = ?")
            params.append(value)

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(req.marker_id)
    cursor.execute(
        f"UPDATE world_times SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    conn.commit()

    cursor.execute("SELECT * FROM world_times WHERE id = ?", (req.marker_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Marker not found")

    return {"marker": dict(row)}


@router.post("/api/project/world-times/delete")
async def delete_world_time(req: WorldTimeDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM world_times WHERE id = ?", (req.marker_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

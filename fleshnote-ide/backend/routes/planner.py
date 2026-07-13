from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import sqlite3
import os

router = APIRouter()

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

class ProjectRequest(BaseModel):
    project_path: str

class PlannerSettingsRequest(BaseModel):
    project_path: str
    theme: Optional[str] = None
    cursor_pct: Optional[float] = None
    writing_started: Optional[int] = None
    shadow_visible: Optional[int] = None

class PlannerBlockRequest(BaseModel):
    project_path: str
    id: str
    layer: str
    block_type: str
    label: Optional[str] = ""
    pct: float
    lane: int
    chapter_id: Optional[str] = None
    chapter_status: Optional[str] = None
    added_during_writing: int = 0
    sort_order: int = 0

class PlannerArcRequest(BaseModel):
    project_path: str
    id: str
    layer: str
    name: Optional[str] = ""
    description: Optional[str] = ""
    color: str
    start_pct: float
    end_pct: float
    sort_order: int = 0

class PlannerDeleteRequest(BaseModel):
    project_path: str
    id: str

@router.post("/api/project/planner/load")
def load_planner(request: ProjectRequest):
    conn = _get_db(request.project_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM planner_settings WHERE id = 1")
    settings_row = cursor.fetchone()
    settings = dict(settings_row) if settings_row else {}

    cursor.execute("SELECT * FROM planner_blocks WHERE deleted = 0")
    blocks = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM planner_arcs WHERE deleted = 0")
    arcs = [dict(r) for r in cursor.fetchall()]
    
    conn.close()
    
    return {"status": "ok", "settings": settings, "blocks": blocks, "arcs": arcs}

@router.post("/api/project/planner/settings")
def update_settings(request: PlannerSettingsRequest):
    conn = _get_db(request.project_path)
    cursor = conn.cursor()
    
    fields = []
    params = []
    if request.theme is not None:
        fields.append("theme = ?")
        params.append(request.theme)
        from sync_core import log_change
        log_change(cursor, "planner_settings", "1", {"theme": request.theme})
    if request.cursor_pct is not None:
        fields.append("cursor_pct = ?")
        params.append(request.cursor_pct)
    if request.writing_started is not None:
        fields.append("writing_started = ?")
        params.append(request.writing_started)
    if request.shadow_visible is not None:
        fields.append("shadow_visible = ?")
        params.append(request.shadow_visible)
        
    if fields:
        fields.append("updated_at = datetime('now')")
        query = f"UPDATE planner_settings SET {', '.join(fields)} WHERE id = 1"
        cursor.execute(query, params)
        conn.commit()
    conn.close()
    return {"status": "ok"}

@router.post("/api/project/planner/save-block")
def save_block(request: PlannerBlockRequest):
    conn = _get_db(request.project_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO planner_blocks (id, layer, block_type, label, pct, lane, chapter_id, chapter_status, added_during_writing, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            layer = excluded.layer,
            block_type = excluded.block_type,
            label = excluded.label,
            pct = excluded.pct,
            lane = excluded.lane,
            chapter_id = excluded.chapter_id,
            chapter_status = excluded.chapter_status,
            added_during_writing = excluded.added_during_writing,
            sort_order = excluded.sort_order,
            deleted = 0,
            deleted_at = NULL,
            updated_at = datetime('now')
    """, (
        request.id, request.layer, request.block_type, request.label,
        request.pct, request.lane, request.chapter_id, request.chapter_status,
        request.added_during_writing, request.sort_order
    ))

    from sync_core import log_change
    log_change(cursor, "planner_blocks", request.id, {
        "layer": request.layer,
        "block_type": request.block_type,
        "label": request.label,
        "pct": request.pct,
        "lane": request.lane,
        "chapter_id": request.chapter_id,
        "chapter_status": request.chapter_status,
        "added_during_writing": request.added_during_writing,
        "sort_order": request.sort_order,
        "deleted": 0
    })

    conn.commit()
    conn.close()
    return {"status": "ok"}

@router.post("/api/project/planner/save-arc")
def save_arc(request: PlannerArcRequest):
    conn = _get_db(request.project_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO planner_arcs (id, layer, name, description, color, start_pct, end_pct, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            layer = excluded.layer,
            name = excluded.name,
            description = excluded.description,
            color = excluded.color,
            start_pct = excluded.start_pct,
            end_pct = excluded.end_pct,
            sort_order = excluded.sort_order,
            deleted = 0,
            deleted_at = NULL,
            updated_at = datetime('now')
    """, (
        request.id, request.layer, request.name, request.description,
        request.color, request.start_pct, request.end_pct, request.sort_order
    ))

    from sync_core import log_change
    log_change(cursor, "planner_arcs", request.id, {
        "layer": request.layer,
        "name": request.name,
        "description": request.description,
        "color": request.color,
        "start_pct": request.start_pct,
        "end_pct": request.end_pct,
        "sort_order": request.sort_order,
        "deleted": 0
    })

    conn.commit()
    conn.close()
    return {"status": "ok"}

@router.post("/api/project/planner/delete-block")
def delete_block(request: PlannerDeleteRequest):
    conn = _get_db(request.project_path)
    cursor = conn.cursor()

    import datetime
    from sync_core import log_soft_delete
    now = datetime.datetime.utcnow().isoformat() + "Z"

    cursor.execute("UPDATE planner_blocks SET deleted = 1, deleted_at = ? WHERE id = ?", (now, request.id))
    log_soft_delete(cursor, "planner_blocks", request.id)

    conn.commit()
    conn.close()
    return {"status": "ok"}

@router.post("/api/project/planner/delete-arc")
def delete_arc(request: PlannerDeleteRequest):
    conn = _get_db(request.project_path)
    cursor = conn.cursor()

    import datetime
    from sync_core import log_soft_delete
    now = datetime.datetime.utcnow().isoformat() + "Z"

    cursor.execute("UPDATE planner_arcs SET deleted = 1, deleted_at = ? WHERE id = ?", (now, request.id))
    log_soft_delete(cursor, "planner_arcs", request.id)

    conn.commit()
    conn.close()
    return {"status": "ok"}

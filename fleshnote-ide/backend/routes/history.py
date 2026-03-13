"""
FleshNote API — History Timeline Routes
CRUD for history_entries: timeline events tied to entities (characters, locations, lore).
"""

import os
import sqlite3
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


class HistoryEntryList(BaseModel):
    project_path: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    event_type: Optional[str] = None
    date_year_min: Optional[int] = None
    date_year_max: Optional[int] = None


class HistoryEntryCreate(BaseModel):
    project_path: str
    entity_type: str
    entity_id: int
    title: str
    description: str = ""
    event_type: str
    date_year: int
    date_month: Optional[int] = None
    date_day: Optional[int] = None
    date_precise: int = 0
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None


class HistoryEntryUpdate(BaseModel):
    project_path: str
    entry_id: int
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    date_year: Optional[int] = None
    date_month: Optional[int] = None
    date_day: Optional[int] = None
    date_precise: Optional[int] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None


class HistoryEntryDelete(BaseModel):
    project_path: str
    entry_id: int


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


@router.post("/api/project/history/list")
async def list_history_entries(req: HistoryEntryList):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    query = "SELECT * FROM history_entries WHERE 1=1"
    params = []

    if req.entity_type is not None:
        query += " AND entity_type = ?"
        params.append(req.entity_type)
    if req.entity_id is not None:
        query += " AND entity_id = ?"
        params.append(req.entity_id)
    if req.event_type is not None:
        query += " AND event_type = ?"
        params.append(req.event_type)
    if req.date_year_min is not None:
        query += " AND date_year >= ?"
        params.append(req.date_year_min)
    if req.date_year_max is not None:
        query += " AND date_year <= ?"
        params.append(req.date_year_max)

    query += " ORDER BY date_year, date_month, date_day"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return {"entries": [dict(row) for row in rows]}


@router.post("/api/project/history/create")
async def create_history_entry(req: HistoryEntryCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO history_entries
            (entity_type, entity_id, title, description, event_type,
             date_year, date_month, date_day, date_precise,
             related_entity_type, related_entity_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.entity_type, req.entity_id, req.title, req.description, req.event_type,
        req.date_year, req.date_month, req.date_day, req.date_precise,
        req.related_entity_type, req.related_entity_id,
    ))
    conn.commit()

    entry_id = cursor.lastrowid
    cursor.execute("SELECT * FROM history_entries WHERE id = ?", (entry_id,))
    entry = dict(cursor.fetchone())
    conn.close()

    return {"entry": entry}


@router.post("/api/project/history/update")
async def update_history_entry(req: HistoryEntryUpdate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    params = []
    for field_name in [
        "title", "description", "event_type",
        "date_year", "date_month", "date_day", "date_precise",
        "related_entity_type", "related_entity_id",
    ]:
        value = getattr(req, field_name)
        if value is not None:
            fields.append(f"{field_name} = ?")
            params.append(value)

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    fields.append("updated_at = ?")
    params.append(datetime.utcnow().isoformat())
    params.append(req.entry_id)

    cursor.execute(
        f"UPDATE history_entries SET {', '.join(fields)} WHERE id = ?",
        params,
    )
    conn.commit()

    cursor.execute("SELECT * FROM history_entries WHERE id = ?", (req.entry_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")

    return {"entry": dict(row)}


@router.post("/api/project/history/delete")
async def delete_history_entry(req: HistoryEntryDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM history_entries WHERE id = ?", (req.entry_id,))
    conn.commit()
    conn.close()

    return {"status": "ok"}

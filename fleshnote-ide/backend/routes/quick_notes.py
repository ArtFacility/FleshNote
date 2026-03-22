"""
FleshNote API — Quick Notes Routes
CRUD operations for quick notes attached to text.
"""

import os
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class ProjectPath(BaseModel):
    project_path: str

class QuickNoteCreate(BaseModel):
    project_path: str
    content: str
    note_type: str = 'Note'

class QuickNoteUpdate(BaseModel):
    project_path: str
    note_id: int
    note_type: str

class QuickNoteDelete(BaseModel):
    project_path: str
    note_id: int

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    # Ensure table exists (migration for existing DBs)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS quick_notes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            content         TEXT NOT NULL,
            note_type       TEXT NOT NULL DEFAULT 'Note',
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Migration: add note_type column if it doesn't exist yet
    try:
        cursor.execute("ALTER TABLE quick_notes ADD COLUMN note_type TEXT NOT NULL DEFAULT 'Note'")
    except Exception:
        pass  # Column already exists
    conn.commit()
    
    return conn

@router.post("/api/project/quick-notes")
def get_quick_notes(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, content, note_type, created_at, updated_at FROM quick_notes")
    rows = cursor.fetchall()
    conn.close()

    notes = []
    for row in rows:
        notes.append({
            "id": row["id"],
            "type": "quicknote",
            "note_type": row["note_type"],
            "name": row["content"],
            "content": row["content"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        })

    return {"quick_notes": notes}

@router.post("/api/project/quick-note/create")
def create_quick_note(req: QuickNoteCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO quick_notes (content, note_type)
        VALUES (?, ?)
    """, (req.content, req.note_type))
    note_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT id, content, note_type FROM quick_notes WHERE id = ?", (note_id,))
    row = cursor.fetchone()
    conn.close()

    return {
        "quick_note": {
            "id": row["id"],
            "type": "quicknote",
            "note_type": row["note_type"],
            "name": row["content"],
            "content": row["content"]
        }
    }

@router.post("/api/project/quick-note/update")
def update_quick_note(req: QuickNoteUpdate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE quick_notes SET note_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (req.note_type, req.note_id)
    )
    conn.commit()
    conn.close()
    return {"status": "updated"}

@router.post("/api/project/quick-note/delete")
def delete_quick_note(req: QuickNoteDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM quick_notes WHERE id = ?", (req.note_id,))
    conn.commit()
    conn.close()

    return {"status": "deleted"}

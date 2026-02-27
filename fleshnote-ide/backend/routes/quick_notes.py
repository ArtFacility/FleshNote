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
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    
    return conn

@router.post("/api/project/quick-notes")
def get_quick_notes(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, content, created_at, updated_at FROM quick_notes")
    rows = cursor.fetchall()
    conn.close()

    notes = []
    for row in rows:
        notes.append({
            "id": row["id"],
            "type": "quicknote",
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
        INSERT INTO quick_notes (content)
        VALUES (?)
    """, (req.content,))
    note_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT id, content FROM quick_notes WHERE id = ?", (note_id,))
    row = cursor.fetchone()
    conn.close()

    return {
        "quick_note": {
            "id": row["id"],
            "type": "quicknote",
            "name": row["content"],
            "content": row["content"]
        }
    }

@router.post("/api/project/quick-note/delete")
def delete_quick_note(req: QuickNoteDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM quick_notes WHERE id = ?", (req.note_id,))
    conn.commit()
    conn.close()

    return {"status": "deleted"}

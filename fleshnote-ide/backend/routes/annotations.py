"""
FleshNote API — Annotations Routes
CRUD operations for inline prose annotations (export as footnotes).
"""

import os
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


class AnnotationCreate(BaseModel):
    project_path: str
    content: str


class AnnotationUpdate(BaseModel):
    project_path: str
    annotation_id: str | int
    content: str


class AnnotationDelete(BaseModel):
    project_path: str
    annotation_id: str | int


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS annotations (
            id              TEXT PRIMARY KEY DEFAULT (
                                lower(hex(randomblob(4))) || '-' || 
                                lower(hex(randomblob(2))) || '-4' || 
                                substr(lower(hex(randomblob(2))), 2) || '-' || 
                                substr('89ab', abs(random()) % 4 + 1, 1) || 
                                substr(lower(hex(randomblob(2))), 2) || '-' || 
                                lower(hex(randomblob(6)))
                            ),
            content         TEXT NOT NULL,
            deleted         INTEGER DEFAULT 0,
            deleted_at      TEXT,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Migration: add columns if they don't exist yet
    try:
        cursor.execute("ALTER TABLE annotations ADD COLUMN deleted INTEGER DEFAULT 0")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE annotations ADD COLUMN deleted_at TEXT")
    except Exception:
        pass
    conn.commit()
    return conn


@router.post("/api/project/annotations")
def get_annotations(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, content, created_at, updated_at FROM annotations WHERE deleted = 0 ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()

    annotations = []
    for row in rows:
        annotations.append({
            "id": row["id"],
            "type": "annotation",
            "name": row["content"][:60] + ("..." if len(row["content"]) > 60 else ""),
            "content": row["content"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        })

    return {"annotations": annotations}


@router.post("/api/project/annotation/create")
def create_annotation(req: AnnotationCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    import uuid
    annotation_id = str(uuid.uuid4())
    cursor.execute("INSERT INTO annotations (id, content) VALUES (?, ?)", (annotation_id, req.content))

    from sync_core import log_change
    log_change(cursor, "annotations", annotation_id, {
        "content": req.content
    })

    conn.commit()

    cursor.execute("SELECT id, content FROM annotations WHERE id = ?", (annotation_id,))
    row = cursor.fetchone()
    conn.close()

    return {
        "annotation": {
            "id": row["id"],
            "type": "annotation",
            "name": row["content"][:60] + ("..." if len(row["content"]) > 60 else ""),
            "content": row["content"]
        }
    }


@router.post("/api/project/annotation/update")
def update_annotation(req: AnnotationUpdate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE annotations SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (req.content, req.annotation_id)
    )

    from sync_core import log_change
    log_change(cursor, "annotations", req.annotation_id, {
        "content": req.content
    })

    conn.commit()

    cursor.execute("SELECT id, content FROM annotations WHERE id = ?", (req.annotation_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Annotation not found")

    return {
        "annotation": {
            "id": row["id"],
            "type": "annotation",
            "name": row["content"][:60] + ("..." if len(row["content"]) > 60 else ""),
            "content": row["content"]
        }
    }


@router.post("/api/project/annotation/delete")
def delete_annotation(req: AnnotationDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    import datetime
    from sync_core import log_soft_delete
    now = datetime.datetime.utcnow().isoformat() + "Z"

    cursor.execute("UPDATE annotations SET deleted = 1, deleted_at = ? WHERE id = ?", (now, req.annotation_id))
    log_soft_delete(cursor, "annotations", req.annotation_id)

    conn.commit()
    conn.close()
    return {"status": "deleted"}

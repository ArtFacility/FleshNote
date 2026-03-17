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
    annotation_id: int
    content: str


class AnnotationDelete(BaseModel):
    project_path: str
    annotation_id: int


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS annotations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            content         TEXT NOT NULL,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn


@router.post("/api/project/annotations")
def get_annotations(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, content, created_at, updated_at FROM annotations ORDER BY id ASC")
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

    cursor.execute("INSERT INTO annotations (content) VALUES (?)", (req.content,))
    annotation_id = cursor.lastrowid
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
    cursor.execute("DELETE FROM annotations WHERE id = ?", (req.annotation_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

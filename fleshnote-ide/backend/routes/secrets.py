"""
FleshNote API — Secrets Routes
CRUD operations for hidden information and foreshadowing tracking.
"""

import os
import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


class SecretCreate(BaseModel):
    project_path: str
    title: str
    description: str = ""
    secret_type: str = ""            # 'identity', 'motive', 'event', 'ability', 'relationship'
    reveal_chapter_id: int | None = None
    characters_who_know: list[int] = []
    danger_phrases: list[str] = []
    notes: str = ""


class SecretUpdate(BaseModel):
    project_path: str
    secret_id: int
    title: str | None = None
    description: str | None = None
    secret_type: str | None = None
    reveal_chapter_id: int | None = None
    characters_who_know: list[int] | None = None
    danger_phrases: list[str] | None = None
    status: str | None = None        # 'hidden', 'hinted', 'revealed'
    notes: str | None = None


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _row_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "secret_type": row["secret_type"],
        "reveal_chapter_id": row["reveal_chapter_id"],
        "characters_who_know": json.loads(row["characters_who_know"]) if row["characters_who_know"] else [],
        "danger_phrases": json.loads(row["danger_phrases"]) if row["danger_phrases"] else [],
        "status": row["status"],
        "notes": row["notes"],
    }


@router.post("/api/project/secrets")
def get_secrets(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM secrets ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return {"secrets": [_row_to_dict(row) for row in rows]}


@router.post("/api/project/secret/create")
def create_secret(req: SecretCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO secrets (title, description, secret_type, reveal_chapter_id,
                             characters_who_know, danger_phrases, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        req.title, req.description, req.secret_type,
        req.reveal_chapter_id,
        json.dumps(req.characters_who_know) if req.characters_who_know else None,
        json.dumps(req.danger_phrases) if req.danger_phrases else None,
        req.notes,
    ))

    secret_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM secrets WHERE id = ?", (secret_id,))
    row = cursor.fetchone()
    conn.close()

    return {"secret": _row_to_dict(row)}


@router.post("/api/project/secret/update")
def update_secret(req: SecretUpdate):
    """Update a secret's fields. Only non-None fields are updated."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []

    for field_name in ["title", "description", "secret_type",
                       "reveal_chapter_id", "status", "notes"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)

    if req.characters_who_know is not None:
        fields.append("characters_who_know = ?")
        values.append(json.dumps(req.characters_who_know))

    if req.danger_phrases is not None:
        fields.append("danger_phrases = ?")
        values.append(json.dumps(req.danger_phrases))

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(req.secret_id)

    cursor.execute(
        f"UPDATE secrets SET {', '.join(fields)} WHERE id = ?",
        values
    )
    conn.commit()

    cursor.execute("SELECT * FROM secrets WHERE id = ?", (req.secret_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Secret not found")

    return {"secret": _row_to_dict(row)}

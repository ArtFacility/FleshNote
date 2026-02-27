"""
FleshNote API — Knowledge State Routes
CRUD operations for epistemic filtering (who knows what, when).
"""

import os
import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class ProjectPath(BaseModel):
    project_path: str


class KnowledgeStateCreate(BaseModel):
    project_path: str
    character_id: int
    fact: str
    source_entity_type: str | None = None   # 'character', 'lore', 'location', 'group'
    source_entity_id: int | None = None
    learned_in_chapter: int | None = None    # NULL = knows from the start
    is_secret: int = 0
    reveal_in_chapter: int | None = None
    notes: str = ""


class KnowledgeStateUpdate(BaseModel):
    project_path: str
    knowledge_state_id: int
    fact: str | None = None
    source_entity_type: str | None = None
    source_entity_id: int | None = None
    learned_in_chapter: int | None = None
    is_secret: int | None = None
    reveal_in_chapter: int | None = None
    notes: str | None = None


class KnowledgeStateDelete(BaseModel):
    project_path: str
    knowledge_state_id: int


class KnowledgeForEntity(BaseModel):
    project_path: str
    source_entity_type: str
    source_entity_id: int
    pov_character_id: int | None = None
    current_chapter: int | None = None       # chapter_number (not id)


class KnowledgeForCharacter(BaseModel):
    project_path: str
    character_id: int
    current_chapter: int | None = None       # chapter_number (not id)


# ── Helpers ───────────────────────────────────────────────────────────────────

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
        "character_id": row["character_id"],
        "fact": row["fact"],
        "source_entity_type": row["source_entity_type"],
        "source_entity_id": row["source_entity_id"],
        "learned_in_chapter": row["learned_in_chapter"],
        "is_secret": bool(row["is_secret"]),
        "reveal_in_chapter": row["reveal_in_chapter"],
        "notes": row["notes"],
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/api/project/knowledge/create")
def create_knowledge_state(req: KnowledgeStateCreate):
    """Create a new knowledge state entry."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO knowledge_states
            (character_id, fact, source_entity_type, source_entity_id,
             learned_in_chapter, is_secret, reveal_in_chapter, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.character_id, req.fact,
        req.source_entity_type, req.source_entity_id,
        req.learned_in_chapter, req.is_secret,
        req.reveal_in_chapter, req.notes,
    ))

    ks_id = cursor.lastrowid
    conn.commit()

    # Return created row
    cursor.execute("SELECT * FROM knowledge_states WHERE id = ?", (ks_id,))
    row = cursor.fetchone()
    conn.close()

    return {"knowledge_state": _row_to_dict(row)}


@router.post("/api/project/knowledge/update")
def update_knowledge_state(req: KnowledgeStateUpdate):
    """Update a knowledge state entry. Only non-None fields are updated."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []

    for field_name in ["fact", "source_entity_type", "source_entity_id",
                       "learned_in_chapter", "is_secret", "reveal_in_chapter", "notes"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(req.knowledge_state_id)

    cursor.execute(
        f"UPDATE knowledge_states SET {', '.join(fields)} WHERE id = ?",
        values
    )
    conn.commit()

    cursor.execute("SELECT * FROM knowledge_states WHERE id = ?", (req.knowledge_state_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Knowledge state not found")

    return {"knowledge_state": _row_to_dict(row)}


@router.post("/api/project/knowledge/delete")
def delete_knowledge_state(req: KnowledgeStateDelete):
    """Delete a knowledge state entry."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM knowledge_states WHERE id = ?", (req.knowledge_state_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="Knowledge state not found")

    return {"status": "ok", "deleted_id": req.knowledge_state_id}


@router.post("/api/project/knowledge/for-entity")
def get_knowledge_for_entity(req: KnowledgeForEntity):
    """
    Get all knowledge facts about a specific entity.
    If pov_character_id and current_chapter are provided, filters to only
    what that POV character knows up to that chapter (epistemic filtering).
    Otherwise returns all facts (author view).
    """
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    if req.pov_character_id is not None and req.current_chapter is not None:
        # POV Filter mode: only facts the POV character knows
        cursor.execute("""
            SELECT ks.*, c.name as character_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            WHERE ks.source_entity_type = ?
              AND ks.source_entity_id = ?
              AND ks.character_id = ?
              AND ks.is_secret = 0
              AND (ks.learned_in_chapter <= ? OR ks.learned_in_chapter IS NULL)
            ORDER BY ks.learned_in_chapter ASC
        """, (req.source_entity_type, req.source_entity_id,
              req.pov_character_id, req.current_chapter))
    else:
        # Author View: all facts about this entity from all characters
        cursor.execute("""
            SELECT ks.*, c.name as character_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            WHERE ks.source_entity_type = ?
              AND ks.source_entity_id = ?
            ORDER BY c.name ASC, ks.learned_in_chapter ASC
        """, (req.source_entity_type, req.source_entity_id))

    rows = cursor.fetchall()
    conn.close()

    facts = []
    for row in rows:
        entry = _row_to_dict(row)
        entry["character_name"] = row["character_name"]
        facts.append(entry)

    return {"facts": facts}


@router.post("/api/project/knowledge/for-character")
def get_knowledge_for_character(req: KnowledgeForCharacter):
    """
    Get all facts a character knows. If current_chapter is provided,
    filters to facts learned up to that chapter. Otherwise returns all.
    """
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    if req.current_chapter is not None:
        cursor.execute("""
            SELECT ks.*, c.name as character_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            WHERE ks.character_id = ?
              AND ks.is_secret = 0
              AND (ks.learned_in_chapter <= ? OR ks.learned_in_chapter IS NULL)
            ORDER BY ks.learned_in_chapter ASC
        """, (req.character_id, req.current_chapter))
    else:
        cursor.execute("""
            SELECT ks.*, c.name as character_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            WHERE ks.character_id = ?
            ORDER BY ks.learned_in_chapter ASC
        """, (req.character_id,))

    rows = cursor.fetchall()
    conn.close()

    facts = []
    for row in rows:
        entry = _row_to_dict(row)
        entry["character_name"] = row["character_name"]
        facts.append(entry)

    return {"facts": facts}

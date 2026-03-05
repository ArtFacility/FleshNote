"""
FleshNote API — Knowledge State Routes
CRUD operations for epistemic filtering (who knows what, when).

Supports 3 view modes:
  - author:    All knowledge, unfiltered
  - narrative: Filtered by chapter order (reading sequence)
  - world_time: Filtered by in-universe chronological time
"""

import os
import re
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
    world_time: str | None = None            # In-universe time when learned
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
    world_time: str | None = None
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
    filter_mode: str = "author"              # 'author', 'narrative', 'world_time'
    filter_character_id: int | None = None   # Character whose knowledge to show
    current_chapter: int | None = None       # chapter_number for narrative filtering
    current_world_time: str | None = None    # world_time string for world_time filtering
    # Legacy compat
    pov_character_id: int | None = None


class KnowledgeForCharacter(BaseModel):
    project_path: str
    character_id: int
    filter_mode: str = "author"              # 'author', 'narrative', 'world_time'
    current_chapter: int | None = None       # chapter_number for narrative filtering
    current_world_time: str | None = None    # world_time string for world_time filtering


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _row_to_dict(row):
    d = {
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
    # world_time may not exist on older DBs before migration runs
    try:
        d["world_time"] = row["world_time"]
    except (IndexError, KeyError):
        d["world_time"] = None
    return d


def _extract_year(text: str | None) -> int | None:
    """
    Extract the most likely year number from a world_time string.
    Mirrors the logic in calendar.py for consistency.
    Returns None if no year can be parsed.
    """
    if not text:
        return None
    patterns = [
        r'[Yy]ear\s+(\d+)',           # "Year 314"
        r'(\d+)\s*[Ee]',              # "4E" (epoch number)
        r'[Ee]\s*-?\s*(\d+)',         # "E-314"
        r'\b(\d{2,})\b',             # Any 2+ digit number (last resort)
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return int(match.group(1))
    return None


def _filter_by_world_time(facts: list[dict], current_world_time: str | None) -> list[dict]:
    """
    Filter knowledge facts by world_time comparison.
    Uses year extraction for comparison. Facts with unparseable
    or NULL world_time are included (fail-open).
    """
    if not current_world_time:
        return facts  # No reference time — show all

    current_year = _extract_year(current_world_time)
    if current_year is None:
        return facts  # Can't parse reference time — show all

    filtered = []
    for fact in facts:
        fact_year = _extract_year(fact.get("world_time"))
        if fact_year is None:
            # Can't parse or no world_time — include (fail-open)
            filtered.append(fact)
        elif fact_year <= current_year:
            filtered.append(fact)
    return filtered


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/api/project/knowledge/create")
def create_knowledge_state(req: KnowledgeStateCreate):
    """Create a new knowledge state entry."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO knowledge_states
            (character_id, fact, source_entity_type, source_entity_id,
             learned_in_chapter, world_time, is_secret, reveal_in_chapter, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.character_id, req.fact,
        req.source_entity_type, req.source_entity_id,
        req.learned_in_chapter, req.world_time, req.is_secret,
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
                       "learned_in_chapter", "world_time", "is_secret",
                       "reveal_in_chapter", "notes"]:
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
    Get knowledge facts about a specific entity.

    Filter modes:
      - author:     All facts from all characters (unfiltered)
      - narrative:  Facts filter_character_id knows, learned in chapters
                    up to current_chapter (reading order)
      - world_time: Facts filter_character_id knows, learned at or before
                    the current world_time (in-universe chronology)
    """
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Resolve character ID (support legacy pov_character_id field)
    char_id = req.filter_character_id or req.pov_character_id

    if req.filter_mode == "narrative" and char_id is not None and req.current_chapter is not None:
        # Narrative filter: facts this character knows up to this chapter in reading order
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
              char_id, req.current_chapter))

    elif req.filter_mode == "world_time" and char_id is not None:
        # World time filter: fetch all non-secret facts for this character,
        # then filter in Python using year extraction
        cursor.execute("""
            SELECT ks.*, c.name as character_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            WHERE ks.source_entity_type = ?
              AND ks.source_entity_id = ?
              AND ks.character_id = ?
              AND ks.is_secret = 0
            ORDER BY ks.learned_in_chapter ASC
        """, (req.source_entity_type, req.source_entity_id, char_id))

    elif req.filter_mode in ("narrative", "world_time") and char_id is None:
        # Filtered mode but no character selected — show all non-secret facts
        cursor.execute("""
            SELECT ks.*, c.name as character_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            WHERE ks.source_entity_type = ?
              AND ks.source_entity_id = ?
              AND ks.is_secret = 0
            ORDER BY c.name ASC, ks.learned_in_chapter ASC
        """, (req.source_entity_type, req.source_entity_id))

    else:
        # Author view: all facts about this entity from all characters
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

    # Apply world_time filtering in Python (year extraction comparison)
    if req.filter_mode == "world_time":
        facts = _filter_by_world_time(facts, req.current_world_time)

    return {"facts": facts}


@router.post("/api/project/knowledge/for-character")
def get_knowledge_for_character(req: KnowledgeForCharacter):
    """
    Get all facts a character knows.

    Filter modes:
      - author:     All facts (including secrets)
      - narrative:  Non-secret facts learned up to current_chapter
      - world_time: Non-secret facts learned at or before current_world_time
    """
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    if req.filter_mode == "narrative" and req.current_chapter is not None:
        # Narrative: filter by chapter order
        cursor.execute("""
            SELECT ks.*, 
                   c.name as character_name,
                   CASE ks.source_entity_type
                     WHEN 'character' THEN c_src.name
                     WHEN 'lore' THEN le.name
                     WHEN 'location' THEN loc.name
                     WHEN 'group' THEN g.name
                   END as source_entity_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            LEFT JOIN characters c_src ON ks.source_entity_type = 'character' AND ks.source_entity_id = c_src.id
            LEFT JOIN lore_entities le ON ks.source_entity_type = 'lore' AND ks.source_entity_id = le.id
            LEFT JOIN locations loc ON ks.source_entity_type = 'location' AND ks.source_entity_id = loc.id
            LEFT JOIN groups g ON ks.source_entity_type = 'group' AND ks.source_entity_id = g.id
            WHERE ks.character_id = ?
              AND ks.is_secret = 0
              AND (ks.learned_in_chapter <= ? OR ks.learned_in_chapter IS NULL)
            ORDER BY ks.learned_in_chapter ASC
        """, (req.character_id, req.current_chapter))

    elif req.filter_mode == "world_time":
        # World time: fetch all non-secret, filter in Python
        cursor.execute("""
            SELECT ks.*, 
                   c.name as character_name,
                   CASE ks.source_entity_type
                     WHEN 'character' THEN c_src.name
                     WHEN 'lore' THEN le.name
                     WHEN 'location' THEN loc.name
                     WHEN 'group' THEN g.name
                   END as source_entity_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            LEFT JOIN characters c_src ON ks.source_entity_type = 'character' AND ks.source_entity_id = c_src.id
            LEFT JOIN lore_entities le ON ks.source_entity_type = 'lore' AND ks.source_entity_id = le.id
            LEFT JOIN locations loc ON ks.source_entity_type = 'location' AND ks.source_entity_id = loc.id
            LEFT JOIN groups g ON ks.source_entity_type = 'group' AND ks.source_entity_id = g.id
            WHERE ks.character_id = ?
              AND ks.is_secret = 0
            ORDER BY ks.learned_in_chapter ASC
        """, (req.character_id,))

    else:
        # Author: return all facts
        cursor.execute("""
            SELECT ks.*, 
                   c.name as character_name,
                   CASE ks.source_entity_type
                     WHEN 'character' THEN c_src.name
                     WHEN 'lore' THEN le.name
                     WHEN 'location' THEN loc.name
                     WHEN 'group' THEN g.name
                   END as source_entity_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            LEFT JOIN characters c_src ON ks.source_entity_type = 'character' AND ks.source_entity_id = c_src.id
            LEFT JOIN lore_entities le ON ks.source_entity_type = 'lore' AND ks.source_entity_id = le.id
            LEFT JOIN locations loc ON ks.source_entity_type = 'location' AND ks.source_entity_id = loc.id
            LEFT JOIN groups g ON ks.source_entity_type = 'group' AND ks.source_entity_id = g.id
            WHERE ks.character_id = ?
            ORDER BY ks.learned_in_chapter ASC
        """, (req.character_id,))

    rows = cursor.fetchall()
    conn.close()

    facts = []
    for row in rows:
        entry = _row_to_dict(row)
        entry["character_name"] = row["character_name"]
        entry["source_entity_name"] = row["source_entity_name"]
        facts.append(entry)

    # Apply world_time filtering in Python
    if req.filter_mode == "world_time":
        facts = _filter_by_world_time(facts, req.current_world_time)

    return {"facts": facts}

"""
FleshNote API — Knowledge State Routes
CRUD operations for epistemic filtering (who knows what, when).

Supports 3 view modes:
  - author:    All knowledge, unfiltered
  - narrative: Filtered by chapter order (reading sequence)
  - world_time: Filtered by in-universe chronological time
"""

import os
import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from world_calendar import load_calendar_config, world_time_to_linear_day, effective_world_time

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class ProjectPath(BaseModel):
    project_path: str


class KnowledgeStateCreate(BaseModel):
    project_path: str
    character_id: str | int
    fact: str
    source_entity_type: str | None = None   # 'character', 'lore', 'location', 'group'
    source_entity_id: str | int | None = None
    learned_in_chapter: str | int | None = None    # NULL = knows from the start
    world_time: str | None = None            # In-universe time when learned
    is_secret: int = 0
    reveal_in_chapter: str | int | None = None
    notes: str = ""


class KnowledgeStateUpdate(BaseModel):
    project_path: str
    knowledge_state_id: str | int
    fact: str | None = None
    source_entity_type: str | None = None
    source_entity_id: str | int | None = None
    learned_in_chapter: str | int | None = None
    world_time: str | None = None
    is_secret: int | None = None
    reveal_in_chapter: str | int | None = None
    notes: str | None = None


class KnowledgeStateDelete(BaseModel):
    project_path: str
    knowledge_state_id: str | int


class KnowledgeForEntity(BaseModel):
    project_path: str
    source_entity_type: str
    source_entity_id: str | int
    filter_mode: str = "author"              # 'author', 'narrative', 'world_time'
    filter_character_id: str | int | None = None   # Character whose knowledge to show
    current_chapter: str | int | None = None       # chapter_number for narrative filtering
    current_world_time: str | None = None    # world_time string for world_time filtering
    # Legacy compat
    pov_character_id: str | int | None = None


class KnowledgeForCharacter(BaseModel):
    project_path: str
    character_id: str | int
    filter_mode: str = "author"              # 'author', 'narrative', 'world_time'
    current_chapter: str | int | None = None       # chapter_number for narrative filtering
    current_world_time: str | None = None    # world_time string for world_time filtering


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _safe_col(row, key):
    """sqlite3.Row raises IndexError for a column that wasn't in the SELECT —
    used for the extra chapter_world_time/chapter_md_filename columns that
    only some of this file's queries join in."""
    try:
        return row[key]
    except (IndexError, KeyError):
        return None


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
    # world_time and word_offset may not exist on older DBs before migration runs
    try:
        d["world_time"] = row["world_time"]
    except (IndexError, KeyError):
        d["world_time"] = None
    try:
        d["word_offset"] = row["word_offset"]
    except (IndexError, KeyError):
        d["word_offset"] = None
    return d


def _chapter_md_content(project_path: str, md_filename: str | None) -> str:
    if not md_filename:
        return ""
    path = os.path.join(project_path, "md", md_filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def _filter_by_world_time(cursor, project_path: str, facts: list[dict],
                           current_world_time: str | None) -> list[dict]:
    """
    Filter knowledge facts by world_time, compared to the day (not just the
    year) via the project's custom calendar. A fact's effective time is
    resolved 3-tier: its own world_time, else the time-override span active
    at its word_offset in the chapter it was learned in, else the chapter's
    own blanket world_time. Facts with no resolvable time, or when the
    reference time can't be parsed, fail open (are shown) — and facts learned
    "from the start" (no learned_in_chapter) are always shown regardless.
    """
    if not current_world_time:
        return facts  # No reference time — show all

    cal = load_calendar_config(cursor)
    current_linear = world_time_to_linear_day(current_world_time, cal)
    if current_linear is None:
        return facts  # Can't parse reference time — show all

    md_cache: dict[str, str] = {}
    world_times_cache: dict = {}

    def get_md(md_filename):
        if md_filename not in md_cache:
            md_cache[md_filename] = _chapter_md_content(project_path, md_filename)
        return md_cache[md_filename]

    def get_world_times(chapter_id):
        if chapter_id not in world_times_cache:
            cursor.execute(
                "SELECT id, world_date FROM world_times WHERE chapter_id = ? AND deleted = 0",
                (chapter_id,),
            )
            world_times_cache[chapter_id] = {r[0]: r[1] for r in cursor.fetchall()}
        return world_times_cache[chapter_id]

    filtered = []
    for fact in facts:
        chapter_id = fact.get("learned_in_chapter")
        if chapter_id is None:
            filtered.append(fact)  # known from the start — always shown
            continue

        eff_time = effective_world_time(
            fact.get("world_time"),
            fact.get("word_offset"),
            get_md(fact.get("_chapter_md_filename")),
            fact.get("_chapter_world_time"),
            get_world_times(chapter_id),
        )
        eff_linear = world_time_to_linear_day(eff_time, cal)
        if eff_linear is None or eff_linear <= current_linear:
            filtered.append(fact)
    return filtered


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/api/project/knowledge/create")
def create_knowledge_state(req: KnowledgeStateCreate):
    """Create a new knowledge state entry."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    import uuid
    ks_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO knowledge_states
            (id, character_id, fact, source_entity_type, source_entity_id,
             learned_in_chapter, world_time, is_secret, reveal_in_chapter, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        ks_id, req.character_id, req.fact,
        req.source_entity_type, req.source_entity_id,
        req.learned_in_chapter, req.world_time, req.is_secret,
        req.reveal_in_chapter, req.notes,
    ))

    from sync_core import log_change
    log_change(cursor, "knowledge_states", ks_id, {
        "character_id": req.character_id,
        "fact": req.fact,
        "source_entity_type": req.source_entity_type,
        "source_entity_id": req.source_entity_id,
        "learned_in_chapter": req.learned_in_chapter,
        "world_time": req.world_time,
        "is_secret": req.is_secret,
        "reveal_in_chapter": req.reveal_in_chapter,
        "notes": req.notes,
    })

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
    changes = {}

    for field_name in ["fact", "source_entity_type", "source_entity_id",
                       "learned_in_chapter", "world_time", "is_secret",
                       "reveal_in_chapter", "notes"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)
            changes[field_name] = val

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(req.knowledge_state_id)

    cursor.execute(
        f"UPDATE knowledge_states SET {', '.join(fields)} WHERE id = ?",
        values
    )

    from sync_core import log_change
    log_change(cursor, "knowledge_states", req.knowledge_state_id, changes)

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

    import datetime
    from sync_core import log_soft_delete
    now = datetime.datetime.utcnow().isoformat() + "Z"

    cursor.execute("UPDATE knowledge_states SET deleted = 1, deleted_at = ? WHERE id = ?", (now, req.knowledge_state_id))
    deleted = cursor.rowcount
    if deleted > 0:
        log_soft_delete(cursor, "knowledge_states", req.knowledge_state_id)

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

    if req.filter_mode == "narrative" and char_id is not None:
        cursor.execute("""
            SELECT ks.*, c.name as character_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            LEFT JOIN chapters ch ON ks.learned_in_chapter = ch.id
            WHERE ks.source_entity_type = ?
              AND ks.source_entity_id = ?
              AND ks.character_id = ?
              AND ks.is_secret = 0
              AND ks.deleted = 0
              AND (ch.chapter_number <= ? OR ks.learned_in_chapter IS NULL)
            ORDER BY COALESCE(ch.chapter_number, 0) ASC
        """, (req.source_entity_type, req.source_entity_id,
              char_id, req.current_chapter))

    elif req.filter_mode == "world_time" and char_id is not None:
        # World time filter: fetch all non-secret facts for this character,
        # then filter in Python (calendar-aware, day-level comparison)
        cursor.execute("""
            SELECT ks.*, c.name as character_name,
                   ch.world_time as chapter_world_time, ch.md_filename as chapter_md_filename
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            LEFT JOIN chapters ch ON ks.learned_in_chapter = ch.id
            WHERE ks.source_entity_type = ?
              AND ks.source_entity_id = ?
              AND ks.character_id = ?
              AND ks.is_secret = 0
              AND ks.deleted = 0
            ORDER BY COALESCE(ch.chapter_number, 0) ASC
        """, (req.source_entity_type, req.source_entity_id, char_id))

    elif req.filter_mode in ("narrative", "world_time") and char_id is None:
        # Filtered mode but no character selected — show all non-secret facts
        cursor.execute("""
            SELECT ks.*, c.name as character_name,
                   ch.world_time as chapter_world_time, ch.md_filename as chapter_md_filename
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            LEFT JOIN chapters ch ON ks.learned_in_chapter = ch.id
            WHERE ks.source_entity_type = ?
              AND ks.source_entity_id = ?
              AND ks.is_secret = 0
              AND ks.deleted = 0
            ORDER BY COALESCE(ch.chapter_number, 0) ASC
        """, (req.source_entity_type, req.source_entity_id))

    else:
        # Author view: all facts about this entity from all characters
        cursor.execute("""
            SELECT ks.*, c.name as character_name
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            WHERE ks.source_entity_type = ?
              AND ks.source_entity_id = ?
              AND ks.deleted = 0
            ORDER BY c.name ASC, ks.learned_in_chapter ASC
        """, (req.source_entity_type, req.source_entity_id))

    rows = cursor.fetchall()

    facts = []
    for row in rows:
        entry = _row_to_dict(row)
        entry["character_name"] = row["character_name"]
        entry["_chapter_world_time"] = _safe_col(row, "chapter_world_time")
        entry["_chapter_md_filename"] = _safe_col(row, "chapter_md_filename")
        facts.append(entry)

    # Apply world_time filtering in Python (calendar-aware, day-level comparison)
    if req.filter_mode == "world_time":
        facts = _filter_by_world_time(cursor, req.project_path, facts, req.current_world_time)
    conn.close()

    for fact in facts:
        fact.pop("_chapter_world_time", None)
        fact.pop("_chapter_md_filename", None)

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
            LEFT JOIN chapters ch ON ks.learned_in_chapter = ch.id
            WHERE ks.character_id = ?
              AND ks.is_secret = 0
              AND ks.deleted = 0
              AND (ch.chapter_number <= ? OR ks.learned_in_chapter IS NULL)
            ORDER BY COALESCE(ch.chapter_number, 0) ASC
        """, (req.character_id, req.current_chapter))

    elif req.filter_mode == "world_time":
        # World time: fetch all non-secret, filter in Python (calendar-aware)
        cursor.execute("""
            SELECT ks.*,
                   c.name as character_name,
                   CASE ks.source_entity_type
                     WHEN 'character' THEN c_src.name
                     WHEN 'lore' THEN le.name
                     WHEN 'location' THEN loc.name
                     WHEN 'group' THEN g.name
                   END as source_entity_name,
                   ch.world_time as chapter_world_time, ch.md_filename as chapter_md_filename
            FROM knowledge_states ks
            JOIN characters c ON ks.character_id = c.id
            LEFT JOIN characters c_src ON ks.source_entity_type = 'character' AND ks.source_entity_id = c_src.id
            LEFT JOIN lore_entities le ON ks.source_entity_type = 'lore' AND ks.source_entity_id = le.id
            LEFT JOIN locations loc ON ks.source_entity_type = 'location' AND ks.source_entity_id = loc.id
            LEFT JOIN groups g ON ks.source_entity_type = 'group' AND ks.source_entity_id = g.id
            LEFT JOIN chapters ch ON ks.learned_in_chapter = ch.id
            WHERE ks.character_id = ?
              AND ks.is_secret = 0
              AND ks.deleted = 0
            ORDER BY COALESCE(ch.chapter_number, 0) ASC
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
            LEFT JOIN chapters ch ON ks.learned_in_chapter = ch.id
            WHERE ks.character_id = ?
              AND ks.deleted = 0
            ORDER BY COALESCE(ch.chapter_number, 0) ASC
        """, (req.character_id,))

    rows = cursor.fetchall()

    facts = []
    for row in rows:
        entry = _row_to_dict(row)
        entry["character_name"] = row["character_name"]
        entry["source_entity_name"] = row["source_entity_name"]
        entry["_chapter_world_time"] = _safe_col(row, "chapter_world_time")
        entry["_chapter_md_filename"] = _safe_col(row, "chapter_md_filename")
        facts.append(entry)

    # Apply world_time filtering in Python (calendar-aware, day-level comparison)
    if req.filter_mode == "world_time":
        facts = _filter_by_world_time(cursor, req.project_path, facts, req.current_world_time)
    conn.close()

    for fact in facts:
        fact.pop("_chapter_world_time", None)
        fact.pop("_chapter_md_filename", None)

    return {"facts": facts}

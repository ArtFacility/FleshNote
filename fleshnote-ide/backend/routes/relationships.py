import os
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .knowledge import _extract_year, _get_db

router = APIRouter()

# ── Models ────────────────────────────────────────────────────────────────────

class RelationshipCreate(BaseModel):
    project_path: str
    character_id: int
    target_character_id: int
    rel_type: str
    notes: str = ""
    chapter_id: int | None = None
    word_offset: int | None = None
    world_time: str | None = None
    is_one_sided: int = 1

class RelationshipUpdate(BaseModel):
    project_path: str
    relationship_id: int
    rel_type: str | None = None
    notes: str | None = None
    chapter_id: int | None = None
    word_offset: int | None = None
    world_time: str | None = None
    is_one_sided: int | None = None

class RelationshipDelete(BaseModel):
    project_path: str
    relationship_id: int

class RelationshipsForCharacter(BaseModel):
    project_path: str
    character_id: int
    filter_mode: str = "author"              # 'author', 'narrative', 'world_time'
    current_chapter: int | None = None       # chapter_number
    current_world_time: str | None = None    # world_time string

# ── Helpers ───────────────────────────────────────────────────────────────────

def _row_to_dict(row):
    return {
        "id": row["id"],
        "character_id": row["character_id"],
        "target_character_id": row["target_character_id"],
        "rel_type": row["rel_type"],
        "notes": row["notes"],
        "chapter_id": row["chapter_id"],
        "word_offset": row["word_offset"],
        "world_time": row["world_time"],
        "is_one_sided": bool(row["is_one_sided"]) if row["is_one_sided"] is not None else True,
        "created_at": row["created_at"],
    }

def _get_db_rel(project_path: str):
    conn = _get_db(project_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS character_relationships (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id        INTEGER NOT NULL,
            target_character_id INTEGER NOT NULL,
            rel_type            TEXT NOT NULL,
            notes               TEXT,
            chapter_id          INTEGER,
            word_offset         INTEGER,
            world_time          TEXT,
            is_one_sided        INTEGER DEFAULT 1,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
            FOREIGN KEY (target_character_id) REFERENCES characters(id) ON DELETE CASCADE,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
        )
    """)
    conn.commit()
    return conn

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/api/project/relationship/create")
def create_relationship(req: RelationshipCreate):
    conn = _get_db_rel(req.project_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO character_relationships
            (character_id, target_character_id, rel_type, notes, 
             chapter_id, word_offset, world_time, is_one_sided)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.character_id, req.target_character_id, req.rel_type, req.notes,
        req.chapter_id, req.word_offset, req.world_time, req.is_one_sided
    ))

    rel_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM character_relationships WHERE id = ?", (rel_id,))
    row = cursor.fetchone()
    conn.close()

    return {"relationship": _row_to_dict(row)}

@router.post("/api/project/relationship/update")
def update_relationship(req: RelationshipUpdate):
    conn = _get_db_rel(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []

    for field_name in ["rel_type", "notes", "chapter_id", "word_offset", "world_time", "is_one_sided"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(req.relationship_id)

    cursor.execute(
        f"UPDATE character_relationships SET {', '.join(fields)} WHERE id = ?",
        values
    )
    conn.commit()

    cursor.execute("SELECT * FROM character_relationships WHERE id = ?", (req.relationship_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Relationship not found")

    return {"relationship": _row_to_dict(row)}

@router.post("/api/project/relationship/delete")
def delete_relationship(req: RelationshipDelete):
    conn = _get_db_rel(req.project_path)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM character_relationships WHERE id = ?", (req.relationship_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="Relationship not found")

    return {"status": "ok", "deleted_id": req.relationship_id}

@router.post("/api/project/relationships/for-character")
def get_relationships_for_character(req: RelationshipsForCharacter):
    conn = _get_db_rel(req.project_path)
    cursor = conn.cursor()

    # Get relationships where this character is the source OR (target and it is not one-sided)
    # Plus gather the character names and chapter numbers
    query = """
        SELECT r.*,
               c1.name as character_name,
               c2.name as target_character_name,
               ch.chapter_number
        FROM character_relationships r
        JOIN characters c1 ON r.character_id = c1.id
        JOIN characters c2 ON r.target_character_id = c2.id
        LEFT JOIN chapters ch ON r.chapter_id = ch.id
        WHERE r.character_id = ? OR (r.target_character_id = ? AND r.is_one_sided = 0)
        ORDER BY ch.chapter_number ASC, r.word_offset ASC, r.id ASC
    """
    
    cursor.execute(query, (req.character_id, req.character_id))
    rows = cursor.fetchall()

    # Also fetch reverse relationships to show during hovering (how the other chars feel about this char)
    reverse_query = """
        SELECT r.*,
               c1.name as character_name,
               c2.name as target_character_name,
               ch.chapter_number
        FROM character_relationships r
        JOIN characters c1 ON r.character_id = c1.id
        JOIN characters c2 ON r.target_character_id = c2.id
        LEFT JOIN chapters ch ON r.chapter_id = ch.id
        WHERE r.target_character_id = ? AND r.is_one_sided = 1 AND r.character_id != ?
        ORDER BY ch.chapter_number ASC, r.word_offset ASC, r.id ASC
    """
    cursor.execute(reverse_query, (req.character_id, req.character_id))
    reverse_rows = cursor.fetchall()
    conn.close()
    
    # helper to format a row
    def format_row(row):
        d = _row_to_dict(row)
        d["character_name"] = row["character_name"]
        d["target_character_name"] = row["target_character_name"]
        d["chapter_number"] = row["chapter_number"]
        return d

    all_rels = [format_row(r) for r in rows]
    all_reverse_rels = [format_row(r) for r in reverse_rows]

    # Organize relationships by the other character involved
    # For a given target, we want to trace the history and find the "latest state" and "ghost state"
    from typing import Dict, Any
    target_map: Dict[int, Any] = {}
    
    for rel in all_rels:
        # Determine who the "other" character is
        other_id = rel["target_character_id"] if rel["character_id"] == req.character_id else rel["character_id"]
        other_name = rel["target_character_name"] if rel["character_id"] == req.character_id else rel["character_name"]
        
        if other_id not in target_map:
            target_map[other_id] = {
                "other_character_id": other_id,
                "other_character_name": other_name,
                "history": [],
                "reverse_history": []
            }
        target_map[other_id]["history"].append(rel)
        
    for rel in all_reverse_rels:
        other_id = rel["character_id"]
        other_name = rel["character_name"]
        if other_id not in target_map:
            target_map[other_id] = {
                "other_character_id": other_id,
                "other_character_name": other_name,
                "history": [],
                "reverse_history": []
            }
        target_map[other_id]["reverse_history"].append(rel)

    # Process each target to find latest states
    # Note: world time parsing logic
    current_year = _extract_year(req.current_world_time) if req.current_world_time else None
    current_chapter = req.current_chapter
    
    results = []
    
    for other_id, data in target_map.items():
        history = data["history"]
        rev_history = data["reverse_history"]
        
        # Filter histories up to the requested constraints
        valid_history = history
        narrative_history = history
        valid_rev_history = rev_history
        narrative_rev_history = rev_history
        
        # User requested Author view to follow world time logic for consistency if time is available
        effective_filter_mode = req.filter_mode
        if effective_filter_mode == 'author' and current_year is not None:
             effective_filter_mode = 'world_time'

        if effective_filter_mode == 'narrative' and current_chapter is not None:
            valid_history = [r for r in history if r["chapter_number"] is None or r["chapter_number"] <= current_chapter]
            valid_rev_history = [r for r in rev_history if r["chapter_number"] is None or r["chapter_number"] <= current_chapter]
            narrative_history = valid_history
            narrative_rev_history = valid_rev_history
        elif effective_filter_mode == 'world_time' and current_year is not None:
            # For world time filtering, we filter by year, but we still compute narrative_history to show the ghost state
            valid_history = []
            for r in history:
                r_year = _extract_year(r.get("world_time"))
                if r_year is None or r_year <= current_year:
                    valid_history.append(r)
            valid_rev_history = []
            for r in rev_history:
                r_year = _extract_year(r.get("world_time"))
                if r_year is None or r_year <= current_year:
                    valid_rev_history.append(r)
                    
            if current_chapter is not None:
                narrative_history = [r for r in history if r["chapter_number"] is None or r["chapter_number"] <= current_chapter]
                narrative_rev_history = [r for r in rev_history if r["chapter_number"] is None or r["chapter_number"] <= current_chapter]
            
        def _sort_key(r):
            # Sort by world time year first if available, then chapter/offset
            y = _extract_year(r.get("world_time"))
            y = y if y is not None else -999999 # Initial state
            ch = r.get("chapter_number")
            ch = ch if ch is not None else 999999
            wo = r.get("word_offset")
            # If word offset is missing, treat as mid-chapter (5000 words)
            wo = wo if wo is not None else 5000 
            return (y, ch, wo, r["id"])

        # IMPROVED: Merge mutual feelings from BOTH directions correctly
        # Mutual feelings where I am the TARGET are already in history (via Query 1)
        # Mutual feelings where I am the SOURCE are ALSO already in history
        # We need to make sure combined_valid_rev accurately represents their feelings for me.
        
        mutual_valid = [r for r in valid_history if not r["is_one_sided"]]
        combined_valid_rev = sorted(valid_rev_history + mutual_valid, key=_sort_key)
        
        mutual_narrative = [r for r in narrative_history if not r["is_one_sided"]]
        combined_narrative_rev = sorted(narrative_rev_history + mutual_narrative, key=_sort_key)

        # Get latest active states (last element in array, as they are sorted by chapter/offset)
        latest_active = valid_history[-1] if valid_history else None
        latest_narrative = narrative_history[-1] if narrative_history else None
        
        latest_reverse = combined_valid_rev[-1] if combined_valid_rev else None
        latest_narrative_reverse = combined_narrative_rev[-1] if combined_narrative_rev else None
        
        # If no active relationship in primary mode, skip
        if not latest_active and not latest_narrative:
            continue
            
        # Prepare result object for this character
        res = {
            "target_character_id": other_id,
            "target_character_name": data["other_character_name"],
            "current_state": latest_active,
            "ghost_state": None,
            "reverse_state": latest_reverse,
            "reverse_ghost_state": None,
            "all_history": history # returning full history in case UI needs it for "happened X words ago" comparisons or edit actions
        }
        
        # If ghost state differs from active state
        if latest_active and latest_narrative and latest_active["id"] != latest_narrative["id"]:
            res["ghost_state"] = latest_narrative
        elif not latest_active and latest_narrative:
            res["ghost_state"] = latest_narrative
            
        if latest_reverse and latest_narrative_reverse and latest_reverse["id"] != latest_narrative_reverse["id"]:
            res["reverse_ghost_state"] = latest_narrative_reverse
        elif not latest_reverse and latest_narrative_reverse:
            res["reverse_ghost_state"] = latest_narrative_reverse
            
        results.append(res)
        
    return {"relationships": results}

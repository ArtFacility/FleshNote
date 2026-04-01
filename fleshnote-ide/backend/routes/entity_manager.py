"""
FleshNote API — Entity Manager Routes
Bulk delete and merge operations for entities.
"""

import os
import re
import json
import glob
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


# ── Short type mapping (mirrors chapters.py) ────────────────────────────────

_ENTITY_TYPE_TO_SHORT = {
    "character": "char",
    "location": "loc",
    "lore": "item",
    "group": "group",
}

_TYPE_TO_TABLE = {
    "character": "characters",
    "location": "locations",
    "group": "groups",
    "lore": "lore_entities",
}


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


# ── Bulk Delete ──────────────────────────────────────────────────────────────

class BulkDeleteRequest(BaseModel):
    project_path: str
    entities: list[dict]  # [{ "type": "character", "id": 5 }, ...]


@router.post("/api/project/entities/bulk-delete")
async def bulk_delete_entities(req: BulkDeleteRequest):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    deleted = 0

    try:
        for ent in req.entities:
            ent_type = ent.get("type", "")
            ent_id = ent.get("id")
            table = _TYPE_TO_TABLE.get(ent_type)

            if not table or ent_id is None:
                continue

            # Delete the entity itself
            cursor.execute(f"DELETE FROM {table} WHERE id = ?", (ent_id,))
            if cursor.rowcount > 0:
                deleted += 1

            # Clean up entity_appearances
            cursor.execute(
                "DELETE FROM entity_appearances WHERE entity_type = ? AND entity_id = ?",
                (ent_type, ent_id)
            )

            # Clean up image references
            short_type = _ENTITY_TYPE_TO_SHORT.get(ent_type)
            if short_type:
                cursor.execute(
                    "DELETE FROM image_references WHERE entity_type = ? AND entity_id = ?",
                    (short_type, ent_id)
                )

            # Clean up knowledge_states
            if ent_type == "character":
                cursor.execute(
                    "DELETE FROM knowledge_states WHERE character_id = ?",
                    (ent_id,)
                )
            cursor.execute(
                "DELETE FROM knowledge_states WHERE source_entity_type = ? AND source_entity_id = ?",
                (ent_type, ent_id)
            )

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    return {"status": "ok", "deleted_count": deleted}


# ── Merge ────────────────────────────────────────────────────────────────────

class MergeRequest(BaseModel):
    project_path: str
    entity_type: str       # "character" | "location" | "group" | "lore"
    keep_id: int           # The entity to keep
    merge_ids: list[int]   # The entities to absorb and delete


def _append_field(existing: str, addition: str, source_name: str) -> str:
    """Append text from a merged entity to the kept entity's field."""
    if not addition or not addition.strip():
        return existing
    if not existing or not existing.strip():
        return addition.strip()
    return f"{existing.strip()}\n---\n[from {source_name}] {addition.strip()}"


def _fill_empty(kept_value: str, merged_entities: list, field: str) -> str:
    """If kept_value is empty, take the first non-empty value from merged entities."""
    if kept_value and kept_value.strip():
        return kept_value
    for m in merged_entities:
        val = (m.get(field, "") or "").strip()
        if val:
            return val
    return kept_value


def _merge_aliases(kept_aliases: list, merged_entities: list) -> list:
    """Collect unique aliases from all merged entities, including their names."""
    result = set(a.lower().strip() for a in kept_aliases)
    original = list(kept_aliases)

    for ent in merged_entities:
        # Add the name of the merged entity as an alias
        name = ent.get("name", "").strip()
        if name and name.lower() not in result:
            original.append(name)
            result.add(name.lower())

        # Add existing aliases
        aliases = ent.get("aliases") or []
        if isinstance(aliases, str):
            try:
                aliases = json.loads(aliases)
            except (json.JSONDecodeError, TypeError):
                aliases = []
        if not aliases:
            aliases = []
        for alias in aliases:
            a = alias.strip()
            if a and a.lower() not in result:
                original.append(a)
                result.add(a.lower())

    return original


def _rewrite_markdown_links(project_path: str, short_type: str, keep_id: int, merge_ids: list[int]):
    """Scan all chapter markdown files and rewrite entity links from merge_ids to keep_id."""
    md_dir = os.path.join(project_path, "md")
    if not os.path.isdir(md_dir):
        return

    for md_file in glob.glob(os.path.join(md_dir, "*.md")):
        try:
            with open(md_file, "r", encoding="utf-8") as f:
                content = f.read()

            original = content
            for mid in merge_ids:
                # Replace {{short_type:merge_id|text}} with {{short_type:keep_id|text}}
                pattern = r'\{\{' + re.escape(short_type) + r':' + str(mid) + r'\|'
                replacement = '{{' + short_type + ':' + str(keep_id) + '|'
                content = re.sub(pattern, replacement, content)

            if content != original:
                with open(md_file, "w", encoding="utf-8") as f:
                    f.write(content)
        except Exception:
            continue  # Skip files that can't be read/written


@router.post("/api/project/entities/merge")
async def merge_entities(req: MergeRequest):
    table = _TYPE_TO_TABLE.get(req.entity_type)
    if not table:
        raise HTTPException(status_code=400, detail=f"Unknown entity type: {req.entity_type}")

    short_type = _ENTITY_TYPE_TO_SHORT.get(req.entity_type)
    if not short_type:
        raise HTTPException(status_code=400, detail=f"No short type mapping for: {req.entity_type}")

    if not req.merge_ids:
        raise HTTPException(status_code=400, detail="No merge_ids provided")

    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    try:
        # Fetch the kept entity
        cursor.execute(f"SELECT * FROM {table} WHERE id = ?", (req.keep_id,))
        kept_row = cursor.fetchone()
        if not kept_row:
            raise HTTPException(status_code=404, detail=f"Keep entity {req.keep_id} not found")
        kept = dict(kept_row)

        # Fetch merged entities
        placeholders = ",".join("?" * len(req.merge_ids))
        cursor.execute(f"SELECT * FROM {table} WHERE id IN ({placeholders})", req.merge_ids)
        merged_rows = cursor.fetchall()
        merged = [dict(r) for r in merged_rows]

        if not merged:
            raise HTTPException(status_code=404, detail="No merge entities found")

        # Parse kept aliases
        kept_aliases = kept.get("aliases") or "[]"
        if isinstance(kept_aliases, str):
            try:
                kept_aliases = json.loads(kept_aliases)
            except (json.JSONDecodeError, TypeError):
                kept_aliases = []
        if not kept_aliases:
            kept_aliases = []

        # Parse merged aliases
        for m in merged:
            raw = m.get("aliases") or "[]"
            if isinstance(raw, str):
                try:
                    m["aliases"] = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    m["aliases"] = []

        # 1. Absorb aliases
        new_aliases = _merge_aliases(kept_aliases, merged)

        # 2. Absorb text fields + fill empty short fields from merged entities
        if req.entity_type == "character":
            bio = kept.get("bio", "") or ""
            notes = kept.get("notes", "") or ""
            for m in merged:
                bio = _append_field(bio, m.get("bio", ""), m.get("name", ""))
                notes = _append_field(notes, m.get("notes", ""), m.get("name", ""))
            # Fill empty short fields from first merged entity that has them
            role = _fill_empty(kept.get("role", "") or "", merged, "role")
            status = _fill_empty(kept.get("status", "") or "", merged, "status")
            species = _fill_empty(kept.get("species", "") or "", merged, "species")
            birth_date = _fill_empty(kept.get("birth_date", "") or "", merged, "birth_date")
            surface_goal = _fill_empty(kept.get("surface_goal", "") or "", merged, "surface_goal")
            true_goal = _fill_empty(kept.get("true_goal", "") or "", merged, "true_goal")
            cursor.execute(
                "UPDATE characters SET aliases = ?, bio = ?, notes = ?, role = ?, status = ?, species = ?, birth_date = ?, surface_goal = ?, true_goal = ? WHERE id = ?",
                (json.dumps(new_aliases), bio, notes, role, status, species, birth_date or None, surface_goal, true_goal, req.keep_id)
            )

        elif req.entity_type == "location":
            desc = kept.get("description", "") or ""
            notes = kept.get("notes", "") or ""
            for m in merged:
                desc = _append_field(desc, m.get("description", ""), m.get("name", ""))
                notes = _append_field(notes, m.get("notes", ""), m.get("name", ""))
            # Fill empty short fields
            region = _fill_empty(kept.get("region", "") or "", merged, "region")
            cursor.execute(
                "UPDATE locations SET aliases = ?, description = ?, notes = ?, region = ? WHERE id = ?",
                (json.dumps(new_aliases), desc, notes, region, req.keep_id)
            )

        elif req.entity_type == "group":
            desc = kept.get("description", "") or ""
            notes = kept.get("notes", "") or ""
            for m in merged:
                desc = _append_field(desc, m.get("description", ""), m.get("name", ""))
                notes = _append_field(notes, m.get("notes", ""), m.get("name", ""))
            # Fill empty short fields
            group_type = _fill_empty(kept.get("group_type", "") or "", merged, "group_type")
            surface_agenda = _fill_empty(kept.get("surface_agenda", "") or "", merged, "surface_agenda")
            true_agenda = _fill_empty(kept.get("true_agenda", "") or "", merged, "true_agenda")
            cursor.execute(
                "UPDATE groups SET aliases = ?, description = ?, notes = ?, group_type = ?, surface_agenda = ?, true_agenda = ? WHERE id = ?",
                (json.dumps(new_aliases), desc, notes, group_type, surface_agenda, true_agenda, req.keep_id)
            )

        elif req.entity_type == "lore":
            desc = kept.get("description", "") or ""
            notes = kept.get("notes", "") or ""
            rules = kept.get("rules", "") or ""
            limitations = kept.get("limitations", "") or ""
            origin = kept.get("origin", "") or ""
            for m in merged:
                desc = _append_field(desc, m.get("description", ""), m.get("name", ""))
                notes = _append_field(notes, m.get("notes", ""), m.get("name", ""))
                rules = _append_field(rules, m.get("rules", ""), m.get("name", ""))
                limitations = _append_field(limitations, m.get("limitations", ""), m.get("name", ""))
                origin = _append_field(origin, m.get("origin", ""), m.get("name", ""))
            # Fill empty short fields
            classification = _fill_empty(kept.get("classification", "") or "", merged, "classification")
            category = _fill_empty(kept.get("category", "") or "", merged, "category")
            cursor.execute(
                "UPDATE lore_entities SET aliases = ?, description = ?, notes = ?, rules = ?, limitations = ?, origin = ?, classification = ?, category = ? WHERE id = ?",
                (json.dumps(new_aliases), desc, notes, rules, limitations, origin, classification, category, req.keep_id)
            )

        # 3. Rewrite markdown links
        _rewrite_markdown_links(req.project_path, short_type, req.keep_id, req.merge_ids)

        # 4. Update entity_appearances — repoint to keep_id, delete on conflict
        for mid in req.merge_ids:
            # Delete appearances that would conflict (same chapter + keep_id already exists)
            cursor.execute("""
                DELETE FROM entity_appearances
                WHERE entity_type = ? AND entity_id = ?
                AND chapter_id IN (
                    SELECT chapter_id FROM entity_appearances
                    WHERE entity_type = ? AND entity_id = ?
                )
            """, (req.entity_type, mid, req.entity_type, req.keep_id))
            # Repoint remaining
            cursor.execute(
                "UPDATE entity_appearances SET entity_id = ? WHERE entity_type = ? AND entity_id = ?",
                (req.keep_id, req.entity_type, mid)
            )

        # 5. Update knowledge_states
        if req.entity_type == "character":
            for mid in req.merge_ids:
                # Repoint character_id references
                cursor.execute(
                    "UPDATE OR IGNORE knowledge_states SET character_id = ? WHERE character_id = ?",
                    (req.keep_id, mid)
                )
                # Delete any that couldn't be updated due to conflicts
                cursor.execute(
                    "DELETE FROM knowledge_states WHERE character_id = ?",
                    (mid,)
                )

        # Repoint source_entity references for all types
        for mid in req.merge_ids:
            cursor.execute(
                "UPDATE OR IGNORE knowledge_states SET source_entity_id = ? WHERE source_entity_type = ? AND source_entity_id = ?",
                (req.keep_id, req.entity_type, mid)
            )
            cursor.execute(
                "DELETE FROM knowledge_states WHERE source_entity_type = ? AND source_entity_id = ?",
                (req.entity_type, mid)
            )

        # 6. Type-specific reference updates
        if req.entity_type == "character":
            cursor.execute(
                f"UPDATE chapters SET pov_character_id = ? WHERE pov_character_id IN ({placeholders})",
                [req.keep_id] + req.merge_ids
            )
        elif req.entity_type == "group":
            cursor.execute(
                f"UPDATE characters SET group_id = ? WHERE group_id IN ({placeholders})",
                [req.keep_id] + req.merge_ids
            )
        elif req.entity_type == "location":
            cursor.execute(
                f"UPDATE locations SET parent_location_id = ? WHERE parent_location_id IN ({placeholders})",
                [req.keep_id] + req.merge_ids
            )

        # 7. Transfer image references from merged entities to kept entity
        for mid in req.merge_ids:
            cursor.execute(
                "UPDATE image_references SET entity_id = ?, is_icon = 0 WHERE entity_type = ? AND entity_id = ?",
                (req.keep_id, short_type, mid)
            )

        # 8. Delete merged entities
        cursor.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})", req.merge_ids)

        conn.commit()

        # 8. Return the updated kept entity
        cursor.execute(f"SELECT * FROM {table} WHERE id = ?", (req.keep_id,))
        result_row = cursor.fetchone()
        result = dict(result_row) if result_row else {}

        # Parse aliases for response
        if "aliases" in result and isinstance(result["aliases"], str):
            try:
                result["aliases"] = json.loads(result["aliases"])
            except (json.JSONDecodeError, TypeError):
                result["aliases"] = []

        result["type"] = req.entity_type
        return {"status": "ok", "entity": result}

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

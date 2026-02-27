"""
FleshNote API — Entity Routes
Aggregated entity listing for the linkification engine.
"""

import os
import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


class LoreEntityCreate(BaseModel):
    project_path: str
    name: str
    category: str = "item"
    aliases: list[str] = []
    description: str = ""


class LoreEntityUpdate(BaseModel):
    project_path: str
    entity_id: int
    name: str | None = None
    category: str | None = None
    classification: str | None = None
    description: str | None = None
    rules: str | None = None
    limitations: str | None = None
    origin: str | None = None
    aliases: list[str] | None = None
    notes: str | None = None


class AppendDescriptionRequest(BaseModel):
    project_path: str
    entity_type: str          # 'character', 'lore', 'location', 'group'
    entity_id: int
    text: str                 # The selected text to append
    target_field: str = "description"  # 'description' or 'notes'
    source_chapter_id: int | None = None

class AddAliasRequest(BaseModel):
    project_path: str
    entity_type: str
    entity_id: int
    alias: str

class EntitySearchRequest(BaseModel):
    project_path: str
    query: str = ""
    selected_text: str = ""
    limit: int = 20


@router.post("/api/project/lore-entity/create")
def create_lore_entity(req: LoreEntityCreate):
    """Create a lore entity (item, magic system, artifact, etc.)."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO lore_entities (name, category, aliases, description)
        VALUES (?, ?, ?, ?)
    """, (req.name, req.category, json.dumps(req.aliases), req.description))
    entity_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {
        "entity": {
            "id": entity_id, "type": "lore",
            "name": req.name, "category": req.category,
            "aliases": req.aliases,
        }
    }


@router.post("/api/project/lore-entity/update")
def update_lore_entity(req: LoreEntityUpdate):
    """Update a lore entity's fields. Only non-None fields are updated."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []

    for field_name in ["name", "category", "classification", "description",
                       "rules", "limitations", "origin", "notes"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)

    if req.aliases is not None:
        fields.append("aliases = ?")
        values.append(json.dumps(req.aliases))

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(req.entity_id)

    cursor.execute(
        f"UPDATE lore_entities SET {', '.join(fields)} WHERE id = ?",
        values
    )
    conn.commit()

    cursor.execute("SELECT * FROM lore_entities WHERE id = ?", (req.entity_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Lore entity not found")

    return {
        "entity": {
            "id": row["id"], "type": "lore",
            "name": row["name"], "category": row["category"],
            "classification": row["classification"],
            "description": row["description"],
            "rules": row["rules"], "limitations": row["limitations"],
            "origin": row["origin"],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "notes": row["notes"],
        }
    }


@router.post("/api/project/entity/append-description")
def append_entity_description(req: AppendDescriptionRequest):
    """Append selected text to an entity's bio/description/notes field with chapter annotation."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Determine table and field based on entity_type
    table_map = {
        "character": ("characters", "bio" if req.target_field == "description" else "notes"),
        "lore": ("lore_entities", req.target_field),
        "location": ("locations", req.target_field),
        "group": ("groups", req.target_field),
    }

    if req.entity_type not in table_map:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unknown entity type: {req.entity_type}")

    table, field = table_map[req.entity_type]

    # Build chapter annotation
    chapter_label = ""
    if req.source_chapter_id:
        cursor.execute("SELECT chapter_number FROM chapters WHERE id = ?", (req.source_chapter_id,))
        ch_row = cursor.fetchone()
        if ch_row:
            chapter_label = f"[Ch.{ch_row['chapter_number']}] "

    # Read current value
    cursor.execute(f"SELECT {field} FROM {table} WHERE id = ?", (req.entity_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Entity not found")

    current = row[0] or ""
    appended = f"{current}\n\n{chapter_label}{req.text}".strip()

    # Update
    if table in ("characters", "lore_entities"):
        cursor.execute(
            f"UPDATE {table} SET {field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (appended, req.entity_id)
        )
    else:
        cursor.execute(
            f"UPDATE {table} SET {field} = ? WHERE id = ?",
            (appended, req.entity_id)
        )

    conn.commit()
    conn.close()

    return {"status": "ok", "field": field, "new_value": appended}


@router.post("/api/project/entity/add-alias")
def add_entity_alias(req: AddAliasRequest):
    """Adds a new alias to an entity."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    table_map = {
        "character": "characters",
        "lore": "lore_entities",
        "location": "locations",
        "group": "groups",
    }
    if req.entity_type not in table_map:
        conn.close()
        raise HTTPException(status_code=400, detail="Unknown type")

    table = table_map[req.entity_type]
    cursor.execute(f"SELECT aliases FROM {table} WHERE id = ?", (req.entity_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Not found")

    aliases = json.loads(row["aliases"]) if row["aliases"] else []
    if req.alias not in aliases:
        aliases.append(req.alias)
        cursor.execute(
            f"UPDATE {table} SET aliases = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (json.dumps(aliases), req.entity_id)
        )
        conn.commit()

    conn.close()
    return {"status": "ok", "aliases": aliases}


@router.post("/api/project/entities/search")
def search_entities(req: EntitySearchRequest):
    """Search all entity tables by name/aliases. Returns ranked results."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    results = []
    query_lower = req.query.lower() if req.query else ""

    # Search across all entity tables
    tables = [
        ("characters", "character", ["id", "name", "aliases"]),
        ("lore_entities", "lore", ["id", "name", "aliases", "category"]),
        ("locations", "location", ["id", "name", "aliases", "region"]),
        ("groups", "group", ["id", "name", "aliases"]),
    ]

    for table, entity_type, cols in tables:
        cursor.execute(f"SELECT {', '.join(cols)} FROM {table}")
        for row in cursor.fetchall():
            name = row["name"]
            aliases = json.loads(row["aliases"]) if row["aliases"] else []
            name_lower = name.lower()

            # Score calculation
            score = 0
            if query_lower:
                if name_lower == query_lower:
                    score = 100
                elif name_lower.startswith(query_lower):
                    score = 80
                elif query_lower in name_lower:
                    score = 60
                else:
                    # Check aliases
                    for alias in aliases:
                        alias_lower = alias.lower()
                        if alias_lower == query_lower:
                            score = 90
                            break
                        elif query_lower in alias_lower:
                            score = 50
                            break

                if score == 0:
                    continue  # No match, skip
            else:
                score = 10  # Show all if no query, low score

            entry = {
                "id": row["id"],
                "type": entity_type,
                "name": name,
                "aliases": aliases,
                "score": score,
            }
            if "category" in row.keys():
                entry["category"] = row["category"]
            if "region" in row.keys():
                entry["region"] = row["region"]

            results.append(entry)

    conn.close()

    # Sort by score descending, then by name
    results.sort(key=lambda x: (-x["score"], x["name"]))

    # Limit results
    results = results[:req.limit]

    return {"entities": results}


@router.post("/api/project/entities")
def get_all_entities(req: ProjectPath):
    """
    Returns all entity names and aliases for the linkification engine.
    Called on chapter load to build the regex match list.
    """
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    entities = []

    # Characters
    cursor.execute("SELECT id, name, aliases FROM characters")
    for row in cursor.fetchall():
        aliases = json.loads(row["aliases"]) if row["aliases"] else []
        entities.append({
            "id": row["id"], "type": "character",
            "name": row["name"], "aliases": aliases,
        })

    # Lore entities
    cursor.execute("SELECT * FROM lore_entities")
    for row in cursor.fetchall():
        aliases = json.loads(row["aliases"]) if row["aliases"] else []
        entities.append({
            "id": row["id"], "type": "lore",
            "name": row["name"], "aliases": aliases,
            "category": row["category"],
            "classification": row["classification"],
            "description": row["description"],
            "rules": row["rules"],
            "limitations": row["limitations"],
            "origin": row["origin"],
            "notes": row["notes"],
            "updated_at": row["updated_at"],
        })

    # Locations
    cursor.execute("SELECT * FROM locations")
    for row in cursor.fetchall():
        aliases = json.loads(row["aliases"]) if row["aliases"] else []
        entities.append({
            "id": row["id"], "type": "location",
            "name": row["name"], "aliases": aliases,
            "region": row["region"],
            "parent_location_id": row["parent_location_id"],
            "description": row["description"],
            "notes": row["notes"],
            "updated_at": row["updated_at"],
        })

    # Groups
    cursor.execute("SELECT * FROM groups")
    for row in cursor.fetchall():
        aliases = json.loads(row["aliases"]) if row["aliases"] else []
        entities.append({
            "id": row["id"], "type": "group",
            "name": row["name"], "aliases": aliases,
            "group_type": row["group_type"],
            "description": row["description"],
            "surface_agenda": row["surface_agenda"],
            "true_agenda": row["true_agenda"],
            "notes": row["notes"],
            "updated_at": row["updated_at"],
        })

    conn.close()
    return {"entities": entities}

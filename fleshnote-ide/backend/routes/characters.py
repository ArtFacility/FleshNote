"""
FleshNote API — Character Routes
CRUD operations for characters.
"""

import os
import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


class CharacterCreate(BaseModel):
    project_path: str
    name: str
    role: str = ""
    status: str = "Alive"
    species: str = ""
    bio: str = ""
    aliases: list[str] = []
    surface_goal: str = ""
    true_goal: str = ""
    notes: str = ""


class CharacterUpdate(BaseModel):
    project_path: str
    character_id: str | int
    name: str | None = None
    role: str | None = None
    status: str | None = None
    species: str | None = None
    group_id: str | int | None = None
    surface_goal: str | None = None
    true_goal: str | None = None
    bio: str | None = None
    notes: str | None = None
    aliases: list[str] | None = None
    birth_date: str | None = None

class CharacterDelete(BaseModel):
    project_path: str
    character_id: str | int


class BulkCharacterCreate(BaseModel):
    project_path: str
    characters: list[dict]


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


@router.post("/api/project/characters")
def get_characters(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM characters WHERE deleted = 0 ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()

    characters = []
    for row in rows:
        char = {
            "id": row["id"],
            "name": row["name"],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "role": row["role"],
            "status": row["status"],
            "species": row["species"],
            "group_id": row["group_id"],
            "surface_goal": row["surface_goal"],
            "true_goal": row["true_goal"],
            "bio": row["bio"],
            "notes": row["notes"],
            "birth_date": row["birth_date"] if "birth_date" in row.keys() else "",
        }
        characters.append(char)

    return {"characters": characters}


@router.post("/api/project/character/create")
def create_character(req: CharacterCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    import uuid
    char_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO characters (id, name, aliases, role, status, species,
                                surface_goal, true_goal, bio, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        char_id,
        req.name,
        json.dumps(req.aliases) if req.aliases else None,
        req.role,
        req.status,
        req.species,
        req.surface_goal,
        req.true_goal,
        req.bio,
        req.notes,
    ))

    from sync_core import log_change
    log_change(cursor, "characters", char_id, {
        "name": req.name,
        "aliases": req.aliases,
        "role": req.role,
        "status": req.status,
        "species": req.species,
        "surface_goal": req.surface_goal,
        "true_goal": req.true_goal,
        "bio": req.bio,
        "notes": req.notes,
    })

    conn.commit()
    conn.close()

    return {
        "character": {
            "id": char_id,
            "name": req.name,
            "role": req.role,
            "status": req.status,
            "species": req.species,
            "bio": req.bio,
        }
    }


@router.post("/api/project/character/update")
def update_character(req: CharacterUpdate):
    """Update a character's fields. Only non-None fields are updated."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []
    changes = {}

    for field_name in ["name", "role", "status", "species", "group_id",
                       "surface_goal", "true_goal", "bio", "notes", "birth_date"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)
            changes[field_name] = val

    if req.aliases is not None:
        fields.append("aliases = ?")
        values.append(json.dumps(req.aliases))
        changes["aliases"] = req.aliases

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(req.character_id)

    cursor.execute(
        f"UPDATE characters SET {', '.join(fields)} WHERE id = ?",
        values
    )

    from sync_core import log_change
    log_change(cursor, "characters", req.character_id, changes)

    conn.commit()

    # Return updated character
    cursor.execute("SELECT * FROM characters WHERE id = ?", (req.character_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Character not found")

    return {
        "character": {
            "id": row["id"],
            "name": row["name"],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "role": row["role"],
            "status": row["status"],
            "species": row["species"],
            "group_id": row["group_id"],
            "surface_goal": row["surface_goal"],
            "true_goal": row["true_goal"],
            "bio": row["bio"],
            "notes": row["notes"],
            "birth_date": row["birth_date"] if "birth_date" in row.keys() else "",
        }
    }


@router.post("/api/project/character/delete")
def delete_character(req: CharacterDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    import datetime
    from sync_core import log_soft_delete
    now = datetime.datetime.utcnow().isoformat() + "Z"

    # Soft delete character
    cursor.execute("UPDATE characters SET deleted = 1, deleted_at = ? WHERE id = ?", (now, req.character_id))
    log_soft_delete(cursor, "characters", req.character_id)

    # Cascade soft deletes: character relationships where character is source or target
    cursor.execute("""
        SELECT id FROM character_relationships 
        WHERE (character_id = ? OR target_character_id = ?) AND deleted = 0
    """, (req.character_id, req.character_id))
    rel_rows = cursor.fetchall()
    for r in rel_rows:
        cursor.execute("UPDATE character_relationships SET deleted = 1, deleted_at = ? WHERE id = ?", (now, r["id"]))
        log_soft_delete(cursor, "character_relationships", r["id"])

    # Cascade soft deletes: image references
    cursor.execute("""
        SELECT id FROM image_references 
        WHERE entity_type = 'char' AND entity_id = ? AND deleted = 0
    """, (req.character_id,))
    img_rows = cursor.fetchall()
    for r in img_rows:
        cursor.execute("UPDATE image_references SET deleted = 1, deleted_at = ? WHERE id = ?", (now, r["id"]))
        log_soft_delete(cursor, "image_references", r["id"])

    conn.commit()
    conn.close()
    return {"status": "ok"}


@router.post("/api/project/characters/bulk-create")
def bulk_create_characters(req: BulkCharacterCreate):
    """Create multiple characters at once (used by onboarding wizard)."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    import uuid
    from sync_core import log_change
    created = []
    for char in req.characters:
        char_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO characters (id, name, aliases, role, status, species, bio, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            char_id,
            char.get("name", "Unnamed"),
            json.dumps(char.get("aliases", [])) if char.get("aliases") else None,
            char.get("role", ""),
            char.get("status", "Alive"),
            char.get("species", ""),
            char.get("bio", ""),
            char.get("notes", ""),
        ))
        
        log_change(cursor, "characters", char_id, {
            "name": char.get("name", "Unnamed"),
            "aliases": char.get("aliases", []),
            "role": char.get("role", ""),
            "status": char.get("status", "Alive"),
            "species": char.get("species", ""),
            "bio": char.get("bio", ""),
            "notes": char.get("notes", ""),
        })

        created.append({
            "id": char_id,
            "name": char.get("name"),
            "role": char.get("role", ""),
        })

    conn.commit()
    conn.close()
    return {"characters": created}

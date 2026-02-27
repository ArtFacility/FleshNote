"""
FleshNote API — Group Routes
CRUD operations for groups/factions.
"""

import os
import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


class GroupCreate(BaseModel):
    project_path: str
    name: str
    aliases: list[str] = []
    group_type: str = ""
    description: str = ""
    surface_agenda: str = ""
    true_agenda: str = ""
    notes: str = ""


class GroupUpdate(BaseModel):
    project_path: str
    group_id: int
    name: str | None = None
    aliases: list[str] | None = None
    group_type: str | None = None
    description: str | None = None
    surface_agenda: str | None = None
    true_agenda: str | None = None
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
        "name": row["name"],
        "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
        "group_type": row["group_type"],
        "description": row["description"],
        "surface_agenda": row["surface_agenda"],
        "true_agenda": row["true_agenda"],
        "notes": row["notes"],
    }


@router.post("/api/project/groups")
def get_groups(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM groups ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return {"groups": [_row_to_dict(row) for row in rows]}


@router.post("/api/project/group/create")
def create_group(req: GroupCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO groups (name, aliases, group_type, description,
                            surface_agenda, true_agenda, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        req.name,
        json.dumps(req.aliases) if req.aliases else None,
        req.group_type,
        req.description,
        req.surface_agenda,
        req.true_agenda,
        req.notes,
    ))

    group_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "group": {
            "id": group_id,
            "name": req.name,
            "group_type": req.group_type,
        }
    }


@router.post("/api/project/group/update")
def update_group(req: GroupUpdate):
    """Update a group's fields. Only non-None fields are updated."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []

    for field_name in ["name", "group_type", "description",
                       "surface_agenda", "true_agenda", "notes"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)

    if req.aliases is not None:
        fields.append("aliases = ?")
        values.append(json.dumps(req.aliases))

    fields.append("updated_at = CURRENT_TIMESTAMP")

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(req.group_id)

    cursor.execute(
        f"UPDATE groups SET {', '.join(fields)} WHERE id = ?",
        values
    )
    conn.commit()

    cursor.execute("SELECT * FROM groups WHERE id = ?", (req.group_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Group not found")

    return {"group": _row_to_dict(row)}

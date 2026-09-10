"""
FleshNote API — Group Routes
CRUD operations for groups/factions, dynamic memberships, time-aware rosters,
and world history integration.
"""

import os
import json
import uuid
import sqlite3
import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from sync_core import log_change, log_soft_delete
from world_calendar import load_calendar_config, world_time_to_linear_day

router = APIRouter()


# ─── PYDANTIC MODELS ──────────────────────────────────────────────────────────

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
    parent_group_id: Optional[str] = None
    philosophy: str = ""
    internal_rules: str = ""
    headquarters_location_id: Optional[str] = None
    faction_color: str = ""
    founded_date: Optional[str] = None


class GroupUpdate(BaseModel):
    project_path: str
    group_id: str
    name: Optional[str] = None
    aliases: Optional[list[str]] = None
    group_type: Optional[str] = None
    description: Optional[str] = None
    surface_agenda: Optional[str] = None
    true_agenda: Optional[str] = None
    notes: Optional[str] = None
    parent_group_id: Optional[str] = None
    philosophy: Optional[str] = None
    internal_rules: Optional[str] = None
    headquarters_location_id: Optional[str] = None
    faction_color: Optional[str] = None
    founded_date: Optional[str] = None


class GroupDelete(BaseModel):
    project_path: str
    group_id: str


class GroupMembersRequest(BaseModel):
    project_path: str
    group_id: str
    current_world_time: Optional[str] = None
    view_mode: str = "author"  # "author" | "world_time" | "narrative"


class GroupMemberAdd(BaseModel):
    project_path: str
    group_id: str
    character_id: str
    role_title: str = "Member"
    rank_order: int = 0
    joined_date: Optional[str] = None
    standing: str = "loyal"
    notes: str = ""
    create_history_entry: bool = False


class GroupMemberUpdate(BaseModel):
    project_path: str
    membership_id: str
    role_title: Optional[str] = None
    rank_order: Optional[int] = None
    joined_date: Optional[str] = None
    left_date: Optional[str] = None
    departure_reason: Optional[str] = None
    standing: Optional[str] = None
    notes: Optional[str] = None
    create_history_entry: bool = False


class GroupMemberRemove(BaseModel):
    project_path: str
    membership_id: str
    left_date: Optional[str] = None
    departure_reason: Optional[str] = None
    hard_remove: bool = False
    create_history_entry: bool = False


class CharacterMembershipsRequest(BaseModel):
    project_path: str
    character_id: str
    current_world_time: Optional[str] = None


# ─── DATABASE INITIALIZATION & MIGRATIONS ────────────────────────────────────

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Self-healing / non-destructive schema migrations
    try:
        # Check groups table columns
        group_cols = [c[1] for c in conn.execute("PRAGMA table_info(groups)").fetchall()]
        new_cols = [
            ("parent_group_id", "TEXT"),
            ("philosophy", "TEXT"),
            ("internal_rules", "TEXT"),
            ("headquarters_location_id", "TEXT"),
            ("faction_color", "TEXT"),
            ("founded_date", "TEXT"),
        ]
        for col_name, col_type in new_cols:
            if col_name not in group_cols:
                conn.execute(f"ALTER TABLE groups ADD COLUMN {col_name} {col_type}")

        # Ensure group_memberships table exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS group_memberships (
                id                  TEXT PRIMARY KEY,
                group_id            TEXT NOT NULL,
                character_id        TEXT NOT NULL,
                role_title          TEXT DEFAULT '',
                rank_order          INTEGER DEFAULT 0,
                joined_date         TEXT,
                left_date           TEXT,
                departure_reason    TEXT,
                standing            TEXT DEFAULT 'loyal',
                notes               TEXT DEFAULT '',
                deleted             INTEGER DEFAULT 0,
                deleted_at          TEXT,
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id, deleted)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_group_memberships_char ON group_memberships(character_id, deleted)")
        conn.commit()
    except Exception as e:
        print(f"Warning during group schema verification: {e}")

    return conn


def _row_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
        "group_type": row["group_type"] if "group_type" in row.keys() else "",
        "description": row["description"] if "description" in row.keys() else "",
        "surface_agenda": row["surface_agenda"] if "surface_agenda" in row.keys() else "",
        "true_agenda": row["true_agenda"] if "true_agenda" in row.keys() else "",
        "notes": row["notes"] if "notes" in row.keys() else "",
        "parent_group_id": row["parent_group_id"] if "parent_group_id" in row.keys() else None,
        "philosophy": row["philosophy"] if "philosophy" in row.keys() else "",
        "internal_rules": row["internal_rules"] if "internal_rules" in row.keys() else "",
        "headquarters_location_id": row["headquarters_location_id"] if "headquarters_location_id" in row.keys() else None,
        "faction_color": row["faction_color"] if "faction_color" in row.keys() else "",
        "founded_date": row["founded_date"] if "founded_date" in row.keys() else "",
        "updated_at": row["updated_at"] if "updated_at" in row.keys() else None,
    }


def _parse_date_parts(date_str: Optional[str]) -> tuple[Optional[int], Optional[int], Optional[int]]:
    """Attempt to parse YYYY-MM-DD or year into integers."""
    if not date_str:
        return None, None, None
    parts = str(date_str).strip().split("-")
    try:
        year = int(parts[0]) if len(parts) > 0 and parts[0] else None
        month = int(parts[1]) if len(parts) > 1 and parts[1] else None
        day = int(parts[2]) if len(parts) > 2 and parts[2] else None
        return year, month, day
    except ValueError:
        return None, None, None


# ─── GROUP CRUD ENDPOINTS ───────────────────────────────────────────────────

@router.post("/api/project/groups")
def get_groups(req: ProjectPath):
    """List all groups with member counts and parent group metadata."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Query groups along with active member counts
    cursor.execute("""
        SELECT g.*, 
               (SELECT COUNT(*) FROM group_memberships gm 
                WHERE gm.group_id = g.id AND gm.deleted = 0 AND gm.left_date IS NULL) AS active_members_count
        FROM groups g 
        WHERE g.deleted = 0 
        ORDER BY g.name COLLATE NOCASE ASC
    """)
    rows = cursor.fetchall()

    result = []
    for r in rows:
        d = _row_to_dict(r)
        d["member_count"] = r["active_members_count"]
        result.append(d)

    conn.close()
    return {"groups": result}


@router.post("/api/project/group/create")
def create_group(req: GroupCreate):
    """Create a new group/faction."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    group_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO groups (id, name, aliases, group_type, description,
                            surface_agenda, true_agenda, notes,
                            parent_group_id, philosophy, internal_rules,
                            headquarters_location_id, faction_color, founded_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        group_id,
        req.name,
        json.dumps(req.aliases) if req.aliases else None,
        req.group_type,
        req.description,
        req.surface_agenda,
        req.true_agenda,
        req.notes,
        req.parent_group_id,
        req.philosophy,
        req.internal_rules,
        req.headquarters_location_id,
        req.faction_color,
        req.founded_date,
    ))

    changes = {
        "name": req.name,
        "aliases": req.aliases,
        "group_type": req.group_type,
        "description": req.description,
        "surface_agenda": req.surface_agenda,
        "true_agenda": req.true_agenda,
        "notes": req.notes,
        "parent_group_id": req.parent_group_id,
        "philosophy": req.philosophy,
        "internal_rules": req.internal_rules,
        "headquarters_location_id": req.headquarters_location_id,
        "faction_color": req.faction_color,
        "founded_date": req.founded_date,
    }
    log_change(cursor, "groups", group_id, changes)

    # Automatically create a founding history timeline entry if founded_date is provided
    if req.founded_date:
        y, m, d = _parse_date_parts(req.founded_date)
        if y is not None:
            hist_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO history_entries (
                    id, entity_type, entity_id, title, description,
                    event_type, date_year, date_month, date_day, date_precise
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                hist_id, "group", group_id, f"{req.name} founded", req.description or "",
                "founding", y, m, d, 1 if d is not None else 0
            ))
            log_change(cursor, "history_entries", hist_id, {
                "entity_type": "group",
                "entity_id": group_id,
                "title": f"{req.name} founded",
                "event_type": "founding",
                "date_year": y, "date_month": m, "date_day": d
            })

    conn.commit()
    cursor.execute("SELECT * FROM groups WHERE id = ?", (group_id,))
    created_row = cursor.fetchone()
    conn.close()

    return {"group": _row_to_dict(created_row)}


@router.post("/api/project/group/update")
def update_group(req: GroupUpdate):
    """Update a group's fields. Only non-None fields are updated."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []
    changes = {}

    for field_name in [
        "name", "group_type", "description", "surface_agenda",
        "true_agenda", "notes", "parent_group_id", "philosophy",
        "internal_rules", "headquarters_location_id", "faction_color", "founded_date"
    ]:
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
    values.append(req.group_id)

    cursor.execute(
        f"UPDATE groups SET {', '.join(fields)} WHERE id = ?",
        values
    )

    log_change(cursor, "groups", req.group_id, changes)
    conn.commit()

    cursor.execute("SELECT * FROM groups WHERE id = ?", (req.group_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Group not found")

    return {"group": _row_to_dict(row)}


@router.post("/api/project/group/delete")
def delete_group(req: GroupDelete):
    """Soft delete group and cascade to memberships and character references."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    now = datetime.datetime.utcnow().isoformat() + "Z"

    # 1. Soft delete group
    cursor.execute("UPDATE groups SET deleted = 1, deleted_at = ? WHERE id = ?", (now, req.group_id))
    log_soft_delete(cursor, "groups", req.group_id)

    # 2. Soft delete all group memberships
    cursor.execute("SELECT id FROM group_memberships WHERE group_id = ? AND deleted = 0", (req.group_id,))
    mem_rows = cursor.fetchall()
    for m in mem_rows:
        cursor.execute("UPDATE group_memberships SET deleted = 1, deleted_at = ? WHERE id = ?", (now, m["id"]))
        log_soft_delete(cursor, "group_memberships", m["id"])

    # 3. Clean legacy character foreign key
    cursor.execute("SELECT id FROM characters WHERE group_id = ? AND deleted = 0", (req.group_id,))
    char_rows = cursor.fetchall()
    for r in char_rows:
        cursor.execute("UPDATE characters SET group_id = NULL WHERE id = ?", (r["id"],))
        log_change(cursor, "characters", r["id"], {"group_id": None})

    conn.commit()
    conn.close()
    return {"status": "ok"}


# ─── GROUP MEMBERSHIP & TIME-AWARE ROSTER ENDPOINTS ─────────────────────────

@router.post("/api/project/group/members")
def get_group_members(req: GroupMembersRequest):
    """
    Get all members of a group with effective world time resolution.
    If current_world_time is passed, computes temporal_status:
    'active', 'former', or 'future'.
    """
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cal = load_calendar_config(cursor)
    current_linear = world_time_to_linear_day(req.current_world_time, cal) if req.current_world_time else None

    cursor.execute("""
        SELECT gm.*, 
               c.name AS character_name, 
               c.role AS character_role,
               c.status AS character_status,
               c.aliases AS character_aliases
        FROM group_memberships gm
        JOIN characters c ON gm.character_id = c.id
        WHERE gm.group_id = ? AND gm.deleted = 0 AND c.deleted = 0
        ORDER BY gm.rank_order ASC, gm.role_title ASC, c.name ASC
    """, (req.group_id,))
    rows = cursor.fetchall()

    members = []
    for r in rows:
        joined_date = r["joined_date"]
        left_date = r["left_date"]

        joined_linear = world_time_to_linear_day(joined_date, cal) if joined_date else None
        left_linear = world_time_to_linear_day(left_date, cal) if left_date else None

        # Determine temporal status
        temporal_status = "active"
        if current_linear is not None:
            if left_linear is not None and left_linear <= current_linear:
                temporal_status = "former"
            elif joined_linear is not None and joined_linear > current_linear:
                temporal_status = "future"
            else:
                temporal_status = "active"
        else:
            # Fallback when no world time is set: check if left_date exists
            if left_date:
                temporal_status = "former"

        # Filter if in strict narrative / world_time mode
        if req.view_mode in ("world_time", "narrative") and current_linear is not None:
            if temporal_status != "active":
                continue

        members.append({
            "id": r["id"],
            "group_id": r["group_id"],
            "character_id": r["character_id"],
            "character_name": r["character_name"],
            "character_role": r["character_role"],
            "character_status": r["character_status"],
            "role_title": r["role_title"] or "Member",
            "rank_order": r["rank_order"] or 0,
            "joined_date": joined_date,
            "left_date": left_date,
            "departure_reason": r["departure_reason"],
            "standing": r["standing"] or "loyal",
            "notes": r["notes"] or "",
            "temporal_status": temporal_status,
        })

    conn.close()
    return {"members": members}


@router.post("/api/project/group/member/add")
def add_group_member(req: GroupMemberAdd):
    """Add a character to a group with rank, role, and join date."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    membership_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO group_memberships (
            id, group_id, character_id, role_title, rank_order,
            joined_date, standing, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        membership_id,
        req.group_id,
        req.character_id,
        req.role_title,
        req.rank_order,
        req.joined_date,
        req.standing,
        req.notes,
    ))

    changes = {
        "group_id": req.group_id,
        "character_id": req.character_id,
        "role_title": req.role_title,
        "rank_order": req.rank_order,
        "joined_date": req.joined_date,
        "standing": req.standing,
        "notes": req.notes,
    }
    log_change(cursor, "group_memberships", membership_id, changes)

    # Optional: Automatically create a history timeline marker
    if req.create_history_entry and req.joined_date:
        y, m, d = _parse_date_parts(req.joined_date)
        if y is not None:
            cursor.execute("SELECT name FROM characters WHERE id = ?", (req.character_id,))
            c_name = cursor.fetchone()
            cursor.execute("SELECT name FROM groups WHERE id = ?", (req.group_id,))
            g_name = cursor.fetchone()
            
            c_label = c_name[0] if c_name else "Character"
            g_label = g_name[0] if g_name else "Group"
            role_part = f" as {req.role_title}" if req.role_title else ""
            title = f"{c_label} joined {g_label}{role_part}"
            
            hist_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO history_entries (
                    id, entity_type, entity_id, title, description,
                    event_type, date_year, date_month, date_day, date_precise,
                    related_entity_type, related_entity_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                hist_id, "group", req.group_id, title, req.notes or "",
                "member_joined", y, m, d, 1 if d is not None else 0,
                "character", req.character_id
            ))
            log_change(cursor, "history_entries", hist_id, {
                "entity_type": "group",
                "entity_id": req.group_id,
                "title": title,
                "event_type": "member_joined",
                "date_year": y, "date_month": m, "date_day": d,
                "related_entity_type": "character",
                "related_entity_id": req.character_id,
            })

    conn.commit()
    conn.close()
    return {"status": "ok", "membership_id": membership_id}


@router.post("/api/project/group/member/update")
def update_group_member(req: GroupMemberUpdate):
    """Update membership fields (role, rank, standing, departure info)."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []
    changes = {}

    for field_name in ["role_title", "rank_order", "joined_date", "left_date",
                       "departure_reason", "standing", "notes"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)
            changes[field_name] = val

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(req.membership_id)

    cursor.execute(
        f"UPDATE group_memberships SET {', '.join(fields)} WHERE id = ?",
        values
    )
    log_change(cursor, "group_memberships", req.membership_id, changes)

    # Optional: Log departure event to history
    if req.create_history_entry and req.left_date:
        y, m, d = _parse_date_parts(req.left_date)
        if y is not None:
            cursor.execute("""
                SELECT gm.group_id, gm.character_id, c.name as char_name, g.name as group_name
                FROM group_memberships gm
                JOIN characters c ON gm.character_id = c.id
                JOIN groups g ON gm.group_id = g.id
                WHERE gm.id = ?
            """, (req.membership_id,))
            info = cursor.fetchone()
            if info:
                reason = f" ({req.departure_reason})" if req.departure_reason else ""
                title = f"{info['char_name']} left {info['group_name']}{reason}"
                hist_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO history_entries (
                        id, entity_type, entity_id, title, description,
                        event_type, date_year, date_month, date_day, date_precise,
                        related_entity_type, related_entity_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    hist_id, "group", info["group_id"], title, req.notes or "",
                    "member_left", y, m, d, 1 if d is not None else 0,
                    "character", info["character_id"]
                ))
                log_change(cursor, "history_entries", hist_id, {
                    "entity_type": "group",
                    "entity_id": info["group_id"],
                    "title": title,
                    "event_type": "member_left",
                    "date_year": y, "date_month": m, "date_day": d,
                    "related_entity_type": "character",
                    "related_entity_id": info["character_id"]
                })

    conn.commit()
    conn.close()
    return {"status": "ok"}


@router.post("/api/project/group/member/remove")
def remove_group_member(req: GroupMemberRemove):
    """
    Remove member from group. If left_date is provided and not hard_remove,
    records departure history. Otherwise performs soft-delete.
    """
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    now = datetime.datetime.utcnow().isoformat() + "Z"

    if req.hard_remove or not req.left_date:
        cursor.execute("UPDATE group_memberships SET deleted = 1, deleted_at = ? WHERE id = ?",
                       (now, req.membership_id))
        log_soft_delete(cursor, "group_memberships", req.membership_id)
    else:
        cursor.execute("""
            UPDATE group_memberships 
            SET left_date = ?, departure_reason = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (req.left_date, req.departure_reason or "Departed", req.membership_id))
        log_change(cursor, "group_memberships", req.membership_id, {
            "left_date": req.left_date,
            "departure_reason": req.departure_reason or "Departed",
        })

    conn.commit()
    conn.close()
    return {"status": "ok"}


@router.post("/api/project/character/memberships")
def get_character_memberships(req: CharacterMembershipsRequest):
    """Get all groups/factions a character belongs to with effective status."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cal = load_calendar_config(cursor)
    current_linear = world_time_to_linear_day(req.current_world_time, cal) if req.current_world_time else None

    cursor.execute("""
        SELECT gm.*, g.name AS group_name, g.group_type, g.faction_color
        FROM group_memberships gm
        JOIN groups g ON gm.group_id = g.id
        WHERE gm.character_id = ? AND gm.deleted = 0 AND g.deleted = 0
        ORDER BY gm.rank_order ASC, g.name ASC
    """, (req.character_id,))
    rows = cursor.fetchall()

    memberships = []
    for r in rows:
        joined_date = r["joined_date"]
        left_date = r["left_date"]

        joined_linear = world_time_to_linear_day(joined_date, cal) if joined_date else None
        left_linear = world_time_to_linear_day(left_date, cal) if left_date else None

        temporal_status = "active"
        if current_linear is not None:
            if left_linear is not None and left_linear <= current_linear:
                temporal_status = "former"
            elif joined_linear is not None and joined_linear > current_linear:
                temporal_status = "future"
            else:
                temporal_status = "active"
        elif left_date:
            temporal_status = "former"

        memberships.append({
            "id": r["id"],
            "group_id": r["group_id"],
            "group_name": r["group_name"],
            "group_type": r["group_type"],
            "faction_color": r["faction_color"] or "var(--entity-item)",
            "role_title": r["role_title"] or "Member",
            "rank_order": r["rank_order"] or 0,
            "joined_date": joined_date,
            "left_date": left_date,
            "departure_reason": r["departure_reason"],
            "standing": r["standing"] or "loyal",
            "temporal_status": temporal_status,
        })

    conn.close()
    return {"memberships": memberships}

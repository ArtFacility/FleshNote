"""
FleshNote API — Sketchboards Routes
Boards (visual node graphs), their nodes (board_items) and connections
(item_connections).

Nodes, connections and the board's legend (named connection types and node
kinds) are written through one batch endpoint, so a multi-node move, a paste,
a restyle of a type with all its connections or an undo lands as a single
transaction. Ids are made by the
client, which lets it undo and redo without waiting for the server.

Older builds sync and draw the original columns (color, conn_color, item_type,
directed, curve_offset). New columns carry the new look, and every write also
keeps the original columns at a best-effort equivalent. Rows that only have
the original columns (older builds, 1.x projects) are read into the new shape
by _node_out / _edge_out, so nothing is rewritten on open.
"""

import json
import math
import os
import re
import sqlite3
import uuid
import datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db_setup import ensure_board_schema

router = APIRouter()


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    ensure_board_schema(conn.cursor())
    return conn


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


# ── Vocabulary ──────────────────────────────────────────────────

SHAPES = ("card", "diamond", "ellipse", "hex", "text", "frame")
COLOR_TOKENS = ("neutral", "amber", "red", "green", "blue", "purple")
SIDES = ("auto", "top", "right", "bottom", "left")
ROUTINGS = ("straight", "curved", "elbow")
MARKERS = ("none", "arrow", "bar", "dot", "diamond")
DASHES = ("solid", "dashed", "dotted", "dashdot", "longdash")
ENTITY_TYPES = ("character", "location", "lore", "group")

# What older builds draw for each token (they read the hex columns).
TOKEN_HEX = {
    "neutral": "#888888", "amber": "#d4a052", "red": "#c45c5c",
    "green": "#5c9e6e", "blue": "#5c8ec4", "purple": "#8b6ec4",
}

ENTITY_TABLES = {
    "character": "characters", "location": "locations",
    "group": "groups", "lore": "lore_entities",
}
ENTITY_TOKENS = {"character": "amber", "location": "green", "lore": "blue", "group": "amber"}

# The default colours older builds gave each node type; a node still wearing
# one takes its entity's colour instead of the nearest hue.
_LEGACY_TYPE_DEFAULTS = {"#4a9eff", "#ff6b4a", "#a855f7", "#f59e0b", "#eab308", "#6b7280"}

_ID_RE = re.compile(r"^[0-9A-Za-z][0-9A-Za-z_-]{0,63}$")
MAX_WAYPOINTS = 64
MAX_PROPS = 64
MAX_OPS = 2000


def _entity_kind(entity_type: Optional[str]) -> Optional[str]:
    """Older builds stored whatever type the picker showed; anything that is
    not a character, location or group was a lore entry."""
    if not entity_type:
        return None
    return entity_type if entity_type in ENTITY_TABLES else "lore"


def token_from_hex(hex_color: Optional[str], entity_type: Optional[str] = None) -> str:
    """Nearest brand colour token for a colour stored by an older build."""
    kind = _entity_kind(entity_type)
    h = (hex_color or "").strip().lower()
    if kind and (not h or h in _LEGACY_TYPE_DEFAULTS):
        return ENTITY_TOKENS[kind]
    if h in {v: k for k, v in TOKEN_HEX.items()}:
        return {v: k for k, v in TOKEN_HEX.items()}[h]
    m = re.fullmatch(r"#([0-9a-f]{6})", h)
    if not m:
        return "neutral"
    r, g, b = (int(m.group(1)[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hi, lo = max(r, g, b), min(r, g, b)
    if hi - lo < 0.15:
        return "neutral"
    d = hi - lo
    if hi == r:
        hue = (60 * ((g - b) / d)) % 360
    elif hi == g:
        hue = 60 * ((b - r) / d) + 120
    else:
        hue = 60 * ((r - g) / d) + 240
    if hue < 20 or hue >= 330:
        return "red"
    if hue < 65:
        return "amber"
    if hue < 170:
        return "green"
    if hue < 250:
        return "blue"
    return "purple"


def _legacy_shape(item_type: Optional[str]) -> str:
    if item_type == "character":
        return "ellipse"
    if item_type in ("group", "concept"):
        return "hex"
    return "card"


def _legacy_item_type(shape: str) -> str:
    return {"ellipse": "character", "hex": "concept"}.get(shape, "standalone")


def _finite(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def parse_waypoints(raw) -> list:
    """Waypoints from a stored JSON value. Rows can arrive through a sync merge
    without passing this API, so anything malformed reads as no waypoints."""
    try:
        pts = json.loads(raw) if isinstance(raw, str) else raw
    except (TypeError, ValueError):
        return []
    if not isinstance(pts, list):
        return []
    out = []
    for p in pts[:MAX_WAYPOINTS]:
        if isinstance(p, (list, tuple)) and len(p) == 2 and all(_finite(c) and abs(c) < 1e7 for c in p):
            out.append([float(p[0]), float(p[1])])
    return out


def parse_props(raw) -> list:
    try:
        props = json.loads(raw) if isinstance(raw, str) else raw
    except (TypeError, ValueError):
        return []
    if not isinstance(props, list):
        return []
    return [[str(p[0])[:120], str(p[1])[:2000]] for p in props[:MAX_PROPS]
            if isinstance(p, (list, tuple)) and len(p) == 2]


def _choice(value, allowed, default):
    return value if value in allowed else default


# ── Reading rows into the current shape ─────────────────────────

def _live_entity_names(cursor, items) -> dict:
    """{(kind, id): name} for the entities bound nodes point at, read live so a
    rename shows on every board. A missing key means the entity is gone."""
    wanted = {}
    for it in items:
        kind = _entity_kind(it.get("entity_type"))
        if kind and it.get("entity_id"):
            wanted.setdefault(kind, set()).add(str(it["entity_id"]))
    names = {}
    for kind, ids in wanted.items():
        ids = list(ids)
        for i in range(0, len(ids), 500):
            chunk = ids[i:i + 500]
            cursor.execute(
                f"SELECT id, name FROM {ENTITY_TABLES[kind]} "
                f"WHERE COALESCE(deleted, 0) = 0 AND id IN ({','.join('?' * len(chunk))})", chunk)
            for row in cursor.fetchall():
                names[(kind, str(row["id"]))] = row["name"]
    return names


def _first_chapters(cursor, items) -> dict:
    """{(kind, id): chapter id} of the earliest chapter, in reading order, that
    mentions each entity bound nodes point at. Read on every load, never stored."""
    wanted = {}
    for it in items:
        kind = _entity_kind(it.get("entity_type"))
        if kind and it.get("entity_id"):
            wanted.setdefault(kind, set()).add(str(it["entity_id"]))
    out = {}
    for kind, ids in wanted.items():
        ids = list(ids)
        # Lore appearances may be stored as 'lore' or as the link's short form 'item'.
        kinds = ("lore", "item") if kind == "lore" else (kind,)
        for i in range(0, len(ids), 500):
            chunk = ids[i:i + 500]
            cursor.execute(
                "SELECT ea.entity_id, ea.chapter_id, MIN(c.chapter_number) "
                "FROM entity_appearances ea JOIN chapters c ON c.id = ea.chapter_id "
                f"WHERE COALESCE(c.deleted, 0) = 0 AND ea.entity_type IN ({','.join('?' * len(kinds))}) "
                f"AND ea.entity_id IN ({','.join('?' * len(chunk))}) GROUP BY ea.entity_id",
                [*kinds, *chunk])
            for eid, chapter_id, _ in cursor.fetchall():
                out[(kind, str(eid))] = str(chapter_id)
    return out


def _node_out(row: dict, names: dict, kinds: set = frozenset(), first: dict = None) -> dict:
    kind = _entity_kind(row.get("entity_type"))
    eid = str(row["entity_id"]) if row.get("entity_id") else None
    live = names.get((kind, eid)) if kind and eid else None
    return {
        "id": row["id"],
        "board_id": row["board_id"],
        "name": row.get("name") or "",
        "description": row.get("description") or "",
        "shape": _choice(row.get("shape"), SHAPES, _legacy_shape(row.get("item_type"))),
        "color_token": _choice(row.get("color_token"), COLOR_TOKENS,
                               token_from_hex(row.get("color"), row.get("entity_type"))),
        "entity_type": kind if eid else None,
        "entity_id": eid if kind else None,
        "entity_name": live,
        "entity_missing": bool(kind and eid and live is None),
        "pos_x": row["pos_x"] if _finite(row.get("pos_x")) else 0.0,
        "pos_y": row["pos_y"] if _finite(row.get("pos_y")) else 0.0,
        "size_x": min(max(row["size_x"], 20), 4000) if _finite(row.get("size_x")) else 160.0,
        "size_y": min(max(row["size_y"], 20), 4000) if _finite(row.get("size_y")) else 64.0,
        "z_index": row.get("z_index") or 0,
        # A kind deleted on another device leaves the node with its look.
        "kind_id": row.get("kind_id") if row.get("kind_id") in kinds else None,
        "parent_id": row.get("parent_id"),
        "props": parse_props(row.get("props")),
        "appears_chapter_id": row.get("appears_chapter_id"),
        "ends_chapter_id": row.get("ends_chapter_id"),
        "appears_world_time": row.get("appears_world_time"),
        "ends_world_time": row.get("ends_world_time"),
        "appears_auto": bool(row.get("appears_auto")),
        "first_chapter_id": (first or {}).get((kind, eid)) if kind and eid else None,
    }


# Older builds fanned parallel connections between the same two nodes apart
# by this many units each, on top of the stored curve_offset.
_LEGACY_PARALLEL_STEP = 44


def _legacy_waypoints(conns: list, nodes: dict) -> dict:
    """{connection id: [[x, y]]} for rows that only have the old single-number
    bend (curve_offset). The old line was a quadratic curve whose control
    point sat curve_offset (plus the parallel fan-out) off the midpoint; the
    curve passes through the point halfway to it, which becomes the waypoint."""
    siblings = {}
    for c in conns:
        key = tuple(sorted((str(c["item_start_id"]), str(c["item_end_id"]))))
        siblings.setdefault(key, []).append(c["id"])
    out = {}
    for c in conns:
        if c.get("waypoints") is not None:
            continue
        key = tuple(sorted((str(c["item_start_id"]), str(c["item_end_id"]))))
        group = siblings[key]
        fan = (group.index(c["id"]) - (len(group) - 1) / 2) * _LEGACY_PARALLEL_STEP if len(group) > 1 else 0
        # Fan out on one side of the pair whichever way each line points
        # (older builds let opposite-facing lines land on top of each other).
        if str(c["item_start_id"]) > str(c["item_end_id"]):
            fan = -fan
        offset = (c.get("curve_offset") or 0) + fan
        a, b = nodes.get(c["item_start_id"]), nodes.get(c["item_end_id"])
        if not offset or not a or not b:
            continue
        ax, ay = a["pos_x"] + a["size_x"] / 2, a["pos_y"] + a["size_y"] / 2
        bx, by = b["pos_x"] + b["size_x"] / 2, b["pos_y"] + b["size_y"] / 2
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy) or 1
        nx, ny = -dy / length, dx / length
        out[c["id"]] = [[(ax + bx) / 2 + nx * offset / 2, (ay + by) / 2 + ny * offset / 2]]
    return out


def _edge_out(row: dict, legacy_wp: dict, types: set = frozenset()) -> dict:
    stored = row.get("waypoints")
    waypoints = parse_waypoints(stored) if stored is not None else legacy_wp.get(row["id"], [])
    routing = row.get("routing")
    if routing not in ROUTINGS:
        routing = "curved" if row["id"] in legacy_wp else "straight"
    end_default = "arrow" if row.get("directed", 1) else "none"
    label_t = row.get("label_t")
    return {
        "id": row["id"],
        "board_id": row["board_id"],
        "item_start_id": row["item_start_id"],
        "item_end_id": row["item_end_id"],
        "from_side": _choice(row.get("from_side"), SIDES, "auto"),
        "to_side": _choice(row.get("to_side"), SIDES, "auto"),
        "routing": routing,
        "waypoints": waypoints,
        "start_marker": _choice(row.get("start_marker"), MARKERS, "none"),
        "end_marker": _choice(row.get("end_marker"), MARKERS, end_default),
        "conn_type": _choice(row.get("conn_type"), DASHES, "solid"),
        "color_token": _choice(row.get("color_token"), COLOR_TOKENS, token_from_hex(row.get("conn_color"))),
        "title": row.get("title") or "",
        "label_t": min(max(label_t, 0.0), 1.0) if _finite(label_t) else 0.5,
        "type_id": row.get("type_id") if row.get("type_id") in types else None,
        "appears_chapter_id": row.get("appears_chapter_id"),
        "ends_chapter_id": row.get("ends_chapter_id"),
        "appears_world_time": row.get("appears_world_time"),
        "ends_world_time": row.get("ends_world_time"),
    }


def _type_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "color_token": _choice(row.get("color_token"), COLOR_TOKENS, "neutral"),
        "conn_type": _choice(row.get("conn_type"), DASHES, "solid"),
        "start_marker": _choice(row.get("start_marker"), MARKERS, "none"),
        "end_marker": _choice(row.get("end_marker"), MARKERS, "arrow"),
        "sort_order": row.get("sort_order") or 0,
    }


def _kind_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "shape": _choice(row.get("shape"), SHAPES, "card"),
        "color_token": _choice(row.get("color_token"), COLOR_TOKENS, "neutral"),
        "sort_order": row.get("sort_order") or 0,
    }


def _board_out(row: dict) -> dict:
    out = dict(row)
    try:
        settings = json.loads(row.get("settings") or "{}")
    except (TypeError, ValueError):
        settings = {}
    out["settings"] = settings if isinstance(settings, dict) else {}
    return out


# ── Board CRUD ──────────────────────────────────────────────────

class BoardList(BaseModel):
    project_path: str

class BoardCreate(BaseModel):
    project_path: str
    name: str = "New Board"
    board_type: str = "custom"
    icon: str = "𐲡"

class BoardUpdate(BaseModel):
    project_path: str
    board_id: str | int
    name: Optional[str] = None
    board_type: Optional[str] = None
    icon: Optional[str] = None
    zoom: Optional[float] = None
    pan_x: Optional[float] = None
    pan_y: Optional[float] = None
    settings: Optional[dict] = None

class BoardDelete(BaseModel):
    project_path: str
    board_id: str | int

class BoardLoad(BaseModel):
    project_path: str
    board_id: str | int


@router.post("/api/project/boards/list")
async def list_boards(req: BoardList):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM boards WHERE deleted = 0 ORDER BY created_at")
    rows = cursor.fetchall()
    conn.close()
    return {"boards": [_board_out(dict(r)) for r in rows]}


@router.post("/api/project/boards/create")
async def create_board(req: BoardCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    board_id = str(uuid.uuid4())
    name, icon = req.name[:200], req.icon[:8]
    cursor.execute(
        "INSERT INTO boards (id, name, board_type, icon) VALUES (?, ?, ?, ?)",
        (board_id, name, req.board_type[:64], icon)
    )

    from sync_core import log_change
    log_change(cursor, "boards", board_id, {
        "name": name,
        "board_type": req.board_type[:64],
        "icon": icon
    })

    conn.commit()
    cursor.execute("SELECT * FROM boards WHERE id = ?", (board_id,))
    board = _board_out(dict(cursor.fetchone()))
    conn.close()
    return {"board": board}


@router.post("/api/project/boards/update")
async def update_board(req: BoardUpdate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    fields, params = [], []
    changes = {}
    for f in ["name", "board_type", "icon", "zoom", "pan_x", "pan_y"]:
        v = getattr(req, f)
        if v is not None:
            fields.append(f"{f} = ?")
            params.append(v)
            # The viewport is per device, so it is saved but never synced.
            if f in ["name", "board_type", "icon"]:
                changes[f] = v
    if req.settings is not None:
        settings = json.dumps(req.settings)
        if len(settings) > 4000:
            conn.close()
            raise HTTPException(status_code=400, detail="Board settings too large")
        fields.append("settings = ?")
        params.append(settings)
        changes["settings"] = settings
    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    fields.append("updated_at = datetime('now')")
    params.append(req.board_id)
    cursor.execute(f"UPDATE boards SET {', '.join(fields)} WHERE id = ?", params)

    from sync_core import log_change
    if changes:
        log_change(cursor, "boards", req.board_id, changes)

    conn.commit()
    cursor.execute("SELECT * FROM boards WHERE id = ?", (req.board_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"board": _board_out(dict(row))}


@router.post("/api/project/boards/delete")
async def delete_board(req: BoardDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    from sync_core import log_soft_delete
    now = _now()

    cursor.execute("UPDATE boards SET deleted = 1, deleted_at = ? WHERE id = ?", (now, req.board_id))
    log_soft_delete(cursor, "boards", req.board_id)

    # Cascade to everything on the board, legend included.
    for table in ("board_items", "item_connections", "board_edge_types", "board_node_kinds"):
        cursor.execute(f"SELECT id FROM {table} WHERE board_id = ? AND deleted = 0", (req.board_id,))
        for r in cursor.fetchall():
            cursor.execute(f"UPDATE {table} SET deleted = 1, deleted_at = ? WHERE id = ?", (now, r["id"]))
            log_soft_delete(cursor, table, r["id"])

    conn.commit()
    conn.close()
    return {"status": "ok"}


def read_board(cursor, board_id) -> dict:
    """A board's nodes, connections and legend in the current shape, or None
    when there is no such board. The cursor's rows must be sqlite3.Row."""
    cursor.execute("SELECT * FROM boards WHERE id = ? AND deleted = 0", (board_id,))
    board_row = cursor.fetchone()
    if not board_row:
        return None
    cursor.execute("SELECT * FROM board_items WHERE board_id = ? AND deleted = 0 ORDER BY rowid", (board_id,))
    raw_items = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM item_connections WHERE board_id = ? AND deleted = 0 ORDER BY rowid", (board_id,))
    raw_conns = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM board_edge_types WHERE board_id = ? AND deleted = 0 "
                   "ORDER BY sort_order, rowid", (board_id,))
    types = [_type_out(dict(r)) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM board_node_kinds WHERE board_id = ? AND deleted = 0 "
                   "ORDER BY sort_order, rowid", (board_id,))
    kinds = [_kind_out(dict(r)) for r in cursor.fetchall()]
    names = _live_entity_names(cursor, raw_items)
    first = _first_chapters(cursor, raw_items)

    kind_ids = {k["id"] for k in kinds}
    type_ids = {t["id"] for t in types}
    items = [_node_out(r, names, kind_ids, first) for r in raw_items]
    by_id = {it["id"]: it for it in items}
    raw_conns = [c for c in raw_conns if c["item_start_id"] in by_id and c["item_end_id"] in by_id]
    legacy_wp = _legacy_waypoints(raw_conns, by_id)
    connections = [_edge_out(c, legacy_wp, type_ids) for c in raw_conns]
    return {"board": _board_out(dict(board_row)), "items": items, "connections": connections,
            "types": types, "kinds": kinds}


@router.post("/api/project/boards/load")
async def load_board(req: BoardLoad):
    conn = _get_db(req.project_path)
    try:
        out = read_board(conn.cursor(), req.board_id)
    finally:
        conn.close()
    if out is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return out


class BoardsForEntity(BaseModel):
    project_path: str
    entity_type: str
    entity_id: str


@router.post("/api/project/boards/for-entity")
async def boards_for_entity(req: BoardsForEntity):
    """The boards an entity has a node on, with those nodes' ids."""
    kind = _entity_kind(req.entity_type)
    if not kind:
        raise HTTPException(status_code=400, detail="Unknown entity type")
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT b.id AS board_id, b.name, b.icon, i.id AS node_id, i.entity_type "
        "FROM board_items i JOIN boards b ON b.id = i.board_id "
        "WHERE i.deleted = 0 AND b.deleted = 0 AND i.entity_id = ? "
        "ORDER BY b.created_at, i.rowid", (str(req.entity_id),))
    out = {}
    for r in cursor.fetchall():
        # Older builds stored lore under its category name; _entity_kind reads those as lore.
        if _entity_kind(r["entity_type"]) != kind:
            continue
        entry = out.setdefault(r["board_id"], {"board_id": r["board_id"], "name": r["name"],
                                               "icon": r["icon"], "node_ids": []})
        entry["node_ids"].append(r["node_id"])
    conn.close()
    return {"boards": list(out.values())}


# ── Generated boards: live views of relationships and factions ──

# A board of one of these types draws connections the board doesn't store:
# relationship states or faction memberships, read from the project each
# time. Its nodes are ordinary bound nodes, kept only for their positions.
GENERATED_TYPES = ("gen_relationships", "gen_factions")


class GeneratedBoard(BaseModel):
    project_path: str
    board_id: str


def _names(cursor, table: str, ids) -> dict:
    ids = list(ids)
    out = {}
    for i in range(0, len(ids), 500):
        chunk = ids[i:i + 500]
        cursor.execute(f"SELECT id, name FROM {table} WHERE COALESCE(deleted, 0) = 0 "
                       f"AND id IN ({','.join('?' * len(chunk))})", chunk)
        out.update({str(r["id"]): r["name"] for r in cursor.fetchall()})
    return out


@router.post("/api/project/boards/generated")
async def generated_board(req: GeneratedBoard):
    """The entities and the dated history a generated board draws. The client
    works out the state at the scrubbed point, so scrubbing needs no request.

    gen_relationships: characters with any relationship, and per direction
    the relationship tracker's turning points (see directed_histories).
    gen_factions: factions, their members with joined/left dates (as day
    numbers too, None when unreadable) and which faction is part of which."""
    from routes.relationships import _get_db_rel

    conn = _get_db_rel(req.project_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT board_type FROM boards WHERE id = ? AND deleted = 0", (req.board_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Board not found")
        if row["board_type"] not in GENERATED_TYPES:
            raise HTTPException(status_code=400, detail="Not a generated board")
        return generated_data(cursor, req.project_path, row["board_type"])
    finally:
        conn.close()


def generated_data(cursor, project_path: str, board_type: str) -> dict:
    """What a generated board of this type draws (see generated_board)."""
    from routes.relationships import directed_histories
    from world_calendar import load_calendar_config, world_time_to_linear_day

    if board_type == "gen_relationships":
        pairs = directed_histories(cursor, project_path)
        names = _names(cursor, "characters", {p["from"] for p in pairs} | {p["to"] for p in pairs})
        entities = [{"type": "character", "id": cid, "name": name}
                    for cid, name in sorted(names.items(), key=lambda kv: (kv[1] or "").lower())]
        return {"kind": "relationships", "entities": entities, "pairs": pairs}

    cal = load_calendar_config(cursor)
    cursor.execute("SELECT id, name, parent_group_id FROM groups WHERE deleted = 0 ORDER BY name COLLATE NOCASE")
    groups = [dict(r) for r in cursor.fetchall()]
    live = {str(g["id"]) for g in groups}
    cursor.execute("""
        SELECT gm.id, gm.group_id, gm.character_id, gm.role_title, gm.standing,
               gm.joined_date, gm.left_date, c.name AS character_name
        FROM group_memberships gm
        JOIN characters c ON c.id = gm.character_id AND c.deleted = 0
        JOIN groups g ON g.id = gm.group_id AND g.deleted = 0
        WHERE gm.deleted = 0
        ORDER BY gm.rank_order, c.name COLLATE NOCASE
    """)
    links, members = [], {}
    for m in cursor.fetchall():
        members[str(m["character_id"])] = m["character_name"]
        links.append({
            "id": m["id"], "group_id": str(m["group_id"]), "character_id": str(m["character_id"]),
            "role_title": m["role_title"] or "", "standing": m["standing"] or "",
            "joined_date": m["joined_date"], "left_date": m["left_date"],
            "joined_day": world_time_to_linear_day(m["joined_date"], cal) if m["joined_date"] else None,
            "left_day": world_time_to_linear_day(m["left_date"], cal) if m["left_date"] else None,
        })
    entities = ([{"type": "group", "id": str(g["id"]), "name": g["name"]} for g in groups]
                + [{"type": "character", "id": cid, "name": name}
                   for cid, name in sorted(members.items(), key=lambda kv: (kv[1] or "").lower())])
    parents = [{"from": str(g["id"]), "to": str(g["parent_group_id"])} for g in groups
               if g["parent_group_id"] and str(g["parent_group_id"]) in live]
    return {"kind": "factions", "entities": entities, "links": links, "parents": parents}


# ── Nodes, connections and legend: one batch endpoint ───────────

class BoardOp(BaseModel):
    op: Literal["put_node", "put_edge", "del_node", "del_edge",
                "put_type", "del_type", "put_kind", "del_kind"]
    id: str
    fields: dict[str, Any] = {}

class BoardBatch(BaseModel):
    project_path: str
    board_id: str
    ops: list[BoardOp]


def _bad(msg: str):
    raise HTTPException(status_code=400, detail=msg)


def _text(limit: int, nullable: bool = False):
    def check(v):
        if v is None and nullable:
            return None
        if not isinstance(v, str) or len(v) > limit:
            _bad(f"expected text up to {limit} characters")
        return v
    return check


def _number(lo: float, hi: float):
    def check(v):
        if not _finite(v):
            _bad("expected a number")
        return min(max(float(v), lo), hi)
    return check


def _one_of(allowed, nullable: bool = False):
    def check(v):
        if v is None and nullable:
            return None
        if v not in allowed:
            _bad(f"expected one of {', '.join(allowed)}")
        return v
    return check


def _flag(v):
    if not isinstance(v, bool):
        _bad("expected true or false")
    return 1 if v else 0


def _ref(v):
    if v is None:
        return None
    if not isinstance(v, str) or not _ID_RE.match(v):
        _bad("bad id")
    return v


def _waypoints_in(v):
    if not isinstance(v, list) or len(v) > MAX_WAYPOINTS:
        _bad("bad waypoints")
    pts = parse_waypoints(v)
    if len(pts) != len(v):
        _bad("bad waypoints")
    return json.dumps(pts)


def _props_in(v):
    if not isinstance(v, list) or len(v) > MAX_PROPS:
        _bad("bad properties")
    for p in v:
        if not (isinstance(p, list) and len(p) == 2 and all(isinstance(s, str) for s in p)
                and len(p[0]) <= 120 and len(p[1]) <= 2000):
            _bad("bad properties")
    return json.dumps(v)


_TIME_FIELDS = {
    "appears_chapter_id": _ref, "ends_chapter_id": _ref,
    "appears_world_time": _text(64, nullable=True), "ends_world_time": _text(64, nullable=True),
}

NODE_FIELDS = {
    "name": _text(200),
    "description": _text(20000),
    "shape": _one_of(SHAPES),
    "color_token": _one_of(COLOR_TOKENS),
    "entity_type": _one_of(ENTITY_TYPES, nullable=True),
    "entity_id": _ref,
    "pos_x": _number(-1e6, 1e6), "pos_y": _number(-1e6, 1e6),
    "size_x": _number(20, 4000), "size_y": _number(20, 4000),
    "z_index": _number(-1e6, 1e6),
    "kind_id": _ref, "parent_id": _ref,
    "props": _props_in,
    "appears_auto": _flag,
    **_TIME_FIELDS,
}

EDGE_FIELDS = {
    "item_start_id": _ref, "item_end_id": _ref,
    "from_side": _one_of(SIDES), "to_side": _one_of(SIDES),
    "routing": _one_of(ROUTINGS),
    "waypoints": _waypoints_in,
    "start_marker": _one_of(MARKERS), "end_marker": _one_of(MARKERS),
    "conn_type": _one_of(DASHES),
    "color_token": _one_of(COLOR_TOKENS),
    "title": _text(200),
    "label_t": _number(0, 1),
    "type_id": _ref,
    **_TIME_FIELDS,
}

TYPE_FIELDS = {
    "name": _text(80),
    "color_token": _one_of(COLOR_TOKENS),
    "conn_type": _one_of(DASHES),
    "start_marker": _one_of(MARKERS), "end_marker": _one_of(MARKERS),
    "sort_order": _number(-1e6, 1e6),
}

KIND_FIELDS = {
    "name": _text(80),
    "shape": _one_of(SHAPES),
    "color_token": _one_of(COLOR_TOKENS),
    "sort_order": _number(-1e6, 1e6),
}

NODE_DEFAULTS = {"name": "", "description": "", "shape": "card", "color_token": "neutral",
                 "pos_x": 0.0, "pos_y": 0.0, "size_x": 160.0, "size_y": 64.0}
EDGE_DEFAULTS = {"from_side": "auto", "to_side": "auto", "routing": "straight", "waypoints": "[]",
                 "start_marker": "none", "end_marker": "arrow", "conn_type": "solid",
                 "color_token": "neutral", "title": "", "label_t": 0.5}
TYPE_DEFAULTS = {"color_token": "neutral", "conn_type": "solid", "start_marker": "none",
                 "end_marker": "arrow", "sort_order": 0}
KIND_DEFAULTS = {"shape": "card", "color_token": "neutral", "sort_order": 0}


def _clean_fields(fields: dict, spec: dict) -> dict:
    out = {}
    for key, value in fields.items():
        if key not in spec:
            _bad(f"unknown field {key}")
        out[key] = spec[key](value)
    return out


def _with_legacy_node(f: dict) -> dict:
    """Keep the columns older builds read in step with the new ones."""
    if "color_token" in f:
        f["color"] = TOKEN_HEX[f["color_token"]]
    if "shape" in f:
        f["item_type"] = _legacy_item_type(f["shape"])
    if "z_index" in f:
        f["z_index"] = int(f["z_index"])
    return f


def _with_legacy_edge(f: dict) -> dict:
    if "color_token" in f:
        f["conn_color"] = TOKEN_HEX[f["color_token"]]
    if "end_marker" in f:
        f["directed"] = 0 if f["end_marker"] == "none" else 1
    if "waypoints" in f:
        # The bend now lives in waypoints; older builds draw a straight line.
        f["curve_offset"] = 0.0
    return f


def _live_row(cursor, table: str, row_id: str):
    cursor.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,))
    row = cursor.fetchone()
    return dict(row) if row else None


def _put(cursor, table: str, board_id: str, row_id: str, fields: dict, defaults: dict) -> None:
    from sync_core import log_change
    existing = _live_row(cursor, table, row_id)
    if existing and str(existing["board_id"]) != board_id:
        _bad("row belongs to another board")
    if existing is None:
        row = {**defaults, **fields, "board_id": board_id}
        cols = ["id", *row.keys()]
        cursor.execute(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                       [row_id, *row.values()])
        log_change(cursor, table, row_id, row)
        return
    if existing.get("deleted"):
        # Putting a deleted row back (undo of a delete) revives it.
        fields = {**fields, "deleted": 0, "deleted_at": None}
    changes = {k: v for k, v in fields.items() if existing.get(k) != v}
    if not changes:
        return
    cursor.execute(f"UPDATE {table} SET {', '.join(f'{k} = ?' for k in changes)} WHERE id = ?",
                   [*changes.values(), row_id])
    log_change(cursor, table, row_id, changes)


def _soft_delete(cursor, table: str, board_id: str, row_id: str) -> None:
    from sync_core import log_soft_delete
    row = _live_row(cursor, table, row_id)
    if not row or row.get("deleted") or str(row["board_id"]) != board_id:
        return
    cursor.execute(f"UPDATE {table} SET deleted = 1, deleted_at = ? WHERE id = ?", (_now(), row_id))
    log_soft_delete(cursor, table, row_id)


def _alive(cursor, table: str, board_id: str, row_id) -> bool:
    cursor.execute(f"SELECT 1 FROM {table} WHERE id = ? AND board_id = ? AND deleted = 0", (row_id, board_id))
    return cursor.fetchone() is not None


def _put_legend(cursor, table: str, board_id: str, row_id: str, fields: dict, defaults: dict) -> None:
    if "sort_order" in fields:
        fields["sort_order"] = int(fields["sort_order"])
    if "name" in fields:
        fields["name"] = fields["name"].strip()
        if not fields["name"]:
            _bad("a legend entry needs a name")
    elif _live_row(cursor, table, row_id) is None:
        _bad("a legend entry needs a name")
    _put(cursor, table, board_id, row_id, fields, defaults)


@router.post("/api/project/boards/batch")
async def board_batch(req: BoardBatch):
    """Applies node, connection and legend changes in order, all or nothing.
    put_*: create the row, or update the given fields (and revive it if it was
    deleted). del_node also deletes the node's connections. A connection's
    type and a node's kind must be live legend entries of the same board, so
    the client sends legend puts first and legend deletes last."""
    if len(req.ops) > MAX_OPS:
        _bad("too many changes in one batch")
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM boards WHERE id = ? AND deleted = 0", (req.board_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Board not found")
        for op in req.ops:
            _ref(op.id)
            if op.op == "put_node":
                f = _clean_fields(op.fields, NODE_FIELDS)
                if ("entity_id" in f) != ("entity_type" in f) or (f.get("entity_id") is None) != (f.get("entity_type") is None):
                    _bad("entity_id and entity_type go together")
                if f.get("kind_id") is not None and not _alive(cursor, "board_node_kinds", req.board_id, f["kind_id"]):
                    _bad("node kind is not on this board")
                _put(cursor, "board_items", req.board_id, op.id, _with_legacy_node(f),
                     _with_legacy_node(dict(NODE_DEFAULTS)))
            elif op.op == "put_edge":
                f = _clean_fields(op.fields, EDGE_FIELDS)
                existing = _live_row(cursor, "item_connections", op.id)
                if existing is None and not ("item_start_id" in f and "item_end_id" in f):
                    _bad("a new connection needs both ends")
                for end in ("item_start_id", "item_end_id"):
                    if end in f and not _alive(cursor, "board_items", req.board_id, f[end]):
                        _bad("connection end is not a node on this board")
                if f.get("type_id") is not None and not _alive(cursor, "board_edge_types", req.board_id, f["type_id"]):
                    _bad("connection type is not on this board")
                start = f.get("item_start_id", existing and existing["item_start_id"])
                if start == f.get("item_end_id", existing and existing["item_end_id"]):
                    _bad("a connection needs two different nodes")
                _put(cursor, "item_connections", req.board_id, op.id, _with_legacy_edge(f),
                     _with_legacy_edge(dict(EDGE_DEFAULTS)))
            elif op.op == "del_edge":
                _soft_delete(cursor, "item_connections", req.board_id, op.id)
            elif op.op == "put_type":
                _put_legend(cursor, "board_edge_types", req.board_id, op.id,
                            _clean_fields(op.fields, TYPE_FIELDS), dict(TYPE_DEFAULTS))
            elif op.op == "put_kind":
                _put_legend(cursor, "board_node_kinds", req.board_id, op.id,
                            _clean_fields(op.fields, KIND_FIELDS), dict(KIND_DEFAULTS))
            elif op.op == "del_type":
                _soft_delete(cursor, "board_edge_types", req.board_id, op.id)
            elif op.op == "del_kind":
                _soft_delete(cursor, "board_node_kinds", req.board_id, op.id)
            else:
                _soft_delete(cursor, "board_items", req.board_id, op.id)
                cursor.execute("SELECT id FROM item_connections WHERE (item_start_id = ? OR item_end_id = ?) "
                               "AND deleted = 0", (op.id, op.id))
                for r in cursor.fetchall():
                    _soft_delete(cursor, "item_connections", req.board_id, r["id"])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"status": "ok"}

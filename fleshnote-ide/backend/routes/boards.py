"""
FleshNote API — Sketchboards Routes
CRUD for boards (visual node graphs), board_items (nodes), and item_connections (edges).
"""

import os
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


# ── Board CRUD ──────────────────────────────────────────────────

class BoardList(BaseModel):
    project_path: str

class BoardCreate(BaseModel):
    project_path: str
    name: str = "New Board"
    board_type: str = "custom"
    icon: str = "✦"

class BoardUpdate(BaseModel):
    project_path: str
    board_id: int
    name: Optional[str] = None
    board_type: Optional[str] = None
    icon: Optional[str] = None
    zoom: Optional[float] = None
    pan_x: Optional[float] = None
    pan_y: Optional[float] = None

class BoardDelete(BaseModel):
    project_path: str
    board_id: int

class BoardLoad(BaseModel):
    project_path: str
    board_id: int


@router.post("/api/project/boards/list")
async def list_boards(req: BoardList):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM boards ORDER BY created_at")
    rows = cursor.fetchall()
    conn.close()
    return {"boards": [dict(r) for r in rows]}


@router.post("/api/project/boards/create")
async def create_board(req: BoardCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO boards (name, board_type, icon) VALUES (?, ?, ?)",
        (req.name, req.board_type, req.icon)
    )
    conn.commit()
    board_id = cursor.lastrowid
    cursor.execute("SELECT * FROM boards WHERE id = ?", (board_id,))
    board = dict(cursor.fetchone())
    conn.close()
    return {"board": board}


@router.post("/api/project/boards/update")
async def update_board(req: BoardUpdate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    fields, params = [], []
    for f in ["name", "board_type", "icon", "zoom", "pan_x", "pan_y"]:
        v = getattr(req, f)
        if v is not None:
            fields.append(f"{f} = ?")
            params.append(v)
    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    fields.append("updated_at = datetime('now')")
    params.append(req.board_id)
    cursor.execute(f"UPDATE boards SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    cursor.execute("SELECT * FROM boards WHERE id = ?", (req.board_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"board": dict(row)}


@router.post("/api/project/boards/delete")
async def delete_board(req: BoardDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM boards WHERE id = ?", (req.board_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


@router.post("/api/project/boards/load")
async def load_board(req: BoardLoad):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM boards WHERE id = ?", (req.board_id,))
    board_row = cursor.fetchone()
    if not board_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Board not found")
    cursor.execute("SELECT * FROM board_items WHERE board_id = ?", (req.board_id,))
    items = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM item_connections WHERE board_id = ?", (req.board_id,))
    connections = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"board": dict(board_row), "items": items, "connections": connections}


# ── Board Item CRUD ─────────────────────────────────────────────

class ItemCreate(BaseModel):
    project_path: str
    board_id: int
    name: str
    item_type: str = "concept"
    entity_id: Optional[int] = None
    entity_type: Optional[str] = None
    description: str = ""
    pos_x: float = 0
    pos_y: float = 0
    size_x: float = 140
    size_y: float = 60
    color: str = "#888888"

class ItemUpdate(BaseModel):
    project_path: str
    item_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    size_x: Optional[float] = None
    size_y: Optional[float] = None
    color: Optional[str] = None

class ItemDelete(BaseModel):
    project_path: str
    item_id: int


@router.post("/api/project/boards/items/create")
async def create_item(req: ItemCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO board_items
            (board_id, name, item_type, entity_id, entity_type, description, pos_x, pos_y, size_x, size_y, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (req.board_id, req.name, req.item_type, req.entity_id, req.entity_type,
          req.description, req.pos_x, req.pos_y, req.size_x, req.size_y, req.color))
    conn.commit()
    item_id = cursor.lastrowid
    cursor.execute("SELECT * FROM board_items WHERE id = ?", (item_id,))
    item = dict(cursor.fetchone())
    conn.close()
    return {"item": item}


@router.post("/api/project/boards/items/update")
async def update_item(req: ItemUpdate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    fields, params = [], []
    for f in ["name", "description", "pos_x", "pos_y", "size_x", "size_y", "color"]:
        v = getattr(req, f)
        if v is not None:
            fields.append(f"{f} = ?")
            params.append(v)
    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    params.append(req.item_id)
    cursor.execute(f"UPDATE board_items SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    cursor.execute("SELECT * FROM board_items WHERE id = ?", (req.item_id,))
    row = cursor.fetchone()
    conn.close()
    return {"item": dict(row) if row else None}


@router.post("/api/project/boards/items/delete")
async def delete_item(req: ItemDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM board_items WHERE id = ?", (req.item_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


# ── Connection CRUD ─────────────────────────────────────────────

class ConnectionCreate(BaseModel):
    project_path: str
    board_id: int
    item_start_id: int
    item_end_id: int
    conn_type: str = "solid"
    conn_color: str = "#888888"
    title: str = ""
    directed: bool = True
    curve_offset: float = 0.0

class ConnectionUpdate(BaseModel):
    project_path: str
    connection_id: int
    item_start_id: Optional[int] = None
    item_end_id: Optional[int] = None
    conn_type: Optional[str] = None
    conn_color: Optional[str] = None
    title: Optional[str] = None
    directed: Optional[bool] = None
    curve_offset: Optional[float] = None

class ConnectionDelete(BaseModel):
    project_path: str
    connection_id: int


@router.post("/api/project/boards/connections/create")
async def create_connection(req: ConnectionCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO item_connections
            (board_id, item_start_id, item_end_id, conn_type, conn_color, title, directed, curve_offset)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (req.board_id, req.item_start_id, req.item_end_id,
          req.conn_type, req.conn_color, req.title, 1 if req.directed else 0, req.curve_offset))
    conn.commit()
    conn_id = cursor.lastrowid
    cursor.execute("SELECT * FROM item_connections WHERE id = ?", (conn_id,))
    row = dict(cursor.fetchone())
    conn.close()
    return {"connection": row}


@router.post("/api/project/boards/connections/update")
async def update_connection(req: ConnectionUpdate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    fields, params = [], []
    for f in ["item_start_id", "item_end_id", "conn_type", "conn_color", "title", "curve_offset"]:
        v = getattr(req, f)
        if v is not None:
            fields.append(f"{f} = ?")
            params.append(v)
    if req.directed is not None:
        fields.append("directed = ?")
        params.append(1 if req.directed else 0)
    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")
    params.append(req.connection_id)
    cursor.execute(f"UPDATE item_connections SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()
    cursor.execute("SELECT * FROM item_connections WHERE id = ?", (req.connection_id,))
    row = cursor.fetchone()
    conn.close()
    return {"connection": dict(row) if row else None}


@router.post("/api/project/boards/connections/delete")
async def delete_connection(req: ConnectionDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM item_connections WHERE id = ?", (req.connection_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

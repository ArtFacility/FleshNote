"""
FleshNote API — Twists Routes
CRUD operations for twists (major reveals) and foreshadowing tracking.
"""

import os
import re
import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


class TwistCreate(BaseModel):
    project_path: str
    title: str
    description: str = ""
    twist_type: str = ""            # 'identity', 'motive', 'event', 'ability', 'relationship'
    reveal_chapter_id: int | None = None
    characters_who_know: list[int] = []
    notes: str = ""


class TwistUpdate(BaseModel):
    project_path: str
    twist_id: int
    title: str | None = None
    description: str | None = None
    twist_type: str | None = None
    reveal_chapter_id: int | None = None
    characters_who_know: list[int] | None = None
    status: str | None = None        # 'planned', 'hinted', 'revealed'
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
        "title": row["title"],
        "description": row["description"],
        "twist_type": row["twist_type"],
        "reveal_chapter_id": row["reveal_chapter_id"],
        "characters_who_know": json.loads(row["characters_who_know"]) if row["characters_who_know"] else [],
        "status": row["status"],
        "notes": row["notes"],
    }


@router.post("/api/project/twists")
def get_twists(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM twists ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return {"twists": [_row_to_dict(row) for row in rows]}


@router.post("/api/project/twists/planner")
def get_twists_for_planner(req: ProjectPath):
    """Batch-fetch all twists + foreshadowings for planner timeline rendering."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # All twists
    cursor.execute("SELECT * FROM twists ORDER BY id ASC")
    twist_rows = cursor.fetchall()

    # All foreshadowings
    cursor.execute("""
        SELECT f.twist_id, f.chapter_id, f.word_offset, f.selected_text,
               c.chapter_number, c.word_count
        FROM foreshadowings f
        LEFT JOIN chapters c ON c.id = f.chapter_id
        ORDER BY f.twist_id ASC, c.chapter_number ASC
    """)
    fs_rows = cursor.fetchall()

    # Chapter word counts for position calculation
    cursor.execute("SELECT id, chapter_number, word_count, target_word_count FROM chapters ORDER BY chapter_number ASC")
    ch_rows = cursor.fetchall()
    conn.close()

    # Build chapter lookup
    chapters = []
    for ch in ch_rows:
        chapters.append({
            "id": ch["id"],
            "chapter_number": ch["chapter_number"],
            "word_count": ch["word_count"] or 0,
            "target_word_count": ch["target_word_count"] or 1,
        })

    # Group foreshadowings by twist_id
    fs_by_twist = {}
    for fs in fs_rows:
        tid = fs["twist_id"]
        if tid not in fs_by_twist:
            fs_by_twist[tid] = []
        fs_by_twist[tid].append({
            "chapter_id": fs["chapter_id"],
            "chapter_number": fs["chapter_number"],
            "word_offset": fs["word_offset"],
            "chapter_word_count": fs["word_count"] or 1,
            "selected_text": fs["selected_text"],
        })

    # Build result
    twists = []
    for row in twist_rows:
        t = _row_to_dict(row)
        t["reveal_word_offset"] = row["reveal_word_offset"] if "reveal_word_offset" in row.keys() else None
        t["foreshadowings"] = fs_by_twist.get(t["id"], [])
        twists.append(t)

    return {"twists": twists, "chapters": chapters}


@router.post("/api/project/twist/create")
def create_twist(req: TwistCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO twists (title, description, twist_type, reveal_chapter_id,
                             characters_who_know, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        req.title, req.description, req.twist_type,
        req.reveal_chapter_id,
        json.dumps(req.characters_who_know) if req.characters_who_know else None,
        req.notes,
    ))

    twist_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM twists WHERE id = ?", (twist_id,))
    row = cursor.fetchone()
    conn.close()

    return {"twist": _row_to_dict(row)}


@router.post("/api/project/twist/update")
def update_twist(req: TwistUpdate):
    """Update a twist's fields. Only non-None fields are updated."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []

    for field_name in ["title", "description", "twist_type",
                       "reveal_chapter_id", "status", "notes"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)

    if req.characters_who_know is not None:
        fields.append("characters_who_know = ?")
        values.append(json.dumps(req.characters_who_know))

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(req.twist_id)

    cursor.execute(
        f"UPDATE twists SET {', '.join(fields)} WHERE id = ?",
        values
    )
    conn.commit()

    cursor.execute("SELECT * FROM twists WHERE id = ?", (req.twist_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Twist not found")

    return {"twist": _row_to_dict(row)}


class TwistDetail(BaseModel):
    project_path: str
    twist_id: int


@router.post("/api/project/twist/detail")
def get_twist_detail(req: TwistDetail):
    """Return twist + all its foreshadowings + computed stats."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM twists WHERE id = ?", (req.twist_id,))
    twist_row = cursor.fetchone()
    if not twist_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Twist not found")

    twist = _row_to_dict(twist_row)

    # Get reveal word offset
    twist["reveal_word_offset"] = twist_row["reveal_word_offset"] if "reveal_word_offset" in twist_row.keys() else None

    # Fetch all foreshadowings for this twist
    cursor.execute("""
        SELECT f.*, c.title AS chapter_title, c.chapter_number
        FROM foreshadowings f
        LEFT JOIN chapters c ON c.id = f.chapter_id
        WHERE f.twist_id = ?
        ORDER BY c.chapter_number ASC, f.word_offset ASC
    """, (req.twist_id,))
    foreshadow_rows = cursor.fetchall()

    foreshadowings = []
    for fr in foreshadow_rows:
        foreshadowings.append({
            "id": fr["id"],
            "twist_id": fr["twist_id"],
            "chapter_id": fr["chapter_id"],
            "chapter_title": fr["chapter_title"],
            "chapter_number": fr["chapter_number"],
            "word_offset": fr["word_offset"],
            "selected_text": fr["selected_text"],
        })

    # Compute global word offsets for gap analysis
    # Get all chapters ordered by number to compute cumulative word counts
    cursor.execute("SELECT id, chapter_number, word_count FROM chapters ORDER BY chapter_number ASC")
    all_chapters = cursor.fetchall()
    conn.close()

    chapter_cumulative = {}
    cum = 0
    for ch in all_chapters:
        chapter_cumulative[ch["id"]] = cum
        cum += (ch["word_count"] or 0)
    total_manuscript_words = cum

    # Compute global word position for each foreshadowing
    for fs in foreshadowings:
        base = chapter_cumulative.get(fs["chapter_id"], 0)
        fs["global_word_offset"] = base + (fs["word_offset"] or 0)

    # Compute reveal global position
    reveal_global = None
    if twist.get("reveal_chapter_id") and twist.get("reveal_word_offset") is not None:
        base = chapter_cumulative.get(twist["reveal_chapter_id"], 0)
        reveal_global = base + (twist["reveal_word_offset"] or 0)

    # Stats
    foreshadow_count = len(foreshadowings)
    first_foreshadow_global = foreshadowings[0]["global_word_offset"] if foreshadowings else None
    distance_first_to_reveal = None
    if first_foreshadow_global is not None and reveal_global is not None:
        distance_first_to_reveal = reveal_global - first_foreshadow_global

    # Gap analysis — find largest gap between consecutive markers
    all_positions = sorted([fs["global_word_offset"] for fs in foreshadowings])
    if reveal_global is not None:
        all_positions.append(reveal_global)
    all_positions.sort()

    max_gap = 0
    gaps = []
    for i in range(1, len(all_positions)):
        gap = all_positions[i] - all_positions[i - 1]
        gaps.append(gap)
        if gap > max_gap:
            max_gap = gap

    # Warnings
    warnings = []
    if foreshadow_count == 0 and reveal_global is not None:
        warnings.append({"type": "danger", "key": "unforeshadowed",
                         "message": "This twist has no foreshadowing — the reveal may feel like it comes from nowhere."})
    if foreshadow_count <= 2 and distance_first_to_reveal and distance_first_to_reveal > 5000:
        warnings.append({"type": "warning", "key": "sparse",
                         "message": f"Only {foreshadow_count} foreshadow(s) across {distance_first_to_reveal:,} words — readers may forget the setup."})
    if foreshadow_count >= 2:
        spread = all_positions[-1] - all_positions[0] if len(all_positions) >= 2 else 0
        if spread < 500 and spread > 0:
            warnings.append({"type": "warning", "key": "clustered",
                             "message": "All markers are within 500 words — consider spreading foreshadowing further apart."})
    if max_gap > 5000:
        warnings.append({"type": "info", "key": "desert_gap",
                         "message": f"Largest gap between markers: {max_gap:,} words — a long silence which may lose reader attention."})

    return {
        "twist": twist,
        "foreshadowings": foreshadowings,
        "stats": {
            "foreshadow_count": foreshadow_count,
            "distance_first_to_reveal": distance_first_to_reveal,
            "reveal_global_offset": reveal_global,
            "max_gap": max_gap,
            "total_manuscript_words": total_manuscript_words,
        },
        "warnings": warnings,
    }


class TwistDelete(BaseModel):
    project_path: str
    twist_id: int


@router.post("/api/project/twist/delete")
def delete_twist(req: TwistDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Strip all {{twist:ID|...}} and {{foreshadow:ID|...}} markers from chapter files
    cursor.execute("SELECT id, md_filename FROM chapters")
    chapters = cursor.fetchall()
    tid = str(req.twist_id)
    pattern = re.compile(r'\{\{(?:twist|foreshadow):' + tid + r'\|([^}]+)\}\}')
    for ch in chapters:
        md_path = os.path.join(req.project_path, "md", ch["md_filename"])
        if not os.path.exists(md_path):
            continue
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()
        new_content = pattern.sub(r'\1', content)
        if new_content != content:
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(new_content)

    cursor.execute("DELETE FROM foreshadowings WHERE twist_id = ?", (req.twist_id,))
    cursor.execute("DELETE FROM twists WHERE id = ?", (req.twist_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


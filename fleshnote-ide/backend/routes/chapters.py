"""
FleshNote API — Chapter Routes
CRUD operations for chapters: list, create, load content, save content.
"""

import os
import sqlite3
import re
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from routes.imports import _plain_text_to_html

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


class ChapterCreate(BaseModel):
    project_path: str
    title: str = ""
    chapter_number: int | None = None
    pov_character_id: int | None = None
    target_word_count: int = 4000
    status: str = "planned"


class ChapterLoad(BaseModel):
    project_path: str
    chapter_id: int


class ChapterSave(BaseModel):
    project_path: str
    chapter_id: int
    content: str
    word_count: int = 0


class ChapterUpdate(BaseModel):
    project_path: str
    chapter_id: int
    pov_character_id: int | None = None
    status: str | None = None
    title: str | None = None
    world_time: str | None = None
    target_word_count: int | None = None


class BulkChapterCreate(BaseModel):
    project_path: str
    count: int
    pov_character_id: int | None = None
    target_word_count: int = 4000


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


# ── Entity Link Serialization ────────────────────────────────────────────────
# Markdown format: {{char:5|Sophia}} {{loc:2|the Academy}} {{item:3|the Compass}}
# TipTap HTML:     <span data-entity-type="character" data-entity-id="5" class="entity-link character">Sophia</span>

_ENTITY_TYPE_TO_SHORT = {
    "character": "char",
    "location": "loc",
    "lore": "item",
    "group": "group",
    "quicknote": "quicknote",
}

_SHORT_TO_ENTITY_TYPE = {v: k for k, v in _ENTITY_TYPE_TO_SHORT.items()}


def _entity_md_to_html(content: str) -> str:
    """Convert {{type:id|text}} markers to TipTap entity-link spans during chapter load."""
    pattern = r'\{\{(char|loc|item|lore|group|quicknote):(\d+)\|([^}]+)\}\}'

    def replacer(match):
        short_type = match.group(1)
        entity_id = match.group(2)
        text = match.group(3)
        full_type = _SHORT_TO_ENTITY_TYPE.get(short_type, short_type)
        return (
            f'<span data-entity-type="{full_type}" data-entity-id="{entity_id}" '
            f'class="entity-link {full_type}">{text}</span>'
        )

    return re.sub(pattern, replacer, content)


def _entity_html_to_md(content: str) -> str:
    """Convert TipTap entity-link spans to {{type:id|text}} markers during chapter save."""
    pattern = r'<span[^>]*?data-entity-type="([^"]+)"[^>]*?data-entity-id="(\d+)"[^>]*?>([^<]+)</span>'

    def replacer(match):
        full_type = match.group(1)
        entity_id = match.group(2)
        text = match.group(3)
        short_type = _ENTITY_TYPE_TO_SHORT.get(full_type, full_type)
        return f'{{{{{short_type}:{entity_id}|{text}}}}}'

    return re.sub(pattern, replacer, content)


def _update_entity_appearances(cursor, chapter_id: int, md_content: str):
    """Scan markdown content for entity links and update the entity_appearances table."""
    cursor.execute("DELETE FROM entity_appearances WHERE chapter_id = ?", (chapter_id,))

    pattern = r'\{\{(char|loc|item|lore|group|quicknote):(\d+)\|[^}]+\}\}'
    seen = set()
    for match in re.finditer(pattern, md_content):
        short_type = match.group(1)
        entity_id = int(match.group(2))
        entity_type = _SHORT_TO_ENTITY_TYPE.get(short_type, short_type)
        key = (entity_type, entity_id)
        if key not in seen:
            seen.add(key)
            cursor.execute("""
                INSERT OR IGNORE INTO entity_appearances
                    (entity_type, entity_id, chapter_id, first_mention_offset)
                VALUES (?, ?, ?, ?)
            """, (entity_type, entity_id, chapter_id, match.start()))


def _slugify(text: str) -> str:
    """Convert text to a filename-safe slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '_', text)
    return text[:50]


@router.post("/api/project/chapters")
def get_chapters(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.*, ch.name as pov_name
        FROM chapters c
        LEFT JOIN characters ch ON c.pov_character_id = ch.id
        ORDER BY c.chapter_number ASC
    """)
    rows = cursor.fetchall()
    conn.close()

    chapters = []
    for row in rows:
        chapters.append({
            "id": row["id"],
            "chapter_number": row["chapter_number"],
            "title": row["title"],
            "status": row["status"],
            "pov_character_id": row["pov_character_id"],
            "pov_name": row["pov_name"],
            "world_time": row["world_time"],
            "narrative_time": row["narrative_time"],
            "word_count": row["word_count"],
            "target_word_count": row["target_word_count"],
            "md_filename": row["md_filename"],
            "synopsis": row["synopsis"],
            "notes": row["notes"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        })

    return {"chapters": chapters}


@router.post("/api/project/chapter/create")
def create_chapter(req: ChapterCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Auto-determine chapter number if not provided
    if req.chapter_number is None:
        cursor.execute("SELECT COALESCE(MAX(chapter_number), 0) + 1 FROM chapters")
        req.chapter_number = cursor.fetchone()[0]

    # Generate md filename
    title_slug = _slugify(req.title) if req.title else "untitled"
    md_filename = f"ch_{req.chapter_number:03d}_{title_slug}_{uuid.uuid4().hex[:8]}.md"

    cursor.execute("""
        INSERT INTO chapters (chapter_number, title, status, pov_character_id,
                              target_word_count, md_filename, word_count)
        VALUES (?, ?, ?, ?, ?, ?, 0)
    """, (req.chapter_number, req.title or f"Chapter {req.chapter_number}",
          req.status, req.pov_character_id, req.target_word_count, md_filename))

    chapter_id = cursor.lastrowid
    conn.commit()

    # Create the empty md file
    md_dir = os.path.join(req.project_path, "md")
    os.makedirs(md_dir, exist_ok=True)
    md_path = os.path.join(md_dir, md_filename)
    if not os.path.exists(md_path):
        with open(md_path, "w", encoding="utf-8") as f:
            f.write("")

    # Fetch the created chapter
    cursor.execute("""
        SELECT c.*, ch.name as pov_name
        FROM chapters c
        LEFT JOIN characters ch ON c.pov_character_id = ch.id
        WHERE c.id = ?
    """, (chapter_id,))
    row = cursor.fetchone()
    conn.close()

    return {
        "chapter": {
            "id": row["id"],
            "chapter_number": row["chapter_number"],
            "title": row["title"],
            "status": row["status"],
            "pov_character_id": row["pov_character_id"],
            "pov_name": row["pov_name"],
            "word_count": row["word_count"],
            "target_word_count": row["target_word_count"],
            "md_filename": row["md_filename"],
        }
    }


@router.post("/api/project/chapter/update")
def update_chapter(req: ChapterUpdate):
    """Update chapter metadata: POV, status, title, world_time."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    updates = []
    params = []

    # Only include fields that were explicitly sent
    if req.pov_character_id is not None:
        # Allow unsetting POV with 0
        updates.append("pov_character_id = ?")
        params.append(req.pov_character_id if req.pov_character_id != 0 else None)
    if req.status is not None:
        updates.append("status = ?")
        params.append(req.status)
    if req.title is not None:
        updates.append("title = ?")
        params.append(req.title)
    if req.world_time is not None:
        updates.append("world_time = ?")
        params.append(req.world_time)
    if req.target_word_count is not None:
        updates.append("target_word_count = ?")
        params.append(req.target_word_count)

    if not updates:
        conn.close()
        return {"status": "no changes"}

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(req.chapter_id)

    cursor.execute(
        f"UPDATE chapters SET {', '.join(updates)} WHERE id = ?", params
    )
    conn.commit()

    # Re-fetch with POV name
    cursor.execute("""
        SELECT c.*, ch.name as pov_name
        FROM chapters c
        LEFT JOIN characters ch ON c.pov_character_id = ch.id
        WHERE c.id = ?
    """, (req.chapter_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Chapter not found")

    return {
        "chapter": {
            "id": row["id"],
            "chapter_number": row["chapter_number"],
            "title": row["title"],
            "status": row["status"],
            "pov_character_id": row["pov_character_id"],
            "pov_name": row["pov_name"],
            "word_count": row["word_count"],
            "target_word_count": row["target_word_count"],
            "md_filename": row["md_filename"],
            "world_time": row["world_time"],
        }
    }


@router.post("/api/project/chapters/bulk-create")
def bulk_create_chapters(req: BulkChapterCreate):
    """Create multiple chapters at once (used by story scope wizard)."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("SELECT COALESCE(MAX(chapter_number), 0) FROM chapters")
    start_num = cursor.fetchone()[0] + 1

    md_dir = os.path.join(req.project_path, "md")
    os.makedirs(md_dir, exist_ok=True)

    created = []
    for i in range(req.count):
        num = start_num + i
        title = f"Chapter {num}"
        md_filename = f"ch_{num:03d}_untitled_{uuid.uuid4().hex[:8]}.md"
        status = "writing" if i == 0 else "planned"
        pov_id = req.pov_character_id if i == 0 else None

        cursor.execute("""
            INSERT INTO chapters (chapter_number, title, status, pov_character_id,
                                  target_word_count, md_filename, word_count)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        """, (num, title, status, pov_id, req.target_word_count, md_filename))

        # Create empty md file
        md_path = os.path.join(md_dir, md_filename)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write("")

        created.append({
            "id": cursor.lastrowid,
            "chapter_number": num,
            "title": title,
            "status": status,
            "md_filename": md_filename,
        })

    conn.commit()
    conn.close()
    return {"chapters": created}


@router.post("/api/project/chapter/load")
def load_chapter_content(req: ChapterLoad):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT md_filename FROM chapters WHERE id = ?", (req.chapter_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Chapter not found")

    md_path = os.path.join(req.project_path, "md", row["md_filename"])
    content = ""
    if os.path.exists(md_path):
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()

    # Safety net: if content is plain text (no HTML tags), convert to <p> tags
    # so TipTap renders line breaks correctly
    content = _plain_text_to_html(content)

    # Convert entity markers {{char:5|Name}} to TipTap HTML spans
    content = _entity_md_to_html(content)

    return {"content": content, "md_filename": row["md_filename"]}


@router.post("/api/project/chapter/save")
def save_chapter_content(req: ChapterSave):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT md_filename FROM chapters WHERE id = ?", (req.chapter_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Convert entity-link HTML spans to markdown markers before writing
    md_content = _entity_html_to_md(req.content)

    # Write the md file
    md_path = os.path.join(req.project_path, "md", row["md_filename"])
    os.makedirs(os.path.dirname(md_path), exist_ok=True)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    # Track which entities appear in this chapter
    _update_entity_appearances(cursor, req.chapter_id, md_content)

    # Update word count and timestamp
    cursor.execute("""
        UPDATE chapters
        SET word_count = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (req.word_count, req.chapter_id))
    conn.commit()
    conn.close()

    return {"status": "ok"}


class ChapterDelete(BaseModel):
    project_path: str
    chapter_id: int

@router.post("/api/project/chapter/delete")
def delete_chapter(req: ChapterDelete):
    conn = _get_db(req.project_path)
    try:
        cursor = conn.cursor()
        
        # 1. Look up the chapter to get its number and filename
        cursor.execute("SELECT chapter_number, md_filename FROM chapters WHERE id = ?", (req.chapter_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Chapter not found")
            
        chap_num = row["chapter_number"]
        md_filename = row["md_filename"]
        
        # 2. Delete the file from disk if it exists
        if md_filename:
            md_path = os.path.join(req.project_path, "md", md_filename)
            if os.path.exists(md_path):
                try:
                    os.remove(md_path)
                except Exception as e:
                    print(f"Warning: could not delete md file {md_path}: {e}")

        # 3. Delete from DB
        cursor.execute("DELETE FROM entity_appearances WHERE chapter_id = ?", (req.chapter_id,))
        cursor.execute("DELETE FROM chapters WHERE id = ?", (req.chapter_id,))
        
        # 4. Shift all subsequent chapters' numbering down by 1 in sequential order
        cursor.execute("SELECT id, chapter_number FROM chapters WHERE chapter_number > ? ORDER BY chapter_number ASC", (chap_num,))
        for r in cursor.fetchall():
            cursor.execute("UPDATE chapters SET chapter_number = ? WHERE id = ?", (r["chapter_number"] - 1, r["id"]))
        
        conn.commit()
        return {"status": "ok", "deleted_number": chap_num}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


class ChapterInsert(BaseModel):
    project_path: str
    anchor_chapter_id: int
    direction: str  # "above" or "below"

@router.post("/api/project/chapter/insert")
def insert_chapter(req: ChapterInsert):
    conn = _get_db(req.project_path)
    try:
        cursor = conn.cursor()
        
        cursor.execute("SELECT chapter_number FROM chapters WHERE id = ?", (req.anchor_chapter_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Anchor chapter not found")
            
        anchor_num = row["chapter_number"]
        
        # Calculate new chapter number based on direction
        new_num = anchor_num if req.direction == "above" else anchor_num + 1
        
        # Shift existing chapters up to make room, looping from highest to lowest 
        # so SQLite unique constraint check doesn't trip on overlapping numbers
        cursor.execute("SELECT id, chapter_number FROM chapters WHERE chapter_number >= ? ORDER BY chapter_number DESC", (new_num,))
        for r in cursor.fetchall():
            cursor.execute("UPDATE chapters SET chapter_number = ? WHERE id = ?", (r["chapter_number"] + 1, r["id"]))
        
        title = f"Chapter {new_num}"
        md_filename = f"ch_{new_num:03d}_untitled_{uuid.uuid4().hex[:8]}.md"
        
        # Insert new
        cursor.execute("""
            INSERT INTO chapters (chapter_number, title, status, target_word_count, md_filename, word_count)
            VALUES (?, ?, ?, ?, ?, 0)
        """, (new_num, title, "planned", 4000, md_filename))
        
        new_id = cursor.lastrowid
        conn.commit()
        
        # Create empty md file
        md_dir = os.path.join(req.project_path, "md")
        os.makedirs(md_dir, exist_ok=True)
        md_path = os.path.join(md_dir, md_filename)
        if not os.path.exists(md_path):
            with open(md_path, "w", encoding="utf-8") as f:
                f.write("")
                
        # Return full object matches previous creates
        cursor.execute("""
            SELECT c.*, ch.name as pov_name
            FROM chapters c
            LEFT JOIN characters ch ON c.pov_character_id = ch.id
            WHERE c.id = ?
        """, (new_id,))
        new_row = cursor.fetchone()
        
        return {
            "chapter": {
                "id": new_row["id"],
                "chapter_number": new_row["chapter_number"],
                "title": new_row["title"],
                "status": new_row["status"],
                "pov_character_id": new_row["pov_character_id"],
                "pov_name": new_row["pov_name"],
                "word_count": new_row["word_count"],
                "target_word_count": new_row["target_word_count"],
                "md_filename": new_row["md_filename"],
            }
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

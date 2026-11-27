"""Find and replace text across every chapter of a book."""

import hashlib
import html
import os
import re
import sqlite3

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from project_io import safe_md_path

router = APIRouter()

MAX_RESULTS = 2000
CONTEXT_CHARS = 90

_MARKER_RE = re.compile(r'\{\{[^{}|]+\|[^{}]*\}\}')
_TAG_RE = re.compile(r'<[^>]+>')
_BLOCK_TAG_RE = re.compile(r'</?(p|div|h[1-6]|li|blockquote)\b', re.IGNORECASE)
_BR_TAG_RE = re.compile(r'<br\s*/?>', re.IGNORECASE)
_ENTITY_RE = re.compile(r'&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);')


class BookSearchRequest(BaseModel):
    project_path: str
    query: str
    case_sensitive: bool = False


class BookReplaceRequest(BaseModel):
    project_path: str
    query: str
    replacement: str = ""
    case_sensitive: bool = False
    match_ids: list[str] = []


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _display_text(md: str):
    """Build the text a reader sees, with markdown offsets for every character.

    Entity/twist markers contribute only their visible label, HTML tags contribute
    nothing (block tags become a newline), so match positions line up with the
    editor's text. The offset arrays map those positions back to the markdown so a
    replacement never has to touch the surrounding markup.
    """
    chars = []
    starts = []
    ends = []
    i = 0
    n = len(md)
    while i < n:
        if md.startswith('{{', i):
            marker = _MARKER_RE.match(md, i)
            if marker:
                raw = marker.group(0)
                pipe = raw.find('|')
                label_md_start = i + pipe + 1
                label = raw[pipe + 1:-2]
                for offset, ch in enumerate(label):
                    chars.append(ch)
                    starts.append(label_md_start + offset)
                    ends.append(label_md_start + offset + 1)
                i += len(raw)
                continue
        if md[i] == '<':
            tag = _TAG_RE.match(md, i)
            if tag:
                raw = tag.group(0)
                if _BLOCK_TAG_RE.match(raw) or _BR_TAG_RE.match(raw):
                    if chars and chars[-1] != '\n':
                        chars.append('\n')
                        starts.append(i)
                        ends.append(i + len(raw))
                i += len(raw)
                continue
        if md[i] == '&':
            entity = _ENTITY_RE.match(md, i)
            if entity:
                raw = entity.group(0)
                for ch in html.unescape(raw):
                    chars.append(ch)
                    starts.append(i)
                    ends.append(i + len(raw))
                i += len(raw)
                continue
        chars.append(md[i])
        starts.append(i)
        ends.append(i + 1)
        i += 1
    return ''.join(chars), starts, ends


def _iter_chapters(project_path: str):
    """Yield (chapter row, safe md path, file content) for every live chapter."""
    conn = _get_db(project_path)
    try:
        rows = conn.execute(
            "SELECT id, chapter_number, title, md_filename FROM chapters "
            "WHERE deleted = 0 ORDER BY chapter_number ASC"
        ).fetchall()
    finally:
        conn.close()

    for row in rows:
        if not row["md_filename"]:
            continue
        path = safe_md_path(os.path.join(project_path, "md"), row["md_filename"])
        if not path or not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as f:
            yield row, path, f.read()


def _match_regex(query: str, case_sensitive: bool):
    return re.compile(re.escape(query), 0 if case_sensitive else re.IGNORECASE)


@router.post("/api/project/book/search")
def search_book(req: BookSearchRequest):
    """Search the visible prose of every chapter, with a little context either side."""
    if not req.query:
        return {"results": [], "total": 0, "truncated": False}

    results = []
    truncated = False
    regex = _match_regex(req.query, req.case_sensitive)
    for row, _, content in _iter_chapters(req.project_path):
        text, _, _ = _display_text(content)
        for match in regex.finditer(text):
            if len(results) >= MAX_RESULTS:
                truncated = True
                break
            before = text[max(0, match.start() - CONTEXT_CHARS):match.start()].replace('\n', ' ')
            after = text[match.end():match.end() + CONTEXT_CHARS].replace('\n', ' ')
            results.append({
                "id": f"{row['id']}:{match.start()}",
                "chapter_id": row["id"],
                "chapter_number": row["chapter_number"],
                "chapter_title": row["title"] or "",
                "match": text[match.start():match.end()],
                "before": before,
                "after": after,
                "word_offset": len(text[:match.start()].split()),
                "char_offset": len(text[:match.start()].replace('\n', '')),
            })
        if truncated:
            break

    return {"results": results, "total": len(results), "truncated": truncated}


@router.post("/api/project/book/replace")
def replace_book(req: BookReplaceRequest):
    """Replace matches across the book. match_ids restricts the batch; an empty
    list replaces every current match."""
    if not req.query:
        raise HTTPException(status_code=400, detail="Search term is required")

    from routes.chapters import (
        _update_entity_appearances,
        _update_foreshadowings,
        _update_knowledge_offsets,
        _update_relationship_offsets,
        _update_milestone_offsets,
    )
    from sync_core import log_change

    allowed = set(req.match_ids) if req.match_ids else None
    regex = _match_regex(req.query, req.case_sensitive)
    replaced = 0
    touched_chapters = []

    conn = _get_db(req.project_path)
    try:
        cursor = conn.cursor()
        for row, path, content in _iter_chapters(req.project_path):
            text, starts, ends = _display_text(content)
            spans = []
            for match in regex.finditer(text):
                match_id = f"{row['id']}:{match.start()}"
                if allowed is not None and match_id not in allowed:
                    continue
                spans.append((starts[match.start()], ends[match.end() - 1]))
            if not spans:
                continue

            new_content = content
            for start, end in sorted(spans, reverse=True):
                new_content = new_content[:start] + req.replacement + new_content[end:]

            replaced += len(spans)
            touched_chapters.append(row["id"])
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)

            _update_entity_appearances(cursor, row["id"], new_content)
            _update_foreshadowings(cursor, row["id"], new_content)
            _update_knowledge_offsets(cursor, row["id"], new_content)
            _update_relationship_offsets(cursor, row["id"], new_content)
            _update_milestone_offsets(cursor, row["id"], new_content)

            new_text, _, _ = _display_text(new_content)
            word_count = len(new_text.split())
            cursor.execute(
                "UPDATE chapters SET word_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (word_count, row["id"]),
            )
            prose_hash = hashlib.sha256(new_content.encode("utf-8")).hexdigest()
            log_change(cursor, "chapters", row["id"], {
                "word_count": word_count,
                "prose_hash": prose_hash,
            })
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return {"status": "ok", "replaced": replaced, "chapters": touched_chapters}

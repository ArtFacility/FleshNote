"""
FleshNote API — Chapter History (prose rollback / "Edit History")

Pentimento ops are deltas with no anchor text and can't reconstruct past prose, and the
change_log stores only prose *hashes*. So rollback stores real snapshots: the full
zlib-compressed markdown of a chapter at a checkpoint. Snapshots are auto-taken when a
writing session ends (see pentimento.session_end), manually "pinned", or captured just
before a restore (so a restore is itself undoable).

Endpoints:
  history/list     — snapshot timeline for one chapter (no blobs)
  history/preview  — decompress one snapshot → editor HTML (for read-only preview + diff)
  history/pin      — manual snapshot of the current state
  history/restore  — write a snapshot back to disk, return editor HTML (with safety copy)
  history/storage  — snapshot count + bytes for the settings UI
  history/prune    — keep the newest N per chapter (never deletes manual pins)
  history/clear    — wipe snapshots for a chapter or the whole project
"""

import os
import zlib
import uuid
import hashlib
import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from sync_core import DEVICE_ID, log_change
from routes.chapters import (
    _get_db,
    _entity_md_to_html, _twist_md_to_html, _knowledge_md_to_html,
    _relationship_md_to_html, _time_md_to_html, _plain_text_to_html,
    _update_entity_appearances, _update_foreshadowings,
    _update_knowledge_offsets, _update_relationship_offsets,
)

router = APIRouter()


# ── Models ──────────────────────────────────────────────────────────────────

class ChapterScoped(BaseModel):
    project_path: str
    chapter_id: str


class SnapshotScoped(BaseModel):
    project_path: str
    snapshot_id: str


class PinRequest(BaseModel):
    project_path: str
    chapter_id: str
    label: Optional[str] = None


class ProjectScoped(BaseModel):
    project_path: str


class PruneRequest(BaseModel):
    project_path: str
    keep_per_chapter: int = 20
    older_than_days: Optional[int] = None


class ClearRequest(BaseModel):
    project_path: str
    chapter_id: Optional[str] = None   # None → whole project


# ── Helpers ─────────────────────────────────────────────────────────────────

def _md_to_html(cursor, md: str) -> str:
    """Rebuild editor HTML from stored markdown — same pipeline as chapter/load."""
    quicknote_types = {}
    try:
        cursor.execute("SELECT id, note_type FROM quick_notes WHERE deleted = 0")
        for qn in cursor.fetchall():
            quicknote_types[str(qn["id"])] = qn["note_type"] or "Note"
    except Exception:
        pass
    content = _plain_text_to_html(md)
    content = _entity_md_to_html(content, quicknote_types)
    content = _twist_md_to_html(content)
    content = _knowledge_md_to_html(content)
    content = _relationship_md_to_html(content)
    content = _time_md_to_html(content)
    return content


def _read_chapter_md(project_path: str, md_filename: Optional[str]) -> str:
    if not md_filename:
        return ""
    md_path = os.path.join(project_path, "md", md_filename)
    if os.path.exists(md_path):
        with open(md_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def _create_snapshot(cursor, project_path: str, chapter_id: str, kind: str,
                     label: Optional[str] = None, session_id: Optional[str] = None,
                     session_hash: Optional[str] = None) -> Optional[str]:
    """Snapshot the chapter's current on-disk markdown. Returns snapshot id, or None if
    skipped (unchanged content for a non-manual snapshot, or missing chapter)."""
    cursor.execute(
        "SELECT md_filename, word_count FROM chapters WHERE id=? AND deleted=0", (chapter_id,))
    row = cursor.fetchone()
    if not row:
        return None

    md = _read_chapter_md(project_path, row["md_filename"])
    prose_hash = hashlib.sha256(md.encode("utf-8")).hexdigest()

    # Dedup only auto session snapshots that match the most recent one, so idle sessions
    # don't pile up dupes. Manual pins (writer asked) and pre_restore safety copies (must
    # give Undo a deterministic target) are always kept.
    if kind == "session":
        cursor.execute(
            "SELECT prose_hash FROM chapter_snapshots WHERE chapter_id=? "
            "ORDER BY created_at DESC, rowid DESC LIMIT 1", (chapter_id,))
        last = cursor.fetchone()
        if last and last["prose_hash"] == prose_hash:
            return None

    gz = zlib.compress(md.encode("utf-8"))
    snap_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO chapter_snapshots "
        "(id, chapter_id, created_at, kind, label, word_count, prose_hash, content_gz, "
        " byte_size, session_id, session_hash, device_id) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (snap_id, str(chapter_id), datetime.datetime.now().isoformat(), kind, label,
         row["word_count"] or 0, prose_hash, gz, len(gz), session_id, session_hash, DEVICE_ID))
    return snap_id


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/api/project/chapter/history/list")
def history_list(req: ChapterScoped):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT s.id, s.created_at, s.kind, s.label, s.word_count, s.byte_size, "
        "       s.prose_hash, ps.session_num AS session_num "
        "FROM chapter_snapshots s "
        "LEFT JOIN pentimento_sessions ps ON ps.id = s.session_id "
        "WHERE s.chapter_id=? ORDER BY s.created_at DESC, s.rowid DESC", (req.chapter_id,))
    snaps = [{
        "id": r["id"], "created_at": r["created_at"], "kind": r["kind"],
        "label": r["label"], "word_count": r["word_count"] or 0,
        "byte_size": r["byte_size"] or 0, "prose_hash": r["prose_hash"],
        "session_num": r["session_num"],
    } for r in cur.fetchall()]
    conn.close()
    return {"snapshots": snaps}


@router.post("/api/project/chapter/history/preview")
def history_preview(req: SnapshotScoped):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT content_gz, word_count FROM chapter_snapshots WHERE id=?", (req.snapshot_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Snapshot not found")
    md = zlib.decompress(row["content_gz"]).decode("utf-8")
    html = _md_to_html(cur, md)
    conn.close()
    return {"content_html": html, "word_count": row["word_count"] or 0}


@router.post("/api/project/chapter/history/pin")
def history_pin(req: PinRequest):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    snap_id = _create_snapshot(cur, req.project_path, req.chapter_id, "manual", label=req.label)
    conn.commit()
    conn.close()
    return {"status": "ok", "snapshot_id": snap_id}


@router.post("/api/project/chapter/history/restore")
def history_restore(req: SnapshotScoped):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT chapter_id, content_gz, word_count, prose_hash "
        "FROM chapter_snapshots WHERE id=?", (req.snapshot_id,))
    snap = cur.fetchone()
    if not snap:
        conn.close()
        raise HTTPException(status_code=404, detail="Snapshot not found")

    chapter_id = snap["chapter_id"]
    md = zlib.decompress(snap["content_gz"]).decode("utf-8")
    word_count = snap["word_count"] or 0
    prose_hash = snap["prose_hash"]

    cur.execute("SELECT md_filename FROM chapters WHERE id=? AND deleted=0", (chapter_id,))
    chap = cur.fetchone()
    if not chap or not chap["md_filename"]:
        conn.close()
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Safety snapshot of the CURRENT state so this restore can itself be undone.
    _create_snapshot(cur, req.project_path, chapter_id, "pre_restore")

    # Write the snapshot markdown back to disk.
    md_path = os.path.join(req.project_path, "md", chap["md_filename"])
    os.makedirs(os.path.dirname(md_path), exist_ok=True)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md)

    # Re-run the same trackers chapter/save uses so appearances/foreshadowings/knowledge
    # offsets match the restored prose.
    _update_entity_appearances(cur, chapter_id, md)
    _update_foreshadowings(cur, chapter_id, md)
    _update_knowledge_offsets(cur, chapter_id, md)
    _update_relationship_offsets(cur, chapter_id, md)

    cur.execute(
        "UPDATE chapters SET word_count=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (word_count, chapter_id))

    # Log the restored hash so sync's prose-hash ancestry recognises this state.
    log_change(cur, "chapters", chapter_id, {"word_count": word_count, "prose_hash": prose_hash})

    conn.commit()
    html = _md_to_html(cur, md)
    conn.close()
    return {"status": "ok", "chapter_id": chapter_id,
            "content_html": html, "word_count": word_count}


@router.post("/api/project/chapter/history/storage")
def history_storage(req: ProjectScoped):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS c, COALESCE(SUM(byte_size),0) AS b FROM chapter_snapshots")
    row = cur.fetchone()
    conn.close()
    b = row["b"] or 0
    return {"snapshot_count": row["c"] or 0, "estimated_bytes": b,
            "estimated_mb": round(b / (1024 * 1024), 2)}


@router.post("/api/project/chapter/history/prune")
def history_prune(req: PruneRequest):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT chapter_id FROM chapter_snapshots")
    chapter_ids = [r["chapter_id"] for r in cur.fetchall()]
    removed = 0
    keep = max(1, req.keep_per_chapter)
    for cid in chapter_ids:
        # Never prune manual pins; keep the newest `keep` of the rest.
        cur.execute(
            "SELECT id FROM chapter_snapshots WHERE chapter_id=? AND kind!='manual' "
            "ORDER BY created_at DESC, rowid DESC", (cid,))
        ids = [r["id"] for r in cur.fetchall()]
        for sid in ids[keep:]:
            cur.execute("DELETE FROM chapter_snapshots WHERE id=?", (sid,))
            removed += 1
    conn.commit()
    conn.close()
    return {"status": "ok", "removed": removed}


@router.post("/api/project/chapter/history/clear")
def history_clear(req: ClearRequest):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    if req.chapter_id:
        cur.execute("DELETE FROM chapter_snapshots WHERE chapter_id=?", (req.chapter_id,))
    else:
        cur.execute("DELETE FROM chapter_snapshots")
    conn.commit()
    conn.close()
    return {"status": "ok"}

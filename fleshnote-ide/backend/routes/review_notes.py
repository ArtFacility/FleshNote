"""Reviews handed back by beta readers, imported into the author's project.

A returned .flreview file carries the reviewer's notes, each anchored to a
quote of the manuscript as it was when the file was exported. Importing finds
every quote again in the chapter's current text (the author has usually kept
writing), stores the notes in `review_notes` and the per-chapter scores in
`received_reviews`, and logs both for sync. Re-importing the same returned
file updates its notes in place and never reopens one the author already
resolved or dismissed.
"""
import html
import json
import os
import re
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from routes.review_export import (
    LABEL_MAX,
    _u16_index_of,
    _utf16_units,
    clean_notes,
    clean_scores,
    load_package,
    peek,
    plain_view,
    reanchor_quote,
    review_id_of,
)
import review_crypto as rc

router = APIRouter()

NOTE_STATUSES = {"open", "resolved", "dismissed"}
# Stable row ids: the same returned file imported twice maps onto the same rows.
_ID_NS = uuid.UUID("6f1c2f63-3c55-4b52-9a5f-1b0d2b9e7a41")
_TAG_RE = re.compile(r"<[^>]*>")


class ImportReviewsRequest(BaseModel):
    project_path: str
    package_paths: list[str]


class ProjectRequest(BaseModel):
    project_path: str


class NoteStatusRequest(BaseModel):
    project_path: str
    id: str
    status: str


class ReceivedReviewRequest(BaseModel):
    project_path: str
    id: str


class CopyRequest(BaseModel):
    project_path: str
    id: str


def _connect(project_path: str):
    from routes.janitor import _get_db
    from db_setup import ensure_review_tables
    try:
        conn = _get_db(project_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Database not found")
    ensure_review_tables(conn.cursor())
    return conn


def editor_plain_text(content: str) -> str:
    """The text the editor shows for a chapter file (or a slice of one), with
    no separators between paragraphs: the same string the editor gets by
    joining its text nodes, so offsets found here point at the right place."""
    from routes.chapters import md_to_editor_html
    rendered = md_to_editor_html(content or "").replace("\r", "")
    # line breaks between blocks are layout; inside a paragraph they read as a space
    rendered = re.sub(r">\s*\n\s*<", "><", rendered).replace("\n", " ")
    return html.unescape(_TAG_RE.sub("", rendered))


def _project_id(project_path: str) -> str:
    from routes.review_export import _project_meta
    return _project_meta(project_path)[0]


def _chapter_texts(project_path: str, conn) -> dict:
    from routes.review_export import _read_md
    out = {}
    for row in conn.execute("SELECT id, md_filename FROM chapters WHERE deleted = 0"):
        out[str(row["id"])] = editor_plain_text(_read_md(project_path, row["md_filename"]))
    return out


def _find_quote(text: str, quote: str, near: float):
    """Where a reviewer's quote sits in the chapter now: the exact occurrence
    closest to where it used to be (`near`, as a fraction of the chapter),
    else the best fuzzy match. Offsets are UTF-16 units, as in the editor."""
    t, q = _utf16_units(text), _utf16_units(quote)
    if not q:
        return None
    best, pos = None, 0
    while True:
        i = _u16_index_of(t[pos:], q)
        if i < 0:
            break
        i += pos
        if best is None or abs(i - near * len(t)) < abs(best - near * len(t)):
            best = i
        pos = i + 1
    if best is not None:
        return best, best + len(q)
    hit = reanchor_quote(text, quote)
    return (hit["start"], hit["end"]) if hit else None


def _u16_slice(text: str, start: int, end: int) -> str:
    raw = text.encode("utf-16-le")
    return raw[start * 2:end * 2].decode("utf-16-le", errors="ignore")


def _copy_key(pkg: dict, path: str) -> str:
    """One reviewer's copy of one review round. Copies made by this version
    carry their own id; older files fall back to the reviewer's name and notes."""
    if pkg.get("copy_id"):
        return "copy:%s" % str(pkg["copy_id"])[:64]
    first = next((n.get("id") for n in pkg.get("notes") or [] if isinstance(n, dict)), "")
    return "legacy:%s|%s|%s" % (review_id_of(pkg), pkg.get("reviewer_label") or os.path.basename(path), first)


def import_package(conn, project_path: str, path: str, chapters: dict) -> dict:
    from sync_core import log_change, _now_iso

    raw = load_package(path)
    info = peek(raw)
    live_project = _project_id(project_path)
    if info["desktop_id"] and live_project and info["desktop_id"] != live_project:
        return {"path": path, "status": "error", "error": "wrong_project", "title": info["title"]}
    if rc.is_sealed(raw):
        # a locked copy: this project kept the server's half when it was sent,
        # so it opens here even after it stopped opening for the reviewer
        crypto = raw.get("crypto") or {}
        row = conn.execute("SELECT server_half FROM review_copies WHERE key_id = ? AND server_half IS NOT NULL",
                           (str(crypto.get("key_id") or ""),)).fetchone()
        if not row:
            return {"path": path, "status": "error", "error": "missing_key", "title": info["title"]}
        try:
            key = rc.derive_key(rc.unb64(crypto.get("file_half", "")), rc.unb64(row["server_half"]), crypto["key_id"])
            pkg = plain_view(raw, key)
        except (ValueError, KeyError):
            return {"path": path, "status": "error", "error": "unreadable", "title": info["title"]}
    else:
        pkg = raw
    snap = pkg.get("snapshot") or {}

    now = _now_iso()
    key = _copy_key(pkg, path)
    review_row_id = str(uuid.uuid5(_ID_NS, "review|" + key))
    label = str(pkg.get("reviewer_label") or "").strip()[:LABEL_MAX]
    scores = json.dumps(clean_scores(pkg.get("scores")), ensure_ascii=False)
    cur = conn.cursor()

    review_values = {
        "review_id": review_id_of(pkg),
        "reviewer_label": label,
        "finished_at": str(pkg.get("finished_at") or "")[:40],
        "imported_at": now,
        "scores": scores,
        "updated_at": now,
        "deleted": 0,
    }
    exists = cur.execute("SELECT 1 FROM received_reviews WHERE id = ?", (review_row_id,)).fetchone()
    if exists:
        cur.execute("UPDATE received_reviews SET review_id=?, reviewer_label=?, finished_at=?, imported_at=?, "
                    "scores=?, updated_at=?, deleted=?, deleted_at=NULL WHERE id=?",
                    (*review_values.values(), review_row_id))
    else:
        cur.execute("INSERT INTO received_reviews (id, review_id, reviewer_label, finished_at, imported_at, "
                    "scores, updated_at, deleted) VALUES (?,?,?,?,?,?,?,?)",
                    (review_row_id, *review_values.values()))
    log_change(cur, "received_reviews", review_row_id, review_values)

    sent_lengths = {str(c.get("id")): len(c.get("text_md") or "") for c in snap.get("chapters") or []
                    if isinstance(c, dict)}
    added = updated = unanchored = skipped = 0
    for n in clean_notes(pkg.get("notes")):
        text = chapters.get(n["chapter_id"])
        if text is None:
            skipped += 1  # the chapter was deleted since the file was sent
            continue
        quote = editor_plain_text(n["anchor_quote"]).strip()
        near = n["anchor_start"] / max(sent_lengths.get(n["chapter_id"], 0), 1)
        hit = _find_quote(text, quote, min(near, 1.0)) if quote else None
        values = {
            "received_review_id": review_row_id,
            "chapter_id": n["chapter_id"],
            "category": n["category"],
            "body": n["body"],
            "suggestion": n["suggestion"],
            "quote_text": quote,
            "anchor_text": _u16_slice(text, *hit) if hit else "",
            "anchor_hint": hit[0] if hit else int(near * len(_utf16_units(text))),
            "anchored": 1 if hit else 0,
            "reviewer_label": label,
            "noted_at": n["updated_at"] or n["created_at"],
            "updated_at": now,
        }
        if not hit:
            unanchored += 1
        note_id = str(uuid.uuid5(_ID_NS, "note|%s|%s" % (key, n["id"])))
        row = cur.execute("SELECT * FROM review_notes WHERE id = ?", (note_id,)).fetchone()
        if row:
            changed = {k: v for k, v in values.items() if row[k] != v and k != "updated_at"}
            if row["deleted"]:
                # the author removed this review earlier and imported it again
                changed["deleted"] = 0
            if changed:
                changed["updated_at"] = now
                sets = ", ".join("%s = ?" % k for k in changed)
                cur.execute("UPDATE review_notes SET %s WHERE id = ?" % sets, (*changed.values(), note_id))
                log_change(cur, "review_notes", note_id, changed)
                updated += 1
        else:
            values.update({"status": "open", "deleted": 0})
            cols = ", ".join(values)
            cur.execute("INSERT INTO review_notes (id, %s) VALUES (?, %s)" % (cols, ", ".join("?" * len(values))),
                        (note_id, *values.values()))
            log_change(cur, "review_notes", note_id, values)
            added += 1
    return {"path": path, "status": "ok", "id": review_row_id, "reviewer_label": label,
            "added": added, "updated": updated, "unanchored": unanchored, "skipped": skipped}


@router.post("/api/review/import")
def import_reviews(req: ImportReviewsRequest):
    conn = _connect(req.project_path)
    try:
        chapters = _chapter_texts(req.project_path, conn)
        results = []
        for path in req.package_paths:
            try:
                results.append(import_package(conn, req.project_path, path, chapters))
            except HTTPException as e:
                results.append({"path": path, "status": "error", "error": "unreadable", "message": e.detail})
            conn.commit()
        return {"status": "ok", "results": results}
    finally:
        conn.close()


@router.post("/api/review/notes")
def list_review_notes(req: ProjectRequest):
    conn = _connect(req.project_path)
    try:
        reviews = []
        for r in conn.execute("SELECT * FROM received_reviews WHERE deleted = 0 ORDER BY imported_at"):
            try:
                scores = json.loads(r["scores"] or "[]")
            except ValueError:
                scores = []
            reviews.append({"id": r["id"], "reviewer_label": r["reviewer_label"] or "",
                            "finished_at": r["finished_at"] or "", "imported_at": r["imported_at"] or "",
                            "scores": scores if isinstance(scores, list) else []})
        live = {r["id"] for r in reviews}
        notes = [dict(n) for n in conn.execute(
            "SELECT id, received_review_id, chapter_id, category, body, suggestion, quote_text, anchor_text, "
            "anchor_hint, anchored, status, reviewer_label, noted_at FROM review_notes "
            "WHERE deleted = 0 ORDER BY chapter_id, anchor_hint")
            if n["received_review_id"] in live]
        return {"status": "ok", "reviews": reviews, "notes": notes}
    finally:
        conn.close()


@router.post("/api/review/note/status")
def set_note_status(req: NoteStatusRequest):
    from sync_core import log_change, _now_iso
    if req.status not in NOTE_STATUSES:
        raise HTTPException(status_code=400, detail="Unknown status")
    conn = _connect(req.project_path)
    try:
        now = _now_iso()
        cur = conn.execute("UPDATE review_notes SET status = ?, updated_at = ? WHERE id = ? AND deleted = 0",
                           (req.status, now, req.id))
        if cur.rowcount:
            log_change(conn.cursor(), "review_notes", req.id, {"status": req.status, "updated_at": now})
        conn.commit()
        return {"status": "ok", "updated": cur.rowcount}
    finally:
        conn.close()


@router.post("/api/review/received/delete")
def delete_received_review(req: ReceivedReviewRequest):
    """Remove one reviewer's returned review and all of its notes."""
    from sync_core import log_soft_delete, _now_iso
    conn = _connect(req.project_path)
    try:
        now = _now_iso()
        cur = conn.cursor()
        ids = [r["id"] for r in cur.execute(
            "SELECT id FROM review_notes WHERE received_review_id = ? AND deleted = 0", (req.id,))]
        cur.execute("UPDATE review_notes SET deleted = 1, deleted_at = ? WHERE received_review_id = ? AND deleted = 0",
                    (now, req.id))
        for nid in ids:
            log_soft_delete(cur, "review_notes", nid)
        cur.execute("UPDATE received_reviews SET deleted = 1, deleted_at = ? WHERE id = ? AND deleted = 0",
                    (now, req.id))
        if cur.rowcount:
            log_soft_delete(cur, "received_reviews", req.id)
        conn.commit()
        return {"status": "ok"}
    finally:
        conn.close()


@router.post("/api/review/copies")
def list_review_copies(req: ProjectRequest):
    """Review copies the author sent from this project, newest first."""
    conn = _connect(req.project_path)
    try:
        rows = conn.execute(
            "SELECT id, reviewer_label, chapter_count, key_id, expires_at, revoked_at, created_at "
            "FROM review_copies WHERE deleted = 0 ORDER BY created_at DESC").fetchall()
        return {"status": "ok", "copies": [{**dict(r), "locked": bool(r["key_id"])} for r in rows]}
    finally:
        conn.close()


@router.post("/api/review/copy/revoke")
def revoke_review_copy(req: CopyRequest):
    """Make every copy of a locked review file stop opening now. The server's
    half stays here, so reviews already sent back still import."""
    from sync_core import log_change, _now_iso
    conn = _connect(req.project_path)
    try:
        row = conn.execute("SELECT * FROM review_copies WHERE id = ? AND deleted = 0", (req.id,)).fetchone()
        if not row or not row["key_id"]:
            raise HTTPException(status_code=404, detail="Not a locked review copy")
        try:
            rc.revoke_server_key(row["server"], row["key_id"], row["revoke_token"] or "")
        except rc.NotTrusted:
            return {"status": "error", "error": "untrusted_server"}
        except rc.KeyServerError as e:
            return {"status": "error", "error": "key_server_unreachable", "message": str(e)}
        now = _now_iso()
        conn.execute("UPDATE review_copies SET revoked_at = ?, updated_at = ? WHERE id = ?", (now, now, req.id))
        log_change(conn.cursor(), "review_copies", req.id, {"revoked_at": now, "updated_at": now})
        conn.commit()
        return {"status": "ok", "revoked_at": now}
    finally:
        conn.close()

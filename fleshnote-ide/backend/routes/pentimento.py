"""
FleshNote API — Pentimento Telemetry Routes

Append-only writing-process telemetry that powers the effort heatmap, the replay, and
(later) prose rollback. Ops are COALESCED runs captured in the editor — never raw
keystrokes — so a full novel's lifetime history stays in the low tens of MB.

Endpoints:
  session/start  — open/resume a chained session for a chapter
  flush          — bulk-insert a batch of coalesced ops
  session/end    — seal a session with a chain hash
  heatmap        — per-paragraph effort aggregate for one chapter (live ops + compacted)
  summary        — project-wide totals for the showcase card
  compact        — drop old ops but keep their per-paragraph aggregate (storage GC)
  clear          — wipe telemetry for a chapter or the whole project
"""

import os
import json
import hashlib
import sqlite3
import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from sync_core import DEVICE_ID

router = APIRouter()

NIGHT_START, NIGHT_END = 0, 6  # local hours counted as "after midnight"
REVISION_MIN_CHARS = 6         # a delete run this big counts as a "revision" (~a word),
                               # so typo backspaces don't inflate the count


# ── Models ──────────────────────────────────────────────────────────────────

class Op(BaseModel):
    timestamp: str                 # ISO local time when the run ended
    op_type: str                   # 'insert' | 'delete' | 'paste' | 'pause'
    para_index: int = 0
    char_offset: int = 0
    length: int = 0
    text_content: Optional[str] = None
    duration_ms: int = 0           # time spent producing this run / pause


class SessionStart(BaseModel):
    project_path: str
    chapter_id: str


class FlushRequest(BaseModel):
    project_path: str
    session_id: str
    chapter_id: str
    ops: List[Op]


class SessionEnd(BaseModel):
    project_path: str
    session_id: str


class ChapterScoped(BaseModel):
    project_path: str
    chapter_id: str


class ProjectScoped(BaseModel):
    project_path: str


class CompactRequest(BaseModel):
    project_path: str
    older_than_days: int = 180


class ClearRequest(BaseModel):
    project_path: str
    chapter_id: Optional[str] = None   # None → whole project


# ── Helpers ─────────────────────────────────────────────────────────────────

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    # summary_json was added after these tables first shipped — patch older dev DBs.
    try:
        cols = [c[1] for c in conn.execute("PRAGMA table_info(pentimento_sessions)").fetchall()]
        if "summary_json" not in cols:
            conn.execute("ALTER TABLE pentimento_sessions ADD COLUMN summary_json TEXT")
            conn.commit()
    except Exception:
        pass
    return conn


def _hour(ts: str) -> Optional[int]:
    try:
        return datetime.datetime.fromisoformat(ts.replace("Z", "")).hour
    except Exception:
        return None


def _is_night(ts: str) -> bool:
    h = _hour(ts)
    return h is not None and NIGHT_START <= h < NIGHT_END


def _blank_para():
    return {"time_ms": 0, "inserted": 0, "deleted": 0, "revisions": 0,
            "night_ms": 0, "sessions": 0}


def _accumulate(paras: dict, para_index, op_type, length, duration_ms, night):
    p = paras.setdefault(str(para_index), _blank_para())
    p["time_ms"] += duration_ms
    if night:
        p["night_ms"] += duration_ms
    if op_type in ("insert", "paste"):
        p["inserted"] += length
    elif op_type == "delete":
        p["deleted"] += length
        if length >= REVISION_MIN_CHARS:   # only chunk deletions count as a rewrite pass
            p["revisions"] += 1


def _word_count(text: Optional[str]) -> int:
    return len(text.split()) if text else 0


# ── Session lifecycle ───────────────────────────────────────────────────────

@router.post("/api/project/pentimento/session/start")
def session_start(req: SessionStart):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT session_num, session_hash FROM pentimento_sessions "
        "WHERE chapter_id=? ORDER BY session_num DESC LIMIT 1", (req.chapter_id,))
    last = cur.fetchone()
    session_num = (last["session_num"] + 1) if last else 1
    prev_hash = last["session_hash"] if last else None

    session_id = _new_uuid(cur)
    cur.execute(
        "INSERT INTO pentimento_sessions "
        "(id, chapter_id, device_id, session_num, start_time, previous_session_hash) "
        "VALUES (?,?,?,?,?,?)",
        (session_id, req.chapter_id, DEVICE_ID, session_num,
         datetime.datetime.now().isoformat(), prev_hash))
    conn.commit()
    conn.close()
    return {"session_id": session_id, "session_num": session_num,
            "previous_session_hash": prev_hash}


def _new_uuid(cur):
    import uuid
    return str(uuid.uuid4())


@router.post("/api/project/pentimento/flush")
def flush(req: FlushRequest):
    if not req.ops:
        return {"status": "ok", "written": 0}
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    # Guard: session must exist (editor may have a stale id after a clear)
    cur.execute("SELECT 1 FROM pentimento_sessions WHERE id=?", (req.session_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Unknown session_id")

    rows = [(req.session_id, req.chapter_id, op.timestamp, op.op_type, op.para_index,
             op.char_offset, op.length, op.text_content, op.duration_ms, "desktop")
            for op in req.ops]
    cur.executemany(
        "INSERT INTO pentimento_ops "
        "(session_id, chapter_id, timestamp, op_type, para_index, char_offset, length, "
        " text_content, duration_ms, origin) VALUES (?,?,?,?,?,?,?,?,?,?)", rows)
    conn.commit()
    conn.close()
    return {"status": "ok", "written": len(rows)}


@router.post("/api/project/pentimento/session/end")
def session_end(req: SessionEnd):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute("SELECT previous_session_hash, chapter_id FROM pentimento_sessions WHERE id=?", (req.session_id,))
    sess = cur.fetchone()
    if not sess:
        conn.close()
        raise HTTPException(status_code=404, detail="Unknown session_id")

    cur.execute(
        "SELECT op_type, para_index, char_offset, length, text_content, timestamp "
        "FROM pentimento_ops WHERE session_id=? ORDER BY timestamp, rowid", (req.session_id,))
    ops = cur.fetchall()

    h = hashlib.sha256()
    h.update((sess["previous_session_hash"] or "").encode("utf-8"))
    for o in ops:
        fp = f"{o['op_type']}|{o['para_index']}|{o['char_offset']}|{o['length']}|{o['text_content'] or ''}|{o['timestamp']}"
        h.update(fp.encode("utf-8"))
    session_hash = h.hexdigest()

    cur.execute(
        "UPDATE pentimento_sessions SET end_time=?, session_hash=? WHERE id=?",
        (datetime.datetime.now().isoformat(), session_hash, req.session_id))

    # Auto-snapshot the chapter's prose at this sealed session boundary (rollback / Edit
    # History), unless the writer turned prose_history off. Best-effort: a snapshot failure
    # must never break session sealing. Assumes the editor flushed its latest save first.
    snapshot_id = None
    try:
        cur.execute("SELECT config_value FROM project_config WHERE config_key='prose_history'")
        pcfg = cur.fetchone()
        prose_history_on = (pcfg is None) or (str(pcfg["config_value"]).lower() != "false")
        if prose_history_on:
            from routes.chapter_history import _create_snapshot
            snapshot_id = _create_snapshot(
                cur, req.project_path, sess["chapter_id"], "session",
                session_id=req.session_id, session_hash=session_hash)
    except Exception:
        snapshot_id = None

    conn.commit()
    conn.close()
    return {"status": "ok", "session_hash": session_hash, "op_count": len(ops),
            "snapshot_id": snapshot_id}


# ── Aggregation ─────────────────────────────────────────────────────────────

@router.post("/api/project/pentimento/heatmap")
def heatmap(req: ChapterScoped):
    conn = _get_db(req.project_path)
    cur = conn.cursor()

    paras: dict = {}
    session_ids = set()

    # 1. live ops
    cur.execute(
        "SELECT session_id, op_type, para_index, length, duration_ms, timestamp "
        "FROM pentimento_ops WHERE chapter_id=?", (req.chapter_id,))
    for o in cur.fetchall():
        _accumulate(paras, o["para_index"], o["op_type"], o["length"] or 0,
                    o["duration_ms"] or 0, _is_night(o["timestamp"]))
        session_ids.add(o["session_id"])

    # 2. compacted session aggregates for this chapter
    cur.execute(
        "SELECT id, summary_json FROM pentimento_sessions "
        "WHERE chapter_id=? AND summary_json IS NOT NULL", (req.chapter_id,))
    for s in cur.fetchall():
        session_ids.add(s["id"])
        try:
            data = json.loads(s["summary_json"])
        except Exception:
            continue
        for pidx, agg in (data.get("paras") or {}).items():
            p = paras.setdefault(str(pidx), _blank_para())
            for k in ("time_ms", "inserted", "deleted", "revisions", "night_ms"):
                p[k] += agg.get(k, 0)

    conn.close()

    # normalize into a sorted list with a 0..1 heat score
    max_time = max((p["time_ms"] for p in paras.values()), default=0) or 1
    result = []
    for pidx in sorted(paras, key=lambda x: int(x)):
        p = paras[pidx]
        result.append({
            "para_index": int(pidx),
            "time_ms": p["time_ms"],
            "inserted": p["inserted"],
            "deleted": p["deleted"],
            "revisions": p["revisions"],
            "night_ratio": (p["night_ms"] / p["time_ms"]) if p["time_ms"] else 0,
            "churn": (p["deleted"] / (p["inserted"] + p["deleted"])) if (p["inserted"] + p["deleted"]) else 0,
            "heat": p["time_ms"] / max_time,
        })
    return {"paragraphs": result, "session_count": len(session_ids)}


@router.post("/api/project/pentimento/summary")
def summary(req: ProjectScoped):
    conn = _get_db(req.project_path)
    cur = conn.cursor()

    typed_words = deleted_words = total_time_ms = 0
    day_ms = night_ms = 0

    cur.execute("SELECT op_type, length, text_content, duration_ms, timestamp FROM pentimento_ops")
    for o in cur.fetchall():
        dur = o["duration_ms"] or 0
        total_time_ms += dur
        if _is_night(o["timestamp"]):
            night_ms += dur
        else:
            day_ms += dur
        if o["op_type"] in ("insert", "paste"):
            typed_words += _word_count(o["text_content"])
        elif o["op_type"] == "delete":
            deleted_words += _word_count(o["text_content"])

    # fold in compacted totals
    cur.execute("SELECT summary_json FROM pentimento_sessions WHERE summary_json IS NOT NULL")
    for s in cur.fetchall():
        try:
            tot = (json.loads(s["summary_json"]) or {}).get("totals") or {}
        except Exception:
            continue
        typed_words += tot.get("typed_words", 0)
        deleted_words += tot.get("deleted_words", 0)
        total_time_ms += tot.get("time_ms", 0)
        day_ms += tot.get("day_ms", 0)
        night_ms += tot.get("night_ms", 0)

    cur.execute("SELECT COUNT(*) c, MIN(start_time) a, MAX(start_time) b FROM pentimento_sessions")
    srow = cur.fetchone()
    cur.execute("SELECT session_hash FROM pentimento_sessions WHERE session_hash IS NOT NULL "
                "ORDER BY session_num DESC LIMIT 1")
    head = cur.fetchone()
    conn.close()

    return {
        "typed_words": typed_words,
        "deleted_words": deleted_words,
        "kept_words": max(typed_words - deleted_words, 0),
        "total_time_ms": total_time_ms,
        "day_ms": day_ms,
        "night_ms": night_ms,
        "sessions": srow["c"] if srow else 0,
        "first_session": srow["a"] if srow else None,
        "last_session": srow["b"] if srow else None,
        "chain_head_hash": head["session_hash"] if head else None,
    }


# ── Storage management ──────────────────────────────────────────────────────

@router.post("/api/project/pentimento/compact")
def compact(req: CompactRequest):
    """For sessions older than the cutoff, roll their ops up into summary_json and
    delete the ops. Keeps the heatmap + chain hash, reclaims ~95% of the space."""
    cutoff = (datetime.datetime.now() - datetime.timedelta(days=req.older_than_days)).isoformat()
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM pentimento_sessions WHERE start_time < ? AND summary_json IS NULL",
        (cutoff,))
    session_ids = [r["id"] for r in cur.fetchall()]

    compacted = 0
    for sid in session_ids:
        cur.execute(
            "SELECT op_type, para_index, length, text_content, duration_ms, timestamp "
            "FROM pentimento_ops WHERE session_id=?", (sid,))
        ops = cur.fetchall()
        if not ops:
            continue
        paras: dict = {}
        totals = {"typed_words": 0, "deleted_words": 0, "time_ms": 0, "day_ms": 0, "night_ms": 0}
        for o in ops:
            night = _is_night(o["timestamp"])
            _accumulate(paras, o["para_index"], o["op_type"], o["length"] or 0,
                        o["duration_ms"] or 0, night)
            totals["time_ms"] += o["duration_ms"] or 0
            totals["night_ms" if night else "day_ms"] += o["duration_ms"] or 0
            if o["op_type"] in ("insert", "paste"):
                totals["typed_words"] += _word_count(o["text_content"])
            elif o["op_type"] == "delete":
                totals["deleted_words"] += _word_count(o["text_content"])
        cur.execute("UPDATE pentimento_sessions SET summary_json=? WHERE id=?",
                    (json.dumps({"paras": paras, "totals": totals}), sid))
        cur.execute("DELETE FROM pentimento_ops WHERE session_id=?", (sid,))
        compacted += 1

    conn.commit()
    conn.close()
    return {"status": "ok", "sessions_compacted": compacted}


@router.post("/api/project/pentimento/clear")
def clear(req: ClearRequest):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    if req.chapter_id:
        cur.execute("DELETE FROM pentimento_ops WHERE chapter_id=?", (req.chapter_id,))
        cur.execute("DELETE FROM pentimento_sessions WHERE chapter_id=?", (req.chapter_id,))
    else:
        cur.execute("DELETE FROM pentimento_ops")
        cur.execute("DELETE FROM pentimento_sessions")
    conn.commit()
    conn.close()
    return {"status": "ok"}


@router.post("/api/project/pentimento/storage")
def storage(req: ProjectScoped):
    """Rough on-disk footprint of telemetry, for the settings UI."""
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) c, COALESCE(SUM(LENGTH(text_content)),0) t FROM pentimento_ops")
    row = cur.fetchone()
    op_count = row["c"]
    text_bytes = row["t"]
    conn.close()
    # ~180 bytes/row fixed overhead (uuids/timestamps/indexes) + stored text
    est_bytes = op_count * 180 + text_bytes
    return {"op_count": op_count, "estimated_bytes": est_bytes,
            "estimated_mb": round(est_bytes / (1024 * 1024), 2)}

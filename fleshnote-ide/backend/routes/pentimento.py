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
import threading
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


class ChapterDeviceScoped(ChapterScoped):
    """Optional device filter — multi-device projects (e.g. a clone that kept
    writing on another machine) can view per-device process data."""
    device_id: Optional[str] = None


class ProjectScoped(BaseModel):
    project_path: str


class CompactRequest(BaseModel):
    project_path: str
    older_than_days: int = 180


class ClearRequest(BaseModel):
    project_path: str
    chapter_id: Optional[str] = None   # None → whole project


class HeadAnchorRequest(BaseModel):
    project_path: str
    session_id: str
    chapter_id: str
    rolling_head: str        # SHA-256 over (prev session hash + flushed fingerprints)
    previous_hash: Optional[str] = None


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
    # server_receipts (Sealed Pentimento) — created on demand for legacy projects.
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS server_receipts (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                chapter_id TEXT,
                kind TEXT NOT NULL DEFAULT 'seal',
                anchored_hash TEXT NOT NULL,
                previous_hash TEXT,
                client_time TEXT NOT NULL,
                server_time TEXT,
                server_signature TEXT,
                key_id TEXT,
                tsa_token TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                failure_reason TEXT,
                attempts INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_server_receipts_hash ON server_receipts(anchored_hash);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_server_receipts_session ON server_receipts(session_id);")
        conn.commit()
    except Exception:
        pass
    return conn


def _verification_enabled(cur) -> bool:
    """Project-level opt-in for Sealed Pentimento (project_config key)."""
    try:
        cur.execute("SELECT config_value FROM project_config WHERE config_key='pentimento_verification'")
        row = cur.fetchone()
        return bool(row) and str(row["config_value"]).lower() == "true"
    except Exception:
        return False


def _external_tsa_enabled(cur) -> bool:
    try:
        cur.execute("SELECT config_value FROM project_config WHERE config_key='pentimento_external_tsa'")
        row = cur.fetchone()
        return bool(row) and str(row["config_value"]).lower() == "true"
    except Exception:
        return False


def _tsa_url(cur):
    """Per-project TSA endpoint override (self-hosters), else the default."""
    try:
        cur.execute("SELECT config_value FROM project_config WHERE config_key='pentimento_tsa_url'")
        row = cur.fetchone()
        if row and str(row["config_value"]).strip():
            return str(row["config_value"]).strip()
    except Exception:
        pass
    return None


def _insert_receipt(cur, session_id, chapter_id, kind, anchored_hash, previous_hash):
    receipt_id = _new_uuid(cur)
    cur.execute(
        "INSERT INTO server_receipts "
        "(id, session_id, chapter_id, kind, anchored_hash, previous_hash, client_time, status) "
        "VALUES (?,?,?,?,?,?,?,'pending')",
        (receipt_id, session_id, chapter_id, kind, anchored_hash,
         previous_hash, datetime.datetime.now().isoformat()))
    return receipt_id


def _process_receipt(project_path, receipt_id):
    """Anchor one pending receipt (and opportunistically a few others) in a
    background thread — a slow/unreachable TSA must never stall the editor."""
    import tsa_client
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        return
    try:
        conn = sqlite3.connect(db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        # Retry queue: this receipt first, then up to 20 other pending ones (oldest first)
        cur.execute("SELECT * FROM server_receipts WHERE id=?", (receipt_id,))
        receipt = cur.fetchone()
        if not receipt:
            conn.close()
            return
        external_on = _external_tsa_enabled(cur)
        tsa_url = _tsa_url(cur)
        targets = [dict(receipt)]
        cur.execute(
            "SELECT * FROM server_receipts WHERE status='pending' AND id != ? "
            "ORDER BY created_at ASC LIMIT 20", (receipt_id,))
        targets.extend(dict(r) for r in cur.fetchall())

        for t in targets:
            try:
                result = tsa_client.anchor_hash(t["anchored_hash"], t["previous_hash"], tsa_url=tsa_url)
                tsa_token = None
                if external_on:
                    try:
                        tsa_token = tsa_client.external_tsa_token(t["anchored_hash"])
                    except Exception:
                        tsa_token = None   # cross-anchor is a bonus, never a blocker
                cur.execute(
                    "UPDATE server_receipts SET status='anchored', server_time=?, "
                    "server_signature=?, key_id=?, tsa_token=COALESCE(?, tsa_token), "
                    "failure_reason=NULL, attempts=attempts+1, updated_at=datetime('now') "
                    "WHERE id=?",
                    (result.get("server_time"), result.get("server_signature"),
                     result.get("key_id"), tsa_token, t["id"]))
            except Exception as e:
                cur.execute(
                    "UPDATE server_receipts SET status='pending', failure_reason=?, "
                    "attempts=attempts+1, updated_at=datetime('now') WHERE id=?",
                    (str(e)[:300], t["id"]))
        conn.commit()
        conn.close()
    except Exception:
        pass


def _spawn_anchor(project_path, receipt_id):
    threading.Thread(
        target=_process_receipt, args=(project_path, receipt_id),
        daemon=True, name="pentimento-anchor").start()


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

    # Sealed Pentimento: record a 'seal' receipt for this session's chain hash and
    # anchor it in the background (never blocks the editor).
    receipt_id = None
    if _verification_enabled(cur):
        try:
            receipt_id = _insert_receipt(cur, req.session_id, sess["chapter_id"], "seal",
                                         session_hash, sess["previous_session_hash"])
        except Exception:
            receipt_id = None

    conn.commit()
    conn.close()
    if receipt_id:
        _spawn_anchor(req.project_path, receipt_id)
    return {"status": "ok", "session_hash": session_hash, "op_count": len(ops),
            "snapshot_id": snapshot_id, "receipt_id": receipt_id}


@router.post("/api/project/pentimento/anchor-head")
def anchor_head(req: HeadAnchorRequest):
    """Seal an interim rolling-head hash mid-session (every ~10 min of active
    typing). Catches fake sessions appended after an honest seal, and anchors
    long sessions that never reach an explicit session/end."""
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pentimento_sessions WHERE id=?", (req.session_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Unknown session_id")
    if not _verification_enabled(cur):
        conn.close()
        return {"status": "disabled"}
    receipt_id = None
    try:
        receipt_id = _insert_receipt(cur, req.session_id, req.chapter_id, "head",
                                     req.rolling_head, req.previous_hash)
        conn.commit()
    except Exception:
        receipt_id = None
    conn.close()
    if receipt_id:
        _spawn_anchor(req.project_path, receipt_id)
    return {"status": "ok", "receipt_id": receipt_id}


@router.post("/api/project/pentimento/receipts")
def receipts(req: ProjectScoped):
    """Receipt ledger for the settings/status UI."""
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) c FROM server_receipts")
        total = int(cur.fetchone()["c"])
        cur.execute("SELECT status, COUNT(*) c FROM server_receipts GROUP BY status")
        by_status = {r["status"]: int(r["c"]) for r in cur.fetchall()}
        cur.execute("""
            SELECT id, session_id, chapter_id, kind, anchored_hash, previous_hash,
                   client_time, server_time, key_id, status, attempts, created_at
            FROM server_receipts ORDER BY created_at DESC LIMIT 200
        """)
        rows = [dict(r) for r in cur.fetchall()]
        first = None
        cur.execute("SELECT MIN(client_time) a FROM server_receipts WHERE status='anchored'")
        r = cur.fetchone()
        first = r["a"] if r else None
        return {"status": "ok", "total": total, "by_status": by_status,
                "receipts": rows, "first_anchored": first}
    finally:
        conn.close()


# ── Aggregation ─────────────────────────────────────────────────────────────

@router.post("/api/project/pentimento/heatmap")
def heatmap(req: ChapterDeviceScoped):
    conn = _get_db(req.project_path)
    cur = conn.cursor()

    device = req.device_id
    if device:
        # Guard: unknown device id → same shape as "no data"
        cur.execute("SELECT 1 FROM pentimento_sessions WHERE device_id=? LIMIT 1", (device,))
        known = cur.fetchone() is not None
        if not known:
            conn.close()
            return {"paragraphs": [], "session_count": 0}

    paras: dict = {}
    session_ids = set()

    # 1. live ops (device filter joins through the session row)
    if device:
        cur.execute(
            "SELECT o.session_id AS session_id, o.op_type AS op_type, o.para_index AS para_index, "
            "       o.length AS length, o.duration_ms AS duration_ms, o.timestamp AS timestamp "
            "FROM pentimento_ops o JOIN pentimento_sessions ps ON ps.id = o.session_id "
            "WHERE o.chapter_id=? AND ps.device_id=?", (req.chapter_id, device))
    else:
        cur.execute(
            "SELECT session_id, op_type, para_index, length, duration_ms, timestamp "
            "FROM pentimento_ops WHERE chapter_id=?", (req.chapter_id,))
    for o in cur.fetchall():
        _accumulate(paras, o["para_index"], o["op_type"], o["length"] or 0,
                    o["duration_ms"] or 0, _is_night(o["timestamp"]))
        session_ids.add(o["session_id"])

    # 2. compacted session aggregates for this chapter
    if device:
        cur.execute(
            "SELECT id, summary_json FROM pentimento_sessions "
            "WHERE chapter_id=? AND summary_json IS NOT NULL AND device_id=?",
            (req.chapter_id, device))
    else:
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


@router.post("/api/project/pentimento/ops")
def get_ops(req: ChapterDeviceScoped):
    conn = _get_db(req.project_path)
    cur = conn.cursor()
    if req.device_id:
        cur.execute(
            "SELECT o.session_id AS session_id, o.op_type AS op_type, o.para_index AS para_index, "
            "       o.char_offset AS char_offset, o.length AS length, o.text_content AS text_content, "
            "       o.duration_ms AS duration_ms, o.timestamp AS timestamp "
            "FROM pentimento_ops o JOIN pentimento_sessions ps ON ps.id = o.session_id "
            "WHERE o.chapter_id=? AND ps.device_id=? ORDER BY o.timestamp, o.rowid",
            (req.chapter_id, req.device_id))
    else:
        cur.execute(
            "SELECT session_id, op_type, para_index, char_offset, length, text_content, duration_ms, timestamp "
            "FROM pentimento_ops WHERE chapter_id=? ORDER BY timestamp, rowid", (req.chapter_id,))
    ops = [{
        "session_id": r["session_id"],
        "op_type": r["op_type"],
        "para_index": r["para_index"],
        "char_offset": r["char_offset"],
        "length": r["length"],
        "text_content": r["text_content"],
        "duration_ms": r["duration_ms"] or 0,
        "timestamp": r["timestamp"]
    } for r in cur.fetchall()]
    conn.close()
    return {"ops": ops}


@router.post("/api/project/pentimento/summary")
def summary(req: ProjectScoped):
    conn = _get_db(req.project_path)
    cur = conn.cursor()

    typed_words = deleted_words = total_time_ms = 0
    day_ms = night_ms = 0

    cur.execute("""
        SELECT ps.device_id AS device_id, o.op_type AS op_type, o.length AS length,
               o.text_content AS text_content, o.duration_ms AS duration_ms, o.timestamp AS timestamp
        FROM pentimento_ops o JOIN pentimento_sessions ps ON ps.id = o.session_id
    """)
    device_totals: dict = {}
    for o in cur.fetchall():
        dur = o["duration_ms"] or 0
        total_time_ms += dur
        dev = device_totals.setdefault(o["device_id"] or "unknown",
                                       {"sessions": 0, "time_ms": 0, "typed_words": 0, "deleted_words": 0})
        dev["time_ms"] += dur
        if _is_night(o["timestamp"]):
            night_ms += dur
        else:
            day_ms += dur
        if o["op_type"] in ("insert", "paste"):
            typed_words += _word_count(o["text_content"])
            dev["typed_words"] += _word_count(o["text_content"])
        elif o["op_type"] == "delete":
            deleted_words += _word_count(o["text_content"])
            dev["deleted_words"] += _word_count(o["text_content"])

    # fold in compacted totals
    cur.execute("SELECT device_id, summary_json FROM pentimento_sessions WHERE summary_json IS NOT NULL")
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
        dev = device_totals.setdefault(s["device_id"] or "unknown",
                                       {"sessions": 0, "time_ms": 0, "typed_words": 0, "deleted_words": 0})
        dev["time_ms"] += tot.get("time_ms", 0)
        dev["typed_words"] += tot.get("typed_words", 0)
        dev["deleted_words"] += tot.get("deleted_words", 0)

    # session counts per device
    cur.execute("SELECT device_id, COUNT(*) c, MIN(start_time) a, MAX(start_time) b "
                "FROM pentimento_sessions GROUP BY device_id")
    for r in cur.fetchall():
        dev = device_totals.setdefault(r["device_id"] or "unknown",
                                       {"sessions": 0, "time_ms": 0, "typed_words": 0, "deleted_words": 0})
        dev["sessions"] = r["c"]

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
        "current_device": DEVICE_ID,
        "devices": device_totals,
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
        cur.execute("DELETE FROM server_receipts WHERE chapter_id=?", (req.chapter_id,))
    else:
        cur.execute("DELETE FROM pentimento_ops")
        cur.execute("DELETE FROM pentimento_sessions")
        cur.execute("DELETE FROM server_receipts")
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

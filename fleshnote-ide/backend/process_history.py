"""
Writing-process history across devices.

Every device keeps its own Pentimento hash chain per chapter (sessions, their ops,
prose snapshots and timestamp receipts). These rows never travel through the
change_log merge: they are evidence, and a forged change_log row must not be able to
rewrite them. Instead, a sync IMPORTS the other device's sealed history from its
database, row by row, after checking every hash it can recompute:

  sessions   only sealed ones, only other devices' (this device is the authority on
             its own rows), inserted when absent. A copy this device holds of another
             device's session is replaced only when it is unsealed, or when the device
             that owns the session sends its own version.
  ops        only for sessions inserted or replaced here, in the sender's hash order.
  snapshots  other devices' snapshots, inserted when absent, after checking the
             prose_hash against the decompressed text.
  receipts   inserted when absent; an existing one only moves forward
             (pending / failed -> anchored). Forked receipts are never touched.

Nothing is ever deleted or rehashed, so every receipt already issued stays valid.
Ids this device removed on purpose (clear / prune) are remembered in
process_history_tombstones and never imported again.

Chains: a session links to the previous session of the SAME device on the chapter.
A device's first session on a chapter links to the newest sealed session any device
left there (the state it started writing from), or to nothing on a fresh chapter.
So a chapter can hold several chains that fork from each other.

When a sync resolves a prose conflict, the applying device records a MERGE session
on its own chain: one 'merge' op whose text lists the other devices' chain heads and
the resulting prose hash. The session hash covers that op, so the join of the
chains is sealed (and anchored, when Sealed Pentimento is on) like any other session.
"""

import datetime
import hashlib
import json
import re
import zlib

MERGE_OP = "merge"
DEVICE_KINDS = ("desktop", "mobile")
MAX_SNAPSHOT_BYTES = 64 * 1024 * 1024   # decompressed size cap for an imported snapshot

_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_RECEIPT_STATUSES = {"pending", "anchored", "failed", "forked"}
_RECEIPT_REPLACEABLE = {"pending", "failed"}
_RFC3339_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$")


# ── Hashing ─────────────────────────────────────────────────────────────────

def op_fingerprint(o) -> str:
    """One op's line in the session hash (the editors compute the same string)."""
    return (f"{o['op_type']}|{o['para_index']}|{o['char_offset']}|{o['length']}|"
            f"{o['text_content'] or ''}|{o['timestamp']}")


def chain_hash(previous_hash, ops) -> str:
    """SHA-256 over the previous session's hash and every op fingerprint, in the
    order the ops were stored (timestamp, then insertion order)."""
    h = hashlib.sha256()
    h.update((previous_hash or "").encode("utf-8"))
    for o in ops:
        h.update(op_fingerprint(o).encode("utf-8"))
    return h.hexdigest()


def merge_payload(heads, prose_hash, resolution, theirs=None) -> str:
    """Text of a merge op. Parsed only for display and verification; the session
    hash covers the stored string as it is."""
    return json.dumps({
        "merge": 1,
        "heads": sorted(set(h for h in heads if h)),
        "prose_hash": prose_hash,
        "resolution": resolution,
        "theirs": theirs,
    }, sort_keys=True, separators=(",", ":"))


def parse_merge_payload(text):
    try:
        data = json.loads(text or "")
    except (TypeError, ValueError):
        return None
    if not isinstance(data, dict) or data.get("merge") != 1:
        return None
    heads = data.get("heads")
    if not isinstance(heads, list) or not all(isinstance(h, str) for h in heads):
        return None
    return data


# ── Chains ──────────────────────────────────────────────────────────────────

def chain_head(cur, chapter_id, device_id):
    """This device's latest session on the chapter (sealed or not), or None."""
    cur.execute(
        "SELECT id, session_num, session_hash, start_time FROM pentimento_sessions "
        "WHERE chapter_id=? AND device_id=? ORDER BY session_num DESC, rowid DESC LIMIT 1",
        (chapter_id, device_id))
    return cur.fetchone()


def fork_point(cur, chapter_id):
    """Hash a device's first session on the chapter links to: the newest sealed
    session any device left there, or None on a fresh chapter."""
    cur.execute(
        "SELECT session_hash FROM pentimento_sessions "
        "WHERE chapter_id=? AND session_hash IS NOT NULL "
        "ORDER BY session_num DESC, end_time DESC, rowid DESC LIMIT 1", (chapter_id,))
    row = cur.fetchone()
    return row[0] if row else None


def next_session_num(cur, chapter_id) -> int:
    """Chapter-wide ordinal over all devices. Two devices can share a number after a
    merge, so nothing relies on it being unique."""
    cur.execute("SELECT MAX(session_num) FROM pentimento_sessions WHERE chapter_id=?",
                (chapter_id,))
    row = cur.fetchone()
    return int(row[0] or 0) + 1


def foreign_heads(cur, chapter_id, device_id):
    """The sealed chain head of every other device on the chapter."""
    cur.execute(
        "SELECT device_id, session_hash FROM pentimento_sessions "
        "WHERE chapter_id=? AND device_id!=? AND session_hash IS NOT NULL "
        "ORDER BY device_id, session_num DESC, end_time DESC, rowid DESC",
        (chapter_id, device_id))
    heads = {}
    for row in cur.fetchall():
        heads.setdefault(row[0], row[1])
    return sorted(heads.values())


def device_directory(cur):
    """{device_id: {"kind": 'desktop'|'mobile', "ordinal": n}} — per kind, devices
    are numbered by their first session's start: Desktop, Desktop 2, Phone, Phone 2.
    Derived on display, never stored."""
    cur.execute(
        "SELECT device_id, MIN(start_time) first_start, "
        "       MAX(CASE WHEN device_kind='mobile' THEN 1 ELSE 0 END) any_mobile, "
        "       MAX(CASE WHEN device_kind='desktop' THEN 1 ELSE 0 END) any_desktop "
        "FROM pentimento_sessions GROUP BY device_id")
    rows = cur.fetchall()
    devices = []
    for r in rows:
        kind = "mobile" if r[2] and not r[3] else "desktop"
        devices.append((r[0], kind, r[1] or ""))
    out = {}
    for kind in DEVICE_KINDS:
        same = sorted((d for d in devices if d[1] == kind), key=lambda d: (d[2], d[0] or ""))
        for n, d in enumerate(same, start=1):
            out[d[0]] = {"kind": kind, "ordinal": n}
    return out


def _utc_now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def seal_own_dangling(cur, project_path, chapter_id, device_id):
    """Seal this device's latest session on the chapter if it was left open (an
    editor still recording, or a crash), closed at its last op, so its closing
    snapshot holds the text from before a sync changes the chapter. Never touches
    another device's session. Returns the receipt id to anchor, or None."""
    from routes.pentimento import _seal_session, _local_iso
    last = chain_head(cur, chapter_id, device_id)
    if not last or last["session_hash"]:
        return None
    cur.execute("SELECT MAX(timestamp) t FROM pentimento_ops WHERE session_id=?", (last["id"],))
    last_op = cur.fetchone()["t"]
    _hash, _snap, receipt_id = _seal_session(
        cur, project_path, last["id"], _local_iso(last_op) if last_op else None)
    return receipt_id


def record_merge(cur, project_path, chapter_id, device_id, resolution, prose_text, theirs=None):
    """Record a sync's prose merge on this device's chain: a sealed session holding
    one 'merge' op that names the other devices' chain heads and the merged text's
    hash, with a 'merge' snapshot of the merged text. Seals this device's open
    session on the chapter first. Returns (session_id, [receipt ids to anchor])."""
    from routes.pentimento import _seal_session
    receipts = []
    dangling = seal_own_dangling(cur, project_path, chapter_id, device_id)
    if dangling:
        receipts.append(dangling)

    head = chain_head(cur, chapter_id, device_id)
    prev_hash = head["session_hash"] if head else fork_point(cur, chapter_id)
    heads = foreign_heads(cur, chapter_id, device_id)
    prose_hash = hashlib.sha256((prose_text or "").encode("utf-8")).hexdigest()

    import uuid
    session_id = str(uuid.uuid4())
    now = datetime.datetime.now().isoformat()
    cur.execute(
        "INSERT INTO pentimento_sessions "
        "(id, chapter_id, device_id, session_num, start_time, previous_session_hash, device_kind) "
        "VALUES (?,?,?,?,?,?,'desktop')",
        (session_id, chapter_id, device_id, next_session_num(cur, chapter_id), now, prev_hash))
    cur.execute(
        "INSERT INTO pentimento_ops "
        "(session_id, chapter_id, timestamp, op_type, para_index, char_offset, length, "
        " text_content, duration_ms, origin, source) VALUES (?,?,?,?,0,0,0,?,0,'desktop','machine')",
        (session_id, chapter_id, _utc_now_iso(), MERGE_OP,
         merge_payload(heads, prose_hash, resolution, theirs)))
    _hash, _snap, receipt_id = _seal_session(cur, project_path, session_id, now,
                                             snapshot_kind="merge")
    if receipt_id:
        receipts.append(receipt_id)
    return session_id, receipts


def snapshot_if_new(cur, project_path, chapter_id, kind="sync"):
    """Snapshot the chapter's current text unless some snapshot (this device's or an
    imported one) already holds exactly that text. Used after a sync takes another
    device's prose, so the replay has a frame for it even when the other device kept
    none. Honors prose_history. Returns the snapshot id or None."""
    try:
        cur.execute("SELECT config_value FROM project_config WHERE config_key='prose_history'")
        pcfg = cur.fetchone()
        if pcfg is not None and str(pcfg[0]).lower() == "false":
            return None
        from routes.chapter_history import _create_snapshot, _read_chapter_md
        cur.execute("SELECT md_filename FROM chapters WHERE id=? AND deleted=0", (chapter_id,))
        row = cur.fetchone()
        if not row:
            return None
        md = _read_chapter_md(project_path, row[0])
        prose_hash = hashlib.sha256(md.encode("utf-8")).hexdigest()
        cur.execute("SELECT 1 FROM chapter_snapshots WHERE chapter_id=? AND prose_hash=? LIMIT 1",
                    (chapter_id, prose_hash))
        if cur.fetchone():
            return None
        return _create_snapshot(cur, project_path, chapter_id, kind)
    except Exception:
        return None   # history is auxiliary — never fail a sync over it


# ── Import ──────────────────────────────────────────────────────────────────

def _has_table(cur, name):
    cur.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None


def _columns(cur, table):
    cur.execute(f"PRAGMA table_info({table})")
    return [c[1] for c in cur.fetchall()]


def _valid_id(v):
    return isinstance(v, str) and 0 < len(v) <= 64


def _hash_ok(v, nullable=False):
    if v is None:
        return nullable
    return isinstance(v, str) and bool(_HEX64.match(v))


def _snapshot_text_ok(content_gz, prose_hash):
    if not isinstance(content_gz, (bytes, bytearray)) or not _hash_ok(prose_hash):
        return False
    try:
        d = zlib.decompressobj()
        raw = d.decompress(bytes(content_gz), MAX_SNAPSHOT_BYTES)
        if d.unconsumed_tail:
            return False
        md = raw.decode("utf-8")
    except Exception:
        return False
    return hashlib.sha256(md.encode("utf-8")).hexdigest() == prose_hash


def _receipt_anchored_ok(r):
    st, sig, kid = r.get("server_time"), r.get("server_signature"), r.get("key_id")
    if not isinstance(st, str) or not _RFC3339_RE.match(st):
        return False
    if not isinstance(sig, str) or not sig or len(sig) > 200:
        return False
    if not isinstance(kid, str) or not kid or len(kid) > 64:
        return False
    return True


def _insert(cur, table, row, cols):
    use = [c for c in cols if c in row]
    cur.execute(
        f"INSERT INTO {table} ({', '.join(use)}) VALUES ({', '.join(['?'] * len(use))})",
        [row[c] for c in use])


def import_process_history(cl, cr, local_device, remote_device=None, dry_run=False):
    """Import the other side's sealed process history (see the module docstring).
    `cl` is this device's cursor (inside the sync transaction), `cr` the other
    side's. `remote_device` is the other side's own device id, which lets its
    version of its own sessions replace a stale copy held here. With dry_run,
    nothing is written and the counts say what an import would do.

    Returns counts: sessions, replaced, ops, snapshots, receipts, receipts_updated,
    rejected (failed a hash check), and devices ({device_id: sessions})."""
    stats = {"sessions": 0, "replaced": 0, "ops": 0, "snapshots": 0, "receipts": 0,
             "receipts_updated": 0, "rejected": 0, "devices": {}}
    if not _has_table(cr, "pentimento_sessions") or not _has_table(cl, "pentimento_sessions"):
        return stats

    local_cols = {t: set(_columns(cl, t)) for t in
                  ("pentimento_sessions", "pentimento_ops", "chapter_snapshots", "server_receipts")
                  if _has_table(cl, t)}
    cl.execute("SELECT table_name, row_id FROM process_history_tombstones")
    tombstones = {(r[0], r[1]) for r in cl.fetchall()}
    cl.execute("SELECT id FROM chapters")
    chapters = {str(r[0]) for r in cl.fetchall()}

    remote_has_ops = _has_table(cr, "pentimento_ops")
    session_cols = [c for c in _columns(cr, "pentimento_sessions")
                    if c in local_cols["pentimento_sessions"]]
    op_cols = ([c for c in _columns(cr, "pentimento_ops")
                if c in local_cols.get("pentimento_ops", set()) and c != "id"]
               if remote_has_ops else [])
    for need in ("op_type", "para_index", "char_offset", "length", "text_content", "timestamp"):
        if remote_has_ops and need not in op_cols:
            remote_has_ops = False   # can't recompute hashes from an unknown op shape

    cr.execute("SELECT * FROM pentimento_sessions WHERE session_hash IS NOT NULL")
    incoming = [dict(r) for r in cr.fetchall()]
    imported_sessions = set()

    for r in incoming:
        sid, dev, chap = r.get("id"), r.get("device_id"), r.get("chapter_id")
        if not _valid_id(sid) or not _valid_id(dev) or dev == local_device:
            continue
        if ("pentimento_sessions", sid) in tombstones or str(chap) not in chapters:
            continue
        if not _hash_ok(r.get("session_hash")) or \
                not _hash_ok(r.get("previous_session_hash"), nullable=True):
            stats["rejected"] += 1
            continue

        ops = []
        if remote_has_ops:
            cr.execute(
                f"SELECT {', '.join(op_cols)} FROM pentimento_ops WHERE session_id=? "
                "ORDER BY timestamp, rowid", (sid,))
            ops = [dict(o) for o in cr.fetchall()]
        if ops or not r.get("summary_json"):
            # Ops present (or a session that never had any): the hash must recompute.
            # A compacted session (summary kept, ops dropped) can only be taken as is,
            # exactly as the verifier treats it.
            if chain_hash(r.get("previous_session_hash"), ops) != r["session_hash"]:
                stats["rejected"] += 1
                continue

        kind = r.get("device_kind")
        if kind not in DEVICE_KINDS:
            kind = next((o.get("origin") for o in ops if o.get("origin") in DEVICE_KINDS), None)
        r["device_kind"] = kind

        cl.execute("SELECT device_id, session_hash, device_kind, summary_json "
                   "FROM pentimento_sessions WHERE id=?", (sid,))
        local = cl.fetchone()
        if local is not None:
            if local["device_id"] != dev:
                stats["rejected"] += 1
                continue
            if local["session_hash"] == r["session_hash"]:
                if local["device_kind"] is None and kind and not dry_run:
                    cl.execute("UPDATE pentimento_sessions SET device_kind=? WHERE id=?", (kind, sid))
                imported_sessions.add(sid)
                continue
            if local["session_hash"] is not None:
                # Two sealed versions. The owner's own version replaces a copy another
                # device sealed (older phone builds sealed a desktop session left open
                # in a clone), unless the owner's later sessions here already continue
                # from the copy we hold: then that copy is the one its chain needs.
                if dev != remote_device:
                    continue
                cl.execute("SELECT 1 FROM pentimento_sessions WHERE device_id=? "
                           "AND previous_session_hash=? LIMIT 1", (dev, local["session_hash"]))
                if cl.fetchone():
                    continue
            stats["replaced"] += 1
            if not dry_run:
                cl.execute("DELETE FROM pentimento_ops WHERE session_id=?", (sid,))
                cl.execute("DELETE FROM pentimento_sessions WHERE id=?", (sid,))
        else:
            stats["sessions"] += 1
        stats["devices"][dev] = stats["devices"].get(dev, 0) + 1
        imported_sessions.add(sid)
        if dry_run:
            stats["ops"] += len(ops)
            continue

        _insert(cl, "pentimento_sessions", r,
                session_cols + (["device_kind"] if "device_kind" not in session_cols
                                and "device_kind" in local_cols["pentimento_sessions"] else []))
        for o in ops:
            o["session_id"] = sid
            o["chapter_id"] = chap
            if o.get("origin") not in DEVICE_KINDS:
                o["origin"] = kind or "desktop"
            _insert(cl, "pentimento_ops", o,
                    [c for c in op_cols if c not in ("session_id", "chapter_id", "origin")]
                    + ["session_id", "chapter_id", "origin"])
        stats["ops"] += len(ops)

    # Snapshots: other devices' prose frames, verified against their prose_hash.
    if _has_table(cr, "chapter_snapshots") and "chapter_snapshots" in local_cols:
        snap_cols = [c for c in _columns(cr, "chapter_snapshots")
                     if c in local_cols["chapter_snapshots"]]
        cl.execute("SELECT id FROM chapter_snapshots")
        have = {r[0] for r in cl.fetchall()}
        cr.execute("SELECT id, device_id, chapter_id FROM chapter_snapshots")
        wanted = [r["id"] for r in cr.fetchall()
                  if _valid_id(r["id"]) and r["id"] not in have
                  and _valid_id(r["device_id"]) and r["device_id"] != local_device
                  and str(r["chapter_id"]) in chapters
                  and ("chapter_snapshots", r["id"]) not in tombstones]
        for snap_id in wanted:
            cr.execute(f"SELECT {', '.join(snap_cols)} FROM chapter_snapshots WHERE id=?", (snap_id,))
            row = dict(cr.fetchone())
            if not _snapshot_text_ok(row.get("content_gz"), row.get("prose_hash")):
                stats["rejected"] += 1
                continue
            stats["snapshots"] += 1
            if not dry_run:
                _insert(cl, "chapter_snapshots", row, snap_cols)

    # Receipts: for sessions this side now holds, forward-only.
    if _has_table(cr, "server_receipts") and "server_receipts" in local_cols:
        rec_cols = [c for c in _columns(cr, "server_receipts")
                    if c in local_cols["server_receipts"]]
        cl.execute("SELECT id, session_hash FROM pentimento_sessions")
        local_hashes = {r[0]: r[1] for r in cl.fetchall()}
        cr.execute(f"SELECT {', '.join(rec_cols)} FROM server_receipts")
        for r in (dict(x) for x in cr.fetchall()):
            rid, sess = r.get("id"), r.get("session_id")
            if not _valid_id(rid) or not _valid_id(sess):
                continue
            if sess not in imported_sessions:
                continue   # only receipts of other devices' sessions held here
            if r.get("status") not in _RECEIPT_STATUSES or not _hash_ok(r.get("anchored_hash")):
                continue
            if r.get("kind", "seal") == "seal" and sess in local_hashes \
                    and r["anchored_hash"] != local_hashes[sess]:
                stats["rejected"] += 1
                continue
            if r["status"] == "anchored" and not _receipt_anchored_ok(r):
                stats["rejected"] += 1
                continue
            cl.execute("SELECT status FROM server_receipts WHERE id=?", (rid,))
            local = cl.fetchone()
            if local is None:
                stats["receipts"] += 1
                if not dry_run:
                    _insert(cl, "server_receipts", r, rec_cols)
            elif local["status"] in _RECEIPT_REPLACEABLE and r["status"] == "anchored":
                stats["receipts_updated"] += 1
                if not dry_run:
                    cl.execute(
                        "UPDATE server_receipts SET status='anchored', server_time=?, "
                        "server_signature=?, key_id=?, tsa_token=COALESCE(?, tsa_token), "
                        "failure_reason=NULL, updated_at=datetime('now') WHERE id=?",
                        (r.get("server_time"), r.get("server_signature"), r.get("key_id"),
                         r.get("tsa_token"), rid))
    return stats


def remember_removed(cur, table, ids):
    """Tombstone ids this device removed on purpose, so a sync never brings them back."""
    cur.execute("""
        CREATE TABLE IF NOT EXISTS process_history_tombstones (
            table_name TEXT NOT NULL,
            row_id     TEXT NOT NULL,
            removed_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (table_name, row_id)
        )
    """)
    cur.executemany(
        "INSERT OR IGNORE INTO process_history_tombstones (table_name, row_id) VALUES (?, ?)",
        [(table, str(i)) for i in ids if i is not None])

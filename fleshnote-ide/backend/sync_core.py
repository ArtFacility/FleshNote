import os
import time
import uuid
import json
from datetime import datetime

# 1. Device identity loading
DEVICE_ID = os.environ.get("FLESHNOTE_DEVICE_ID")
if not DEVICE_ID:
    # Standalone script fallback to prevent crashes during direct script test runs
    DEVICE_ID = str(uuid.uuid4())
    print(f"WARNING: FLESHNOTE_DEVICE_ID not set. Using generated fallback: {DEVICE_ID}")

ORIGIN_DEFAULT = "desktop"


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _to_text(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, (list, dict)):
        return json.dumps(val)
    return str(val)


def _parse_hlc(hlc_str: str) -> tuple[int, int]:
    parts = hlc_str.split(":")
    if len(parts) >= 2:
        try:
            return int(parts[0]), int(parts[1])
        except ValueError:
            pass
    return 0, 0


# 2. HLC Utilities
def next_hlc(cursor) -> str:
    now_ms = int(time.time() * 1000)
    cursor.execute("SELECT last_hlc FROM sync_meta WHERE id=1")
    row = cursor.fetchone()
    last = row[0] if row and row[0] else None
    
    last_ms, last_ctr = _parse_hlc(last) if last else (0, 0)
    if now_ms > last_ms:
        ms, ctr = now_ms, 0
    else:
        ms, ctr = last_ms, last_ctr + 1  # clock didn't advance, bump counter
        
    hlc = f"{ms:013d}:{ctr:05d}:{DEVICE_ID}"
    cursor.execute("UPDATE sync_meta SET last_hlc=? WHERE id=1", (hlc,))
    return hlc


# 3. Logging Helpers
def log_change(cursor, table_name: str, row_id: str, changes: dict, origin=ORIGIN_DEFAULT):
    """Append one change_log row per changed column. 
    Call INSIDE the route's active transaction, before conn.commit()."""
    if not changes:
        return
    hlc = next_hlc(cursor)
    for col, val in changes.items():
        cursor.execute("""
            INSERT INTO change_log (table_name, row_id, column_name, value, hlc, device_id, origin)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (table_name, str(row_id), col, _to_text(val), hlc, DEVICE_ID, origin))


def log_soft_delete(cursor, table_name: str, row_id: str, origin=ORIGIN_DEFAULT):
    """Log a soft delete (tombstone) change."""
    log_change(cursor, table_name, row_id, {
        "deleted": 1,
        "deleted_at": _now_iso()
    }, origin)


def apply_update(cursor, table_name: str, row_id: str, candidate_fields: dict, origin=ORIGIN_DEFAULT):
    """Helper to update dynamic fields in a table and automatically emit change_log entries.
    Filters out None values, builds the SET clause, executes, and logs."""
    # Filter out None values (since None in update endpoints means "don't change")
    updates = {k: v for k, v in candidate_fields.items() if v is not None}
    if not updates:
        return
        
    # Build dynamic UPDATE query
    set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
    query = f"UPDATE {table_name} SET {set_clause} WHERE id = ?"
    params = list(updates.values()) + [row_id]
    
    cursor.execute(query, params)
    
    # Emit changes to change_log
    log_change(cursor, table_name, row_id, updates, origin)

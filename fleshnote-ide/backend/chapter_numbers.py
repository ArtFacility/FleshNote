"""
Chapter numbering helpers.

`chapters.chapter_number` is UNIQUE across all rows, soft-deleted ones included.
A deleted chapter therefore must give its number up, or the chapters after it
can't move into the gap. Deleted chapters are parked on negative numbers,
which no live chapter ever uses.
"""

import datetime

from sync_core import log_change, log_soft_delete


def _next_parking_number(cursor) -> int:
    cursor.execute("SELECT COALESCE(MIN(chapter_number), 0) FROM chapters")
    return min(cursor.fetchone()[0], 0) - 1


def park_deleted_chapter_numbers(cursor) -> None:
    """Moves soft-deleted chapters that still hold a positive number onto negative ones."""
    cursor.execute("SELECT id FROM chapters WHERE deleted = 1 AND chapter_number > 0")
    for (chap_id,) in cursor.fetchall():
        parked = _next_parking_number(cursor)
        cursor.execute("UPDATE chapters SET chapter_number = ? WHERE id = ?", (parked, chap_id))
        log_change(cursor, "chapters", chap_id, {"chapter_number": parked})


def retire_chapter(cursor, chap_id: str) -> None:
    """Soft-deletes a chapter and frees its number."""
    now = datetime.datetime.utcnow().isoformat() + "Z"
    parked = _next_parking_number(cursor)
    cursor.execute(
        "UPDATE chapters SET deleted = 1, deleted_at = ?, chapter_number = ? WHERE id = ?",
        (now, parked, chap_id),
    )
    log_soft_delete(cursor, "chapters", chap_id)
    log_change(cursor, "chapters", chap_id, {"chapter_number": parked})


def shift_chapters_after(cursor, after_number: int, by: int) -> None:
    """Moves every live chapter numbered above `after_number` up by `by`, highest first."""
    cursor.execute(
        "SELECT id, chapter_number FROM chapters WHERE chapter_number > ? AND deleted = 0 "
        "ORDER BY chapter_number DESC",
        (after_number,),
    )
    for chap_id, num in cursor.fetchall():
        cursor.execute("UPDATE chapters SET chapter_number = ? WHERE id = ?", (num + by, chap_id))
        log_change(cursor, "chapters", chap_id, {"chapter_number": num + by})

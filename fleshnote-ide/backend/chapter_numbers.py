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


# A sync merge parks incoming chapter numbers here while it applies rows, and the
# settling below passes through a second band; live chapters never get this high.
MERGE_NUMBER_BAND = 1_000_000_000
_SETTLE_BAND = 1_500_000_000


def wanted_number(value):
    """A chapter number from merged data, or None when it isn't a usable one."""
    try:
        num = int(value)
    except (TypeError, ValueError):
        return None
    return num if 0 < num < MERGE_NUMBER_BAND else None


def settle_chapter_numbers(cursor, wanted: dict) -> None:
    """Gives the live chapters contiguous numbers 1..N after a sync merge.

    `wanted` maps chapter ids to the numbers the merge brought in (None when the
    incoming value was unusable: that chapter goes last). Every other live chapter
    keeps its place. When two chapters want the same number (both devices added a
    chapter, or one moved a chapter onto a number the other still uses), the
    chapter that already held it comes first. Applying a reorder row by row would
    trip the UNIQUE constraint, so the merge applies incoming numbers in
    MERGE_NUMBER_BAND and this settles them. Only numbers that differ from what
    the merged change log already says are logged.
    """
    cursor.execute(
        "SELECT id, chapter_number, COALESCE(created_at, '') FROM chapters WHERE deleted = 0")
    rows = [(r[0], r[1], r[2]) for r in cursor.fetchall()]

    def order(row):
        chap_id, num, created = row
        if chap_id in wanted:
            target = wanted[chap_id]
            return (target if target is not None else MERGE_NUMBER_BAND, 1, created, chap_id)
        return (num, 0, created, chap_id)

    ordered = sorted(rows, key=order)
    for i, (chap_id, _num, _created) in enumerate(ordered):
        cursor.execute("UPDATE chapters SET chapter_number = ? WHERE id = ?", (_SETTLE_BAND + i, chap_id))
    for i, (chap_id, num, _created) in enumerate(ordered, start=1):
        cursor.execute("UPDATE chapters SET chapter_number = ? WHERE id = ?", (i, chap_id))
        logged = wanted[chap_id] if chap_id in wanted else num
        if logged != i:
            log_change(cursor, "chapters", chap_id, {"chapter_number": i})

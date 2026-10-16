"""
Chapter numbers through a sync merge.

chapters.chapter_number is UNIQUE (deleted rows included), so a merge that
applies incoming numbers one row at a time collides as soon as another device
reordered chapters, or both devices added a chapter at the same number. These
tests drive routes/sync.sync_apply with change logs shaped the way each side
writes them.
"""

import json
import os
import shutil
import sqlite3
import tempfile
import unittest
import uuid

import db_setup
import sync_core
from routes import sync

DESK, PHONE = "desk-device", "phone-device"


def _project(parent: str) -> str:
    path = os.path.join(parent, "Desk")
    os.makedirs(os.path.join(path, "md"))
    db_setup.generate_project_db(path, {"project_name": "Desk", "author_name": "T", "genre": "fantasy"})
    with open(os.path.join(path, "fleshnote_project.json"), "w", encoding="utf-8") as f:
        json.dump({"project_name": "Desk", "schema_version": 2, "project_id": str(uuid.uuid4())}, f)
    return path


def _connect(path):
    conn = sqlite3.connect(os.path.join(path, "fleshnote.db"))
    return conn, conn.cursor()


def _add_chapter(cur, number: int, title: str) -> str:
    chap_id = str(uuid.uuid4())
    md = f"ch_{chap_id[:8]}.md"
    cur.execute("INSERT INTO chapters (id, chapter_number, title, md_filename) VALUES (?,?,?,?)",
                (chap_id, number, title, md))
    sync_core.log_change(cur, "chapters", chap_id,
                         {"chapter_number": number, "title": title, "md_filename": md})
    return chap_id


def _phone_renumber(cur, ordered_ids):
    """The companion's renumber: a temp band nobody sees, then 1..N, logging
    only the numbers that changed."""
    before = dict(cur.execute("SELECT id, chapter_number FROM chapters").fetchall())
    for i, chap_id in enumerate(ordered_ids):
        cur.execute("UPDATE chapters SET chapter_number=? WHERE id=?", (1_000_000 + i, chap_id))
    for i, chap_id in enumerate(ordered_ids, start=1):
        cur.execute("UPDATE chapters SET chapter_number=? WHERE id=?", (i, chap_id))
        if before[chap_id] != i:
            sync_core.log_change(cur, "chapters", chap_id, {"chapter_number": i})


def _live_titles(path):
    conn, cur = _connect(path)
    rows = cur.execute(
        "SELECT title, chapter_number FROM chapters WHERE deleted=0 ORDER BY chapter_number").fetchall()
    conn.close()
    return rows


class TestSyncChapterNumbers(unittest.TestCase):
    def setUp(self):
        self._device = sync_core.DEVICE_ID
        self.root = tempfile.mkdtemp(prefix="fn_sync_chnum_")
        sync_core.DEVICE_ID = DESK
        self.desk = _project(self.root)
        conn, cur = _connect(self.desk)
        cur.execute("UPDATE chapters SET deleted=1, chapter_number=-100 WHERE deleted=0")  # scaffold, if any
        self.ids = [_add_chapter(cur, n, t) for n, t in [(1, "A"), (2, "B"), (3, "C")]]
        conn.commit()
        conn.close()
        self.phone = os.path.join(self.root, "Phone")
        shutil.copytree(self.desk, self.phone)

    def tearDown(self):
        sync_core.DEVICE_ID = self._device
        shutil.rmtree(self.root, ignore_errors=True)

    def _merge_phone_into_desk(self):
        sync_core.DEVICE_ID = DESK
        res = sync.sync_apply(sync.SyncApplyRequest(local_path=self.desk, remote_path=self.phone,
                                                    resolutions={}))
        self.assertEqual(res["status"], "ok")

    def test_phone_reorder_merges(self):
        sync_core.DEVICE_ID = PHONE
        conn, cur = _connect(self.phone)
        _phone_renumber(cur, list(reversed(self.ids)))
        conn.commit()
        conn.close()

        self._merge_phone_into_desk()
        self.assertEqual(_live_titles(self.desk), [("C", 1), ("B", 2), ("A", 3)])

        # Nothing left to merge: a second pass changes no chapter numbers.
        preview = sync.sync_preview(sync.SyncPreviewRequest(local_path=self.desk, remote_path=self.phone))
        self.assertEqual(preview["summary"]["entity_updates"], 0)

    def test_both_devices_add_a_chapter_at_the_same_number(self):
        sync_core.DEVICE_ID = DESK
        conn, cur = _connect(self.desk)
        _add_chapter(cur, 4, "Desk four")
        conn.commit()
        conn.close()
        sync_core.DEVICE_ID = PHONE
        conn, cur = _connect(self.phone)
        _add_chapter(cur, 4, "Phone four")
        conn.commit()
        conn.close()

        self._merge_phone_into_desk()
        self.assertEqual(_live_titles(self.desk),
                         [("A", 1), ("B", 2), ("C", 3), ("Desk four", 4), ("Phone four", 5)])
        # The phone's chapter moved, and that move is logged so the phone gets it back.
        conn, cur = _connect(self.desk)
        last = cur.execute(
            "SELECT value, device_id FROM change_log WHERE table_name='chapters' "
            "AND column_name='chapter_number' AND row_id=(SELECT id FROM chapters WHERE title='Phone four') "
            "ORDER BY hlc DESC LIMIT 1").fetchone()
        conn.close()
        self.assertEqual((last[0], last[1]), ("5", DESK))

    def test_deleted_chapters_parked_on_the_same_number(self):
        from chapter_numbers import retire_chapter
        sync_core.DEVICE_ID = DESK
        conn, cur = _connect(self.desk)
        retire_chapter(cur, self.ids[0])  # parked below the scaffold row's -100
        cur.execute("UPDATE chapters SET chapter_number=2 WHERE id=?", (self.ids[1],))
        sync_core.log_change(cur, "chapters", self.ids[1], {"chapter_number": 2})
        conn.commit()
        conn.close()
        sync_core.DEVICE_ID = PHONE
        conn, cur = _connect(self.phone)
        retire_chapter(cur, self.ids[2])  # the same parking number on the other device
        conn.commit()
        conn.close()

        self._merge_phone_into_desk()
        self.assertEqual(_live_titles(self.desk), [("B", 1)])
        conn, cur = _connect(self.desk)
        parked = [r[0] for r in cur.execute("SELECT chapter_number FROM chapters WHERE deleted=1")]
        conn.close()
        self.assertTrue(all(n < 0 for n in parked))
        self.assertEqual(len(parked), len(set(parked)))


if __name__ == "__main__":
    unittest.main()

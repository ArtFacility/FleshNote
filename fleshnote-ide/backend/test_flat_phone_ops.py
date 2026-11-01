"""Phone ops in the flat text model (pentimento_sessions.op_model = 'flat') are
placed on paragraphs like desktop ops: heatmap, op pacing, compacted aggregates.
Phone sessions recorded before the marker stay out, as before."""
import os
import sys
import json
import shutil
import sqlite3
import tempfile
import unittest
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import db_setup
from routes import pentimento as pent


class FlatPhoneOpsTest(unittest.TestCase):
    def setUp(self):
        self.project = tempfile.mkdtemp(prefix="fn_flat_ops_")
        db_setup.generate_project_db(self.project, {"project_name": "Flat", "genre": "fantasy"})
        self.conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        cur = self.conn.cursor()
        self.ch = cur.execute(
            "SELECT id FROM chapters WHERE deleted=0 ORDER BY chapter_number LIMIT 1").fetchone()[0]

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.project, ignore_errors=True)

    def _session(self, device, kind, op_model, text, para, compacted=False):
        sid = str(uuid.uuid4())
        cur = self.conn.cursor()
        summary = None
        if compacted:
            summary = json.dumps({"paras": {str(para): {
                "time_ms": 500, "inserted": len(text), "deleted": 0, "revisions": 0, "night_ms": 0}},
                "totals": {}})
        cur.execute(
            "INSERT INTO pentimento_sessions (id, chapter_id, device_id, session_num, start_time, "
            "session_hash, summary_json, device_kind, op_model) VALUES (?,?,?,?,?,?,?,?,?)",
            (sid, self.ch, device, 1, "2026-10-29T10:00:00", "a" * 64, summary, kind, op_model))
        if not compacted:
            cur.execute(
                "INSERT INTO pentimento_ops (session_id, chapter_id, timestamp, op_type, para_index, "
                "char_offset, length, text_content, duration_ms, origin, source) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (sid, self.ch, "2026-10-29T10:00:01.000Z", "insert", para, 0, len(text), text,
                 500, kind, "human"))
        self.conn.commit()
        return sid

    def _heat(self, device=None):
        res = pent.heatmap(pent.ChapterDeviceScoped(
            project_path=self.project, chapter_id=self.ch, device_id=device))
        return {p["para_index"]: p["inserted"] for p in res["paragraphs"]}

    def _ops(self, device=None):
        res = pent.get_ops(pent.ChapterDeviceScoped(
            project_path=self.project, chapter_id=self.ch, device_id=device))
        return sorted(o["text_content"] for o in res["ops"])

    def test_marked_phone_ops_count_and_old_ones_stay_out(self):
        self._session("desk", "desktop", None, "Desk", 0)
        self._session("phone", "mobile", "flat", "Flat phone", 1)
        self._session("phone", "mobile", None, "Old phone", 2)

        self.assertEqual(self._heat(), {0: 4, 1: 10})
        self.assertEqual(self._ops(), ["Desk", "Flat phone"])
        # The device filter applies the same rule.
        self.assertEqual(self._heat("phone"), {1: 10})
        self.assertEqual(self._ops("phone"), ["Flat phone"])
        self.assertEqual(self._ops("desk"), ["Desk"])

    def test_ops_without_a_session_row_keep_the_old_rule(self):
        cur = self.conn.cursor()
        for text, origin in (("Orphan desk", "desktop"), ("Orphan phone", "mobile")):
            cur.execute(
                "INSERT INTO pentimento_ops (session_id, chapter_id, timestamp, op_type, "
                "para_index, char_offset, length, text_content, duration_ms, origin, source) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                ("gone", self.ch, "2026-10-29T10:00:02.000Z", "insert", 3, 0, len(text),
                 text, 500, origin, "human"))
        self.conn.commit()
        self.assertEqual(self._ops(), ["Orphan desk"])
        self.assertEqual(self._heat(), {3: 11})
        self.assertEqual(self._ops("desk"), [])

    def test_compacted_phone_sessions_follow_their_marker(self):
        self._session("desk", "desktop", None, "Desk", 0, compacted=True)
        self._session("phone", "mobile", "flat", "Flat phone", 1, compacted=True)
        self._session("phone", "mobile", None, "Old phone", 2, compacted=True)

        self.assertEqual(self._heat(), {0: 4, 1: 10})
        self.assertEqual(self._heat("phone"), {1: 10})

    def test_older_databases_gain_the_column(self):
        cols = {c[1] for c in self.conn.execute("PRAGMA table_info(pentimento_sessions)")}
        self.assertIn("op_model", cols)
        # A database made before the column: the schema helper adds it.
        conn = sqlite3.connect(":memory:")
        conn.execute("CREATE TABLE pentimento_sessions (id TEXT PRIMARY KEY, chapter_id TEXT, "
                     "device_id TEXT, session_num INTEGER, start_time TEXT)")
        db_setup.ensure_process_history_schema(conn.cursor(), "desk")
        cols = {c[1] for c in conn.execute("PRAGMA table_info(pentimento_sessions)")}
        self.assertIn("op_model", cols)
        conn.close()


if __name__ == "__main__":
    unittest.main()

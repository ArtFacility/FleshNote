"""Pentimento session sealing after crashes and late flushes:
- starting a session seals the chapter's latest unsealed one (crash/kill) and chains to it
- an older unsealed session that already has a successor is left alone
- flushing into a sealed session is refused
- recovered ops already stored are skipped
- ending an already sealed session changes nothing
- night writing is judged by local hour, while ops are stamped in UTC
"""
import os
import sys
import shutil
import tempfile
import sqlite3
import datetime
import uuid
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "tools"))

from fastapi import HTTPException
from db_setup import generate_project_db
from routes import pentimento as pent
import verify_pentimento


def _op(text, ts, para=0, offset=0, op_type="insert"):
    return {"timestamp": ts, "op_type": op_type, "para_index": para, "char_offset": offset,
            "length": len(text), "text_content": text, "duration_ms": 400, "source": "human"}


class TestPentimentoSealing(unittest.TestCase):
    def setUp(self):
        self.project = os.path.join(tempfile.gettempdir(), "fn_pent_seal_" + uuid.uuid4().hex[:8])
        os.makedirs(self.project)
        generate_project_db(self.project, {"project_name": "Seal", "genre": "fantasy"})
        self.db_path = os.path.join(self.project, "fleshnote.db")
        conn = sqlite3.connect(self.db_path)
        self.ch = conn.execute("SELECT id FROM chapters WHERE chapter_number=1").fetchone()[0]
        conn.close()

    def tearDown(self):
        shutil.rmtree(self.project, ignore_errors=True)

    def _start(self):
        return pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))

    def _flush(self, sid, ops, recovery=False):
        return pent.flush(pent.FlushRequest(project_path=self.project, session_id=sid,
                                            chapter_id=self.ch, ops=ops, recovery=recovery))

    def _session(self, sid):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM pentimento_sessions WHERE id=?", (sid,)).fetchone()
        conn.close()
        return row

    def _chain_issues(self):
        # no receipts here, so any placeholder key will do
        keys = os.path.join(self.project, "keys.json")
        with open(keys, "w", encoding="utf-8") as f:
            f.write('{"key_id": "test", "public_key": "00"}')
        report = verify_pentimento.verify_project(self.project, None, keys)
        return [i for ch in report["chapters"].values() for i in ch["issues"]
                if "receipt" not in i]

    def test_next_start_seals_crashed_session(self):
        s1 = self._start()["session_id"]
        self._flush(s1, [_op("Hello", "2026-10-04T08:00:01.000Z")])
        # no session/end: the app was killed
        res = self._start()
        sealed = self._session(s1)
        self.assertTrue(sealed["session_hash"])
        self.assertEqual(res["previous_session_hash"], sealed["session_hash"])
        self.assertEqual(self._session(res["session_id"])["previous_session_hash"], sealed["session_hash"])
        # closed at its last op (local time), not at the moment it was found
        self.assertEqual(sealed["end_time"], pent._local_iso("2026-10-04T08:00:01.000Z"))
        pent.session_end(pent.SessionEnd(project_path=self.project, session_id=res["session_id"]))
        self.assertEqual(self._chain_issues(), [])

    def test_older_unsealed_session_is_not_backfilled(self):
        s1 = self._start()["session_id"]
        conn = sqlite3.connect(self.db_path)
        # a successor that chained to nothing, as older versions did after a crash
        s2 = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO pentimento_sessions (id, chapter_id, device_id, session_num, start_time, "
            "end_time, session_hash) VALUES (?,?,?,?,?,?,?)",
            (s2, self.ch, "d", 2, "2026-10-04T09:00:00", "2026-10-04T09:10:00", "ab" * 32))
        conn.commit()
        conn.close()
        self._start()
        self.assertIsNone(self._session(s1)["session_hash"])

    def test_flush_into_sealed_session_is_refused(self):
        s1 = self._start()["session_id"]
        self._flush(s1, [_op("Hi", "2026-10-04T08:00:01.000Z")])
        pent.session_end(pent.SessionEnd(project_path=self.project, session_id=s1))
        with self.assertRaises(HTTPException) as cm:
            self._flush(s1, [_op("late", "2026-10-04T08:00:09.000Z")])
        self.assertEqual(cm.exception.status_code, 409)

    def test_recovery_skips_ops_already_stored(self):
        s1 = self._start()["session_id"]
        a = _op("Hello", "2026-10-04T08:00:01.000Z")
        b = _op(" there", "2026-10-04T08:00:02.000Z", offset=5)
        c = _op(" friend", "2026-10-04T08:00:03.000Z", offset=11)
        self._flush(s1, [a, b])
        out = self._flush(s1, [a, b, c], recovery=True)
        self.assertEqual(out["written"], 1)
        conn = sqlite3.connect(self.db_path)
        n = conn.execute("SELECT COUNT(*) FROM pentimento_ops WHERE session_id=?", (s1,)).fetchone()[0]
        conn.close()
        self.assertEqual(n, 3)

    def test_ending_a_sealed_session_changes_nothing(self):
        s1 = self._start()["session_id"]
        self._flush(s1, [_op("Hi", "2026-10-04T08:00:01.000Z")])
        first = pent.session_end(pent.SessionEnd(project_path=self.project, session_id=s1))
        again = pent.session_end(pent.SessionEnd(project_path=self.project, session_id=s1))
        self.assertTrue(again.get("already_sealed"))
        self.assertEqual(again["session_hash"], first["session_hash"])

    def test_night_hour_is_local(self):
        ts = "2026-10-04T21:30:00.000Z"
        local = datetime.datetime(2026, 10, 4, 21, 30, tzinfo=datetime.timezone.utc).astimezone()
        self.assertEqual(pent._hour(ts), local.hour)
        # timestamps without an offset are already local
        self.assertEqual(pent._hour("2026-10-04T23:15:00"), 23)


if __name__ == "__main__":
    unittest.main()

"""Pentimento baseline + WPM trace tests:
- session/start snapshots the chapter's pre-session state (empty-page baseline for replay)
- snapshot dedup: an unchanged re-open creates no extra snapshot
- flush stores the recorder-authoritative wpm_trace ([para, word_offset, wpm] triples,
  wpm clamped 10-300), replacing wholesale
- get_ops returns wpm_by_session for replay pacing
"""
import os
import sys
import shutil
import tempfile
import sqlite3
import json
import uuid
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from db_setup import generate_project_db
from routes import pentimento as pent
from routes import chapter_history as chh


class TestPentimentoBaseline(unittest.TestCase):
    def setUp(self):
        self.project = os.path.join(tempfile.gettempdir(), "fn_pent_baseline_" + uuid.uuid4().hex[:8])
        os.makedirs(self.project)
        generate_project_db(self.project, {"project_name": "Pent", "genre": "fantasy"})
        self.db_path = os.path.join(self.project, "fleshnote.db")
        conn = sqlite3.connect(self.db_path)
        self.ch = conn.execute("SELECT id FROM chapters WHERE chapter_number=1").fetchone()[0]
        conn.close()

    def tearDown(self):
        shutil.rmtree(self.project, ignore_errors=True)

    def _snap_count(self):
        conn = sqlite3.connect(self.db_path)
        n = conn.execute(
            "SELECT COUNT(*) FROM chapter_snapshots WHERE chapter_id=?", (self.ch,)).fetchone()[0]
        conn.close()
        return n

    def test_session_start_creates_baseline_snapshot(self):
        self.assertEqual(self._snap_count(), 0)
        res = pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))
        self.assertTrue(res["session_id"])
        # pre-session state captured -> replay has a frame to interpolate from
        self.assertEqual(self._snap_count(), 1)
        lst = chh.history_list(chh.ChapterScoped(project_path=self.project, chapter_id=self.ch))
        self.assertEqual(lst["snapshots"][0]["session_id"], res["session_id"])

    def test_session_start_dedup_on_unchanged_content(self):
        pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))
        n = self._snap_count()
        # re-open with no writes in between -> deduped, no snapshot pile-up
        pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))
        self.assertEqual(self._snap_count(), n)

    def test_flush_replaces_wpm_trace(self):
        res = pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))
        sid = res["session_id"]
        base = {"project_path": self.project, "session_id": sid, "chapter_id": self.ch}
        # [para, word_offset, wpm] triples; wpm clamped to 10-300 on store
        pent.flush(pent.FlushRequest(**base, ops=[], wpm_trace=[
            [0, 0, 120], [0, 1, 80], [0, 2, 9999], [0, 3, 1]]))
        pent.flush(pent.FlushRequest(**base, ops=[], wpm_trace=[[0, 0, 55], [1, 4, 90]]))
        conn = sqlite3.connect(self.db_path)
        trace = json.loads(conn.execute(
            "SELECT wpm_trace FROM pentimento_sessions WHERE id=?", (sid,)).fetchone()[0])
        conn.close()
        # recorder-authoritative: the second flush REPLACED the trace wholesale
        self.assertEqual(trace, [[0, 0, 55], [1, 4, 90]])

    def test_get_ops_returns_wpm_by_session(self):
        res = pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))
        sid = res["session_id"]
        pent.flush(pent.FlushRequest(
            project_path=self.project, session_id=sid, chapter_id=self.ch,
            ops=[{"timestamp": "2026-09-21T10:00:00", "op_type": "insert", "para_index": 0,
                  "char_offset": 0, "length": 5, "text_content": "hello", "duration_ms": 900}],
            wpm_trace=[[0, 0, 42]]))
        out = pent.get_ops(pent.ChapterDeviceScoped(project_path=self.project, chapter_id=self.ch))
        self.assertEqual(out["wpm_by_session"].get(sid), [[0, 0, 42]])
        self.assertEqual(len(out["ops"]), 1)

    def test_op_source_roundtrip(self):
        res = pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))
        sid = res["session_id"]
        ts = "2026-09-21T10:00:00"
        pent.flush(pent.FlushRequest(
            project_path=self.project, session_id=sid, chapter_id=self.ch, ops=[
                {"timestamp": ts, "op_type": "insert", "para_index": 0, "char_offset": 0,
                 "length": 5, "text_content": "hello", "duration_ms": 900, "source": "human"},
                {"timestamp": ts, "op_type": "insert", "para_index": 0, "char_offset": 6,
                 "length": 9, "text_content": "robot text", "duration_ms": 5, "source": "machine"},
                {"timestamp": ts, "op_type": "insert", "para_index": 0, "char_offset": 16,
                 "length": 22, "text_content": "pasted block here ok!!", "duration_ms": 3, "source": "paste"},
                {"timestamp": ts, "op_type": "insert", "para_index": 1, "char_offset": 0,
                 "length": 4, "text_content": "legacy", "duration_ms": 900},
            ]))
        out = pent.get_ops(pent.ChapterDeviceScoped(project_path=self.project, chapter_id=self.ch))
        by_text = {o["text_content"]: o["source"] for o in out["ops"]}
        self.assertEqual(by_text["hello"], "human")
        self.assertEqual(by_text["robot text"], "machine")
        self.assertEqual(by_text["pasted block here ok!!"], "paste")
        # legacy rows with no source default: paste type → paste, else human
        self.assertEqual(by_text["legacy"], "human")

    def test_op_source_invalid_falls_back(self):
        res = pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))
        sid = res["session_id"]
        ts = "2026-09-21T10:00:00"
        pent.flush(pent.FlushRequest(
            project_path=self.project, session_id=sid, chapter_id=self.ch, ops=[
                {"timestamp": ts, "op_type": "insert", "para_index": 0, "char_offset": 0,
                 "length": 3, "text_content": "abc", "duration_ms": 100, "source": "bogus"},
            ]))
        out = pent.get_ops(pent.ChapterDeviceScoped(project_path=self.project, chapter_id=self.ch))
        self.assertEqual(out["ops"][0]["source"], "human")

    def test_end_to_end_dedup_across_sessions(self):
        # Two full sessions with no prose change in between: the baseline snapshot
        # exists once, and unchanged session-end snapshots dedup — no pile-up.
        r1 = pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))
        pent.session_end(pent.SessionEnd(project_path=self.project, session_id=r1["session_id"]))
        r2 = pent.session_start(pent.SessionStart(project_path=self.project, chapter_id=self.ch))
        pent.session_end(pent.SessionEnd(project_path=self.project, session_id=r2["session_id"]))
        lst = chh.history_list(chh.ChapterScoped(project_path=self.project, chapter_id=self.ch))
        sids = [s["session_id"] for s in lst["snapshots"]]
        self.assertEqual(len(sids), 1)
        self.assertEqual(sids[0], r1["session_id"])


if __name__ == "__main__":
    unittest.main()

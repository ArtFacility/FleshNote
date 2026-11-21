"""Pentimento Focus Mode session splitting, flags, snapshots, and hash integrity."""
import os
import sys
import json
import shutil
import sqlite3
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "tools"))

import sync_core
import db_setup
import process_history
from routes import pentimento as pent, chapter_history
import verify_pentimento


class PentimentoFocusTests(unittest.TestCase):
    def setUp(self):
        self._orig_device = sync_core.DEVICE_ID
        sync_core.DEVICE_ID = "desk-focus-test"
        self.root = tempfile.mkdtemp(prefix="fn_penti_focus_")
        self.proj = os.path.join(self.root, "Novel")
        os.makedirs(os.path.join(self.proj, "md"), exist_ok=True)
        db_setup.generate_project_db(self.proj, {"project_name": "Novel", "genre": "fantasy"})
        with open(os.path.join(self.proj, "fleshnote_project.json"), "w", encoding="utf-8") as f:
            json.dump({"project_id": "proj-focus", "schema_version": 2}, f)
        conn = sqlite3.connect(os.path.join(self.proj, "fleshnote.db"))
        row = conn.execute("SELECT id, md_filename FROM chapters WHERE deleted=0 LIMIT 1").fetchone()
        if row:
            self.cid = str(row[0])
            md_name = row[1]
            conn.execute("UPDATE chapters SET word_count=5 WHERE id=?", (self.cid,))
        else:
            self.cid = "1"
            md_name = "chapter_1.md"
            conn.execute(
                "INSERT INTO chapters (id, chapter_number, title, word_count, md_filename, deleted) "
                "VALUES (?, 1, 'Chapter One', 5, ?, 0)", (self.cid, md_name)
            )
        with open(os.path.join(self.proj, "md", md_name), "w", encoding="utf-8") as f:
            f.write("Before focus text.")
        conn.commit()
        conn.close()
        self.md_path = os.path.join(self.proj, "md", md_name)
        pent._SCHEMA_READY.clear()

    def tearDown(self):
        sync_core.DEVICE_ID = self._orig_device
        shutil.rmtree(self.root, ignore_errors=True)

    def test_focus_session_split_preserves_chain_and_snapshots(self):
        # 1. Start a normal session and record pre-focus text.
        s1 = pent.session_start(pent.SessionStart(project_path=self.proj, chapter_id=self.cid))
        pent.flush(pent.FlushRequest(
            project_path=self.proj,
            session_id=s1["session_id"],
            chapter_id=self.cid,
            ops=[pent.Op(timestamp="2026-11-18T10:00:00Z", op_type="insert",
                         para_index=0, char_offset=0, length=6, text_content="Hello ")],
        ))
        # Simulate editor auto-save having overwritten disk BEFORE split at word 50 / min 5.
        with open(self.md_path, "w", encoding="utf-8") as f:
            f.write("Before focus text. Plus fifty focus words already auto-saved!")

        # Seal S1 with the exact pre-focus HTML captured on Focus enter.
        pent.session_end(pent.SessionEnd(
            project_path=self.proj,
            session_id=s1["session_id"],
            snapshot_html="<p>Before focus text.</p>",
        ))

        # 2. Start pure Focus session S2 (e.g. Zen, 400w).
        s2 = pent.session_start(pent.SessionStart(
            project_path=self.proj,
            chapter_id=self.cid,
            focus_mode="zen",
            focus_goal=400,
            started_at="2026-11-18T10:01:00Z",
            snapshot_html="<p>Before focus text.</p>",
        ))
        pent.flush(pent.FlushRequest(
            project_path=self.proj,
            session_id=s2["session_id"],
            chapter_id=self.cid,
            ops=[pent.Op(timestamp="2026-11-18T10:05:00Z", op_type="insert",
                         para_index=0, char_offset=6, length=12, text_content="zen words...")],
        ))
        pent.session_end(pent.SessionEnd(
            project_path=self.proj,
            session_id=s2["session_id"],
            focus_completed=True,
        ))

        # Verify hash chain still passes Sealed Pentimento verifier.
        keys_path = os.path.join(self.root, "keys.json")
        with open(keys_path, "w", encoding="utf-8") as f:
            f.write('{"key_id": "test", "public_key": "00"}')
        report = verify_pentimento.verify_project(self.proj, None, keys_path)
        issues = [i for ch in report["chapters"].values() for i in ch["issues"] if "receipt" not in i]
        self.assertEqual(issues, [])
        ch_rep = next(iter(report["chapters"].values()))
        self.assertEqual(ch_rep["sessions"], 2)

        # Verify history/list exposes focus metadata & S1 snapshot got exact pre-focus text.
        hist = chapter_history.history_list(chapter_history.ChapterScoped(
            project_path=self.proj, chapter_id=self.cid
        ))
        by_id = {s["id"]: s for s in hist["sessions"]}
        self.assertIsNone(by_id[s1["session_id"]]["focus_mode"])
        self.assertEqual(by_id[s2["session_id"]]["focus_mode"], "zen")
        self.assertEqual(by_id[s2["session_id"]]["focus_category"], "rewarding")
        self.assertEqual(by_id[s2["session_id"]]["focus_goal"], 400)
        self.assertTrue(by_id[s2["session_id"]]["focus_completed"])

        s1_end_snaps = [sn for sn in hist["snapshots"] if sn["session_id"] == s1["session_id"]]
        self.assertTrue(s1_end_snaps)
        preview = chapter_history.history_preview(chapter_history.SnapshotScoped(
            project_path=self.proj, snapshot_id=s1_end_snaps[0]["id"]
        ))
        self.assertIn("Before focus text.", preview["content_html"])
        self.assertNotIn("auto-saved", preview["content_html"])

        # Summary totals aggregate focus sessions properly.
        summ = pent.summary(pent.ProjectScoped(project_path=self.proj))
        self.assertEqual(summ["focus_sessions"]["total"], 1)
        self.assertEqual(summ["focus_sessions"]["completed"], 1)
        self.assertEqual(summ["focus_sessions"]["by_category"]["rewarding"], 1)
        self.assertEqual(summ["focus_sessions"]["by_mode"]["zen"], 1)

    def test_schema_migration_and_sync_import(self):
        # Older DB missing focus_* columns gets upgraded by ensure_process_history_schema.
        old_db_dir = os.path.join(self.root, "Old")
        os.makedirs(old_db_dir)
        conn = sqlite3.connect(os.path.join(old_db_dir, "fleshnote.db"))
        conn.execute(
            "CREATE TABLE pentimento_sessions (id TEXT PRIMARY KEY, chapter_id TEXT, "
            "device_id TEXT, session_num INTEGER, start_time TEXT)"
        )
        conn.execute("CREATE TABLE pentimento_ops (id TEXT PRIMARY KEY, session_id TEXT, origin TEXT)")
        db_setup.ensure_process_history_schema(conn.cursor(), "desk-old")
        cols = {c[1] for c in conn.execute("PRAGMA table_info(pentimento_sessions)").fetchall()}
        conn.close()
        self.assertTrue({"focus_mode", "focus_category", "focus_goal", "focus_completed"}.issubset(cols))

        # Multi-device import copies focus columns while keeping chain valid.
        s = pent.session_start(pent.SessionStart(
            project_path=self.proj, chapter_id=self.cid, focus_mode="kamikaze", focus_goal=250
        ))
        pent.flush(pent.FlushRequest(
            project_path=self.proj, session_id=s["session_id"], chapter_id=self.cid,
            ops=[pent.Op(timestamp="2026-11-18T11:00:00Z", op_type="insert",
                         para_index=0, char_offset=0, length=4, text_content="fast")],
        ))
        pent.session_end(pent.SessionEnd(
            project_path=self.proj, session_id=s["session_id"], focus_completed=False
        ))

        clone = os.path.join(self.root, "Clone")
        os.makedirs(os.path.join(clone, "md"), exist_ok=True)
        db_setup.generate_project_db(clone, {"project_name": "Novel", "genre": "fantasy"})
        cl_conn = sqlite3.connect(os.path.join(clone, "fleshnote.db"))
        cl_conn.row_factory = sqlite3.Row
        db_setup.ensure_process_history_schema(cl_conn.cursor(), "other-device")
        if not cl_conn.execute("SELECT 1 FROM chapters WHERE id=?", (self.cid,)).fetchone():
            cl_conn.execute("DELETE FROM chapters")
            cl_conn.execute(
                "INSERT INTO chapters (id, chapter_number, title, word_count, md_filename, deleted) "
                "VALUES (?, 1, 'Chapter One', 5, 'chapter_1.md', 0)", (self.cid,)
            )
        cr_conn = sqlite3.connect(os.path.join(self.proj, "fleshnote.db"))
        cr_conn.row_factory = sqlite3.Row
        stats = process_history.import_process_history(
            cl_conn.cursor(), cr_conn.cursor(), local_device="other-device",
            remote_device="desk-focus-test",
        )
        cl_conn.commit()
        row = cl_conn.execute(
            "SELECT focus_mode, focus_category, focus_goal, focus_completed "
            "FROM pentimento_sessions WHERE id=?", (s["session_id"],)
        ).fetchone()
        cl_conn.close()
        cr_conn.close()
        self.assertEqual(stats["rejected"], 0)
        self.assertEqual(dict(row), {
            "focus_mode": "kamikaze",
            "focus_category": "punishing",
            "focus_goal": 250,
            "focus_completed": 0,
        })

    def test_sync_sanitizes_focus_columns(self):
        # Directly insert two sealed sessions in source project: one bogus mode, one mismatched category.
        s_bad = pent.session_start(pent.SessionStart(project_path=self.proj, chapter_id=self.cid))
        pent.session_end(pent.SessionEnd(project_path=self.proj, session_id=s_bad["session_id"]))
        s_mis = pent.session_start(pent.SessionStart(project_path=self.proj, chapter_id=self.cid))
        pent.session_end(pent.SessionEnd(project_path=self.proj, session_id=s_mis["session_id"]))

        cr_conn = sqlite3.connect(os.path.join(self.proj, "fleshnote.db"))
        cr_conn.row_factory = sqlite3.Row
        cr_conn.execute(
            "UPDATE pentimento_sessions SET focus_mode='bogus_mode', focus_category='punishing', "
            "focus_goal=999, focus_completed=1 WHERE id=?", (s_bad["session_id"],)
        )
        cr_conn.execute(
            "UPDATE pentimento_sessions SET focus_mode='zen', focus_category='punishing', "
            "focus_goal=-5, focus_completed=1 WHERE id=?", (s_mis["session_id"],)
        )
        cr_conn.commit()

        clone = os.path.join(self.root, "CloneSanitize")
        os.makedirs(os.path.join(clone, "md"), exist_ok=True)
        db_setup.generate_project_db(clone, {"project_name": "Novel", "genre": "fantasy"})
        cl_conn = sqlite3.connect(os.path.join(clone, "fleshnote.db"))
        cl_conn.row_factory = sqlite3.Row
        db_setup.ensure_process_history_schema(cl_conn.cursor(), "other-device")
        cl_conn.execute("DELETE FROM chapters")
        cl_conn.execute(
            "INSERT INTO chapters (id, chapter_number, title, word_count, md_filename, deleted) "
            "VALUES (?, 1, 'Chapter One', 5, 'chapter_1.md', 0)", (self.cid,)
        )

        stats = process_history.import_process_history(
            cl_conn.cursor(), cr_conn.cursor(), local_device="other-device",
            remote_device="desk-focus-test",
        )
        cl_conn.commit()
        bad_row = dict(cl_conn.execute(
            "SELECT focus_mode, focus_category, focus_goal, focus_completed "
            "FROM pentimento_sessions WHERE id=?", (s_bad["session_id"],)
        ).fetchone())
        mis_row = dict(cl_conn.execute(
            "SELECT focus_mode, focus_category, focus_goal, focus_completed "
            "FROM pentimento_sessions WHERE id=?", (s_mis["session_id"],)
        ).fetchone())
        cl_conn.close()
        cr_conn.close()

        self.assertEqual(stats["rejected"], 0)
        self.assertEqual(bad_row, {
            "focus_mode": None,
            "focus_category": None,
            "focus_goal": None,
            "focus_completed": None,
        })
        self.assertEqual(mis_row, {
            "focus_mode": "zen",
            "focus_category": "rewarding",
            "focus_goal": None,
            "focus_completed": 1,
        })


if __name__ == "__main__":
    unittest.main()

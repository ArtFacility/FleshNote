import json
import os
import shutil
import sqlite3
import sys
import unittest
import uuid

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_setup
from main import scan_workspace, WorkspaceRequest, _get_book_stats


class TestProjectScanBookStats(unittest.TestCase):
    """Bookshelf picker data: word counts, completion, look, stable id."""

    def setUp(self):
        self.workspace = os.path.join(backend_dir, "temp_test_project_scan", uuid.uuid4().hex)
        os.makedirs(self.workspace)

    def tearDown(self):
        shutil.rmtree(self.workspace, ignore_errors=True)

    def _make_project(self, folder, chapters, project_id=None, look=None):
        path = os.path.join(self.workspace, folder)
        os.makedirs(path)
        db_setup.generate_project_db(path, {"project_name": folder, "genre": "fantasy"})
        conn = sqlite3.connect(os.path.join(path, "fleshnote.db"))
        cur = conn.cursor()
        cur.execute("DELETE FROM chapters")
        for i, (words, status, deleted) in enumerate(chapters, start=1):
            cur.execute(
                "INSERT INTO chapters (id, chapter_number, title, word_count, status, deleted) VALUES (?,?,?,?,?,?)",
                (f"ch-{i}", i, f"Ch {i}", words, status, deleted))
        for key, value in (look or {}).items():
            cur.execute(
                "INSERT OR REPLACE INTO project_config (config_key, config_value, config_type) VALUES (?,?,'meta')",
                (key, value))
        conn.commit()
        conn.close()
        with open(os.path.join(path, "fleshnote_project.json"), "w", encoding="utf-8") as f:
            meta = {"project_name": folder, "schema_version": 2}
            if project_id:
                meta["project_id"] = project_id
            json.dump(meta, f)
        return path

    def _scan(self):
        return {p["name"]: p for p in scan_workspace(WorkspaceRequest(workspace_path=self.workspace))["projects"]}

    def test_finished_project(self):
        pid = str(uuid.uuid4())
        # A deleted non-final chapter must not block "finished"
        self._make_project("Done.flnote", [(1200, "final", 0), (800, "final", 0), (5000, "draft", 1)],
                           project_id=pid, look={"book_color": "#7a2e2e", "book_rune": "𐲀"})
        p = self._scan()["Done"]
        self.assertEqual(p["project_id"], pid)
        self.assertEqual(p["word_count"], 2000)
        self.assertEqual(p["chapter_count"], 2)
        self.assertEqual(p["final_count"], 2)
        self.assertTrue(p["finished"])
        self.assertEqual(p["book_color"], "#7a2e2e")
        self.assertEqual(p["book_rune"], "𐲀")

    def test_partial_project(self):
        self._make_project("Half.flnote", [(300, "final", 0), (100, "writing", 0)])
        p = self._scan()["Half"]
        self.assertEqual(p["word_count"], 400)
        self.assertFalse(p["finished"])
        self.assertIsNone(p["book_color"])
        self.assertIsNone(p["book_rune"])

    def test_empty_project_is_not_finished(self):
        self._make_project("Empty.flnote", [])
        p = self._scan()["Empty"]
        self.assertEqual(p["chapter_count"], 0)
        self.assertFalse(p["finished"])

    def test_missing_project_id_falls_back_to_path(self):
        path = self._make_project("NoId.flnote", [(10, "draft", 0)])
        self.assertEqual(self._scan()["NoId"]["project_id"], path)

    def test_duplicate_project_ids_get_distinct_keys(self):
        # A received clone sits next to its original with the same project_id
        pid = str(uuid.uuid4())
        self._make_project("Original.flnote", [(10, "draft", 0)], project_id=pid)
        self._make_project("Copy.flnote", [(10, "draft", 0)], project_id=pid)
        ids = [p["project_id"] for p in self._scan().values()]
        self.assertEqual(len(set(ids)), 2)
        self.assertIn(pid, ids)

    def test_untrusted_look_values_are_dropped(self):
        self._make_project("Evil.flnote", [(10, "draft", 0)],
                           look={"book_color": "red; background: url(https://x)", "book_rune": "abc"})
        p = self._scan()["Evil"]
        self.assertIsNone(p["book_color"])
        self.assertIsNone(p["book_rune"])

    def test_legacy_schema_degrades(self):
        # v1-style DB: chapters without the soft-delete column, no project_config
        path = os.path.join(self.workspace, "Old")
        os.makedirs(path)
        conn = sqlite3.connect(os.path.join(path, "fleshnote.db"))
        conn.execute("CREATE TABLE chapters (id INTEGER PRIMARY KEY, word_count INTEGER, status TEXT)")
        conn.execute("INSERT INTO chapters (word_count, status) VALUES (500, 'final')")
        conn.commit()
        conn.close()
        stats = _get_book_stats(path)
        self.assertEqual(stats["word_count"], 500)
        self.assertTrue(stats["finished"])
        self.assertIsNone(stats["book_color"])
        p = self._scan()["Old"]
        self.assertTrue(p["needs_migration"])
        self.assertEqual(p["project_id"], path)

    def test_non_project_folder(self):
        self.assertEqual(_get_book_stats(self.workspace)["chapter_count"], 0)


if __name__ == "__main__":
    unittest.main()

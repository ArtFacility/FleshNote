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
from routes.review_export import (
    ReviewScope,
    build_snapshot,
    empty_package,
    migrate_notes,
    reanchor_quote,
    save_package,
    load_package,
    ENTITY_MARKER_RE,
)


class TestReviewExport(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.join(backend_dir, "temp_test_review_export", uuid.uuid4().hex)
        os.makedirs(self.test_dir)
        self.project_path = os.path.join(self.test_dir, "proj")
        os.makedirs(self.project_path)
        db_setup.generate_project_db(self.project_path, {
            "project_name": "Review Test",
            "author_name": "Writer",
            "genre": "fantasy",
            "project_id": "desktop-id-1",
        })
        with open(os.path.join(self.project_path, "fleshnote_project.json"), "w", encoding="utf-8") as f:
            json.dump({"project_id": "desktop-id-1", "project_name": "Review Test", "schema_version": 2}, f)

        md_dir = os.path.join(self.project_path, "md")
        os.makedirs(md_dir, exist_ok=True)
        md_name = "ch_001_test.md"
        with open(os.path.join(md_dir, md_name), "w", encoding="utf-8") as f:
            f.write("Hello {{char:char-1|Sophia}} walked in.\n\nThe night was cold.")

        conn = sqlite3.connect(os.path.join(self.project_path, "fleshnote.db"))
        try:
            conn.execute("DELETE FROM chapters")
            conn.execute("DELETE FROM characters")
            conn.execute(
                "INSERT INTO chapters (id, chapter_number, title, md_filename, word_count, deleted) VALUES (?,?,?,?,?,0)",
                ("ch-1", 1, "Arrival", md_name, 8),
            )
            conn.execute(
                "INSERT INTO characters (id, name, role, bio, true_goal, surface_goal, deleted) VALUES (?,?,?,?,?,?,0)",
                ("char-1", "Sophia", "Protagonist", "Secret bio", "Hidden goal", "Find home"),
            )
            conn.commit()
        finally:
            conn.close()

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_markers_collapse_without_entities(self):
        snap = build_snapshot(self.project_path, ReviewScope(entities=False))
        text = snap["chapters"][0]["text_md"]
        self.assertNotIn("{{char:", text)
        self.assertIn("Sophia", text)
        self.assertIsNone(snap.get("entities"))

    def test_markers_kept_with_entities(self):
        snap = build_snapshot(self.project_path, ReviewScope(entities=True))
        text = snap["chapters"][0]["text_md"]
        self.assertRegex(text, ENTITY_MARKER_RE)
        names = [c["name"] for c in snap["entities"]["characters"]]
        self.assertIn("Sophia", names)

    def test_secrets_stripped(self):
        snap = build_snapshot(self.project_path, ReviewScope(entities=True, with_secrets=False))
        fields = snap["entities"]["characters"][0].get("fields") or {}
        self.assertNotIn("bio", fields)
        self.assertNotIn("true_goal", fields)
        self.assertEqual(fields.get("surface_goal"), "Find home")
        self.assertEqual(fields.get("role"), "Protagonist")

    def test_secrets_included(self):
        snap = build_snapshot(self.project_path, ReviewScope(entities=True, with_secrets=True))
        fields = snap["entities"]["characters"][0].get("fields") or {}
        self.assertEqual(fields.get("bio"), "Secret bio")
        self.assertEqual(fields.get("true_goal"), "Hidden goal")

    def test_package_roundtrip(self):
        snap = build_snapshot(self.project_path, ReviewScope(entities=True))
        pkg = empty_package(snap, "Beta")
        path = os.path.join(self.test_dir, "out.flreview")
        save_package(path, pkg)
        loaded = load_package(path)
        self.assertEqual(loaded["format"], "fleshnote-review/1")
        self.assertIsNone(loaded["crypto"])
        self.assertEqual(loaded["reviewer_label"], "Beta")
        self.assertEqual(loaded["snapshot"]["project"]["desktop_id"], "desktop-id-1")

    def test_reanchor_exact(self):
        res = reanchor_quote("The night was cold and long.", "night was cold")
        self.assertIsNotNone(res)
        self.assertEqual(res["ratio"], 1.0)

    def test_reanchor_fuzzy(self):
        res = reanchor_quote("The night was warm and long.", "night was cold")
        self.assertIsNotNone(res)
        self.assertGreaterEqual(res["ratio"], 0.70)

    def test_migrate_notes_unchanged_sha(self):
        snap = build_snapshot(self.project_path, ReviewScope(entities=True))
        notes = [{
            "id": "n1",
            "chapter_id": "ch-1",
            "category": "comment",
            "body": "hi",
            "anchor_start": 0,
            "anchor_end": 5,
            "anchor_quote": "Hello",
        }]
        carried, dropped = migrate_notes(notes, snap, snap)
        self.assertEqual(len(carried), 1)
        self.assertEqual(len(dropped), 0)
        self.assertEqual(carried[0]["anchor_start"], 0)

    def test_chapter_subset(self):
        snap = build_snapshot(self.project_path, ReviewScope(chapter_ids=["missing"]))
        self.assertEqual(snap["chapters"], [])


if __name__ == "__main__":
    unittest.main()

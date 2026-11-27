import os
import shutil
import sqlite3
import sys
import tempfile
import unittest

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_setup
from routes.book_search import (
    BookReplaceRequest,
    BookSearchRequest,
    BookUndoRequest,
    _display_text,
    replace_book,
    search_book,
    undo_book_replace,
    undo_status,
)


class TestBookSearch(unittest.TestCase):
    def setUp(self):
        self.project = tempfile.mkdtemp(prefix="fn_book_search_")
        os.makedirs(os.path.join(self.project, "md"))
        db_setup.generate_project_db(self.project, {"project_name": "Search Test"})
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        conn.execute("DELETE FROM chapters")
        for cid, number, title, deleted in (
            ("ch-1", 1, "First", 0),
            ("ch-2", 2, "Second", 0),
            ("ch-3", 3, "Deleted", 1),
        ):
            conn.execute(
                "INSERT INTO chapters (id, chapter_number, title, md_filename, word_count, deleted) "
                "VALUES (?,?,?,?,?,?)",
                (cid, number, title, f"{cid}.md", 0, deleted),
            )
        conn.commit()
        conn.close()
        self.write_chapter("ch-1", "<p>The black cat sat on a mat with another cat.</p><p>{{char:c1|Sophia}} purred.</p>")
        self.write_chapter("ch-2", "<p>Another CAT watched her.</p>")
        self.write_chapter("ch-3", "<p>A deleted cat must stay untouched.</p>")
        self.original = {cid: self.read_chapter(cid) for cid in ("ch-1", "ch-2", "ch-3")}

    def tearDown(self):
        shutil.rmtree(self.project, ignore_errors=True)

    def write_chapter(self, cid, content):
        with open(os.path.join(self.project, "md", f"{cid}.md"), "w", encoding="utf-8") as f:
            f.write(content)

    def read_chapter(self, cid):
        with open(os.path.join(self.project, "md", f"{cid}.md"), "r", encoding="utf-8") as f:
            return f.read()

    def search(self, query, case_sensitive=False):
        return search_book(BookSearchRequest(
            project_path=self.project, query=query, case_sensitive=case_sensitive
        ))

    def test_display_text_maps_labels_and_tags_back_to_markdown(self):
        md = '<p>{{char:c1|Sophia}} saw a cat.</p>'
        text, starts, ends = _display_text(md)
        self.assertIn("Sophia saw a cat.", text)
        cat = text.index("cat")
        self.assertEqual(md[starts[cat]:ends[cat + 2]], "cat")
        sophia = text.index("Sophia")
        self.assertEqual(md[starts[sophia]:ends[sophia]], "S")

    def test_search_finds_all_live_chapters_with_context(self):
        response = self.search("cat")
        self.assertEqual(response["total"], 3)
        first = response["results"][0]
        self.assertEqual(first["chapter_id"], "ch-1")
        self.assertEqual(first["match"], "cat")
        self.assertIn("black", first["before"])
        self.assertIn("sat on a mat", first["after"])
        self.assertTrue(first["word_offset"] >= 2)
        self.assertEqual([r["chapter_id"] for r in response["results"]].count("ch-1"), 2)

    def test_search_is_case_insensitive_by_default_and_can_be_exact(self):
        self.assertEqual(self.search("cat")["total"], 3)
        self.assertEqual(self.search("cat", case_sensitive=True)["total"], 2)

    def test_empty_query_returns_no_results(self):
        self.assertEqual(self.search("")["results"], [])

    def test_replace_all_updates_every_live_chapter(self):
        result = replace_book(BookReplaceRequest(
            project_path=self.project, query="cat", replacement="fox"
        ))
        self.assertEqual(result["replaced"], 3)
        self.assertEqual(set(result["chapters"]), {"ch-1", "ch-2"})
        self.assertIn("black fox sat", self.read_chapter("ch-1"))
        self.assertIn("Another fox watched", self.read_chapter("ch-2"))
        self.assertIn("deleted cat", self.read_chapter("ch-3"))
        self.assertIn("{{char:c1|Sophia}}", self.read_chapter("ch-1"))
        self.assertEqual(self.search("cat")["total"], 0)
        self.assertEqual(self.search("fox")["total"], 3)

    def test_replace_only_selected_matches(self):
        found = self.search("cat")["results"]
        target = [r["id"] for r in found if r["chapter_id"] == "ch-1"][0]
        result = replace_book(BookReplaceRequest(
            project_path=self.project, query="cat", replacement="fox", match_ids=[target]
        ))
        self.assertEqual(result["replaced"], 1)
        self.assertIn("black fox sat", self.read_chapter("ch-1"))
        self.assertIn("{{char:c1|Sophia}} purred", self.read_chapter("ch-1"))
        self.assertEqual(self.read_chapter("ch-2"), "<p>Another CAT watched her.</p>")

    def test_replace_inside_entity_label_keeps_marker_intact(self):
        result = replace_book(BookReplaceRequest(
            project_path=self.project, query="Sophia", replacement="Dora"
        ))
        self.assertEqual(result["replaced"], 1)
        self.assertIn("{{char:c1|Dora}}", self.read_chapter("ch-1"))
        self.assertEqual(self.search("Sophia")["total"], 0)
        self.assertEqual(self.search("Dora")["total"], 1)

    def test_undo_replace_all_restores_every_touched_chapter(self):
        replaced = replace_book(BookReplaceRequest(
            project_path=self.project, query="cat", replacement="fox"
        ))
        self.assertTrue(replaced["undo_token"])
        status_req = BookUndoRequest(
            project_path=self.project, undo_token=replaced["undo_token"]
        )
        self.assertTrue(undo_status(status_req)["available"])
        undone = undo_book_replace(status_req)
        self.assertEqual(undone["undone"], 2)
        self.assertEqual(undone["skipped"], 0)
        for cid in ("ch-1", "ch-2", "ch-3"):
            self.assertEqual(self.read_chapter(cid), self.original[cid])
        self.assertEqual(self.search("cat")["total"], 3)
        self.assertFalse(undo_status(status_req)["available"])
        with self.assertRaises(Exception) as ctx:
            undo_book_replace(status_req)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_undo_does_not_overwrite_later_edits(self):
        replaced = replace_book(BookReplaceRequest(
            project_path=self.project, query="cat", replacement="fox"
        ))
        edited = "<p>Another fox watched her. New sentence.</p>"
        self.write_chapter("ch-2", edited)
        undone = undo_book_replace(BookUndoRequest(
            project_path=self.project, undo_token=replaced["undo_token"]
        ))
        self.assertEqual(undone["undone"], 1)
        self.assertEqual(undone["skipped"], 1)
        self.assertEqual(self.read_chapter("ch-1"), self.original["ch-1"])
        self.assertEqual(self.read_chapter("ch-2"), edited)

    def test_replace_updates_word_count(self):
        replace_book(BookReplaceRequest(
            project_path=self.project, query="cat", replacement="enormous fox"
        ))
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        count = conn.execute("SELECT word_count FROM chapters WHERE id = 'ch-2'").fetchone()[0]
        conn.close()
        self.assertEqual(count, 5)


if __name__ == "__main__":
    unittest.main()

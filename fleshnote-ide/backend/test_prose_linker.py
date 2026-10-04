import os
import shutil
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_setup
from prose_linker import NameLinker, spellings_for
from routes.chapters import _entity_md_to_html
from routes.imports import (
    BulkCreateEntitiesRequest,
    BulkEntityDef,
    ConfirmSplitsRequest,
    bulk_create_entities,
    confirm_splits,
)


def linker(**names):
    return NameLinker({n.replace("_", " "): ("character", eid) for n, eid in names.items()})


class TestNameLinker(unittest.TestCase):
    def test_whole_words_only(self):
        text, n = linker(Boka="b1").link("<p>Boka és Bokának a Bokaszárú.</p>")
        self.assertEqual(text, "<p>{{char:b1|Boka}} és Bokának a Bokaszárú.</p>")
        self.assertEqual(n, 1)

    def test_longest_spelling_wins(self):
        text, _ = NameLinker({"Geréb": ("character", "g"), "Geréb Dezső": ("character", "g")}).link(
            "<p>Geréb Dezső, vagyis Geréb.</p>")
        self.assertEqual(text, "<p>{{char:g|Geréb Dezső}}, vagyis {{char:g|Geréb}}.</p>")

    def test_case_sensitive(self):
        text, n = linker(Will="w").link("<p>Will said he will.</p>")
        self.assertEqual(text, "<p>{{char:w|Will}} said he will.</p>")
        self.assertEqual(n, 1)

    def test_existing_markers_are_left_alone(self):
        source = ("<p>{{char:old|Boka}} and {{foreshadow:f1|Boka waits}} and "
                  "{{foreshadow:f2|a <em>Boka</em> glint}} then Boka.</p>")
        text, n = linker(Boka="b1").link(source)
        self.assertEqual(n, 1)
        self.assertTrue(text.startswith("<p>{{char:old|Boka}} and {{foreshadow:f1|Boka waits}} and "
                                        "{{foreshadow:f2|a <em>Boka</em> glint}} then "))
        self.assertTrue(text.endswith("{{char:b1|Boka}}.</p>"))

    def test_tags_and_attributes_are_left_alone(self):
        source = '<p title="Boka"><em>Boka</em></p>'
        text, _ = linker(Boka="b1").link(source)
        self.assertEqual(text, '<p title="Boka"><em>{{char:b1|Boka}}</em></p>')

    def test_escaped_text_matches(self):
        text, n = NameLinker({"Tom & Jerry": ("group", "tj"), "O'Brien": ("character", "o")}).link(
            "<p>Tom &amp; Jerry met O'Brien.</p>")
        self.assertEqual(text, "<p>{{group:tj|Tom &amp; Jerry}} met {{char:o|O'Brien}}.</p>")
        self.assertEqual(n, 2)

    def test_links_survive_loading(self):
        text, _ = linker(Nemecsek="n").link("<p>Nemecsek köhögött.</p>")
        html = _entity_md_to_html(text)
        self.assertIn('data-entity-id="n"', html)
        self.assertIn(">Nemecsek</span>", html)

    def test_shared_and_blocked_spellings_are_dropped(self):
        spellings = spellings_for([
            {"id": "a", "type": "character", "name": "Ács Feri", "aliases": ["Feri"]},
            {"id": "b", "type": "character", "name": "Feri bácsi", "aliases": ["Feri"]},
            {"id": "c", "type": "character", "name": "Pásztor", "aliases": ["Boka"]},
        ], blocked={"boka"})
        self.assertEqual(set(spellings), {"Ács Feri", "Feri bácsi", "Pásztor"})


class TestLinkOnCreate(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="fn_linker_")
        self.project = os.path.join(self.dir, "proj")
        os.makedirs(os.path.join(self.project, "md"))
        db_setup.generate_project_db(self.project, {"project_name": "T"})
        confirm_splits(ConfirmSplitsRequest(project_path=self.project, replace_placeholder=True, splits=[
            {"title": "Egy", "paragraphs": ["Boka és Nemecsek a Pál utca sarkán.", "Nemecseknek fázott a lába."]},
            {"title": "Kettő", "paragraphs": ["Senki sem jött."]},
        ]))

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def db(self):
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        conn.row_factory = sqlite3.Row
        return closing(conn)

    def chapter_files(self):
        with self.db() as c:
            rows = c.execute("SELECT id, md_filename FROM chapters WHERE deleted = 0 "
                             "ORDER BY chapter_number").fetchall()
        out = []
        for r in rows:
            with open(os.path.join(self.project, "md", r["md_filename"]), encoding="utf-8") as f:
                out.append((r["id"], f.read()))
        return out

    def create(self, link, *entities):
        return bulk_create_entities(BulkCreateEntitiesRequest(
            project_path=self.project, link_in_chapters=link,
            entities=[BulkEntityDef(**e) for e in entities]))

    def test_without_the_option_nothing_changes(self):
        before = self.chapter_files()
        result = self.create(False, {"name": "Boka", "type": "character"})
        self.assertEqual(result["linked"], {"links": 0, "chapters": 0})
        self.assertEqual(self.chapter_files(), before)

    def test_links_snapshots_appearances_and_sync(self):
        result = self.create(True,
                             {"name": "Nemecsek", "type": "character", "aliases": ["Nemecseknek"]},
                             {"name": "Pál utca", "type": "location"})
        ids = {c["name"]: c["id"] for c in result["created"]}
        self.assertEqual(result["linked"], {"links": 3, "chapters": 1})

        (first_id, first), (_, second) = self.chapter_files()
        self.assertIn(f"{{{{char:{ids['Nemecsek']}|Nemecsek}}}}", first)
        self.assertIn(f"{{{{char:{ids['Nemecsek']}|Nemecseknek}}}}", first)
        self.assertIn(f"{{{{loc:{ids["Pál utca"]}|Pál utca}}}}", first)
        self.assertNotIn("{{", second)

        with self.db() as c:
            snaps = c.execute("SELECT chapter_id, kind FROM chapter_snapshots").fetchall()
            self.assertEqual([(s["chapter_id"], s["kind"]) for s in snaps], [(first_id, "pre_link")])
            appears = {r["entity_id"] for r in c.execute(
                "SELECT entity_id FROM entity_appearances WHERE chapter_id = ?", (first_id,))}
            self.assertEqual(appears, set(ids.values()))
            hashes = c.execute("SELECT COUNT(*) FROM change_log WHERE row_id = ? AND column_name = 'prose_hash'",
                               (first_id,)).fetchone()[0]
            self.assertEqual(hashes, 2)  # the import and the linking

    def test_names_the_project_already_uses_are_not_linked(self):
        self.create(False, {"name": "Boka", "type": "character"})
        result = self.create(True, {"name": "Boka János", "type": "character", "aliases": ["Boka"]})
        self.assertEqual(result["linked"]["links"], 0)


if __name__ == "__main__":
    unittest.main()

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
from routes.imports import (
    BulkCreateEntitiesRequest,
    BulkEntityDef,
    _alias_is_glued,
    _fold,
    _known_names,
    _reads_as_common_word,
    bulk_create_entities,
)


class TestEntityFinderHelpers(unittest.TestCase):
    def test_fold_strips_accents(self):
        self.assertEqual(_fold("Bokát"), "bokat")

    def test_glued_neighbour_is_detected(self):
        others = ["Csele", "Nemecsek", "Kuno"]
        self.assertTrue(_alias_is_glued("Boka Cseléhez", "Boka", others, set()))
        self.assertTrue(_alias_is_glued("Felharsant Geréb", "Geréb", others, {"felharsant"}))

    def test_real_full_names_are_kept(self):
        others = ["Kuno", "Csele"]
        self.assertFalse(_alias_is_glued("Kuno Lichtenstein", "Lichtenstein", others, set()))
        self.assertFalse(_alias_is_glued("Charlie Marlow", "Marlow", [], set()))
        self.assertFalse(_alias_is_glued("Kurtz", "Mistah Kurtz", [], set()))

    def test_common_word_at_sentence_start(self):
        counts = {"absurd": 6, "company": 2}
        self.assertTrue(_reads_as_common_word("Absurd", counts, 5))
        self.assertFalse(_reads_as_common_word("Company", counts, 10))
        self.assertFalse(_reads_as_common_word("United States", counts, 1))


class TestBulkCreate(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="fn_finder_")
        self.project = os.path.join(self.dir, "proj")
        os.makedirs(os.path.join(self.project, "md"))
        db_setup.generate_project_db(self.project, {"project_name": "T"})

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def create(self, *entities):
        return bulk_create_entities(BulkCreateEntitiesRequest(
            project_path=self.project, entities=[BulkEntityDef(**e) for e in entities]))

    def test_existing_names_are_known_and_skipped(self):
        self.create({"name": "Boka", "type": "character", "aliases": ["Boka János"]},
                    {"name": "Budapest", "type": "location"})
        self.assertEqual(_known_names(self.project), {"boka", "boka jános", "budapest"})
        result = self.create({"name": "boka", "type": "character"}, {"name": "Geréb", "type": "character"})
        self.assertEqual(result["skipped_existing"], 1)
        self.assertEqual([c["name"] for c in result["created"]], ["Geréb"])

    def test_created_entities_are_logged_for_sync(self):
        result = self.create({"name": "Csele", "type": "character"}, {"name": "gitt", "type": "lore", "lore_category": "item"})
        ids = [c["id"] for c in result["created"]]
        with closing(sqlite3.connect(os.path.join(self.project, "fleshnote.db"))) as c:
            logged = {r[0] for r in c.execute("SELECT DISTINCT row_id FROM change_log WHERE column_name = 'name'")}
        self.assertTrue(set(ids) <= logged)


if __name__ == "__main__":
    unittest.main()

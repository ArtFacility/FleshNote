"""Migrating FleshNote 1.2 projects (integer ids) to the 2.0 schema (UUIDs).

Fixtures in test_fixtures/v1_2/ are real 1.2 projects:
- tutorial: the Tutorial project shipped with 1.2 (and still with 2.0)
- legacy_harbor: built by tools/make_v1_fixture.py with the 1.2 code itself, so
  it has every marker type 1.2 wrote into chapter files and every table that
  references another (knowledge, relationships, time overrides, boards, images…)

Each test migrates a fresh copy. Run from backend/:
    .venv/Scripts/python.exe -m unittest test_migration -v
"""
import json
import os
import re
import shutil
import sqlite3
import tempfile
import unittest
from unittest import mock

import migration_engine
from export.pipeline import ExportPipeline

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_fixtures", "v1_2")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
MARKER = re.compile(r"\{\{(\w+):([^|}]+)\|([^}]*)\}\}")
SINGLE = {"char": "characters", "loc": "locations", "item": "lore_entities", "lore": "lore_entities",
          "group": "groups", "quicknote": "quick_notes", "annotation": "annotations",
          "twist": "twists", "foreshadow": "twists"}
DOUBLE = {"knowledge": ("knowledge_states", "characters"), "relationship": ("character_relationships", "characters")}

# (table, column, referenced table) — every reference that must survive as a real row
FOREIGN_KEYS = [
    ("chapters", "pov_character_id", "characters"),
    ("characters", "group_id", "groups"),
    ("group_memberships", "group_id", "groups"),
    ("group_memberships", "character_id", "characters"),
    ("locations", "parent_location_id", "locations"),
    ("knowledge_states", "character_id", "characters"),
    ("knowledge_states", "learned_in_chapter", "chapters"),
    ("knowledge_states", "reveal_in_chapter", "chapters"),
    ("twists", "reveal_chapter_id", "chapters"),
    ("foreshadowings", "twist_id", "twists"),
    ("foreshadowings", "chapter_id", "chapters"),
    ("character_relationships", "character_id", "characters"),
    ("character_relationships", "target_character_id", "characters"),
    ("character_relationships", "chapter_id", "chapters"),
    ("world_times", "chapter_id", "chapters"),
    ("board_items", "board_id", "boards"),
    ("item_connections", "board_id", "boards"),
    ("item_connections", "item_start_id", "board_items"),
    ("item_connections", "item_end_id", "board_items"),
    ("entity_appearances", "chapter_id", "chapters"),
    ("entity_mentions", "chapter_id", "chapters"),
    ("planner_blocks", "chapter_id", "chapters"),
]
POLYMORPHIC = {"character": "characters", "char": "characters", "location": "locations", "loc": "locations",
               "lore": "lore_entities", "item": "lore_entities", "group": "groups",
               "quicknote": "quick_notes", "annotation": "annotations"}


def rows(conn, sql, *args):
    return conn.execute(sql, args).fetchall()


def has_table(conn, name):
    return bool(rows(conn, "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", name))


def prose(text):
    """Chapter text with the markers reduced to the words they wrap."""
    return MARKER.sub(lambda m: m.group(3), text)


class MigrationCase:
    fixture = None

    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.mkdtemp(prefix="fn_migration_")
        cls.path = os.path.join(cls.root, cls.fixture.replace("_", " ").title())
        shutil.copytree(os.path.join(FIXTURES, cls.fixture), cls.path)
        cls.old = sqlite3.connect(os.path.join(cls.path, "fleshnote.db"))
        cls.before = cls.snapshot(cls.old)
        cls.md_before = cls.read_md()
        cls.old.close()
        cls.result = migration_engine.migrate_project(cls.path)
        cls.new = sqlite3.connect(os.path.join(cls.path, "fleshnote.db"))
        cls.md_after = cls.read_md()

    @classmethod
    def tearDownClass(cls):
        cls.new.close()
        shutil.rmtree(cls.root, ignore_errors=True)

    @classmethod
    def read_md(cls):
        folder = os.path.join(cls.path, "md")
        out = {}
        for name in sorted(os.listdir(folder)):
            with open(os.path.join(folder, name), encoding="utf-8") as f:
                out[name] = f.read()
        return out

    @staticmethod
    def snapshot(conn):
        tables = [r[0] for r in rows(conn, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        return {t: rows(conn, f'SELECT COUNT(*) FROM "{t}"')[0][0] for t in tables}

    # ── the run itself ──

    def test_migration_succeeds_without_warnings(self):
        self.assertEqual(self.result["status"], "ok", self.result)
        self.assertNotIn("warnings", self.result, self.result)

    def test_descriptor_backup_and_idempotence(self):
        with open(os.path.join(self.path, "fleshnote_project.json"), encoding="utf-8") as f:
            meta = json.load(f)
        self.assertEqual(meta["schema_version"], 2)
        self.assertRegex(meta["project_id"], UUID)
        self.assertTrue(os.path.exists(os.path.join(self.path, "fleshnote.db.bak")))
        self.assertFalse(os.path.exists(os.path.join(self.path, "temp_mig")))
        again = migration_engine.migrate_project(self.path)
        self.assertEqual(again["status"], "ok")
        self.assertIn("already", again["message"])

    # ── rows ──

    def test_every_row_arrives(self):
        after = self.snapshot(self.new)
        for table, count in self.before.items():
            if table in ("sqlite_sequence",) or count == 0:
                continue
            self.assertIn(table, after, table)
            # the new schema may add default rows (memberships from legacy groups, settings)
            if table in ("group_memberships", "project_config", "calendar_config"):
                self.assertGreaterEqual(after[table], count, table)
            else:
                self.assertEqual(after[table], count, table)

    def test_ids_are_uuids(self):
        for table in ("chapters", "characters", "locations", "lore_entities", "groups", "knowledge_states", "twists",
                      "foreshadowings", "character_relationships", "world_times", "quick_notes", "annotations",
                      "boards", "board_items", "image_references", "entity_appearances"):
            if not has_table(self.new, table):
                continue
            for (rid,) in rows(self.new, f"SELECT id FROM {table}"):
                self.assertRegex(str(rid), UUID, table)

    def test_references_point_at_real_rows(self):
        for table, column, target in FOREIGN_KEYS:
            if not has_table(self.new, table):
                continue
            for (value,) in rows(self.new, f"SELECT {column} FROM {table} WHERE {column} IS NOT NULL AND {column} != ''"):
                self.assertTrue(rows(self.new, f"SELECT 1 FROM {target} WHERE id = ?", value),
                                "%s.%s = %r has no %s row" % (table, column, value, target))

    def test_polymorphic_references_point_at_real_rows(self):
        for table, id_col, type_col in (("knowledge_states", "source_entity_id", "source_entity_type"),
                                        ("entity_appearances", "entity_id", "entity_type"),
                                        ("entity_mentions", "entity_id", "entity_type"),
                                        ("board_items", "entity_id", "entity_type"),
                                        ("image_references", "entity_id", "entity_type")):
            if not has_table(self.new, table):
                continue
            for value, kind in rows(self.new, f"SELECT {id_col}, {type_col} FROM {table} WHERE {id_col} IS NOT NULL"):
                target = POLYMORPHIC.get(kind)
                self.assertIsNotNone(target, "%s.%s unknown type %r" % (table, type_col, kind))
                self.assertTrue(rows(self.new, f"SELECT 1 FROM {target} WHERE id = ?", value),
                                "%s.%s = %r (%s) has no row" % (table, id_col, value, kind))

    def test_twist_knowers_are_characters(self):
        for (who,) in rows(self.new, "SELECT characters_who_know FROM twists WHERE characters_who_know IS NOT NULL"):
            for cid in json.loads(who or "[]"):
                self.assertTrue(rows(self.new, "SELECT 1 FROM characters WHERE id = ?", cid), cid)

    def test_settings_are_kept(self):
        old = sqlite3.connect(os.path.join(self.path, "fleshnote.db.bak"))
        try:
            for table, key in (("project_config", "config_key"), ("calendar_config", "config_key")):
                if not has_table(old, table):
                    continue
                for k, v in rows(old, f"SELECT {key}, config_value FROM {table}"):
                    got = rows(self.new, f"SELECT config_value FROM {table} WHERE {key} = ?", k)
                    self.assertTrue(got, "%s.%s lost" % (table, k))
                    self.assertEqual(self.normalise(got[0][0]), self.normalise(v), "%s.%s changed" % (table, k))
        finally:
            old.close()

    @staticmethod
    def normalise(v):
        try:
            return json.loads(v)
        except (TypeError, ValueError):
            return v

    # ── chapter files ──

    def test_prose_is_unchanged(self):
        self.assertEqual(sorted(self.md_before), sorted(self.md_after))
        for name, text in self.md_before.items():
            self.assertEqual(prose(self.md_after[name]), prose(text), name)

    def test_every_marker_points_at_a_real_row(self):
        for name, text in self.md_after.items():
            for kind, ids, _ in MARKER.findall(text):
                if kind in SINGLE:
                    self.assertRegex(ids, UUID, "%s in %s" % (kind, name))
                    self.assertTrue(rows(self.new, f"SELECT 1 FROM {SINGLE[kind]} WHERE id = ?", ids),
                                    "{{%s:%s}} in %s has no row" % (kind, ids, name))
                elif kind in DOUBLE:
                    first, second = ids.split(":")
                    for value, table in zip((first, second), DOUBLE[kind]):
                        self.assertRegex(value, UUID, "%s in %s" % (kind, name))
                        self.assertTrue(rows(self.new, f"SELECT 1 FROM {table} WHERE id = ?", value),
                                        "{{%s:%s}} in %s: %s has no row" % (kind, ids, name, table))
                elif kind == "time":
                    tid, color = ids.split(":")
                    self.assertRegex(tid, UUID, "time in %s" % name)
                    self.assertTrue(rows(self.new, "SELECT 1 FROM world_times WHERE id = ?", tid))
                    self.assertTrue(color.isdigit())
                else:
                    self.fail("unexpected marker {{%s:...}} in %s" % (kind, name))

    # ── 2.0 can use it ──

    def test_the_editor_loads_every_chapter(self):
        from routes.chapters import ChapterLoad, load_chapter_content
        for (cid,) in rows(self.new, "SELECT id FROM chapters WHERE deleted = 0"):
            html = load_chapter_content(ChapterLoad(project_path=self.path, chapter_id=cid))["content"]
            self.assertNotIn("{{", html)
            for value in re.findall(r'data-(?:entity|knowledge|relationship|time|twist)-id="([^"]+)"', html):
                self.assertRegex(value, UUID)

    def test_export_reads_it(self):
        pipe = ExportPipeline(self.path)
        for mode in ("prose", "notes", "full"):
            chapters, _ = pipe.chapters(mode)
            text = pipe.render(mode, "txt", chapters=chapters)
            self.assertNotIn("{{", text, mode)
            self.assertNotIn("[[", text, mode)

    def test_bookshelf_sees_a_2_0_project(self):
        from main import _get_book_stats
        stats = _get_book_stats(self.path)
        self.assertEqual(stats["chapter_count"], self.before["chapters"])
        self.assertGreater(stats["word_count"], 0)


class TutorialMigration(MigrationCase, unittest.TestCase):
    fixture = "tutorial"


class LegacyHarborMigration(MigrationCase, unittest.TestCase):
    fixture = "legacy_harbor"

    def test_fixture_covers_every_1_2_marker(self):
        kinds = {k for text in self.md_before.values() for k, _, _ in MARKER.findall(text)}
        self.assertEqual(kinds, {"char", "loc", "item", "group", "quicknote", "annotation", "twist", "foreshadow",
                                 "knowledge", "relationship", "time"})

    def test_quick_note_and_annotation_links_survive(self):
        text = "".join(self.md_after.values())
        self.assertRegex(text, r"\{\{quicknote:[0-9a-f-]{36}\|The water rose\}\}")
        self.assertRegex(text, r"\{\{annotation:[0-9a-f-]{36}\|harbor ledger\}\}")
        pipe = ExportPipeline(self.path)
        chapters, _ = pipe.chapters("notes")
        notes = [n for ch in chapters for n in ch.footnotes]
        self.assertIn("Greyhaven was called Saltmere in the first draft.", notes)

    def test_legacy_group_becomes_a_membership(self):
        member = rows(self.new, "SELECT c.name FROM group_memberships m JOIN characters c ON c.id = m.character_id")
        self.assertEqual([r[0] for r in member], ["Joss"])

    def test_image_files_stay(self):
        (path,) = rows(self.new, "SELECT image_path FROM image_references")[0]
        self.assertTrue(os.path.exists(os.path.join(self.path, *path.split("/"))))


class MigrationFailure(unittest.TestCase):
    """A migration that fails part-way leaves the 1.2 project exactly as it was."""

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="fn_migration_fail_")
        self.path = os.path.join(self.root, "Legacy Harbor")
        shutil.copytree(os.path.join(FIXTURES, "legacy_harbor"), self.path)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def state(self):
        """Chapter files byte for byte, and the database by content (a restored
        backup can differ in header bytes while holding the same data)."""
        out = {}
        for folder, _dirs, names in os.walk(self.path):
            for n in names:
                full = os.path.join(folder, n)
                rel = os.path.relpath(full, self.path)
                if n.endswith(".md"):
                    with open(full, "rb") as f:
                        out[rel] = f.read()
                elif n == "fleshnote.db":
                    conn = sqlite3.connect(full)
                    out[rel] = list(conn.iterdump())
                    conn.close()
        return out

    def assert_untouched(self, before):
        after = self.state()
        self.assertEqual(sorted(after), sorted(before))
        for name, data in before.items():
            self.assertEqual(after[name], data, name)
        self.assertFalse(os.path.exists(os.path.join(self.path, "fleshnote_project.json")))
        self.assertFalse(os.path.exists(os.path.join(self.path, "temp_mig")))
        self.assertFalse([n for n in os.listdir(os.path.join(self.path, "md")) if n.endswith(".mig")])

    def migrate_failing(self, **patch):
        before = self.state()
        with mock.patch.object(*patch["target"], **patch["how"]):
            result = migration_engine.migrate_project(self.path)
        self.assertEqual(result["status"], "error", result)
        self.assert_untouched(before)
        # and a later, working attempt still migrates it
        self.assertEqual(migration_engine.migrate_project(self.path)["status"], "ok")

    def test_failure_before_the_database_swap(self):
        self.migrate_failing(target=(migration_engine, "_verify_polymorphic_integrity"),
                             how={"side_effect": RuntimeError("boom")})

    def test_failure_after_the_database_swap(self):
        self.migrate_failing(target=(migration_engine.json, "dump"), how={"side_effect": OSError("disk full")})

    def test_failure_while_writing_chapter_files(self):
        real = os.replace
        calls = []

        def second_fails(src, dst):
            calls.append(dst)
            if len(calls) == 2:
                raise OSError("file in use")
            return real(src, dst)

        self.migrate_failing(target=(migration_engine.os, "replace"), how={"side_effect": second_fails})
        self.assertGreaterEqual(len(calls), 2)


if __name__ == "__main__":
    unittest.main()

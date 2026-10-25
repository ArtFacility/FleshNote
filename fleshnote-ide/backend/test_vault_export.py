import json
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest
import uuid

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_setup
from export.vault import export_vault, VaultExporter


class TestVaultExport(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="fn_vault_export_")
        self.project_path = os.path.join(self.test_dir, "proj")
        os.makedirs(self.project_path)
        db_setup.generate_project_db(self.project_path, {
            "project_name": "Vault Test",
            "author_name": "Writer",
            "genre": "fantasy",
        })
        md_dir = os.path.join(self.project_path, "md")
        os.makedirs(md_dir, exist_ok=True)
        with open(os.path.join(md_dir, "ch_001_arrival.md"), "w", encoding="utf-8") as f:
            f.write("<p>Hello {{char:char-1|Sophia}} walked in. {{item:item-1|Compass}} glowed.</p>"
                    "<p>{knows: Sophia knows about the letter} Then {secret:the seal broke}."
                    " A note {{annotation:ann-1|here}} matters.</p>")
        with open(os.path.join(md_dir, "ch_002_dark.md"), "w", encoding="utf-8") as f:
            f.write("<p>Second chapter.</p>")

        assets = os.path.join(self.project_path, "assets")
        os.makedirs(assets, exist_ok=True)
        self.icon_file = "icon_char_1_abc.png"
        self.gallery_file = "img_xyz.jpg"
        for name in (self.icon_file, self.gallery_file):
            with open(os.path.join(assets, name), "wb") as f:
                f.write(b"png")

        conn = sqlite3.connect(os.path.join(self.project_path, "fleshnote.db"))
        try:
            cur = conn.cursor()
            for table in ("chapters", "characters", "locations", "groups", "lore_entities", "quick_notes"):
                cur.execute(f"DELETE FROM {table}")
            cur.execute("INSERT INTO chapters (id, chapter_number, title, md_filename, word_count, status, synopsis, deleted) VALUES (?,?,?,?,?,?,?,0)",
                        ("ch-1", 1, "Arrival", "ch_001_arrival.md", 30, "draft", "They arrive.",))
            cur.execute("INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) VALUES (?,?,?,?,0)",
                        ("ch-2", 2, "The Dark", "ch_002_dark.md"))
            cur.execute("INSERT INTO characters (id, name, role, bio, true_goal, surface_goal, aliases, deleted) VALUES (?,?,?,?,?,?,?,0)",
                        ("char-1", "Sophia", "Protagonist", "Secret bio", "Hidden goal", "Find home",
                         json.dumps(["the Magistra"])))
            cur.execute("INSERT INTO locations (id, name, description, deleted) VALUES (?,?,?,0)",
                        ("loc-1", "The Archive", "Dusty shelves."))
            cur.execute("INSERT INTO groups (id, name, true_agenda, deleted) VALUES (?,?,?,0)",
                        ("grp-1", "The Circle", "Control the seals"))
            cur.execute("INSERT INTO lore_entities (id, name, category, description, deleted) VALUES (?,?,?,?,0)",
                        ("item-1", "Compass", "artifact", "Points at lies."))
            cur.execute("INSERT INTO lore_entities (id, name, category, deleted) VALUES (?,?,?,0)",
                        ("item-2", "Mirror", "artifact"))
            cur.execute("INSERT INTO twists (id, title, description, status, deleted) VALUES (?,?,?,?,0)",
                        ("tw-1", "The Betrayal", "Marcus did it.", "planned"))
            cur.execute("INSERT INTO foreshadowings (id, twist_id, chapter_id, word_offset, selected_text, deleted) VALUES (?,?,?,?,?,0)",
                        ("fore-1", "tw-1", "ch-1", 0, "a cold wind"))
            cur.execute("INSERT INTO quick_notes (id, content, note_type, deleted) VALUES (?,?,?,0)",
                        ("qn-1", "Fix pacing in ch2", "Fix"))
            cur.execute("INSERT INTO knowledge_states (id, character_id, fact, source_entity_type, source_entity_id, learned_in_chapter, is_secret, deleted) VALUES (?,?,?,?,?,?,?,0)",
                        ("kn-1", "char-1", "Knows the seal is fake", "char", "char-1", "ch-1", 1))
            cur.execute("INSERT INTO character_relationships (id, character_id, target_character_id, rel_type, is_one_sided, deleted) VALUES (?,?,?,?,?,0)",
                        ("rel-1", "char-1", "char-1", "rival", 1))
            cur.execute("INSERT INTO group_memberships (id, group_id, character_id, role_title, standing, deleted) VALUES (?,?,?,?,?,0)",
                        ("mem-1", "grp-1", "char-1", "Magistra", "loyal"))
            cur.execute("INSERT INTO entity_appearances (id, entity_type, entity_id, chapter_id) VALUES (?,?,?,?)",
                        ("ap-1", "character", "char-1", "ch-1"))
            cur.execute("INSERT INTO image_references (id, entity_id, entity_type, image_path, is_icon, deleted) VALUES (?,?,?,?,1,0)",
                        ("img-1", "char-1", "char", f"assets/{self.icon_file}"))
            cur.execute("INSERT INTO image_references (id, entity_type, entity_id, image_path, is_icon, caption, deleted) VALUES (?,?,?,?,0,?,0)",
                        ("img-2", "char", "char-1", f"assets/{self.gallery_file}", "concept art"))
            cur.execute("INSERT INTO annotations (id, content) VALUES (?,?)", ("ann-1", "Check the heraldry here."))
            conn.commit()
        finally:
            conn.close()

        self.dest = os.path.join(self.test_dir, "out")
        os.makedirs(self.dest)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _obsidian_export(self):
        final, count = export_vault(self.project_path, self.dest, "obsidian")
        self.assertTrue(os.path.isdir(final))
        self.assertGreater(count, 0)
        return final, count

    def test_obsidian_tree_and_files(self):
        final, count = self._obsidian_export()
        self.assertEqual(os.path.basename(final), "Vault Test (Obsidian)")
        man = os.path.join(final, "Manuscript")
        self.assertIn("01 — Arrival.md", os.listdir(man))
        self.assertEqual(os.listdir(os.path.join(final, "Characters")), ["Sophia.md"])
        self.assertTrue(os.path.isfile(os.path.join(final, "Locations", "The Archive.md")))
        self.assertTrue(os.path.isfile(os.path.join(final, "Groups & Factions", "The Circle.md")))
        self.assertTrue(os.path.isfile(os.path.join(final, "Lore", "artifact", "Compass.md")))
        self.assertTrue(os.path.isdir(os.path.join(final, "Quick Notes")))
        self.assertTrue(any(f.endswith(".md") for f in os.listdir(os.path.join(final, "Quick Notes"))))
        self.assertTrue(os.path.isfile(os.path.join(final, "Twists & Secrets", "The Betrayal.md")))
        self.assertTrue(os.path.isfile(os.path.join(final, "Project Overview.md")))
        self.assertEqual(os.listdir(os.path.join(final, "attachments")), [self.icon_file, self.gallery_file])

    def test_chapter_wiki_links_and_callouts(self):
        final, _ = self._obsidian_export()
        text = open(os.path.join(final, "Manuscript", "01 — Arrival.md"), encoding="utf-8").read()
        self.assertIn("[[Sophia]]", text)
        self.assertIn("[[Compass]]", text)
        self.assertNotIn("{{char:", text)
        self.assertNotIn("<p>", text)
        self.assertIn("> [!info]- knows: Sophia knows about the letter", text)
        self.assertIn("[^1]: Check the heraldry here.", text)
        self.assertIn("---\nchapter: \"1\"\n", text)  # chapter frontmatter

    def test_character_note_content(self):
        final, _ = self._obsidian_export()
        note = open(os.path.join(final, "Characters", "Sophia.md"), encoding="utf-8").read()
        self.assertIn("type: \"character\"", note)
        self.assertIn("aliases: [\"the Magistra\"]", note)
        self.assertIn("**True goal:** Hidden goal", note)
        self.assertIn("Secret bio", note)
        self.assertIn("[[The Circle]]", note)  # membership + unique-name short link
        self.assertIn("rival", note)
        self.assertIn("Knows the seal is fake", note)
        self.assertIn("![[icon_char_1_abc.png]]", note)
        self.assertIn("![[img_xyz.jpg]]", note)

    def test_ambiguous_names_get_qualified_links(self):
        # rename the group so "Sophia" appears twice in the vault -> links qualify
        conn = sqlite3.connect(os.path.join(self.project_path, "fleshnote.db"))
        conn.execute("UPDATE characters SET name='Mirror' WHERE id='char-1'")
        conn.commit()
        conn.close()
        final, _ = export_vault(self.project_path, self.dest, "obsidian")
        text = open(os.path.join(final, "Manuscript", "01 — Arrival.md"), encoding="utf-8").read()
        self.assertIn("[[Characters/Mirror|Sophia]]", text)

    def test_txt_mode_plain(self):
        final, _ = export_vault(self.project_path, os.path.join(self.dest, "t"), "txt")
        self.assertEqual(os.path.basename(final), "Vault Test (Plain Text)")
        text = open(os.path.join(final, "Manuscript", "01 — Arrival.txt"), encoding="utf-8").read()
        self.assertNotIn("[[", text)
        self.assertNotIn("name:", text.split("Hello")[0])
        self.assertIn("[knows: Sophia knows about the letter]", text)
        self.assertIn("Hello Sophia walked in.", text)
        self.assertFalse(os.path.isdir(os.path.join(final, "attachments")))

    def test_destination_exists_rejected(self):
        self._obsidian_export()
        with self.assertRaises(ValueError):
            export_vault(self.project_path, self.dest, "obsidian")

    def test_chapter_link_resolution(self):
        final, _ = self._obsidian_export()
        note = open(os.path.join(final, "Characters", "Sophia.md"), encoding="utf-8").read()
        self.assertIn("[[Manuscript/01 — Arrival|Ch 1: Arrival]]", note)

    def _add_boards(self):
        conn = sqlite3.connect(os.path.join(self.project_path, "fleshnote.db"))
        try:
            cur = conn.cursor()
            db_setup.ensure_board_schema(cur)
            cur.execute("INSERT INTO characters (id, name, deleted) VALUES ('char-2', 'Marcus', 0)")
            cur.execute("INSERT INTO character_relationships (id, character_id, target_character_id, rel_type, is_one_sided, deleted) VALUES (?,?,?,?,?,0)",
                        ("rel-2", "char-1", "char-2", "trust", 0))
            cur.execute("INSERT INTO boards (id, name, board_type) VALUES ('b-1', 'Magic: Rules', 'custom')")
            cur.execute("INSERT INTO boards (id, name, board_type) VALUES ('b-2', 'Bonds', 'gen_relationships')")
            nodes = [
                ("n-frame", "b-1", "Circle", "frame", None, None, 0, 0, 600, 400, "[]"),
                ("n-soph", "b-1", "", "ellipse", "character", "char-1", 40, 40, 160, 64, "[]"),
                ("n-idea", "b-1", "Binding", "card", None, None, 300, 40, 160, 64, json.dumps([["Cost", "a memory"]])),
                ("n-gone", "b-1", "Old name", "card", "location", "loc-missing", 300, 200, 160, 64, "[]"),
                ("g-1", "b-2", "", "ellipse", "character", "char-1", 0, 0, 160, 64, "[]"),
                ("g-2", "b-2", "", "ellipse", "character", "char-2", 300, 0, 160, 64, "[]"),
            ]
            for n in nodes:
                cur.execute("INSERT INTO board_items (id, board_id, name, shape, entity_type, entity_id, pos_x, pos_y, size_x, size_y, props, color_token, deleted) "
                            "VALUES (?,?,?,?,?,?,?,?,?,?,?,'blue',0)", n)
            cur.execute("INSERT INTO item_connections (id, board_id, item_start_id, item_end_id, title, from_side, to_side, start_marker, end_marker, color_token, deleted) "
                        "VALUES ('e-1','b-1','n-soph','n-idea','wields','right','left','none','arrow','red',0)")
            cur.execute("INSERT INTO board_edge_types (id, board_id, name, deleted) VALUES ('t-1','b-1','Feeds',0)")
            cur.execute("INSERT INTO item_connections (id, board_id, item_start_id, item_end_id, title, type_id, deleted) "
                        "VALUES ('e-2','b-1','n-idea','n-gone','','t-1',0)")
            conn.commit()
        finally:
            conn.close()

    def test_boards_as_canvas(self):
        self._add_boards()
        final, _ = self._obsidian_export()
        boards = os.path.join(final, "Sketchboards")
        self.assertEqual(sorted(os.listdir(boards)), ["Bonds.canvas", "Magic- Rules.canvas"])

        doc = json.load(open(os.path.join(boards, "Magic- Rules.canvas"), encoding="utf-8"))
        nodes = {n["id"]: n for n in doc["nodes"]}
        self.assertEqual(doc["nodes"][0]["id"], "n-frame")  # groups first
        self.assertEqual(nodes["n-frame"]["type"], "group")
        self.assertEqual(nodes["n-soph"], {"id": "n-soph", "x": 40, "y": 40, "width": 160, "height": 64,
                                           "color": "5", "type": "file", "file": "Characters/Sophia.md"})
        self.assertTrue(os.path.isfile(os.path.join(final, *nodes["n-soph"]["file"].split("/"))))
        self.assertEqual(nodes["n-idea"]["text"], "**Binding**\n\n- Cost: a memory")
        self.assertEqual(nodes["n-gone"]["type"], "text")  # entity gone: its own name
        self.assertEqual(doc["edges"][0], {"id": "e-1", "fromNode": "n-soph", "fromSide": "right", "fromEnd": "none",
                                           "toNode": "n-idea", "toSide": "left", "toEnd": "arrow",
                                           "color": "1", "label": "wields"})
        self.assertEqual(doc["edges"][1]["label"], "Feeds")  # the legend type names an unlabelled line

        # A live board draws the tracker's latest state: one mutual line, arrows both ends.
        live = json.load(open(os.path.join(boards, "Bonds.canvas"), encoding="utf-8"))
        self.assertEqual(len(live["edges"]), 1)
        e = live["edges"][0]
        self.assertEqual((e["fromEnd"], e["toEnd"], e["label"], e["color"]), ("arrow", "arrow", "Trust", "5"))
        self.assertEqual({e["fromNode"], e["toNode"]}, {"g-1", "g-2"})

        overview = open(os.path.join(final, "Project Overview.md"), encoding="utf-8").read()
        self.assertIn("- Sketchboards: 2", overview)
        self.assertNotIn("sketchboards,", overview)

    def test_bad_board_is_skipped(self):
        self._add_boards()
        import routes.boards
        real = routes.boards.generated_data
        routes.boards.generated_data = lambda *a: 1 / 0
        try:
            final, _ = self._obsidian_export()
        finally:
            routes.boards.generated_data = real
        self.assertEqual(os.listdir(os.path.join(final, "Sketchboards")), ["Magic- Rules.canvas"])

    def test_txt_mode_has_no_boards(self):
        self._add_boards()
        final, _ = export_vault(self.project_path, self.dest, "txt")
        self.assertFalse(os.path.isdir(os.path.join(final, "Sketchboards")))
        self.assertIn("sketchboards,", open(os.path.join(final, "Project Overview.txt"), encoding="utf-8").read())

    def test_txt_output_written_before_obsidian_marker_state(self):
        # exporter must not mutate the source project (dry: chapter md unchanged)
        before = open(os.path.join(self.project_path, "md", "ch_001_arrival.md"), encoding="utf-8").read()
        self._obsidian_export()
        after = open(os.path.join(self.project_path, "md", "ch_001_arrival.md"), encoding="utf-8").read()
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()

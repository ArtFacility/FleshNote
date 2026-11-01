"""The relationship tracker: which turning point counts at a point in the story.

Views that ask about a date go by when things happen in the story, so a
flashback read late doesn't replace what came after it. The narrative view goes
by what the reader has seen. Sketchboards must agree with both."""
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest

os.environ.setdefault("FLESHNOTE_DEVICE_ID", "test-device-relationships")

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_setup
from export.board_canvas import live_edges
from routes import boards
from routes.relationships import RelationshipsForCharacter, get_relationships_for_character, in_story_time


FLASHBACK = "<p>Plain words here {{time:flash:0|back in the old days}} then more.</p>"


class TrackerBase(unittest.TestCase):
    chapters = ()   # (id, number, world_time, text)
    rows = ()       # (id, from, to, type, chapter, offset, one_sided)
    overrides = ()  # (id, chapter, date)

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fn_relationships_")
        self.project = os.path.join(self.tmp, "proj")
        os.makedirs(os.path.join(self.project, "md"))
        db_setup.generate_project_db(self.project, {
            "project_name": "Tracker", "author_name": "Writer",
            "genre": "fantasy", "project_id": "tracker-proj-1",
        })
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        conn.execute("DELETE FROM chapters")
        for cid, name in (("me", "Ann"), ("fay", "Fay"), ("bob", "Bob")):
            conn.execute("INSERT INTO characters (id, name) VALUES (?, ?)", (cid, name))
        for cid, number, time, text in self.chapters:
            conn.execute("INSERT INTO chapters (id, chapter_number, title, world_time, md_filename) "
                         "VALUES (?, ?, ?, ?, ?)", (cid, number, cid, time, f"{cid}.md"))
            with open(os.path.join(self.project, "md", f"{cid}.md"), "w", encoding="utf-8") as f:
                f.write(text)
        for oid, chapter, date in self.overrides:
            conn.execute("INSERT INTO world_times (id, chapter_id, world_date) VALUES (?, ?, ?)", (oid, chapter, date))
        for rid, a, b, kind, chapter, offset, one in self.rows:
            conn.execute("INSERT INTO character_relationships (id, character_id, target_character_id, rel_type, "
                         "chapter_id, word_offset, is_one_sided) VALUES (?, ?, ?, ?, ?, ?, ?)",
                         (rid, a, b, kind, chapter, offset, one))
        conn.commit()
        conn.close()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def card(self, other, mode="world_time", time=None, chapter=None):
        res = get_relationships_for_character(RelationshipsForCharacter(
            project_path=self.project, character_id="me", filter_mode=mode,
            current_world_time=time, current_chapter=chapter))
        return next(r for r in res["relationships"] if r["target_character_id"] == other)

    def state(self, other, **kw):
        return self.card(other, **kw)["current_state"]["id"]

    def reverse(self, other, **kw):
        found = self.card(other, **kw)["reverse_state"]
        return found["id"] if found else None

    def pairs(self):
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        conn.row_factory = sqlite3.Row
        try:
            data = boards.generated_data(conn.cursor(), self.project, "gen_relationships")
        finally:
            conn.close()
        return {(p["from"], p["to"]): p["history"] for p in data["pairs"]}


class TestFlashback(TrackerBase):
    chapters = (("g1", 901, "1100", "<p>One two three.</p>"),
                ("g2", 902, "1200", FLASHBACK),
                ("g3", 903, "1300", "<p>End.</p>"))
    overrides = (("flash", "g2", "1050"),)
    rows = (("r7", "me", "fay", "love", "g1", 0, 1),
            ("r8", "me", "fay", "enemy", "g2", 4, 1),   # inside the flashback, dated 1050
            ("b7", "fay", "me", "trust", "g1", 0, 1),
            ("b8", "fay", "me", "fear", "g2", 4, 1))

    def test_a_flashback_does_not_replace_the_later_state(self):
        self.assertEqual(self.state("fay", time="1150"), "r7")

    def test_a_date_inside_the_flashback_sees_it(self):
        self.assertEqual(self.state("fay", time="1060"), "r8")

    def test_both_arrows_follow_the_same_order(self):
        self.assertEqual(self.reverse("fay", time="1150"), "b7")
        self.assertEqual(self.reverse("fay", time="1060"), "b8")

    def test_author_view_goes_by_date_with_or_without_a_time(self):
        self.assertEqual(self.state("fay", mode="author", time="1150"), "r7")
        self.assertEqual(self.state("fay", mode="author"), "r7")
        self.assertEqual(self.reverse("fay", mode="author"), "b7")

    def test_narrative_is_what_the_reader_has_seen(self):
        self.assertEqual(self.state("fay", mode="narrative", chapter=902), "r8")
        self.assertEqual(self.reverse("fay", mode="narrative", chapter=902), "b8")
        self.assertEqual(self.state("fay", mode="narrative", chapter=901), "r7")

    def test_the_ghost_state_is_what_the_reader_has_seen(self):
        card = self.card("fay", time="1150", chapter=902)
        self.assertEqual(card["current_state"]["id"], "r7")
        self.assertEqual(card["ghost_state"]["id"], "r8")
        self.assertEqual(card["reverse_ghost_state"]["id"], "b8")

    def test_boards_agree_with_the_tracker(self):
        history = self.pairs()[("me", "fay")]
        self.assertEqual([r["id"] for r in history], ["r7", "r8"])     # reading order
        self.assertEqual([r["world_rank"] for r in history], [1, 0])   # story order
        self.assertEqual(max(history, key=lambda r: r["world_rank"])["id"], self.state("fay", mode="author"))

    def test_a_vault_canvas_draws_the_end_of_the_story(self):
        data = {"kind": "relationships", "pairs": [{"from": "me", "to": "fay", "history": self.pairs()[("me", "fay")]}]}
        items = [{"id": "n1", "entity_type": "character", "entity_id": "me"},
                 {"id": "n2", "entity_type": "character", "entity_id": "fay"}]
        self.assertEqual([e["title"] for e in live_edges(data, items)], ["Love"])


class TestStartingStates(TrackerBase):
    """Nothing dated: chapter-less rows are where things begin, not where they end."""
    chapters = (("g1", 1, "", "<p>One.</p>"), ("g2", 2, "", "<p>Two.</p>"))
    rows = (("a", "me", "fay", "friendship", None, None, 1),
            ("b", "me", "fay", "hate", "g2", 1, 1),
            ("c", "fay", "me", "neutral", None, None, 1),
            ("d", "fay", "me", "love", "g1", 1, 1))

    def test_a_starting_state_does_not_beat_a_real_turning_point(self):
        for kw in ({"mode": "author"}, {"time": "1150"}, {"mode": "narrative", "chapter": 2}):
            with self.subTest(**kw):
                self.assertEqual(self.state("fay", **kw), "b")
                self.assertEqual(self.reverse("fay", **kw), "d")

    def test_the_starting_state_holds_until_the_story_changes_it(self):
        self.assertEqual(self.state("fay", mode="narrative", chapter=1), "a")


class TestPartlyDatedStory(TrackerBase):
    """Many projects date only some chapters. Undated rows keep their place."""
    chapters = (("g1", 1, "1100", "<p>One.</p>"),
                ("g2", 2, "", "<p>Two.</p>"),
                ("g3", 3, "1000", "<p>Three.</p>"))
    rows = (("a", "me", "fay", "love", "g1", 1, 1),
            ("b", "me", "fay", "hate", "g2", 1, 1),    # no date: read after 1100
            ("c", "me", "fay", "enemy", "g3", 1, 1),   # flashback
            ("x", "me", "bob", "love", "g2", 1, 1),    # no date, nothing dated before it
            ("y", "me", "bob", "hate", "g3", 1, 1))

    def test_an_undated_row_does_not_lose_to_every_dated_one(self):
        self.assertEqual(self.state("fay", mode="author"), "b")

    def test_undated_rows_with_nothing_before_them_come_first(self):
        self.assertEqual(self.state("bob", mode="author"), "y")

    def test_a_row_keeps_its_place_as_the_point_moves(self):
        history = self.pairs()[("me", "fay")]
        by_rank = sorted(history, key=lambda r: r["world_rank"])
        self.assertEqual([r["id"] for r in by_rank], ["c", "a", "b"])


class TestMutual(TrackerBase):
    chapters = (("g1", 1, "1100", "<p>One.</p>"), ("g2", 2, "1000", "<p>Two.</p>"))
    rows = (("m", "me", "fay", "ally", "g1", 1, 0),    # mutual
            ("o", "fay", "me", "fear", "g2", 1, 1))    # hers alone, dated earlier

    def test_a_mutual_row_ranks_separately_in_each_direction(self):
        pairs = self.pairs()
        self.assertEqual([(r["id"], r["world_rank"]) for r in pairs[("me", "fay")]], [("m", 0)])
        self.assertEqual({r["id"]: r["world_rank"] for r in pairs[("fay", "me")]}, {"m": 1, "o": 0})

    def test_the_reverse_arrow_sees_the_mutual_row_as_later(self):
        self.assertEqual(self.reverse("fay", mode="author"), "m")
        self.assertEqual(self.reverse("fay", mode="narrative"), "o")


class TestStoryOrder(unittest.TestCase):
    def order(self, *rows):
        items = [{"id": i, "chapter_number": c, "word_offset": w, "day": d} for i, c, w, d in rows]
        return [r["id"] for r in in_story_time(items, lambda r: r["day"])]

    def test_same_day_keeps_reading_order(self):
        self.assertEqual(self.order(("b", 2, 0, 5), ("a", 1, 0, 5)), ["a", "b"])

    def test_within_a_chapter_goes_by_word_offset(self):
        self.assertEqual(self.order(("b", 1, 9, 5), ("a", 1, 2, 5), ("n", 1, None, 5)), ["n", "a", "b"])

    def test_empty(self):
        self.assertEqual(in_story_time([], lambda r: None), [])


if __name__ == "__main__":
    unittest.main()

"""Tests for Story Pulse (intensity_engine.py, routes/story_pulse.py): the
reader model, the per-paragraph evidence rules in each language, and the
endpoint reading the Janitor's paragraph cache. Feature tests skip per
language when the spaCy model is not downloaded."""
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import intensity_engine as IE
from nlp_manager import check_model_exists, parse_cached
from routes import janitor as J
from routes import story_pulse as SP


def features(text: str, lang: str) -> dict:
    return IE.paragraph_features(parse_cached(lang, text), text, lang)


class TestReaderModel(unittest.TestCase):
    def test_a_steady_book_reads_steady(self):
        self.assertEqual(IE.perceive([0.4] * 5, [100] * 5), [0.4] * 5)

    def test_high_levels_recover_slowly_and_low_levels_wind_up_slowly(self):
        def share_of_the_way(start, target):
            return (IE.perceive([start, target], [100, 100])[-1] - start) / (target - start)
        self.assertLess(share_of_the_way(0.9, 0.1), share_of_the_way(0.3, 0.1))  # slow recovery
        self.assertLess(share_of_the_way(0.1, 0.9), share_of_the_way(0.7, 0.9))  # slow wind-up

    def test_one_spike_after_a_dull_stretch_does_not_land_in_full(self):
        line = IE.perceive([0.1, 0.1, 0.1, 1.0], [100] * 4)
        self.assertLess(line[-1], 0.6)

    def test_longer_paragraphs_move_the_reader_further(self):
        short = IE.perceive([0.2, 0.8], [100, 50])[-1]
        long = IE.perceive([0.2, 0.8], [100, 400])[-1]
        self.assertGreater(long, short)

    def test_unscored_paragraphs_leave_the_reader_in_place(self):
        line = IE.perceive([0.3, None, 0.3], [100] * 3)
        self.assertEqual(line, [0.3, None, 0.3])

    def test_one_bright_paragraph_does_not_flip_a_grim_mood(self):
        line = IE.mood_line([-0.8, -0.7, -0.8, 0.2, -0.7], [100] * 5)
        self.assertTrue(all(m < 0 for m in line), line)
        self.assertGreater(line[3], line[2])  # it still nudges the line up
        self.assertEqual(IE.mood_line([0.5, None], [100, 100]), [0.5, None])

    def test_normalize_is_relative_to_the_book(self):
        out = IE.normalize([1.0, 2.0, 3.0])
        self.assertAlmostEqual(out[1], 0.5)
        self.assertLess(out[0], out[1])
        self.assertLess(out[1], out[2])
        self.assertEqual(IE.normalize([2.0, 2.0]), [0.5, 0.5])


@unittest.skipUnless(check_model_exists("en"), "English spaCy model not downloaded")
class TestEnglishFeatures(unittest.TestCase):
    def test_negation_flips_valence(self):
        pos = features("She was delighted.", "en")["v"]
        neg = features("She was not delighted.", "en")["v"]
        self.assertGreater(pos, 0)
        self.assertLess(neg, 0)

    def test_an_intensifier_raises_arousal(self):
        plain = features("The furious man struck the table.", "en")["g"]["emotion"][1]
        very = features("The very furious man struck the table.", "en")["g"]["emotion"][1]
        self.assertGreater(very, plain)

    def test_a_weak_word_needs_company(self):
        self.assertEqual(features("She pushed the door open and went in.", "en")["g"], {})
        self.assertIn("action", features("She pushed him and punched him hard.", "en")["g"])

    def test_evidence_names_the_words(self):
        ev = features("A sword flashed and he screamed in terror.", "en")["ev"]
        self.assertTrue(any(word == "sword" for _, word, _ in ev), ev)


@unittest.skipUnless(check_model_exists("hu"), "Hungarian model not downloaded")
class TestHungarianFeatures(unittest.TestCase):
    def test_drawing_a_sword_is_still_danger(self):
        # 'kardot ránt' is an idiom entry but usually literal: it blocks nothing
        rec = features("Gergely kardot rántott, és a janicsárra rontott.", "hu")
        self.assertIn("danger", rec["g"])


@unittest.skipUnless(check_model_exists("pl"), "Polish model not downloaded")
class TestPolishFeatures(unittest.TestCase):
    def test_cold_blood_is_not_blood(self):
        rec = features("Działał z zimną krwią, choć wróg był blisko.", "pl")
        self.assertNotIn("pl.danger.krew", [eid for eid, _, _ in rec["ev"]])


@unittest.skipUnless(check_model_exists("en"), "English spaCy model not downloaded")
class TestEndpoint(unittest.TestCase):
    BATTLE = ("<h2>The Battle</h2><p>The sword struck him and blood poured from the wound. He screamed in terror"
              " as the enemy killed his brother.</p><p>***</p>")
    CALM = "<p>The garden was quiet and peaceful in the gentle evening light, and she smiled.</p>"

    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="fn_pulse_")
        os.makedirs(os.path.join(self.dir, "md"))
        conn = sqlite3.connect(os.path.join(self.dir, "fleshnote.db"))
        conn.execute("CREATE TABLE chapters (id INTEGER PRIMARY KEY, chapter_number INTEGER, title TEXT, "
                     "md_filename TEXT, deleted INTEGER DEFAULT 0)")
        for cid, body in ((1, self.CALM), (2, self.BATTLE)):
            with open(os.path.join(self.dir, "md", f"ch{cid}.md"), "w", encoding="utf-8") as f:
                f.write(body)
            conn.execute("INSERT INTO chapters VALUES (?, ?, ?, ?, 0)", (cid, cid, f"Ch {cid}", f"ch{cid}.md"))
        conn.commit()
        conn.close()

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def pulse(self):
        res = SP.story_pulse(SP.StoryPulseRequest(project_path=self.dir, language="en"))
        self.assertEqual(res["status"], "ok", res.get("error"))
        return res

    def test_headings_and_scene_breaks_are_not_plotted(self):
        res = self.pulse()
        self.assertEqual([len(ch["paragraphs"]) for ch in res["chapters"]], [1, 1])

    def test_the_battle_outranks_the_garden(self):
        res = self.pulse()
        self.assertEqual(res["coverage"], {"scored": 2, "total": 2})
        calm, battle = (ch["paragraphs"][0] for ch in res["chapters"])
        self.assertGreater(battle["intensity"], calm["intensity"])
        self.assertLess(battle["valence"], 0)
        self.assertGreater(calm["valence"], 0)
        self.assertIn("perceived", battle)
        self.assertEqual(res["chapters"][1]["peak"], battle["intensity"])

    def test_a_language_without_weights_says_so(self):
        res = SP.story_pulse(SP.StoryPulseRequest(project_path=self.dir, language="ar"))
        self.assertEqual(res["status"], "ok")
        self.assertFalse(res["supported"])
        self.assertTrue(self.pulse()["supported"])

    def test_unseen_paragraphs_are_pending_until_parsed(self):
        real = SP.PULSE_BUDGET_S
        SP.PULSE_BUDGET_S = 0
        try:
            cold = self.pulse()
        finally:
            SP.PULSE_BUDGET_S = real
        self.assertEqual(cold["coverage"]["scored"], 0)
        self.assertTrue(all(p.get("pending") for ch in cold["chapters"] for p in ch["paragraphs"]))
        # the Janitor analyzing chapter 2 in the editor fills the cache for it
        from routes.chapters import md_to_editor_html
        J.janitor_analyze(J.JanitorRequest(project_path=self.dir, chapter_id=2,
                                           html=md_to_editor_html(self.BATTLE), language="en"))
        SP.PULSE_BUDGET_S = 0
        try:
            warm = self.pulse()
        finally:
            SP.PULSE_BUDGET_S = real
        self.assertEqual(warm["coverage"], {"scored": 1, "total": 2})
        self.assertNotIn("pending", warm["chapters"][1]["paragraphs"][0])

    def test_the_editor_gutter_never_parses(self):
        req = SP.StoryPulseRequest(project_path=self.dir, language="en", cache_only=True)
        self.assertEqual(SP.story_pulse(req)["coverage"]["scored"], 0)
        self.assertEqual(self.pulse()["coverage"]["scored"], 2)
        self.assertEqual(SP.story_pulse(req)["coverage"]["scored"], 2)

    def test_paragraphs_carry_the_editor_match_key(self):
        calm = self.pulse()["chapters"][0]["paragraphs"][0]
        text = "The garden was quiet and peaceful in the gentle evening light, and she smiled."
        self.assertEqual(calm["key"], SP.paragraph_key(text))

    def test_the_match_key_ignores_spacing_and_composition(self):
        # same vector checked against utils/pulseGutter.js in the renderer: NFC, collapsed
        # whitespace (incl. no-break space) and an astral Rovás glyph
        self.assertEqual(SP.paragraph_key("Árvíztűrő  tükörfúrógép\u00a0x \U00010C80 "), "effd79acd5e004f68b54")
        self.assertEqual(SP.paragraph_key("A\u0301rvíztűrő tükörfúrógép x \U00010C80"), "effd79acd5e004f68b54")


class TestCorrections(unittest.TestCase):
    """The writer's own values (plan §5.6): applied by content key, re-anchored
    after small edits, reported stale when the paragraph is gone, synced."""
    CALM = TestEndpoint.CALM
    BATTLE = TestEndpoint.BATTLE
    BATTLE_TEXT = ("The sword struck him and blood poured from the wound. He screamed in terror"
                   " as the enemy killed his brother.")

    def setUp(self):
        import db_setup
        self.dir = tempfile.mkdtemp(prefix="fn_pulse_corr_")
        db_setup.generate_project_db(self.dir, {"project_name": "P", "author_name": "A", "genre": "fantasy",
                                                "story_language": "en", "scaffold_chapters": False})
        os.makedirs(os.path.join(self.dir, "md"), exist_ok=True)
        conn = sqlite3.connect(os.path.join(self.dir, "fleshnote.db"))
        conn.execute("DELETE FROM chapters")
        for n, body in ((1, self.CALM), (2, self.BATTLE)):
            self.write(n, body)
            conn.execute("INSERT INTO chapters (chapter_number, title, status, word_count, md_filename) "
                         "VALUES (?, ?, 'draft', 10, ?)", (n, f"Ch {n}", f"ch{n}.md"))
        conn.commit()
        self.ids = [r[0] for r in conn.execute("SELECT id FROM chapters ORDER BY chapter_number")]
        conn.close()

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def write(self, n, body):
        with open(os.path.join(self.dir, "md", f"ch{n}.md"), "w", encoding="utf-8") as f:
            f.write(body)

    def pulse(self):
        res = SP.story_pulse(SP.StoryPulseRequest(project_path=self.dir, language="en"))
        self.assertEqual(res["status"], "ok", res.get("error"))
        return res

    def correct(self, text, chapter=1, **kw):
        res = SP.correct_paragraph(SP.PulseCorrectionRequest(
            project_path=self.dir, chapter_id=self.ids[chapter - 1], texts=[text], para_idx=0, **kw))
        self.assertEqual(res["status"], "ok", res.get("error"))
        return res

    def db(self, sql, args=()):
        conn = sqlite3.connect(os.path.join(self.dir, "fleshnote.db"))
        try:
            return conn.execute(sql, args).fetchall()
        finally:
            conn.close()

    def test_a_correction_replaces_the_measurement(self):
        before = self.pulse()
        calm_text = "The garden was quiet and peaceful in the gentle evening light, and she smiled."
        self.correct(calm_text, intensity=0.95, valence=-0.8)
        after = self.pulse()
        calm = after["chapters"][0]["paragraphs"][0]
        self.assertTrue(calm["corrected"])
        self.assertEqual((calm["intensity"], calm["valence"]), (0.95, -0.8))
        self.assertEqual(calm["measured"]["intensity"], before["chapters"][0]["paragraphs"][0]["intensity"])
        self.assertEqual(after["chapters"][0]["mean"], 0.95)
        # the rest of the book is not rescaled by someone else's correction
        self.assertEqual(after["chapters"][1]["paragraphs"][0]["intensity"],
                         before["chapters"][1]["paragraphs"][0]["intensity"])
        self.assertEqual(self.db("SELECT COUNT(*) FROM change_log WHERE table_name = ?", (SP.CORRECTION_TABLE,))[0][0] > 0, True)

    def test_correcting_twice_keeps_one_row_and_reset_restores_the_measurement(self):
        calm_text = "The garden was quiet and peaceful in the gentle evening light, and she smiled."
        self.correct(calm_text, intensity=0.9, valence=0.1)
        self.correct(calm_text, intensity=0.4, valence=0.5)
        self.assertEqual(self.db("SELECT COUNT(*) FROM paragraph_intensity_corrections WHERE deleted = 0")[0][0], 1)
        self.correct(calm_text, reset=True)
        calm = self.pulse()["chapters"][0]["paragraphs"][0]
        self.assertNotIn("corrected", calm)

    def test_a_small_edit_keeps_the_correction(self):
        self.correct(self.BATTLE_TEXT, chapter=2, intensity=0.2, valence=0.3)
        self.write(2, self.BATTLE.replace("screamed in terror", "screamed in horror"))
        battle = self.pulse()["chapters"][1]
        self.assertTrue(battle["paragraphs"][0].get("corrected"))
        self.assertEqual(battle["stale_corrections"], [])
        new_key = battle["paragraphs"][0]["key"]
        self.assertEqual(self.db("SELECT para_hash FROM paragraph_intensity_corrections")[0][0], new_key)
        # a second read finds it by key: no further re-anchor is logged
        logged = self.db("SELECT COUNT(*) FROM change_log WHERE column_name = 'para_hash'")[0][0]
        self.pulse()
        self.assertEqual(self.db("SELECT COUNT(*) FROM change_log WHERE column_name = 'para_hash'")[0][0], logged)

    def test_a_rewritten_paragraph_reports_the_correction_stale(self):
        self.correct(self.BATTLE_TEXT, chapter=2, intensity=0.2, valence=0.3)
        self.write(2, "<p>Morning came slowly over the hills, and the village woke to bread and bells.</p>")
        battle = self.pulse()["chapters"][1]
        self.assertFalse(battle["paragraphs"][0].get("corrected"))
        self.assertEqual(len(battle["stale_corrections"]), 1)
        # the writer can discard it by id: it has no paragraph to name it by
        res = SP.correct_paragraph(SP.PulseCorrectionRequest(
            project_path=self.dir, chapter_id=self.ids[1], texts=[], reset=True,
            correction_ids=[battle["stale_corrections"][0]["id"]]))
        self.assertEqual(res["status"], "ok", res.get("error"))
        self.assertEqual(self.pulse()["chapters"][1]["stale_corrections"], [])

    def test_a_known_correction_follows_its_edited_paragraph(self):
        cid = self.correct(self.BATTLE_TEXT, chapter=2, intensity=0.2, valence=0.3)["corrections"][0]["id"]
        edited = self.BATTLE_TEXT + " Nobody came."
        self.correct(edited, chapter=2, intensity=0.6, valence=0.3, correction_ids=[cid])
        rows = self.db("SELECT id, para_hash, intensity FROM paragraph_intensity_corrections WHERE deleted = 0")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0], (cid, SP.paragraph_key(edited), 0.6))


class TestCorrectionMatching(unittest.TestCase):
    def row(self, rid, text, idx=0):
        return {"id": rid, "para_hash": "gone", "para_idx": idx, "anchor_text": text}

    def test_short_lines_are_never_fuzzy_matched(self):
        matched, moved, stale = SP.match_corrections([self.row("a", "Yes, I know.")], ["k"], ["Yes, I knew."])
        self.assertEqual((matched, moved, len(stale)), ({}, [], 1))

    def test_one_correction_per_paragraph(self):
        text = "The rider crossed the river at dawn, and the water was cold and grey."
        rows = [self.row("a", text), self.row("b", text.replace("cold", "cool"))]
        matched, moved, stale = SP.match_corrections(rows, ["k"], [text.replace("dawn", "dusk")])
        self.assertEqual(len(matched), 1)
        self.assertEqual(len(stale), 1)
        self.assertEqual(matched[0]["id"], "a")  # the closer anchor wins

    def test_similarity_is_bounded(self):
        self.assertEqual(SP.similarity("a" * 50, "b" * 50), 0.0)
        self.assertGreater(SP.similarity("kitten sitting on the mat" * 2, "kitten sat on the mat" * 2), 0.7)


if __name__ == "__main__":
    unittest.main()

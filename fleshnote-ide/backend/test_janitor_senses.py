"""Tests for sensory evidence (routes/janitor_senses.py): the Janitor's
"missing senses" card and the Stats → Senses overview. A perception word
counts only when it is about perceiving something, idioms are figurative,
and a missing spaCy model falls back to the lexical count rather than
reporting every sense as missing. Skips per language when the model is not
downloaded."""
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from lexicon_engine import get_lexicon
from nlp_manager import check_model_exists, parse_cached
from routes import janitor as J
from routes import janitor_senses as S
from routes.chapters import md_to_editor_html


def senses(text: str, lang: str) -> list[tuple[str, str]]:
    """(sense, matched word) for every piece of evidence in a paragraph."""
    return [(h[0], text[h[2]:h[3]]) for h in S.sense_hits(parse_cached(lang, text), text, lang)]


def found(text: str, lang: str) -> set[str]:
    return {sense for sense, _ in senses(text, lang)}


class TestIdiomData(unittest.TestCase):
    def test_every_idiom_matches_its_example_and_blocks_real_entries(self):
        for lang in ("en", "hu", "pl"):
            if not check_model_exists(lang):
                continue
            lex = get_lexicon(lang)
            for entry in lex.entries("idiom"):
                doc = parse_cached(lang, entry["example"])
                self.assertIn(entry["id"], [m[0]["id"] for m in lex.idiom_matches(doc)], entry["example"])
                for blocked in entry.get("blocks", []):
                    self.assertIsNotNone(lex.get(blocked), f"{entry['id']} blocks unknown {blocked}")
                self.assertEqual(len(entry.get("phrase_pos", [])), len(entry["phrase"]), entry["id"])

    def test_idiom_words_must_belong_together(self):
        cases = (("en", "In the darkness she touched the wall.", "en.idiom.in_touch"),
                 ("pl", "Krew spływała po zimnym kamieniu.", "pl.idiom.zimny_krew"))
        for lang, text, idiom in cases:
            if check_model_exists(lang):
                ids = [m[0]["id"] for m in get_lexicon(lang).idiom_matches(parse_cached(lang, text))]
                self.assertNotIn(idiom, ids, text)


@unittest.skipUnless(check_model_exists("en"), "English spaCy model not downloaded")
class TestEnglishSenses(unittest.TestCase):
    def test_perceiving_something_counts(self):
        self.assertEqual(found("She saw the ship on the horizon.", "en"), {"sight"})
        self.assertEqual(found("They listened to the rain.", "en"), {"sound"})
        self.assertEqual(found("The smell of tar hung over the dock.", "en"), {"smell"})
        self.assertIn("touch", found("She felt the rough bark under her palm.", "en"))
        self.assertEqual(found("The water was cold.", "en"), {"touch"})

    def test_knowing_and_figurative_uses_do_not_count(self):
        for text in ("I see what you mean.", "He looked tired.", "She felt guilty.",
                     "Bite your tongue, boy.", "His blood ran cold.", "It was hard to say.",
                     "The council was out of touch with the villages.", "I see your point.",
                     "She was a bit tired."):
            self.assertEqual(found(text, "en"), set(), text)

    def test_weak_words_in_dialogue_do_not_count(self):
        self.assertEqual(found("“Do you hear that?” he asked.", "en"), set())

    def test_idiom_look_alikes_still_count(self):
        self.assertIn("touch", found("In the darkness she touched the wall.", "en"))

    def test_temperature_of_a_person_is_character(self):
        self.assertEqual(found("The cold man waited by the door.", "en"), set())
        self.assertEqual(found("The cold stone chilled her palm.", "en"), {"touch"})


@unittest.skipUnless(check_model_exists("hu"), "Hungarian model not downloaded")
class TestHungarianSenses(unittest.TestCase):
    def test_perceiving_something_counts(self):
        self.assertEqual(found("Meglátta a hajót a láthatáron.", "hu"), {"sight"})  # preverb stripped
        self.assertEqual(found("Hallotta a harangszót.", "hu"), {"sound"})
        self.assertEqual(found("A kávé illata betöltötte a szobát.", "hu"), {"smell"})
        self.assertEqual(found("A víz hideg volt.", "hu"), {"touch"})

    def test_knowing_and_figurative_uses_do_not_count(self):
        for text in ("Látom, hogy fáradt vagy.", "Hideg vérrel lőtt.", "A fától nem látja az erdőt."):
            self.assertEqual(found(text, "hu"), set(), text)


@unittest.skipUnless(check_model_exists("pl"), "Polish model not downloaded")
class TestPolishSenses(unittest.TestCase):
    def test_perceiving_something_counts(self):
        self.assertEqual(found("Zobaczył statek na horyzoncie.", "pl"), {"sight"})
        self.assertEqual(found("Patrzył na morze.", "pl"), {"sight"})  # lemma 'patrzyć': stem match
        self.assertEqual(found("Woda była zimna.", "pl"), {"touch"})
        self.assertEqual(found("Zupa była słona.", "pl"), {"taste"})

    def test_the_object_decides_the_sense_of_feel(self):
        self.assertEqual(found("Poczuła zapach dymu.", "pl"), {"smell"})

    def test_idiom_look_alikes_still_count(self):
        self.assertEqual(found("Krew spływała po zimnym kamieniu.", "pl"), {"touch"})

    def test_touch_words_describing_people_are_character(self):
        # only where the form itself marks a man or men: the small model
        # tags most person nouns inanimate ('wielbiciel')
        self.assertEqual(found("Zimni ludzie odeszli bez słowa.", "pl"), set())
        self.assertEqual(found("Wszyscy byli sztywni i pochmurni.", "pl"), set())

    def test_try_is_not_taste(self):
        self.assertEqual(found("Spróbował wstać.", "pl"), set())
        self.assertEqual(found("Spróbował polędwicy.", "pl"), {"taste"})

    def test_knowing_and_figurative_uses_do_not_count(self):
        for text in ("Widzę, że jesteś zmęczony.", "Poczuł się winny.", "Działał z zimną krwią."):
            self.assertEqual(found(text, "pl"), set(), text)


class TestChapterCard(unittest.TestCase):
    def test_card_lists_only_senses_without_evidence(self):
        blocks = [(0, "a"), (1, "b")]
        results = [{"senses": [["sight", "x", 0, 1]]}, {"senses": [["sound", "y", 0, 1]]}]
        counts = S.count_senses(blocks, results, "hu")
        card = S.five_senses_card(counts, "ab")
        self.assertEqual(card[0]["matched_text"], "szaglás, tapintás, ízlelés")

    def test_unparsed_blocks_are_counted_lexically(self):
        blocks = [(0, "The bitter smell of smoke.")]
        counts = S.count_senses(blocks, [{"flags": []}], "en")
        self.assertGreater(counts["smell"], 0)


class _Project(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="fn_senses_")
        os.makedirs(os.path.join(self.dir, "md"))
        conn = sqlite3.connect(os.path.join(self.dir, "fleshnote.db"))
        conn.execute("CREATE TABLE chapters (id INTEGER PRIMARY KEY, chapter_number INTEGER, title TEXT, "
                     "md_filename TEXT, deleted INTEGER DEFAULT 0)")
        conn.commit()
        conn.close()

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def add_chapter(self, cid: int, md: str, deleted: int = 0):
        name = f"ch_{cid:03d}.md"
        with open(os.path.join(self.dir, "md", name), "w", encoding="utf-8") as f:
            f.write(md)
        conn = sqlite3.connect(os.path.join(self.dir, "fleshnote.db"))
        conn.execute("INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) VALUES (?,?,?,?,?)",
                     (cid, cid, f"Chapter {cid}", name, deleted))
        conn.commit()
        conn.close()

    def overview(self, lang="en"):
        res = J.janitor_senses_overview(J.SensesOverviewRequest(project_path=self.dir, language=lang))
        self.assertEqual(res["status"], "ok", res.get("error"))
        return res["chapters"]


@unittest.skipUnless(check_model_exists("en"), "English spaCy model not downloaded")
class TestOverview(_Project):
    MD = ("<p>{{char:5|Sophia}} saw the lighthouse.</p><p>The bell rang twice.</p>"
          "<p>It was hard to say.</p>")

    def test_overview_reuses_what_the_janitor_parsed(self):
        self.add_chapter(1, self.MD)
        html = md_to_editor_html(self.MD)
        res = J.janitor_analyze(J.JanitorRequest(project_path=self.dir, chapter_id=1, html=html, language="en"))
        self.assertEqual(res["status"], "ok", res.get("error"))
        real_budget = S.OVERVIEW_BUDGET_S
        S.OVERVIEW_BUDGET_S = 0  # nothing may be parsed now: every block must come from the cache
        try:
            [chapter] = self.overview()
        finally:
            S.OVERVIEW_BUDGET_S = real_budget
        self.assertEqual(chapter["parsed_blocks"], chapter["total_blocks"])
        self.assertEqual(chapter["senses"], {"sight": 1, "sound": 1, "smell": 0, "touch": 0, "taste": 0})
        card = [s for s in res["suggestions"] if s["type"] == "five_senses"]
        self.assertEqual(card[0]["matched_text"], "smell, touch, taste")

    def test_cold_chapters_are_parsed_and_deleted_ones_skipped(self):
        self.add_chapter(1, self.MD)
        self.add_chapter(2, "<p>She smelled the smoke.</p>", deleted=1)
        [chapter] = self.overview()
        self.assertEqual(chapter["parsed_blocks"], 3)
        self.assertEqual(chapter["senses"]["sight"], 1)

    def test_without_a_model_the_card_falls_back_to_the_word_lists(self):
        import nlp_manager
        from routes import janitor_paragraphs as JP
        real = nlp_manager.check_model_exists
        nlp_manager.check_model_exists = lambda lang: False
        JP._engine_cache.clear()
        try:
            html = md_to_editor_html("<p>The bitter smell of smoke. She saw the light.</p>")
            res = J.janitor_analyze(J.JanitorRequest(project_path=self.dir, chapter_id=1, html=html, language="en"))
            self.add_chapter(1, "<p>The bitter smell of smoke.</p>")
            [chapter] = self.overview()
        finally:
            nlp_manager.check_model_exists = real
        card = [s for s in res["suggestions"] if s["type"] == "five_senses"]
        self.assertNotIn("smell", card[0]["matched_text"])
        self.assertNotIn("sight", card[0]["matched_text"])
        self.assertEqual(chapter["parsed_blocks"], 0)
        self.assertGreater(chapter["senses"]["smell"], 0)


if __name__ == "__main__":
    unittest.main()

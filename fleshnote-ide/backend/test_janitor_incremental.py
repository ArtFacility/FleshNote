"""Tests for the paragraph-incremental Janitor (routes/janitor_paragraphs.py) and
its local cache (janitor_cache.py). They drive janitor_analyze with editor-style
HTML — blocks with no separator between them — because that is what the app
sends; newline-joined text would hide offset and sentence-boundary bugs."""
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest
import zipfile

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from nlp_manager import check_model_exists
import janitor_cache
import project_io
from routes import janitor as J
from routes import janitor_paragraphs as JP

FILLER = "<p>The road ran on past the old mill and down to the river where the boats lay.</p>"


def html(*paragraphs: str) -> str:
    return "".join(f"<p>{p}</p>" for p in paragraphs)


class _Project(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="fn_janitor_")
        open(os.path.join(self.dir, "fleshnote.db"), "wb").close()

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def analyze(self, body: str, lang: str = "en", chapter_id="ch1"):
        res = J.janitor_analyze(J.JanitorRequest(
            project_path=self.dir, chapter_id=chapter_id, html=body, language=lang))
        self.assertEqual(res["status"], "ok", res.get("error"))
        return res["suggestions"]

    def sdt(self, suggestions):
        return [s for s in suggestions if s["type"] == "show_dont_tell"]


class TestBlocks(unittest.TestCase):
    def test_blocks_use_the_editor_coordinate(self):
        body = "<h2>One</h2><p>Two &amp; three</p><p>Four<br>five</p><p></p>"
        blocks = JP.split_blocks(body)
        self.assertEqual([t for _, t in blocks], ["One", "Two & three", "Four", "five"])
        self.assertEqual("".join(t for _, t in blocks), J._html_to_plain(body))
        self.assertEqual([s for s, _ in blocks], [0, 3, 14, 18])


@unittest.skipUnless(check_model_exists("en"), "English spaCy model not downloaded")
class TestIncrementalEnglish(_Project):
    def test_offsets_point_at_the_matched_text(self):
        body = html("It rained all day.", "She was terrified.", "Much to my surprise, he left.")
        plain = J._html_to_plain(body)
        cards = self.analyze(body)
        self.assertTrue(self.sdt(cards))
        for card in cards:
            if card["type"] in JP.CHAPTER_WIDE_TYPES:
                continue
            start = card["char_offset"]
            self.assertEqual(plain[start:start + len(card["matched_text"])], card["matched_text"], card)

    def test_paragraphs_do_not_run_together(self):
        # Without a separator 'ceiling' and 'Sophia' were one garbled sentence.
        cards = self.analyze(html("The water droplet falls from the ceiling",
                                  "Sophia looks offended: “Playing around?”"))
        self.assertIn("looks offended", [c["matched_text"] for c in self.sdt(cards)])

    def test_whole_chapter_is_analyzed(self):
        body = FILLER * 140 + html("She was terrified.")
        self.assertGreater(len(J._html_to_plain(body)), 10000)
        self.assertTrue(any("terrified" in c["matched_text"] for c in self.sdt(self.analyze(body))))

    def test_only_the_edited_paragraph_is_reanalyzed(self):
        calls = []
        real = JP.analyze_block

        def counting(text, lang):
            calls.append(text)
            return real(text, lang)

        JP.analyze_block = counting
        try:
            paras = ["She was furious.", "It rained.", "He felt guilty about the lie."]
            first = {c["matched_text"]: c["id"] for c in self.sdt(self.analyze(html(*paras)))}
            calls.clear()
            paras[0] = "She was furious, and said so."
            second = {c["matched_text"]: c["id"] for c in self.sdt(self.analyze(html(*paras)))}
        finally:
            JP.analyze_block = real
        self.assertEqual(calls, ["She was furious, and said so."])
        # the untouched paragraph's card keeps its id although its offset moved
        self.assertEqual(first["felt guilty"], second["felt guilty"])

    def test_identical_paragraphs_get_distinct_ids(self):
        cards = self.sdt(self.analyze(html("She was furious.", "It rained.", "She was furious.")))
        self.assertEqual(len(cards), 2)
        self.assertNotEqual(cards[0]["id"], cards[1]["id"])

    def test_cards_nearest_the_latest_edit_come_first(self):
        paras = [f"Day {i}. She was furious." for i in range(8)]
        self.analyze(html(*paras))
        paras[7] = "Day 7. She was furious again."
        cards = self.sdt(self.analyze(html(*paras)))
        self.assertEqual(len(cards), JP.CAPS["show_dont_tell"])
        plain = J._html_to_plain(html(*paras))
        self.assertIn("Day 7", plain[cards[0]["char_offset"] - 20:cards[0]["char_offset"]])
        # first run (no edit history): document order
        cold = self.sdt(self.analyze(html(*paras), chapter_id="ch-new"))
        self.assertEqual(sorted(c["char_offset"] for c in cold), [c["char_offset"] for c in cold])

    def test_threshold_applies_to_cached_results(self):
        body = html("She was terrified.")
        self.assertTrue(self.sdt(self.analyze(body)))
        res = J.janitor_analyze(J.JanitorRequest(project_path=self.dir, chapter_id="ch1",
                                                 html=body, language="en", confidence_threshold=0.95))
        self.assertFalse(self.sdt(res["suggestions"]))

    def test_a_broken_model_only_costs_the_grammar_cards(self):
        import nlp_manager
        real = nlp_manager.get_nlp
        JP._engine_cache.clear()

        def broken(lang):
            raise RuntimeError("model unavailable")

        nlp_manager.get_nlp = broken
        try:
            cards = self.analyze(html("She was terrified. She saidd it twice."))
        finally:
            nlp_manager.get_nlp = real
            JP._engine_cache.clear()
        self.assertFalse(self.sdt(cards))
        self.assertTrue(any(c["type"] == "typo" for c in cards), cards)

    def test_janitor_works_without_the_cache(self):
        real_init = janitor_cache.AnalysisCache.__init__

        def broken(cache_self, project_path):
            cache_self.conn = None

        janitor_cache.AnalysisCache.__init__ = broken
        try:
            self.assertTrue(self.sdt(self.analyze(html("She was terrified."))))
        finally:
            janitor_cache.AnalysisCache.__init__ = real_init


@unittest.skipUnless(check_model_exists("hu"), "Hungarian model not downloaded")
class TestIncrementalHungarian(_Project):
    def test_dash_dialogue_attribution_in_a_middle_paragraph(self):
        cards = self.analyze(html("Esett az eső.", "– Nem – mondta büszkén Weisz.", "Aztán hallgattak."), "hu")
        self.assertIn("büszkén", [c["matched_text"] for c in self.sdt(cards)])


class TestCacheFile(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="fn_cache_")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def test_round_trip_and_schema_reset(self):
        cache = janitor_cache.AnalysisCache(self.dir)
        cache.put_results("en", "e1", {"h1": {"flags": [1]}})
        self.assertEqual(cache.get_results("en", "e1", ["h1", "h2"]), {"h1": {"flags": [1]}})
        self.assertEqual(cache.get_results("en", "e2", ["h1"]), {})  # other engine version
        cache.save_chapter_state(7, ["h1"], {"h1": 5.0})
        self.assertEqual(cache.chapter_state(7), (["h1"], {"h1": 5.0}))
        cache.close()
        conn = sqlite3.connect(os.path.join(self.dir, janitor_cache.CACHE_FILENAME))
        conn.execute("PRAGMA user_version=99")
        conn.commit()
        conn.close()
        cache = janitor_cache.AnalysisCache(self.dir)
        self.assertEqual(cache.get_results("en", "e1", ["h1"]), {})
        cache.close()

    def test_cache_never_travels_in_a_flnote_archive(self):
        project = os.path.join(self.dir, "Book.flnote")
        os.makedirs(os.path.join(project, "md"))
        sqlite3.connect(os.path.join(project, "fleshnote.db")).close()
        with open(os.path.join(project, "fleshnote_project.json"), "w") as f:
            f.write("{}")
        janitor_cache.AnalysisCache(project).close()
        archive = project_io.zip_project(project, os.path.join(self.dir, "out.flnote"))
        with zipfile.ZipFile(archive) as zf:
            self.assertFalse([n for n in zf.namelist() if "cache" in n])
        # a hand-zipped folder that does contain it still imports
        with zipfile.ZipFile(os.path.join(self.dir, "hand.zip"), "w") as zf:
            zf.write(os.path.join(project, "fleshnote.db"), "fleshnote.db")
            zf.writestr("fleshnote_project.json", "{}")
            zf.writestr("fleshnote_cache.db", b"x")
        with zipfile.ZipFile(os.path.join(self.dir, "hand.zip")) as zf:
            project_io.validate_archive(zf)


if __name__ == "__main__":
    unittest.main()

"""Tests for lexicon_engine.py.

GOLDEN holds the word lists the Janitor analyzers had hard-coded before the
lexicon JSON existed, copied verbatim. The legacy tier of the lexicon must
reproduce them exactly, so moving the analyzers onto the JSON changes no output.
Never edit a row to match new data. When an analyzer is widened on purpose (with
benchmark numbers), add its constant to WIDENED; the row keeps pinning the data."""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import lexicon_engine as LE

# Analyzer constants that deliberately use more than the legacy tier (P2).
WIDENED = {"EMOTION_LEXICON_EN", "EMOTION_LEXICON_HU"}

GOLDEN = {
    ("en", "emotion_label", "EMOTION_LEXICON_EN"): {
        'afraid', 'angry', 'annoyed', 'anxious', 'ashamed', 'bitter', 'confused',
        'content', 'depressed', 'desperate', 'devastated', 'disgusted', 'ecstatic',
        'elated', 'embarrassed', 'excited', 'frustrated', 'furious', 'gloomy', 'guilty',
        'happy', 'heartbroken', 'hopeful', 'horrified', 'irritated', 'jealous',
        'lonely', 'miserable', 'nervous', 'proud', 'relieved', 'remorseful',
        'resentful', 'sad', 'scared', 'shocked', 'surprised', 'terrified', 'upset',
        'worried'
    },
    ("en", "emotion_adverb", "EMOTION_ADVERBS_EN"): {
        'angrily', 'anxiously', 'bitterly', 'desperately', 'furiously', 'gleefully',
        'happily', 'jealously', 'miserably', 'nervously', 'proudly', 'resentfully',
        'sadly'
    },
    ("en", "filter_verb", "FILTER_VERBS_EN"): {
        'feel', 'hear', 'notice', 'observe', 'see', 'smell', 'taste', 'watch'
    },
    ("en", "realize_verb", "REALIZE_VERBS_EN"): {
        'realize', 'recognize', 'sense', 'understand'
    },
    ("en", "conflict_speech", "SPEECH_VERBS_EN"): {
        'ask', 'bark', 'call', 'cry', 'demand', 'exclaim', 'growl', 'hiss', 'insist',
        'murmur', 'muse', 'mutter', 'plead', 'reflect', 'reply', 'say', 'shout', 'snap',
        'snarl', 'stammer', 'tell', 'think', 'whisper', 'wonder'
    },
    ("hu", "emotion_label", "EMOTION_LEXICON_HU"): {
        'aggódó', 'boldog', 'boldogtalan', 'borús', 'bosszús', 'büszke', 'bűntudatos',
        'csalódott', 'dühös', 'elkeseredett', 'elégedett', 'féltékeny', 'félős',
        'ideges', 'ijedt', 'izgatott', 'kétségbeesett', 'lehangolt', 'magányos',
        'megtört', 'mérges', 'nyugtalan', 'reménykedő', 'reménytelen', 'rettegő',
        'szomorú', 'szorongó', 'szégyenlős', 'undorodó', 'zavart'
    },
    ("hu", "emotion_adverb", "EMOTION_ADVERBS_HU"): {
        'boldogan', 'büszkén', 'dühösen', 'féltékenyen', 'haragosan', 'idegesen',
        'keserűen', 'kétségbeesetten', 'nyomorultul', 'szomorúan', 'szorongva',
        'örömmel'
    },
    ("hu", "filter_verb", "FILTER_VERBS_HU"): {
        'figyel', 'hall', 'lát', 'megfigyel', 'szagol', 'érez', 'észrevesz'
    },
    ("hu", "realize_verb", "REALIZE_VERBS_HU"): {
        'belát', 'felismer', 'megért', 'rájön'
    },
    ("hu", "conflict_speech", "SPEECH_VERBS_HU"): {
        'felel', 'gondol', 'kiált', 'kérdez', 'könyörög', 'mond', 'mormol', 'morog',
        'ordít', 'suttog', 'szól', 'töpreng', 'tűnődik', 'válaszol'
    },
    ("pl", "emotion_label", "EMOTION_LEXICON_PL"): {
        'dumny', 'nerwowy', 'niespokojny', 'podekscytowany', 'podniecony', 'przerażony',
        'przestraszony', 'przygnębiony', 'rozczarowany', 'rozgoryczony', 'rozżalony',
        'samotny', 'sfrustrowany', 'skrępowany', 'smutny', 'szczęśliwy', 'uradowany',
        'winny', 'wzburzony', 'wściekły', 'zakłopotany', 'zaniepokojony', 'zasmucony',
        'zawstydzony', 'zazdrosny', 'zbulwersowany', 'zdenerwowany', 'zirytowany',
        'zrozpaczony', 'zły'
    },
    ("pl", "emotion_adverb", "EMOTION_ADVERBS_PL"): {
        'boleśnie', 'desperacko', 'dumnie', 'gniewnie', 'nerwowo', 'ponuro', 'radośnie',
        'smutnie', 'szczęśliwie', 'z dumą', 'z zazdrością', 'zazdrośnie', 'ze smutkiem',
        'ze złością', 'złośliwie', 'żałośnie'
    },
    ("pl", "filter_verb", "FILTER_VERBS_PL"): {
        'czuć', 'obserwować', 'poczuć', 'słyszeć', 'usłyszeć', 'widzieć', 'wąchać',
        'zauważyć', 'zobaczyć'
    },
    ("pl", "realize_verb", "REALIZE_VERBS_PL"): {
        'rozpoznać', 'rozumieć', 'uświadomić', 'zdać', 'zrozumieć'
    },
    ("pl", "conflict_speech", "SPEECH_VERBS_PL"): {
        'błagać', 'krzyczeć', 'mruczeć', 'mruknąć', 'myśleć', 'mówić', 'odpowiedzieć',
        'odrzec', 'powiedzieć', 'pytać', 'rozmyślać', 'rzucić', 'stwierdzić', 'szeptać',
        'szlochać', 'warknąć', 'wołać', 'zapytać', 'zastanawiać'
    },
}


class TestLegacyParity(unittest.TestCase):
    def test_legacy_tier_matches_pre_lexicon_lists(self):
        for (lang, kind, name), old in GOLDEN.items():
            # Multi-word strings in the old sets ("ze złością") were compared
            # against one token's lemma, so they never matched; not carried over.
            expected = {w for w in old if " " not in w}
            with self.subTest(list=name):
                self.assertEqual(LE.get_lexicon(lang).lemmas(kind, legacy_only=True), expected)

    def test_analyzer_constants_come_from_the_lexicon(self):
        from routes import janitor as J, hun_janitor as H, pol_janitor as P
        modules = {"en": J, "hu": H, "pl": P}
        for (lang, kind, name) in GOLDEN:
            if name in WIDENED:
                # Widened lists still come only from this kind of the lexicon.
                self.assertLessEqual(getattr(modules[lang], name), LE.get_lexicon(lang).lemmas(kind))
                continue
            with self.subTest(list=name):
                self.assertIs(getattr(modules[lang], name),
                              LE.get_lexicon(lang).lemmas(kind, legacy_only=True))


class TestLoader(unittest.TestCase):
    def test_all_languages_and_kinds_load(self):
        for lang in ("en", "hu", "pl"):
            lex = LE.get_lexicon(lang)
            for kind in LE.KINDS:
                with self.subTest(lang=lang, kind=kind):
                    self.assertTrue(lex.entries(kind), f"{lang}/{kind} is empty")

    def test_full_kind_is_superset_of_legacy(self):
        lex = LE.get_lexicon("en")
        self.assertLess(lex.lemmas("emotion_label", legacy_only=True), lex.lemmas("emotion_label"))

    def test_pos_gates_name_word_classes(self):
        # A `pos` list gates matching, so a tag from tagging the bare word
        # ('gun' → PROPN) makes the entry dead in real text (batch 2).
        for lang in ("en", "hu", "pl"):
            lex = LE.get_lexicon(lang)
            for kind in LE.KINDS:
                bad = [e["id"] for e in lex.entries(kind) if set(e.get("pos") or ()) & {"PROPN", "X", "SYM", "NUM"}]
                self.assertEqual(bad, [], f"{lang}/{kind}")

    def test_lookup_by_id(self):
        self.assertEqual(LE.get_lexicon("en").get("en.emo.angry")["lemma"], "angry")
        self.assertIsNone(LE.get_lexicon("en").get("en.emo.nope"))

    def test_unknown_kind_raises(self):
        with self.assertRaises(KeyError):
            LE.get_lexicon("en").entries("emotions")

    def test_missing_language_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(LE.LexiconError):
                LE.get_lexicon("en", base_dir=Path(tmp))

    def _write(self, tmp, entries, kind="negator"):
        d = Path(tmp) / "en"
        d.mkdir(exist_ok=True)
        (d / f"{kind}.json").write_text(json.dumps(
            {"lang": "en", "kind": kind, "version": 1, "entries": entries}), encoding="utf-8")

    def test_malformed_files_raise(self):
        bad = [
            [{"id": "en.x", "lemma": "a"}, {"id": "en.x", "lemma": "b"}],   # duplicate id
            [{"id": "en.x", "lemma": "a", "phrase": ["a", "b"]}],          # lemma and phrase
            [{"lemma": "a"}],                                              # no id
            [{"id": "en.x", "lemma": "a", "kind": "hedge"}],               # kind mismatch
        ]
        for entries in bad:
            with self.subTest(entries=entries), tempfile.TemporaryDirectory() as tmp:
                self._write(tmp, entries)
                with self.assertRaises(LE.LexiconError):
                    LE.get_lexicon("en", base_dir=Path(tmp))

    def test_phrases_excluded_from_lemma_set(self):
        with tempfile.TemporaryDirectory() as tmp:
            self._write(tmp, [{"id": "en.neg.not", "lemma": "not"},
                              {"id": "en.neg.no_one", "phrase": ["no", "one"]}])
            self.assertEqual(LE.get_lexicon("en", base_dir=Path(tmp)).lemmas("negator"), {"not"})

    def test_loads_independent_of_working_directory(self):
        code = ("import lexicon_engine as LE; "
                "print(len(LE.get_lexicon('hu').lemmas('emotion_label')))")
        with tempfile.TemporaryDirectory() as tmp:
            out = subprocess.run([sys.executable, "-c", code], cwd=tmp, capture_output=True, text=True,
                                 env={**os.environ, "PYTHONPATH": backend_dir})
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertGreater(int(out.stdout.strip()), 0)


if __name__ == "__main__":
    unittest.main()

"""Synonyms for other languages come from the omw-1.4 data FleshNote bundles and
merges Hungarian into. If WordNet reads another package, lookups don't fail: they
quietly fall back to English, so this has to be tested on purpose."""
import os
import shutil
import sys
import tempfile
import unittest

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import nltk

import nltk_manager


class TestWordnetLoader(unittest.TestCase):
    def test_reads_the_bundled_multilingual_package(self):
        omw = nltk_manager.wordnet._LazyCorpusLoader__args[0]
        self.assertEqual(omw._LazyCorpusLoader__name, "omw-1.4")

    def test_no_code_path_uses_nltks_own_loader(self):
        # nltk.corpus.wordnet picks its own package, which changes between NLTK versions.
        for rel in ("nltk_manager.py", os.path.join("routes", "janitor.py")):
            with open(os.path.join(backend_dir, rel), encoding="utf-8") as f:
                self.assertNotIn("from nltk.corpus import wordnet", f.read(), rel)


class TestHungarianLookup(unittest.TestCase):
    """The whole path, on a small omw-1.4 holding one Hungarian word."""

    def setUp(self):
        nltk_manager._ensure_nltk_path()
        if not nltk_manager.check_wordnet_exists():
            self.skipTest("no WordNet data on this machine")
        self.tmp = tempfile.mkdtemp(prefix="fn_omw_")
        lang = os.path.join(self.tmp, "corpora", "omw-1.4", "hun")
        os.makedirs(lang)
        with open(os.path.join(lang, "wn-data-hun.tab"), "w", encoding="utf-8") as f:
            f.write("# wn-data\thun\thttp://example.invalid\tfixture\n")
            f.write("02084071-n\thun:lemma\tkutya\n02084071-n\thun:lemma\teb\n")
        self.path = list(nltk.data.path)
        nltk.data.path.insert(0, self.tmp)  # found before any real omw-1.4; WordNet still comes from the real data
        self.reader = nltk_manager._wordnet()

    def tearDown(self):
        nltk.data.path[:] = self.path
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_a_hungarian_word_finds_its_synonym(self):
        groups = nltk_manager._lookup_synsets(self.reader, "kutya", "hun")
        self.assertEqual([g["synonyms"] for g in groups], [["eb"]])


if __name__ == "__main__":
    unittest.main()

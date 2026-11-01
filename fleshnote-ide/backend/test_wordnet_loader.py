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


@unittest.skipIf(os.name == "nt", "folder modes only matter on Linux and macOS")
class TestDataFolderIsPrivate(unittest.TestCase):
    """With umask 002 new folders are group-writable, and NLTK won't download into those."""

    def test_group_writable_data_folders_are_made_private(self):
        tmp = tempfile.mkdtemp(prefix="fn_private_")
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        app = os.path.join(tmp, "FleshNote")
        data_dir = os.path.join(app, "Models", "nltk_data")
        corpora = os.path.join(data_dir, "corpora")
        hungarian = os.path.join(corpora, "omw-1.4", "hun")
        os.makedirs(hungarian)
        data_file = os.path.join(hungarian, "wn-data-hun.tab")
        open(data_file, "w").close()
        folders = [app, os.path.dirname(data_dir), data_dir, corpora, os.path.dirname(hungarian), hungarian]
        for path in folders:
            os.chmod(path, 0o775)
        os.chmod(data_file, 0o664)

        nltk_manager._make_data_dirs_private(data_dir)

        for path in folders:
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o755, path)
            self.assertTrue(nltk.pathsec.is_private_dir(path), path)
        self.assertEqual(os.stat(data_file).st_mode & 0o777, 0o644)

    def test_an_empty_data_folder_is_fine(self):
        tmp = tempfile.mkdtemp(prefix="fn_private_")
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        data_dir = os.path.join(tmp, "FleshNote", "Models", "nltk_data")
        os.makedirs(data_dir)
        nltk_manager._make_data_dirs_private(data_dir)


if __name__ == "__main__":
    unittest.main()

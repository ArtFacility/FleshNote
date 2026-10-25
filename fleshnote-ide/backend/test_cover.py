"""Book cover (alpha): document validation, saving, cleanup, bookshelf and EPUB.

Run from backend/:  .venv/Scripts/python.exe -m unittest test_cover -v
"""
import base64
import io
import json
import os
import shutil
import sqlite3
import tempfile
import unittest
import zipfile

import export_fixture
from export.pipeline import ExportPipeline
from routes import cover as cover_mod

# a 1x1 transparent PNG
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
PNG_URL = "data:image/png;base64," + base64.b64encode(PNG).decode()


def face(**kw):
    base = {"bg": "#123456", "image": None, "fit": "fill", "texts": []}
    base.update(kw)
    return base


class CoverTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="fn_cover_")
        self.project = export_fixture.build(self.root)
        self.src = os.path.join(self.root, "art.png")
        with open(self.src, "wb") as f:
            f.write(PNG)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def save(self, cover, front=PNG_URL, spine=None):
        return cover_mod.save_cover(cover_mod.CoverSave(project_path=self.project, cover=cover,
                                                        front_png=front, spine_png=spine))

    def config_row(self):
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        try:
            return conn.execute("SELECT config_value FROM project_config WHERE config_key='cover'").fetchone()
        finally:
            conn.close()

    def test_add_image_copies_into_assets_cover(self):
        rel = cover_mod.add_cover_image(cover_mod.CoverImageAdd(project_path=self.project, source_path=self.src))["path"]
        self.assertRegex(rel, r"^assets/cover/img_[0-9a-f]{12}\.png$")
        self.assertTrue(os.path.isfile(os.path.join(self.project, *rel.split("/"))))

    def test_add_image_rejects_other_files(self):
        bad = os.path.join(self.root, "notes.txt")
        with open(bad, "w") as f:
            f.write("x")
        with self.assertRaises(Exception):
            cover_mod.add_cover_image(cover_mod.CoverImageAdd(project_path=self.project, source_path=bad))

    def test_save_round_trip_and_bookshelf_and_epub(self):
        img = cover_mod.add_cover_image(cover_mod.CoverImageAdd(project_path=self.project, source_path=self.src))["path"]
        doc = {"faces": {"front": face(image=img, texts=[{"id": "t1", "text": "The Lamps", "x": 0.5, "y": 0.3,
                                                         "w": 0.8, "size": 0.1, "font": "serif", "color": "#ffffff"}]),
                         "spine": face(), "back": face()}}
        saved = self.save(doc, spine=PNG_URL)["cover"]
        self.assertEqual(saved["faces"]["front"]["image"], img)
        self.assertRegex(saved["render"]["front"], r"^assets/cover/front_[0-9a-f]{12}\.png$")
        self.assertRegex(saved["render"]["spine"], r"^assets/cover/spine_[0-9a-f]{12}\.png$")
        self.assertEqual(cover_mod.load_cover(self.project), saved)
        # synced like any other setting
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        logged = conn.execute("SELECT COUNT(*) FROM change_log WHERE table_name='project_config' AND row_id='cover'").fetchone()[0]
        conn.close()
        self.assertGreater(logged, 0)
        # bookshelf
        from main import _get_book_stats
        stats = _get_book_stats(self.project)
        self.assertTrue(stats["cover_image"].endswith(saved["render"]["front"].split("/")[-1]))
        # EPUB cover
        pipe = ExportPipeline(self.project)
        chapters, _ = pipe.chapters("prose")
        z = zipfile.ZipFile(io.BytesIO(pipe.render("prose", "epub", chapters=chapters)))
        self.assertIn("EPUB/images/cover.png", z.namelist())
        self.assertEqual(z.read("EPUB/images/cover.png"), PNG)
        opf = [z.read(n).decode() for n in z.namelist() if n.endswith(".opf")][0]
        self.assertIn('properties="cover-image"', opf)

    def test_saving_again_removes_replaced_files(self):
        first = self.save({"faces": {"front": face()}})["cover"]["render"]["front"]
        second = self.save({"faces": {"front": face()}})["cover"]["render"]["front"]
        self.assertNotEqual(first, second)
        self.assertFalse(os.path.exists(os.path.join(self.project, *first.split("/"))))
        self.assertTrue(os.path.exists(os.path.join(self.project, *second.split("/"))))

    def test_removing_the_cover(self):
        self.save({"faces": {"front": face()}})
        self.assertIsNone(self.save(None)["cover"])
        self.assertIsNone(cover_mod.load_cover(self.project))
        self.assertEqual(self.config_row()[0], "null")
        folder = os.path.join(self.project, "assets", "cover")
        self.assertEqual(os.listdir(folder), [])

    def test_cleanup_removes_images_that_were_never_saved(self):
        kept = cover_mod.add_cover_image(cover_mod.CoverImageAdd(project_path=self.project, source_path=self.src))["path"]
        saved = self.save({"faces": {"front": face(image=kept)}})["cover"]
        tried = [cover_mod.add_cover_image(cover_mod.CoverImageAdd(project_path=self.project, source_path=self.src))["path"]
                 for _ in range(2)]
        cover_mod.cleanup_cover(cover_mod.CoverGet(project_path=self.project))
        left = sorted("assets/cover/" + n for n in os.listdir(os.path.join(self.project, "assets", "cover")))
        self.assertEqual(left, sorted([kept, saved["render"]["front"]]))
        for rel in tried:
            self.assertNotIn(rel, left)

    def test_cleanup_without_a_cover_empties_the_folder(self):
        cover_mod.add_cover_image(cover_mod.CoverImageAdd(project_path=self.project, source_path=self.src))
        cover_mod.cleanup_cover(cover_mod.CoverGet(project_path=self.project))
        self.assertEqual(os.listdir(os.path.join(self.project, "assets", "cover")), [])

    def test_a_failed_save_leaves_no_files(self):
        with self.assertRaises(Exception):
            self.save({"faces": {"front": face()}}, front=PNG_URL,
                      spine="data:image/png;base64," + base64.b64encode(b"not a png").decode())
        folder = os.path.join(self.project, "assets", "cover")
        self.assertEqual(os.listdir(folder), [])

    def test_hostile_documents_are_cleaned(self):
        outside = os.path.join(self.root, "secret.png")
        with open(outside, "wb") as f:
            f.write(PNG)
        hostile = {"faces": {
            "front": {"bg": "red;background:url(x)", "image": "../../secret.png", "fit": "evil",
                      "texts": [{"id": "<script>", "text": "x" * 5000, "x": "NaN", "y": 9, "w": -1, "size": 99,
                                 "font": "Comic Sans", "align": "justify", "color": "url(x)"}] * 30},
            "spine": "nope",
        }, "render": {"front": "C:/Windows/win.ini"}}
        clean = cover_mod.sanitize_cover(hostile, self.project)
        f = clean["faces"]["front"]
        self.assertEqual(f["bg"], "#2c3d5c")
        self.assertIsNone(f["image"])
        self.assertEqual(f["fit"], "fill")
        self.assertEqual(len(f["texts"]), cover_mod.MAX_TEXTS)
        t = f["texts"][0]
        self.assertNotEqual(t["id"], "<script>")
        self.assertEqual(len(t["text"]), 2000)
        self.assertEqual((t["x"], t["y"], t["w"], t["size"]), (0.5, 1, 0.05, 0.6))
        self.assertEqual((t["font"], t["align"], t["color"]), ("serif", "center", "#f3ead8"))
        self.assertEqual(clean["faces"]["spine"]["texts"], [])
        self.assertIsNone(clean["render"]["front"])
        self.assertIsNone(cover_mod.sanitize_cover("not a cover", self.project))

    def test_render_must_be_png(self):
        with self.assertRaises(Exception):
            self.save({"faces": {"front": face()}}, front="data:image/png;base64," + base64.b64encode(b"GIF89a....").decode())

    def test_no_cover_means_plain_epub(self):
        pipe = ExportPipeline(self.project)
        chapters, _ = pipe.chapters("prose")
        z = zipfile.ZipFile(io.BytesIO(pipe.render("prose", "epub", chapters=chapters)))
        self.assertNotIn("EPUB/images/cover.png", z.namelist())


if __name__ == "__main__":
    unittest.main()

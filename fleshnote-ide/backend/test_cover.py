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
from routes import cover_fonts as fonts_mod

FAKE_TTF = b"\x00\x01\x00\x00" + b"\x00" * 24

# a 1x1 transparent PNG
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
PNG_URL = "data:image/png;base64," + base64.b64encode(PNG).decode()


def face(**kw):
    base = {"bg": "#123456", "image": None, "fit": "fill", "layers": []}
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

    def save(self, cover, front=PNG_URL, spine=None, back=None):
        return cover_mod.save_cover(cover_mod.CoverSave(project_path=self.project, cover=cover,
                                                        front_png=front, spine_png=spine, back_png=back))

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
        doc = {"faces": {"front": face(
            bgType="linear", bg2="#0a0f18", bgAngle=135, image=img, imageOpacity=0.8, vignette=0.35,
            layers=[
                {"id": "s1", "type": "shape", "shape": "double-frame", "x": 0.5, "y": 0.5,
                 "w": 0.86, "h": 0.9, "fill": "none", "stroke": "#f3ead8", "strokeWidth": 0.004},
                {"id": "t1", "type": "text", "text": "The Lamps", "x": 0.5, "y": 0.3,
                 "w": 0.8, "size": 0.1, "font": "serif", "color": "#ffffff", "lineHeight": 1.05, "shadow": 0.4},
            ],
        ), "spine": face(), "back": face()}}
        saved = self.save(doc, spine=PNG_URL)["cover"]
        self.assertEqual(saved["version"], 2)
        self.assertEqual(saved["faces"]["front"]["image"], img)
        self.assertEqual(saved["faces"]["front"]["bgType"], "linear")
        self.assertEqual(len(saved["faces"]["front"]["layers"]), 2)
        self.assertEqual(saved["faces"]["front"]["layers"][0]["shape"], "double-frame")
        self.assertEqual(saved["faces"]["front"]["layers"][1]["lineHeight"], 1.05)
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
            "front": {"bg": "red;background:url(x)", "bgType": "conic", "bg2": "bad", "bgAngle": 999,
                      "image": "../../secret.png", "fit": "evil", "imageOpacity": -2, "imageScale": 99,
                      "vignette": 5,
                      "layers": [
                          {"id": "<script>", "type": "text", "text": "x" * 5000, "x": "NaN", "y": 9, "w": -1, "size": 99,
                           "font": "Comic Sans", "align": "justify", "color": "url(x)", "lineHeight": 10, "rotation": 720},
                          {"id": "sh1", "type": "shape", "shape": "hexagon", "fill": "url(x)", "stroke": "none",
                           "strokeWidth": 1, "radius": 2, "lineStyle": "zigzag", "opacity": -1},
                      ] * 30},
            "spine": "nope",
        }, "render": {"front": "C:/Windows/win.ini"}}
        clean = cover_mod.sanitize_cover(hostile, self.project)
        self.assertEqual(clean["version"], 2)
        f = clean["faces"]["front"]
        self.assertEqual(f["bg"], "#2c3d5c")
        self.assertEqual(f["bgType"], "solid")
        self.assertEqual(f["bg2"], "#141c2b")
        self.assertEqual(f["bgAngle"], 360)
        self.assertIsNone(f["image"])
        self.assertEqual(f["fit"], "fill")
        self.assertEqual((f["imageOpacity"], f["imageScale"], f["vignette"]), (0, 3, 1))
        self.assertEqual(len(f["layers"]), cover_mod.MAX_LAYERS)
        t = f["layers"][0]
        self.assertNotEqual(t["id"], "<script>")
        self.assertEqual(t["type"], "text")
        self.assertEqual(len(t["text"]), 2000)
        self.assertEqual((t["x"], t["y"], t["w"], t["size"]), (0.5, 1, 0.02, 0.6))
        self.assertEqual((t["font"], t["align"], t["color"]), ("serif", "center", "#f3ead8"))
        self.assertEqual((t["lineHeight"], t["rotation"]), (2.5, 180))
        s = f["layers"][1]
        self.assertEqual(s["type"], "shape")
        self.assertEqual((s["shape"], s["fill"], s["stroke"], s["lineStyle"]), ("rect", "#d4a052", "none", "solid"))
        self.assertEqual((s["strokeWidth"], s["radius"], s["opacity"]), (0.05, 0.5, 0))
        self.assertEqual(clean["faces"]["spine"]["layers"], [])
        self.assertIsNone(clean["render"]["front"])
        self.assertIsNone(cover_mod.sanitize_cover("not a cover", self.project))

    def test_v1_texts_migrate_to_v2_layers(self):
        v1 = {
            "version": 1,
            "faces": {
                "front": {"bg": "#112233", "image": None, "fit": "fill",
                          "texts": [{"id": "legacy1", "text": "Old Cover", "x": 0.5, "y": 0.3,
                                     "w": 0.8, "size": 0.12, "font": "serif", "bold": True,
                                     "italic": False, "upper": False, "spacing": 0.05,
                                     "align": "center", "color": "#ffffff"}]},
                "spine": {"bg": "#112233", "image": None, "fit": "fill", "texts": []},
                "back": {"bg": "#112233", "image": None, "fit": "fill", "texts": []},
            },
            "render": {"front": None, "spine": None},
        }
        migrated = cover_mod.sanitize_cover(v1, self.project)
        self.assertEqual(migrated["version"], 2)
        layers = migrated["faces"]["front"]["layers"]
        self.assertEqual(len(layers), 1)
        self.assertEqual(layers[0]["type"], "text")
        self.assertEqual(layers[0]["id"], "legacy1")
        self.assertEqual(layers[0]["text"], "Old Cover")
        self.assertTrue(layers[0]["bold"])
        self.assertEqual(layers[0]["lineHeight"], 1.2)
        self.assertTrue(layers[0]["visible"])

    def test_render_must_be_png(self):
        with self.assertRaises(Exception):
            self.save({"faces": {"front": face()}}, front="data:image/png;base64," + base64.b64encode(b"GIF89a....").decode())

    def test_no_cover_means_plain_epub(self):
        pipe = ExportPipeline(self.project)
        chapters, _ = pipe.chapters("prose")
        z = zipfile.ZipFile(io.BytesIO(pipe.render("prose", "epub", chapters=chapters)))
        self.assertNotIn("EPUB/images/cover.png", z.namelist())

    def test_custom_font_import_save_and_prune(self):
        font_file = os.path.join(self.root, "Display-Serif.ttf")
        with open(font_file, "wb") as f:
            f.write(FAKE_TTF)
        added = cover_mod.add_cover_font(cover_mod.CoverImageAdd(project_path=self.project, source_path=font_file))["font"]
        self.assertRegex(added["path"], r"^assets/cover/font_[0-9a-f]{12}\.ttf$")
        self.assertEqual(added["label"], "Display Serif")

        # add a second unused font that should be pruned on save
        unused = cover_mod.add_cover_font(cover_mod.CoverImageAdd(project_path=self.project, source_path=font_file))["font"]

        doc = {
            "fonts": {added["id"]: added},
            "faces": {
                "front": face(layers=[
                    {"id": "t1", "type": "text", "text": "Custom", "font": added["id"]},
                    {"id": "t2", "type": "text", "text": "Pack", "font": "cinzel"},
                ]),
                "spine": face(),
                "back": face(),
            },
        }
        saved = self.save(doc)["cover"]
        self.assertIn(added["id"], saved["fonts"])
        self.assertEqual(saved["faces"]["front"]["layers"][0]["font"], added["id"])
        self.assertEqual(saved["faces"]["front"]["layers"][1]["font"], "cinzel")
        self.assertTrue(os.path.isfile(os.path.join(self.project, *added["path"].split("/"))))
        self.assertFalse(os.path.exists(os.path.join(self.project, *unused["path"].split("/"))))

    def test_custom_font_rejects_bad_files(self):
        bad_ttf = os.path.join(self.root, "evil.ttf")
        with open(bad_ttf, "wb") as f:
            f.write(b"MZnot-really-a-font")
        with self.assertRaises(Exception):
            cover_mod.add_cover_font(cover_mod.CoverImageAdd(project_path=self.project, source_path=bad_ttf))

    def test_font_pack_download_read_and_remove_mocked(self):
        pack_dir = os.path.join(self.root, "CoverFonts")
        self.assertFalse(fonts_mod.pack_status(pack_dir)["installed"])

        css = "\n".join(
            f"@font-face {{ font-family: '{meta['gf_family']}'; font-style: normal; font-weight: 400; "
            f"src: url(https://fonts.gstatic.com/s/{fid}/test.ttf) format('truetype'); }}"
            for fid, meta in fonts_mod.FONT_PACK_FAMILIES.items()
        ).encode("utf-8")

        def fake_fetch(url, max_bytes, headers=None):
            if url.startswith("https://fonts.googleapis.com/css2"):
                return css
            if url.startswith("https://fonts.gstatic.com/"):
                return FAKE_TTF
            raise AssertionError(f"Unexpected URL: {url}")

        st = fonts_mod.download_font_pack(pack_dir, fetch_fn=fake_fetch)
        self.assertTrue(st["installed"])
        self.assertEqual(set(st["families"]), set(fonts_mod.FONT_PACK_FAMILIES.keys()))
        faces = fonts_mod.read_pack_font_faces("cinzel", pack_dir)
        self.assertEqual(len(faces), 1)
        self.assertEqual(base64.b64decode(faces[0]["data"]), FAKE_TTF)

        after_rm = fonts_mod.remove_font_pack(pack_dir)
        self.assertFalse(after_rm["installed"])

    def test_font_pack_ignores_non_gstatic_urls(self):
        css = "@font-face { font-family: 'Cinzel'; font-style: normal; font-weight: 400; src: url(https://evil.example/a.ttf); }"
        self.assertEqual(fonts_mod._parse_css2_faces(css), [])

    def test_back_render_and_wrap_export_and_pdf_cover_page(self):
        saved = self.save({"faces": {"front": face(), "spine": face(), "back": face()}},
                          front=PNG_URL, spine=PNG_URL, back=PNG_URL)["cover"]
        self.assertRegex(saved["render"]["back"], r"^assets/cover/back_[0-9a-f]{12}\.png$")

        # PDF interior omits cover by default, includes it when include_cover=True
        pipe = ExportPipeline(self.project)
        chapters, _ = pipe.chapters("prose")
        html_no_cover = pipe.render("prose", "pdf", book_ready=True, chapters=chapters, include_cover=False)
        self.assertNotIn('<div class="cover-page">', html_no_cover)
        html_with_cover = pipe.render("prose", "pdf", book_ready=True, chapters=chapters, include_cover=True)
        self.assertIn('<div class="cover-page">', html_with_cover)

        # Wrap export PNG & PDF
        png_res = cover_mod.export_cover_wrap(cover_mod.CoverWrapExport(
            project_path=self.project, png_data=PNG_URL, format="png", width_in=10.8, height_in=8.25
        ))
        self.assertEqual(png_res["status"], "success")
        self.assertTrue(os.path.isfile(png_res["filepath"]))
        with open(png_res["filepath"], "rb") as f:
            self.assertEqual(f.read(), PNG)

        pdf_res = cover_mod.export_cover_wrap(cover_mod.CoverWrapExport(
            project_path=self.project, png_data=PNG_URL, format="pdf", width_in=10.8, height_in=8.25
        ))
        self.assertEqual(pdf_res["status"], "print")
        self.assertIn("size: 10.8000in 8.2500in", pdf_res["html"])
        self.assertTrue(pdf_res["filepath"].endswith(".pdf"))


if __name__ == "__main__":
    unittest.main()

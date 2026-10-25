import asyncio
import io
import os
import shutil
import sys
import tempfile
import unittest
import zipfile

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import HTTPException, UploadFile

from routes.web_host import (AssetDeleteRequest, ConfigRequest, CoverReadRequest,
                             ProjectPathRequest, make_router)


class TestWebHost(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fn_web_host_")
        self.root = os.path.join(self.tmp, "root")
        self.outside = os.path.join(self.tmp, "outside.txt")
        with open(self.outside, "w") as f:
            f.write("secret")
        router = make_router(self.root)
        self.route = {r.path: r.endpoint for r in router.routes}
        self.root = os.path.realpath(self.root)
        self.ws = os.path.join(self.root, "workspace")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def call(self, path, *args, **kw):
        return self.route[path](*args, **kw)

    def test_folders_and_config(self):
        info = self.call("/api/web/info")
        for name in ("workspace", "uploads", "exports", "reviews"):
            self.assertTrue(os.path.isdir(info[name]), name)
        self.assertEqual(self.call("/api/web/config", ConfigRequest()), {})
        self.call("/api/web/config", ConfigRequest(update={"language": "hu"}))
        self.call("/api/web/config", ConfigRequest(update={"theme": "dark"}))
        self.assertEqual(self.call("/api/web/config", ConfigRequest()), {"language": "hu", "theme": "dark"})

    def test_upload_keeps_the_name_and_stays_in_uploads(self):
        f = UploadFile(file=io.BytesIO(b"chapter one"), filename="..\\..\\My Book?.docx")
        res = asyncio.run(self.call("/api/web/upload", f, None, None))
        self.assertTrue(res["path"].startswith(os.path.join(self.root, "uploads") + os.sep))
        self.assertEqual(os.path.basename(res["path"]), "My Book_.docx")
        with open(res["path"], "rb") as fh:
            self.assertEqual(fh.read(), b"chapter one")

    def test_a_picked_folder_stays_together(self):
        up = self.call
        for rel in ("Book/ch1.md", "Book/notes/../ch2.md", "Book/../../../escape.md"):
            f = UploadFile(file=io.BytesIO(b"x"), filename=rel.split("/")[-1])
            res = asyncio.run(up("/api/web/upload", f, "abcd1234", rel))
            self.assertTrue(res["path"].startswith(os.path.join(self.root, "uploads", "abcd1234") + os.sep), res["path"])
        folder = os.path.join(self.root, "uploads", "abcd1234")
        self.assertTrue(os.path.isfile(os.path.join(folder, "Book", "ch1.md")))
        self.assertTrue(os.path.isfile(os.path.join(folder, "Book", "notes", "ch2.md")))
        self.assertTrue(os.path.isfile(os.path.join(folder, "Book", "escape.md")))
        with self.assertRaises(HTTPException):
            asyncio.run(up("/api/web/upload", UploadFile(file=io.BytesIO(b"x"), filename="a"), "../x", "a"))
        d = self.call("/api/web/export-dir")["path"]
        self.assertTrue(os.path.isdir(d) and not os.listdir(d))

    def test_files_only_from_inside_the_root(self):
        img = os.path.join(self.ws, "proj", "assets", "img.png")
        os.makedirs(os.path.dirname(img))
        with open(img, "wb") as f:
            f.write(b"png")
        self.assertEqual(self.call("/api/web/file", img).path, img)
        # The renderer's cache breaker arrives as part of the path.
        self.assertEqual(self.call("/api/web/file", img + "?v=1712345").path, img)
        for bad in (self.outside, os.path.join(self.ws, "..", "..", "outside.txt"), os.path.join(self.ws, "nope.png")):
            with self.assertRaises(HTTPException):
                self.call("/api/web/file", bad)
        if hasattr(os, "symlink"):
            link = os.path.join(self.ws, "link.txt")
            try:
                os.symlink(self.outside, link)
            except OSError:
                return  # no symlink rights (Windows without developer mode)
            with self.assertRaises(HTTPException):
                self.call("/api/web/file", link)

    def test_an_exported_folder_downloads_as_a_zip(self):
        vault = os.path.join(self.root, "exports", "My Vault")
        os.makedirs(os.path.join(vault, "Chapters"))
        with open(os.path.join(vault, "Chapters", "1.md"), "w") as f:
            f.write("# One")
        res = self.call("/api/web/file", vault, 1)
        with zipfile.ZipFile(res.path) as z:
            self.assertEqual(z.namelist(), ["Chapters/1.md"])
        # Other folders are not zipped.
        with self.assertRaises(HTTPException):
            self.call("/api/web/file", self.ws, 1)

    def test_deletes_stay_in_their_place(self):
        proj = os.path.join(self.ws, "proj")
        os.makedirs(os.path.join(proj, "assets"))
        asset = os.path.join(proj, "assets", "a.png")
        open(asset, "wb").close()
        self.assertEqual(self.call("/api/web/asset/delete", AssetDeleteRequest(project_path=proj, image_path="md/x.md"))["status"], "error")
        self.assertEqual(self.call("/api/web/asset/delete", AssetDeleteRequest(project_path=proj, image_path="assets/a.png"))["status"], "ok")
        self.assertFalse(os.path.exists(asset))
        for bad in (self.ws, self.tmp, os.path.join(self.ws, "..")):
            self.assertEqual(self.call("/api/web/project/delete", ProjectPathRequest(project_path=bad))["status"], "error")
        self.assertTrue(os.path.isdir(self.ws))
        self.assertEqual(self.call("/api/web/project/delete", ProjectPathRequest(project_path=proj))["status"], "ok")
        self.assertFalse(os.path.exists(proj))

    def test_cover_images_are_read_as_base64(self):
        proj = os.path.join(self.ws, "proj")
        os.makedirs(os.path.join(proj, "assets", "cover"))
        with open(os.path.join(proj, "assets", "cover", "img_0123456789ab.png"), "wb") as f:
            f.write(b"\x89PNG")
        res = self.call("/api/web/cover/read", CoverReadRequest(project_path=proj, path="assets/cover/img_0123456789ab.png"))
        self.assertEqual(res, {"mime": "image/png", "data": "iVBORw=="})
        self.assertIsNone(self.call("/api/web/cover/read", CoverReadRequest(project_path=proj, path="../../outside.txt")))


class TestWebHostReset(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fn_web_reset_")
        self.exits = []

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def reset_route(self, demo):
        router = make_router(self.tmp, demo=demo, exit_after_reset=lambda: self.exits.append(1))
        return {r.path: r.endpoint for r in router.routes}["/api/web/reset"]

    def test_only_a_demo_resets_and_only_for_the_device(self):
        proj = os.path.join(self.tmp, "workspace", "proj")
        os.makedirs(proj)
        os.makedirs(os.path.join(self.tmp, "venv"))
        with open(os.path.join(self.tmp, "global_config.json"), "w") as f:
            f.write("{}")
        for demo, header in ((False, "reset"), (True, None), (True, "yes")):
            with self.assertRaises(HTTPException):
                self.reset_route(demo)(header)
        self.assertTrue(os.path.isdir(proj))
        self.assertEqual(self.reset_route(True)("reset"), {"status": "ok"})
        self.assertFalse(os.path.exists(proj))
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "global_config.json")))
        self.assertTrue(os.path.isdir(os.path.join(self.tmp, "workspace")))
        self.assertTrue(os.path.isdir(os.path.join(self.tmp, "venv")), "the Python environment stays")
        import time
        time.sleep(0.8)
        self.assertEqual(self.exits, [1])


if __name__ == "__main__":
    unittest.main()

"""Locked review copies: encryption, the key server round trip, expiry,
revocation, offline reading, trusted servers and tampering. A small in-process
server stands in for the Go key service (same HTTP API)."""
import base64
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_setup
import review_crypto as rc
from routes.review_export import (
    ExportReviewRequest, FinishReviewRequest, ReviewScope, SaveReviewRequest, StartReviewRequest,
    StoreRequest, export_review, finish_review, list_reviews, load_package, save_review, start_review,
)
from routes.review_notes import (
    CopyRequest, ImportReviewsRequest, ProjectRequest, import_reviews, list_review_copies,
    list_review_notes, revoke_review_copy,
)

SECRET_LINE = "The lighthouse keeper buried the letter under the third stone."


class FakeKeyServer:
    """The Go service's API, in memory: challenge / create / fetch / revoke."""

    def __init__(self, bits=6):
        self.bits = bits
        self.keys = {}       # key_id -> {half, revoke, expires_at}
        self.requests = 0
        server = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _send(self, code, body=None):
                data = json.dumps(body).encode() if body is not None else b""
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def _body(self):
                n = int(self.headers.get("Content-Length") or 0)
                return json.loads(self.rfile.read(n) or b"{}")

            def do_GET(self):
                server.requests += 1
                if self.path == "/review-keys/challenge":
                    return self._send(200, {"challenge": os.urandom(8).hex(), "bits": server.bits})
                k = server.keys.get(self.path.rsplit("/", 1)[-1])
                if not k:
                    return self._send(404, {"error": "not_found"})
                self._send(200, {"half": k["half"], "expires_at": k["expires_at"]})

            def do_POST(self):
                server.requests += 1
                body = self._body()
                digest = hashlib.sha256((body["challenge"] + ":" + body["nonce"]).encode()).digest()
                if rc._leading_zero_bits(digest) < server.bits:
                    return self._send(400, {"error": "insufficient_work"})
                key_id = os.urandom(16).hex()
                token = base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip("=")
                expires = (datetime.now(timezone.utc) + timedelta(days=body["days"])).strftime("%Y-%m-%dT%H:%M:%SZ")
                server.keys[key_id] = {"half": body["half"], "revoke": token, "expires_at": expires}
                self._send(200, {"key_id": key_id, "revoke_token": token, "expires_at": expires})

            def do_DELETE(self):
                server.requests += 1
                key_id = self.path.rsplit("/", 1)[-1]
                if server.keys.get(key_id, {}).get("revoke") == self._body().get("revoke_token"):
                    server.keys.pop(key_id, None)
                    return self._send(204)
                self._send(403, {"error": "forbidden"})

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = "http://127.0.0.1:%d" % self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()


class LockedCopyBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fn_review_crypto_")
        self.project = os.path.join(self.tmp, "proj")
        self.store = os.path.join(self.tmp, "store")
        os.makedirs(os.path.join(self.project, "md"))
        db_setup.generate_project_db(self.project, {
            "project_name": "Locked Test", "author_name": "Writer", "genre": "fantasy", "project_id": "desktop-id-9",
        })
        with open(os.path.join(self.project, "fleshnote_project.json"), "w", encoding="utf-8") as f:
            json.dump({"project_id": "desktop-id-9", "project_name": "Locked Test", "schema_version": 2}, f)
        with open(os.path.join(self.project, "md", "ch_001.md"), "w", encoding="utf-8") as f:
            f.write("Night fell over the harbour.\n\n" + SECRET_LINE)
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        conn.execute("DELETE FROM chapters")
        conn.execute("INSERT INTO chapters (id, chapter_number, title, md_filename, word_count, deleted) "
                     "VALUES ('ch-1', 1, 'Harbour', 'ch_001.md', 16, 0)")
        conn.commit()
        conn.close()
        self.server = FakeKeyServer()
        env = mock.patch.dict(os.environ, {"FLESHNOTE_REVIEW_KEY_SERVERS": self.server.url})
        env.start()
        self.addCleanup(env.stop)

    def tearDown(self):
        self.server.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def export(self, days=14, name="sent.flreview"):
        dest = os.path.join(self.tmp, name)
        res = export_review(ExportReviewRequest(project_path=self.project, dest_path=dest, scope=ReviewScope(),
                                                author_label="Writer", message="Be honest", expires_days=days,
                                                key_server=self.server.url))
        return dest, res

    def start(self, path):
        return start_review(StartReviewRequest(path=path, store_dir=self.store))

    def raw_bytes(self, path):
        with open(path, "rb") as f:
            return f.read()


class TestLockedCopies(LockedCopyBase):
    def test_export_keeps_text_out_of_the_file(self):
        dest, res = self.export()
        self.assertEqual(res["status"], "ok")
        self.assertTrue(res["expires_at"])
        raw = load_package(dest)
        self.assertEqual(raw["format"], rc.SEALED_FORMAT)
        self.assertEqual(raw["title"], "Locked Test")
        self.assertNotIn(b"lighthouse", self.raw_bytes(dest))
        self.assertNotIn(b"Be honest", self.raw_bytes(dest))
        copies = list_review_copies(ProjectRequest(project_path=self.project))["copies"]
        self.assertEqual(len(copies), 1)
        self.assertTrue(copies[0]["locked"])

    def test_plain_copy_when_no_expiry(self):
        dest, res = self.export(days=0)
        self.assertEqual(load_package(dest)["format"], "fleshnote-review/1")
        self.assertIn(b"lighthouse", self.raw_bytes(dest))
        self.assertEqual(self.server.requests, 0)

    def test_reviewer_opens_and_working_copy_stays_locked(self):
        dest, _ = self.export()
        res = self.start(dest)
        self.assertEqual(res["status"], "ok")
        text = res["package"]["snapshot"]["chapters"][0]["text_md"]
        self.assertIn(SECRET_LINE, text)
        self.assertEqual(res["package"]["message"], "Be honest")
        self.assertNotIn(b"lighthouse", self.raw_bytes(res["path"]))
        listed = list_reviews(StoreRequest(store_dir=self.store))["reviews"][0]
        self.assertEqual((listed["title"], listed["locked"], listed["notes"]), ("Locked Test", False, 0))

    def test_offline_reading_uses_the_cached_half(self):
        dest, _ = self.export()
        self.assertEqual(self.start(dest)["status"], "ok")
        self.server.stop()
        res = self.start(dest)
        self.assertEqual(res["status"], "ok")
        self.assertTrue(res["resumed"])

    def test_offline_before_first_open(self):
        dest, _ = self.export()
        self.server.stop()
        self.assertEqual(self.start(dest)["status"], "offline")

    def test_expired_copy_stops_opening_and_cache_is_dropped(self):
        dest, _ = self.export()
        first = self.start(dest)
        self.server.keys.clear()  # the server swept it
        res = self.start(dest)
        self.assertEqual(res["status"], "expired")
        self.assertEqual(rc.KeyCache(self.store).get(load_package(dest)["crypto"]["key_id"]), None)
        listed = list_reviews(StoreRequest(store_dir=self.store))["reviews"][0]
        self.assertTrue(listed["locked"])
        saved = save_review(SaveReviewRequest(path=first["path"], package={"notes": []}, store_dir=self.store))
        self.assertEqual(saved["status"], "expired")

    def test_cached_half_lapses_at_its_expiry(self):
        dest, _ = self.export()
        res = self.start(dest)
        key_id = load_package(dest)["crypto"]["key_id"]
        cache = rc.KeyCache(self.store)
        half, _ = cache.get(key_id)
        cache.put(key_id, half, "2020-01-01T00:00:00Z")
        saved = save_review(SaveReviewRequest(path=res["path"], package={"notes": []}, store_dir=self.store))
        self.assertEqual(saved["status"], "expired")

    def test_author_revokes(self):
        dest, res = self.export()
        self.assertEqual(self.start(dest)["status"], "ok")
        out = revoke_review_copy(CopyRequest(project_path=self.project, id=res["review_id"]))
        self.assertEqual(out["status"], "ok")
        self.assertEqual(self.start(dest)["status"], "expired")
        copies = list_review_copies(ProjectRequest(project_path=self.project))["copies"]
        self.assertTrue(copies[0]["revoked_at"])

    def test_untrusted_server_in_file_is_never_contacted(self):
        dest, _ = self.export()
        raw = load_package(dest)
        raw["crypto"]["server"] = "https://evil.example"
        with open(dest, "w", encoding="utf-8") as f:
            json.dump(raw, f)
        before = self.server.requests
        res = self.start(dest)
        self.assertEqual(res["status"], "untrusted")
        self.assertEqual(self.server.requests, before)

    def test_tampered_header_is_rejected(self):
        dest, _ = self.export()
        original = load_package(dest)
        edits = [
            lambda r: r["crypto"].__setitem__("expires_at", "2099-01-01T00:00:00Z"),  # extend the date
            lambda r: r.__setitem__("author_label", "Somebody Else"),                  # relabel the sender
            lambda r: r.__setitem__("desktop_id", "another-project"),
        ]
        for edit in edits:
            raw = json.loads(json.dumps(original))
            edit(raw)
            with open(dest, "w", encoding="utf-8") as f:
                json.dump(raw, f)
            shutil.rmtree(self.store, ignore_errors=True)
            self.assertEqual(self.start(dest)["status"], "error")

    def test_key_server_down_at_export(self):
        self.server.stop()
        dest, res = self.export()
        self.assertEqual((res["status"], res["error"]), ("error", "key_server_unreachable"))
        self.assertFalse(os.path.exists(dest))

    def test_round_trip_and_import_after_expiry(self):
        dest, _ = self.export()
        res = self.start(dest)
        pkg = res["package"]
        text = pkg["snapshot"]["chapters"][0]["text_md"]
        start = text.index("buried the letter")
        note = {"id": "n1", "chapter_id": "ch-1", "category": "question", "body": "Which stone?",
                "anchor_start": start, "anchor_end": start + 17, "anchor_quote": "buried the letter"}
        save_review(SaveReviewRequest(path=res["path"], package={"reviewer_label": "Ann", "notes": [note]},
                                      store_dir=self.store))
        back = os.path.join(self.tmp, "back.flreview")
        self.assertEqual(finish_review(FinishReviewRequest(path=res["path"], dest_path=back, store_dir=self.store))["status"], "ok")
        self.assertNotIn(b"Which stone", self.raw_bytes(back))
        self.server.keys.clear()   # expired for everyone else
        result = import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[back]))["results"][0]
        self.assertEqual((result["status"], result["added"], result["reviewer_label"]), ("ok", 1, "Ann"))
        self.assertEqual(list_review_notes(ProjectRequest(project_path=self.project))["notes"][0]["body"], "Which stone?")

    def test_import_without_the_key(self):
        dest, _ = self.export()
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        conn.execute("DELETE FROM review_copies")
        conn.commit()
        conn.close()
        result = import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[dest]))["results"][0]
        self.assertEqual(result["error"], "missing_key")


class TestPrimitives(unittest.TestCase):
    def test_seal_round_trip_and_fresh_nonce(self):
        key = os.urandom(32)
        header = {"format": rc.SEALED_FORMAT, "review_id": "r", "crypto": {"key_id": "k"}}
        a, b = rc.seal(header, {"x": 1}, key), rc.seal(header, {"x": 1}, key)
        self.assertNotEqual(a["sealed"]["nonce"], b["sealed"]["nonce"])
        self.assertEqual(rc.unseal(a, key), {"x": 1})
        with self.assertRaises(ValueError):
            rc.unseal(a, os.urandom(32))

    def test_pow(self):
        nonce = rc.solve_pow("abc", 10)
        digest = hashlib.sha256(("abc:" + nonce).encode()).digest()
        self.assertGreaterEqual(rc._leading_zero_bits(digest), 10)
        with self.assertRaises(rc.KeyServerError):
            rc.solve_pow("abc", 64)

    def test_trusted_servers(self):
        with mock.patch.dict(os.environ, {"FLESHNOTE_REVIEW_KEY_SERVERS": "http://127.0.0.1:9999, http://example.com"}):
            servers = rc.trusted_servers()
        self.assertIn(rc.DEFAULT_KEY_SERVER, servers)
        self.assertIn("http://127.0.0.1:9999", servers)
        self.assertNotIn("http://example.com", servers)   # plain http only on this machine


if __name__ == "__main__":
    unittest.main()

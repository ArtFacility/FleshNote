import os
import sys
import io
import json
import shutil
import tempfile
import threading
import time
import unittest
import sqlite3
import unittest.mock as mock
import urllib.error
import urllib.request

os.environ["FLESHNOTE_DEVICE_ID"] = "test-device-default"

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_setup
import tsa_client
from routes import pentimento


def _resp(headers, chunks):
    class _R:
        def __init__(self):
            self.headers = headers
            self._chunks = list(chunks)

        def read(self, n=-1):
            if not self._chunks:
                return b""
            return self._chunks.pop(0)

    return _R()


class TestResponseCap(unittest.TestCase):
    def test_read_capped_allows_small(self):
        r = _resp({"Content-Length": "10"}, [b"0123456789"])
        self.assertEqual(tsa_client._read_capped(r, 8), b"0123456789")

    def test_read_capped_rejects_oversize_content_length(self):
        r = _resp({"Content-Length": str(tsa_client.MAX_RESPONSE_BYTES + 1)}, [])
        with self.assertRaises(ValueError):
            tsa_client._read_capped(r, 8)

    def test_read_capped_aborts_streaming_oversize(self):
        chunks = [b"x" * tsa_client._READ_CHUNK
                  for _ in range((tsa_client.MAX_RESPONSE_BYTES // tsa_client._READ_CHUNK) + 2)]
        r = _resp({}, chunks)  # no Content-Length — chunked abort must still fire
        with self.assertRaises(ValueError):
            tsa_client._read_capped(r, 60)

    def test_read_capped_total_deadline(self):
        class Slow:
            headers = {}
            def __init__(self):
                self.start = time.monotonic()
            def read(self, n=-1):
                if time.monotonic() - self.start < 0.3:
                    return b"x" * 4   # slow drip, far under the byte cap
                return b""
        with self.assertRaises(ValueError):
            tsa_client._read_capped(Slow(), 0.1)


class TestDerParser(unittest.TestCase):
    def test_valid_tlv_parses(self):
        data = b"\x30\x03\x02\x01\x05"
        tag, body, nxt = tsa_client._der_parse_tlv(data, 0)
        self.assertEqual(tag, 0x30)
        self.assertEqual(body, b"\x02\x01\x05")
        self.assertEqual(nxt, 5)

    def test_truncated_raises(self):
        with self.assertRaises(ValueError):
            tsa_client._der_parse_tlv(b"\x30")
        with self.assertRaises(ValueError):
            tsa_client._der_parse_tlv(b"")

    def test_bad_length_prefix(self):
        # length byte says 5 octets of length but only 2 remain
        with self.assertRaises(ValueError):
            tsa_client._der_parse_tlv(b"\x30\x85\x01\x02")

    def test_overrun_length(self):
        # claims 100 bytes of content but only 2 present
        with self.assertRaises(ValueError):
            tsa_client._der_parse_tlv(b"\x30\x64\x01\x02")


class TestTsaUrlValidation(unittest.TestCase):
    def test_https_accepted(self):
        self.assertEqual(pentimento._validated_tsa_url("https://api.fleshnote.org/tsa"),
                         "https://api.fleshnote.org/tsa")

    def test_http_nonloopback_rejected(self):
        self.assertIsNone(pentimento._validated_tsa_url("http://evil.example/tsa"))
        self.assertIsNone(pentimento._validated_tsa_url("ftp://evil"))
        self.assertIsNone(pentimento._validated_tsa_url("HTTP://evil"))

    def test_http_loopback_allowed(self):
        for u in ("http://localhost:8093/tsa", "http://127.0.0.1:8093",
                  "http://[::1]:8093/tsa"):
            self.assertIsNotNone(pentimento._validated_tsa_url(u), u)

    def test_loopback_lookalikes_rejected(self):
        for u in ("http://localhost.evil.com", "http://0.0.0.0:8093",
                  "http://[::]:8093", "http://127.0.0.2:8093"):
            self.assertIsNone(pentimento._validated_tsa_url(u), u)

    def test_userinfo_fragment_rejected(self):
        self.assertIsNone(pentimento._validated_tsa_url("https://user:pass@evil.com/tsa"))
        self.assertIsNone(pentimento._validated_tsa_url("https://tsa.example/x#frag"))
        self.assertIsNone(pentimento._validated_tsa_url(""))
        self.assertIsNone(pentimento._validated_tsa_url(None))


class TestReceiptShape(unittest.TestCase):
    OK = {"server_time": "2026-09-24T10:00:00.123456789Z",
          "server_signature": "AAECAw==", "key_id": "8b7862c3ec57a700"}

    def test_valid_receipt(self):
        self.assertTrue(pentimento._receipt_shape_ok(self.OK))

    def test_malformed_receipts(self):
        for bad in [
            {},
            {"server_time": "not-a-time", "server_signature": "AA",
             "key_id": "ab"},
            {"server_time": "2026-09-24T10:00:00Z", "server_signature": "!!not-b64!!",
             "key_id": "ab"},
            {"server_time": "2026-09-24T10:00:00Z", "server_signature": "AA==",
             "key_id": "xyz!!"},
            {"server_time": "2026-09-24T10:00:00Z", "server_signature": "AA==",
             "key_id": None},
            None,
        ]:
            self.assertFalse(pentimento._receipt_shape_ok(bad), bad)


class TestReceiptStateMachine(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="fn_tsa_hardening_")
        self.project = os.path.join(self.test_dir, "proj")
        os.makedirs(self.project)
        db_setup.generate_project_db(self.project, {
            "project_name": "T", "author_name": "A", "genre": "fantasy",
            "project_id": "tsa-test-proj",
        })
        self.conn = pentimento._get_db(self.project)  # creates server_receipts
        self.cur = self.conn.cursor()
        self.cur.execute(
            "INSERT INTO server_receipts (id, kind, anchored_hash, previous_hash, "
            "client_time, status, attempts) VALUES (?,?,?,?,?, 'pending', 0)",
            ("r-1", "seal", "ab" * 32, "cd" * 32, "2026-09-24T00:00:00"))
        self.conn.commit()

    def tearDown(self):
        try:
            self.conn.close()
        except Exception:
            pass
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def _run(self, anchor=None):
        """Run _process_receipt with tsa_client.anchor_hash stubbed."""
        import tsa_client as tc
        orig = tc.anchor_hash
        if anchor is not None:
            tc.anchor_hash = anchor
        try:
            pentimento._process_receipt(self.project, "r-1")
        finally:
            tc.anchor_hash = orig
        self.conn.commit()

    def test_409_becomes_forked_and_never_retried(self):
        err = urllib.error.HTTPError("http://tsa", 409, "fork_conflict", None, io.BytesIO(b""))
        self._run(anchor=mock.Mock(side_effect=err))
        row = self.cur.execute(
            "SELECT status, failure_reason FROM server_receipts WHERE id='r-1'").fetchone()
        self.assertEqual(row["status"], "forked")
        self.assertIn("fork_conflict", row["failure_reason"])
        # terminal states are excluded from the retry queue by construction
        self.cur.execute(
            "SELECT COUNT(*) c FROM server_receipts WHERE status='pending' AND id='r-1'")
        self.assertEqual(self.cur.fetchone()["c"], 0)

    def test_400_terminal_failed(self):
        err = urllib.error.HTTPError("http://tsa", 400, "bad request", None, io.BytesIO(b""))
        self._run(anchor=mock.Mock(side_effect=err))
        row = self.cur.execute(
            "SELECT status FROM server_receipts WHERE id='r-1'").fetchone()
        self.assertEqual(row["status"], "failed")

    def test_5xx_retries_until_cap_then_failed(self):
        err = urllib.error.HTTPError("http://tsa", 503, "boom", None, io.BytesIO(b""))
        self._run(anchor=mock.Mock(side_effect=err))
        row = self.cur.execute(
            "SELECT status, attempts FROM server_receipts WHERE id='r-1'").fetchone()
        self.assertEqual(row["status"], "pending")
        self.assertEqual(row["attempts"], 1)
        # push attempts to the cap
        self.cur.execute("UPDATE server_receipts SET attempts=? WHERE id='r-1'",
                         ((pentimento.MAX_ANCHOR_ATTEMPTS - 1),))
        self.conn.commit()
        self._run(anchor=mock.Mock(side_effect=err))
        row = self.cur.execute(
            "SELECT status FROM server_receipts WHERE id='r-1'").fetchone()
        self.assertEqual(row["status"], "failed")

    def test_malformed_shape_treated_as_failure(self):
        self._run(anchor=mock.Mock(return_value={"server_time": "garbage"}))
        row = self.cur.execute(
            "SELECT status, failure_reason FROM server_receipts WHERE id='r-1'").fetchone()
        self.assertEqual(row["status"], "pending")
        self.assertIn("shape", (row["failure_reason"] or ""))

    def test_hostile_project_tsa_url_never_contacted(self):
        self.cur.execute(
            "INSERT INTO project_config (config_key, config_value) "
            "VALUES ('pentimento_tsa_url', 'http://evil.example/tsa')")
        self.conn.commit()
        called = {"n": 0}

        def _anchor(*a, **k):
            called["n"] += 1
            return dict(TestReceiptShape.OK)

        import tsa_client as tc
        orig = tc.anchor_hash
        tc.anchor_hash = _anchor
        try:
            pentimento._process_receipt(self.project, "r-1")
        finally:
            tc.anchor_hash = orig
        self.conn.commit()
        self.assertEqual(called["n"], 0)
        row = self.cur.execute(
            "SELECT status, failure_reason FROM server_receipts WHERE id='r-1'").fetchone()
        self.assertEqual(row["status"], "pending")
        self.assertIn("invalid pentimento_tsa_url", row["failure_reason"])

    def test_loopback_http_url_is_contacted(self):
        self.cur.execute(
            "INSERT INTO project_config (config_key, config_value) "
            "VALUES ('pentimento_tsa_url', 'http://127.0.0.1:8093/tsa')")
        self.conn.commit()
        seen = {}

        def _anchor(anchored_hash, previous_hash=None, tsa_url=None):
            seen["tsa_url"] = tsa_url
            return dict(TestReceiptShape.OK)

        import tsa_client as tc
        orig = tc.anchor_hash
        tc.anchor_hash = _anchor
        try:
            pentimento._process_receipt(self.project, "r-1")
        finally:
            tc.anchor_hash = orig
        self.conn.commit()
        self.assertEqual(seen["tsa_url"], "http://127.0.0.1:8093/tsa")
        row = self.cur.execute(
            "SELECT status FROM server_receipts WHERE id='r-1'").fetchone()
        self.assertEqual(row["status"], "anchored")

    def test_anchor_lock_prevents_overlap(self):
        pentimento._ANCHOR_LOCK.acquire()
        try:
            t = threading.Thread(target=pentimento._spawn_anchor,
                                 args=(self.project, "r-1"), daemon=True)
            t.start()
            t.join(timeout=5)
            # skipped while the lock is held — receipt untouched
            row = self.cur.execute(
                "SELECT attempts FROM server_receipts WHERE id='r-1'").fetchone()
            self.assertEqual(row["attempts"], 0)
        finally:
            pentimento._ANCHOR_LOCK.release()
        # with the lock free, the pass runs (anchor_hash will fail fast on the
        # unreachable default TSA — fine, attempts bumps either way)
        pentimento._spawn_anchor(self.project, "r-1")
        deadline = time.time() + 10
        while time.time() < deadline:
            row = self.cur.execute(
                "SELECT attempts FROM server_receipts WHERE id='r-1'").fetchone()
            if row["attempts"] >= 1:
                break
            time.sleep(0.05)
        self.assertGreaterEqual(row["attempts"], 1)


if __name__ == "__main__":
    unittest.main()

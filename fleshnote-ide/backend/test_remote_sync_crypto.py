"""
Encrypted phone <-> desktop Wi-Fi sync (remote_sync_session.py + sync_crypto.py).

Drives the LAN-facing routes directly, playing the phone: pair, upload, apply on
the desktop, download, complete, plus a desktop -> phone clone. Checks that
nothing readable crosses the network and that messages without the session key
are refused without changing the session.
"""

import asyncio
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
import uuid
import zipfile

os.environ.setdefault("FLESHNOTE_DEVICE_ID", "test-device-desktop")

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import HTTPException, UploadFile
from starlette.requests import Request

import db_setup
import project_io
import remote_sync_session as rss
import sync_crypto
from routes import remote_sync


def _make_project(parent: str, name: str) -> str:
    path = os.path.join(parent, name)
    os.makedirs(path)
    db_setup.generate_project_db(path, {"project_name": name, "author_name": "Test", "genre": "fantasy"})
    with open(os.path.join(path, "fleshnote_project.json"), "w", encoding="utf-8") as f:
        json.dump({"project_name": name, "schema_version": 2, "project_id": str(uuid.uuid4())}, f)
    os.makedirs(os.path.join(path, "md"), exist_ok=True)
    with open(os.path.join(path, "md", "ch_001_start.md"), "w", encoding="utf-8") as f:
        f.write("The secret sentence nobody on the café Wi-Fi should read.")
    return path


def _zip_bytes(project_path: str) -> bytes:
    out = os.path.join(tempfile.mkdtemp(prefix="fn_rsc_zip_"), "p.zip")
    project_io.zip_project(project_path, out)
    with open(out, "rb") as f:
        data = f.read()
    shutil.rmtree(os.path.dirname(out), ignore_errors=True)
    return data


def _upload(token: str, body: bytes):
    return asyncio.run(rss.remote_upload(token=token, file=UploadFile(file=io.BytesIO(body), filename="project.zip")))


def _complete(token: str, body: bytes):
    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}
    request = Request({"type": "http", "method": "POST", "headers": [], "query_string": b""}, receive)
    return asyncio.run(rss.remote_complete(request, token=token))


class TestSyncCrypto(unittest.TestCase):
    def test_round_trip_and_binding(self):
        key = sync_crypto.new_key()
        blob = sync_crypto.seal(key, "upload", "tok", b"hello")
        self.assertEqual(blob[0], 2)
        self.assertEqual(len(blob), 5 + sync_crypto.OVERHEAD)
        self.assertEqual(sync_crypto.open_sealed(key, "upload", "tok", blob), b"hello")
        with self.assertRaises(sync_crypto.SealError):
            sync_crypto.open_sealed(key, "download", "tok", blob)  # other purpose
        with self.assertRaises(sync_crypto.SealError):
            sync_crypto.open_sealed(key, "upload", "other", blob)  # other session
        with self.assertRaises(sync_crypto.SealError):
            sync_crypto.open_sealed(sync_crypto.new_key(), "upload", "tok", blob)  # other key
        tampered = bytearray(blob)
        tampered[-1] ^= 1
        with self.assertRaises(sync_crypto.SealError):
            sync_crypto.open_sealed(key, "upload", "tok", bytes(tampered))
        with self.assertRaises(sync_crypto.SealError):
            sync_crypto.open_sealed(key, "upload", "tok", b"PK\x03\x04 plain zip")

    def test_known_vector(self):
        # Shared with the companion app's test, so both sides agree on the format.
        key = bytes(range(32))
        nonce = bytes(range(100, 112))
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        blob = bytes([2]) + nonce + AESGCM(key).encrypt(nonce, b"FleshNote sync test", b"fleshnote-sync/2|upload|test-token")
        self.assertEqual(sync_crypto.open_sealed(key, "upload", "test-token", blob), b"FleshNote sync test")
        self.assertEqual(blob.hex(), KNOWN_VECTOR_HEX)


KNOWN_VECTOR_HEX = (  # key 00..1f, nonce 64..6f, purpose "upload", token "test-token"
    "026465666768696a6b6c6d6e6f0e77bb1511a739ea5b422c91b4064a8927b172"
    "e556510bdb9fe5fd56f57b6a23f55f5b"
)


class TestEncryptedSession(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="fn_rsc_")
        self.desktop = _make_project(self.root, "Desk")
        self.phone = os.path.join(self.root, "Phone")
        shutil.copytree(self.desktop, self.phone)
        with open(os.path.join(self.desktop, "fleshnote_project.json"), encoding="utf-8") as f:
            self.meta = json.load(f)
        # The LAN server itself isn't needed: the routes are called directly.
        self._pick_port, rss._pick_port = rss._pick_port, lambda: 0
        self._uvicorn_server = rss.uvicorn.Server
        rss.uvicorn.Server = _NoServer

    def tearDown(self):
        rss.cancel_session()
        rss._pick_port = self._pick_port
        rss.uvicorn.Server = self._uvicorn_server
        shutil.rmtree(self.root, ignore_errors=True)

    def _start(self, mode="merge"):
        info = rss.start_session(self.desktop, self.meta["project_id"], "Desk", mode=mode)
        self.assertEqual(info["protocol"], 2)
        key = bytes.fromhex(info["key"])
        self.assertEqual(len(key), 32)
        return info["token"], key

    def test_merge_sync_is_encrypted_end_to_end(self):
        token, key = self._start()

        pair = rss.remote_pair(token=token)
        self.assertNotIn(b"Desk", pair.body)
        reply = json.loads(sync_crypto.open_sealed(key, "pair", token, pair.body))
        self.assertEqual(reply["project_id"], self.meta["project_id"])

        upload = sync_crypto.seal(key, "upload", token, _zip_bytes(self.phone))
        self.assertNotIn(b"secret sentence", upload)
        self.assertEqual(_upload(token, upload)["status"], "ok")
        self.assertEqual(rss.get_session().status, "ready")

        remote_sync.remote_sync_apply(remote_sync.RemoteSyncApplyRequest(token=token, resolutions={}))
        download = rss.remote_download(token=token)
        self.assertNotIn(b"secret sentence", download.body)
        with self.assertRaises(sync_crypto.SealError):
            sync_crypto.open_sealed(key, "upload", token, download.body)  # can't be replayed as an upload
        merged = sync_crypto.open_sealed(key, "download", token, download.body)
        with zipfile.ZipFile(io.BytesIO(merged)) as zf:
            self.assertIn("fleshnote.db", zf.namelist())
            self.assertIn("The secret sentence", zf.read("md/ch_001_start.md").decode("utf-8"))

        with self.assertRaises(HTTPException):
            _complete(token, b"")  # no proof of the key
        self.assertEqual(rss.get_session().status, "applied")
        _complete(token, sync_crypto.seal(key, "complete", token, b"done"))
        self.assertEqual(rss.get_session().status, "downloaded")

    def test_upload_without_the_key_changes_nothing(self):
        token, key = self._start()
        for body in (_zip_bytes(self.phone),  # an outdated phone sending a plain zip
                     sync_crypto.seal(sync_crypto.new_key(), "upload", token, b"x"),  # wrong key
                     sync_crypto.seal(key, "download", token, b"x")):  # replayed download
            with self.assertRaises(HTTPException) as ctx:
                _upload(token, body)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("Update the FleshNote Companion app", ctx.exception.detail)
            self.assertEqual(rss.get_session().status, "waiting")
        # The real phone can still sync afterwards.
        self.assertEqual(_upload(token, sync_crypto.seal(key, "upload", token, _zip_bytes(self.phone)))["status"], "ok")

    def test_clone_send_is_encrypted(self):
        token, key = self._start(mode="clone_send")
        download = rss.remote_download(token=token)
        self.assertNotIn(b"secret sentence", download.body)
        with zipfile.ZipFile(io.BytesIO(sync_crypto.open_sealed(key, "download", token, download.body))) as zf:
            self.assertIn("fleshnote_project.json", zf.namelist())
        zip_dir = os.path.dirname(rss.get_session().download_zip_path)
        rss.cancel_session(token)
        self.assertFalse(os.path.exists(zip_dir))  # the temp zip goes with the session


class _NoServer:
    """Stands in for uvicorn.Server: the tests call the routes directly."""
    def __init__(self, config):
        self.started = True
        self.should_exit = False

    def run(self):
        pass


if __name__ == "__main__":
    unittest.main()

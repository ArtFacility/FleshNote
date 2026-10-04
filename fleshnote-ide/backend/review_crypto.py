"""
Locked review copies: .flreview files that stop opening after a date.

The author's app makes two random 32-byte halves for each copy. One goes
inside the file, the other is stored on a FleshNote key server with an expiry
date. The content key is HKDF(file half + server half), so the file alone is
useless once the server deletes its half (on expiry, or when the author revokes
the copy), and the server alone is useless because it never sees the file.

What this does and doesn't promise: anyone who can read a copy can still copy
the text out while it's readable. Expiry stops forgotten copies (email
archives, downloads folders, forwarded files) from staying readable forever.

Reviewer side: the server half is fetched when a review opens and cached on
this machine until the expiry date the server reported, so reading works
offline in between. A server answer of "gone" deletes the cached half at once,
so a revoked copy stops opening as soon as the reviewer is online again.

Only key servers the user trusts are ever contacted: the default FleshNote one
plus any listed in FLESHNOTE_REVIEW_KEY_SERVERS (comma-separated). The server
named inside a file is never trusted on its own, since anyone can edit a file.
"""
import base64
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from urllib.parse import urlsplit

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

SEALED_FORMAT = "fleshnote-review-sealed/1"
DEFAULT_KEY_SERVER = os.environ.get("FLESHNOTE_REVIEW_KEY_SERVER", "https://api.fleshnote.org/tsa").rstrip("/")
HTTP_TIMEOUT = 8
MAX_RESPONSE_BYTES = 16 * 1024
POW_TIME_LIMIT = 60.0   # seconds; the server announces the difficulty
POW_MAX_BITS = 28       # refuse absurd difficulty instead of spinning for hours
_LOOPBACK = {"127.0.0.1", "localhost", "::1"}


class KeyServerError(Exception):
    """The key server could not be reached or answered with an error."""


class KeyGone(Exception):
    """The server no longer has this key: the copy expired or was revoked."""


class NotTrusted(Exception):
    """The file names a key server the user has not chosen to trust."""


# ── crypto ──────────────────────────────────────────────────────────────────

def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def unb64(text: str) -> bytes:
    return base64.b64decode(text.encode("ascii"), validate=True)


def derive_key(file_half: bytes, server_half: bytes, key_id: str) -> bytes:
    if len(file_half) != 32 or len(server_half) != 32:
        raise ValueError("key halves must be 32 bytes")
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"fleshnote-review-sealed/1",
                info=key_id.encode("utf-8")).derive(file_half + server_half)


def _aad(header: dict) -> bytes:
    # Every readable field set at export is bound to the content, so nobody
    # can relabel a copy ("from Bob") or move its date. copy_id and
    # finished_at are added later by the reviewer's app and stay outside.
    crypto = header.get("crypto") or {}
    return json.dumps([header.get("format"), header.get("review_id"), header.get("created_at"),
                       header.get("title"), header.get("author_label"), header.get("desktop_id"),
                       crypto.get("key_id"), crypto.get("server"), crypto.get("expires_at")],
                      separators=(",", ":")).encode("utf-8")


def seal(header: dict, inner: dict, key: bytes) -> dict:
    """header + encrypted inner. A fresh nonce every time: autosave re-seals often."""
    nonce = os.urandom(12)
    data = json.dumps(inner, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    out = dict(header)
    out["sealed"] = {"nonce": b64(nonce), "ct": b64(AESGCM(key).encrypt(nonce, data, _aad(header)))}
    return out


def unseal(pkg: dict, key: bytes) -> dict:
    """The inner fields, or ValueError when the key is wrong or the file was altered."""
    sealed = pkg.get("sealed") or {}
    try:
        data = AESGCM(key).decrypt(unb64(sealed.get("nonce", "")), unb64(sealed.get("ct", "")), _aad(pkg))
        inner = json.loads(data.decode("utf-8"))
    except Exception:
        raise ValueError("This review copy is damaged or was changed.")
    if not isinstance(inner, dict):
        raise ValueError("This review copy is damaged or was changed.")
    return inner


def is_sealed(pkg: dict) -> bool:
    return isinstance(pkg, dict) and pkg.get("format") == SEALED_FORMAT


# ── key servers ─────────────────────────────────────────────────────────────

def _normalize(url: str):
    """https anywhere; plain http only on this machine (a self-hosted server)."""
    if not url:
        return None
    url = str(url).strip().rstrip("/")
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    host = (parts.hostname or "").lower()
    if not host or parts.username or parts.password or parts.query or parts.fragment:
        return None
    if parts.scheme == "https" or (parts.scheme == "http" and host in _LOOPBACK):
        return url
    return None


def trusted_servers() -> set:
    extra = os.environ.get("FLESHNOTE_REVIEW_KEY_SERVERS", "")
    out = {_normalize(DEFAULT_KEY_SERVER)}
    out.update(_normalize(u) for u in extra.split(","))
    out.discard(None)
    return out


def check_trusted(url: str) -> str:
    norm = _normalize(url)
    if not norm or norm not in trusted_servers():
        raise NotTrusted(url)
    return norm


def _request(method: str, url: str, body=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    from tsa_client import USER_AGENT  # Cloudflare 403s the default urllib agent
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json", "Accept": "application/json",
                                          "User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            raw = resp.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise KeyServerError("response too large")
            return resp.status, (json.loads(raw.decode("utf-8")) if raw else {})
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read(MAX_RESPONSE_BYTES).decode("utf-8"))
        except Exception:
            payload = {}
        return e.code, payload
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise KeyServerError(str(e))


def _leading_zero_bits(digest: bytes) -> int:
    n = 0
    for byte in digest:
        if byte == 0:
            n += 8
            continue
        return n + (8 - byte.bit_length())
    return n


def solve_pow(challenge: str, bits: int, time_limit: float = POW_TIME_LIMIT) -> str:
    if bits > POW_MAX_BITS:
        raise KeyServerError("the key server asks for too much work")
    started = time.monotonic()
    prefix = (challenge + ":").encode("utf-8")
    i = 0
    while True:
        nonce = str(i)
        if _leading_zero_bits(hashlib.sha256(prefix + nonce.encode("ascii")).digest()) >= bits:
            return nonce
        i += 1
        if i % 50000 == 0 and time.monotonic() - started > time_limit:
            raise KeyServerError("proof-of-work took too long")


def create_server_key(server: str, half: bytes, days: int) -> dict:
    """Store the server half; returns {key_id, revoke_token, expires_at}."""
    server = check_trusted(server)
    status, ch = _request("GET", server + "/review-keys/challenge")
    if status != 200 or not ch.get("challenge"):
        raise KeyServerError("challenge: %s" % status)
    nonce = solve_pow(ch["challenge"], int(ch.get("bits") or 0))
    status, out = _request("POST", server + "/review-keys",
                           {"challenge": ch["challenge"], "nonce": nonce, "half": b64(half), "days": int(days)})
    if status != 200 or not out.get("key_id"):
        raise KeyServerError("create: %s %s" % (status, out.get("error", "")))
    return out


def fetch_server_half(server: str, key_id: str) -> dict:
    """{half: bytes, expires_at}; KeyGone on 404/410; KeyServerError when offline."""
    server = check_trusted(server)
    status, out = _request("GET", "%s/review-keys/%s" % (server, key_id))
    if status in (404, 410):
        raise KeyGone(key_id)
    if status != 200:
        raise KeyServerError("fetch: %s" % status)
    half = unb64(out.get("half", ""))
    if len(half) != 32:
        raise KeyServerError("bad key from server")
    return {"half": half, "expires_at": str(out.get("expires_at") or "")}


def revoke_server_key(server: str, key_id: str, revoke_token: str) -> None:
    server = check_trusted(server)
    status, out = _request("DELETE", "%s/review-keys/%s" % (server, key_id), {"revoke_token": revoke_token})
    if status not in (204, 200, 404):
        raise KeyServerError("revoke: %s %s" % (status, out.get("error", "")))


# ── reviewer's key cache ────────────────────────────────────────────────────

def _parse_time(text: str):
    try:
        return datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def expired(expires_at: str, now=None) -> bool:
    when = _parse_time(expires_at)
    return when is None or (now or datetime.now(timezone.utc)) >= when


class KeyCache:
    """Server halves fetched for reviews in progress, kept until the expiry
    date the server reported, so a review reads offline in between."""

    def __init__(self, store_dir: str):
        self.path = os.path.join(store_dir, "keys.json")

    def _load(self) -> dict:
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def _save(self, data: dict) -> None:
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        tmp = self.path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp, self.path)

    def get(self, key_id: str):
        data = self._load()
        live = {k: v for k, v in data.items() if not expired(v.get("expires_at", ""))}
        if live != data:
            self._save(live)
        entry = live.get(key_id)
        return (unb64(entry["half"]), entry["expires_at"]) if entry else None

    def put(self, key_id: str, half: bytes, expires_at: str) -> None:
        data = self._load()
        data[key_id] = {"half": b64(half), "expires_at": expires_at}
        self._save(data)

    def drop(self, key_id: str) -> None:
        data = self._load()
        if data.pop(key_id, None) is not None:
            self._save(data)


def reviewer_key(pkg: dict, cache: KeyCache):
    """(content key, expires_at) for a sealed copy, asking the server when
    online and falling back to the cache when it can't be reached.
    Raises KeyGone (expired or revoked), NotTrusted, or KeyServerError
    (offline with nothing cached yet)."""
    crypto = pkg.get("crypto") or {}
    key_id = str(crypto.get("key_id") or "")
    file_half = unb64(crypto.get("file_half", ""))
    try:
        fresh = fetch_server_half(crypto.get("server", ""), key_id)
    except KeyGone:
        cache.drop(key_id)
        raise
    except KeyServerError:
        cached = cache.get(key_id)
        if not cached:
            raise
        half, expires_at = cached
        return derive_key(file_half, half, key_id), expires_at
    cache.put(key_id, fresh["half"], fresh["expires_at"])
    return derive_key(file_half, fresh["half"], key_id), fresh["expires_at"]

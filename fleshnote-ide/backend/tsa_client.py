"""
Sealed Pentimento — TSA (Timestamping Authority) client.

The desktop app blind-anchors the Pentimento hash chain: only 64-char SHA-256
hashes ever leave the machine — never prose, never entity data. The primary TSA
is the FleshNote timestamping service (api.fleshnote.org, Go); an external
RFC 3161 TSA (default freetsa.org) can be cross-anchored as an independent
second opinion.

Both calls are best-effort: any network failure simply leaves the receipt in
'pending' state for a later retry.
"""

import os
import json
import time
import struct
import urllib.request
import urllib.error

DEFAULT_TSA_URL = os.environ.get("FLESHNOTE_TSA_URL", "https://api.fleshnote.org/tsa")
DEFAULT_EXTERNAL_TSA_URL = os.environ.get("FLESHNOTE_EXTERNAL_TSA_URL", "https://freetsa.org/tsr")
ANCHOR_TIMEOUT = 6          # seconds — anchoring must never stall the writing flow
EXTERNAL_TIMEOUT = 12       # public TSAs can be slow
MAX_ATTEMPT_MS = 8000

SHA256_OID = bytes([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01])


def _config_dir():
    """Device-local (not project-local) config dir for the TSA device token."""
    appdata = os.environ.get("APPDATA")
    base = os.path.join(appdata, "FleshNote") if appdata else os.path.expanduser("~/.fleshnote")
    os.makedirs(base, exist_ok=True)
    return base


def device_token():
    """Stable per-install token for rate limiting. Not a secret, not identity."""
    path = os.path.join(_config_dir(), "tsa_device_token")
    try:
        with open(path, "r", encoding="utf-8") as f:
            token = f.read().strip()
            if token:
                return token
    except OSError:
        pass
    token = os.urandom(16).hex()
    with open(path, "w", encoding="utf-8") as f:
        f.write(token)
    return token


def anchor_hash(anchored_hash, previous_hash=None, tsa_url=None):
    """
    POST {anchored_hash, previous_hash, client_token} to the TSA /anchor endpoint.
    Returns the receipt dict {server_time, server_signature, key_id} or raises.
    The server never learns anything beyond two hashes and a random token.
    """
    base = (tsa_url or DEFAULT_TSA_URL).rstrip("/")
    payload = json.dumps({
        "anchored_hash": anchored_hash,
        "previous_hash": previous_hash,
        "client_token": device_token(),
    }).encode("utf-8")
    req = urllib.request.Request(
        base + "/anchor", data=payload,
        headers={"Content-Type": "application/json"}, method="POST")
    started = time.time()
    with urllib.request.urlopen(req, timeout=ANCHOR_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if not isinstance(data, dict) or "server_time" not in data or "server_signature" not in data:
        raise ValueError("Malformed TSA receipt")
    return data


# ── External RFC 3161 cross-anchoring ────────────────────────────────────────

def _der_len(n):
    if n < 0x80:
        return bytes([n])
    out = b""
    while n:
        out = bytes([n & 0xFF]) + out
        n >>= 8
    return bytes([0x80 | len(out)]) + out


def _der_seq(*parts):
    body = b"".join(parts)
    return b"\x30" + _der_len(len(body)) + body


def _der_int(value, width):
    return b"\x02" + _der_len(width) + value.to_bytes(width, "big")


def _build_timestamp_req(sha256_digest):
    """Minimal DER TimeStampReq for SHA-256: version, imprint, nonce, certReq."""
    import secrets
    imprint = _der_seq(SHA256_OID, b"\x04\x20" + sha256_digest)
    nonce = secrets.randbits(63)
    nbytes = (nonce.bit_length() + 7) // 8
    nonce_der = _der_int(nonce, nbytes)
    cert_req = b"\x01\x01\xff"
    return _der_seq(b"\x02\x01\x01", imprint, nonce_der, cert_req)


def _der_parse_tlv(data, offset=0):
    """Returns (tag, content_bytes, next_offset)."""
    tag = data[offset]
    offset += 1
    length = data[offset]
    offset += 1
    if length & 0x80:
        n = length & 0x7F
        length = int.from_bytes(data[offset:offset + n], "big")
        offset += n
    return tag, data[offset:offset + length], offset + length


def external_tsa_token(anchored_hash, url=None):
    """
    Blind cross-anchor via an external RFC 3161 TSA. Returns the DER-encoded
    TimeStampToken as hex (verification is deferred to the CLI verifier), or raises.
    """
    if len(anchored_hash) != 64:
        raise ValueError("Expected a SHA-256 hex digest")
    digest = bytes.fromhex(anchored_hash)
    req_der = _build_timestamp_req(digest)
    base = (url or DEFAULT_EXTERNAL_TSA_URL).rstrip("/")
    req = urllib.request.Request(
        base, data=req_der,
        headers={"Content-Type": "application/timestamp-query",
                 "Accept": "application/timestamp-reply"},
        method="POST")
    with urllib.request.urlopen(req, timeout=EXTERNAL_TIMEOUT) as resp:
        resp_der = resp.read()

    # TimeStampResp ::= SEQUENCE { PKIStatusInfo, TimeStampToken OPTIONAL }
    tag, body, _ = _der_parse_tlv(resp_der, 0)
    if tag != 0x30 or not body:
        raise ValueError("Malformed TSA response")
    it = 0
    # PKIStatusInfo: SEQUENCE whose first element is INTEGER status
    st_tag, st_body, it = _der_parse_tlv(body, it)
    status_tag, status_val, _ = _der_parse_tlv(st_body, 0)
    if status_tag != 0x02 or status_val != b"\x00":
        raise ValueError(f"TSA rejected the request (status {status_val.hex()})")
    # second element, if present, is the TimeStampToken (ContentInfo)
    if it < len(body):
        tok_tag, tok_body, _ = _der_parse_tlv(body, it)
        if tok_tag == 0x30 and tok_body:
            return tok_body.hex()
    raise ValueError("TSA response contained no token")

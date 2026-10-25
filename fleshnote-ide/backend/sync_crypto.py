"""
FleshNote — encryption for the phone <-> desktop Wi-Fi sync.

Each pairing session has a random 256-bit key that only ever travels inside
the QR code shown on the desktop screen. Every message that carries project
content (the pairing reply, the project zips in both directions, and the
completion notice) is sealed with AES-256-GCM:

    blob = version (1 byte, 0x02) || nonce (12 bytes) || ciphertext || tag (16 bytes)

The associated data binds each blob to its purpose and its session, so a blob
captured on the network can't be replayed as a different message or in a
different session:

    aad = "fleshnote-sync/2|<purpose>|<session token>"   (UTF-8)

Purposes: "pair" and "download" (desktop -> phone), "upload" and "complete"
(phone -> desktop). The session token itself is sent in the clear; it only
names the session. Without the key it can't read or forge anything.
"""

import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

VERSION = 2
KEY_BYTES = 32
NONCE_BYTES = 12
TAG_BYTES = 16
OVERHEAD = 1 + NONCE_BYTES + TAG_BYTES


class SealError(ValueError):
    """A blob that is malformed, from another session or protocol, or was
    sealed with a different key."""


def new_key() -> bytes:
    return os.urandom(KEY_BYTES)


def _aad(purpose: str, token: str) -> bytes:
    return f"fleshnote-sync/{VERSION}|{purpose}|{token}".encode("utf-8")


def seal(key: bytes, purpose: str, token: str, data: bytes) -> bytes:
    nonce = os.urandom(NONCE_BYTES)
    return bytes([VERSION]) + nonce + AESGCM(key).encrypt(nonce, data, _aad(purpose, token))


def open_sealed(key: bytes, purpose: str, token: str, blob: bytes) -> bytes:
    if len(blob) < OVERHEAD or blob[0] != VERSION:
        raise SealError("Not a FleshNote sync message of this version")
    nonce = blob[1:1 + NONCE_BYTES]
    try:
        return AESGCM(key).decrypt(nonce, blob[1 + NONCE_BYTES:], _aad(purpose, token))
    except InvalidTag:
        raise SealError("The message could not be decrypted with this session's key")

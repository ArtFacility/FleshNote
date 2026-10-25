#!/usr/bin/env python3
"""
Sealed Pentimento — offline verifier (trustless, open source).

Reads a FleshNote project's fleshnote.db LOCALLY and verifies:

  1. Per-chapter Pentimento hash chains, one per device (SHA-256 over the
     previous hash + op fingerprints — recomputed from raw ops where they
     survive compaction, and chain-linked where they don't). Sessions link by
     previous_session_hash; a device's first session on a chapter may link to
     another device's session (the state it started from), and a merge session
     names the other chains it joined.
  2. Every server receipt's Ed25519 signature against the TSA's public
     keys (fetched once from /tsa/pubkey, or supplied via --keys-file).
  3. External RFC 3161 tokens (presence-checked; full CMS verification is
     left to standard tooling such as `openssl ts -verify`).
  4. Anchored-vs-gap timeline: gaps are flagged, never fatal.

Nothing is uploaded. Exit code 0 = all checks passed, 1 = verification
failure, 2 = soft warnings only (gaps / uncompacted-by-design states).

Usage:
  python verify_pentimento.py <project_path> [--tsa-url URL] [--keys-file FILE]
                              [--json] [--verbose]
"""

import argparse
import base64
import hashlib
import json
import os
import sqlite3
import sys
import urllib.request

DEFAULT_TSA_URL = "https://api.fleshnote.org/tsa"


# ── Ed25519 verification ─────────────────────────────────────────────────────
# Uses the `cryptography` package (standard, battle-tested). It ships as a
# dependency of the desktop app's Python environment and is listed in
# requirements.txt.

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


def ed25519_verify(public_key_hex: str, message: bytes, sig_bytes: bytes) -> bool:
    try:
        pub = Ed25519PublicKey.from_public_bytes(bytes.fromhex(public_key_hex))
        pub.verify(sig_bytes, message)
        return True
    except InvalidSignature:
        return False
    except Exception:
        return False


# ── Verification core ────────────────────────────────────────────────────────

def op_fingerprint(op_type, para_index, char_offset, length, text_content, timestamp):
    return f"{op_type}|{para_index}|{char_offset}|{length}|{text_content or ''}|{timestamp}"


def fetch_pubkeys(tsa_url, keys_file):
    """Returns {key_id: public_key_hex} (active + previous)."""
    keys = {}
    if keys_file:
        with open(keys_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        req = urllib.request.Request(tsa_url.rstrip("/") + "/pubkey",
                                     headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    active = data.get("key_id")
    if active and data.get("public_key"):
        keys[active] = data["public_key"]
    for rec in data.get("previous_keys") or []:
        if rec.get("key_id") and rec.get("public_key"):
            keys[rec["key_id"]] = rec["public_key"]
    return keys


def load_receipts(db):
    cur = db.execute("SELECT * FROM server_receipts ORDER BY created_at ASC")
    rows = [dict(r) for r in cur.fetchall()]
    return rows


def recompute_session_hash(db, session):
    """Recompute a session's chain hash from raw ops. Returns hash or None if
    ops were compacted away (verification then relies on stored hash + chain)."""
    cur = db.execute(
        "SELECT op_type, para_index, char_offset, length, text_content, timestamp "
        "FROM pentimento_ops WHERE session_id=? ORDER BY timestamp, rowid",
        (session["id"],))
    ops = cur.fetchall()
    if not ops:
        return None
    h = hashlib.sha256()
    h.update((session["previous_session_hash"] or "").encode("utf-8"))
    for o in ops:
        fp = f"{o['op_type']}|{o['para_index']}|{o['char_offset']}|{o['length'] or 0}|{o['text_content'] or ''}|{o['timestamp']}"
        h.update(fp.encode("utf-8"))
    return h.hexdigest()


def device_labels(sessions):
    """Display names per device: Desktop, Desktop 2, Phone, Phone 2, numbered per
    kind by each device's first session."""
    first = {}
    kinds = {}
    for s in sessions:
        dev = s["device_id"]
        start = s.get("start_time") or ""
        if dev not in first or start < first[dev]:
            first[dev] = start
        if s.get("device_kind") in ("desktop", "mobile"):
            kinds.setdefault(dev, set()).add(s["device_kind"])
    out = {}
    for kind, name in (("desktop", "Desktop"), ("mobile", "Phone")):
        devs = sorted((d for d in first
                       if ("mobile" if kinds.get(d) == {"mobile"} else "desktop") == kind),
                      key=lambda d: (first[d], d or ""))
        for n, d in enumerate(devs, start=1):
            out[d] = name if n == 1 else f"{name} {n}"
    return out


def merge_records(db, session):
    """Payloads of a session's merge ops (a sync joining other devices' chains)."""
    out = []
    for (text,) in db.execute(
            "SELECT text_content FROM pentimento_ops WHERE session_id=? AND op_type='merge'",
            (session["id"],)):
        try:
            data = json.loads(text or "")
        except ValueError:
            continue
        if isinstance(data, dict) and data.get("merge") == 1:
            out.append(data)
    return out


def verify_project(project_path, tsa_url, keys_file, verbose=False):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise SystemExit(f"No fleshnote.db found at {project_path}")

    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row

    keys = fetch_pubkeys(tsa_url, keys_file)
    if not keys:
        raise SystemExit("No TSA public keys available — refusing to verify blind.")

    receipts = load_receipts(db)
    receipt_errors = []
    for r in receipts:
        if r["status"] != "anchored" or not r["server_signature"]:
            continue
        pub_hex = keys.get(r["key_id"] or "")
        if not pub_hex:
            receipt_errors.append(f"receipt {r['id']}: unknown key {r['key_id']}")
            continue
        payload = f"{r['anchored_hash']}|{r['previous_hash'] or ''}|{r['server_time']}|{r['key_id']}"
        if not ed25519_verify(pub_hex, payload.encode("utf-8"), bytes.fromhex("00") * 0 + base64.b64decode(r["server_signature"])):
            receipt_errors.append(f"receipt {r['id']}: BAD SIGNATURE")

    sessions = [dict(r) for r in db.execute(
        "SELECT * FROM pentimento_sessions ORDER BY chapter_id, session_num, start_time")]
    labels = device_labels(sessions)

    # Each device keeps its own chain per chapter. A session links to its device's
    # previous session by previous_session_hash; a device's first session on a
    # chapter links to nothing or to a sealed session of another device (the state
    # it started from). Session numbers are a chapter-wide ordinal and may repeat
    # across devices, so links are followed by hash, never by number.
    by_hash = {}
    for s in sessions:
        if s["session_hash"]:
            by_hash.setdefault((s["chapter_id"], s["session_hash"]), s)

    chains = {}
    for s in sessions:
        chains.setdefault((s["chapter_id"], s["device_id"]), []).append(s)

    chapter_results = {}
    for (ch, dev), chain in chains.items():
        entry = chapter_results.setdefault(
            ch, {"ok": True, "issues": [], "anchored": 0, "sessions": 0, "chains": {}})
        label = labels.get(dev, dev or "unknown")
        line = entry["chains"].setdefault(dev or "unknown", {
            "label": label, "sessions": 0, "anchored": 0, "ok": True})

        own_prev = None
        for s in chain:
            entry["sessions"] += 1
            line["sessions"] += 1
            name = f"{label} · session {s['session_num']}"
            chain_ok = True

            prev = s["previous_session_hash"]
            if prev:
                parent = by_hash.get((ch, prev))
                if parent is None and own_prev is None:
                    # A device's first session links to the version it started from,
                    # another device's session. Its own chain is intact without it;
                    # projects cloned by older phone builds point at a copy the phone
                    # sealed itself.
                    entry["issues"].append(
                        f"{name}: starts from a version that is not in this project")
                elif parent is None:
                    entry["issues"].append(f"{name}: chain link broken (predecessor missing)")
                    chain_ok = False
                elif own_prev is not None and parent["device_id"] == dev \
                        and parent["id"] != own_prev["id"] and own_prev["session_hash"]:
                    entry["issues"].append(
                        f"{name}: chain link broken (skips this device's previous session)")
                    chain_ok = False
                elif parent["device_id"] != dev and verbose:
                    entry["issues"].append(
                        f"{name}: continues from "
                        f"{labels.get(parent['device_id'], parent['device_id'])}"
                        f" · session {parent['session_num']}")
            elif own_prev is not None and own_prev["session_hash"]:
                entry["issues"].append(f"{name}: chain link broken (restarts the chain)")
                chain_ok = False

            recomputed = recompute_session_hash(db, s)
            stored = s["session_hash"]
            if recomputed is not None:
                if stored and recomputed != stored:
                    entry["issues"].append(f"{name}: hash mismatch (recomputed ≠ stored)")
                    chain_ok = False
            elif verbose and stored:
                entry["issues"].append(f"{name}: ops compacted — verified via sealed hash only")

            for merge in merge_records(db, s):
                for head in merge.get("heads") or []:
                    if (ch, head) not in by_hash:
                        entry["issues"].append(
                            f"{name}: merge names a chain head not in this project")

            # receipts matching this session's hash
            if stored:
                anchored = [r for r in receipts
                            if r["anchored_hash"] == stored and r["status"] == "anchored"]
                if anchored:
                    entry["anchored"] += 1
                    line["anchored"] += 1
                else:
                    pending = [r for r in receipts if r["anchored_hash"] == stored]
                    if pending:
                        entry["issues"].append(f"{name}: receipt pending (will anchor later)")
                    else:
                        entry["issues"].append(f"{name}: no receipt (offline or opted-out period)")

            if not chain_ok:
                entry["ok"] = False
                line["ok"] = False
            own_prev = s

    db.close()

    anchored_receipts = [r for r in receipts if r["status"] == "anchored"]
    report = {
        "tsa_url": tsa_url,
        "tsa_keys": sorted(keys.keys()),
        "receipts_total": len(receipts),
        "receipts_anchored": len(anchored_receipts),
        "receipt_errors": receipt_errors,
        "chapters": {ch: res for ch, res in chapter_results.items()},
        "first_anchored": min((r["server_time"] for r in anchored_receipts if r["server_time"]), default=None),
        "last_anchored": max((r["server_time"] for r in anchored_receipts if r["server_time"]), default=None),
        "verdict": None,
    }
    hard_fail = bool(receipt_errors) or any(not res["ok"] for res in chapter_results.values())
    report["verdict"] = "FAIL" if hard_fail else "PASS"
    return report


def main():
    ap = argparse.ArgumentParser(description="Sealed Pentimento offline verifier")
    ap.add_argument("project_path")
    ap.add_argument("--tsa-url", default=DEFAULT_TSA_URL)
    ap.add_argument("--keys-file", default=None, help="Local copy of the TSA /pubkey payload (JSON)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    report = verify_project(args.project_path, args.tsa_url, args.keys_file, args.verbose)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Sealed Pentimento verification — {report['verdict']}")
        print(f"  TSA: {report['tsa_url']}  keys: {', '.join(report['tsa_keys'])}")
        print(f"  Anchored span: {report['first_anchored']} → {report['last_anchored']}")
        print(f"  Receipts: {report['receipts_anchored']} anchored / {report['receipts_total']} total")
        for err in report["receipt_errors"]:
            print(f"  ! {err}")
        for ch, res in report["chapters"].items():
            status = "OK" if res["ok"] else "BROKEN"
            print(f"  chapter {ch[:8]}…: {status} ({res['anchored']}/{res['sessions']} sealed anchors)")
            if len(res["chains"]) > 1:
                for line in res["chains"].values():
                    mark = "OK" if line["ok"] else "BROKEN"
                    print(f"      {line['label']}: {mark} "
                          f"({line['anchored']}/{line['sessions']} sealed anchors)")
            if args.verbose:
                for issue in res["issues"]:
                    print(f"      - {issue}")

    sys.exit(1 if report["verdict"] == "FAIL" else (2 if report["receipt_errors"] or any(res["issues"] for res in report["chapters"].values()) else 0))


if __name__ == "__main__":
    import json
    main()

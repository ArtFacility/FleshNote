"""Writing-process history across devices (process_history.py + sync):
- every device chains onto its own sessions; its first session on a chapter forks
  from the newest sealed one, and another device's open session is never sealed
- a sync imports the other side's sealed sessions, ops, snapshots and receipts,
  once, and never its own or anything removed on purpose
- forged sessions and snapshots are refused; receipts only move forward
- an unsealed copy, or a copy the owner sealed differently, is replaced by the
  owner's version
- the same chapter edited on both devices ends in a merge session that seals the
  join of both chains, and the verifier passes on the result
"""
import os
import sys
import json
import shutil
import sqlite3
import tempfile
import hashlib
import unittest
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "tools"))

import sync_core
import db_setup
import process_history
from routes import pentimento as pent, sync
import verify_pentimento

DESK, PHONE = "desk-device", "phone-device"


def _connect(path):
    conn = sqlite3.connect(os.path.join(path, "fleshnote.db"))
    conn.row_factory = sqlite3.Row
    return conn, conn.cursor()


def _op(text, ts, para=0, offset=0):
    return {"timestamp": ts, "op_type": "insert", "para_index": para, "char_offset": offset,
            "length": len(text), "text_content": text, "duration_ms": 400, "source": "human"}


class MultiDeviceBase(unittest.TestCase):
    def setUp(self):
        self._device = sync_core.DEVICE_ID
        self.root = tempfile.mkdtemp(prefix="fn_multidev_")
        self.desk = os.path.join(self.root, "Desk")
        os.makedirs(self.desk)
        sync_core.DEVICE_ID = DESK
        db_setup.generate_project_db(self.desk, {"project_name": "Two", "genre": "fantasy"})
        with open(os.path.join(self.desk, "fleshnote_project.json"), "w", encoding="utf-8") as f:
            json.dump({"project_id": "proj-two", "schema_version": 2}, f)
        conn, cur = _connect(self.desk)
        row = cur.execute("SELECT id, md_filename FROM chapters WHERE deleted=0 "
                          "ORDER BY chapter_number LIMIT 1").fetchone()
        self.ch, self.md = row["id"], row["md_filename"]
        conn.close()
        self._write(self.desk, DESK, "Once upon a time.")
        self._session(self.desk, DESK, "Once", "2026-10-01T08:00:00.000Z")
        self.phone = os.path.join(self.root, "Phone")
        shutil.copytree(self.desk, self.phone)   # the clone
        pent._SCHEMA_READY.clear()

    def tearDown(self):
        sync_core.DEVICE_ID = self._device
        shutil.rmtree(self.root, ignore_errors=True)

    # ── helpers ──

    def _write(self, path, device, text):
        sync_core.DEVICE_ID = device
        os.makedirs(os.path.join(path, "md"), exist_ok=True)
        with open(os.path.join(path, "md", self.md), "w", encoding="utf-8") as f:
            f.write(text)
        conn, cur = _connect(path)
        cur.execute("UPDATE chapters SET word_count=? WHERE id=?", (len(text.split()), self.ch))
        sync_core.log_change(cur, "chapters", self.ch,
                             {"prose_hash": hashlib.sha256(text.encode("utf-8")).hexdigest()})
        conn.commit()
        conn.close()

    def _session(self, path, device, text, ts, end=True):
        sync_core.DEVICE_ID = device
        sid = pent.session_start(pent.SessionStart(project_path=path, chapter_id=self.ch))["session_id"]
        pent.flush(pent.FlushRequest(project_path=path, session_id=sid, chapter_id=self.ch,
                                     ops=[_op(text, ts)]))
        if device == PHONE:   # what the phone records
            conn, cur = _connect(path)
            cur.execute("UPDATE pentimento_sessions SET device_kind='mobile' WHERE id=?", (sid,))
            cur.execute("UPDATE pentimento_ops SET origin='mobile' WHERE session_id=?", (sid,))
            conn.commit()
            conn.close()
        if end:
            pent.session_end(pent.SessionEnd(project_path=path, session_id=sid))
        return sid

    def _sync(self, local, remote, device, resolutions=None):
        sync_core.DEVICE_ID = device
        res = sync.sync_apply(sync.SyncApplyRequest(local_path=local, remote_path=remote,
                                                    resolutions=resolutions or {}))
        self.assertEqual(res["status"], "ok")
        return res["process_history"]

    def _rows(self, path, sql, args=()):
        conn, cur = _connect(path)
        rows = [dict(r) for r in cur.execute(sql, args).fetchall()]
        conn.close()
        return rows

    def _sessions(self, path, device=None):
        if device:
            return self._rows(path, "SELECT * FROM pentimento_sessions WHERE device_id=? "
                                    "ORDER BY session_num", (device,))
        return self._rows(path, "SELECT * FROM pentimento_sessions ORDER BY session_num")

    def _verify(self, path):
        keys = os.path.join(self.root, "keys.json")
        with open(keys, "w", encoding="utf-8") as f:
            f.write('{"key_id": "test", "public_key": "00"}')
        return verify_pentimento.verify_project(path, None, keys)

    def _chain_issues(self, path):
        report = self._verify(path)
        return [i for ch in report["chapters"].values() for i in ch["issues"]
                if "receipt" not in i]


class TestChains(MultiDeviceBase):
    def test_phone_forks_from_the_desktop_and_desktop_keeps_its_own_chain(self):
        desk_first = self._sessions(self.desk)[0]
        self._write(self.phone, PHONE, "Once upon a time. A phone line.")
        p1 = self._session(self.phone, PHONE, " A phone line.", "2026-10-02T08:00:00.000Z")
        phone_row = self._rows(self.phone, "SELECT * FROM pentimento_sessions WHERE id=?", (p1,))[0]
        self.assertEqual(phone_row["previous_session_hash"], desk_first["session_hash"])

        stats = self._sync(self.desk, self.phone, DESK)
        self.assertEqual(stats["sessions"], 1)
        d2 = self._session(self.desk, DESK, " More.", "2026-10-03T08:00:00.000Z")
        row = self._rows(self.desk, "SELECT * FROM pentimento_sessions WHERE id=?", (d2,))[0]
        # chained onto the desktop's own session, not the imported phone one
        self.assertEqual(row["previous_session_hash"], desk_first["session_hash"])
        self.assertEqual(row["session_num"], 3)
        self.assertEqual(self._chain_issues(self.desk), [])

    def test_another_devices_open_session_is_never_sealed_here(self):
        conn, cur = _connect(self.desk)
        cur.execute("INSERT INTO pentimento_sessions (id, chapter_id, device_id, session_num, "
                    "start_time) VALUES ('foreign-open', ?, ?, 9, '2026-10-02T08:00:00')",
                    (self.ch, PHONE))
        conn.commit()
        conn.close()
        self._session(self.desk, DESK, " x", "2026-10-03T08:00:00.000Z")
        open_row = self._rows(self.desk, "SELECT * FROM pentimento_sessions WHERE id='foreign-open'")[0]
        self.assertIsNone(open_row["session_hash"])

    def test_device_kind_is_backfilled_for_own_rows(self):
        conn, cur = _connect(self.desk)
        cur.execute("UPDATE pentimento_sessions SET device_kind=NULL")
        conn.commit()
        db_setup.ensure_process_history_schema(cur, DESK)
        conn.commit()
        conn.close()
        self.assertEqual({r["device_kind"] for r in self._sessions(self.desk)}, {"desktop"})


class TestImport(MultiDeviceBase):
    def _phone_writes(self):
        self._write(self.phone, PHONE, "Once upon a time. A phone line.")
        return self._session(self.phone, PHONE, " A phone line.", "2026-10-02T08:00:00.000Z")

    def test_import_is_idempotent_and_brings_ops_and_snapshots(self):
        p1 = self._phone_writes()
        first = self._sync(self.desk, self.phone, DESK)
        self.assertEqual((first["sessions"], first["ops"]), (1, 1))
        self.assertGreaterEqual(first["snapshots"], 1)
        again = self._sync(self.desk, self.phone, DESK)
        self.assertEqual((again["sessions"], again["ops"], again["snapshots"]), (0, 0, 0))
        self.assertEqual(len(self._rows(self.desk, "SELECT * FROM pentimento_ops WHERE session_id=?",
                                        (p1,))), 1)
        imported = self._rows(self.desk, "SELECT * FROM pentimento_sessions WHERE id=?", (p1,))[0]
        self.assertEqual(imported["device_kind"], "mobile")
        # the phone's own copy of the desktop's sessions is never sent back as new
        self.assertEqual(len(self._sessions(self.desk, DESK)), 1)

    def test_preview_counts_without_writing(self):
        self._phone_writes()
        sync_core.DEVICE_ID = DESK
        res = sync.sync_preview(sync.SyncPreviewRequest(local_path=self.desk, remote_path=self.phone))
        self.assertEqual(res["summary"]["history_sessions"], 1)
        self.assertEqual(len(self._sessions(self.desk)), 1)

    def test_own_sessions_never_come_back_from_the_other_side(self):
        self._phone_writes()
        self._sync(self.phone, self.desk, PHONE)    # phone pulls the desktop
        conn, cur = _connect(self.desk)
        cur.execute("UPDATE pentimento_sessions SET wpm_trace='[[0,0,99]]' WHERE device_id=?", (DESK,))
        conn.commit()
        conn.close()
        self._sync(self.desk, self.phone, DESK)
        rows = self._sessions(self.desk, DESK)
        self.assertEqual(rows[0]["wpm_trace"], "[[0,0,99]]")

    def test_forged_session_and_snapshot_are_refused(self):
        p1 = self._phone_writes()
        conn, cur = _connect(self.phone)
        cur.execute("UPDATE pentimento_ops SET text_content=' forged' WHERE session_id=?", (p1,))
        cur.execute("UPDATE chapter_snapshots SET prose_hash=? WHERE device_id=?", ("ab" * 32, PHONE))
        conn.commit()
        conn.close()
        stats = self._sync(self.desk, self.phone, DESK)
        self.assertEqual(stats["sessions"], 0)
        self.assertEqual(stats["snapshots"], 0)
        self.assertGreaterEqual(stats["rejected"], 2)
        self.assertEqual(self._rows(self.desk, "SELECT * FROM pentimento_sessions WHERE id=?", (p1,)), [])

    def test_cleared_history_stays_cleared(self):
        self._phone_writes()
        self._sync(self.desk, self.phone, DESK)
        sync_core.DEVICE_ID = DESK
        pent.clear(pent.ClearRequest(project_path=self.desk, chapter_id=self.ch))
        from routes import chapter_history
        chapter_history.history_clear(chapter_history.ClearRequest(project_path=self.desk,
                                                                   chapter_id=self.ch))
        stats = self._sync(self.desk, self.phone, DESK)
        self.assertEqual((stats["sessions"], stats["snapshots"]), (0, 0))
        self.assertEqual(self._sessions(self.desk), [])

    def test_unsealed_copy_is_replaced_by_the_sealed_version(self):
        p1 = self._session(self.phone, PHONE, " typed", "2026-10-02T08:00:00.000Z", end=False)
        # the desktop somehow holds the phone's session while it was still open
        phone_row = self._rows(self.phone, "SELECT * FROM pentimento_sessions WHERE id=?", (p1,))[0]
        conn, cur = _connect(self.desk)
        cur.execute("INSERT INTO pentimento_sessions (id, chapter_id, device_id, session_num, "
                    "start_time, previous_session_hash) VALUES (?,?,?,?,?,?)",
                    (p1, self.ch, PHONE, phone_row["session_num"], phone_row["start_time"],
                     phone_row["previous_session_hash"]))
        conn.commit()
        conn.close()
        sync_core.DEVICE_ID = PHONE
        pent.session_end(pent.SessionEnd(project_path=self.phone, session_id=p1))
        stats = self._sync(self.desk, self.phone, DESK)
        self.assertEqual(stats["replaced"], 1)
        row = self._rows(self.desk, "SELECT * FROM pentimento_sessions WHERE id=?", (p1,))[0]
        self.assertIsNotNone(row["session_hash"])
        self.assertEqual(self._chain_issues(self.desk), [])

    def test_owner_replaces_a_copy_another_device_sealed(self):
        # Older phone builds sealed the desktop's open session themselves, with the
        # phone's text. The desktop's own sealed version wins on the phone.
        desk_sid = self._sessions(self.desk)[0]["id"]
        conn, cur = _connect(self.phone)
        cur.execute("UPDATE pentimento_sessions SET session_hash=? WHERE id=?", ("cd" * 32, desk_sid))
        conn.commit()
        conn.close()
        self._write(self.desk, DESK, "Once upon a time. Desk again.")
        self._sync(self.phone, self.desk, PHONE)
        row = self._rows(self.phone, "SELECT * FROM pentimento_sessions WHERE id=?", (desk_sid,))[0]
        self.assertEqual(row["session_hash"], self._sessions(self.desk)[0]["session_hash"])

    def test_clone_taken_while_a_desktop_session_was_open(self):
        # Before 2026-10-07, a phone cloned while a desktop session was open sealed
        # that session itself (with the phone's text) and chained its own writing
        # onto it. Both sides must still verify after syncing both ways.
        open_sid = self._session(self.desk, DESK, " more", "2026-10-02T07:00:00.000Z", end=False)
        shutil.rmtree(self.phone)
        shutil.copytree(self.desk, self.phone)
        sync_core.DEVICE_ID = PHONE
        conn, cur = _connect(self.phone)
        pent._seal_session(cur, self.phone, open_sid)      # what the old phone build did
        conn.commit()
        conn.close()
        self._write(self.phone, PHONE, "Once upon a time. A phone line.")
        self._session(self.phone, PHONE, " A phone line.", "2026-10-02T08:00:00.000Z")
        sync_core.DEVICE_ID = DESK   # the desktop kept typing in that session after the clone
        pent.flush(pent.FlushRequest(project_path=self.desk, session_id=open_sid, chapter_id=self.ch,
                                     ops=[_op(" again", "2026-10-02T07:30:00.000Z")]))
        pent.session_end(pent.SessionEnd(project_path=self.desk, session_id=open_sid))
        self._session(self.desk, DESK, " desk", "2026-10-02T09:00:00.000Z")

        self._sync(self.desk, self.phone, DESK)
        self._sync(self.phone, self.desk, PHONE)
        for side in (self.desk, self.phone):
            report = self._verify(side)
            self.assertEqual(report["verdict"], "PASS", self._chain_issues(side))
        # the phone now holds the desktop's own version of that session
        desk_row = self._rows(self.desk, "SELECT session_hash FROM pentimento_sessions WHERE id=?",
                              (open_sid,))[0]
        phone_row = self._rows(self.phone, "SELECT session_hash FROM pentimento_sessions WHERE id=?",
                               (open_sid,))[0]
        self.assertEqual(desk_row, phone_row)

    def test_owner_cannot_replace_a_copy_its_own_chain_continues_from(self):
        # A sealed copy that the owner's later sessions here already link to is the
        # one the chain depends on: a different "owner" version must not replace it.
        desk_sid = self._sessions(self.desk)[0]["id"]
        self._session(self.desk, DESK, " two", "2026-10-02T09:00:00.000Z")
        self._sync(self.phone, self.desk, PHONE)
        conn, cur = _connect(self.desk)
        cur.execute("UPDATE pentimento_sessions SET session_hash=?, previous_session_hash=? "
                    "WHERE id=?", ("ef" * 32, None, desk_sid))
        cur.execute("DELETE FROM pentimento_ops WHERE session_id=?", (desk_sid,))
        cur.execute("UPDATE pentimento_sessions SET summary_json='{}' WHERE id=?", (desk_sid,))
        conn.commit()
        conn.close()
        self._sync(self.phone, self.desk, PHONE)
        self.assertEqual(self._chain_issues(self.phone), [])

    def test_receipts_only_move_forward(self):
        p1 = self._phone_writes()
        h = self._rows(self.phone, "SELECT session_hash FROM pentimento_sessions WHERE id=?", (p1,))[0]["session_hash"]
        conn, cur = _connect(self.phone)
        for rid, status in (("r-pend", "pending"), ("r-fork", "forked")):
            cur.execute("INSERT INTO server_receipts (id, session_id, chapter_id, kind, anchored_hash, "
                        "client_time, status) VALUES (?,?,?,'seal',?,'2026-10-02T08:00:00',?)",
                        (rid, p1, self.ch, h, status))
        conn.commit()
        conn.close()
        self._sync(self.desk, self.phone, DESK)
        self.assertEqual(len(self._rows(self.desk, "SELECT * FROM server_receipts")), 2)

        conn, cur = _connect(self.phone)
        cur.execute("UPDATE server_receipts SET status='anchored', server_time='2026-10-02T08:01:00Z', "
                    "server_signature='c2ln', key_id='8b7862c3ec57a700'")
        conn.commit()
        conn.close()
        stats = self._sync(self.desk, self.phone, DESK)
        self.assertEqual(stats["receipts_updated"], 1)
        status = {r["id"]: r["status"] for r in self._rows(self.desk, "SELECT * FROM server_receipts")}
        self.assertEqual(status, {"r-pend": "anchored", "r-fork": "forked"})

        # and never back
        conn, cur = _connect(self.phone)
        cur.execute("UPDATE server_receipts SET status='pending'")
        conn.commit()
        conn.close()
        self._sync(self.desk, self.phone, DESK)
        status = {r["id"]: r["status"] for r in self._rows(self.desk, "SELECT * FROM server_receipts")}
        self.assertEqual(status["r-pend"], "anchored")

    def test_heatmap_leaves_phone_paragraphs_out(self):
        self._phone_writes()
        self._sync(self.desk, self.phone, DESK)
        res = pent.heatmap(pent.ChapterDeviceScoped(project_path=self.desk, chapter_id=self.ch))
        self.assertEqual(res["session_count"], 1)   # only the desktop's own session


class TestConcurrentEdit(MultiDeviceBase):
    def test_both_chains_survive_and_the_merge_is_sealed(self):
        base_hash = self._sessions(self.desk)[0]["session_hash"]
        self._write(self.desk, DESK, "Once upon a time. Desk line.")
        d2 = self._session(self.desk, DESK, " Desk line.", "2026-10-02T09:00:00.000Z")
        self._write(self.phone, PHONE, "Once upon a time. Phone line.")
        p1 = self._session(self.phone, PHONE, " Phone line.", "2026-10-02T08:00:00.000Z")

        merged = "Once upon a time. Desk line. Phone line."
        self._sync(self.desk, self.phone, DESK, resolutions={self.ch: merged})

        rows = {r["id"]: r for r in self._sessions(self.desk)}
        self.assertIn(p1, rows)
        merges = self._rows(self.desk, "SELECT s.*, o.text_content FROM pentimento_sessions s "
                                       "JOIN pentimento_ops o ON o.session_id = s.id "
                                       "WHERE o.op_type='merge'")
        self.assertEqual(len(merges), 1)
        m = merges[0]
        self.assertEqual(m["device_id"], DESK)
        self.assertEqual(m["previous_session_hash"], rows[d2]["session_hash"])
        payload = json.loads(m["text_content"])
        self.assertEqual(payload["heads"], [rows[p1]["session_hash"]])
        self.assertEqual(payload["resolution"], "merged")
        self.assertEqual(payload["prose_hash"], hashlib.sha256(merged.encode()).hexdigest())
        self.assertEqual(rows[p1]["previous_session_hash"], base_hash)
        snaps = self._rows(self.desk, "SELECT * FROM chapter_snapshots WHERE kind='merge'")
        self.assertEqual(len(snaps), 1)
        self.assertEqual(snaps[0]["session_id"], m["id"])
        self.assertEqual(self._chain_issues(self.desk), [])
        chains = self._verify(self.desk)["chapters"][self.ch]["chains"]
        self.assertEqual(sorted(c["label"] for c in chains.values()), ["Desktop", "Phone"])

        # The phone pulls the merged desktop: a clean take, no second merge, and it
        # now holds the desktop's chain including the merge.
        stats = self._sync(self.phone, self.desk, PHONE)
        self.assertEqual(stats["sessions"], 2)   # the desktop's second session + the merge
        self.assertEqual(len(self._rows(self.phone, "SELECT * FROM pentimento_ops "
                                                    "WHERE op_type='merge'")), 1)
        self.assertEqual(self._chain_issues(self.phone), [])
        # and syncing again changes nothing on either side
        self.assertEqual(self._sync(self.desk, self.phone, DESK)["sessions"], 0)
        self.assertEqual(self._sync(self.phone, self.desk, PHONE)["sessions"], 0)
        self.assertEqual(len(self._rows(self.desk, "SELECT * FROM pentimento_ops "
                                                   "WHERE op_type='merge'")), 1)

    def test_open_desktop_session_is_sealed_before_the_take(self):
        self._write(self.phone, PHONE, "Once upon a time. Phone line.")
        self._session(self.phone, PHONE, " Phone line.", "2026-10-02T08:00:00.000Z")
        # the desktop editor is still recording an (empty-text-change) session
        open_sid = self._session(self.desk, DESK, " ", "2026-10-02T09:00:00.000Z", end=False)
        self._sync(self.desk, self.phone, DESK)
        row = self._rows(self.desk, "SELECT * FROM pentimento_sessions WHERE id=?", (open_sid,))[0]
        self.assertIsNotNone(row["session_hash"])
        # its frames hold the desktop's text from before the take, never the phone's
        snaps = self._rows(self.desk, "SELECT * FROM chapter_snapshots WHERE session_id=?",
                           (open_sid,))
        for snap in snaps:
            self.assertEqual(zlib.decompress(snap["content_gz"]).decode(), "Once upon a time.")
        with open(os.path.join(self.desk, "md", self.md), encoding="utf-8") as f:
            self.assertEqual(f.read(), "Once upon a time. Phone line.")
        self.assertEqual(self._chain_issues(self.desk), [])


if __name__ == "__main__":
    unittest.main()

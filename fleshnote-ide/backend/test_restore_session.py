"""Going back to an older version of a chapter (chapter_history.history_restore):
- the session open at the time ends with the text it was writing
- the jump is a sealed session on this device's chain, with a 'restore' snapshot and a
  record of the version brought back and the text it replaced
- it never counts as writing, is never compacted, and travels through a sync
- the verifier passes it and catches a record that lies about the version
"""
import hashlib
import json
import os
import unittest
import zlib

import sync_core
from process_history import RESTORE_OP
from routes import chapter_history as hist, pentimento as pent
from test_multi_device_pentimento import DESK, MultiDeviceBase, PHONE


def _sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class RestoreBase(MultiDeviceBase):
    def setUp(self):
        super().setUp()
        self._write(self.desk, DESK, "Once upon a time. Then more.")
        self._session(self.desk, DESK, " Then more.", "2026-10-02T08:00:00.000Z")
        self.old = self._snapshot_of("Once upon a time.")

    def _snapshot_of(self, text):
        rows = self._rows(self.desk, "SELECT id FROM chapter_snapshots WHERE chapter_id=? "
                                     "AND prose_hash=? ORDER BY rowid", (self.ch, _sha(text)))
        self.assertTrue(rows, text)
        return rows[0]["id"]

    def _restore(self, snapshot_id=None):
        sync_core.DEVICE_ID = DESK
        return hist.history_restore(hist.SnapshotScoped(
            project_path=self.desk, snapshot_id=snapshot_id or self.old))

    def _last_session(self):
        return self._sessions(self.desk, DESK)[-1]

    def _kinds(self):
        return [r["kind"] for r in self._rows(
            self.desk, "SELECT kind FROM chapter_snapshots WHERE chapter_id=? "
                       "ORDER BY created_at, rowid", (self.ch,))]


class TestRestoreSession(RestoreBase):
    def test_the_jump_is_a_sealed_session_with_its_own_frame(self):
        before = self._last_session()
        self._restore()
        s = self._last_session()
        self.assertNotEqual(s["id"], before["id"])
        self.assertEqual(s["previous_session_hash"], before["session_hash"])
        self.assertEqual(s["session_num"], before["session_num"] + 1)
        self.assertTrue(s["session_hash"])

        ops = self._rows(self.desk, "SELECT * FROM pentimento_ops WHERE session_id=?", (s["id"],))
        self.assertEqual([o["op_type"] for o in ops], [RESTORE_OP])
        data = json.loads(ops[0]["text_content"])
        self.assertEqual(data["from_snapshot"], self.old)
        self.assertEqual(data["prose_hash"], _sha("Once upon a time."))
        self.assertEqual(data["replaced_hash"], _sha("Once upon a time. Then more."))

        frame = self._rows(self.desk, "SELECT * FROM chapter_snapshots WHERE session_id=?",
                           (s["id"],))
        self.assertEqual(len(frame), 1)
        self.assertEqual(frame[0]["kind"], RESTORE_OP)
        self.assertEqual(zlib.decompress(frame[0]["content_gz"]).decode("utf-8"),
                         "Once upon a time.")
        self.assertEqual(self._chain_issues(self.desk), [])

    def test_undo_still_has_its_copy_of_the_replaced_text(self):
        self._restore()
        self.assertEqual(self._kinds()[-2:], ["pre_restore", RESTORE_OP])
        rows = self._rows(self.desk, "SELECT prose_hash FROM chapter_snapshots "
                                     "WHERE kind='pre_restore'")
        self.assertEqual(rows[0]["prose_hash"], _sha("Once upon a time. Then more."))

    def test_an_open_session_ends_with_the_text_it_was_writing(self):
        self._write(self.desk, DESK, "Once upon a time. Then more. Unsealed.")
        open_id = self._session(self.desk, DESK, " Unsealed.", "2026-10-03T08:00:00.000Z",
                                end=False)
        self._restore()
        row = self._rows(self.desk, "SELECT * FROM pentimento_sessions WHERE id=?", (open_id,))[0]
        self.assertTrue(row["session_hash"])
        closing = self._rows(self.desk, "SELECT * FROM chapter_snapshots WHERE session_id=? "
                                        "ORDER BY rowid DESC", (open_id,))[0]
        self.assertEqual(closing["prose_hash"], _sha("Once upon a time. Then more. Unsealed."))
        self.assertEqual(self._last_session()["previous_session_hash"], row["session_hash"])

    def test_writing_after_a_restore_starts_from_the_restored_text(self):
        self._restore()
        restore_session = self._last_session()
        sid = pent.session_start(pent.SessionStart(project_path=self.desk, chapter_id=self.ch))["session_id"]
        row = self._rows(self.desk, "SELECT * FROM pentimento_sessions WHERE id=?", (sid,))[0]
        self.assertEqual(row["previous_session_hash"], restore_session["session_hash"])
        # the restore's frame already holds that text: no second start frame
        self.assertEqual(self._rows(self.desk, "SELECT 1 FROM chapter_snapshots WHERE session_id=?",
                                    (sid,)), [])

    def test_restoring_the_same_version_twice_keeps_both_jumps(self):
        self._restore()
        self._restore()
        self.assertEqual(self._kinds().count(RESTORE_OP), 2)

    def test_listed_for_the_replay(self):
        self._restore()
        res = hist.history_list(hist.ChapterScoped(project_path=self.desk, chapter_id=self.ch))
        restored = [s for s in res["sessions"] if s["is_restore"]]
        self.assertEqual(len(restored), 1)
        when = self._rows(self.desk, "SELECT created_at FROM chapter_snapshots WHERE id=?",
                          (self.old,))[0]["created_at"]
        self.assertEqual(restored[0]["restored_from"], when)
        self.assertFalse(restored[0]["is_merge"])
        self.assertEqual(res["snapshots"][0]["kind"], RESTORE_OP)

    def test_with_capture_off_only_the_frame_is_kept(self):
        conn, cur = self._connect_desk()
        cur.execute("UPDATE project_config SET config_value='false' "
                    "WHERE config_key='pentimento_capture'")
        if cur.rowcount == 0:
            cur.execute("INSERT INTO project_config (config_key, config_value, config_type) "
                        "VALUES ('pentimento_capture','false','toggle')")
        conn.commit()
        conn.close()
        before = len(self._sessions(self.desk, DESK))
        self._restore()
        self.assertEqual(len(self._sessions(self.desk, DESK)), before)
        self.assertEqual(self._kinds()[-1], RESTORE_OP)

    def _connect_desk(self):
        from test_multi_device_pentimento import _connect
        return _connect(self.desk)


class TestRestoreIsNotWriting(RestoreBase):
    def test_left_out_of_heatmap_pacing_and_totals(self):
        heat = pent.heatmap(pent.ChapterDeviceScoped(project_path=self.desk, chapter_id=self.ch))
        ops = pent.get_ops(pent.ChapterDeviceScoped(project_path=self.desk, chapter_id=self.ch))
        summary = pent.summary(pent.ProjectScoped(project_path=self.desk))
        self._restore()
        self.assertEqual(
            pent.heatmap(pent.ChapterDeviceScoped(project_path=self.desk, chapter_id=self.ch)), heat)
        self.assertEqual(
            pent.get_ops(pent.ChapterDeviceScoped(project_path=self.desk, chapter_id=self.ch))["ops"],
            ops["ops"])
        after = pent.summary(pent.ProjectScoped(project_path=self.desk))
        self.assertGreater(summary["typed_words"], 0)
        for key in ("typed_words", "deleted_words", "total_time_ms"):
            self.assertEqual(after[key], summary[key], key)

    def test_never_compacted(self):
        self._restore()
        s = self._last_session()
        conn, cur = self._connect_desk()
        cur.execute("UPDATE pentimento_sessions SET start_time='2000-01-01T00:00:00'")
        conn.commit()
        conn.close()
        pent.compact(pent.CompactRequest(project_path=self.desk, older_than_days=1))
        self.assertEqual(
            [o["op_type"] for o in self._rows(
                self.desk, "SELECT op_type FROM pentimento_ops WHERE session_id=?", (s["id"],))],
            [RESTORE_OP])

    def _connect_desk(self):
        from test_multi_device_pentimento import _connect
        return _connect(self.desk)


class TestRestoreAcrossDevices(RestoreBase):
    def test_a_sync_brings_the_jump_along(self):
        self._restore()
        s = self._last_session()
        self._sync(self.phone, self.desk, PHONE)
        copy = self._rows(self.phone, "SELECT * FROM pentimento_sessions WHERE id=?", (s["id"],))
        self.assertEqual(len(copy), 1)
        self.assertEqual(copy[0]["session_hash"], s["session_hash"])
        self.assertEqual(
            [r["kind"] for r in self._rows(self.phone, "SELECT kind FROM chapter_snapshots "
                                                       "WHERE session_id=?", (s["id"],))],
            [RESTORE_OP])
        self.assertEqual(self._chain_issues(self.phone), [])


class TestRestoreVerification(RestoreBase):
    def _set_prose_hash(self, value):
        s = self._last_session()
        ops = self._rows(self.desk, "SELECT rowid AS rid, text_content FROM pentimento_ops "
                                    "WHERE session_id=?", (s["id"],))
        data = json.loads(ops[0]["text_content"])
        data["prose_hash"] = value
        from test_multi_device_pentimento import _connect
        conn, cur = _connect(self.desk)
        cur.execute("UPDATE pentimento_ops SET text_content=? WHERE rowid=?",
                    (json.dumps(data), ops[0]["rid"]))
        conn.commit()
        conn.close()

    def test_a_record_that_lies_is_reported(self):
        self._restore()
        self._set_prose_hash("0" * 64)
        issues = self._chain_issues(self.desk)
        self.assertTrue(any("different text" in i for i in issues), issues)
        self.assertTrue(any("hash mismatch" in i for i in issues), issues)


if __name__ == "__main__":
    unittest.main()

import os
import sys
import json
import shutil
import tempfile
import unittest
import sqlite3

# Set environment variable for DEVICE_ID
os.environ["FLESHNOTE_DEVICE_ID"] = "test-device-default"

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_setup
import sync_core
from project_io import md_filename_ok, safe_md_path
from routes import sync


def _hlc(ms, ctr=0, device="device-b"):
    return f"{ms:013d}:{ctr:05d}:{device}"


class TestMdFilenameGuard(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="fn_sync_sec_guard_")
        self.md_dir = os.path.join(self.test_dir, "md")
        os.makedirs(self.md_dir, exist_ok=True)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_safe_names_pass(self):
        good = [
            "ch_001_the_arrival.md",
            "ch_002_A Arrival.MD",
            "ch_003_éèfrançaís.md",
            "uncon.md",
            "console.md",
            "a" * 190 + ".md",
        ]
        for name in good:
            self.assertTrue(md_filename_ok(name), name)

    def test_hostile_names_rejected(self):
        bad = [
            "../evil.md",
            "..\\evil.md",
            "sub/evil.md",
            "sub\\evil.md",
            "C:\\evil.md",
            "c:evil.md",
            "ads:evil.md",
            "evil.md ",
            "evil.md.",
            "CON .md",
            "con..md",
            "con.x.md",
            "..md",
            ".md",
            "CON.md",
            "nul.md",
            "aux.md",
            "com1.md",
            "lpt9.md",
            "",
            None,
            "no_suffix.txt",
            "no_suffix",
            "x.md\x00.png",
            "a" * 201 + ".md",
            "é" * 130 + ".md",   # >255 bytes once UTF-8 encoded (2 bytes/char)
            "star*.md",
            "q?.md",
        ]
        for name in bad:
            self.assertFalse(md_filename_ok(name), repr(name))

    def test_safe_md_path_containment(self):
        safe = safe_md_path(self.md_dir, "ch_001_ok.md")
        expected = os.path.realpath(os.path.join(self.md_dir, "ch_001_ok.md"))
        self.assertEqual(os.path.normcase(safe), os.path.normcase(expected))
        self.assertIsNone(safe_md_path(self.md_dir, "../evil.md"))
        self.assertIsNone(safe_md_path(self.md_dir, "sub\\evil.md"))
        self.assertIsNone(safe_md_path(self.md_dir, ""))
        self.assertIsNone(safe_md_path(self.md_dir, None))


class TestSyncSecurityBase(unittest.TestCase):
    """Two projects with the same project_id, seeded with hostile remote data."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="fn_sync_security_")
        self.project_a_path = os.path.join(self.test_dir, "project_a")
        self.project_b_path = os.path.join(self.test_dir, "project_b")
        os.makedirs(self.project_a_path, exist_ok=True)
        os.makedirs(self.project_b_path, exist_ok=True)
        os.makedirs(os.path.join(self.project_a_path, "md"), exist_ok=True)
        os.makedirs(os.path.join(self.project_b_path, "md"), exist_ok=True)

        self.project_id = "test-proj-uuid-sec"
        for p in [self.project_a_path, self.project_b_path]:
            db_setup.generate_project_db(p, {
                "project_name": "Test Project",
                "author_name": "Writer",
                "genre": "fantasy",
                "project_id": self.project_id,
            })
            with open(os.path.join(p, "fleshnote_project.json"), "w", encoding="utf-8") as f:
                json.dump({"project_id": self.project_id, "schema_version": 2}, f)

    def _conn(self, project):
        conn = sqlite3.connect(os.path.join(project, "fleshnote.db"))
        conn.row_factory = sqlite3.Row
        self.addCleanup(conn.close)
        return conn

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir, ignore_errors=True)


class TestHostileMdFilenameMerge(TestSyncSecurityBase):
    def test_hostile_change_rejected_and_row_never_poisoned(self):
        chap_id = "chap-sec-1"
        ca = self._conn(self.project_a_path)
        ca.execute(
            "INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) "
            "VALUES (?,?,?,?,0)",
            (chap_id, 91, "Local Title", "ch_001_local.md"))
        sync_core.DEVICE_ID = "device-a"
        sync_core.log_change(ca.cursor(), "chapters", chap_id, {"md_filename": "ch_001_local.md"})
        ca.commit()
        ca.close()

        cb = self._conn(self.project_b_path)
        cb.execute(
            "INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) "
            "VALUES (?,?,?,?,0)",
            (chap_id, 91, "Remote Title", "ch_001_remote.md"))
        sync_core.DEVICE_ID = "device-b"
        # hostile md_filename change with a newer HLC than local's
        cb.execute(
            "INSERT INTO change_log (table_name, row_id, column_name, value, hlc, device_id, origin) "
            "VALUES (?,?,?,?,?,?,?)",
            ("chapters", chap_id, "md_filename", "..\\..\\fleshnote.db",
             _hlc(2000000000000), "device-b", "desktop"))
        # prose change so a remote->local take is also planned
        cb.execute(
            "INSERT INTO change_log (table_name, row_id, column_name, value, hlc, device_id, origin) "
            "VALUES (?,?,?,?,?,?,?)",
            ("chapters", chap_id, "prose_hash", "ab" * 32, _hlc(2000000000001), "device-b", "desktop"))
        with open(os.path.join(self.project_b_path, "md", "ch_001_remote.md"), "w") as f:
            f.write("remote prose")
        cb.commit()
        cb.close()

        req = sync.SyncPreviewRequest(local_path=self.project_a_path,
                                      remote_path=self.project_b_path)
        res = sync.sync_preview(req)
        self.assertEqual(res["status"], "ok")
        md_changes = [c for c in res["entity_changes"]
                      if c["table"] == "chapters" and c["column"] == "md_filename"]
        self.assertEqual(md_changes, [])

        apply_req = sync.SyncApplyRequest(local_path=self.project_a_path,
                                          remote_path=self.project_b_path,
                                          resolutions={})
        res = sync.sync_apply(apply_req)
        self.assertEqual(res["status"], "ok")

        ca = self._conn(self.project_a_path)
        row = ca.execute("SELECT md_filename FROM chapters WHERE id=?", (chap_id,)).fetchone()
        ca.close()
        self.assertEqual(row["md_filename"], "ch_001_local.md")
        # nothing escaped md/
        outside = [n for n in os.listdir(self.project_a_path)
                   if n.endswith(".db") and n != "fleshnote.db"]
        self.assertEqual(outside, [])
        self.assertFalse(os.path.exists(os.path.join(self.test_dir, "fleshnote.db")))

    def test_hostile_insert_row_rejected(self):
        chap_id = "chap-sec-new"
        cb = self._conn(self.project_b_path)
        cb.execute(
            "INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) "
            "VALUES (?,?,?,?,0)",
            (chap_id, 2, "Planted Chapter", "..\\..\\evil.md"))
        sync_core.DEVICE_ID = "device-b"
        sync_core.log_change(cb.cursor(), "chapters", chap_id, {"title": "Planted Chapter"})
        cb.commit()
        cb.close()

        req = sync.SyncPreviewRequest(local_path=self.project_a_path,
                                      remote_path=self.project_b_path)
        res = sync.sync_preview(req)
        creates = [c for c in res["entity_changes"]
                   if c["table"] == "chapters" and c["row_id"] == chap_id]
        self.assertEqual(creates, [])

        apply_req = sync.SyncApplyRequest(local_path=self.project_a_path,
                                          remote_path=self.project_b_path,
                                          resolutions={})
        sync.sync_apply(apply_req)

        ca = self._conn(self.project_a_path)
        row = ca.execute("SELECT 1 FROM chapters WHERE id=?", (chap_id,)).fetchone()
        ca.close()
        self.assertIsNone(row)
        self.assertFalse(os.path.exists(os.path.join(self.test_dir, "evil.md")))
        self.assertFalse(os.path.exists(os.path.join(self.project_a_path, "evil.md")))

    def test_safe_md_filename_still_merges(self):
        chap_id = "chap-sec-2"
        ca = self._conn(self.project_a_path)
        ca.execute(
            "INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) "
            "VALUES (?,?,?,?,0)",
            (chap_id, 93, "Local Title", "ch_001_old.md"))
        ca.commit()
        ca.close()

        cb = self._conn(self.project_b_path)
        cb.execute(
            "INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) "
            "VALUES (?,?,?,?,0)",
            (chap_id, 93, "Local Title", "ch_001_newname.md"))
        sync_core.DEVICE_ID = "device-b"
        sync_core.log_change(cb.cursor(), "chapters", chap_id, {"md_filename": "ch_001_newname.md"})
        cb.commit()
        cb.close()

        apply_req = sync.SyncApplyRequest(local_path=self.project_a_path,
                                          remote_path=self.project_b_path,
                                          resolutions={})
        res = sync.sync_apply(apply_req)
        self.assertEqual(res["status"], "ok")
        ca = self._conn(self.project_a_path)
        row = ca.execute("SELECT md_filename FROM chapters WHERE id=?", (chap_id,)).fetchone()
        ca.close()
        self.assertEqual(row["md_filename"], "ch_001_newname.md")


class TestDeviceLocalDenyList(TestSyncSecurityBase):
    FORGED = [
        ("server_receipts", "receipt-1", "status", "anchored"),
        ("sync_meta", "1", "version_vector", '{"evil-device":"99999:00000:evil"}'),
        ("pentimento_sessions", "sess-1", "session_hash", "cd" * 32),
        ("pentimento_ops", "op-1", "text_content", "forged op"),
        ("chapter_snapshots", "snap-1", "prose_hash", "ef" * 32),
        ("change_log", "log-1", "value", "rewritten history"),
    ]

    def test_preview_shows_nothing_for_device_local_tables(self):
        cb = self._conn(self.project_b_path)
        for table, row_id, column, value in self.FORGED:
            cb.execute(
                "INSERT INTO change_log (table_name, row_id, column_name, value, hlc, device_id, origin) "
                "VALUES (?,?,?,?,?,?,?)",
                (table, row_id, column, value, _hlc(2000000000000), "device-b", "desktop"))
        cb.commit()
        cb.close()

        req = sync.SyncPreviewRequest(local_path=self.project_a_path,
                                      remote_path=self.project_b_path)
        res = sync.sync_preview(req)
        self.assertEqual(res["entity_changes"], [])

    def test_apply_leaves_device_local_state_untouched(self):
        from routes import pentimento
        ca = pentimento._get_db(self.project_a_path)   # also creates server_receipts
        ca.execute(
            "INSERT INTO server_receipts (id, kind, anchored_hash, client_time, status) "
            "VALUES ('receipt-1', 'seal', 'ab' * 32, '2026-09-24T00:00:00', 'pending')")
        local_vv_before = ca.execute(
            "SELECT version_vector FROM sync_meta WHERE id=1").fetchone()[0]
        local_log_count = ca.execute("SELECT COUNT(*) FROM change_log").fetchone()[0]
        ca.commit()
        ca.close()

        cb = self._conn(self.project_b_path)
        for table, row_id, column, value in self.FORGED:
            cb.execute(
                "INSERT INTO change_log (table_name, row_id, column_name, value, hlc, device_id, origin) "
                "VALUES (?,?,?,?,?,?,?)",
                (table, row_id, column, value, _hlc(2000000000000), "device-b", "desktop"))
        cb.commit()
        cb.close()

        apply_req = sync.SyncApplyRequest(local_path=self.project_a_path,
                                          remote_path=self.project_b_path,
                                          resolutions={})
        res = sync.sync_apply(apply_req)
        self.assertEqual(res["status"], "ok")

        ca = self._conn(self.project_a_path)
        receipt = ca.execute(
            "SELECT status FROM server_receipts WHERE id='receipt-1'").fetchone()
        self.assertEqual(receipt["status"], "pending")
        vv_after = ca.execute("SELECT version_vector FROM sync_meta WHERE id=1").fetchone()[0]
        self.assertEqual(json.loads(vv_after), json.loads(local_vv_before))
        log_count_after = ca.execute("SELECT COUNT(*) FROM change_log").fetchone()[0]
        forged_copied = ca.execute(
            "SELECT COUNT(*) FROM change_log WHERE table_name IN "
            "('server_receipts','sync_meta','pentimento_sessions','pentimento_ops',"
            "'chapter_snapshots','change_log')").fetchone()[0]
        ca.close()
        self.assertEqual(forged_copied, 0)


class TestSecurityWarningsAndRepair(TestSyncSecurityBase):
    def test_preview_reports_hostile_and_device_local_warnings(self):
        chap_id = "chap-warn-1"
        cb = self._conn(self.project_b_path)
        cb.execute(
            "INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) "
            "VALUES (?,?,?,?,0)",
            (chap_id, 95, "Warn Chapter", "..\\..\\evil.md"))
        cb.execute(
            "INSERT INTO change_log (table_name, row_id, column_name, value, hlc, device_id, origin) "
            "VALUES (?,?,?,?,?,?,?)",
            ("chapters", chap_id, "md_filename", "..\\..\\evil.md",
             _hlc(2000000000000), "device-b", "desktop"))
        cb.execute(
            "INSERT INTO change_log (table_name, row_id, column_name, value, hlc, device_id, origin) "
            "VALUES (?,?,?,?,?,?,?)",
            ("server_receipts", "r-1", "status", "anchored",
             _hlc(2000000000001), "device-b", "desktop"))
        cb.execute(
            "INSERT INTO project_config (config_key, config_value) VALUES "
            "('pentimento_tsa_url', 'https://attacker.example/tsa')")
        cb.execute(
            "INSERT INTO change_log (table_name, row_id, column_name, value, hlc, device_id, origin) "
            "VALUES (?,?,?,?,?,?,?)",
            ("project_config", "pentimento_tsa_url", "config_value",
             "https://attacker.example/tsa", _hlc(2000000000002), "device-b", "desktop"))
        cb.commit()
        cb.close()

        req = sync.SyncPreviewRequest(local_path=self.project_a_path,
                                      remote_path=self.project_b_path)
        res = sync.sync_preview(req)
        codes = {w["code"] for w in res["security_warnings"]}
        self.assertIn("hostile_md_filename", codes)
        self.assertIn("device_local_change", codes)
        self.assertIn("security_config_change", codes)
        # security-posture config keys must NOT appear as mergeable changes
        self.assertEqual([c for c in res["entity_changes"]
                          if c["table"] == "project_config"
                          and c["row_id"] == "pentimento_tsa_url"], [])

    def test_hostile_take_never_writes_outside_md(self):
        # chapter exists ONLY remotely, hostile md_filename in its row + prose
        chap_id = "chap-take-1"
        cb = self._conn(self.project_b_path)
        cb.execute(
            "INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) "
            "VALUES (?,?,?,?,0)",
            (chap_id, 96, "Remote Prose", "..\\..\\stolen.md"))
        cb.execute(
            "INSERT INTO change_log (table_name, row_id, column_name, value, hlc, device_id, origin) "
            "VALUES (?,?,?,?,?,?,?)",
            ("chapters", chap_id, "prose_hash", "ab" * 32,
             _hlc(2000000000000), "device-b", "desktop"))
        with open(os.path.join(self.project_b_path, "md", "ch_001_remote.md"), "w") as f:
            f.write("secret remote prose")
        cb.commit()
        cb.close()

        apply_req = sync.SyncApplyRequest(local_path=self.project_a_path,
                                          remote_path=self.project_b_path,
                                          resolutions={})
        res = sync.sync_apply(apply_req)
        self.assertEqual(res["status"], "ok")
        # nothing landed outside md/, and no hostile-named file exists at all
        # (walk only the local project + test root — project_b is the attacker)
        for root, _dirs, files in os.walk(self.project_a_path):
            self.assertNotIn("stolen.md", files)
            self.assertNotIn("ch_001_remote.md", files)
        self.assertNotIn("stolen.md", os.listdir(self.test_dir))

    def test_poisoned_local_row_repaired_on_apply(self):
        chap_id = "chap-fix-1"
        ca = self._conn(self.project_a_path)
        ca.execute(
            "INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) "
            "VALUES (?,?,?,?,0)",
            (chap_id, 97, "Broken", "..\\..\\evil.md"))
        ca.commit()
        ca.close()

        # unrelated remote change so apply has something to do
        cb = self._conn(self.project_b_path)
        cb.execute(
            "INSERT INTO chapters (id, chapter_number, title, md_filename, deleted) "
            "VALUES ('chap-other-1', 98, 'Other', 'ch_098_other.md', 0)")
        sync_core.DEVICE_ID = "device-b"
        sync_core.log_change(cb.cursor(), "chapters", "chap-other-1",
                             {"title": "Other", "md_filename": "ch_098_other.md"})
        cb.commit()
        cb.close()

        apply_req = sync.SyncApplyRequest(local_path=self.project_a_path,
                                          remote_path=self.project_b_path,
                                          resolutions={})
        res = sync.sync_apply(apply_req)
        self.assertEqual(res["status"], "ok")

        ca = self._conn(self.project_a_path)
        row = ca.execute("SELECT md_filename FROM chapters WHERE id=?", (chap_id,)).fetchone()
        log_row = ca.execute(
            "SELECT value FROM change_log WHERE table_name='chapters' AND row_id=? "
            "AND column_name='md_filename' ORDER BY hlc DESC LIMIT 1", (chap_id,)).fetchone()
        ca.close()
        self.assertTrue(row["md_filename"].startswith("ch_097_repaired_"),
                        row["md_filename"])
        self.assertTrue(md_filename_ok(row["md_filename"]))
        self.assertEqual(log_row["value"], row["md_filename"])
        self.assertFalse(os.path.exists(os.path.join(self.test_dir, "evil.md")))


    def test_symlink_asset_never_copied(self):
        # A hostile remote assets/ symlink must not be dereferenced into the
        # local project. Windows needs admin/developer-mode for symlinks —
        # skip when the sandbox can't create one.
        secret = os.path.join(self.test_dir, "secret.txt")
        with open(secret, "w") as f:
            f.write("top secret")
        link = os.path.join(self.project_b_path, "assets_staging")
        os.makedirs(os.path.join(self.project_b_path, "assets"), exist_ok=True)
        link_path = os.path.join(self.project_b_path, "assets", "leak.png")
        try:
            os.symlink(secret, link_path)
        except (OSError, NotImplementedError):
            self.skipTest("symlink creation not permitted on this host")
        self.assertTrue(os.path.islink(link_path))

        apply_req = sync.SyncApplyRequest(local_path=self.project_a_path,
                                          remote_path=self.project_b_path,
                                          resolutions={})
        res = sync.sync_apply(apply_req)
        self.assertEqual(res["status"], "ok")
        self.assertFalse(os.path.exists(
            os.path.join(self.project_a_path, "assets", "leak.png")))


if __name__ == "__main__":
    unittest.main()

"""Reviewer working copies (start / save / finish) and importing returned
reviews into the author's project (anchoring, re-import, scores, sync log)."""
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import HTTPException

import db_setup
from routes.review_export import (
    DiscardReviewRequest,
    ExportReviewRequest,
    FinishReviewRequest,
    ReviewScope,
    SaveReviewRequest,
    StartReviewRequest,
    StoreRequest,
    discard_review,
    export_review,
    finish_review,
    list_reviews,
    load_package,
    save_package,
    save_review,
    start_review,
)
from routes.review_notes import (
    ImportReviewsRequest,
    NoteStatusRequest,
    ProjectRequest,
    ReceivedReviewRequest,
    delete_received_review,
    editor_plain_text,
    import_reviews,
    list_review_notes,
    set_note_status,
)

CHAPTER = "Hello {{char:char-1|Sophia}} walked in.\n\nThe night was cold and the wind howled."


class ReviewFlowBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fn_review_notes_")
        self.project = os.path.join(self.tmp, "proj")
        self.store = os.path.join(self.tmp, "store")
        os.makedirs(os.path.join(self.project, "md"))
        db_setup.generate_project_db(self.project, {
            "project_name": "Review Test", "author_name": "Writer",
            "genre": "fantasy", "project_id": "desktop-id-1",
        })
        with open(os.path.join(self.project, "fleshnote_project.json"), "w", encoding="utf-8") as f:
            json.dump({"project_id": "desktop-id-1", "project_name": "Review Test", "schema_version": 2}, f)
        self.write_chapter(CHAPTER)
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        conn.execute("DELETE FROM chapters")
        conn.execute("INSERT INTO chapters (id, chapter_number, title, md_filename, word_count, deleted) "
                     "VALUES ('ch-1', 1, 'Arrival', 'ch_001.md', 12, 0)")
        conn.execute("INSERT INTO chapters (id, chapter_number, title, md_filename, word_count, deleted) "
                     "VALUES ('ch-2', 2, 'Later', 'ch_002.md', 3, 0)")
        conn.commit()
        conn.close()
        with open(os.path.join(self.project, "md", "ch_002.md"), "w", encoding="utf-8") as f:
            f.write("Second chapter text.")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write_chapter(self, text):
        with open(os.path.join(self.project, "md", "ch_001.md"), "w", encoding="utf-8") as f:
            f.write(text)

    def export(self, entities=True, name="sent.flreview"):
        dest = os.path.join(self.tmp, name)
        export_review(ExportReviewRequest(project_path=self.project, dest_path=dest,
                                          scope=ReviewScope(entities=entities), author_label="Writer",
                                          message="Is the opening too slow?"))
        return dest

    def review(self, sent, notes, label="Beta", scores=None):
        """What a reviewer does: open the file, leave notes, send a copy back."""
        res = start_review(StartReviewRequest(path=sent, store_dir=self.store))
        pkg = dict(res["package"], reviewer_label=label, notes=notes, scores=scores or [])
        save_review(SaveReviewRequest(path=res["path"], package=pkg, store_dir=self.store))
        back = os.path.join(self.tmp, "back-%s.flreview" % label)
        finish_review(FinishReviewRequest(path=res["path"], dest_path=back, store_dir=self.store))
        return back

    def note(self, sent, quote, nid="n1", category="comment", body="Nice line"):
        text = load_package(sent)["snapshot"]["chapters"][0]["text_md"]
        start = text.index(quote)
        return {"id": nid, "chapter_id": "ch-1", "category": category, "body": body,
                "anchor_start": start, "anchor_end": start + len(quote), "anchor_quote": quote}

    def notes(self):
        return list_review_notes(ProjectRequest(project_path=self.project))


class TestReviewerWorkingCopy(ReviewFlowBase):
    def test_export_carries_round_and_message(self):
        pkg = load_package(self.export())
        self.assertTrue(pkg["review_id"])
        self.assertEqual(pkg["message"], "Is the opening too slow?")
        self.assertEqual(pkg["author_label"], "Writer")

    def test_start_copies_and_resumes(self):
        sent = self.export()
        first = start_review(StartReviewRequest(path=sent, store_dir=self.store))
        self.assertEqual(os.path.dirname(first["path"]), os.path.realpath(self.store))
        self.assertFalse(first["resumed"])
        self.assertTrue(first["package"]["copy_id"])
        again = start_review(StartReviewRequest(path=sent, store_dir=self.store))
        self.assertTrue(again["resumed"])
        self.assertEqual(again["path"], first["path"])
        listed = list_reviews(StoreRequest(store_dir=self.store))["reviews"]
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["title"], "Review Test")

    def test_save_cleans_notes_and_keeps_snapshot(self):
        sent = self.export()
        res = start_review(StartReviewRequest(path=sent, store_dir=self.store))
        evil = dict(res["package"])
        evil["snapshot"] = {"chapters": []}
        evil["notes"] = [
            {"id": "a", "chapter_id": "ch-1", "category": "typo", "body": "x" * 9000,
             "anchor_start": 0, "anchor_end": 5, "anchor_quote": "Hello", "extra": "<script>"},
            {"id": "b", "chapter_id": "ch-1", "category": "nonsense", "body": "dropped"},
            "not a note",
        ]
        evil["scores"] = [{"chapter_id": "ch-1", "prose": 9, "plot": 4}]
        save_review(SaveReviewRequest(path=res["path"], package=evil, store_dir=self.store))
        saved = load_package(res["path"])
        self.assertEqual([n["id"] for n in saved["notes"]], ["a"])
        self.assertNotIn("extra", saved["notes"][0])
        self.assertEqual(len(saved["notes"][0]["body"]), 4000)
        self.assertEqual(saved["scores"], [{"chapter_id": "ch-1", "plot": 4}])
        self.assertEqual(len(saved["snapshot"]["chapters"]), 2)

    def test_save_outside_store_refused(self):
        sent = self.export()
        with self.assertRaises(HTTPException):
            save_review(SaveReviewRequest(path=sent, package={}, store_dir=self.store))
        with self.assertRaises(HTTPException):
            discard_review(DiscardReviewRequest(path=sent, store_dir=self.store))
        self.assertTrue(os.path.exists(sent))

    def test_finish_writes_copy_for_author(self):
        sent = self.export()
        back = self.review(sent, [self.note(sent, "walked in")])
        pkg = load_package(back)
        self.assertTrue(pkg["finished_at"])
        self.assertEqual(len(pkg["notes"]), 1)
        self.assertEqual(pkg["reviewer_label"], "Beta")

    def test_not_a_review_file(self):
        bad = os.path.join(self.tmp, "bad.flreview")
        with open(bad, "w", encoding="utf-8") as f:
            f.write("{not json")
        with self.assertRaises(HTTPException):
            start_review(StartReviewRequest(path=bad, store_dir=self.store))


class TestImportIntoProject(ReviewFlowBase):
    def test_plain_text_matches_editor(self):
        self.assertEqual(editor_plain_text(CHAPTER),
                         "Hello Sophia walked in.The night was cold and the wind howled.")

    def test_import_anchors_after_author_edits(self):
        # sent without entities: the reviewer's text has no {{char:…}} markers
        sent = self.export(entities=False)
        back = self.review(sent, [self.note(sent, "Sophia walked in")])
        self.write_chapter("A new opening line. " + CHAPTER)
        res = import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[back]))
        r = res["results"][0]
        self.assertEqual((r["status"], r["added"], r["unanchored"]), ("ok", 1, 0))
        note = self.notes()["notes"][0]
        self.assertEqual(note["anchored"], 1)
        self.assertEqual(note["anchor_text"], "Sophia walked in")
        plain = editor_plain_text("A new opening line. " + CHAPTER)
        self.assertEqual(note["anchor_hint"], plain.index("Sophia walked in"))
        self.assertEqual(note["status"], "open")

    def test_rewritten_passage_still_imported(self):
        sent = self.export()
        back = self.review(sent, [self.note(sent, "The night was cold and the wind howled.")])
        self.write_chapter("Hello {{char:char-1|Sophia}} walked in.\n\nMorning came, bright and still.")
        r = import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[back]))["results"][0]
        self.assertEqual((r["added"], r["unanchored"]), (1, 1))
        note = self.notes()["notes"][0]
        self.assertEqual(note["anchored"], 0)
        self.assertEqual(note["quote_text"], "The night was cold and the wind howled.")

    def test_reimport_keeps_author_status(self):
        sent = self.export()
        back = self.review(sent, [self.note(sent, "walked in")])
        import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[back]))
        nid = self.notes()["notes"][0]["id"]
        set_note_status(NoteStatusRequest(project_path=self.project, id=nid, status="resolved"))
        pkg = load_package(back)
        pkg["notes"][0]["body"] = "Edited by the reviewer"
        save_package(back, pkg)
        r = import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[back]))["results"][0]
        self.assertEqual((r["added"], r["updated"]), (0, 1))
        note = self.notes()["notes"][0]
        self.assertEqual(note["status"], "resolved")
        self.assertEqual(note["body"], "Edited by the reviewer")

    def test_two_reviewers_same_file(self):
        sent = self.export()
        a = self.review(sent, [self.note(sent, "walked in")], "Ann", [{"chapter_id": "ch-1", "prose": 5}])
        # the second reviewer works on their own machine: a separate store
        self.store = os.path.join(self.tmp, "store2")
        b = self.review(sent, [self.note(sent, "walked in")], "Bob", [{"chapter_id": "ch-1", "prose": 2}])
        import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[a, b]))
        data = self.notes()
        self.assertEqual(len(data["reviews"]), 2)
        self.assertEqual(len(data["notes"]), 2)
        prose = sorted(r["scores"][0]["prose"] for r in data["reviews"])
        self.assertEqual(prose, [2, 5])

    def test_wrong_project_refused(self):
        sent = self.export()
        back = self.review(sent, [self.note(sent, "walked in")])
        pkg = load_package(back)
        pkg["snapshot"]["project"]["desktop_id"] = "someone-else"
        save_package(back, pkg)
        r = import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[back]))["results"][0]
        self.assertEqual((r["status"], r["error"]), ("error", "wrong_project"))
        self.assertEqual(self.notes()["notes"], [])

    def test_deleted_chapter_skipped(self):
        sent = self.export()
        back = self.review(sent, [self.note(sent, "walked in")])
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        conn.execute("UPDATE chapters SET deleted = 1 WHERE id = 'ch-1'")
        conn.commit()
        conn.close()
        r = import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[back]))["results"][0]
        self.assertEqual((r["added"], r["skipped"]), (0, 1))

    def test_delete_review_and_sync_log(self):
        sent = self.export()
        back = self.review(sent, [self.note(sent, "walked in")])
        rid = import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[back]))["results"][0]["id"]
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        logged = {r[0] for r in conn.execute("SELECT DISTINCT table_name FROM change_log")}
        conn.close()
        self.assertTrue({"received_reviews", "review_notes"} <= logged)
        delete_received_review(ReceivedReviewRequest(project_path=self.project, id=rid))
        data = self.notes()
        self.assertEqual((data["reviews"], data["notes"]), ([], []))
        # importing the same file again brings it back
        import_reviews(ImportReviewsRequest(project_path=self.project, package_paths=[back]))
        self.assertEqual(len(self.notes()["notes"]), 1)


class TestSyncTables(unittest.TestCase):
    def test_merge_creates_review_tables(self):
        from routes.sync import _ensure_newer_tables
        conn = sqlite3.connect(":memory:")
        _ensure_newer_tables(conn.cursor())
        names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertTrue({"received_reviews", "review_notes"} <= names)


if __name__ == "__main__":
    unittest.main()

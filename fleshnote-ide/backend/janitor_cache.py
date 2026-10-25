"""
FleshNote — local analysis cache (fleshnote_cache.db).

A second SQLite file next to fleshnote.db for data that is derived, local and
disposable: per-paragraph Janitor results today, per-paragraph intensity scores
(Story Pulse) later. It is never synced, never exported (.flnote archives list
their files explicitly, see project_io._zip_walk_files) and can be deleted at
any time — everything in it is rebuilt on demand.

Paragraph results are keyed by (language, engine fingerprint, paragraph hash),
so a paragraph is only re-parsed when its text, the lexicon, the rules or the
spaCy model change. Every failure degrades to "no cache": the Janitor must
never break because of this file.
"""

import json
import os
import sqlite3
import time

CACHE_FILENAME = "fleshnote_cache.db"
SCHEMA_VERSION = 1
UNUSED_ROW_MAX_AGE = 90 * 24 * 3600  # paragraphs not seen for 90 days are dropped

_SCHEMA = """
CREATE TABLE IF NOT EXISTS paragraph_results (
    lang        TEXT NOT NULL,
    engine      TEXT NOT NULL,
    para_hash   TEXT NOT NULL,
    result_json TEXT NOT NULL,
    used_at     INTEGER NOT NULL,
    PRIMARY KEY (lang, engine, para_hash)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS chapter_state (
    chapter_id  TEXT PRIMARY KEY,
    hashes_json TEXT NOT NULL,
    edited_json TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);
"""


class AnalysisCache:
    """Open with `AnalysisCache(project_path)`; check `.ok` or just call the
    methods — they return empty results when the cache is unavailable."""

    def __init__(self, project_path: str):
        self.conn = None
        try:
            if not os.path.isdir(project_path):
                return
            conn = sqlite3.connect(os.path.join(project_path, CACHE_FILENAME), timeout=5)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=5000")
            if conn.execute("PRAGMA user_version").fetchone()[0] != SCHEMA_VERSION:
                conn.executescript("DROP TABLE IF EXISTS paragraph_results;"
                                   "DROP TABLE IF EXISTS chapter_state;")
                conn.executescript(_SCHEMA)
                conn.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
                conn.commit()
            conn.execute("DELETE FROM paragraph_results WHERE used_at < ?",
                         (int(time.time()) - UNUSED_ROW_MAX_AGE,))
            conn.commit()
            self.conn = conn
        except (sqlite3.Error, OSError) as exc:
            print(f"[janitor cache] disabled: {exc}", flush=True)
            self.conn = None

    @property
    def ok(self) -> bool:
        return self.conn is not None

    def get_results(self, lang: str, engine: str, hashes: list[str]) -> dict[str, dict]:
        if not self.conn or not hashes:
            return {}
        found: dict[str, dict] = {}
        try:
            unique = list(dict.fromkeys(hashes))
            for i in range(0, len(unique), 500):
                chunk = unique[i:i + 500]
                marks = ",".join("?" * len(chunk))
                rows = self.conn.execute(
                    f"SELECT para_hash, result_json FROM paragraph_results "
                    f"WHERE lang = ? AND engine = ? AND para_hash IN ({marks})",
                    (lang, engine, *chunk)).fetchall()
                for para_hash, result_json in rows:
                    found[para_hash] = json.loads(result_json)
            if found:
                now = int(time.time())
                self.conn.executemany(
                    "UPDATE paragraph_results SET used_at = ? WHERE lang = ? AND engine = ? AND para_hash = ?",
                    [(now, lang, engine, h) for h in found])
                self.conn.commit()
        except (sqlite3.Error, ValueError) as exc:
            print(f"[janitor cache] read failed: {exc}", flush=True)
            return {}
        return found

    def put_results(self, lang: str, engine: str, results: dict[str, dict]) -> None:
        if not self.conn or not results:
            return
        try:
            now = int(time.time())
            self.conn.executemany(
                "INSERT OR REPLACE INTO paragraph_results VALUES (?, ?, ?, ?, ?)",
                [(lang, engine, h, json.dumps(r, ensure_ascii=False), now) for h, r in results.items()])
            self.conn.commit()
        except sqlite3.Error as exc:
            print(f"[janitor cache] write failed: {exc}", flush=True)

    def chapter_state(self, chapter_id) -> tuple[list[str], dict[str, float]] | None:
        """(paragraph hashes seen last run, {hash: time it was last new/edited})."""
        if not self.conn:
            return None
        try:
            row = self.conn.execute(
                "SELECT hashes_json, edited_json FROM chapter_state WHERE chapter_id = ?",
                (str(chapter_id),)).fetchone()
            return (json.loads(row[0]), json.loads(row[1])) if row else None
        except (sqlite3.Error, ValueError):
            return None

    def save_chapter_state(self, chapter_id, hashes: list[str], edited: dict[str, float]) -> None:
        if not self.conn:
            return
        try:
            self.conn.execute(
                "INSERT OR REPLACE INTO chapter_state VALUES (?, ?, ?, ?)",
                (str(chapter_id), json.dumps(hashes), json.dumps(edited), int(time.time())))
            self.conn.commit()
        except sqlite3.Error as exc:
            print(f"[janitor cache] state write failed: {exc}", flush=True)

    def close(self) -> None:
        if self.conn:
            try:
                self.conn.close()
            except sqlite3.Error:
                pass
            self.conn = None

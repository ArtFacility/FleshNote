"""
FleshNote API — Spell Check Routes
phunspell (Hunspell)-based typo detection and correction suggestions.
Supports en_US, ar, hu_HU, pl_PL and 50+ other locales.
"""
import json
import sqlite3
import os
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

LANG_MAP = {
    "en": "en_US",
    "ar": "ar",
    "hu": "hu_HU",
    "pl": "pl_PL",
}


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _get_story_language(conn) -> str:
    row = conn.execute(
        "SELECT config_value FROM project_config WHERE config_key = 'story_language'"
    ).fetchone()
    return row["config_value"] if row else "en"


def _get_ignore_list(conn) -> set:
    row = conn.execute(
        "SELECT config_value FROM project_config WHERE config_key = 'spellcheck_ignore_list'"
    ).fetchone()
    if not row:
        return set()
    try:
        return set(json.loads(row["config_value"]))
    except Exception:
        return set()


def _get_entity_names(conn) -> set:
    names = set()
    for table, col in [("characters", "name"), ("locations", "name"), ("entities", "name")]:
        try:
            rows = conn.execute(f"SELECT {col} FROM {table}").fetchall()
            for r in rows:
                if r[0]:
                    names.add(r[0].lower())
                    names.add(r[0].lower().replace(" ", "_"))
            # Also get aliases
            alias_rows = conn.execute(f"SELECT aliases FROM {table} WHERE aliases IS NOT NULL AND aliases != ''").fetchall()
            for r in alias_rows:
                try:
                    aliases = json.loads(r[0])
                    for a in aliases:
                        if a:
                            names.add(a.lower())
                except Exception:
                    pass
        except Exception:
            pass
    return names


class SpellCheckRequest(BaseModel):
    project_path: str
    word: str


class AddIgnoreRequest(BaseModel):
    project_path: str
    word: str


@router.post("/api/project/spellcheck")
def spell_check(req: SpellCheckRequest):
    """Check if a word is misspelled and return suggestions."""
    word = req.word.strip().lower()
    if not word or len(word) < 2:
        return {"status": "ok", "is_correct": True, "suggestions": []}

    conn = _get_db(req.project_path)
    try:
        lang_code = _get_story_language(conn)
        ignore_list = _get_ignore_list(conn)
        entity_names = _get_entity_names(conn)
    finally:
        conn.close()

    # If word is in entity names or ignore list, it's "correct"
    if word in ignore_list or word in entity_names:
        return {"status": "ok", "is_correct": True, "suggestions": []}

    sc_lang = LANG_MAP.get(lang_code)
    if not sc_lang:
        # Language not in LANG_MAP — no suggestions
        return {"status": "ok", "is_correct": True, "suggestions": []}

    try:
        import phunspell
        spell = phunspell.Phunspell(sc_lang)
        if spell.lookup(word):
            return {"status": "ok", "is_correct": True, "suggestions": []}

        suggestions = [s for s in spell.suggest(word) if s.lower() != word][:6]
        return {"status": "ok", "is_correct": False, "suggestions": suggestions}
    except Exception as e:
        return {"status": "ok", "is_correct": True, "suggestions": [], "error": str(e)}


@router.post("/api/project/spellcheck/ignore")
def add_to_ignore_list(req: AddIgnoreRequest):
    """Add a word to the project's spellcheck ignore list."""
    word = req.word.strip().lower()
    if not word:
        return {"status": "ok"}

    conn = _get_db(req.project_path)
    try:
        ignore_list = _get_ignore_list(conn)
        ignore_list.add(word)
        value = json.dumps(list(ignore_list))
        conn.execute(
            """INSERT INTO project_config (config_key, config_value, config_type)
               VALUES ('spellcheck_ignore_list', ?, 'json')
               ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value""",
            (value,)
        )
        conn.commit()
        return {"status": "ok", "ignore_list": list(ignore_list)}
    finally:
        conn.close()

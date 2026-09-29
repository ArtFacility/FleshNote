"""
FleshNote — Janitor lexicon engine.

Loads the base word library shipped in backend/lexicons/{lang}/{kind}.json
(schema: docs/JANITOR_LEXICON_AND_INTENSITY_PLAN.md §1.2) and serves it to the
language analyzers in routes/janitor.py, hun_janitor.py and pol_janitor.py.

Entries whose `source` starts with "migrated:" are the word lists the analyzers
used before the lexicon existed. `legacy_only=True` returns exactly those, so
swapping the hard-coded sets for the JSON changes no Janitor output
(test_lexicon_engine.py pins them). Widening a list to its full kind is a
behavior change and is done kind by kind with benchmark numbers.
"""

import json
import threading
from pathlib import Path

LEXICONS_DIR = Path(__file__).parent / "lexicons"

LEGACY_SOURCE_PREFIX = "migrated:"

KINDS = frozenset({
    "emotion_label", "emotion_noun", "emotion_verb", "telling_cue", "emotion_adverb",
    "realize_verb", "filter_verb",
    "action_violent", "danger_noun", "stakes_word", "calm_word", "conflict_speech",
    "intensifier", "diminisher", "negator", "hedge",
    "sensory", "idiom",
})


class LexiconError(RuntimeError):
    """The lexicon files are missing or malformed.

    Raised instead of returning empty word lists: an empty lexicon would make the
    Janitor silently stop flagging, which no user would ever notice or report.
    """


class Lexicon:
    """All base entries for one language, indexed by kind and by id."""

    def __init__(self, lang: str, by_kind: dict[str, tuple[dict, ...]]):
        self.lang = lang
        self._by_kind = by_kind
        self._by_id = {e["id"]: e for entries in by_kind.values() for e in entries}
        self._lemma_cache: dict[tuple, frozenset[str]] = {}

    def entries(self, kind: str) -> tuple[dict, ...]:
        if kind not in KINDS:
            raise KeyError(f"unknown lexicon kind: {kind}")
        return self._by_kind.get(kind, ())

    def get(self, entry_id: str) -> dict | None:
        return self._by_id.get(entry_id)

    def lemmas(self, kind: str, *, legacy_only: bool = False,
               strength: str | None = None, **fields) -> frozenset[str]:
        """Primary lemmas of the single-word entries of `kind`.

        `strength` ("strong"/"weak") keeps only entries of that strength; weak
        entries are words that are only evidence in the right company. Other
        keyword arguments keep entries whose field equals the value, e.g.
        felt="state" (a feeling, not a trait) or role="experiencer".

        Phrase entries are left out: the analyzers compare one token's lemma at a
        time, so a multi-word string could never match there anyway. `alt_lemmas`
        are left out too; they need a POS gate before they can be trusted.
        """
        key = (kind, legacy_only, strength, tuple(sorted(fields.items())))
        if key not in self._lemma_cache:
            self._lemma_cache[key] = frozenset(
                e["lemma"] for e in self.entries(kind)
                if "lemma" in e
                and (not legacy_only or e.get("source", "").startswith(LEGACY_SOURCE_PREFIX))
                and (strength is None or e.get("strength") == strength)
                and all(e.get(name) == value for name, value in fields.items())
            )
        return self._lemma_cache[key]


def _load_language(lang: str, base_dir: Path) -> Lexicon:
    lang_dir = base_dir / lang
    files = sorted(lang_dir.glob("*.json"))
    if not files:
        raise LexiconError(f"no lexicon files for '{lang}' in {lang_dir}")

    by_kind: dict[str, tuple[dict, ...]] = {}
    seen_ids: set[str] = set()
    for path in files:
        kind = path.stem
        if kind not in KINDS:
            raise LexiconError(f"{path.name}: unknown kind '{kind}'")
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise LexiconError(f"{path}: {exc}") from exc
        if data.get("lang") != lang or data.get("kind") != kind:
            raise LexiconError(f"{path.name}: header says {data.get('lang')}/{data.get('kind')}")

        entries = data.get("entries") or []
        for e in entries:
            eid = e.get("id")
            if not eid:
                raise LexiconError(f"{path.name}: entry without id: {e}")
            if eid in seen_ids:
                raise LexiconError(f"{path.name}: duplicate id {eid}")
            seen_ids.add(eid)
            if ("lemma" in e) == ("phrase" in e):
                raise LexiconError(f"{path.name}: {eid} needs exactly one of lemma/phrase")
            if e.get("kind", kind) != kind:
                raise LexiconError(f"{path.name}: {eid} has kind {e['kind']}")
        by_kind[kind] = tuple(entries)
    return Lexicon(lang, by_kind)


_cache: dict[str, Lexicon] = {}
_lock = threading.Lock()


def get_lexicon(lang: str, base_dir: Path | None = None) -> Lexicon:
    """Return the cached base lexicon for `lang`; raises LexiconError if it can't load."""
    if base_dir is not None:
        return _load_language(lang, Path(base_dir))
    with _lock:
        if lang not in _cache:
            _cache[lang] = _load_language(lang, LEXICONS_DIR)
        return _cache[lang]

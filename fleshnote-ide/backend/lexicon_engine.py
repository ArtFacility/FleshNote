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

import hashlib
import json
import re
import threading
from pathlib import Path

LEXICONS_DIR = Path(__file__).parent / "lexicons"

LEGACY_SOURCE_PREFIX = "migrated:"

KINDS = frozenset({
    "emotion_label", "emotion_noun", "emotion_verb", "telling_cue", "emotion_adverb",
    "realize_verb", "filter_verb",
    "action_violent", "action_urgent", "danger_noun", "stakes_word", "calm_word", "conflict_speech",
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

    def __init__(self, lang: str, by_kind: dict[str, tuple[dict, ...]], fingerprint: str = ""):
        self.lang = lang
        # Content hash of the language's JSON files; caches of analysis results
        # key on it so a lexicon edit invalidates them.
        self.fingerprint = fingerprint
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

    def idiom_matches(self, doc) -> list[tuple[dict, list[int]]]:
        """(idiom entry, token indices) for every idiom in a parsed doc.

        Idiom words are compared on lemma or lowercase form, one sentence at a
        time, allowing up to IDIOM_SLACK other tokens in between ('tore her hair
        out'). English keeps the phrase order; Hungarian and Polish word order is
        free ('a fától nem látja az erdőt'), so there any order inside the window
        counts. Hungarian articles in a phrase are ignored.

        Two checks keep look-alikes out: each word must have the part of speech
        it has in the entry's example (`phrase_pos`: 'stay in touch' is a noun,
        'in the dark she touched' a verb), and the words must hang together in
        the parse, all attached to one another or to one shared head ('krew
        spływała po zimnym kamieniu' is not 'zimna krew'; see _linked).

        Idioms never score on their own. Their tokens are figurative, so a
        sensory word inside one isn't sensory evidence ('hideg vérrel'), and an
        entry's `blocks` names further entries it cancels (used by intensity).
        """
        idioms = []
        for e in self.entries("idiom"):
            phrase = [w.lower() for w in e.get("phrase", [])]
            poses = e.get("phrase_pos") or [None] * len(phrase)
            keep = [k for k, w in enumerate(phrase) if not (self.lang == "hu" and w in _HU_ARTICLES)]
            if keep:
                idioms.append((e, [phrase[k] for k in keep], [poses[k] for k in keep]))
        ordered = self.lang == "en"
        found = []
        for sent in doc.sents:
            toks = [t for t in sent if not t.is_punct and not t.is_space]
            forms = [{t.lemma_.lower(), t.lower_} | _REFLEXIVE_FORMS.get(t.lower_, set()) for t in toks]
            for entry, words, poses in idioms:
                window = len(words) + IDIOM_SLACK
                for start, f in enumerate(forms):
                    if words[0] not in f and (ordered or not any(w in f for w in words)):
                        continue
                    hit = _match_window(words, forms[start:start + window], ordered)
                    if hit is None:
                        continue
                    matched = [toks[start + k] for k in hit]
                    # PROPN is no evidence either way: taggers give it to any
                    # capitalized sentence opener ('Hideg vérrel lőtt.')
                    if all(pos is None or t.pos_ == "PROPN" or _pos_class(t.pos_) == _pos_class(pos)
                           for t, pos in zip(matched, poses)) and _linked(matched):
                        found.append((entry, sorted(t.i for t in matched)))
                        break
        return found

    def matcher(self, kinds: tuple[str, ...]) -> "TokenMatcher":
        """A cached TokenMatcher over the single-word entries of `kinds`."""
        key = ("matcher", kinds)
        if key not in self._lemma_cache:
            self._lemma_cache[key] = TokenMatcher(self.lang, [e for k in kinds for e in self.entries(k)])
        return self._lemma_cache[key]


# Hungarian verb lemmas keep their preverb ('meglát', 'odanéz'); an entry verb
# is recognized with it stripped.
_HU_PREVERBS = tuple(sorted((
    "meg", "el", "fel", "föl", "le", "ki", "be", "rá", "oda", "ide", "vissza", "át", "szét",
    "össze", "körül", "hozzá", "utána", "végig", "alá", "bele", "fölé", "keresztül", "észre",
), key=len, reverse=True))

# The Polish model often gets lemmas wrong ('patrzył' → 'patrzyć', 'Dotknęła'
# left as is), so Polish words that match no lemma are compared by stem: the
# lemma without its infinitive or adjective ending. Stems shorter than this are
# too ambiguous ('ostr' would take 'ostrożnie').
_PL_STEM_RE = re.compile(r"(?:ieć|eć|ać|ić|yć|ąć|uć|ć|y|i)$")
_PL_MIN_STEM = 5


class TokenMatcher:
    """Finds the lexicon entries a parsed token stands for: by lemma, then with
    the Hungarian preverb stripped, by alt lemma, or by Polish stem. Entries
    with a `pos` list only match tokens of those parts of speech."""

    def __init__(self, lang: str, entries: list[dict]):
        self.lang = lang
        self.primary: dict[str, list] = {}
        self.alts: dict[str, list] = {}
        self.stems: dict[str, list] = {}
        for e in entries:
            if "lemma" not in e:
                continue
            lemma = e["lemma"].lower()
            self.primary.setdefault(lemma, []).append(e)
            for alt in e.get("alt_lemmas", []):
                self.alts.setdefault(alt.lower(), []).append(e)
            if lang == "pl":
                stem = _PL_STEM_RE.sub("", lemma)
                if len(stem) >= _PL_MIN_STEM:
                    self.stems.setdefault(stem[:_PL_MIN_STEM], []).append((stem, e))

    def match(self, tok) -> list[dict]:
        if tok.is_punct or tok.is_space:
            return []
        lemma = tok.lemma_.lower()
        found = list(self.primary.get(lemma, ()))
        if not found and self.lang == "hu" and tok.pos_ == "VERB":
            for pre in _HU_PREVERBS:
                if lemma.startswith(pre) and len(lemma) > len(pre) + 1:
                    found = list(self.primary.get(lemma[len(pre):], ()))
                    if found:
                        break
        if not found and tok.pos_ != "PROPN":
            found = list(self.alts.get(lemma, ())) or list(self.alts.get(tok.lower_, ()))
        if not found and self.stems and (tok.pos_ == "VERB" or lemma == tok.lower_):
            # Verbs, whose lemmas are the unreliable ones, and words left
            # unlemmatized. Compared on the lemma only: a wrong lemma still
            # starts with the stem, while other words' forms may too ('świecie',
            # the world; 'gorączka', fever, isn't 'gorący').
            found = [e for stem, e in self.stems.get(lemma[:_PL_MIN_STEM], ()) if lemma.startswith(stem)]
        return [e for e in found if not e.get("pos") or tok.pos_ in e["pos"]]


IDIOM_SLACK = 3
_HU_ARTICLES = {"a", "az", "egy"}
# 'beside oneself' is written with the actual pronoun
_REFLEXIVE_FORMS = {w: {"oneself"} for w in (
    "myself", "yourself", "himself", "herself", "itself", "ourselves", "yourselves", "themselves")}
_POS_CLASSES = {"AUX": "VERB", "PROPN": "NOUN"}


def _pos_class(pos: str) -> str:
    return _POS_CLASSES.get(pos, pos)


def _linked(tokens: list) -> bool:
    """True when the tokens form one piece of the parse: at most one head
    outside the set (the phrase's own attachment point, or a head all of them
    share). Three or more idiom words close together are telling enough to
    allow one parser slip ('tűzön vízen át' with 'tűzön' misattached)."""
    inside = {t.i for t in tokens}
    outside = {t.head.i for t in tokens if t.head.i not in inside}
    return len(outside) <= (1 if len(tokens) <= 2 else 2)


def _match_window(words: list[str], forms: list[set], ordered: bool) -> list[int] | None:
    """Positions in `forms` for each phrase word in phrase order, or None.
    `forms[0]` always takes part in the match."""
    used: list[int] = []
    pos = 0
    for w in words:
        candidates = range(pos, len(forms)) if ordered else range(len(forms))
        k = next((k for k in candidates if k not in used and w in forms[k]), None)
        if k is None:
            return None
        used.append(k)
        pos = k + 1
    return used if 0 in used else None


def _load_language(lang: str, base_dir: Path) -> Lexicon:
    lang_dir = base_dir / lang
    files = sorted(lang_dir.glob("*.json"))
    if not files:
        raise LexiconError(f"no lexicon files for '{lang}' in {lang_dir}")

    by_kind: dict[str, tuple[dict, ...]] = {}
    seen_ids: set[str] = set()
    digest = hashlib.sha1()
    for path in files:
        kind = path.stem
        if kind not in KINDS:
            raise LexiconError(f"{path.name}: unknown kind '{kind}'")
        try:
            raw = path.read_bytes()
            digest.update(path.name.encode() + b"\0" + raw)
            data = json.loads(raw.decode("utf-8"))
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
    return Lexicon(lang, by_kind, digest.hexdigest()[:16])


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

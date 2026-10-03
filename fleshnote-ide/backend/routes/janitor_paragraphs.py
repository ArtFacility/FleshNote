"""
FleshNote — paragraph-incremental Janitor analysis.

The editor's HTML is split into its blocks (paragraphs, headings, list items,
hard line breaks). Each block is analyzed on its own and the result cached in
fleshnote_cache.db under a hash of its text, so after an edit only the changed
paragraph goes through spaCy again. Every show-don't-tell, passive and
weak-adverb rule works inside a sentence, and a block boundary always ends a
sentence, so this gives the same flags as analyzing the chapter at once. The one
cross-paragraph check, pacing (three sentences in a row opening on the same
word), runs over the cached sentence openings of all blocks.

Offsets stay in the editor's coordinate: block texts concatenated with no
separator, as _html_to_plain produces and Editor.navigateToCharOffset expects.
"""

import bisect
import hashlib
import html as html_lib
import os
import re
import sys
import time

from janitor_cache import AnalysisCache

_BLOCK_END_RE = re.compile(r"</(p|h[1-6]|li|blockquote|pre|div)\s*>|<br\s*/?>", re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_TODO_RE = re.compile(r"#TODO[^​\n]*​?")

# Cards shown per kind — the Janitor surfaces a few at a time, nearest the
# writer's latest edits first.
CAPS = {"show_dont_tell": 5, "passive_voice": 3, "weak_adverbs": 5, "pacing": 2}
MAX_BLOCK_CHARS = 10000
CHAPTER_WIDE_TYPES = {"five_senses", "readability"}

_LANGS = ("en", "hu", "pl")


def split_blocks(html: str) -> list[tuple[int, str]]:
    """[(start offset in the plain text, block text)] for every non-empty block.
    #TODO markers are removed per block, as the Janitor never analyzes them."""
    return [(start, text) for start, text, _ in split_blocks_tagged(html)]


def split_blocks_tagged(html: str) -> list[tuple[int, str, str]]:
    """split_blocks with the closing tag of each block ('p', 'h2', 'li', 'br'
    for a hard line break, '' for trailing text), so headings can be told apart."""
    blocks, pos, offset = [], 0, 0
    bounds = [(m.end(), (m.group(1) or "br").lower()) for m in _BLOCK_END_RE.finditer(html)] + [(len(html), "")]
    for end, tag in bounds:
        chunk = html[pos:end]
        pos = end
        text = _TODO_RE.sub("", html_lib.unescape(_TAG_RE.sub("", chunk)))
        if text:
            blocks.append((offset, text, tag))
            offset += len(text)
    return blocks


def _analyzers(lang: str):
    """(show-don't-tell, passive, weak adverbs) for the language."""
    if lang == "hu":
        from routes import hun_janitor as H
        return H._analyze_show_dont_tell_hu, H._analyze_passive_voice_hu, H._analyze_weak_adverbs_hu
    if lang == "pl":
        from routes import pol_janitor as P
        return P._analyze_show_dont_tell_pl, P._analyze_passive_voice_pl, P._analyze_weak_adverbs_pl
    from routes import janitor as J
    return J._analyze_show_dont_tell, J._analyze_passive_voice, J._analyze_weak_adverbs


def _code_fingerprint() -> str:
    """Changes whenever the analysis code does: the Janitor sources in a dev
    checkout, the executable itself in a packaged build (a new release)."""
    if getattr(sys, "frozen", False):
        st = os.stat(sys.executable)
        return f"exe{st.st_size}.{int(st.st_mtime)}"
    here = os.path.dirname(os.path.abspath(__file__))
    backend = os.path.dirname(here)
    digest = hashlib.sha1()
    for path in (os.path.join(here, "janitor.py"), os.path.join(here, "hun_janitor.py"),
                 os.path.join(here, "pol_janitor.py"), os.path.join(here, "janitor_senses.py"),
                 os.path.abspath(__file__), os.path.join(backend, "intensity_engine.py"),
                 os.path.join(backend, "lexicon_engine.py"), os.path.join(backend, "nlp_manager.py")):
        try:
            with open(path, "rb") as f:
                digest.update(f.read())
        except OSError:
            pass
    return digest.hexdigest()[:12]


_engine_cache: dict[str, str] = {}


def engine_fingerprint(lang: str) -> str:
    """Cache key part that invalidates results when the code, the lexicon or
    the spaCy model changes."""
    if lang not in _engine_cache:
        from lexicon_engine import get_lexicon
        from nlp_manager import get_nlp
        meta = getattr(get_nlp(lang), "meta", {}) or {}
        raw = f"{_code_fingerprint()}|{get_lexicon(lang).fingerprint}|{meta.get('name')}-{meta.get('version')}"
        _engine_cache[lang] = hashlib.sha1(raw.encode()).hexdigest()[:16]
    return _engine_cache[lang]


def analyze_block(text: str, lang: str) -> dict:
    """Everything the chapter pass needs from one block, with block-relative
    offsets: all rule flags (with confidence, so the user's threshold can be
    applied later), sentence openings for pacing, named entities, sensory
    evidence, and the Story Pulse feature record (intensity_engine)."""
    from intensity_engine import paragraph_features
    from nlp_manager import parse_cached
    from routes.janitor_senses import sense_hits
    sdt, passive, adverbs = _analyzers(lang)
    text = text[:MAX_BLOCK_CHARS]
    flags = []
    for found in (sdt(text, lang, confidence_threshold=0.0, cap=999)
                  + passive(text, lang, cap=999) + adverbs(text, lang, cap=999)):
        flags.append({
            "type": found["type"],
            "entity_type": found.get("entity_type"),
            "start": found["char_offset"],
            "end": found["char_offset"] + len(found["matched_text"]),
            "confidence": found.get("confidence"),
            "replacement": found.get("replacement"),
        })
    doc = parse_cached(lang, text)
    openings = []
    for sent in doc.sents:
        first = next((t for t in sent if not t.is_punct and not t.is_space), None)
        if first is not None:
            openings.append([first.idx, first.text.lower(), first.idx + len(first.text)])
    ents = [[e.start_char, e.end_char, e.label_, e.text] for e in doc.ents]
    return {"flags": flags, "openings": openings, "ents": ents, "senses": sense_hits(doc, text, lang),
            "pulse": paragraph_features(doc, text, lang)}


def _hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:20]


class ChapterAnalysis:
    """Parse-based Janitor results for one chapter, with ordering and stable ids."""

    def __init__(self, project_path: str, chapter_id, html: str, lang: str):
        self.lang = lang
        self.blocks = split_blocks(html)
        self.plain_text = "".join(text for _, text in self.blocks)
        self.starts = [start for start, _ in self.blocks]
        self.hashes = [_hash(text) for _, text in self.blocks]
        # nth copy of the same text ('***' scene breaks, a repeated '“No.”')
        seen: dict[str, int] = {}
        self.occurrence = []
        for h in self.hashes:
            self.occurrence.append(seen.get(h, 0))
            seen[h] = seen.get(h, 0) + 1
        self.results: list[dict] = [{"flags": [], "openings": [], "ents": []} for _ in self.blocks]
        self.reanalyzed = 0
        self._priority = list(range(len(self.blocks)))
        if lang in _LANGS and self.blocks:
            # A missing or broken model must only cost the grammar-based cards;
            # typo, synonym and link suggestions still come through. Never start
            # a model download from here.
            from nlp_manager import check_model_exists
            try:
                if check_model_exists(lang):
                    self._run(project_path, chapter_id)
            except Exception as exc:
                print(f"[janitor] paragraph analysis skipped: {exc}", flush=True)
                self.results = [{"flags": [], "openings": [], "ents": []} for _ in self.blocks]
                self._priority = list(range(len(self.blocks)))

    def _run(self, project_path: str, chapter_id) -> None:
        cache = AnalysisCache(project_path)
        try:
            engine = engine_fingerprint(self.lang)
            cached = cache.get_results(self.lang, engine, self.hashes)
            fresh: dict[str, dict] = {}
            for i, (_, text) in enumerate(self.blocks):
                h = self.hashes[i]
                if h in cached:
                    self.results[i] = cached[h]
                elif h in fresh:
                    self.results[i] = fresh[h]
                elif not text.strip():
                    continue
                else:
                    fresh[h] = self.results[i] = analyze_block(text, self.lang)
            self.reanalyzed = len(fresh)
            cache.put_results(self.lang, engine, fresh)
            self._order_by_edits(cache, chapter_id)
        finally:
            cache.close()

    def _order_by_edits(self, cache: AnalysisCache, chapter_id) -> None:
        """Block order for the caps: most recently edited paragraphs first, then
        by distance from the latest edit. A block counts as edited when its hash
        wasn't in the chapter the previous run. First run: document order."""
        now = time.time()
        state = cache.chapter_state(chapter_id)
        edited: dict[str, float] = {}
        if state is not None:
            previous, edited_before = set(state[0]), state[1]
            for h in self.hashes:
                if h not in previous:
                    edited[h] = now
                elif h in edited_before:
                    edited[h] = edited_before[h]
        cache.save_chapter_state(chapter_id, self.hashes, edited)
        if not edited:
            return
        latest = max(range(len(self.blocks)), key=lambda i: edited.get(self.hashes[i], 0))
        self._priority = [0] * len(self.blocks)
        order = sorted(range(len(self.blocks)),
                       key=lambda i: (-edited.get(self.hashes[i], 0), abs(i - latest), i))
        for rank, i in enumerate(order):
            self._priority[i] = rank

    # ── assembly ────────────────────────────────────────────────────────────

    def block_of(self, offset: int) -> int:
        return max(0, bisect.bisect_right(self.starts, offset) - 1)

    def _ranked(self, items: list[dict]) -> list[dict]:
        return sorted(items, key=lambda s: (self._priority[self.block_of(s["char_offset"])], s["char_offset"]))

    def rule_suggestions(self, confidence_threshold: float) -> list[dict]:
        """Show-don't-tell, passive, weak adverbs and pacing, capped per kind."""
        by_type: dict[str, list[dict]] = {}
        for i, result in enumerate(self.results):
            base = self.starts[i]
            for f in result["flags"]:
                if f["type"] == "show_dont_tell" and (f.get("confidence") or 0) < confidence_threshold:
                    continue
                start, end = base + f["start"], base + f["end"]
                by_type.setdefault(f["type"], []).append({
                    "type": f["type"],
                    "entity_type": f.get("entity_type"),
                    "matched_text": self.plain_text[start:end],
                    "char_offset": start,
                    "replacement": f.get("replacement"),
                    **({"confidence": f["confidence"]} if f.get("confidence") is not None else {}),
                })
        by_type["pacing"] = self._pacing()
        out = []
        for stype, items in by_type.items():
            out += self._ranked(items)[:CAPS.get(stype, 5)]
        return out

    def senses_card(self) -> list[dict]:
        """The chapter-wide 'missing senses' card. Blocks without a parse (no
        model) are counted lexically, so a missing model can't fake an absence."""
        if self.lang not in _LANGS:
            return []
        from routes.janitor_senses import count_senses, five_senses_card
        return five_senses_card(count_senses(self.blocks, self.results, self.lang), self.plain_text)

    def _pacing(self) -> list[dict]:
        """Three sentences in a row that open on the same word, across blocks."""
        openings = [(self.starts[i] + o[0], o[1], self.starts[i] + o[2])
                    for i, r in enumerate(self.results) for o in r["openings"]]
        found, seen = [], set()
        for a, b, c in zip(openings, openings[1:], openings[2:]):
            if a[1] == b[1] == c[1] and a[0] not in seen:
                seen.add(a[0])
                start, end = a[0], min(c[2], a[0] + 250)
                found.append({
                    "type": "pacing",
                    "entity_type": f'"{a[1]}"',
                    "matched_text": self.plain_text[start:end],
                    "char_offset": start,
                    "replacement": None,
                })
        return found

    def entities(self) -> list[tuple[int, int, str, str]]:
        """Named entities in edit-priority order, absolute offsets."""
        ents = [(self.starts[i] + e[0], self.starts[i] + e[1], e[2], e[3])
                for i, r in enumerate(self.results) for e in r["ents"]]
        return sorted(ents, key=lambda e: (self._priority[self.block_of(e[0])], e[0]))

    def finish(self, suggestion: dict, make_id) -> dict:
        """Context from the suggestion's own paragraph, and an id anchored to that
        paragraph's text — dismissals survive edits elsewhere in the chapter."""
        if suggestion["type"] in CHAPTER_WIDE_TYPES:
            return suggestion  # about the whole chapter; keeps its own id
        offset = suggestion["char_offset"]
        matched = suggestion.get("matched_text") or ""
        window = 30 if suggestion["type"] == "pacing" else 100
        i = self.block_of(offset)
        if self.blocks:
            start, text = self.blocks[i]
            local = offset - start
            if local + len(matched) > len(text):  # spans blocks (pacing)
                start, text, local = 0, self.plain_text, offset
            cstart = max(0, local - window)
            cend = min(len(text), local + len(matched) + window)
            suggestion["context"] = text[cstart:cend]
            suggestion["context_highlight_start"] = local - cstart
            suggestion["context_highlight_end"] = local + len(matched) - cstart
            anchor = f"{self.hashes[i]}#{self.occurrence[i]}:{offset - self.starts[i]}"
        else:
            anchor = str(offset)
        suggestion["id"] = make_id(suggestion["type"], matched, anchor)
        return suggestion


class CachedBlockReader:
    """Per-block analysis results for whole chapters outside the editor (Stats →
    Senses, Story Pulse). Blocks the Janitor has already analyzed come from
    fleshnote_cache.db; the rest are analyzed — and cached, so the Janitor gets
    them for free — until `budget_s` runs out, then come back as None. Without
    a usable spaCy model every result is None."""

    def __init__(self, project_path: str, lang: str, budget_s: float, label: str = "janitor"):
        self.lang = lang
        self.label = label
        self.deadline = time.monotonic() + budget_s
        self.cache = None
        self.engine = None
        try:
            from nlp_manager import check_model_exists
            if lang in _LANGS and check_model_exists(lang):
                self.engine = engine_fingerprint(lang)
                self.cache = AnalysisCache(project_path)
        except Exception as exc:
            print(f"[{label}] reading without parses: {exc}", flush=True)
            self.engine = None

    def results(self, texts: list[str]) -> list[dict | None]:
        out: list[dict | None] = [None] * len(texts)
        if self.engine is None:
            return out
        hashes = [_hash(text) for text in texts]
        cached = self.cache.get_results(self.lang, self.engine, hashes)
        fresh: dict[str, dict] = {}
        for i, text in enumerate(texts):
            h = hashes[i]
            out[i] = cached.get(h) or fresh.get(h)
            if out[i] is None and text.strip() and time.monotonic() < self.deadline:
                try:
                    out[i] = fresh[h] = analyze_block(text, self.lang)
                except Exception as exc:
                    print(f"[{self.label}] parse skipped: {exc}", flush=True)
                    self.deadline = 0
        self.cache.put_results(self.lang, self.engine, fresh)
        return out

    def close(self) -> None:
        if self.cache is not None:
            self.cache.close()

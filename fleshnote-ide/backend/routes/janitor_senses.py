"""
FleshNote — sensory evidence for the Janitor's "missing senses" card and the
Stats → Senses overview (plan §4.4).

Words come from the lexicon's `sensory` kind. A strong entry ('crimson',
'creak', 'illat', 'szorstki') is evidence on its own. A weak entry is a
perception word that is often not about perceiving at all, so it only counts
in narration and in the right company:
  - as a noun ('the smell of tar', 'a look', 'a fény');
  - as a verb with a nominal object ('saw the ship', 'listened to the rain',
    'nézte a hajót', 'poczuła zapach'), and never with a clause ('I see what
    you mean', 'Látom, hogy…', 'widzę, że…').
Any sensory word inside an idiom is figurative and doesn't count ('hideg
vérrel', 'bite your tongue').

Evidence is computed per editor block alongside the other parse-based rules
and cached with them. A block with no parse (no spaCy model, a broken model)
falls back to the old lexical count, so the card never claims a sense is
missing only because the model is unavailable.
"""

import re

from routes.janitor import _in_speech, _make_id, _speech_spans

SENSES = ("sight", "sound", "smell", "touch", "taste")

# The names the card and the Stats tab have always shown per language.
SENSE_KEYS = {
    "en": {s: s for s in SENSES},
    "hu": {"sight": "látás", "sound": "hallás", "smell": "szaglás", "touch": "tapintás", "taste": "ízlelés"},
    "pl": {"sight": "wzrok", "sound": "słuch", "smell": "węch", "touch": "dotyk", "taste": "smak"},
}

# A clause or question word as the object means the verb is about knowing,
# not perceiving.
_NOT_OBJECTS = {
    "en": {"what", "which", "how", "who", "whom", "whether", "that", "why", "where", "this"},
    "hu": {"mi", "ami", "mit", "amit", "hogy", "ki", "aki", "kit", "akit", "ez", "az", "azt", "ezt"},
    "pl": {"co", "że", "czy", "jak", "kto", "kogo", "który", "to"},
}
_CLAUSE_DEPS = {"ccomp", "csubj"}
_OBJECT_DEPS = {"dobj", "obj", "obl", "pobj", "obl:arg", "iobj"}
_NOMINAL = {"NOUN", "PROPN", "PRON"}

def _candidates(tok, lang: str) -> list[dict]:
    """Sensory entries a token matches (lexicon_engine.TokenMatcher)."""
    from lexicon_engine import get_lexicon
    return get_lexicon(lang).matcher(("sensory",)).match(tok)


def _objects(tok, lang: str) -> list:
    """Nominal objects of a verb, or [] when it takes a clause instead."""
    not_objects = _NOT_OBJECTS.get(lang, set())
    if any(c.dep_ in _CLAUSE_DEPS for c in tok.children):
        return []
    found = []
    for c in tok.children:
        if c.dep_ == "prep":  # English 'looked at the sea', 'listened to the rain'
            found += [g for g in c.children
                      if g.dep_ == "pobj" and g.pos_ in _NOMINAL and g.lower_ not in not_objects]
        elif c.dep_ in _OBJECT_DEPS and c.pos_ in _NOMINAL and c.lower_ not in not_objects:
            found.append(c)
    return found


def _weak_counts(tok, sense: str, lang: str, speech: list[tuple[int, int]]) -> bool:
    if _in_speech(tok.idx, speech):
        return False
    if tok.pos_ == "NOUN":
        return True
    if tok.pos_ == "VERB":
        # 'poczuła zapach dymu' is smell, not touch: an object that is itself
        # evidence of another sense doesn't make the verb evidence of its own
        return any(not any(e["sense"] != sense for e in _candidates(obj, lang))
                   for obj in _objects(tok, lang))
    return False


def _describes_person(tok, lang: str) -> bool:
    """A touch or taste adjective describing a person is character, not
    sensation ('a cold man', 'gorący wielbiciel', 'byli sztywni')."""
    if lang == "pl":
        if "Hum" in tok.morph.get("Animacy"):
            return True
        if tok.dep_ == "amod":
            from routes.pol_janitor import _PERSON_NOUNS_FEM_NEUT_PL
            head = tok.head
            return "Hum" in head.morph.get("Animacy") or head.lemma_.lower() in _PERSON_NOUNS_FEM_NEUT_PL
        return False
    if lang == "en" and tok.dep_ == "amod" and tok.head.pos_ == "NOUN":
        from nltk_manager import check_wordnet_exists
        from routes.janitor import _is_animate_noun_en
        return check_wordnet_exists() and _is_animate_noun_en(tok.head.lemma_.lower(), persons_only=True)
    return False


def sense_hits(doc, text: str, lang: str) -> list[list]:
    """[sense, entry id, start, end] for every piece of sensory evidence in a
    parsed block (block-relative offsets)."""
    from lexicon_engine import get_lexicon
    speech = _speech_spans(text, dash_dialogue=lang in ("hu", "pl"))
    figurative = {i for _, idxs in get_lexicon(lang).idiom_matches(doc) for i in idxs}
    hits = []
    for tok in doc:
        # adverbs are manner, not perception ('gorąco kocha', 'stared coldly')
        if tok.is_punct or tok.is_space or tok.pos_ == "ADV" or tok.i in figurative:
            continue
        senses_seen = set()
        for e in _candidates(tok, lang):
            if e["sense"] in senses_seen:
                continue
            if e.get("strength") == "weak" and not _weak_counts(tok, e["sense"], lang, speech):
                continue
            if e["sense"] in ("touch", "taste") and tok.pos_ == "ADJ" and _describes_person(tok, lang):
                continue
            senses_seen.add(e["sense"])
            hits.append([e["sense"], e["id"], tok.idx, tok.idx + len(tok.text)])
    return hits


def lexical_counts(text: str, lang: str) -> dict[str, int]:
    """The pre-lexicon word/stem count, keyed like SENSE_KEYS: the fallback for
    text that has no parse."""
    if lang == "hu":
        from routes.hun_janitor import _count_senses_hu
        return _count_senses_hu(text)
    if lang == "pl":
        from routes.pol_janitor import _count_senses_pl
        return _count_senses_pl(text)
    from routes.janitor import EN_SENSES
    words = set(re.findall(r"\b[a-zA-Z]+\b", text.lower()))
    return {sense: len(words & lexicon) for sense, lexicon in EN_SENSES.items()}


def count_senses(blocks: list[tuple[int, str]], results: list[dict | None], lang: str) -> dict[str, int]:
    """Per-sense evidence count over a chapter's blocks, keyed like SENSE_KEYS.
    Blocks whose result has no "senses" (not parsed) use the lexical count."""
    keys = SENSE_KEYS[lang]
    counts = {keys[s]: 0 for s in SENSES}
    for (_, text), result in zip(blocks, results):
        if result is not None and "senses" in result:
            for hit in result["senses"]:
                counts[keys[hit[0]]] += 1
        elif text.strip():
            for key, n in lexical_counts(text, lang).items():
                counts[key] += n
    return counts


def five_senses_card(counts: dict[str, int], plain_text: str) -> list[dict]:
    """The chapter-wide card naming the senses with no evidence at all."""
    missing = [key for key, n in counts.items() if n == 0]
    if not missing:
        return []
    label = ", ".join(missing)
    return [{
        "id": _make_id("five_senses", label, 0),
        "type": "five_senses",
        "entity_type": label,
        "entity_id": None,
        "entity_name": None,
        "matched_text": label,
        "context": plain_text[:120].strip(),
        "context_highlight_start": 0,
        "context_highlight_end": 0,
        "char_offset": 0,
        "replacement": None,
    }]


# Seconds the Stats overview may spend parsing paragraphs the Janitor hasn't seen.
OVERVIEW_BUDGET_S = 2.0


class OverviewCounter:
    """Sense counts for many chapters (Stats → Senses) from the paragraph cache
    (janitor_paragraphs.CachedBlockReader). Blocks left unparsed when the budget
    runs out get the lexical count, so a big cold project still answers
    promptly and improves each time the tab is opened."""

    def __init__(self, project_path: str, lang: str):
        from routes.janitor_paragraphs import CachedBlockReader
        self.lang = lang
        self.reader = CachedBlockReader(project_path, lang, OVERVIEW_BUDGET_S, label="senses")

    def count(self, html: str) -> tuple[dict[str, int], int, int]:
        """(counts, blocks with parse evidence, all blocks) for one chapter."""
        from routes.janitor_paragraphs import split_blocks
        blocks = split_blocks(html)
        results = self.reader.results([text for _, text in blocks])
        parsed = sum(1 for r in results if r is not None and "senses" in r)
        return count_senses(blocks, results, self.lang), parsed, len(blocks)

    def close(self) -> None:
        self.reader.close()

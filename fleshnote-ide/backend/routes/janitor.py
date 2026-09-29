"""
FleshNote API — Janitor Analysis Routes
Background analysis of chapter text: entity link suggestions, new entity candidates,
alias suggestions, typo detection, and synonym improvement.
"""

import os
import re
import json
import sqlite3
import hashlib
import html as html_lib
from fastapi import APIRouter
from pydantic import BaseModel
from project_io import safe_md_path
from lexicon_engine import get_lexicon

router = APIRouter()

LANG_MAP = {
    "en": "en_US",
    "ar": "ar",
    "hu": "hu_HU",
    "pl": "pl_PL",
}

# Module-level spell checker cache
_spell_cache: dict = {}

WEAK_WORDS = [
    "walked", "said", "went", "looked", "felt", "very", "really", "just",
    "big", "small", "good", "bad", "nice", "happy", "sad", "thing", "stuff",
    "got", "get", "put", "made", "came", "went", "saw", "knew", "thought",
    "seemed", "felt", "appeared"
]

# --- Show, Don't Tell lexicons (English) ---
# Word lists live in backend/lexicons/en/*.json (see lexicon_engine.py). The
# legacy tier is exactly the list this analyzer was tuned on; widening one to the
# full kind is a behavior change that needs benchmark numbers.
_LEX_EN = get_lexicon("en")

LINKING_VERBS_EN = {"be", "feel", "seem", "appear", "look", "become", "grow"}

# Original tuned list plus every strong entry, keeping only felt states: weak
# entries (cold, broken, moved…) are only evidence in the right company, and
# traits (arrogant, cautious) or evaluative words (dreadful) aren't a feeling.
EMOTION_LEXICON_EN = ((_LEX_EN.lemmas("emotion_label", legacy_only=True)
                       | _LEX_EN.lemmas("emotion_label", strength="strong"))
                      & _LEX_EN.lemmas("emotion_label", felt="state"))

STATE_EXEMPTIONS_EN = {
    "tall", "short", "old", "young", "open", "closed", "dead", "alive",
    "empty", "full", "dark", "bright", "quiet", "loud", "born", "ready",
    "asleep", "awake", "drunk", "clean", "dirty", "wet", "dry", "busy",
}

# Emotion adjectives that mean "willing" when a to-infinitive follows
# ("content to sharpen his harpoon"), so that reading isn't a stated emotion.
WILLING_BEFORE_INFINITIVE_EN = {"content"}

# Dialogue/thought attribution verbs (say, whisper, think…); the lexicon files
# them under conflict_speech, where the neutral ones are strength "weak".
SPEECH_VERBS_EN = _LEX_EN.lemmas("conflict_speech", legacy_only=True)

FILTER_VERBS_EN = _LEX_EN.lemmas("filter_verb", legacy_only=True)

# Knowing/deciding is plot information, not a stated emotion — not flagged.
REALIZE_VERBS_EN = _LEX_EN.lemmas("realize_verb", legacy_only=True)

EMOTION_ADVERBS_EN = _LEX_EN.lemmas("emotion_adverb", legacy_only=True)

IGNORE_ADVERBS_EN = {
    "really", "simply", "only", "hardly", "especially", "finally",
    "actually", "probably", "likely", "exactly", "absolutely", "truly",
    "literally", "barely", "merely", "rarely", "nearly", "mostly",
    "slightly", "highly", "fully", "completely", "totally", "entirely",
    "definitely", "certainly", "recently", "currently", "usually", "initially"
}

# --- Five Senses Lexicons (English) ---
# Matched as surface words, not lemmas, so these stay here until sense detection
# moves onto the lexicon's sensory entries (plan §4.4) instead of being ported.
SIGHT_WORDS_EN = frozenset({
    "see", "saw", "seen", "look", "looks", "looked", "watch", "watched", "gaze", "gazed",
    "glance", "glanced", "stare", "stared", "glimpse", "glimpsed", "observe", "observed",
    "bright", "darkness", "light", "shadow", "shadowy", "color", "colour", "gleam", "flash",
    "shimmer", "glow", "glowing", "dim", "pale", "vivid", "blaze", "blazing", "blind",
    "blur", "blurry", "sparkle", "sparkling", "shine", "shining", "shone", "visible",
    "invisible", "spotted", "peered", "peering", "glittered", "glimmered", "illuminated",
    "silhouette", "lit", "dazzling", "dazzled", "squinted", "squint",
})
SOUND_WORDS_EN = frozenset({
    "hear", "heard", "listen", "listened", "sound", "sounds", "noise", "noisy",
    "loud", "quiet", "silent", "silence", "ring", "rang", "ringing", "crash", "crashed",
    "bang", "banged", "whisper", "whispered", "shout", "shouted", "roar", "roared",
    "hum", "hummed", "buzz", "buzzed", "creak", "creaked", "rustle", "rustled",
    "echo", "echoed", "clatter", "clattered", "murmur", "murmured", "rumble", "rumbled",
    "thunder", "thundered", "shriek", "shrieked", "squeak", "squeaked", "groan", "groaned",
    "whistle", "whistled", "snap", "snapped", "thud", "thudded", "clang", "clanged",
    "click", "clicked", "tap", "tapped", "rattle", "rattled", "voice", "voices",
})
SMELL_WORDS_EN = frozenset({
    "smell", "smelled", "smelt", "smells", "scent", "scented", "odor", "odour", "fragrance",
    "aroma", "stench", "stink", "stank", "whiff", "reek", "reeked", "perfume", "perfumed",
    "sniff", "sniffed", "sniffing", "musty", "putrid", "pungent",
    "foul", "rank", "acrid", "smoky", "floral", "earthy", "rancid",
})
TOUCH_WORDS_EN = frozenset({
    "feel", "felt", "feels", "touch", "touched", "touches", "smooth", "rough", "cold",
    "hot", "warm", "warmth", "sharp", "soft", "hard", "wet", "dry", "sticky", "slimy",
    "silky", "coarse", "grip", "gripped", "press", "pressed", "squeeze", "squeezed",
    "stroke", "stroked", "brush", "brushed", "grasp", "grasped", "caress", "caressed",
    "scratch", "scratched", "prick", "pricked", "sting", "stung", "tingle", "tingled",
    "numb", "freezing", "burning", "burned", "burnt", "shiver", "shivered", "trembled", "texture",
})
TASTE_WORDS_EN = frozenset({
    "taste", "tasted", "tastes", "flavor", "flavour", "bitter", "sweet", "sour", "salty",
    "savory", "savoury", "bland", "delicious", "swallow", "swallowed",
    "bite", "bitten", "chew", "chewed", "lick", "licked", "tongue",
    "gulp", "gulped", "sip", "sipped", "devour", "devoured", "savor", "savored",
    "metallic", "spicy", "tangy", "acidic",
})
EN_SENSES = {
    "sight": SIGHT_WORDS_EN,
    "sound": SOUND_WORDS_EN,
    "smell": SMELL_WORDS_EN,
    "touch": TOUCH_WORDS_EN,
    "taste": TASTE_WORDS_EN,
}


class JanitorRequest(BaseModel):
    project_path: str
    chapter_id: str | int
    html: str
    language: str = "en"
    confidence_threshold: float = 0.5


class JanitorSuggestion(BaseModel):
    id: str
    type: str
    entity_type: str | None = None
    entity_id: str | int | None = None
    entity_name: str | None = None
    matched_text: str
    context: str
    context_highlight_start: int
    context_highlight_end: int
    char_offset: int
    replacement: str | None = None


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database not found at {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _html_to_plain(html: str) -> str:
    """Strip HTML tags and decode entities. Preserves char count matching TipTap text nodes."""
    text = re.sub(r'<[^>]+>', '', html)
    return html_lib.unescape(text)


def _html_to_words_plain(html: str) -> str:
    """Like _html_to_plain but adds spaces at block/break boundaries for word-accurate tokenization."""
    html = re.sub(r'<br\s*/?>', ' ', html, flags=re.IGNORECASE)
    html = re.sub(r'</(p|div|li|h[1-6]|blockquote)>', ' ', html, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', html)
    return html_lib.unescape(text)


def _strip_todo_blocks(text: str) -> str:
    """Remove #TODO...zero-width-space sequences from plain text so they aren't analyzed."""
    return re.sub(r'#TODO[^\u200B\n]*\u200B?', '', text)


def _get_linked_ranges(html: str) -> list[tuple[int, int]]:
    """Return plain-text char ranges already covered by entity span marks."""
    ranges = []
    # We need to find spans with data-entity-id and track their plain-text offsets.
    # Strategy: walk html tag by tag, counting plain chars as we go.
    pos = 0
    plain_offset = 0
    while pos < len(html):
        if html[pos] == '<':
            tag_end = html.find('>', pos)
            if tag_end == -1:
                break
            tag = html[pos:tag_end + 1]
            # Check if this is an opening span with data-entity-id
            if re.match(r'<span[^>]+data-entity-id=', tag, re.IGNORECASE):
                # Find the closing </span>
                close_start = html.find('</span>', tag_end)
                if close_start != -1:
                    inner_html = html[tag_end + 1:close_start]
                    inner_text = re.sub(r'<[^>]+>', '', inner_html)
                    range_start = plain_offset
                    range_end = plain_offset + len(inner_text)
                    ranges.append((range_start, range_end))
                    plain_offset += len(inner_text)
                    pos = close_start + len('</span>')
                    continue
            pos = tag_end + 1
        else:
            plain_offset += 1
            pos += 1
    return ranges


def _is_in_linked_range(offset: int, linked_ranges: list[tuple[int, int]]) -> bool:
    for start, end in linked_ranges:
        if start <= offset < end:
            return True
    return False


def _get_all_entities(conn) -> list[dict]:
    entities = []
    for table, etype in [("characters", "character"), ("locations", "location"), ("lore_entities", "lore"), ("groups", "group")]:
        try:
            rows = conn.execute(f"SELECT id, name, aliases FROM {table}").fetchall()
            for r in rows:
                name = r["name"] or ""
                aliases = []
                if r["aliases"]:
                    try:
                        aliases = json.loads(r["aliases"]) or []
                    except Exception:
                        pass
                if name:
                    entities.append({"id": r["id"], "name": name, "type": etype, "aliases": aliases})
        except Exception:
            pass
    return entities


def _build_context(plain_text: str, match_start: int, match_end: int, window: int = 100) -> tuple[str, int, int]:
    ctx_start = max(0, match_start - window)
    ctx_end = min(len(plain_text), match_end + window)
    context = plain_text[ctx_start:ctx_end]
    highlight_start = match_start - ctx_start
    highlight_end = match_end - ctx_start
    return context, highlight_start, highlight_end


def _make_id(stype: str, matched_text: str, char_offset: int) -> str:
    raw = f"{stype}:{matched_text}:{char_offset}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _analyze_link_existing(
    plain_text: str,
    linked_ranges: list[tuple[int, int]],
    entities: list[dict],
    cap: int = 5
) -> list[dict]:
    suggestions = []
    # Sort by name length desc to prefer longer matches
    sorted_entities = sorted(entities, key=lambda e: len(e["name"]), reverse=True)
    seen_offsets: set = set()

    for ent in sorted_entities:
        if len(suggestions) >= cap:
            break
        names_to_check = [ent["name"]] + (ent["aliases"] or [])
        for name in names_to_check:
            if not name or len(name) < 2:
                continue
            pattern = r'\b' + re.escape(name) + r'\b'
            for m in re.finditer(pattern, plain_text, re.IGNORECASE):
                if len(suggestions) >= cap:
                    break
                offset = m.start()
                if offset in seen_offsets:
                    continue
                if _is_in_linked_range(offset, linked_ranges):
                    continue
                seen_offsets.add(offset)
                context, hl_start, hl_end = _build_context(plain_text, m.start(), m.end())
                suggestions.append({
                    "id": _make_id("link_existing", m.group(), offset),
                    "type": "link_existing",
                    "entity_type": ent["type"],
                    "entity_id": ent["id"],
                    "entity_name": ent["name"],
                    "matched_text": m.group(),
                    "context": context,
                    "context_highlight_start": hl_start,
                    "context_highlight_end": hl_end,
                    "char_offset": offset,
                    "replacement": None
                })
    return suggestions


def _analyze_create_entity(
    plain_text: str,
    entities: list[dict],
    language: str,
    linked_ranges: list[tuple[int, int]],
    cap: int = 5
) -> list[dict]:
    suggestions = []
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
    except Exception:
        return []

    try:
        doc = nlp(plain_text[:5000])  # cap for performance
    except Exception:
        return []

    existing_names_lower = set()
    for e in entities:
        existing_names_lower.add(e["name"].lower().strip())
        for alias in (e["aliases"] or []):
            if alias:
                existing_names_lower.add(alias.lower().strip())

    def _overlaps_existing(name_l: str) -> bool:
        """True if name_l matches, contains, or is contained by any known entity/alias."""
        for known in existing_names_lower:
            if not known or len(known) < 3:
                continue
            if known == name_l:
                return True
            # "eastern islands" is substring of "the eastern islands" → overlap
            if known in name_l:
                return True
            # detected name is substring of a known entity
            if name_l in known:
                return True
        return False

    spacy_to_entity = {
        "PERSON": "character",
        "GPE": "location",
        "LOC": "location",
        "FAC": "location",
        "ORG": "lore",
    }

    seen_texts: set = set()
    for ent in doc.ents:
        if len(suggestions) >= cap:
            break
        etype = spacy_to_entity.get(ent.label_)
        if not etype:
            continue
        name = ent.text.strip()
        if not name or len(name) < 3:
            continue
        name_lower = name.lower()
        if name_lower in seen_texts:
            continue
        if _overlaps_existing(name_lower):
            continue
        seen_texts.add(name_lower)
        offset = ent.start_char
        if _is_in_linked_range(offset, linked_ranges):
            continue
        context, hl_start, hl_end = _build_context(plain_text, ent.start_char, ent.end_char)
        suggestions.append({
            "id": _make_id("create_entity", name, offset),
            "type": "create_entity",
            "entity_type": etype,
            "entity_id": None,
            "entity_name": None,
            "matched_text": name,
            "context": context,
            "context_highlight_start": hl_start,
            "context_highlight_end": hl_end,
            "char_offset": offset,
            "replacement": None
        })
    return suggestions


def _analyze_alias(plain_text: str, entities: list[dict], cap: int = 3) -> list[dict]:
    suggestions = []
    for ent in entities:
        if len(suggestions) >= cap:
            break
        name = ent["name"]
        parts = name.split()
        if len(parts) < 2:
            continue
        # Check if full name appears in text
        if not re.search(r'\b' + re.escape(name) + r'\b', plain_text, re.IGNORECASE):
            continue
        # Check substrings (single tokens >= 4 chars) that appear standalone
        for part in parts:
            if len(part) < 4:
                continue
            # Skip if already an alias
            if any(a.lower() == part.lower() for a in (ent["aliases"] or [])):
                continue
            for m in re.finditer(r'\b' + re.escape(part) + r'\b', plain_text, re.IGNORECASE):
                # Check full name is absent nearby (within 200 chars)
                window_start = max(0, m.start() - 200)
                window_end = min(len(plain_text), m.end() + 200)
                nearby = plain_text[window_start:window_end]
                if not re.search(r'\b' + re.escape(name) + r'\b', nearby, re.IGNORECASE):
                    context, hl_start, hl_end = _build_context(plain_text, m.start(), m.end())
                    suggestions.append({
                        "id": _make_id("alias", part, m.start()),
                        "type": "alias",
                        "entity_type": ent["type"],
                        "entity_id": ent["id"],
                        "entity_name": ent["name"],
                        "matched_text": part,
                        "context": context,
                        "context_highlight_start": hl_start,
                        "context_highlight_end": hl_end,
                        "char_offset": m.start(),
                        "replacement": None
                    })
                    break
            if len(suggestions) >= cap:
                break
    return suggestions


def _analyze_typo(plain_text: str, language: str, words_plain: str, entities: list[dict], cap: int = 3) -> list[dict]:
    suggestions = []
    sc_lang = LANG_MAP.get(language)
    if not sc_lang:
        return []
    try:
        import phunspell
        if sc_lang not in _spell_cache:
            _spell_cache[sc_lang] = phunspell.Phunspell(sc_lang)
        spell = _spell_cache[sc_lang]
    except Exception:
        return []

    # Build a set of entity names and aliases to never flag as typos
    entity_words: set = set()
    for e in entities:
        if e["name"]:
            for part in e["name"].lower().split():
                entity_words.add(part)
        for alias in (e["aliases"] or []):
            if alias:
                for part in alias.lower().split():
                    entity_words.add(part)

    # Use word-boundary-aware text for tokenization, but locate matches in plain_text for offsets
    words_found = re.findall(r'\b[a-zA-ZÀ-ÿ\u0100-\u017E]+\b', words_plain)
    seen: set = set()
    unique_words = []
    for w in words_found:
        wl = w.lower()
        if wl not in seen:
            seen.add(wl)
            unique_words.append(w)
        if len(unique_words) >= 60:
            break

    for word in unique_words:
        if len(suggestions) >= cap:
            break
        # Never flag entity names / aliases as typos
        if word.lower() in entity_words:
            continue
        try:
            if spell.lookup(word.lower()):
                continue
            sug_list = list(spell.suggest(word.lower()))[:3]
            if not sug_list:
                continue
            # Find first occurrence in plain text
            m = re.search(r'\b' + re.escape(word) + r'\b', plain_text)
            if not m:
                continue
            context, hl_start, hl_end = _build_context(plain_text, m.start(), m.end())
            suggestions.append({
                "id": _make_id("typo", word, m.start()),
                "type": "typo",
                "entity_type": None,
                "entity_id": None,
                "entity_name": None,
                "matched_text": word,
                "context": context,
                "context_highlight_start": hl_start,
                "context_highlight_end": hl_end,
                "char_offset": m.start(),
                "replacement": sug_list[0]
            })
        except Exception:
            continue
    return suggestions


def _analyze_synonym(plain_text: str, language: str, words_plain: str, cap: int = 2) -> list[dict]:
    suggestions = []
    try:
        from nltk_manager import get_synonyms, check_wordnet_exists
        if not check_wordnet_exists():
            return []
    except Exception:
        return []

    # Map app language to NLTK lang code
    nltk_lang = "eng" if language == "en" else language

    # Use word-boundary-aware text to detect weak words, then locate in plain_text for TipTap offsets
    words_lower = words_plain.lower()
    for weak_word in WEAK_WORDS:
        if len(suggestions) >= cap:
            break
        if not re.search(r'\b' + re.escape(weak_word) + r'\b', words_lower):
            continue
        # Re-search in plain_text to get the TipTap-compatible char_offset
        m = re.search(r'\b' + re.escape(weak_word) + r'\b', plain_text.lower())
        if not m:
            continue
        try:
            groups = get_synonyms(weak_word, nltk_lang)
            if not groups:
                continue
            # Get first synonym from first group
            first_group = groups[0]
            synonyms = first_group.get("synonyms", []) if isinstance(first_group, dict) else []
            # Filter out the word itself
            synonyms = [s for s in synonyms if s.lower() != weak_word.lower()]
            if not synonyms:
                continue
            replacement = synonyms[0]
            context, hl_start, hl_end = _build_context(plain_text, m.start(), m.end())
            suggestions.append({
                "id": _make_id("synonym", weak_word, m.start()),
                "type": "synonym",
                "entity_type": None,
                "entity_id": None,
                "entity_name": None,
                "matched_text": plain_text[m.start():m.end()],
                "context": context,
                "context_highlight_start": hl_start,
                "context_highlight_end": hl_end,
                "char_offset": m.start(),
                "replacement": replacement
            })
        except Exception:
            continue
    return suggestions


def _analyze_weak_adverbs(plain_text: str, language: str, cap: int = 5) -> list[dict]:
    """Detect -ly adverbs modifying verbs (weak adverb writing pattern)."""
    if language != "en":
        return []
    suggestions = []
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
        doc = nlp(plain_text[:10000])
    except Exception:
        return []

    seen_texts: set = set()
    for token in doc:
        if len(suggestions) >= cap:
            break
        if token.pos_ == "ADV" and token.text.lower().endswith("ly") and token.head.pos_ == "VERB":
            if token.text.lower() in IGNORE_ADVERBS_EN:
                continue
            start_char = min(token.idx, token.head.idx)
            end_char = max(token.idx + len(token), token.head.idx + len(token.head))
            if end_char - start_char > 50:
                continue
            matched_text = plain_text[start_char:end_char]
            if matched_text.lower() in seen_texts:
                continue
            seen_texts.add(matched_text.lower())
            context, hl_start, hl_end = _build_context(plain_text, start_char, end_char)
            suggestions.append({
                "id": _make_id("weak_adverbs", matched_text, start_char),
                "type": "weak_adverbs",
                "entity_type": "adverb",
                "matched_text": matched_text,
                "context": context,
                "context_highlight_start": hl_start,
                "context_highlight_end": hl_end,
                "char_offset": start_char,
                "replacement": None
            })
    return suggestions


def _has_person_agent(verb) -> bool:
    """True if a passive verb has a 'by X' agent where X is a person/pronoun."""
    for agent in verb.children:
        if agent.dep_ != "agent":
            continue
        for obj in agent.children:
            if obj.dep_ == "pobj" and (obj.pos_ in ("PROPN", "PRON") or obj.ent_type_ in ("PERSON", "NORP", "ORG")):
                return True
    return False


def _analyze_passive_voice(plain_text: str, language: str, cap: int = 3) -> list[dict]:
    """Detect passives whose doer is a named person ('was kicked by John').

    Agentless passives ('he was born', 'the king was murdered') are usually
    deliberate, and inanimate doers ('bordered by bushes', 'separated by
    glass') are how descriptive prose is written — on labeled literary prose
    those made up nearly all flags. Only person/pronoun agents are flagged.
    """
    if language != "en":
        return []
    suggestions = []
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
        doc = nlp(plain_text[:10000])
    except Exception:
        return []

    seen_texts: set = set()
    for token in doc:
        if len(suggestions) >= cap:
            break
        if token.dep_ == "auxpass" and _has_person_agent(token.head):
            start_char = min(token.idx, token.head.idx)
            end_char = max(token.idx + len(token), token.head.idx + len(token.head))
            if end_char - start_char > 50:
                continue
            matched_text = plain_text[start_char:end_char]
            if matched_text.lower() in seen_texts:
                continue
            seen_texts.add(matched_text.lower())
            context, hl_start, hl_end = _build_context(plain_text, start_char, end_char)
            suggestions.append({
                "id": _make_id("passive_voice", matched_text, start_char),
                "type": "passive_voice",
                "entity_type": "passive",
                "matched_text": matched_text,
                "context": context,
                "context_highlight_start": hl_start,
                "context_highlight_end": hl_end,
                "char_offset": start_char,
                "replacement": None
            })
    return suggestions


_QUOTED_SPEECH_RE = re.compile(
    r'“[^”\n]*”'            # “…”
    r'|"[^"\n]*"'                          # "…"
    r'|„[^”“"\n]*[”“"]'  # „…” (HU/PL)
    r'|«[^»\n]*»|»[^«\n]*«'  # «…» and »…«
    r"|(?<!\w)‘[^\n]*?’(?!\w)"       # ‘…’ (’ inside words is an apostrophe)
    r"|(?<!\w)'[^\n]*?'(?!\w)"                 # '…' (Conrad-style)
)
_SPACED_DASH_RE = re.compile(r"(?:^|\s)[–—](?=\s)")


def _speech_spans(text: str, dash_dialogue: bool = False) -> list[tuple[int, int]]:
    """Character ranges of spoken text: quoted passages, and for HU/PL the dash
    dialogue convention ('– Nem – mondta büszkén Weisz. – Igen.'), where a line
    that opens with a dash (or ': –') is speech until the next spaced dash, and
    each further spaced dash switches between speech and narration.

    Show-don't-tell only skips flags inside these ranges, so the narration around
    a line of dialogue ('mondta büszkén') is still checked."""
    spans = [m.span() for m in _QUOTED_SPEECH_RE.finditer(text)]
    if dash_dialogue:
        pos = 0
        for line in text.split("\n"):
            dashes = [m.end() for m in _SPACED_DASH_RE.finditer(line)]
            if dashes:
                stripped = line.lstrip()
                opens = stripped[:1] in ("–", "—")
                if not opens:
                    # 'fordult a paphoz: – Mi lesz…' opens speech mid-line.
                    first = next((m for m in _SPACED_DASH_RE.finditer(line)
                                  if line[:m.start()].rstrip().endswith(":")), None)
                    if first is not None:
                        dashes = [d for d in dashes if d >= first.end()]
                        opens = True
                if opens:
                    bounds = dashes + [len(line)]
                    for i in range(0, len(bounds) - 1, 2):
                        spans.append((pos + bounds[i], pos + bounds[i + 1]))
            pos += len(line) + 1
    return spans


def _in_speech(offset: int, spans: list[tuple[int, int]]) -> bool:
    return any(start <= offset < end for start, end in spans)


def _touches_speech(sent, spans: list[tuple[int, int]]) -> bool:
    return any(start < sent.end_char and sent.start_char < end for start, end in spans)


def _is_dialogue_en(sent) -> bool:
    """Return True if this sentence looks like dialogue that _speech_spans can't
    delimit: an unpaired quote mark, or reported speech ('he said that…').
    Apostrophes (Ahab's, don't) are not quote marks."""
    quote_chars = {'"', '\u201c', '\u201d', '\u00ab', '\u00bb', '\u2018'}
    if any(c in sent.text for c in quote_chars):
        return True
    for token in sent:
        if token.lemma_ in SPEECH_VERBS_EN:
            for child in token.children:
                if child.dep_ in ("ccomp", "parataxis"):
                    return True
            if token.dep_ == "parataxis" and token.head.dep_ == "ROOT":
                return True
    return False


_ANIMATE_PRONOUNS_EN = {
    "i", "you", "he", "she", "we", "they", "me", "him", "her", "us", "them",
    "one", "who", "someone", "somebody", "everyone", "everybody", "anyone", "anybody",
    "nobody", "myself", "yourself", "himself", "herself", "ourselves", "themselves",
}
_animate_noun_cache: dict[str, bool] = {}


def _is_animate_noun_en(lemma: str) -> bool:
    """True if WordNet files the noun under person/animal/people (captain, crew,
    whale) or body part (heart, eyes — feelings are told through them too).

    Without WordNet nothing is ruled out, which keeps the pre-lexicon behavior."""
    if lemma not in _animate_noun_cache:
        try:
            from nltk_manager import check_wordnet_exists
            if not check_wordnet_exists():
                return True
            from nltk.corpus import wordnet as wn
            roots = {wn.synset(s) for s in ("person.n.01", "animal.n.01", "people.n.01",
                                            "social_group.n.01", "body_part.n.01")}
            _animate_noun_cache[lemma] = any(
                roots.intersection(path)
                for syn in wn.synsets(lemma, pos="n")[:3]
                for path in syn.hypernym_paths()
            )
        except Exception:
            return True
    return _animate_noun_cache[lemma]


def _has_animate_subject_en(verb) -> bool:
    """True unless the clause's subject is clearly not a character ('the fight', 'it').

    An emotion adjective predicated of a thing is description ('the silence was
    menacing'), not a character's stated feeling. No subject found → True."""
    subjects = [c for c in verb.children if c.dep_ in ("nsubj", "nsubjpass")]
    if not subjects and verb.dep_ in ("xcomp", "ccomp", "conj"):
        subjects = [c for c in verb.head.children if c.dep_ in ("nsubj", "nsubjpass")]
    if not subjects:
        return True
    subj = subjects[0]
    if subj.pos_ == "PROPN":
        return True
    if subj.pos_ == "PRON":
        return subj.lower_ in _ANIMATE_PRONOUNS_EN
    if subj.pos_ == "NOUN":
        return _is_animate_noun_en(subj.lemma_.lower())
    return True


def _detect_emotion_label_en(sent) -> dict | None:
    """Detect a stated emotion: linking verb + emotion adjective ('She was furious',
    'he grew impatient') or an emotion participle as passive ('she was terrified')."""
    for token in sent:
        if token.lemma_ in LINKING_VERBS_EN and token.pos_ in ("VERB", "AUX"):
            for child in token.children:
                if child.pos_ == "ADJ":
                    lemma = child.lemma_.lower()
                    if lemma in STATE_EXEMPTIONS_EN:
                        continue
                    if lemma in WILLING_BEFORE_INFINITIVE_EN and any(
                            c.dep_ == "xcomp" and c.pos_ in ("VERB", "AUX") for c in child.children):
                        continue
                    if lemma in EMOTION_LEXICON_EN and _has_animate_subject_en(token):
                        start_char = min(token.idx, child.idx)
                        end_char = max(token.idx + len(token.text), child.idx + len(child.text))
                        return {
                            "matched_text": None,
                            "start_char": start_char,
                            "end_char": end_char,
                            "entity_type": "emotion_label",
                            "confidence": 0.85,
                        }
        # The parser often reads 'was terrified' as a verbal passive; the
        # participle's own spelling is the adjective entry. A 'by' doer makes it
        # an event instead ('was relieved by the day watch').
        if token.tag_ == "VBN" and token.lower_ in EMOTION_LEXICON_EN:
            aux = next((c for c in token.children if c.dep_ == "auxpass"), None)
            has_agent = any(c.dep_ == "agent" for c in token.children)
            if aux is not None and not has_agent and _has_animate_subject_en(token):
                start_char = min(aux.idx, token.idx)
                end_char = max(aux.idx + len(aux.text), token.idx + len(token.text))
                return {
                    "matched_text": None,
                    "start_char": start_char,
                    "end_char": end_char,
                    "entity_type": "emotion_label",
                    "confidence": 0.85,
                }
    return None


def _detect_filter_verb_en(sent) -> dict | None:
    """Detect: filter verb with subject + object clause (e.g. 'He saw the ship sink')."""
    for token in sent:
        if token.lemma_ in FILTER_VERBS_EN:
            has_subj = any(c.dep_ in ("nsubj", "nsubjpass") for c in token.children)
            has_obj = any(c.dep_ in ("dobj", "ccomp", "xcomp", "advcl") for c in token.children)
            if has_subj and has_obj:
                end_char = token.idx + len(token.text)
                return {
                    "matched_text": None,
                    "start_char": token.idx,
                    "end_char": end_char,
                    "entity_type": "filter_verb",
                    "confidence": 0.60,
                }
    return None


def _detect_realize_verb_en(sent) -> dict | None:
    """Detect: cognitive/realize verb with complement clause (e.g. 'She realized he was lying')."""
    for token in sent:
        if token.lemma_ in REALIZE_VERBS_EN:
            has_comp = any(c.dep_ in ("ccomp", "xcomp") for c in token.children)
            if has_comp:
                return {
                    "matched_text": None,
                    "start_char": token.idx,
                    "end_char": token.idx + len(token.text),
                    "entity_type": "realize_verb",
                    "confidence": 0.65,
                }
    return None


def _detect_adverb_emotion_en(sent) -> dict | None:
    """Detect: speech verb + emotion adverb modifier (e.g. '"Stop!" she said angrily.')."""
    for token in sent:
        if token.dep_ == "ROOT" and token.lemma_ in SPEECH_VERBS_EN:
            for child in token.children:
                if child.dep_ == "advmod" and child.lemma_.lower() in EMOTION_ADVERBS_EN:
                    start_char = min(token.idx, child.idx)
                    end_char = max(token.idx + len(token.text), child.idx + len(child.text))
                    return {
                        "matched_text": None,
                        "start_char": start_char,
                        "end_char": end_char,
                        "entity_type": "adverb_emotion",
                        "confidence": 0.75,
                    }
    return None


EMOTION_NOUNS_EN = _LEX_EN.lemmas("emotion_noun", felt="state")
STRONG_EMOTION_NOUNS_EN = _LEX_EN.lemmas("emotion_noun", strength="strong", felt="state")
# Nouns that name how an emotion shows or arrives: 'a look of horror', 'a wave of
# grief', plus the face/voice nouns ('eyes of scorn'). Telling only with an
# emotion noun after 'of'.
EMOTION_CUE_HEADS_EN = {
    e["phrase"][0] for e in _LEX_EN.entries("telling_cue")
    if len(e.get("phrase") or ()) == 2 and e["phrase"][1] == "of"
} | {"eye", "face", "voice", "expression", "tone", "smile", "glance", "gaze", "air"}
# 'a sort of dread': look through these to the real frame.
_OF_PASS_THROUGH_EN = {"sort", "kind", "degree", "state", "mixture"}


def _detect_emotion_noun_frame_en(sent) -> dict | None:
    """Detect an emotion named as a noun in a stock frame: 'much to my surprise',
    'in wonderment', 'trembled with fear', 'full of wonder', 'choked by
    indignation', 'a look of horror'.

    Weak nouns (surprise, hope, love…) count only in the tight frames (to my X,
    full of X, a look of X); strong ones also after in/with/by/out of."""
    for tok in sent:
        if tok.pos_ != "NOUN" or tok.lemma_.lower() not in EMOTION_NOUNS_EN:
            continue
        strong = tok.lemma_.lower() in STRONG_EMOTION_NOUNS_EN
        noun = tok
        while noun.dep_ == "conj" and noun.head.pos_ == "NOUN":
            noun = noun.head
        if noun.dep_ != "pobj":
            continue
        prep = noun.head
        while (prep.lower_ == "of" and prep.head.lemma_ in _OF_PASS_THROUGH_EN
               and prep.head.dep_ == "pobj"):
            prep = prep.head.head
        head = prep.head
        word = prep.lower_
        if word == "to":
            fires = any(c.dep_ == "poss" for c in noun.children)
        elif word == "of":
            fires = (head.lemma_ == "full" or head.lemma_ in EMOTION_CUE_HEADS_EN
                     or (strong and head.lower_ == "out"))
        elif word in ("in", "with", "by"):
            # 'the day was ending in a serenity…' is description, not a feeling.
            fires = (strong and head.pos_ in ("VERB", "AUX", "ADJ")
                     and _has_animate_subject_en(head if head.pos_ != "ADJ" else head.head))
        else:
            fires = False
        if fires:
            start = min(prep.idx, tok.idx)
            end = max(prep.idx + len(prep.text), tok.idx + len(tok.text))
            return {
                "matched_text": None,
                "start_char": start,
                "end_char": end,
                "entity_type": "emotion_noun_frame",
                "confidence": 0.8,
            }
    return None


def _detect_detached_emotion_en(sent) -> dict | None:
    """Detect a sentence that opens on a detached emotion adjective or participle:
    'Furious, Ned tried…', 'Rather surprised, I said…'."""
    toks = [t for t in sent if not (t.is_punct or t.is_space)]
    i = 0
    while i < len(toks) and (toks[i].pos_ in ("ADV", "CCONJ") or toks[i].lower_ in ("so", "then")):
        i += 1
    if i >= len(toks):
        return None
    cand = toks[i]
    is_label = ((cand.pos_ == "ADJ" and cand.lemma_.lower() in EMOTION_LEXICON_EN)
                or (cand.tag_ == "VBN" and cand.lower_ in EMOTION_LEXICON_EN))
    if not is_label or cand.dep_ == "ROOT":
        return None
    after = cand.right_edge.i + 1
    if after >= len(cand.doc) or cand.doc[after].text != ",":
        return None
    start = cand.left_edge.idx  # include its own modifier ('Rather surprised')
    return {
        "matched_text": None,
        "start_char": start,
        "end_char": cand.idx + len(cand.text),
        "entity_type": "detached_emotion",
        "confidence": 0.8,
    }


# Emotion verbs by who feels the emotion: the subject ('she envied him') or the
# object ('the news appalled her'). Behaviors (weep, tremble) show an emotion and
# speech acts (scold, mock) are actions, so their roles never fire.
EXPERIENCER_VERBS_EN = _LEX_EN.lemmas("emotion_verb", role="experiencer")
STIMULUS_VERBS_EN = _LEX_EN.lemmas("emotion_verb", role="stimulus")


def _detect_emotion_verb_en(sent) -> dict | None:
    """Detect an emotion stated as a verb: 'I almost envied him', 'he dreaded the
    voyage', 'the sight appalled her'."""
    for tok in sent:
        if tok.pos_ != "VERB" or tok.tag_ in ("VBG", "VBN"):
            continue
        # 'the power to charm or frighten souls' is a capacity, not a feeling.
        verb = tok.head if tok.dep_ == "conj" else tok
        if any(c.dep_ == "aux" and c.lower_ == "to" for c in verb.children):
            continue
        lemma = tok.lemma_.lower()
        if lemma in EXPERIENCER_VERBS_EN:
            subj = next((c for c in tok.children if c.dep_ == "nsubj"), None)
            if subj is None or not _has_animate_subject_en(tok):
                continue
        elif lemma in STIMULUS_VERBS_EN:
            obj = next((c for c in tok.children if c.dep_ == "dobj"), None)
            if obj is None or not (
                    obj.pos_ == "PROPN"
                    or (obj.pos_ == "PRON" and obj.lower_ in _ANIMATE_PRONOUNS_EN)
                    or (obj.pos_ == "NOUN" and _is_animate_noun_en(obj.lemma_.lower()))):
                continue
        else:
            continue
        return {
            "matched_text": None,
            "start_char": tok.idx,
            "end_char": tok.idx + len(tok.text),
            "entity_type": "emotion_verb",
            "confidence": 0.75,
        }
    return None


def _analyze_show_dont_tell(
    plain_text: str,
    language: str,
    confidence_threshold: float = 0.5,
    cap: int = 5
) -> list[dict]:
    """Show-don't-tell pipeline with dialogue exclusion.

    The filter-verb detector ('she heard footsteps') is kept but not run:
    on labeled prose it produced only false positives — perception verbs are
    usually how sensory showing is written.
    """
    if language != "en":
        return []
    suggestions = []
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
        doc = nlp(plain_text[:10000])
    except Exception:
        return []

    detectors = [
        _detect_emotion_label_en,
        _detect_realize_verb_en,
        _detect_adverb_emotion_en,
        _detect_emotion_noun_frame_en,
        _detect_detached_emotion_en,
        _detect_emotion_verb_en,
    ]

    speech = _speech_spans(plain_text, dash_dialogue=False)
    seen_offsets: set = set()
    for sent in doc.sents:
        if len(suggestions) >= cap:
            break
        # Marked dialogue is handled per flag below; the sentence-level check is
        # for dialogue the marks can't delimit.
        if not _touches_speech(sent, speech) and _is_dialogue_en(sent):
            continue
        for detector in detectors:
            if len(suggestions) >= cap:
                break
            result = detector(sent)
            if result is None:
                continue
            if result["confidence"] < confidence_threshold:
                continue
            start_char = result["start_char"]
            if (start_char in seen_offsets or _in_speech(start_char, speech)
                    or _in_speech(result["end_char"] - 1, speech)):
                continue
            seen_offsets.add(start_char)
            end_char = result["end_char"]
            matched_text = plain_text[start_char:end_char]
            context, hl_start, hl_end = _build_context(plain_text, start_char, end_char)
            suggestions.append({
                "id": _make_id("show_dont_tell", matched_text, start_char),
                "type": "show_dont_tell",
                "entity_type": result["entity_type"],
                "matched_text": matched_text,
                "context": context,
                "context_highlight_start": hl_start,
                "context_highlight_end": hl_end,
                "char_offset": start_char,
                "replacement": None
            })
    return suggestions


def _analyze_pacing(
    plain_text: str,
    language: str,
    cap: int = 2
) -> list[dict]:
    if language != "en":
        return []
    suggestions = []
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
        doc = nlp(plain_text[:10000])
    except Exception:
        return []

    sentences = list(doc.sents)
    if len(sentences) < 3:
        return []

    seen_offsets: set = set()

    for i in range(len(sentences) - 2):
        if len(suggestions) >= cap:
            break

        s1, s2, s3 = sentences[i], sentences[i+1], sentences[i+2]

        def get_first_word(sent):
            for t in sent:
                if not t.is_punct and not t.is_space:
                    return t
            return None

        t1, t2, t3 = get_first_word(s1), get_first_word(s2), get_first_word(s3)
        if not t1 or not t2 or not t3:
            continue

        trigger = False
        reason = ""

        # We only trigger on exact word matches to avoid broad POS false-positives
        if t1.text.lower() == t2.text.lower() == t3.text.lower():
            trigger = True
            reason = f'"{t1.text.lower()}"'

        if trigger:
            start_char = t1.idx
            end_char = t3.idx + len(t3)

            if end_char - start_char > 250:
                end_char = start_char + 250

            if start_char in seen_offsets:
                continue
            seen_offsets.add(start_char)

            matched_text = plain_text[start_char:end_char]
            context, hl_start, hl_end = _build_context(plain_text, start_char, end_char, window=30)

            suggestions.append({
                "id": _make_id("pacing", matched_text, start_char),
                "type": "pacing",
                "entity_type": reason,
                "matched_text": matched_text,
                "context": context,
                "context_highlight_start": hl_start,
                "context_highlight_end": hl_end,
                "char_offset": start_char,
                "replacement": None
            })

    return suggestions


def _count_syllables_en(word: str) -> int:
    """Approximate syllable count for an English word."""
    word = word.lower().rstrip(".,!?;:'\"-")
    if len(word) <= 3:
        return 1
    vowels = "aeiouy"
    count = 0
    prev_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    if word.endswith("e") and count > 1:
        count -= 1
    return max(1, count)


def _flesch_kincaid_en(plain_text: str) -> dict:
    """Compute Flesch Reading Ease and FK Grade Level for English text."""
    sentences = re.split(r'[.!?]+', plain_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    if not sentences:
        return {"score": None, "grade": None, "label": None}
    words = re.findall(r'\b[a-zA-Z]+\b', plain_text)
    if not words:
        return {"score": None, "grade": None, "label": None}
    total_syllables = sum(_count_syllables_en(w) for w in words)
    asl = len(words) / len(sentences)
    asw = total_syllables / len(words)
    score = round(max(0.0, min(100.0, 206.835 - 1.015 * asl - 84.6 * asw)), 1)
    grade = round(max(1.0, 0.39 * asl + 11.8 * asw - 15.59), 1)
    if score >= 90:
        label = "very_easy"
    elif score >= 80:
        label = "easy"
    elif score >= 70:
        label = "fairly_easy"
    elif score >= 60:
        label = "standard"
    elif score >= 50:
        label = "fairly_difficult"
    elif score >= 30:
        label = "difficult"
    else:
        label = "very_difficult"
    return {"score": score, "grade": grade, "label": label}


def _analyze_five_senses(plain_text: str, language: str) -> list[dict]:
    """Flag senses completely absent from the chapter text (English only)."""
    if language != "en":
        return []
    words = set(re.findall(r'\b[a-zA-Z]+\b', plain_text.lower()))
    missing = [sense for sense, lexicon in EN_SENSES.items() if not (words & lexicon)]
    if not missing:
        return []
    label = ", ".join(missing)
    context = plain_text[:120].strip()
    return [{
        "id": _make_id("five_senses", label, 0),
        "type": "five_senses",
        "entity_type": label,
        "entity_id": None,
        "entity_name": None,
        "matched_text": label,
        "context": context,
        "context_highlight_start": 0,
        "context_highlight_end": 0,
        "char_offset": 0,
        "replacement": None,
    }]


def _analyze_readability(plain_text: str, language: str) -> list[dict]:
    """Warn if chapter readability is too complex (FK grade > 11)."""
    if language != "en":
        return []
    fk = _flesch_kincaid_en(plain_text)
    if fk["grade"] is None or fk["grade"] <= 11.0:
        return []
    matched = f"Grade {fk['grade']} / Score {fk['score']}"
    context = plain_text[:120].strip()
    return [{
        "id": _make_id("readability", matched, 0),
        "type": "readability",
        "entity_type": fk["label"],
        "entity_id": None,
        "entity_name": None,
        "matched_text": matched,
        "context": context,
        "context_highlight_start": 0,
        "context_highlight_end": 0,
        "char_offset": 0,
        "replacement": None,
    }]


class SensesOverviewRequest(BaseModel):
    project_path: str
    language: str = "en"


@router.post("/api/project/janitor/senses-overview")
def janitor_senses_overview(req: SensesOverviewRequest):
    try:
        conn = _get_db(req.project_path)
    except FileNotFoundError as e:
        return {"status": "error", "chapters": [], "error": str(e)}
    try:
        chapters = conn.execute(
            "SELECT id, chapter_number, title, md_filename FROM chapters ORDER BY chapter_number"
        ).fetchall()
        result = []
        for ch in chapters:
            if not ch["md_filename"]:
                continue
            md_path = safe_md_path(os.path.join(req.project_path, "md"), ch["md_filename"])
            if not md_path or not os.path.exists(md_path):
                continue
            with open(md_path, "r", encoding="utf-8") as f:
                raw = f.read()
            # Strip entity/twist markers so they don't pollute word lists
            plain = _strip_todo_blocks(_html_to_plain(raw)).strip()
            if not plain:
                continue
            if req.language == "hu":
                from routes.hun_janitor import _count_senses_hu
                senses = _count_senses_hu(plain)
            elif req.language == "pl":
                from routes.pol_janitor import _count_senses_pl
                senses = _count_senses_pl(plain)
            else:
                words = set(re.findall(r'\b[a-zA-Z]+\b', plain.lower()))
                senses = {sense: len(words & lexicon) for sense, lexicon in EN_SENSES.items()}
            fk = _flesch_kincaid_en(plain) if req.language == "en" else {"score": None, "grade": None, "label": None}
            result.append({
                "chapter_id": ch["id"],
                "chapter_number": ch["chapter_number"],
                "title": ch["title"] or f"Chapter {ch['chapter_number']}",
                "senses": senses,
                "readability": fk,
            })
        return {"status": "ok", "chapters": result}
    except Exception as e:
        return {"status": "error", "chapters": [], "error": str(e)}
    finally:
        conn.close()


@router.post("/api/project/janitor/analyze")
def janitor_analyze(req: JanitorRequest):
    try:
        conn = _get_db(req.project_path)
    except FileNotFoundError as e:
        return {"status": "error", "suggestions": [], "error": str(e)}

    try:
        plain_text = _strip_todo_blocks(_html_to_plain(req.html))
        if not plain_text.strip():
            return {"status": "ok", "suggestions": []}
        # Word-boundary-safe version for typo/synonym tokenization (adds spaces at block breaks)
        words_plain = _strip_todo_blocks(_html_to_words_plain(req.html))
        entities = _get_all_entities(conn)
        linked_ranges = _get_linked_ranges(req.html)
        if req.language == "hu":
            from routes.hun_janitor import (
                _analyze_weak_adverbs_hu,
                _analyze_passive_voice_hu,
                _analyze_show_dont_tell_hu,
                _analyze_pacing_hu,
                _analyze_five_senses_hu,
            )
            weak_adverbs = _analyze_weak_adverbs_hu(plain_text, req.language)
            passive_voice = _analyze_passive_voice_hu(plain_text, req.language)
            sdt = _analyze_show_dont_tell_hu(plain_text, req.language, req.confidence_threshold)
            pacing = _analyze_pacing_hu(plain_text, req.language)
            five_senses = _analyze_five_senses_hu(plain_text, req.language)
        elif req.language == "pl":
            from routes.pol_janitor import (
                _analyze_weak_adverbs_pl,
                _analyze_passive_voice_pl,
                _analyze_show_dont_tell_pl,
                _analyze_pacing_pl,
                _analyze_five_senses_pl,
            )
            weak_adverbs = _analyze_weak_adverbs_pl(plain_text, req.language)
            passive_voice = _analyze_passive_voice_pl(plain_text, req.language)
            sdt = _analyze_show_dont_tell_pl(plain_text, req.language, req.confidence_threshold)
            pacing = _analyze_pacing_pl(plain_text, req.language)
            five_senses = _analyze_five_senses_pl(plain_text, req.language)
        else:
            weak_adverbs = _analyze_weak_adverbs(plain_text, req.language)
            passive_voice = _analyze_passive_voice(plain_text, req.language)
            sdt = _analyze_show_dont_tell(plain_text, req.language, req.confidence_threshold)
            pacing = _analyze_pacing(plain_text, req.language)
            five_senses = _analyze_five_senses(plain_text, req.language)

        readability = _analyze_readability(plain_text, req.language)
        suggestions = (
            _analyze_link_existing(plain_text, linked_ranges, entities) +
            _analyze_create_entity(plain_text, entities, req.language, linked_ranges) +
            _analyze_alias(plain_text, entities) +
            _analyze_typo(plain_text, req.language, words_plain, entities) +
            _analyze_synonym(plain_text, req.language, words_plain) +
            weak_adverbs +
            passive_voice +
            sdt +
            pacing +
            five_senses +
            readability
        )
        return {"status": "ok", "suggestions": suggestions}
    except Exception as e:
        return {"status": "error", "suggestions": [], "error": str(e)}
    finally:
        conn.close()

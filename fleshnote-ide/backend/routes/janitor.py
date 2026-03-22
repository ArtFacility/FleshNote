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
LINKING_VERBS_EN = {"be", "feel", "seem", "appear", "look", "become", "grow"}

EMOTION_LEXICON_EN = {
    "angry", "sad", "happy", "afraid", "scared", "anxious", "nervous", "furious",
    "jealous", "excited", "depressed", "miserable", "terrified", "embarrassed",
    "ashamed", "frustrated", "annoyed", "irritated", "disgusted", "lonely",
    "desperate", "hopeful", "relieved", "proud", "heartbroken", "devastated",
    "elated", "content", "resentful", "bitter", "gloomy", "ecstatic", "remorseful",
}

STATE_EXEMPTIONS_EN = {
    "tall", "short", "old", "young", "open", "closed", "dead", "alive",
    "empty", "full", "dark", "bright", "quiet", "loud", "born", "ready",
    "asleep", "awake", "drunk", "clean", "dirty", "wet", "dry", "busy",
}

SPEECH_VERBS_EN = {
    "say", "tell", "ask", "whisper", "shout", "mutter", "reply", "snap",
    "growl", "hiss", "call", "cry", "exclaim", "murmur", "stammer", "bark",
    "snarl", "plead", "demand", "insist", "think", "wonder", "muse", "reflect",
}

FILTER_VERBS_EN = {"see", "hear", "feel", "notice", "watch", "observe", "smell", "taste"}

REALIZE_VERBS_EN = {"realize", "understand", "know", "recognize", "sense", "decide"}

EMOTION_ADVERBS_EN = {
    "angrily", "sadly", "happily", "nervously", "anxiously", "bitterly",
    "jealously", "desperately", "proudly", "resentfully", "gleefully",
    "miserably", "furiously",
}

IGNORE_ADVERBS_EN = {
    "really", "simply", "only", "hardly", "especially", "finally",
    "actually", "probably", "likely", "exactly", "absolutely", "truly",
    "literally", "barely", "merely", "rarely", "nearly", "mostly",
    "slightly", "highly", "fully", "completely", "totally", "entirely",
    "definitely", "certainly", "recently", "currently", "usually", "initially"
}

# --- Five Senses Lexicons (English) ---
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
    "numb", "freezing", "burning", "shiver", "shivered", "trembled", "texture",
})
TASTE_WORDS_EN = frozenset({
    "taste", "tasted", "tastes", "flavor", "flavour", "bitter", "sweet", "sour", "salty",
    "savory", "savoury", "bland", "delicious", "swallow", "swallowed",
    "bite", "bit", "bitten", "chew", "chewed", "lick", "licked", "tongue",
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
    chapter_id: int
    html: str
    language: str = "en"
    confidence_threshold: float = 0.5


class JanitorSuggestion(BaseModel):
    id: str
    type: str
    entity_type: str | None = None
    entity_id: int | None = None
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


def _analyze_passive_voice(plain_text: str, language: str, cap: int = 3) -> list[dict]:
    """Detect passive voice constructions (auxpass dependency)."""
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
        if token.dep_ == "auxpass":
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


def _is_dialogue_en(sent) -> bool:
    """Return True if this sentence is (part of) dialogue and should be skipped by SDT."""
    quote_chars = {'"', '\u201c', '\u201d', '\u00ab', '\u00bb', "'", '\u2018', '\u2019'}
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


def _detect_emotion_label_en(sent) -> dict | None:
    """Detect: linking verb + emotion adjective (e.g. 'She was furious')."""
    for token in sent:
        if token.lemma_ in LINKING_VERBS_EN:
            for child in token.children:
                if child.pos_ == "ADJ":
                    lemma = child.lemma_.lower()
                    if lemma in STATE_EXEMPTIONS_EN:
                        continue
                    if lemma in EMOTION_LEXICON_EN:
                        start_char = min(token.idx, child.idx)
                        end_char = max(token.idx + len(token.text), child.idx + len(child.text))
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


def _analyze_show_dont_tell(
    plain_text: str,
    language: str,
    confidence_threshold: float = 0.5,
    cap: int = 5
) -> list[dict]:
    """4-detector show-don't-tell pipeline with dialogue exclusion."""
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
        _detect_filter_verb_en,
        _detect_realize_verb_en,
        _detect_adverb_emotion_en,
    ]

    seen_offsets: set = set()
    for sent in doc.sents:
        if len(suggestions) >= cap:
            break
        if _is_dialogue_en(sent):
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
            if start_char in seen_offsets:
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
            md_path = os.path.join(req.project_path, "md", ch["md_filename"])
            if not os.path.exists(md_path):
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

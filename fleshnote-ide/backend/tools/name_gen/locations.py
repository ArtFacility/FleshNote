import random
import re
from typing import Literal, Optional
from pydantic import BaseModel, Field
from string import capwords
import os
import sys

# Add the backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nlp_manager import get_nlp
from nltk_manager import ensure_cmudict_available, get_synonyms


class LocationNameGenConfig(BaseModel):
    genre: Literal["fantasy", "scifi"] = "fantasy"
    geography: str = ""
    history: str = ""
    founder: str = ""
    native_tongue: str = ""
    mythos: str = ""
    drift: int = Field(0, ge=0, le=100)
    language: str = "en"
    site_type: str = "planet"
    importance: str = "medium"
    vowel_harmony: bool = False


# ─── Words that add no value to location names ───────────────────────────────
_FILLER_WORDS = {
    "the", "a", "an", "of", "and", "in", "on", "at", "to", "for", "with",
    "is", "are", "was", "were", "land", "place", "area", "work", "job",
    "lot", "many", "days", "hard", "great", "some", "very", "much", "thing",
    "part", "type", "kind", "form", "way", "use", "day", "man", "men",
    "people", "person", "group", "set", "number", "point", "case", "fact",
    "state", "light", "bit", "end", "time", "year", "here", "there", "where",
    "this", "that", "region", "zone", "age", "ago", "its", "their", "it",
    "he", "she", "they", "been", "have", "has", "had", "not", "but", "also",
    "between", "under", "over", "after", "before", "through", "into",
}

# ─── Hungarian thematic supplements for WordNet gaps ─────────────────────────
# These are used when get_synonyms() returns nothing for Hungarian words
_HU_THEMATIC_SUPPLEMENTS = {
    # War / conflict (háború, csata etc. return empty in WordNet)
    "háború":    ["viszály", "csata", "ostrom", "harc", "küzdelem"],
    "csata":     ["harc", "ütközet", "küzdelem", "viaskodás"],
    "ostrom":    ["vívás", "megszállás", "harc", "csata"],
    # Royalty
    "király":    ["fejedelem", "vezér", "úr", "trón", "korona"],
    "királyság": ["fejedelemség", "uralom", "birodalom", "ország"],
    "fejedelem": ["úr", "vezér", "király"],
    # Myth / supernatural (sárkány etc. empty in WordNet)
    "sárkány":   ["szörny", "fenevad", "bestia", "kígyó"],
    "varázs":    ["mágia", "bűbáj", "bűvölet", "átok"],
    "átok":      ["átokverte", "bűbáj", "varázslat"],
    "táltos":    ["varázsló", "sámán", "jós", "bölcs"],
    # Darkness (sötét returns emotional synonyms only)
    "sötét":     ["komor", "árnyékos", "homályos", "sötétes"],
    "sötétség":  ["homály", "árny", "éj", "éjszaka"],
    "komor":     ["zordon", "rideg", "borús", "szomorú"],  # here emotional is OK (adj)
    # Geography gaps
    "hullócsillag": ["meteor", "égitest", "tűzgömb"],
    "csúcs":     ["orom", "tető", "hegy", "szirt"],
    "sziget":    ["zátony", "félsziget"],
}

_FORBIDDEN_HUNGARIAN_ROOTS = {
    "paradicsom", "villany", "autó", "motor", "gép", "iskola",
    "egyetem", "rendőrség", "kórház", "gyár", "üzem"
}


def _extract_pos(text: str, nlp, allowed_pos: set) -> list[str]:
    """Extract tokens matching given POS tags from text."""
    if not text.strip():
        return []
    try:
        doc = nlp(text)
        tokens = [token.text for token in doc if token.pos_ in allowed_pos and not token.is_stop]
        if not tokens:
            tokens = [w for w in text.split() if w]
        return tokens
    except Exception:
        return [w for w in text.split() if w]


def _clean_synonym(word: str, lang: str) -> bool:
    """
    Strict quality gate for WordNet synonyms entering the name generator.
    Returns True only for words suitable for use in fantasy location names.
    """
    if not word:
        return False
    # Must be all alpha (no digits, spaces, hyphens in the middle)
    if not word.replace("-", "").isalpha():
        return False
    # Named entities / proper nouns start with a capital — reject them
    if len(word) > 1 and word[0].isupper():
        return False
    # Multi-word phrases (should already be filtered by isalpha, but be explicit)
    if " " in word:
        return False
    # Too long to form good compounds
    if len(word) > 12:
        return False
    # Too short to mean anything
    if len(word) < 3:
        return False
# NEW: Semantic Check
    if lang == "hun" and word.lower() in _FORBIDDEN_HUNGARIAN_ROOTS:
        return False
    return True


def _enrich_with_synonyms(words: list, lang: str = "eng") -> list:
    """
    Add WordNet synonyms to a word list with strict quality filtering.
    Rejects emotional/abstract synsets, named entities, and multi-word phrases.
    Falls back to Hungarian thematic supplements when WordNet returns nothing.
    """
    enriched = list(words)
    for w in words:
        if random.random() > 0.5:  # Enrich ~50% of words, avoid over-enriching
            groups = get_synonyms(w, lang)

            found_any = False
            for group in groups:
                defn = group.get("definition", "").lower()
                pos = group.get("pos", "")

                # Reject psychological/emotional synsets when they appear for
                # words that should be concrete geography/history terms
                if any(kw in defn for kw in [
                    "feeling", "emotion", "state of mind", "mood",
                    "psychological", "mental state", "affect", "disposition",
                    "characterized by", "showing"
                ]):
                    continue

                # Only nouns (n) and adjectives (a, s) are useful here
                if pos not in ("n", "a", "s"):
                    continue

                syns = list(group.get("synonyms", []))
                random.shuffle(syns)
                for syn in syns:
                    if _clean_synonym(syn, lang) and syn.lower() not in _FILLER_WORDS:
                        enriched.append(syn)
                        found_any = True
                        break  # One synonym per synset is enough
                if found_any:
                    break

            # Hungarian thematic supplement when WordNet returned nothing useful
            if not found_any and lang == "hun":
                supplement = _HU_THEMATIC_SUPPLEMENTS.get(w.lower(), [])
                if supplement:
                    enriched.append(random.choice(supplement))

    return enriched


def generate_location_name(config: LocationNameGenConfig) -> str:
    ensure_cmudict_available()

    try:
        nlp = get_nlp(config.language)
    except Exception:
        print(f"[WARN] Could not load NLP for '{config.language}', falling back to 'en'.")
        nlp = get_nlp("en")

    nltk_lang = "eng"
    if config.language == "hu":
        nltk_lang = "hun"
    elif config.language == "pl":
        nltk_lang = "pol"

    # ─── Extract and enrich ───────────────────────────────────────────────
    # Geo noun/adj and history get synonym enrichment
    geo_nouns = _enrich_with_synonyms(
        [w for w in _extract_pos(config.geography, nlp, {"NOUN", "PROPN"}) if w.lower() not in _FILLER_WORDS],
        nltk_lang
    )
    geo_adjs = _enrich_with_synonyms(
        [w for w in _extract_pos(config.geography, nlp, {"ADJ"}) if w.lower() not in _FILLER_WORDS],
        nltk_lang
    )
    hist_nouns = _enrich_with_synonyms(
        [w for w in _extract_pos(config.history, nlp, {"NOUN", "PROPN"}) if w.lower() not in _FILLER_WORDS],
        nltk_lang
    )
    # Founders: PROPN only, NO synonym enrichment (proper names have no useful synonyms)
    founders = [
        w for w in _extract_pos(config.founder, nlp, {"PROPN", "NOUN"})
        if w.lower() not in _FILLER_WORDS
    ]
    # Mythos gets enrichment
    mythos = _enrich_with_synonyms(
        [w for w in _extract_pos(config.mythos, nlp, {"PROPN", "NOUN"}) if w.lower() not in _FILLER_WORDS],
        nltk_lang
    )
    # Native tongue: raw split, no NLP, no enrichment — used verbatim
    native_words = [w for w in config.native_tongue.split() if w.lower() not in _FILLER_WORDS]

    # ─── Build context — None means field was truly empty ─────────────────
    all_extracted: set = set()

    def pick(choices) -> Optional[str]:
        """Pick a word from the list, avoiding repeats across slots."""
        if not choices:
            return None
        valid = [c for c in choices if c.lower() not in all_extracted]
        if not valid:
            valid = choices
        ch = random.choice(valid)
        all_extracted.add(ch.lower())
        return ch

    context = {
        "geo_noun":  pick(geo_nouns),
        "hist_noun": pick(hist_nouns),
        "geo_adj":   pick(geo_adjs),
        "founder":   pick(founders),
        "myth":      pick(mythos),
        "native":    pick(native_words),
    }

    # ─── Generate via language strategy ──────────────────────────────────
    from .location_langs import get_strategy
    strategy = get_strategy(config.language)
    options = strategy.generate_options(config, context)

    # ─── Post-generation validation ───────────────────────────────────────
    valid_options = []
    for opt in options:
        if not opt or not opt.strip():
            continue
        opt = opt.strip()

        # Length gate
        if len(opt) < 3 or len(opt) > 35:
            continue

        words = opt.split()

        # Too many words — it's a sentence, not a name
        if len(words) > 4:
            continue

        # Reject if any word appears more than once (case-insensitive)
        lower_words = [w.lower() for w in words]
        if len(lower_words) != len(set(lower_words)):
            continue

        # Reject digits unless sci-fi
        if config.genre != "scifi" and any(c.isdigit() for c in opt):
            continue

        # Reject impossible consonant clusters (4+ in a row, Latin-alphabet only)
        if re.search(r'[bcdfghjklmnpqrstvwxz]{4}', opt.lower()):
            continue

        valid_options.append(opt)

    # Deduplicate case-insensitively
    seen: set = set()
    final = []
    for opt in valid_options:
        key = opt.lower()
        if key not in seen:
            seen.add(key)
            final.append(opt)

    return random.choice(final) if final else "Unknown"

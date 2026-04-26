"""
phonology.py — Shared Phonology Helpers

These functions are used by the procedural engine and preset generators
to enforce sound-quality rules on generated name strings.
"""

from __future__ import annotations
import random
import unicodedata


# ---------------------------------------------------------------------------
# Character sets
# ---------------------------------------------------------------------------

BASE_VOWELS = set("aeiouy")

# Latin-extended vowels (Hungarian / Romance / Germanic accents etc.)
SPECIAL_VOWELS = set("áéíóöőúüűàèìòùâêîôûäëïöüãõ")

# All vowels we know about
ALL_VOWELS = BASE_VOWELS | SPECIAL_VOWELS

# Front / back sets for vowel harmony (Hungarian-style)
FRONT_VOWELS = set("eéiíöőüű")
BACK_VOWELS  = set("aáoóuú")

# Front ↔ Back replacement map for vowel harmony
FRONT_TO_BACK: dict[str, str] = {
    "e": "a", "é": "á", "i": "u", "í": "ú",
    "ö": "o", "ő": "ó", "ü": "u", "ű": "ú",
}
BACK_TO_FRONT: dict[str, str] = {v: k for k, v in FRONT_TO_BACK.items()}

# Optional extra vowels injected when allow_special_vowels is True
EXTRA_VOWELS = list(SPECIAL_VOWELS)

# Optional Latin-extended consonants for allow_special_consonants
SPECIAL_CONSONANTS = list("çñłżšžčćđðþß")

# Hard/harsh consonant clusters banned when no_hard_consonants=True
HARD_STARTS = {"x", "q", "xr", "xk", "xc", "xz", "qr", "qz"}


# ---------------------------------------------------------------------------
# Helper: is a character a vowel?
# ---------------------------------------------------------------------------

def is_vowel(ch: str) -> bool:
    """Return True if ch is any known vowel (including accented forms)."""
    return ch.lower() in ALL_VOWELS


# ---------------------------------------------------------------------------
# Consonant cluster smoothing
# ---------------------------------------------------------------------------

def smooth_consonant_clusters(text: str, max_cc: int = 2) -> str:
    """
    Insert a random short vowel whenever consecutive consonants exceed max_cc.

    max_cc=1 → very soft/vowel-heavy
    max_cc=2 → balanced (default)
    max_cc=3 → allows harsh/guttural bursts
    """
    filler_vowels = ["a", "e", "i", "o", "u"]
    smoothed: list[str] = []
    consecutive = 0

    for ch in text:
        if is_vowel(ch):
            consecutive = 0
        else:
            # Don't count separator characters as consonants
            if ch in ("-", "'", " "):
                consecutive = 0
            else:
                consecutive += 1

        if consecutive > max_cc:
            smoothed.append(random.choice(filler_vowels))
            consecutive = 1  # the current consonant restarts the count

        smoothed.append(ch)

    return "".join(smoothed)


# ---------------------------------------------------------------------------
# Vowel cluster smoothing
# ---------------------------------------------------------------------------

def smooth_vowel_clusters(text: str) -> str:
    """
    Randomly insert a consonant between consecutive vowels, 
    with increasing probability for longer vowel chains.
    """
    filler_consonants = ["r", "l", "m", "n", "s", "t", "v", "z", "k", "th"]
    smoothed: list[str] = []
    consecutive = 0

    for ch in text:
        if is_vowel(ch):
            consecutive += 1
            prob = 0.0
            if consecutive == 2:
                prob = 0.20
            elif consecutive == 3:
                prob = 0.70
            elif consecutive >= 4:
                prob = 1.0
                
            if random.random() < prob:
                smoothed.append(random.choice(filler_consonants))
                consecutive = 1
        else:
            consecutive = 0

        smoothed.append(ch)

    return "".join(smoothed)

# ---------------------------------------------------------------------------
# Double-vowel cleanup
# ---------------------------------------------------------------------------

def apply_double_vowel_rules(text: str) -> str:
    """
    Replace awkward doubled vowels with nicer diphthong variants.
    Preserves intentional accented doubles (e.g. áá is rare, not an issue).
    """
    replacements = [
        ("uu", "uo"),
        ("ii", "ia"),
        ("aa", "ae"),
        ("oo", "ou"),
        ("ee", "ea"),
    ]
    for bad, good in replacements:
        text = text.replace(bad, good)
    return text


# ---------------------------------------------------------------------------
# Vowel harmony
# ---------------------------------------------------------------------------

def apply_vowel_harmony(text: str, mode: str) -> str:
    """
    Shift all vowels in 'text' toward front or back harmony.

    mode="front" → replace back vowels with front equivalents
    mode="back"  → replace front vowels with back equivalents
    mode="none"  → no-op
    """
    if mode == "none":
        return text

    result: list[str] = []
    for ch in text:
        lower = ch.lower()
        if mode == "front" and lower in BACK_TO_FRONT:
            replacement = BACK_TO_FRONT[lower]
            result.append(replacement.upper() if ch.isupper() else replacement)
        elif mode == "back" and lower in FRONT_TO_BACK:
            replacement = FRONT_TO_BACK[lower]
            result.append(replacement.upper() if ch.isupper() else replacement)
        else:
            result.append(ch)
    return "".join(result)


# ---------------------------------------------------------------------------
# Hard-consonant filter
# ---------------------------------------------------------------------------

def strip_hard_consonants_from_start(part: str) -> str:
    """
    If 'part' starts with a known harsh cluster, replace the leading
    character with a softer alternative. Applied to prefixes when
    no_hard_consonants=True.
    """
    # If starts with X, Q → swap to softer letter
    soft_replacements = {"x": "s", "q": "k"}
    if part and part[0].lower() in soft_replacements:
        repl = soft_replacements[part[0].lower()]
        return (repl.upper() if part[0].isupper() else repl) + part[1:]
    return part


# ---------------------------------------------------------------------------
# Forced-sound injection
# ---------------------------------------------------------------------------

def apply_forced_sounds(text: str, config) -> str:
    """
    Post-process 'text' to satisfy force_starts_with / force_ends_with /
    force_contains constraints from config.

    This is a best-effort injection — it prepends/appends the required
    fragment rather than regenerating from scratch, keeping it fast.
    The caller should still validate length constraints afterwards.
    """
    # force_starts_with
    if config.force_starts_with:
        fs = config.force_starts_with
        if not text.lower().startswith(fs.lower()):
            # Capitalise the forced start, attach the remainder of the name
            # cut off the same number of chars to keep length stable
            tail = text[len(fs):] if len(text) > len(fs) else text
            text = fs.capitalize() + tail

    # force_ends_with
    if config.force_ends_with:
        fe = config.force_ends_with
        if not text.lower().endswith(fe.lower()):
            # Trim the tail to make room, then append
            trim_to = max(1, len(text) - len(fe))
            text = text[:trim_to] + fe

    # force_contains — only add if genuinely missing
    if config.force_contains:
        fc = config.force_contains
        if fc.lower() not in text.lower():
            # Insert in the middle of the name
            mid = len(text) // 2
            text = text[:mid] + fc + text[mid:]

    return text


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_phonology(text: str, config) -> bool:
    """
    Return True if 'text' satisfies all hard constraints in config.
    Used by the generator loop to decide whether to accept a candidate.
    """
    # Length
    if len(text) < config.min_length or len(text) > config.max_length:
        return False

    # force_starts_with
    if config.force_starts_with:
        if not text.lower().startswith(config.force_starts_with.lower()):
            return False

    # force_ends_with
    if config.force_ends_with:
        if not text.lower().endswith(config.force_ends_with.lower()):
            return False

    # force_contains
    if config.force_contains:
        if config.force_contains.lower() not in text.lower():
            return False

    # no_hard_consonants — check for clusters of 3+ distinct consonants at start
    if config.no_hard_consonants:
        start = text.lstrip("'-").lower()
        if start and start[0] in {"x", "q"}:
            return False
        # Count leading consonant run
        cc = 0
        for ch in start:
            if not is_vowel(ch) and ch not in ("-", "'"):
                cc += 1
            else:
                break
        if cc > 2:
            return False

    return True


# ---------------------------------------------------------------------------
# Separator cleanup
# ---------------------------------------------------------------------------

def strip_separators(text: str, allow_hyphen: bool, allow_apostrophe: bool) -> str:
    """Remove separator characters the user doesn't want."""
    result = text
    if not allow_hyphen:
        result = result.replace("-", "")
    if not allow_apostrophe:
        result = result.replace("'", "")
    return result


# ---------------------------------------------------------------------------
# Special character pools (opt-in)
# ---------------------------------------------------------------------------

def get_special_vowel_pool() -> list[str]:
    """Return the pool of accented vowels for use in word-part tables."""
    return list(SPECIAL_VOWELS)


def get_special_consonant_pool() -> list[str]:
    """Return the pool of Latin-extended consonants."""
    return SPECIAL_CONSONANTS.copy()

"""
procedural.py — Fully Configurable Procedural Name Engine

This is the upgraded successor to the original name_gen.py generator.
All behaviour is driven by NameGenConfig.
"""

from __future__ import annotations
import random
from .config import NameGenConfig
from .phonology import (
    smooth_consonant_clusters,
    apply_double_vowel_rules,
    apply_vowel_harmony,
    apply_forced_sounds,
    validate_phonology,
    strip_separators,
    strip_hard_consonants_from_start,
    get_special_vowel_pool,
    get_special_consonant_pool,
)


# ---------------------------------------------------------------------------
# Built-in default word-part tables
# ---------------------------------------------------------------------------

DEFAULT_PREFIXES = [
    # Classic / neutral fantasy
    "Kr", "Tha", "Vek", "Zor", "Qu", "Bly", "Xen", "Dra", "Mra", "Sly",
    "Grel", "Fio", "Ky", "Vra", "Tcho", "Bael", "Ony", "Ith", "Urn", "Ael",
    "Aet", "Bel", "Chr", "Dax", "Eld", "Fal", "Gly", "Hax", "Irv", "Jyn",
    "Kael", "Lyr", "Mox", "Nyx", "Oph", "Pha", "Qor", "Rha", "Syr", "Trev",
    "Uld", "Vyr", "Wol", "Xyl", "Yar", "Zan", "Brax", "Cly", "Dros", "Eon",
    "Fra", "Gho", "Hly", "Jor", "Kru", "Lox", "Myr", "Nox", "Pry", "Qen",
    "Rys", "Ska", "Tuv", "Vex", "Wro", "Xis", "Yll", "Zet", "Azo", "Blyth",
    # Short / ancient
    "Na", "Bus", "R", "Bou", "Pen", "Va", "Po", "Pi",
    # Softer / melodic
    "Ara", "Eli", "Ori", "Ama", "Eri", "Ily", "Ola", "Asa", "Emi", "Ila",
    "Alo", "Ane", "Are", "Aro", "Ary", "Ase", "Asi", "Aso", "Asu",
]

DEFAULT_MIDDLES = [
    # Vowel bridges
    "i", "a", "o", "u", "io", "ae", "un",
    # Consonant bridges
    "sh", "zt", "mm", "ll", "nd",
    # Vowel+consonant
    "en", "ar", "el", "is", "ov", "ath", "om", "et", "iv", "an", "ir",
    "or", "ur", "as", "es", "os", "us", "yl", "yr", "oa", "ea", "ia",
    "ua", "ai", "ei", "oi", "ui", "al", "si", "gi",
    # Separators (stripped later if not allowed)
    "-",
]

DEFAULT_SUFFIXES = [
    # Hard endings
    "x", "th", "n", "m", "v", "k", "t",
    # Melodic endings
    "ra", "sia", "lor", "dos", "ga", "ry", "ne", "sh", "ace", "on",
    "ium", "yx", "bel", "os", "is", "as", "us",
    # Short vowel endings
    "ax", "ix", "ox", "ux", "en", "an", "in", "un",
    # Consonant endings
    "ar", "er", "ir", "or", "ur", "el", "il", "ol", "ul",
    "ath", "ith", "oth", "uth",
    # Named-style endings
    "dar", "mar", "nar", "sar", "tar", "var",
    # Short/ancient
    "ek", "io", "ron", "o", "na", "po", "csa",
]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_pool(config: NameGenConfig, base: list[str], custom: list[str] | None) -> list[str]:
    """
    Merge the base table with any custom entries from config.
    If allow_special_consonants is on, optionally weave in extra consonant options.
    The custom list (if provided) completely replaces the base rather than appending,
    so users have full control.
    """
    pool = list(custom) if custom is not None else list(base)

    # Optionally enrich the pool with special-character variants
    if config.allow_special_vowels:
        # Add some accented-vowel prefixes / middles to the pool
        pool += get_special_vowel_pool()

    if config.allow_special_consonants:
        pool += get_special_consonant_pool()

    return pool


def _apply_hard_consonant_filter(prefix: str, config: NameGenConfig) -> str:
    """Strip or soften harsh starts if no_hard_consonants is set."""
    if config.no_hard_consonants:
        return strip_hard_consonants_from_start(prefix)
    return prefix


def _assemble_candidate(
    prefixes: list[str],
    middles: list[str],
    suffixes: list[str],
    config: NameGenConfig,
) -> str:
    """Build a single raw name string from the word-part pools."""
    roll = random.random()

    if roll < config.compound_probability:
        # Long: Prefix + Mid + Mid + Suffix
        mid1 = random.choice(middles)
        mid2 = random.choice([m for m in middles if m != mid1] or middles)
        # If user supplied a forced mid sound, honour it in slot 1
        if config.force_mid_sound:
            mid1 = config.force_mid_sound
        prefix = _apply_hard_consonant_filter(random.choice(prefixes), config)
        raw = prefix + mid1 + mid2 + random.choice(suffixes)

    elif roll < config.compound_probability + config.short_probability:
        # Short/Ancient: Prefix + Suffix
        prefix = _apply_hard_consonant_filter(random.choice(prefixes), config)
        raw = prefix + random.choice(suffixes)

    else:
        # Standard: Prefix + Mid + Suffix
        mid = config.force_mid_sound if config.force_mid_sound else random.choice(middles)
        prefix = _apply_hard_consonant_filter(random.choice(prefixes), config)
        raw = prefix + mid + random.choice(suffixes)

    return raw


# ---------------------------------------------------------------------------
# Public generator
# ---------------------------------------------------------------------------

def generate_procedural_name(config: NameGenConfig) -> str:
    """
    Generate a single procedural name according to config.
    Retries up to config.max_retries times to satisfy uniqueness and
    phonology constraints.
    """
    prefixes = _build_pool(config, DEFAULT_PREFIXES, config.custom_prefixes)
    middles  = _build_pool(config, DEFAULT_MIDDLES,  config.custom_middles)
    suffixes = _build_pool(config, DEFAULT_SUFFIXES, config.custom_suffixes)

    # Remove separator middles if user doesn't want them
    if not config.allow_hyphen_separator:
        middles = [m for m in middles if m != "-"]
    if not config.allow_apostrophe_separator:
        middles = [m for m in middles if m != "'"]

    existing = set(config.existing_names or [])

    def attempt() -> str:
        raw = _assemble_candidate(prefixes, middles, suffixes, config)

        # 1. Double-vowel cleanup
        raw = apply_double_vowel_rules(raw)

        # 2. Consonant cluster smoothing
        raw = smooth_consonant_clusters(raw, config.max_consecutive_consonants)

        # 3. Separator cleanup (belt-and-suspenders for any separators in suffixes/prefixes)
        raw = strip_separators(raw, config.allow_hyphen_separator, config.allow_apostrophe_separator)

        # 4. Vowel harmony
        raw = apply_vowel_harmony(raw, config.vowel_harmony)

        # 5. Forced sounds (best-effort injection)
        raw = apply_forced_sounds(raw, config)

        # 6. Length enforcement
        if len(raw) > config.max_length:
            raw = raw[:config.max_length]
        # If too short after all that, pad with a suffix fragment
        while len(raw) < config.min_length and suffixes:
            raw += random.choice([s for s in suffixes if s not in ("-", "'")] or suffixes)

        # 7. Capitalisation
        if config.capitalize_each_part:
            raw = raw.capitalize()

        return raw

    candidate = attempt()
    retries = 0

    while retries < config.max_retries:
        if not validate_phonology(candidate, config):
            candidate = attempt()
            retries += 1
            continue
        if existing and candidate in existing:
            candidate = attempt()
            retries += 1
            continue
        break  # all good

    return candidate


# ---------------------------------------------------------------------------
# Offspring name
# ---------------------------------------------------------------------------

def generate_offspring_name(
    parent1: str,
    parent2: str,
    existing_names: list[str] | None = None,
) -> str:
    """
    Generate a portmanteau name from two parent names.

    Takes the first 3 chars of parent1 and last 3 of parent2.
    If that combination is already taken, appends a generation counter.

    "Parental naming influence" (inheriting the parents' configs and generating
    a fully themed offspring name) is a planned future feature.
    """
    # Take first half of parent1 + second half of parent2
    p1_slice = parent1[:max(3, len(parent1) // 2)]
    p2_slice = parent2[-(max(3, len(parent2) // 2)):]

    base = (p1_slice + p2_slice).capitalize()

    # Minimal double-vowel cleanup on the seam
    base = apply_double_vowel_rules(base)

    existing = set(existing_names or [])
    final = base
    counter = 2
    while final in existing:
        final = f"{base}-{counter}"
        counter += 1

    return final

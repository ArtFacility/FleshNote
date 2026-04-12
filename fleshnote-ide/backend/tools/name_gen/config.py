"""
config.py — Name Generator Configuration

All user-facing options live here as a single dataclass.
Pass one of these to generate_name() in __init__.py.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal


# ---------------------------------------------------------------------------
# Vowel sets used by phonology helpers (imported here so config can reference
# them in docstrings / validation without a circular import)
# ---------------------------------------------------------------------------

# "Front" vowels (tongue forward/high): e é i í ö ő ü ű
FRONT_VOWELS = set("eéiíöőüű")
# "Back" vowels (tongue back): a á o ó u ú
BACK_VOWELS  = set("aáoóuú")
ALL_VOWELS   = FRONT_VOWELS | BACK_VOWELS | set("aeiouy")


# ---------------------------------------------------------------------------
# Main config
# ---------------------------------------------------------------------------

@dataclass
class NameGenConfig:
    """
    Configuration for the name generator.

    All fields have sensible defaults so you can do:
        cfg = NameGenConfig()          # plain procedural
        cfg = NameGenConfig(mode="real", real_origin="hungarian")
        cfg = NameGenConfig(mode="preset", preset_name="elvish")
    """

    # -----------------------------------------------------------------------
    # Mode selection
    # -----------------------------------------------------------------------
    mode: Literal["real", "preset", "procedural"] = "procedural"
    """
    "real"       → pick a real first + last name from a CSV dataset
    "preset"     → use a YAML archetype (elvish / orcish / nordic / scifi …)
    "procedural" → fully custom procedural engine
    """

    # -----------------------------------------------------------------------
    # Real-name options  (only used when mode == "real")
    # -----------------------------------------------------------------------
    real_origin: str = "english"
    """
    Cultural/language origin of the name pool.
    Supported values match the CSV filenames in data/real/:
      "english", "hungarian"  (more can be added later)
    """

    real_gender: Literal["any", "male", "female"] = "any"
    """
    Gender filter applied to real name lookup.
    'any' uses the full pool regardless of gender column.
    """

    real_flip_surname: bool = False
    """
    If true, surname is placed before first name (e.g. Hungarian/Japanese order).
    """

    # -----------------------------------------------------------------------
    # Preset options  (only used when mode == "preset")
    # -----------------------------------------------------------------------
    preset_name: str = "elvish"
    """
    Name of the YAML file (without .yaml) in data/presets/.
    Built-in options: elvish, orcish, nordic, scifi
    Users can drop their own YAML files in data/presets/ and use them here.
    """

    # -----------------------------------------------------------------------
    # Procedural – word-part overrides
    # -----------------------------------------------------------------------
    custom_prefixes: list[str] | None = None
    """Override the built-in prefix list with your own. None = use defaults."""

    custom_middles: list[str] | None = None
    """Override the built-in middle list with your own. None = use defaults."""

    custom_suffixes: list[str] | None = None
    """Override the built-in suffix list with your own. None = use defaults."""

    # -----------------------------------------------------------------------
    # Procedural – structure / separators
    # -----------------------------------------------------------------------
    allow_hyphen_separator: bool = True
    """Allow '-' as a syllable separator (e.g. Zan-ir). Set False to remove."""

    allow_apostrophe_separator: bool = False
    """Allow "'" as a separator (e.g. D'Arc, Kel'thar). Off by default."""

    compound_probability: float = 0.10
    """
    Probability (0.0–1.0) that a name uses the long Prefix+Mid+Mid+Suffix
    structure instead of the standard Prefix+Mid+Suffix.
    """

    short_probability: float = 0.25
    """
    Probability that a name is the short Prefix+Suffix structure
    (only applies when compound_probability roll fails).
    """

    # -----------------------------------------------------------------------
    # Phonology – consonant rules
    # -----------------------------------------------------------------------
    no_hard_consonants: bool = False
    """
    When True, bans hard/harsh-sounding letter patterns at the start of name
    parts: X (as /ks/), Q, and clusters of 3+ different consonants.
    Good for soft / melodic names.
    """

    max_consecutive_consonants: int = 2
    """
    Maximum allowed consonants in a row before a vowel is forcibly inserted.
      1 → very soft/vowel-heavy (elvish style)
      2 → balanced (default)
      3 → guttural/harsh (orcish style)
    """

    # -----------------------------------------------------------------------
    # Phonology – vowel rules
    # -----------------------------------------------------------------------
    vowel_harmony: Literal["none", "front", "back"] = "none"
    """
    Hungarian/Turkic-style vowel harmony.
      "none"  → no enforcement
      "front" → all vowels shifted to front vowels (e, i, ö, ü …)
      "back"  → all vowels shifted to back vowels (a, o, u …)
    """

    allow_special_vowels: bool = False
    """
    Allow accented/extended Latin vowels: Á É Ő Ú Ű Ó Ü Ö Í and lowercase.
    Adds these characters to the vowel pool used by the engine.
    """

    allow_special_consonants: bool = False
    """
    Allow Latin-extended consonants: ç ñ ł ß đ ð þ ž š č etc.
    Adds these to the consonant pool used during generation.
    """

    allow_non_latin: bool = False
    """
    [STUB — not yet implemented]
    Future: allow Cyrillic, Greek, Arabic, etc. characters in generated names.
    """

    # -----------------------------------------------------------------------
    # Phonology – forced sounds
    # -----------------------------------------------------------------------
    force_starts_with: str | None = None
    """
    If set, the output name will begin with exactly this string (case-insensitive
    match after capitalization). E.g. force_starts_with="Ar" → "Ardos", "Ariel"…
    """

    force_ends_with: str | None = None
    """
    If set, the output name will end with exactly this string.
    E.g. force_ends_with="us" → "Vexus", "Tharius"…
    """

    force_contains: str | None = None
    """
    If set, this substring will appear somewhere in the name.
    """

    force_mid_sound: str | None = None
    """
    Replaces the middle syllable slot with exactly this string.
    Useful for naming conventions like "all names of this clan contain 'ar'".
    """

    # -----------------------------------------------------------------------
    # Output options
    # -----------------------------------------------------------------------
    capitalize_each_part: bool = True
    """Capitalize the first letter of each word/part in the final name."""

    max_length: int = 12
    """Maximum character length of the generated name (truncate if exceeded)."""

    min_length: int = 3
    """Minimum character length. Names shorter than this are regenerated."""

    existing_names: list[str] | None = None
    """
    Pool of already-used names. The generator will retry to avoid duplicates.
    """

    max_retries: int = 20
    """How many times to retry generation before giving up on uniqueness."""

    # -----------------------------------------------------------------------
    # Serialization helpers
    # -----------------------------------------------------------------------
    def to_dict(self) -> dict:
        """Convert config to a plain dict (for JSON/settings persistence)."""
        import dataclasses
        return dataclasses.asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "NameGenConfig":
        """Restore a config from a plain dict (loaded from JSON/settings)."""
        # Only keep keys that are valid fields
        import dataclasses
        valid = {f.name for f in dataclasses.fields(cls)}
        filtered = {k: v for k, v in data.items() if k in valid}
        return cls(**filtered)

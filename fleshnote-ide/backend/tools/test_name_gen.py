"""
test_name_gen.py — Standalone test runner for the name_gen package.

Run from the backend/tools directory:
    python test_name_gen.py

Or from the backend root:
    python tools/test_name_gen.py
"""

import sys
import os

# Allow running from either tools/ or backend/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from name_gen import generate_name, generate_offspring_name, NameGenConfig, list_presets, list_origins

SEP = "─" * 60

def section(title: str):
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)

def batch(label: str, config: NameGenConfig, n: int = 12):
    names = [generate_name(config) for _ in range(n)]
    print(f"\n[{label}]")
    print("  " + "  |  ".join(names))


# ── Real names ──────────────────────────────────────────────────────────────

section("REAL NAMES — Available origins")
print(f"  {list_origins()}")

section("REAL NAMES — English (any gender)")
cfg = NameGenConfig(mode="real", real_origin="english")
batch("English any", cfg)

section("REAL NAMES — English female")
cfg = NameGenConfig(mode="real", real_origin="english", real_gender="female")
batch("English female", cfg)

section("REAL NAMES — Hungarian (any gender)")
cfg = NameGenConfig(mode="real", real_origin="hungarian")
batch("Hungarian any", cfg)

section("REAL NAMES — Hungarian male")
cfg = NameGenConfig(mode="real", real_origin="hungarian", real_gender="male")
batch("Hungarian male", cfg)


# ── Presets ─────────────────────────────────────────────────────────────────

section("PRESETS — Available presets")
print(f"  {list_presets()}")

for preset in list_presets():
    section(f"PRESET — {preset.upper()}")
    cfg = NameGenConfig(mode="preset", preset_name=preset)
    batch(preset, cfg)


# ── Procedural configs ───────────────────────────────────────────────────────

section("PROCEDURAL — Default settings")
batch("default", NameGenConfig())

section("PROCEDURAL — Soft / melodic (no hard consonants, max 1 CC)")
batch("soft", NameGenConfig(no_hard_consonants=True, max_consecutive_consonants=1))

section("PROCEDURAL — Guttural (max 3 consecutive consonants)")
batch("guttural", NameGenConfig(max_consecutive_consonants=3, no_hard_consonants=False))

section("PROCEDURAL — Front vowel harmony")
batch("front harmony", NameGenConfig(vowel_harmony="front"))

section("PROCEDURAL — Back vowel harmony")
batch("back harmony", NameGenConfig(vowel_harmony="back"))

section("PROCEDURAL — Special vowels enabled")
batch("special vowels", NameGenConfig(allow_special_vowels=True))

section("PROCEDURAL — Force starts with 'Ar'")
batch("starts:Ar", NameGenConfig(force_starts_with="Ar"))

section("PROCEDURAL — Force ends with 'us'")
batch("ends:us", NameGenConfig(force_ends_with="us"))

section("PROCEDURAL — Force contains 'ara'")
batch("contains:ara", NameGenConfig(force_contains="ara"))

section("PROCEDURAL — No hyphens, no apostrophes")
batch("no seps", NameGenConfig(allow_hyphen_separator=False, allow_apostrophe_separator=False))

section("PROCEDURAL — Apostrophe style (D'Arc etc.)")
batch("apostrophe", NameGenConfig(allow_apostrophe_separator=True, allow_hyphen_separator=False,
                                   custom_middles=["'al", "'ar", "'an", "'el", "'ir", "'or"]))

section("PROCEDURAL — Uniqueness check (pool of 50, generate 10)")
existing = set()
unique_names = []
for _ in range(10):
    cfg = NameGenConfig(existing_names=list(existing))
    n = generate_name(cfg)
    unique_names.append(n)
    existing.add(n)
print(f"  Generated: {unique_names}")
print(f"  All unique: {len(unique_names) == len(set(unique_names))}")


# ── Offspring ────────────────────────────────────────────────────────────────

section("OFFSPRING NAMES")
pairs = [
    ("Vexion", "Aelorash"),
    ("Grakkur", "Throkdak"),
    ("Sylmiriel", "Faewanel"),
    ("Ragnar", "Svengard"),
]
for p1, p2 in pairs:
    result = generate_offspring_name(p1, p2)
    print(f"  {p1} + {p2} → {result}")


# ── Config serialization ─────────────────────────────────────────────────────

section("CONFIG SERIALIZATION — to_dict / from_dict round-trip")
original = NameGenConfig(
    mode="procedural",
    no_hard_consonants=True,
    vowel_harmony="front",
    force_starts_with="Ar",
    max_length=10,
)
d = original.to_dict()
restored = NameGenConfig.from_dict(d)
print(f"  Original:  vowel_harmony={original.vowel_harmony}, force_starts_with={original.force_starts_with}")
print(f"  Restored:  vowel_harmony={restored.vowel_harmony}, force_starts_with={restored.force_starts_with}")
print(f"  Match: {original == restored}")

print(f"\n{SEP}")
print("  All tests passed!")
print(SEP)

# FleshNote Name Generator

A modular, standalone, and highly configurable name generation system built for the FleshNote IDE.

## Overview

The system has four generation modes:

1. **Real Mode (`mode="real"`)** — Pulls from curated real-world name datasets (CSV). Supports gendered surnames (e.g. Polish -ski/-ska).
2. **Preset Mode (`mode="preset"`)** — Uses archetype-specific word-part tables (YAML) for fantasy or sci-fi themes.
3. **Procedural Mode (`mode="procedural"`)** — A fully tunable engine that builds names syllable-by-syllable using phonology rules.
4. **Location Mode** — Context-aware location name generation. Separate system with its own config and language strategy classes.

---

## Character Name Generator

### Usage

```python
from tools.name_gen import generate_name, NameGenConfig

# Quickest: all defaults (procedural)
name = generate_name()

# Using a preset
name = generate_name(mode="preset", preset_name="elvish")

# Using a real-world dataset with gender-aware surnames
name = generate_name(mode="real", real_origin="polish", real_gender="female")
# → "Katarzyna Kowalska" (correctly applies -ska ending)

# Fully custom procedural config
cfg = NameGenConfig(
    mode="procedural",
    no_hard_consonants=True,
    vowel_harmony="front",
    force_starts_with="Ar",
    max_length=10
)
name = generate_name(cfg)
```

### `NameGenConfig` Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `mode` | `str` | `"procedural"`, `"preset"`, or `"real"` |
| `real_origin` | `str` | CSV filename in `data/real/` (e.g. `"polish"`, `"hungarian"`) |
| `real_gender` | `str` | `"any"`, `"male"`, or `"female"` |
| `preset_name` | `str` | YAML filename in `data/presets/` (e.g. `"elvish"`, `"orcish"`) |
| `no_hard_consonants` | `bool` | Bans X, Q, and triple-consonant starts |
| `max_consecutive_consonants` | `int` | 1 = very soft, 3 = guttural |
| `vowel_harmony` | `str` | `"none"`, `"front"`, or `"back"` |
| `allow_special_vowels` | `bool` | Enables accented characters (á, é, ő, ú, etc.) |
| `force_starts_with` | `str` | Forces the name to begin with this string |
| `force_ends_with` | `str` | Forces the name to end with this string |
| `existing_names` | `list` | Names to avoid (uniqueness check) |

---

## Data

### Real Name Datasets (`data/real/`)

CSV files with three columns: `name,type,gender`.
- `type`: `first` or `last`
- `gender`: `male`, `female`, or `any`

Gender-aware surnames are fully supported. For Polish, a surname like *Kowalski* (marked `male`) is only paired with male first names; *Kowalska* (marked `female`) only with female first names; *Nowak* (marked `any`) appears for both.

### Presets (`data/presets/`)

YAML files containing `prefixes`, `middles`, and `suffixes` lists plus an optional `rules` block that overrides phonology engine settings.

```yaml
name: "Elvish"
prefixes: ["Aer", "Ael", "Fae"]
suffixes: ["iel", "wen", "ril"]
rules:
  no_hard_consonants: true
  max_consecutive_consonants: 1
```

New presets are discovered automatically at runtime — no code changes required.

---

## Presets

### `elvish.yaml` — Elvish / High Fantasy

Vowel-heavy, melodic names in the Tolkienesque tradition. Soft consonants, flowing diphthongs (`ae`, `io`, `ia`), long suffixes (`-iel`, `-wen`, `-ara`). Suited for elves, fey, and any civilization with a timeless or ancient aesthetic.

**Rules**: `no_hard_consonants: true`, `max_consecutive_consonants: 1`

### `nordic.yaml` — Nordic / Norse

Short, punchy names with strong consonants and classic Viking-saga compound structures (`Bjor-`, `Rag-`, `-mund`, `-bjorn`). Well suited for dwarves, Vikings, and harsh northern cultures.

**Rules**: `max_consecutive_consonants: 2`, `short_probability: 0.30`

### `orcish.yaml` — Orcish / Guttural

Aggressive consonant clusters, hard stops, and back vowels (`ak`, `ug`, `og`). Vowel harmony is set to `"back"` for consistency throughout the name. Short names feel punchy; longer ones stay menacing.

**Rules**: `max_consecutive_consonants: 3`, `vowel_harmony: "back"`, `short_probability: 0.45`

### `scifi.yaml` — Science Fiction

Futuristic names with varied consonant-vowel structures, optional hyphens, and technical/scientific suffixes. Works for alien species, human colony designations, androids, and megacorp names.

**Rules**: `max_consecutive_consonants: 2`, `allow_hyphen_separator: true`, `compound_probability: 0.25`

---

## Phonology Engine

Applied automatically on every generated name:

- **Consonant Smoothing** — inserts a short vowel whenever consecutive consonants exceed `max_consecutive_consonants`.
- **Double-Vowel Cleanup** — replaces awkward pairs: `uu → uo`, `ii → ia`, `aa → ae`, `oo → ou`, `ee → ea`.
- **Vowel Harmony** — shifts all vowels toward a consistent `"front"` or `"back"` profile when enabled.
- **Hard-Consonant Filter** — strips X/Q starts and breaks up harsh leading clusters when `no_hard_consonants` is set.

---

## Location Name Generator

A separate context-aware system (`tools/name_gen/locations.py`) that turns free-text story fields into place names using NLP extraction and a language-specific strategy.

### How It Works

```
LocationNameGenConfig
    ↓
locations.py
    → spaCy NLP: extract nouns, adjectives, proper nouns from input fields
    → NLTK WordNet: synonym enrichment (50% chance per word)
    ↓
location_langs/<lang>.py  ← one strategy class per language
    ↓
Candidate list → harmonize_and_shorten() → deduplicate → return one name
```

### Language Strategies

| Code | Strategy Class | Notes |
| :--- | :--- | :--- |
| `en` | `EnglishLocationStrategy` | Full fantasy + sci-fi, CMUDict/Arpabet phonetic drift, word shortening |
| `hu` | `HungarianLocationStrategy` | Agglutinative compounds, linguistic possessive forms, vowel harmony, and three-tier phonetic drift (Slur, Syncope, Archaisms). |
| `pl` | `PolishLocationStrategy` | Gender-aware adjective agreement, patronymic suffixation (`-ów`, `-ice`, `-owo`), and phonetic evolution (digraph shifts and syncope). |

### Strategy Logic: Hungarian (`hu`)

The Hungarian strategy models real-world toponymy through complex morphological rules:
- **Possessive Logic**: Automatically calculates the correct possessive form (e.g., *hegy* → *hegye*, *tó* → *tava*) for nouns entered.
- **Vowel Harmony**: Suffixes and compounds are harmonized to match the root's front/back vowel profile.
- **Phonetic Drift**:
    - *Tier 1*: Basic consonant assimilation.
    - *Tier 40+*: Erosion of common endings (e.g., `-hegye` -> `-hegy`).
    - *Tier 75+*: Archaic charter spellings and medieval suffixes (`-d`, `-ony`, `-ény`).
- **Slang Crunching**: Long compounds are surgically shortened while preserving the root's identifying syllables.

### Strategy Logic: Polish (`pl`)

Built on West Slavic naming conventions:
- **Gender Agreement**: Heuristically detects noun gender (F/M/N) and inflects dictionary-form adjectives to match (e.g., *Stary* + *Góra* → *Stara Góra*).
- **Compound Linking**: Fused names use the linking vowel `-o-` (e.g., *Białogard*).
- **Patronymic Suffixation**: Founders and historical figures are turned into village/town names using a randomized pool of common Polish suffixes (`-ów`, `-owo`, `-ice`, `-in`, `-ew`, etc.) to prevent predictable patterns.
- **Phonetic Drift**:
    - *Tier 40+*: Historical digraph shifts simulating older orthography (e.g., `s` -> `sz`, `c` -> `cz`).
    - *Tier 75+*: Medial vowel loss and archaic replacements (shaping modern shortened forms from longer medieval roots).

**Adding a new language:**
1. Create `location_langs/<lang_code>.py` with a class implementing `generate_options(config, context)` and `harmonize_and_shorten(word)`.
2. Register it in `location_langs/__init__.py` under `STRATEGIES`.
3. If the language needs a different NLTK WordNet code, add it to the `nltk_lang` block in `locations.py`.

### `LocationNameGenConfig` Fields

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `genre` | `str` | `"fantasy"` | `"fantasy"` or `"scifi"` |
| `geography` | `str` | `""` | Free-text geography (NLP-extracted for nouns/adjectives) |
| `history` | `str` | `""` | Free-text history |
| `founder` | `str` | `""` | Founder / eponymous figure |
| `native_tongue` | `str` | `""` | Native-language words (fantasy only) |
| `mythos` | `str` | `""` | Mythological references (scifi primarily) |
| `drift` | `int` | `0` | 0–100. Higher = more phonetic evolution on base forms |
| `language` | `str` | `"en"` | BCP-47 code; selects the strategy class |
| `site_type` | `str` | `"planet"` | `"planet"`, `"colony"`, `"facility"`, `"system"` (scifi) |
| `importance` | `str` | `"medium"` | `"high"`, `"medium"`, `"low"` — shapes scifi naming conventions |
| `vowel_harmony` | `bool` | `false` | Enforce Hungarian-style vowel harmony on generated parts |

---

## Testing

```bash
# Character name generator (all modes and config combos)
python tools/test_name_gen.py

# Ultimate Location Name Stress Tester (Modular)
# This is the main tool for testing language strategies under combinatorial duress.
python test_name_gen_ultimate.py --langs pl hu --samples 5 --names 3

# Flags for test_name_gen_ultimate.py:
#   --langs     "en", "hu", "pl" (supports multiple)
#   --samples   Number of random configs per sparsity level
#   --names     Number of unique names to attempt per config
#   --output    Custom results filename
```

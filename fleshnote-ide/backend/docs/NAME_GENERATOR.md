# FleshNote Name Generator

A modular, standalone, and highly configurable name generation system built for the FleshNote IDE.

## Overview
The system supports three distinct generation modes, all controlled via a central `NameGenConfig` object:

1.  **Real Mode (`mode="real"`)**: Pulls from curated real-world name datasets (CSV). Supports gendered surnames (e.g., Polish -ski/-ska).
2.  **Preset Mode (`mode="preset"`)**: Uses archetype-specific word-part tables (YAML) for fantasy or sci-fi themes.
3.  **Procedural Mode (`mode="procedural"`)**: A fully tunable engine that builds names from syllable parts using phonology rules.

---

## Usage

### Basic Example
```python
from tools.name_gen import generate_name, NameGenConfig

# Default procedural generation
name = generate_name() 

# Using a specific preset
name = generate_name(mode="preset", preset_name="elvish")

# Using a real-world origin with gender-aware surnames
name = generate_name(mode="real", real_origin="polish", real_gender="female")
# Result: "Katarzyna Kowalska" (correctly uses -ska ending)
```

### Advanced Configuration
```python
cfg = NameGenConfig(
    mode="procedural",
    no_hard_consonants=True,    # Soft melodic sounds
    vowel_harmony="front",      # Hungarian-style vowel matching
    force_starts_with="Ar",     # Injected constraint
    max_length=10
)
name = generate_name(cfg)
```

---

## Configuration Settings (`NameGenConfig`)

| Setting | Type | Description |
| :--- | :--- | :--- |
| `mode` | `str` | `"procedural"`, `"preset"`, or `"real"`. |
| `real_origin` | `str` | Filename of the CSV in `data/real/` (e.g. `"polish"`, `"hungarian"`, `"english"`). |
| `real_gender` | `str` | `"any"`, `"male"`, or `"female"`. |
| `preset_name` | `str` | Filename of the YAML in `data/presets/` (e.g. `"elvish"`, `"orcish"`). |
| `no_hard_consonants` | `bool` | Bans harsh sounds (X, Q, triple consonants) at syllable starts. |
| `max_consecutive_consonants` | `int` | Controls "hardness". 1 is very soft, 3 is guttural. |
| `vowel_harmony` | `str` | `"none"`, `"front"`, or `"back"`. Enforces sound consistency. |
| `allow_special_vowels` | `bool` | Enables accented characters (á, é, ő, ú, etc.). |
| `force_starts_with` | `str` | Forces the name to begin with a specific string. |
| `force_ends_with` | `str` | Forces the name to end with a specific string. |
| `existing_names` | `list` | List of names to avoid (uniqueness check). |

---

## Data Structure

### Real Names (`data/real/`)
Stored as CSV files with three columns: `name,type,gender`.
- `type`: Either `first` or `last`.
- `gender`: `male`, `female`, or `any`.

#### Gender-Aware Surnames
The generator respects gendered last names. For origins like **Polish**:
- A surname marked as `male` (e.g., *Kowalski*) will only be paired with male first names.
- A surname marked as `female` (e.g., *Kowalska*) will only be paired with female first names.
- Surnames marked as `any` (e.g., *Nowak*) appear for both.

### Presets (`data/presets/`)
Stored as YAML files. They contain `prefixes`, `middles`, and `suffixes` lists, along with an optional `rules` block that overrides default engine settings.

Example `elvish.yaml`:
```yaml
name: "Elvish"
prefixes: ["Aer", "Ael", "Fae"]
suffixes: ["iel", "wen", "ril"]
rules:
  no_hard_consonants: true
  max_consecutive_consonants: 1
```

---

## Phonology Engine
The system includes several "smart" cleanup passes:
- **Consonant Smoothing**: Automatically inserts vowels to break up clusters that exceed your set limit.
- **Vowel Rules**: Cleans up awkward pairings (e.g., `uu` → `uo`, `ii` → `ia`).
- **Harmony**: Shifts vowels to match a consistent "front" or "back" profile if enabled.

## Testing
You can run the standalone test suite to see all modes and many configuration combinations in action:
```bash
python tools/test_name_gen.py
```

"""
presets.py — Archetype Preset Generator

Loads YAML word-part tables from data/presets/ and feeds them into the
procedural engine, so every archetype benefits from the same phonology
pipeline (vowel harmony, consonant smoothing, forced sounds, etc.)

Users can add their own YAML files to data/presets/ and reference them
by filename stem in NameGenConfig(mode="preset", preset_name="myfile").
"""

from __future__ import annotations
import os
import random
import yaml
from pathlib import Path
from .config import NameGenConfig
from .procedural import generate_procedural_name

# ---------------------------------------------------------------------------
# Data directory resolution
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).parent / "data" / "presets"


# ---------------------------------------------------------------------------
# Preset schema
# ---------------------------------------------------------------------------

class PresetLoadError(Exception):
    pass


def _load_preset(name: str) -> dict:
    """
    Load a YAML preset file by stem name (e.g. "elvish" → elvish.yaml).
    Raises PresetLoadError if not found or malformed.
    """
    path = _DATA_DIR / f"{name}.yaml"
    if not path.exists():
        available = list_presets()
        raise PresetLoadError(
            f"Preset '{name}' not found. Available presets: {available}. "
            f"Add a .yaml file to {_DATA_DIR} to create a new preset."
        )
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict):
        raise PresetLoadError(f"Preset file '{path}' must contain a YAML mapping.")

    required = ("prefixes", "suffixes")
    for key in required:
        if key not in data or not isinstance(data[key], list):
            raise PresetLoadError(
                f"Preset '{name}' is missing required list key '{key}'."
            )

    return data


# ---------------------------------------------------------------------------
# Preset listing
# ---------------------------------------------------------------------------

def list_presets() -> list[str]:
    """Return sorted list of all available preset names (without .yaml)."""
    if not _DATA_DIR.exists():
        return []
    return sorted(p.stem for p in _DATA_DIR.glob("*.yaml"))


# ---------------------------------------------------------------------------
# Preset-aware config builder
# ---------------------------------------------------------------------------

def _merge_preset_into_config(preset_data: dict, config: NameGenConfig) -> NameGenConfig:
    """
    Return a NEW NameGenConfig with word-part overrides + inline rules from
    the preset YAML merged in. The caller's explicit config values (vowel_harmony,
    max_consecutive_consonants, etc.) take precedence over the preset's 'rules'
    block, allowing per-call overrides even when using a preset.
    """
    import dataclasses
    cfg_dict = dataclasses.asdict(config)

    # Inject word parts from the YAML (only if the user didn't supply custom ones)
    if config.custom_prefixes is None:
        cfg_dict["custom_prefixes"] = preset_data.get("prefixes", [])
    if config.custom_middles is None:
        cfg_dict["custom_middles"] = preset_data.get("middles", [])
    if config.custom_suffixes is None:
        cfg_dict["custom_suffixes"] = preset_data.get("suffixes", [])

    # Apply preset 'rules' block — only for settings the user left at defaults
    rules = preset_data.get("rules", {})
    if isinstance(rules, dict):
        # Map YAML keys → NameGenConfig field names
        rule_map = {
            "no_hard_consonants":           "no_hard_consonants",
            "max_consecutive_consonants":   "max_consecutive_consonants",
            "vowel_harmony":                "vowel_harmony",
            "allow_special_vowels":         "allow_special_vowels",
            "allow_special_consonants":     "allow_special_consonants",
            "allow_hyphen_separator":       "allow_hyphen_separator",
            "allow_apostrophe_separator":   "allow_apostrophe_separator",
            "compound_probability":         "compound_probability",
            "short_probability":            "short_probability",
            "max_length":                   "max_length",
            "min_length":                   "min_length",
        }
        # Defaults from a fresh NameGenConfig (so we know what the user hasn't changed)
        defaults = dataclasses.asdict(NameGenConfig())
        for yaml_key, cfg_key in rule_map.items():
            if yaml_key in rules:
                # Add slight random fuzz to shape probabilities for more unique variations
                val = rules[yaml_key]
                if yaml_key in ("compound_probability", "short_probability"):
                    fuzz = random.uniform(-0.1, 0.1)
                    val = max(0.0, min(1.0, float(val) + fuzz))

                # Only apply if the caller left the field at its default value
                if cfg_dict.get(cfg_key) == defaults.get(cfg_key):
                    cfg_dict[cfg_key] = val

    # Force mode back to procedural so generate_procedural_name is used
    cfg_dict["mode"] = "procedural"

    merged = NameGenConfig.from_dict(cfg_dict)
    if merged.disable_specials:
        merged.allow_special_vowels = False
        merged.allow_special_consonants = False
        
    return merged


# ---------------------------------------------------------------------------
# Public generator
# ---------------------------------------------------------------------------

def generate_preset_name(config: NameGenConfig) -> str:
    """
    Generate a name using the preset specified in config.preset_name.
    Merges the preset's word-part tables and rule overrides into config,
    then delegates to the procedural engine.
    """
    preset_data = _load_preset(config.preset_name)
    merged_config = _merge_preset_into_config(preset_data, config)
    return generate_procedural_name(merged_config)


def get_preset_info(name: str) -> dict:
    """
    Return metadata about a preset (name, description, rule summary).
    Useful for building a UI dropdown that describes each archetype.
    """
    data = _load_preset(name)
    return {
        "name": data.get("name", name),
        "description": data.get("description", ""),
        "prefix_count": len(data.get("prefixes", [])),
        "middle_count": len(data.get("middles", [])),
        "suffix_count": len(data.get("suffixes", [])),
        "rules": data.get("rules", {}),
    }

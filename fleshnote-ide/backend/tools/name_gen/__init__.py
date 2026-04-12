"""
__init__.py — Name Generator Public API

Usage:
    from tools.name_gen import generate_name, generate_offspring_name, NameGenConfig

    # Quickest way — all defaults (procedural)
    name = generate_name()

    # Real name (needs a CSV in data/real/)
    name = generate_name(mode="real", real_origin="hungarian", real_gender="female")

    # Preset archetype
    name = generate_name(mode="preset", preset_name="elvish")

    # Fully custom procedural config
    cfg = NameGenConfig(
        mode="procedural",
        no_hard_consonants=True,
        vowel_harmony="front",
        allow_special_vowels=True,
        force_starts_with="Ar",
        max_length=10,
    )
    name = generate_name(cfg)

    # Offspring / portmanteau
    child = generate_offspring_name("Vexion", "Aelorash", existing_names=["Vexash"])
"""

from .config     import NameGenConfig
from .procedural import generate_procedural_name, generate_offspring_name
from .presets    import generate_preset_name, list_presets, get_preset_info
from .real_names import generate_real_name, list_origins


def generate_name(config: NameGenConfig | None = None, **kwargs) -> str:
    """
    Main entry point for name generation.

    Pass a NameGenConfig object, keyword args, or nothing at all.
    Keyword args are forwarded to NameGenConfig(**kwargs).

    Returns a single name string.
    """
    if config is None:
        config = NameGenConfig(**kwargs)
    elif kwargs:
        # Merge kwargs into a copy of the provided config
        import dataclasses
        base = dataclasses.asdict(config)
        base.update(kwargs)
        config = NameGenConfig.from_dict(base)

    if config.mode == "real":
        return generate_real_name(config)
    elif config.mode == "preset":
        return generate_preset_name(config)
    else:
        return generate_procedural_name(config)


__all__ = [
    "NameGenConfig",
    "generate_name",
    "generate_offspring_name",
    "generate_preset_name",
    "generate_procedural_name",
    "generate_real_name",
    "list_presets",
    "list_origins",
    "get_preset_info",
]

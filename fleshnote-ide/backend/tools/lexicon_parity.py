"""Verify migration parity between hardcoded janitor constants and raw JSON lexicons.

For every word constant in routes/janitor.py, hun_janitor.py, pol_janitor.py,
verifies that every member is reachable in the language's lexicon via:
  - lemma
  - alt_lemmas
  - phrase (for multi-word items)
  - stem prefix (for sense stems)

Grammar constants that stay in analyzers are explicitly exempted:
  - LINKING_VERBS_*
  - PASSIVE_AUX_*
  - PASSIVE_EXEMPTIONS_*
  - STATE_EXEMPTIONS_*
  - WEAK_WORDS / WEAK_ADVERBS_*
  - IGNORE_ADVERBS_*
  - LANG_MAP
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, ".."))
LEXICONS_DIR = os.path.join(BACKEND, "lexicons")
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from routes import janitor as J  # noqa: E402
from routes import hun_janitor as H  # noqa: E402
from routes import pol_janitor as P  # noqa: E402


def load_lang_lexicons(lang: str):
    """Load all entries for a language and index by lemma, alt_lemmas, and phrase."""
    lang_dir = os.path.join(LEXICONS_DIR, lang)
    lemmas = set()
    alt_lemmas = set()
    phrases = set()

    for fname in os.listdir(lang_dir):
        if not fname.endswith(".json"):
            continue
        data = json.load(open(os.path.join(lang_dir, fname), encoding="utf-8"))
        for e in data.get("entries", []):
            if "lemma" in e:
                lemmas.add(e["lemma"].lower())
            for alt in e.get("alt_lemmas", []):
                alt_lemmas.add(alt.lower())
            if "phrase" in e:
                phrases.add(" ".join(e["phrase"]).lower())
                # Also store individual words in phrase
                for pw in e["phrase"]:
                    alt_lemmas.add(pw.lower())

    return {
        "lemmas": lemmas,
        "alt_lemmas": alt_lemmas,
        "phrases": phrases,
    }


def is_reachable(item: str, index: dict, is_stem: bool = False) -> bool:
    item_lower = item.lower().strip()
    if is_stem:
        # Check if any lemma or alt_lemma starts with the stem
        for l in index["lemmas"]:
            if l.startswith(item_lower):
                return True
        for a in index["alt_lemmas"]:
            if a.startswith(item_lower):
                return True
        return False

    if item_lower in index["lemmas"]:
        return True
    if item_lower in index["alt_lemmas"]:
        return True
    if item_lower in index["phrases"]:
        return True
    return False


def check_constants():
    total_unreachable = 0
    results = []

    # ==========================================
    # ENGLISH (EN)
    # ==========================================
    idx_en = load_lang_lexicons("en")
    en_checks = [
        ("EMOTION_LEXICON_EN", J.EMOTION_LEXICON_EN, "emotion_label.json", False),
        ("EMOTION_ADVERBS_EN", J.EMOTION_ADVERBS_EN, "emotion_adverb.json", False),
        ("FILTER_VERBS_EN", J.FILTER_VERBS_EN, "filter_verb.json", False),
        ("REALIZE_VERBS_EN", J.REALIZE_VERBS_EN, "realize_verb.json", False),
        ("SPEECH_VERBS_EN", J.SPEECH_VERBS_EN, "conflict_speech.json / telling_cue.json", False),
    ]
    # Senses in EN
    for sense_name, words in J.EN_SENSES.items():
        en_checks.append((f"EN_SENSES[{sense_name}]", set(words), "sensory.json", False))

    print("=" * 70)
    print("ENGLISH (EN) MIGRATION PARITY")
    print("=" * 70)
    for const_name, members, target_file, is_stem in en_checks:
        missing = []
        for m in sorted(members):
            if not is_reachable(m, idx_en, is_stem=is_stem):
                missing.append(m)
        total_unreachable += len(missing)
        results.append({
            "lang": "en",
            "constant": const_name,
            "target": target_file,
            "total": len(members),
            "reached": len(members) - len(missing),
            "missing": missing,
        })
        status = "OK" if not missing else f"MISSING {len(missing)}"
        print(f"  {const_name:30s} -> {len(members)-len(missing):3d}/{len(members):3d} reached [{status}]")
        if missing:
            print(f"     Unreachable: {', '.join(missing[:15])}")

    # ==========================================
    # HUNGARIAN (HU)
    # ==========================================
    idx_hu = load_lang_lexicons("hu")
    hu_checks = [
        ("EMOTION_LEXICON_HU", H.EMOTION_LEXICON_HU, "emotion_label.json", False),
        ("EMOTION_ADVERBS_HU", H.EMOTION_ADVERBS_HU, "emotion_adverb.json", False),
        ("FILTER_VERBS_HU", H.FILTER_VERBS_HU, "filter_verb.json", False),
        ("REALIZE_VERBS_HU", H.REALIZE_VERBS_HU, "realize_verb.json", False),
        ("SPEECH_VERBS_HU", H.SPEECH_VERBS_HU, "conflict_speech.json / telling_cue.json", False),
        ("SIGHT_STEMS_HU", set(H.SIGHT_STEMS_HU), "sensory.json", True),
        ("SMELL_STEMS_HU", set(H.SMELL_STEMS_HU), "sensory.json", True),
        ("SOUND_STEMS_HU", set(H.SOUND_STEMS_HU), "sensory.json", True),
        ("TASTE_STEMS_HU", set(H.TASTE_STEMS_HU), "sensory.json", True),
        ("TOUCH_STEMS_HU", set(H.TOUCH_STEMS_HU), "sensory.json", True),
    ]

    print("\n" + "=" * 70)
    print("HUNGARIAN (HU) MIGRATION PARITY")
    print("=" * 70)
    for const_name, members, target_file, is_stem in hu_checks:
        missing = []
        for m in sorted(members):
            if not is_reachable(m, idx_hu, is_stem=is_stem):
                missing.append(m)
        total_unreachable += len(missing)
        results.append({
            "lang": "hu",
            "constant": const_name,
            "target": target_file,
            "total": len(members),
            "reached": len(members) - len(missing),
            "missing": missing,
        })
        status = "OK" if not missing else f"MISSING {len(missing)}"
        print(f"  {const_name:30s} -> {len(members)-len(missing):3d}/{len(members):3d} reached [{status}]")
        if missing:
            print(f"     Unreachable: {', '.join(missing[:15])}")

    # ==========================================
    # POLISH (PL)
    # ==========================================
    idx_pl = load_lang_lexicons("pl")
    pl_checks = [
        ("EMOTION_LEXICON_PL", P.EMOTION_LEXICON_PL, "emotion_label.json", False),
        ("EMOTION_ADVERBS_PL", P.EMOTION_ADVERBS_PL, "emotion_adverb.json", False),
        ("FILTER_VERBS_PL", P.FILTER_VERBS_PL, "filter_verb.json", False),
        ("REALIZE_VERBS_PL", P.REALIZE_VERBS_PL, "realize_verb.json", False),
        ("SPEECH_VERBS_PL", P.SPEECH_VERBS_PL, "conflict_speech.json / telling_cue.json", False),
        ("SIGHT_STEMS_PL", set(P.SIGHT_STEMS_PL), "sensory.json", True),
        ("SMELL_STEMS_PL", set(P.SMELL_STEMS_PL), "sensory.json", True),
        ("SOUND_STEMS_PL", set(P.SOUND_STEMS_PL), "sensory.json", True),
        ("TASTE_STEMS_PL", set(P.TASTE_STEMS_PL), "sensory.json", True),
        ("TOUCH_STEMS_PL", set(P.TOUCH_STEMS_PL), "sensory.json", True),
    ]

    print("\n" + "=" * 70)
    print("POLISH (PL) MIGRATION PARITY")
    print("=" * 70)
    for const_name, members, target_file, is_stem in pl_checks:
        missing = []
        for m in sorted(members):
            if not is_reachable(m, idx_pl, is_stem=is_stem):
                missing.append(m)
        total_unreachable += len(missing)
        results.append({
            "lang": "pl",
            "constant": const_name,
            "target": target_file,
            "total": len(members),
            "reached": len(members) - len(missing),
            "missing": missing,
        })
        status = "OK" if not missing else f"MISSING {len(missing)}"
        print(f"  {const_name:30s} -> {len(members)-len(missing):3d}/{len(members):3d} reached [{status}]")
        if missing:
            print(f"     Unreachable: {', '.join(missing[:15])}")

    print("\n" + "=" * 70)
    print(f"TOTAL UNREACHABLE MEMBERS: {total_unreachable}")
    print("=" * 70)

    return total_unreachable, results


if __name__ == "__main__":
    unreachable, _ = check_constants()
    sys.exit(0 if unreachable == 0 else 1)

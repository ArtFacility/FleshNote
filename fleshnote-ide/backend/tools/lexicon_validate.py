"""Lexicon validator for FleshNote.

Validates JSON schema, ID uniqueness, field ranges, dominant emotion signs,
distribution of valence/arousal pairs, and spaCy lemma parity
across all lexicons in backend/lexicons/{en,hu,pl}/*.json.
"""
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, ".."))
LEXICONS_DIR = os.path.join(BACKEND, "lexicons")
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from nlp_manager import check_model_exists, get_nlp  # noqa: E402

ALLOWED_EMOTIONS = {
    "joy", "trust", "fear", "surprise", "sadness", "disgust", "anger", "anticipation"
}

NEGATIVE_DOMINANT_EMOTIONS = {"fear", "sadness", "anger", "disgust"}
POSITIVE_DOMINANT_EMOTIONS = {"joy", "trust"}

ALLOWED_KINDS = {
    "emotion_label", "emotion_noun", "emotion_verb", "telling_cue", "emotion_adverb",
    "realize_verb", "filter_verb", "action_violent", "danger_noun", "stakes_word",
    "calm_word", "conflict_speech", "intensifier", "diminisher", "negator",
    "hedge", "sensory", "idiom"
}

ALLOWED_SENSES = {"sight", "sound", "smell", "touch", "taste"}
MODIFIER_KINDS = {"intensifier", "diminisher", "negator", "hedge"}
TIERED_KINDS = {"action_violent", "danger_noun", "stakes_word", "conflict_speech", "calm_word"}


def validate_lexicons(languages=None):
    if languages is None:
        languages = ["en", "hu", "pl"]

    all_errors = []
    all_warnings = []
    dead_entries = []
    counts = {lang: {kind: 0 for kind in ALLOWED_KINDS} for lang in languages}
    all_ids_by_lang = {lang: set() for lang in languages}
    idioms_to_check = {lang: [] for lang in languages}

    # Step 1: Schema, Emotion Signs, Templated Scores, and ID collection
    for lang in languages:
        lang_dir = os.path.join(LEXICONS_DIR, lang)
        if not os.path.isdir(lang_dir):
            all_errors.append(f"Missing lexicon directory: {lang_dir}")
            continue

        for kind in sorted(ALLOWED_KINDS):
            fname = f"{kind}.json"
            fpath = os.path.join(lang_dir, fname)
            if not os.path.isfile(fpath):
                all_errors.append(f"Missing required lexicon file: {lang}/{fname}")
                continue

            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                all_errors.append(f"Failed to parse JSON in {lang}/{fname}: {e}")
                continue

            if data.get("lang") != lang:
                all_errors.append(f"{lang}/{fname}: root 'lang' must be '{lang}', got '{data.get('lang')}'")
            if data.get("kind") != kind:
                all_errors.append(f"{lang}/{fname}: root 'kind' must be '{kind}', got '{data.get('kind')}'")

            entries = data.get("entries", [])
            counts[lang][kind] = len(entries)

            pair_counts = collections.Counter()

            for entry in entries:
                eid = entry.get("id")
                if not eid or not isinstance(eid, str):
                    all_errors.append(f"{lang}/{fname}: entry missing string 'id': {entry}")
                    continue

                if eid in all_ids_by_lang[lang]:
                    all_errors.append(f"{lang}/{fname}: duplicate id '{eid}' across language {lang}")
                all_ids_by_lang[lang].add(eid)

                # Exactly one of lemma or phrase
                has_lemma = "lemma" in entry and entry["lemma"] is not None
                has_phrase = "phrase" in entry and entry["phrase"] is not None
                if has_lemma == has_phrase:
                    all_errors.append(f"{eid}: must have exactly one of 'lemma' or 'phrase'")

                if has_lemma and " " in entry["lemma"].strip():
                    all_errors.append(f"{eid}: 'lemma' contains spaces ('{entry['lemma']}'), multi-word items must use 'phrase'")

                if has_phrase:
                    if not isinstance(entry["phrase"], list) or not entry["phrase"]:
                        all_errors.append(f"{eid}: 'phrase' must be a non-empty list of string lemmas")
                    elif any(" " in w.strip() for w in entry["phrase"] if isinstance(w, str)):
                        all_errors.append(f"{eid}: phrase elements must be single-word lemmas")

                # Strength
                if entry.get("strength") not in ("strong", "weak"):
                    all_errors.append(f"{eid}: 'strength' must be 'strong' or 'weak', got '{entry.get('strength')}'")

                # Source
                if not entry.get("source"):
                    all_errors.append(f"{eid}: missing 'source' provenance field")

                # Modifiers vs content words
                if kind in MODIFIER_KINDS:
                    if "factor" not in entry or not isinstance(entry["factor"], (int, float)):
                        all_errors.append(f"{eid}: modifier must have numeric 'factor'")
                else:
                    val = entry.get("valence")
                    if val is not None and (not isinstance(val, (int, float)) or not (-1.0 <= val <= 1.0)):
                        all_errors.append(f"{eid}: 'valence' must be in [-1.0, 1.0], got {val}")
                    arousal = entry.get("arousal")
                    if arousal is not None and (not isinstance(arousal, (int, float)) or not (0.0 <= arousal <= 1.0)):
                        all_errors.append(f"{eid}: 'arousal' must be in [0.0, 1.0], got {arousal}")

                    emotions = entry.get("emotions")
                    if emotions is not None:
                        if not isinstance(emotions, dict):
                            all_errors.append(f"{eid}: 'emotions' must be a dict")
                        else:
                            for emo, weight in emotions.items():
                                if emo not in ALLOWED_EMOTIONS:
                                    all_errors.append(f"{eid}: unknown emotion tag '{emo}'")
                                if not isinstance(weight, (int, float)) or not (0.0 <= weight <= 1.0):
                                    all_errors.append(f"{eid}: emotion weight for '{emo}' must be in [0, 1]")

                            # Dominant emotion sign validation (Issue 2)
                            if emotions and val is not None:
                                dom_emo, dom_wt = max(emotions.items(), key=lambda x: x[1])
                                if dom_emo in NEGATIVE_DOMINANT_EMOTIONS and val > 0:
                                    all_errors.append(
                                        f"{eid}: dominant emotion '{dom_emo}' ({dom_wt}) requires negative valence, got {val}"
                                    )
                                elif dom_emo in POSITIVE_DOMINANT_EMOTIONS and val < 0:
                                    all_errors.append(
                                        f"{eid}: dominant emotion '{dom_emo}' ({dom_wt}) requires positive valence, got {val}"
                                    )

                    if val is not None and arousal is not None:
                        pair_counts[(round(val, 2), round(arousal, 2))] += 1

                # Sensory
                if kind == "sensory":
                    if entry.get("sense") not in ALLOWED_SENSES:
                        all_errors.append(f"{eid}: sensory entry must have 'sense' in {ALLOWED_SENSES}")

                # Idioms
                if kind == "idiom":
                    idioms_to_check[lang].append(entry)

            # Check for templated (valence, arousal) scores (>50% of file)
            if kind in TIERED_KINDS and len(entries) > 10:
                for pair, cnt in pair_counts.items():
                    pct = (cnt / len(entries)) * 100
                    if pct > 50.0:
                        all_warnings.append(
                            f"{lang}/{fname}: pair (val={pair[0]}, aro={pair[1]}) appears in {pct:.1f}% (>50%) of entries ({cnt}/{len(entries)})"
                        )

    # Step 2: Validate idiom block ids exist
    for lang in languages:
        for entry in idioms_to_check[lang]:
            eid = entry["id"]
            blocks = entry.get("blocks", [])
            if not isinstance(blocks, list):
                all_errors.append(f"{eid}: 'blocks' must be a list of entry IDs")
            else:
                for target_id in blocks:
                    if target_id not in all_ids_by_lang[lang]:
                        all_errors.append(f"{eid}: blocks non-existent entry id '{target_id}'")

    # Step 3: spaCy Lemma Validation (without 2-cycle hack, checking alt_lemmas, detecting dead entries)
    lemma_cache = {}

    for lang in languages:
        if not check_model_exists(lang):
            print(f"[{lang.upper()}] spaCy model not installed, skipping lemma check.")
            continue

        print(f"[{lang.upper()}] Running spaCy lemma validation...")
        nlp = get_nlp(lang)
        disable_pipes = [p for p in ["parser", "ner", "senter"] if p in nlp.pipe_names]
        lang_dir = os.path.join(LEXICONS_DIR, lang)

        def norm_spacy(w: str) -> str:
            w_clean = w.lower().strip()
            key = (lang, w_clean)
            if key in lemma_cache:
                return lemma_cache[key]
            doc = nlp(w_clean)
            res = doc[0].lemma_.lower() if len(doc) == 1 else w_clean
            lemma_cache[key] = res
            return res

        with nlp.select_pipes(disable=disable_pipes):
            for kind in ALLOWED_KINDS:
                fpath = os.path.join(lang_dir, f"{kind}.json")
                if not os.path.isfile(fpath):
                    continue
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)

                for entry in data.get("entries", []):
                    eid = entry["id"]
                    alts = [a.lower().strip() for a in (entry.get("alt_lemmas") or [])]

                    if "lemma" in entry and entry["lemma"]:
                        target_lemma = entry["lemma"].lower().strip()
                        allowed_forms = {target_lemma} | set(alts)

                        spacy_lemma = norm_spacy(target_lemma)

                        # Check if spaCy produces either the dictionary lemma or any alt_lemma
                        if spacy_lemma in allowed_forms:
                            continue

                        # Check if any alt_lemma produces a match
                        matched = False
                        for alt in alts:
                            if norm_spacy(alt) in allowed_forms:
                                matched = True
                                break

                        if not matched:
                            dead_entries.append((lang, eid, target_lemma, spacy_lemma, alts))
                            all_errors.append(
                                f"Dead entry: [{lang.upper()}] {eid}: lemma='{target_lemma}' lemmatizes to '{spacy_lemma}', neither matches lemma or alt_lemmas={alts}"
                            )

                    elif "phrase" in entry and entry["phrase"]:
                        allowed_forms = set(alts)
                        for pw in entry["phrase"]:
                            pw_lower = pw.lower().strip()
                            allowed_forms.add(pw_lower)
                            spacy_lemma = norm_spacy(pw_lower)
                            if spacy_lemma != pw_lower and spacy_lemma not in allowed_forms:
                                dead_entries.append((lang, eid, pw_lower, spacy_lemma, alts))
                                all_errors.append(
                                    f"Dead phrase token: [{lang.upper()}] {eid}: token='{pw_lower}' lemmatizes to '{spacy_lemma}', not in phrase/alt_lemmas"
                                )

    # Step 4: Summary Report
    print("\n" + "=" * 60)
    print("LEXICON COUNTS PER KIND & LANGUAGE")
    print("=" * 60)
    header = f"{'Kind':20s} | {'EN':>6s} | {'HU':>6s} | {'PL':>6s}"
    print(header)
    print("-" * len(header))
    for kind in sorted(ALLOWED_KINDS):
        c_en = counts.get("en", {}).get(kind, 0)
        c_hu = counts.get("hu", {}).get(kind, 0)
        c_pl = counts.get("pl", {}).get(kind, 0)
        print(f"{kind:20s} | {c_en:6d} | {c_hu:6d} | {c_pl:6d}")

    total_en = sum(counts.get("en", {}).values())
    total_hu = sum(counts.get("hu", {}).values())
    total_pl = sum(counts.get("pl", {}).values())
    print("-" * len(header))
    print(f"{'TOTAL':20s} | {total_en:6d} | {total_hu:6d} | {total_pl:6d}")
    print("=" * 60 + "\n")

    if all_warnings:
        print(f"Found {len(all_warnings)} WARNINGS (>50% templated score pairs):")
        for w in all_warnings:
            print(f"  WARNING: {w}")
        print()

    if dead_entries:
        print(f"Found {len(dead_entries)} DEAD ENTRIES (spaCy never produced stored form):")
        for lang, eid, target, spacy_l, alts in dead_entries[:30]:
            print(f"  [{lang.upper()}] {eid}: target='{target}' -> spacy='{spacy_l}', alt_lemmas={alts}")
        if len(dead_entries) > 30:
            print(f"  ... and {len(dead_entries) - 30} more dead entries.")
        print()

    if all_errors:
        print(f"Found {len(all_errors)} SCHEMA / VALIDATION ERRORS:")
        for err in all_errors[:30]:
            print(f"  ERROR: {err}")
        if len(all_errors) > 30:
            print(f"  ... and {len(all_errors) - 30} more errors.")
        print()

    passed = (len(all_errors) == 0)
    print("Validation Result:", "PASSED" if passed else "FAILED")
    return passed


if __name__ == "__main__":
    ok = validate_lexicons()
    sys.exit(0 if ok else 1)

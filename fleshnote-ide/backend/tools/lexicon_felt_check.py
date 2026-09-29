"""Lexicon felt / role tagging validator for FleshNote.

Validates:
1. Every entry in emotion_label, emotion_adverb, and emotion_noun has a valid 'felt' field:
   - "state": feeling a character has right now
   - "trait": lasting disposition or character quality
   - "evaluative": describes what something is like or causes in others
2. Every entry in emotion_verb has a valid 'role' field:
   - "experiencer": subject feels it
   - "stimulus": object feels it
   - "expression": visible behavior that shows an emotion
   - "speech_act": an act done to someone
   - "other": none of the above
3. Prints counts per language and kind.
4. Prints every trait and evaluative entry, and every expression/speech_act verb (as id: lemma).
5. Exits non-zero on any missing or invalid value.
"""
import glob
import json
import os
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, ".."))
LEXICONS_DIR = os.path.join(BACKEND, "lexicons")

ALLOWED_FELT = {"state", "trait", "evaluative"}
ALLOWED_ROLE = {"experiencer", "stimulus", "expression", "speech_act", "other"}

FELT_KINDS = {"emotion_label", "emotion_adverb", "emotion_noun"}
ROLE_KINDS = {"emotion_verb"}


def validate_felt_and_role(languages=None):
    if languages is None:
        languages = ["en", "hu", "pl"]

    all_errors = []
    counts_by_lang_kind = defaultdict(lambda: defaultdict(Counter))
    trait_entries = defaultdict(list)
    evaluative_entries = defaultdict(list)
    expression_verbs = defaultdict(list)
    speech_act_verbs = defaultdict(list)

    for lang in languages:
        lang_dir = os.path.join(LEXICONS_DIR, lang)
        if not os.path.isdir(lang_dir):
            all_errors.append(f"Missing directory: {lang_dir}")
            continue

        # Validate felt kinds
        for kind in sorted(FELT_KINDS):
            fpath = os.path.join(lang_dir, f"{kind}.json")
            if not os.path.isfile(fpath):
                all_errors.append(f"Missing file: {fpath}")
                continue
            with open(fpath, "r", encoding="utf-8") as f:
                d = json.load(f)

            for e in d.get("entries", []):
                eid = e.get("id", "<no id>")
                target_str = e.get("lemma") or (" ".join(e.get("phrase", [])))
                felt = e.get("felt")
                if not felt:
                    all_errors.append(f"[{lang.upper()}] {kind} | {eid} ('{target_str}'): missing 'felt' field")
                elif felt not in ALLOWED_FELT:
                    all_errors.append(f"[{lang.upper()}] {kind} | {eid} ('{target_str}'): invalid felt='{felt}' (must be one of {sorted(ALLOWED_FELT)})")
                else:
                    counts_by_lang_kind[lang][kind][felt] += 1
                    if felt == "trait":
                        trait_entries[lang].append((kind, eid, target_str))
                    elif felt == "evaluative":
                        evaluative_entries[lang].append((kind, eid, target_str))

        # Validate role kinds
        for kind in sorted(ROLE_KINDS):
            fpath = os.path.join(lang_dir, f"{kind}.json")
            if not os.path.isfile(fpath):
                all_errors.append(f"Missing file: {fpath}")
                continue
            with open(fpath, "r", encoding="utf-8") as f:
                d = json.load(f)

            for e in d.get("entries", []):
                eid = e.get("id", "<no id>")
                target_str = e.get("lemma") or (" ".join(e.get("phrase", [])))
                role = e.get("role")
                if not role:
                    all_errors.append(f"[{lang.upper()}] {kind} | {eid} ('{target_str}'): missing 'role' field")
                elif role not in ALLOWED_ROLE:
                    all_errors.append(f"[{lang.upper()}] {kind} | {eid} ('{target_str}'): invalid role='{role}' (must be one of {sorted(ALLOWED_ROLE)})")
                else:
                    counts_by_lang_kind[lang][kind][role] += 1
                    if role == "expression":
                        expression_verbs[lang].append((eid, target_str))
                    elif role == "speech_act":
                        speech_act_verbs[lang].append((eid, target_str))

    # Print summary tables
    print("=" * 70)
    print("FELT / ROLE COUNTS PER LANGUAGE AND KIND")
    print("=" * 70)
    for lang in languages:
        print(f"\n--- {lang.upper()} ---")
        for kind in sorted(FELT_KINDS):
            c = counts_by_lang_kind[lang][kind]
            tot = sum(c.values())
            print(f"  {kind:16s} (total {tot:3d}) | state: {c['state']:3d} | trait: {c['trait']:3d} | evaluative: {c['evaluative']:3d}")
        for kind in sorted(ROLE_KINDS):
            c = counts_by_lang_kind[lang][kind]
            tot = sum(c.values())
            print(f"  {kind:16s} (total {tot:3d}) | experiencer: {c['experiencer']:3d} | stimulus: {c['stimulus']:3d} | expression: {c['expression']:3d} | speech_act: {c['speech_act']:3d} | other: {c['other']:3d}")

    # Print trait and evaluative entries
    print("\n" + "=" * 70)
    print("TRAIT ENTRIES (for review)")
    print("=" * 70)
    for lang in languages:
        items = trait_entries[lang]
        print(f"\n--- {lang.upper()} Trait ({len(items)} entries) ---")
        for kind, eid, target in sorted(items, key=lambda x: (x[0], x[2])):
            print(f"  {kind:16s} | {eid:35s} | {target}")

    print("\n" + "=" * 70)
    print("EVALUATIVE ENTRIES (for review)")
    print("=" * 70)
    for lang in languages:
        items = evaluative_entries[lang]
        print(f"\n--- {lang.upper()} Evaluative ({len(items)} entries) ---")
        for kind, eid, target in sorted(items, key=lambda x: (x[0], x[2])):
            print(f"  {kind:16s} | {eid:35s} | {target}")

    # Print expression and speech_act verbs
    print("\n" + "=" * 70)
    print("EXPRESSION VERBS (for review)")
    print("=" * 70)
    for lang in languages:
        items = expression_verbs[lang]
        print(f"\n--- {lang.upper()} Expression ({len(items)} entries) ---")
        for eid, target in sorted(items, key=lambda x: x[1]):
            print(f"  {eid:35s} | {target}")

    print("\n" + "=" * 70)
    print("SPEECH ACT VERBS (for review)")
    print("=" * 70)
    for lang in languages:
        items = speech_act_verbs[lang]
        print(f"\n--- {lang.upper()} Speech Act ({len(items)} entries) ---")
        for eid, target in sorted(items, key=lambda x: x[1]):
            print(f"  {eid:35s} | {target}")

    # Errors summary
    print("\n" + "=" * 70)
    if all_errors:
        print(f"VALIDATION FAILED WITH {len(all_errors)} ERRORS:")
        for err in all_errors[:50]:
            print(f"  ERROR: {err}")
        if len(all_errors) > 50:
            print(f"  ... and {len(all_errors) - 50} more errors")
        return False
    else:
        print("ALL ENTRIES PROPERLY TAGGED (0 errors)")
        return True


def main():
    ok = validate_felt_and_role()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

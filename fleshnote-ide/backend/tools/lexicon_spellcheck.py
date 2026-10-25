"""Lexicon spellcheck validator.

Checks every lemma and every word of every phrase against Hunspell via phunspell.
Dictionaries:
  - EN: en_US, en_GB
  - HU: hu_HU
  - PL: pl_PL

Accepts a word if its lower-case, original, or capitalized form is in the dictionary.
Accepts an entry if it carries a specific "spell_ok": "<reason>".
"""
import glob
import json
import os
import re
import sys
from collections import defaultdict

try:
    import phunspell
except ImportError:
    print("ERROR: phunspell package is required. Install via pip install phunspell.")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, ".."))
LEXICONS_DIR = os.path.join(BACKEND, "lexicons")

GENERIC_REASONS = {
    "valid", "valid word", "ok", "real word", "dictionary lacks", "spelling ok",
    "correct", "good", "pass"
}


def is_valid_reason(reason: str) -> bool:
    if not isinstance(reason, str):
        return False
    r = reason.strip().lower()
    if len(r) < 8 or r in GENERIC_REASONS:
        return False
    return True


class SpellChecker:
    def __init__(self):
        print("Initializing Hunspell dictionaries via phunspell...")
        self.spellers = {}
        try:
            self.spellers["en"] = [phunspell.Phunspell("en_US"), phunspell.Phunspell("en_GB")]
        except Exception as e:
            print(f"Warning loading EN dictionaries: {e}")
            self.spellers["en"] = [phunspell.Phunspell("en_US")]

        self.spellers["hu"] = [phunspell.Phunspell("hu_HU")]
        self.spellers["pl"] = [phunspell.Phunspell("pl_PL")]
        print("Dictionaries initialized successfully.")

    def check_word(self, word: str, lang: str) -> bool:
        # Strip trailing/leading punctuation just in case
        w = word.strip(".,;:!?\"'()[]{}")
        if not w:
            return True
        for sp in self.spellers[lang]:
            if sp.lookup(w) or sp.lookup(w.lower()) or sp.lookup(w.capitalize()):
                return True
        return False


def validate_spellcheck(languages=None):
    if languages is None:
        languages = ["en", "hu", "pl"]

    checker = SpellChecker()
    failures_by_lang = defaultdict(list)
    total_checked = defaultdict(int)
    spell_ok_count = defaultdict(int)

    for lang in languages:
        lang_dir = os.path.join(LEXICONS_DIR, lang)
        if not os.path.isdir(lang_dir):
            continue

        for fpath in sorted(glob.glob(os.path.join(lang_dir, "*.json"))):
            kind = os.path.splitext(os.path.basename(fpath))[0]
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                failures_by_lang[lang].append({
                    "kind": kind,
                    "id": "<file>",
                    "error": f"JSON decode error: {e}"
                })
                continue

            entries = data.get("entries", [])
            for entry in entries:
                total_checked[lang] += 1
                eid = entry.get("id", "<no id>")
                spell_ok = entry.get("spell_ok")

                if spell_ok is not None:
                    if not is_valid_reason(spell_ok):
                        failures_by_lang[lang].append({
                            "kind": kind,
                            "id": eid,
                            "error": f"Invalid or non-specific spell_ok reason: {repr(spell_ok)}"
                        })
                    else:
                        spell_ok_count[lang] += 1
                        continue

                # Words to check
                words_to_check = []
                if "lemma" in entry and entry["lemma"]:
                    lemma = entry["lemma"]
                    # If hyphenated, first test whole word, if not recognized test subparts
                    if "-" in lemma:
                        if not checker.check_word(lemma, lang):
                            words_to_check.extend(lemma.split("-"))
                    else:
                        words_to_check.append(lemma)

                if "phrase" in entry and entry["phrase"]:
                    for pw in entry["phrase"]:
                        if "-" in pw:
                            if not checker.check_word(pw, lang):
                                words_to_check.extend(pw.split("-"))
                        else:
                            words_to_check.append(pw)

                bad_words = [w for w in words_to_check if not checker.check_word(w, lang)]
                if bad_words:
                    failures_by_lang[lang].append({
                        "kind": kind,
                        "id": eid,
                        "lemma": entry.get("lemma"),
                        "phrase": entry.get("phrase"),
                        "bad_words": bad_words,
                        "error": f"Unrecognized word(s): {bad_words}"
                    })

    print("\n" + "=" * 60)
    print("LEXICON SPELLCHECK SUMMARY")
    print("=" * 60)
    total_failures = 0
    for lang in languages:
        fails = failures_by_lang[lang]
        total_failures += len(fails)
        print(f"[{lang.upper()}] Checked: {total_checked[lang]} entries | spell_ok: {spell_ok_count[lang]} | Failures: {len(fails)}")

    if total_failures > 0:
        print("\n" + "=" * 60)
        print("FAILURES PER LANGUAGE AND KIND")
        print("=" * 60)
        for lang in languages:
            fails = failures_by_lang[lang]
            if not fails:
                continue
            print(f"\n--- {lang.upper()} ({len(fails)} failure(s)) ---")
            for f in fails:
                eid = f["id"]
                kind = f["kind"]
                err = f["error"]
                print(f"  {kind:16s} | {eid:30s} | {err}")
        print("\nOVERALL RESULT: FAILED")
        return False
    else:
        print("\nOVERALL RESULT: ALL LANGUAGES PASSED (0 failures)")
        return True


def main():
    ok = validate_spellcheck()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

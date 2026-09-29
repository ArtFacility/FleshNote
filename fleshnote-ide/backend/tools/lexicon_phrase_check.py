"""Phrase matcher validator for FleshNote lexicons.

Validates:
1. Every entry with "phrase" has a non-empty "example" sentence.
2. spaCy model produces the phrase's lemmas from the example:
   - If contiguous is True (default): contiguous subsequence of token lemmas.
   - If contiguous is False: in-order subsequence within the same sentence.
3. Idiom blocks validity:
   - Every ID in "blocks" exists in that language's lexicon.
   - Every blocked entry actually overlaps with the idiom's phrase tokens.
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, ".."))
LEXICONS_DIR = os.path.join(BACKEND, "lexicons")
sys.path.insert(0, BACKEND)

from nlp_manager import get_nlp  # noqa: E402


def is_contiguous_subsequence(sub, seq):
    if not sub:
        return True
    n, m = len(seq), len(sub)
    for i in range(n - m + 1):
        if seq[i:i + m] == sub:
            return True
    return False


def is_in_order_subsequence(sub, seq):
    if not sub:
        return True
    it = iter(seq)
    return all(item in it for item in sub)


def validate_phrases(languages=None):
    if languages is None:
        languages = ["en", "hu", "pl"]

    all_failures = []
    total_phrases = {lang: 0 for lang in languages}
    blocks_failures = []

    for lang in languages:
        lang_dir = os.path.join(LEXICONS_DIR, lang)
        if not os.path.isdir(lang_dir):
            continue

        print(f"\n[{lang.upper()}] Loading lexicon entries and NLP model...")
        nlp = get_nlp(lang)

        # Build ID lookup for blocks check
        all_entries = {}
        for fpath in glob.glob(os.path.join(lang_dir, "*.json")):
            with open(fpath, "r", encoding="utf-8") as f:
                d = json.load(f)
                for e in d.get("entries", []):
                    all_entries[e["id"]] = e

        # Validate entries
        for fpath in sorted(glob.glob(os.path.join(lang_dir, "*.json"))):
            kind = os.path.splitext(os.path.basename(fpath))[0]
            with open(fpath, "r", encoding="utf-8") as f:
                d = json.load(f)

            for entry in d.get("entries", []):
                eid = entry.get("id", "<no id>")

                # Check blocks
                if "blocks" in entry and entry["blocks"]:
                    phrase_tokens = set(entry.get("phrase", []))
                    for bid in entry["blocks"]:
                        if bid not in all_entries:
                            blocks_failures.append(f"[{lang.upper()}] {eid}: blocked id '{bid}' does not exist")
                        else:
                            blocked_lem = all_entries[bid].get("lemma")
                            blocked_phrase = set(all_entries[bid].get("phrase", []))
                            overlap = (blocked_lem in phrase_tokens) or bool(blocked_phrase & phrase_tokens)
                            if not overlap:
                                blocks_failures.append(
                                    f"[{lang.upper()}] {eid}: blocked entry '{bid}' ('{blocked_lem}') does not overlap with phrase {entry.get('phrase')}"
                                )

                # Check phrase & example
                phrase = entry.get("phrase")
                if not phrase:
                    continue

                total_phrases[lang] += 1
                example = entry.get("example")
                if not example or not isinstance(example, str) or not example.strip():
                    all_failures.append({
                        "lang": lang,
                        "kind": kind,
                        "id": eid,
                        "phrase": phrase,
                        "example": example,
                        "error": "Missing or empty example sentence"
                    })
                    continue

                doc = nlp(example.strip())
                target_phrase = [w.lower() for w in phrase]
                is_contiguous = entry.get("contiguous", True)

                matched = False
                all_sent_lemmas = []
                for sent in doc.sents:
                    sent_lemmas = [tok.lemma_.lower() for tok in sent]
                    all_sent_lemmas.append(sent_lemmas)
                    if is_contiguous:
                        if is_contiguous_subsequence(target_phrase, sent_lemmas):
                            matched = True
                            break
                    else:
                        if is_in_order_subsequence(target_phrase, sent_lemmas):
                            matched = True
                            break

                if not matched:
                    all_failures.append({
                        "lang": lang,
                        "kind": kind,
                        "id": eid,
                        "phrase": phrase,
                        "contiguous": is_contiguous,
                        "example": example,
                        "produced_lemmas": all_sent_lemmas,
                        "error": f"Phrase {target_phrase} not found in produced lemmas"
                    })

    print("\n" + "=" * 60)
    print("PHRASE & BLOCKS VALIDATION SUMMARY")
    print("=" * 60)
    for lang in languages:
        fails = [f for f in all_failures if f["lang"] == lang]
        print(f"[{lang.upper()}] Total phrases checked: {total_phrases[lang]} | Failures: {len(fails)}")

    if blocks_failures:
        print(f"\nBlocks Failures ({len(blocks_failures)}):")
        for bf in blocks_failures:
            print(f"  - {bf}")

    if all_failures:
        print(f"\nPhrase Match Failures ({len(all_failures)}):")
        for f in all_failures[:30]:
            print(f"\n  [{f['lang'].upper()}] {f['kind']} | {f['id']}")
            print(f"    Target phrase : {f['phrase']} (contiguous={f.get('contiguous', True)})")
            print(f"    Example       : {repr(f['example'])}")
            print(f"    Produced      : {f.get('produced_lemmas')}")
        if len(all_failures) > 30:
            print(f"\n  ... and {len(all_failures) - 30} more failures")

    passed = (len(all_failures) == 0 and len(blocks_failures) == 0)
    if passed:
        print("\nOVERALL RESULT: ALL PHRASES & BLOCKS PASSED (0 failures)")
    else:
        print("\nOVERALL RESULT: FAILED")
    return passed


def main():
    ok = validate_phrases()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()

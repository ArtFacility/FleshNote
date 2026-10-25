"""Enrich alt_lemmas in all lexicons where spaCy emits a different stem/lemma in context.

Ensures real dictionary lemmas are preserved while recording spaCy's produced lemmas
in alt_lemmas with lemma_evidence: 'carrier'.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from nlp_manager import get_nlp  # noqa: E402


def enrich_all():
    for lang in ["en", "hu", "pl"]:
        print(f"[{lang.upper()}] Loading NLP model...")
        nlp = get_nlp(lang)
        for p in ["parser", "ner", "senter"]:
            if p in nlp.pipe_names:
                nlp.disable_pipe(p)
        cache = {}

        def spacy_lem(w):
            w = w.lower().strip()
            if w in cache:
                return cache[w]
            doc = nlp(w)
            res = doc[0].lemma_.lower() if len(doc) == 1 else w
            cache[w] = res
            return res

        lang_dir = os.path.join("lexicons", lang)
        count_mod = 0
        for fname in sorted(os.listdir(lang_dir)):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(lang_dir, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
            mod = False
            for entry in data.get("entries", []):
                if "lemma" in entry and entry["lemma"]:
                    lem = entry["lemma"].lower().strip()
                    s = spacy_lem(lem)
                    alts = entry.get("alt_lemmas", [])
                    alts_l = [a.lower().strip() for a in alts]
                    if s != lem and s not in alts_l:
                        alts.append(s)
                        entry["alt_lemmas"] = alts
                        entry["lemma_evidence"] = "carrier"
                        mod = True
                elif "phrase" in entry and entry["phrase"]:
                    alts = entry.get("alt_lemmas", [])
                    alts_l = [a.lower().strip() for a in alts]
                    for pw in entry["phrase"]:
                        pw_l = pw.lower().strip()
                        s = spacy_lem(pw_l)
                        if s != pw_l and s not in alts_l:
                            alts.append(s)
                            entry["alt_lemmas"] = alts
                            entry["lemma_evidence"] = "carrier"
                            mod = True
            if mod:
                with open(fpath, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=1)
                count_mod += 1
                print(f"  Enriched {lang}/{fname}")
        print(f"[{lang.upper()}] Done. {count_mod} files updated.\n")


if __name__ == "__main__":
    enrich_all()

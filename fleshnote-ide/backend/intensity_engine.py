"""
FleshNote — story intensity and valence per paragraph (Story Pulse, plan §5).

Three layers, all rule-based and inspectable:

1. paragraph_features(doc, text, lang): evidence from one parsed paragraph —
   lexicon hits per group with arousal and valence (after negation, intensifier
   and idiom handling), plus style counts. Stored in the Janitor's paragraph
   cache next to the flags, so it costs no extra parse.
2. score(record, lang): applies the fitted weights
   (lexicons/intensity_weights.json, see tools/janitor_eval/fit_intensity.py)
   to a feature record. Weights live outside the lexicon folders and outside
   the cache key, so refitting them never forces a re-parse.
3. normalize() / perceive(): the book-wide passes — per-manuscript relative
   scale (§5.4) and the asymmetric reader model (§5.4.1). O(n) over numbers.
"""

import json
import math
from pathlib import Path

WEIGHTS_PATH = Path(__file__).parent / "lexicons" / "intensity_weights.json"

# Lexicon kind → feature group. Emotion words carry most of the valence.
GROUPS = {
    "action_violent": "action",
    "action_urgent": "urgency",   # rush, flee, leap: pace without violence
    "danger_noun": "danger",
    "stakes_word": "stakes",
    "conflict_speech": "conflict",
    "calm_word": "calm",
    "emotion_label": "emotion",
    "emotion_noun": "emotion",
    "emotion_verb": "emotion",
    "emotion_adverb": "emotion",
}
SCORED_KINDS = tuple(GROUPS)
GROUP_NAMES = ("action", "urgency", "danger", "stakes", "conflict", "calm", "emotion")

# English puts 'not' on the linking verb ('was not afraid'); UD languages put
# the negator on the predicate itself.
_PREDICATE_DEPS = {"acomp", "attr", "oprd", "xcomp"}
_MODIFIER_DEPS = ("advmod", "amod", "advmod:mode", "advmod:emph", "advmod:tlocy")
INTENSIFY, DIMINISH = 1.3, 0.6
MAX_EVIDENCE = 6


def _negated(tok, negators) -> bool:
    heads = [tok] + ([tok.head] if tok.dep_ in _PREDICATE_DEPS else [])
    return any(c.lemma_.lower() in negators or c.lower_ in negators
               for h in heads for c in h.children if c.i != tok.i)


def _degree(tok, intensifiers, diminishers) -> float:
    factor = 1.0
    for c in tok.children:
        if c.dep_.startswith(_MODIFIER_DEPS):
            lemma = c.lemma_.lower()
            if lemma in intensifiers:
                factor *= INTENSIFY
            elif lemma in diminishers:
                factor *= DIMINISH
    return factor


def paragraph_features(doc, text: str, lang: str) -> dict:
    """Compact, JSON-safe evidence record for one parsed paragraph:
    w words, n sentences, p '!'/'?' count, d share of the text in dialogue,
    g {group: [hits, arousal sum]}, v valence sum, e {emotion: weight},
    ev strongest evidence [[entry id, word, arousal], …]."""
    from lexicon_engine import get_lexicon
    from routes.janitor import _speech_spans
    lex = get_lexicon(lang)
    matcher = lex.matcher(SCORED_KINDS)
    negators = lex.lemmas("negator")
    intensifiers, diminishers = lex.lemmas("intensifier"), lex.lemmas("diminisher")

    # Idioms: their own affect counts once, and they cancel the entries they
    # name in `blocks` on their own tokens ('z zimną krwią' is not blood).
    blocked: dict[int, set] = {}
    hits = []  # (group, entry, token, arousal, valence)
    for entry, idxs in lex.idiom_matches(doc):
        for i in idxs:
            blocked.setdefault(i, set()).update(entry.get("blocks", []))
        if entry.get("arousal"):
            tok = doc[idxs[0]]
            hits.append(("emotion", entry, tok, entry["arousal"], entry.get("valence") or 0.0))

    for tok in doc:
        entries = [e for e in matcher.match(tok) if e["id"] not in blocked.get(tok.i, ())]
        if not entries:
            continue
        # one piece of evidence per word: its strongest reading
        e = max(entries, key=lambda x: x.get("arousal") or 0.0)
        arousal, valence = e.get("arousal") or 0.0, e.get("valence") or 0.0
        factor = _degree(tok, intensifiers, diminishers)
        arousal *= factor
        valence *= factor
        if _negated(tok, negators):
            arousal *= 0.5
            valence = -valence
        hits.append((GROUPS[e["kind"]], e, tok, arousal, valence))

    # A weak entry ('push', 'blood', 'fire') is evidence only in the company of
    # a strong one somewhere in the paragraph (plan §2).
    if not any(h[1].get("strength") != "weak" for h in hits):
        hits = []

    groups: dict[str, list] = {}
    emotions: dict[str, float] = {}
    valence_sum = 0.0
    for group, e, tok, arousal, valence in hits:
        g = groups.setdefault(group, [0, 0.0])
        g[0] += 1
        g[1] += arousal
        valence_sum += valence
        for emo, w in (e.get("emotions") or {}).items():
            emotions[emo] = emotions.get(emo, 0.0) + w * max(arousal, 0.1)
    evidence = sorted(hits, key=lambda h: -h[3])[:MAX_EVIDENCE]

    words = sum(1 for t in doc if not (t.is_punct or t.is_space))
    speech = _speech_spans(text, dash_dialogue=lang in ("hu", "pl"))
    return {
        "w": words,
        "n": sum(1 for _ in doc.sents),
        "p": text.count("!") + text.count("?"),
        "d": round(sum(end - start for start, end in speech) / max(len(text), 1), 3),
        "g": {k: [c, round(a, 3)] for k, (c, a) in groups.items()},
        "v": round(valence_sum, 3),
        "e": {k: round(v, 3) for k, v in emotions.items()},
        "ev": [[e["id"], tok.text, round(a, 2)] for _, e, tok, a, _ in evidence],
    }


# ── scoring ──────────────────────────────────────────────────────────────────

# Densities are per 100 words with a floor, so a five-word line can't outscore
# a battle scene with one angry word.
_DENSITY_FLOOR_WORDS = 30


def feature_vector(rec: dict) -> dict[str, float]:
    """Named numeric features of a record; the fit and the scorer share this."""
    per100 = 100.0 / max(rec["w"], _DENSITY_FLOOR_WORDS)
    g = rec.get("g", {})
    # arousal per 100 words; calm words are low-arousal by definition, so for
    # them the number of hits is the signal
    out = {name: math.log1p(g.get(name, [0, 0.0])[0 if name == "calm" else 1] * per100)
           for name in GROUP_NAMES}
    out["sentence_length"] = math.log1p(rec["w"] / max(rec["n"], 1))
    out["exclaim"] = math.log1p(rec["p"] * per100)
    out["dialogue"] = rec["d"]
    out["length"] = math.log1p(rec["w"])
    return out


def valence_density(rec: dict) -> float:
    return rec.get("v", 0.0) * 100.0 / max(rec["w"], _DENSITY_FLOOR_WORDS)


_weights_cache: dict | None = None


def load_weights() -> dict:
    global _weights_cache
    if _weights_cache is None:
        _weights_cache = json.loads(WEIGHTS_PATH.read_text(encoding="utf-8"))
    return _weights_cache


def score(rec: dict, lang: str, weights: dict | None = None) -> tuple[float, float]:
    """(raw intensity on the 1–5 label scale, valence in -1..1) for a record."""
    model = (weights or load_weights())["langs"][lang]
    f = feature_vector(rec)
    raw = model["intercept"] + sum(
        c * (f[name] - m) / s for name, c, m, s in zip(model["features"], model["coef"], model["mean"], model["std"]))
    valence = math.tanh(valence_density(rec) / model["valence_scale"])
    return raw, valence


def top_emotions(rec: dict, n: int = 3) -> dict[str, float]:
    total = sum(rec.get("e", {}).values())
    if total <= 0:
        return {}
    best = sorted(rec["e"].items(), key=lambda kv: -kv[1])[:n]
    return {k: round(v / total, 2) for k, v in best}


# ── book-wide passes ─────────────────────────────────────────────────────────

def normalize(raw: list[float]) -> list[float]:
    """Manuscript-relative 0..1 (§5.4): z-score over the book, mapped through a
    logistic so the calmest and fiercest stretches use the full height."""
    if not raw:
        return []
    mean = sum(raw) / len(raw)
    std = math.sqrt(sum((x - mean) ** 2 for x in raw) / len(raw)) or 1.0
    return [1.0 / (1.0 + math.exp(-1.5 * (x - mean) / std)) for x in raw]


# Starting constants from the plan (§5.4.1); nothing to fit them against yet.
READER = {"up_min": 0.25, "up_max": 0.8, "down_min": 0.15, "down_max": 0.6}


MOOD_RATE = 0.35


def mood_line(values: list[float | None], words: list[int], rate: float = MOOD_RATE) -> list[float | None]:
    """The perceived mood: a plain exponential follower over signed valence in
    reading order. One mildly positive paragraph in a grim stretch nudges the
    line instead of flipping it across zero. None passes through as in perceive()."""
    out: list[float | None] = []
    p = None
    for x, w in zip(values, words):
        if x is None:
            out.append(None)
            continue
        p = x if p is None else p + (1 - (1 - rate) ** (max(w, 1) / 100.0)) * (x - p)
        out.append(p)
    return out


def perceive(values: list[float | None], words: list[int], consts: dict = READER) -> list[float | None]:
    """The perceived line: an asymmetric exponential follower in reading order.
    Rising from a low level is slow (wind-up), falling from a high level is slow
    (recovery); a longer paragraph moves the reader further. None (a paragraph
    not scored yet) leaves the reader where they were and yields None."""
    out: list[float | None] = []
    p = None
    for x, w in zip(values, words):
        if x is None:
            out.append(None)
            continue
        if p is None:
            p = x
        else:
            if x > p:
                a = consts["up_min"] + (consts["up_max"] - consts["up_min"]) * p
            else:
                a = consts["down_max"] - (consts["down_max"] - consts["down_min"]) * p
            a_eff = 1 - (1 - a) ** (max(w, 1) / 100.0)
            p = p + a_eff * (x - p)
        out.append(p)
    return out

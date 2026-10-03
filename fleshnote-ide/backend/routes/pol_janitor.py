import re
from routes.janitor import _build_context, _make_id, _speech_spans, _in_speech, _touches_speech, _narration_segments
from lexicon_engine import get_lexicon

# --- Polish SDT lexicons ---
# Word lists live in backend/lexicons/pl/*.json; legacy tier = the tuned lists
# (see the note in routes/janitor.py).
_LEX_PL = get_lexicon("pl")

LINKING_VERBS_PL = {"być", "stać", "wydawać", "wyglądać", "pozostawać", "czuć", "okazać", "okazywać"}

SPEECH_VERBS_PL = _LEX_PL.lemmas("conflict_speech", legacy_only=True)

FILTER_VERBS_PL = _LEX_PL.lemmas("filter_verb", legacy_only=True)

# Knowing/deciding is plot information, not a stated emotion — not flagged.
REALIZE_VERBS_PL = _LEX_PL.lemmas("realize_verb", legacy_only=True)

EMOTION_LEXICON_PL = _LEX_PL.lemmas("emotion_label", legacy_only=True)

EMOTION_NOUNS_PL = _LEX_PL.lemmas("emotion_noun", felt="state")
ALL_EMOTION_ADVERBS_PL = _LEX_PL.lemmas("emotion_adverb", felt="state")

_ADJ_ENDINGS_PL = sorted(("ymi", "imi", "ego", "emu", "ych", "ich", "ym", "im", "ej",
                          "ą", "a", "e", "y", "i"), key=len, reverse=True)


def _adj_stem_pl(word: str) -> str:
    """Rough stem of a Polish adjective/participle form, so 'zdumiona',
    'zdumionym' and 'zdumieni' all meet 'zdumiony'. The small Polish model
    often mislemmatizes these ('zdumiić') or tags them NOUN, so the analyzers
    match the spelling instead of the lemma."""
    w = word.lower()
    for end in _ADJ_ENDINGS_PL:
        if w.endswith(end) and len(w) - len(end) >= 4:
            w = w[:-len(end)]
            break
    if w.endswith("en"):      # zdumieni -> zdumion (masc. personal plural)
        w = w[:-2] + "on"
    elif w.endswith("l"):     # wściekli -> wściekł
        w = w[:-1] + "ł"
    return w


# Stems of the strong emotion adjectives (plus the tuned list) that name a felt
# state, not a trait ('uparty') or what something is like ('straszny'). Short
# stems ('zł' from 'zły') would collide with unrelated words, so they're left out.
EMOTION_LABEL_STEMS_PL = {
    _adj_stem_pl(lemma)
    for lemma in ((EMOTION_LEXICON_PL | _LEX_PL.lemmas("emotion_label", strength="strong"))
                  & _LEX_PL.lemmas("emotion_label", felt="state"))
    if lemma[-1:] in ("y", "i") and len(_adj_stem_pl(lemma)) >= 5
}

# On a face, look or voice a trait word shows the moment's state too
# ('pogardliwy grymas', 'nieśmiałe spojrzenie'); evaluative words stay out.
FACE_ADJECTIVE_STEMS_PL = EMOTION_LABEL_STEMS_PL | {
    _adj_stem_pl(lemma) for lemma in _LEX_PL.lemmas("emotion_label", felt="trait")
    if lemma[-1:] in ("y", "i") and len(_adj_stem_pl(lemma)) >= 5
}

# Face/look/voice nouns: an emotion adjective on them tells the feeling
# ('zaniepokojonym głosem', 'z twarzą niespokojną').
FACE_NOUNS_PL = {
    "twarz", "głos", "spojrzenie", "wzrok", "oko", "mina", "uśmiech", "ton", "grymas",
    "wyraz", "lico",
}

# Emotion verbs whose subject feels the emotion ('wstydziła się', 'zdumiał się');
# behaviors (płakać, drżeć, śmiać się) show rather than tell.
EXPERIENCER_VERBS_PL = _LEX_PL.lemmas("emotion_verb", role="experiencer")

_FRAME_PREPS_PL = {"z", "ze", "ku", "w", "we", "od"}
# Nouns in the lexicon whose frames are mostly not a feeling: 'ku wierze'
# (faith), 'w czasie spokoju' (peacetime), 'w nadziei, że' (in the hope that),
# 'z bólu' (usually physical pain).
NOT_FRAME_NOUNS_PL = {"wiara", "spokój", "pokój", "nadzieja", "ból"}

# Single-token adverbs only; manner phrases ("ze złością") are phrase entries in
# the lexicon and need the phrase matcher.
EMOTION_ADVERBS_PL = _LEX_PL.lemmas("emotion_adverb", legacy_only=True)

STATE_EXEMPTIONS_PL = {
    "wysoki", "niski", "stary", "młody", "otwarty", "zamknięty", "martwy", "żywy",
    "pusty", "pełny", "ciemny", "jasny", "cichy", "głośny", "urodzony", "gotowy",
    "pijany", "śpiący", "mokry", "suchy", "czysty", "brudny", "zajęty",
}

# Grammatical adverbs / conjunctions / particles to ignore in weak-adverb detection
IGNORE_ADVERBS_PL = {
    "bardzo", "tak", "nie", "już", "jeszcze", "tylko", "właśnie", "jednak",
    "też", "także", "zawsze", "nigdy", "często", "rzadko", "teraz", "potem",
    "tutaj", "tam", "tu", "czy", "więcej", "mniej", "trochę", "dużo", "mało",
    "wcześniej", "później", "zaraz", "kiedy", "gdzie", "jak", "skąd", "dokąd",
    "prawie", "nawet", "raczej", "chyba", "może", "pewnie", "oczywiście",
    "naprawdę", "rzeczywiście", "właściwie", "szczególnie", "głównie", "jedynie",
}

# Manner adverbs that signal emotion/state telling
WEAK_ADVERBS_PL = {
    "szybko", "wolno", "powoli", "cicho", "głośno", "smutnie", "radośnie",
    "spokojnie", "gniewnie", "leniwie", "nagle", "gwałtownie", "delikatnie",
    "mocno", "słabo", "ostro", "łagodnie", "nerwowo", "dumnie", "ponuro",
}

# Fixed forms ending in -nie/-wie that are not passive participles
PASSIVE_EXEMPTIONS_PL = {"poza", "oprócz", "podczas", "wobec", "wbrew"}

# Passive auxiliary verbs in Polish
PASSIVE_AUX_PL = {"być", "zostać", "bywać", "zostawać"}

# --- Five Senses Lexicons (Polish) ---
# Stem-based: Polish is inflected, so prefix matching is used.
# Only the fallback for text with no parse; sense evidence comes from the
# lexicon's sensory entries (routes/janitor_senses.py).
SIGHT_STEMS_PL = (
    "widz", "patrz", "spojrz", "wzrok", "blask", "ciemn", "jasn", "kolor",
    "świat", "migot", "lśni", "błyszk", "połysk", "widocz", "niewidocz",
    "zaobserwow", "dojrz", "przygląd", "przypatrz", "oślepi", "zamajacz",
)
SOUND_STEMS_PL = (
    "słysz", "słuch", "dźwięk", "hałas", "cichy", "głośn", "szept", "krzyk",
    "grzmot", "echo", "odgłos", "łoskot", "stukot", "szelest", "brzęk",
    "zgrzyt", "huczał", "dudni", "zagrzmi", "świszcz", "piszcz", "pohukiw",
)
SMELL_STEMS_PL = (
    "wąch", "zapach", "smród", "aromat", "perfum", "dym", "woń", "fetor",
    "odór", "buchać", "trąci", "cuchnąć", "ziołow", "kwiatow",
)
TOUCH_STEMS_PL = (
    "dotyk", "dotykal", "gładk", "tward", "miękkk", "ciepł", "zimn", "mokr",
    "lepk", "szorstk", "jedwabiś", "ślisk", "wilgotn", "suchy", "drapie",
    "swędz", "mrowił", "drżał", "trząsł", "ściskał", "szczyp",
)
TASTE_STEMS_PL = (
    "smak", "gorzk", "słodk", "kwaśn", "słon", "pyszn", "przełyk", "gryź",
    "żuć", "połknąć", "oblizał", "popijał", "kosztow", "łykał", "ostr", "pikant",
)

PL_SENSES_STEMS = {
    "wzrok": SIGHT_STEMS_PL,
    "słuch": SOUND_STEMS_PL,
    "węch": SMELL_STEMS_PL,
    "dotyk": TOUCH_STEMS_PL,
    "smak": TASTE_STEMS_PL,
}


def _count_senses_pl(plain_text: str) -> dict:
    """Count sense word hits per sense for Polish text using stem prefix matching."""
    words = re.findall(r'\b\w+\b', plain_text.lower())
    result = {}
    for sense, stems in PL_SENSES_STEMS.items():
        count = sum(1 for w in words if any(w.startswith(s) for s in stems))
        result[sense] = count
    return result


def _analyze_weak_adverbs_pl(plain_text: str, language: str, cap: int = 5) -> list[dict]:
    """Detect weak adverbs modifying verbs in Polish text."""
    if language != "pl":
        return []
    suggestions = []
    try:
        from nlp_manager import parse_cached
        doc = parse_cached(language, plain_text[:10000])
    except Exception:
        return []

    seen_texts: set = set()
    for token in doc:
        if len(suggestions) >= cap:
            break
        lower_text = token.text.lower()
        if token.pos_ not in ("ADV", "ADJ"):
            continue
        is_weak = False
        if lower_text in WEAK_ADVERBS_PL:
            is_weak = True
        elif (lower_text.endswith("nie") or lower_text.endswith("wie")
              or lower_text.endswith("rze") or lower_text.endswith("ko")):
            if token.head.pos_ == "VERB" and lower_text not in IGNORE_ADVERBS_PL:
                is_weak = True
        if not is_weak:
            continue
        if token.head.pos_ == "VERB":
            start_char = min(token.idx, token.head.idx)
            end_char = max(token.idx + len(token.text), token.head.idx + len(token.head.text))
        else:
            start_char = token.idx
            end_char = token.idx + len(token.text)
        if end_char - start_char > 50:
            start_char = token.idx
            end_char = token.idx + len(token.text)
        matched_text = plain_text[start_char:end_char]
        if matched_text.lower() in seen_texts:
            continue
        seen_texts.add(matched_text.lower())
        context, hl_start, hl_end = _build_context(plain_text, start_char, end_char)
        suggestions.append({
            "id": _make_id("weak_adverbs", matched_text, start_char),
            "type": "weak_adverbs",
            "entity_type": "adverb",
            "matched_text": matched_text,
            "context": context,
            "context_highlight_start": hl_start,
            "context_highlight_end": hl_end,
            "char_offset": start_char,
            "replacement": None
        })
    return suggestions


_PERSON_PRONOUNS_PL = {
    "ja", "ty", "on", "ona", "ono", "my", "wy", "oni", "one", "ktoś", "nikt", "kto",
    "wszyscy", "każdy",
}


# Polish marks animacy only on masculine nouns (Animacy=Hum/Nhum), so feminine
# and neuter person nouns need a list.
_PERSON_NOUNS_FEM_NEUT_PL = {
    "matka", "kobieta", "dziewczyna", "dziewczynka", "królowa", "księżna", "pani",
    "panna", "siostra", "córka", "żona", "babka", "babcia", "ciotka", "służąca",
    "dama", "osoba", "dziecko", "dziewczę", "pacholę", "niewiasta", "wdowa", "zakonnica",
    "nauczycielka", "sąsiadka", "przyjaciółka", "matula",
}


def _has_person_agent_pl(participle) -> bool:
    """True if the participle's 'przez X' names a doer who is a person (or animal).

    'przez chwilę' (for a moment) hangs off participles too, and inanimate
    doers ('oświetlony przez okna', 'otoczone przez las') are how descriptive
    prose is written, so a bare 'przez' is not enough — the same person-only
    rule as the English check."""
    for child in participle.children:
        if not any(c.dep_ == "case" and c.lower_ == "przez" for c in child.children):
            continue
        if child.pos_ == "PROPN":
            return True
        if child.pos_ == "PRON":
            if child.lemma_.lower() in _PERSON_PRONOUNS_PL:
                return True
            continue
        if child.dep_ != "obl:agent" or child.pos_ != "NOUN":
            continue
        animacy = child.morph.get("Animacy")
        if "Hum" in animacy or "Nhum" in animacy:
            return True
        if not animacy and child.lemma_.lower() in _PERSON_NOUNS_FEM_NEUT_PL:
            return True
    return False


def _analyze_passive_voice_pl(plain_text: str, language: str, cap: int = 3) -> list[dict]:
    """Detect passive constructions in Polish that name a person as their doer
    ('został napisany przez króla').

    Polish passive: 'zostać/być' + past passive participle (-ny/-na/-ne/-ty/-ta/-te suffix).
    spaCy Polish model often tags these as VERB with 'aux:pass' or 'auxpass' dependency,
    but it's inconsistent; we therefore also catch ADJ participle forms directly.
    Agentless passives are usually deliberate and are not flagged.
    """
    if language != "pl":
        return []
    suggestions = []
    try:
        from nlp_manager import parse_cached
        doc = parse_cached(language, plain_text[:10000])
    except Exception:
        return []

    PASSIVE_SUFFIXES = ("any", "ana", "ane", "ani", "ane",
                        "ony", "ona", "one", "oni",
                        "ty", "ta", "te", "ci")

    seen_texts: set = set()
    for token in doc:
        if len(suggestions) >= cap:
            break
        lower_text = token.text.lower()
        if not any(t.lower_ == "przez" for t in token.sent):
            continue

        # Path 1: spaCy marks the auxiliary as auxpass
        if (token.dep_ in ("auxpass", "aux:pass") and token.head.pos_ == "VERB"
                and _has_person_agent_pl(token.head)):
            start_char = min(token.idx, token.head.idx)
            end_char = max(token.idx + len(token.text), token.head.idx + len(token.head.text))
            matched_text = plain_text[start_char:end_char]
            if matched_text.lower() not in seen_texts:
                seen_texts.add(matched_text.lower())
                context, hl_start, hl_end = _build_context(plain_text, start_char, end_char)
                suggestions.append({
                    "id": _make_id("passive_voice", matched_text, start_char),
                    "type": "passive_voice",
                    "entity_type": "participle",
                    "matched_text": matched_text,
                    "context": context,
                    "context_highlight_start": hl_start,
                    "context_highlight_end": hl_end,
                    "char_offset": start_char,
                    "replacement": None
                })
            continue

        # Path 2: ADJ/VERB token with passive participle suffix + passive auxiliary as child/head
        if token.pos_ not in ("ADJ", "VERB"):
            continue
        if lower_text in PASSIVE_EXEMPTIONS_PL:
            continue
        has_passive_suffix = any(lower_text.endswith(s) for s in PASSIVE_SUFFIXES)
        if not has_passive_suffix:
            continue
        # Check if there's a passive auxiliary nearby (parent or sibling)
        has_aux = (
            token.head.lemma_ in PASSIVE_AUX_PL
            or any(c.lemma_ in PASSIVE_AUX_PL for c in token.children)
        )
        if not has_aux or not _has_person_agent_pl(token):
            continue
        start_char = token.idx
        end_char = token.idx + len(token.text)
        matched_text = plain_text[start_char:end_char]
        if matched_text.lower() in seen_texts:
            continue
        seen_texts.add(matched_text.lower())
        context, hl_start, hl_end = _build_context(plain_text, start_char, end_char)
        suggestions.append({
            "id": _make_id("passive_voice", matched_text, start_char),
            "type": "passive_voice",
            "entity_type": "participle",
            "matched_text": matched_text,
            "context": context,
            "context_highlight_start": hl_start,
            "context_highlight_end": hl_end,
            "char_offset": start_char,
            "replacement": None
        })
    return suggestions


def _is_dialogue_pl(sent) -> bool:
    """Return True if this sentence is (part of) dialogue — including em-dash lines."""
    text = sent.text
    # Polish quotation marks „" and «»
    if '\u201e' in text or '\u201d' in text or '\u00ab' in text or '\u00bb' in text or '"' in text:
        return True
    # Em-dash dialogue (standard in Polish prose)
    stripped = text.lstrip()
    if stripped.startswith('\u2014') or stripped.startswith('\u2013'):
        return True
    for token in sent:
        if token.lemma_ in SPEECH_VERBS_PL:
            for child in token.children:
                if child.dep_ in ("ccomp", "parataxis", "obj"):
                    return True
    return False


def _detect_emotion_label_pl(sent) -> dict | None:
    """Detect: linking verb + emotion adjective, or zero-copula adjective as ROOT."""
    for token in sent:
        if token.lemma_ in LINKING_VERBS_PL:
            for child in token.children:
                if child.pos_ == "ADJ":
                    lemma = child.lemma_.lower()
                    if lemma in STATE_EXEMPTIONS_PL:
                        continue
                    if lemma in EMOTION_LEXICON_PL:
                        start_char = min(token.idx, child.idx)
                        end_char = max(token.idx + len(token.text), child.idx + len(child.text))
                        return {
                            "start_char": start_char,
                            "end_char": end_char,
                            "entity_type": "emotion_label",
                            "confidence": 0.75,
                        }
    # UD parse — the ADJ is the predicate head and 'być' hangs off it as `cop`.
    # Polish drops subject pronouns ('Był bardzo zły'), so a cop child alone is enough.
    for adj in sent:
        if adj.pos_ != "ADJ":
            continue
        if (adj.lemma_.lower() not in EMOTION_LEXICON_PL
                and _adj_stem_pl(adj.text) not in EMOTION_LABEL_STEMS_PL):
            continue
        # 'była zdumiona', 'był zaskoczony' come out as participle + aux:pass.
        if any(c.dep_ in ("cop", "nsubj", "aux:pass") for c in adj.children):
            return {
                "start_char": adj.idx,
                "end_char": adj.idx + len(adj.text),
                "entity_type": "emotion_label",
                "confidence": 0.65,
            }
    return None


def _detect_filter_verb_pl(sent) -> dict | None:
    """Detect: filter verb with subject + object clause."""
    for token in sent:
        if token.lemma_ in FILTER_VERBS_PL:
            has_subj = any(c.dep_ in ("nsubj", "nsubj:pass") for c in token.children)
            has_obj = any(c.dep_ in ("obj", "iobj", "ccomp", "xcomp", "advcl") for c in token.children)
            if has_subj and has_obj:
                return {
                    "start_char": token.idx,
                    "end_char": token.idx + len(token.text),
                    "entity_type": "filter_verb",
                    "confidence": 0.50,
                }
    return None


def _detect_realize_verb_pl(sent) -> dict | None:
    """Detect: cognitive verb with complement clause."""
    for token in sent:
        if token.lemma_ in REALIZE_VERBS_PL:
            has_comp = any(c.dep_ in ("ccomp", "xcomp") for c in token.children)
            if has_comp:
                return {
                    "start_char": token.idx,
                    "end_char": token.idx + len(token.text),
                    "entity_type": "realize_verb",
                    "confidence": 0.45,
                }
    return None


def _detect_adverb_emotion_pl(sent) -> dict | None:
    """Detect: speech verb as ROOT + emotion adverb modifier."""
    for token in sent:
        if token.dep_ == "ROOT" and token.lemma_ in SPEECH_VERBS_PL:
            for child in token.children:
                if child.dep_ == "advmod" and child.lemma_.lower() in EMOTION_ADVERBS_PL:
                    start_char = min(token.idx, child.idx)
                    end_char = max(token.idx + len(token.text), child.idx + len(child.text))
                    return {
                        "start_char": start_char,
                        "end_char": end_char,
                        "entity_type": "adverb_emotion",
                        "confidence": 0.65,
                    }
    return None


def _detect_detached_emotion_pl(sent) -> dict | None:
    """Detect a depictive emotion adjective on a character in an action clause:
    'wrócił na obiad bardzo zakłopotany', 'zawołał uradowany Zych'."""
    for tok in sent:
        if tok.pos_ not in ("ADJ", "NOUN") or tok.dep_.startswith("amod"):
            continue
        if "Nom" not in tok.morph.get("Case") or tok.head.pos_ != "VERB" or tok.head is tok:
            continue
        if any(c.dep_ in ("cop", "aux:pass") for c in tok.children):
            continue  # a predicate; the emotion-label detector handles those
        if _adj_stem_pl(tok.text) in EMOTION_LABEL_STEMS_PL:
            return {
                "start_char": tok.idx,
                "end_char": tok.idx + len(tok.text),
                "entity_type": "detached_emotion",
                "confidence": 0.7,
            }
    return None


def _detect_emotion_attribute_pl(sent) -> dict | None:
    """Detect an emotion adjective on a face/voice noun or a 'z' + instrumental
    manner phrase: 'zaniepokojonym głosem', 'z nerwowym pośpiechem'."""
    for tok in sent:
        if tok.pos_ != "ADJ" or not tok.dep_.startswith("amod"):
            continue
        stem = _adj_stem_pl(tok.text)
        noun = tok.head
        manner = ("Ins" in noun.morph.get("Case")
                  and (noun.dep_ in ("obl", "obl:arg", "iobj")
                       or any(c.dep_ == "case" and c.lower_ in ("z", "ze") for c in noun.children)))
        on_face = noun.lemma_.lower() in FACE_NOUNS_PL and stem in FACE_ADJECTIVE_STEMS_PL
        if on_face or (manner and stem in EMOTION_LABEL_STEMS_PL):
            return {
                "start_char": min(tok.idx, noun.idx),
                "end_char": max(tok.idx + len(tok.text), noun.idx + len(noun.text)),
                "entity_type": "emotion_attribute",
                "confidence": 0.7,
            }
    return None


def _detect_emotion_noun_frame_pl(sent) -> dict | None:
    """Detect an emotion noun in a stock frame: 'z trwogi', 'ku mojemu zdumieniu',
    'w gniewie', 'napełniał ją wstrętem'."""
    for tok in sent:
        lemma = tok.lemma_.lower()
        if tok.pos_ != "NOUN" or lemma not in EMOTION_NOUNS_PL or lemma in NOT_FRAME_NOUNS_PL:
            continue
        prep = next((c for c in tok.children if c.dep_ == "case" and c.lower_ in _FRAME_PREPS_PL), None)
        bare_ins = ("Ins" in tok.morph.get("Case") and prep is None
                    and tok.dep_ in ("obl", "obl:arg", "iobj") and tok.head.pos_ == "VERB")
        if prep is not None or bare_ins:
            start = prep.idx if prep is not None and prep.idx < tok.idx else tok.idx
            return {
                "start_char": start,
                "end_char": tok.idx + len(tok.text),
                "entity_type": "emotion_noun_frame",
                "confidence": 0.7,
            }
    return None


def _detect_emotion_manner_pl(sent) -> dict | None:
    """Detect an emotion adverb on any action: 'spojrzał gniewnie', 'smutnie odszedł'."""
    for tok in sent:
        if tok.pos_ != "ADV" or tok.dep_ != "advmod" or tok.head.pos_ != "VERB":
            continue
        word = tok.lower_
        if word in ALL_EMOTION_ADVERBS_PL or tok.lemma_.lower() in ALL_EMOTION_ADVERBS_PL:
            return {
                "start_char": tok.idx,
                "end_char": tok.idx + len(tok.text),
                "entity_type": "emotion_manner",
                "confidence": 0.7,
            }
    return None


def _detect_emotion_verb_pl(sent) -> dict | None:
    """Detect an emotion stated as a finite verb: 'wstydziła się', 'zdumiał się'."""
    for tok in sent:
        if tok.pos_ != "VERB" or "Fin" not in tok.morph.get("VerbForm"):
            continue
        # 'bałby się' — a hypothetical, not a feeling anyone had.
        if "Cnd" in tok.morph.get("Mood") or any(c.lower_ == "by" for c in tok.children):
            continue
        if tok.lemma_.lower() in EXPERIENCER_VERBS_PL:
            return {
                "start_char": tok.idx,
                "end_char": tok.idx + len(tok.text),
                "entity_type": "emotion_verb",
                "confidence": 0.7,
            }
    return None


def _analyze_show_dont_tell_pl(
    plain_text: str,
    language: str,
    confidence_threshold: float = 0.5,
    cap: int = 5
) -> list[dict]:
    """Show-don't-tell pipeline for Polish with em-dash dialogue exclusion.

    The filter-verb detector is kept but not run (perception verbs are mostly
    sensory showing; it produced only false positives in evaluation).
    """
    if language != "pl":
        return []
    suggestions = []
    try:
        from nlp_manager import parse_cached
        doc = parse_cached(language, plain_text[:10000])
    except Exception:
        return []

    detectors = [
        _detect_emotion_label_pl,
        _detect_realize_verb_pl,
        _detect_adverb_emotion_pl,
        _detect_detached_emotion_pl,
        _detect_emotion_attribute_pl,
        _detect_emotion_noun_frame_pl,
        _detect_emotion_manner_pl,
        _detect_emotion_verb_pl,
    ]

    speech = _speech_spans(plain_text, dash_dialogue=True)
    flagged_spans: list[tuple[int, int]] = []
    seen_offsets: set = set()
    for sent in doc.sents:
        if len(suggestions) >= cap:
            break
        # Marked dialogue is handled per flag below; the sentence-level check is
        # for dialogue the marks can't delimit.
        if not _touches_speech(sent, speech) and _is_dialogue_pl(sent):
            continue
        for detector, segment in ((d, seg) for d in detectors
                                  for seg in _narration_segments(sent, speech)):
            if len(suggestions) >= cap:
                break
            result = detector(segment)
            if result is None:
                continue
            if result["confidence"] < confidence_threshold:
                continue
            start_char = result["start_char"]
            end_char = result["end_char"]
            if (start_char in seen_offsets or _in_speech(start_char, speech)
                    or _in_speech(end_char - 1, speech)):
                continue
            # One card per spot: two rules can flag the same words ('Sophia
            # worried' as a verb and as a fragment).
            if any(start_char < e and s < end_char for s, e in flagged_spans):
                continue
            # A missing full stop can merge paragraphs into one parsed sentence.
            if "\n" in plain_text[start_char:end_char]:
                continue
            seen_offsets.add(start_char)
            flagged_spans.append((start_char, end_char))
            matched_text = plain_text[start_char:end_char]
            context, hl_start, hl_end = _build_context(plain_text, start_char, end_char)
            suggestions.append({
                "id": _make_id("show_dont_tell", matched_text, start_char),
                "type": "show_dont_tell",
                "entity_type": result["entity_type"],
                "confidence": result["confidence"],
                "matched_text": matched_text,
                "context": context,
                "context_highlight_start": hl_start,
                "context_highlight_end": hl_end,
                "char_offset": start_char,
                "replacement": None
            })
    return suggestions


def _analyze_pacing_pl(
    plain_text: str,
    language: str,
    cap: int = 2
) -> list[dict]:
    if language != "pl":
        return []
    suggestions = []
    try:
        from nlp_manager import parse_cached
        doc = parse_cached(language, plain_text[:10000])
    except Exception:
        return []

    sentences = list(doc.sents)
    if len(sentences) < 3:
        return []

    seen_offsets: set = set()

    for i in range(len(sentences) - 2):
        if len(suggestions) >= cap:
            break

        s1, s2, s3 = sentences[i], sentences[i + 1], sentences[i + 2]

        def get_first_word(sent):
            for t in sent:
                if not t.is_punct and not t.is_space:
                    return t
            return None

        t1, t2, t3 = get_first_word(s1), get_first_word(s2), get_first_word(s3)
        if not t1 or not t2 or not t3:
            continue

        if t1.text.lower() != t2.text.lower() or t2.text.lower() != t3.text.lower():
            continue

        start_char = t1.idx
        end_char = t3.idx + len(t3)
        if end_char - start_char > 250:
            end_char = start_char + 250
        if start_char in seen_offsets:
            continue
        seen_offsets.add(start_char)

        matched_text = plain_text[start_char:end_char]
        context, hl_start, hl_end = _build_context(plain_text, start_char, end_char, window=30)

        suggestions.append({
            "id": _make_id("pacing", matched_text, start_char),
            "type": "pacing",
            "entity_type": f'"{t1.text.lower()}"',
            "matched_text": matched_text,
            "context": context,
            "context_highlight_start": hl_start,
            "context_highlight_end": hl_end,
            "char_offset": start_char,
            "replacement": None
        })

    return suggestions

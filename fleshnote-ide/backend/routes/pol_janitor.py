import re
from routes.janitor import _build_context, _make_id

# --- Polish SDT lexicons ---
LINKING_VERBS_PL = {"być", "stać", "wydawać", "wyglądać", "pozostawać", "czuć", "okazać", "okazywać"}

SPEECH_VERBS_PL = {
    "mówić", "powiedzieć", "zapytać", "pytać", "krzyczeć", "szeptać", "mruczeć",
    "odpowiedzieć", "wołać", "odrzec", "stwierdzić", "rzucić", "mruknąć",
    "warknąć", "szlochać", "błagać", "myśleć", "zastanawiać", "rozmyślać",
}

FILTER_VERBS_PL = {"widzieć", "zobaczyć", "słyszeć", "usłyszeć", "czuć", "poczuć", "zauważyć", "obserwować", "wąchać"}

REALIZE_VERBS_PL = {"zrozumieć", "rozumieć", "wiedzieć", "zdać", "rozpoznać", "poczuć", "zdecydować", "postanowić", "uświadomić"}

EMOTION_LEXICON_PL = {
    "zły", "wściekły", "smutny", "szczęśliwy", "przestraszony", "przerażony",
    "zdenerwowany", "nerwowy", "zazdrosny", "podekscytowany", "przygnębiony",
    "samotny", "zrozpaczony", "dumny", "rozczarowany", "zawstydzony",
    "winny", "niespokojny", "zaniepokojony", "sfrustrowany", "rozgoryczony",
    "rozżalony", "uradowany", "zasmucony", "wzburzony", "przygnębiony",
    "podniecony", "zbulwersowany", "zakłopotany", "skrępowany", "zirytowany",
}

EMOTION_ADVERBS_PL = {
    "złośliwie", "smutnie", "szczęśliwie", "nerwowo", "zazdrośnie", "dumnie",
    "desperacko", "gniewnie", "boleśnie", "radośnie", "ponuro", "żałośnie",
    "ze złością", "ze smutkiem", "z dumą", "z zazdrością",
}

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


def _analyze_five_senses_pl(plain_text: str, language: str) -> list[dict]:
    """Flag senses completely absent from the chapter text (Polish)."""
    if language != "pl":
        return []
    counts = _count_senses_pl(plain_text)
    missing = [sense for sense, count in counts.items() if count == 0]
    if not missing:
        return []
    label = ", ".join(missing)
    context = plain_text[:120].strip()
    return [{
        "id": _make_id("five_senses", label, 0),
        "type": "five_senses",
        "entity_type": label,
        "entity_id": None,
        "entity_name": None,
        "matched_text": label,
        "context": context,
        "context_highlight_start": 0,
        "context_highlight_end": 0,
        "char_offset": 0,
        "replacement": None,
    }]


def _analyze_weak_adverbs_pl(plain_text: str, language: str, cap: int = 5) -> list[dict]:
    """Detect weak adverbs modifying verbs in Polish text."""
    if language != "pl":
        return []
    suggestions = []
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
        doc = nlp(plain_text[:10000])
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


def _analyze_passive_voice_pl(plain_text: str, language: str, cap: int = 3) -> list[dict]:
    """Detect passive constructions in Polish.

    Polish passive: 'zostać/być' + past passive participle (-ny/-na/-ne/-ty/-ta/-te suffix).
    spaCy Polish model often tags these as VERB with 'aux:pass' or 'auxpass' dependency,
    but it's inconsistent; we therefore also catch ADJ participle forms directly.
    """
    if language != "pl":
        return []
    suggestions = []
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
        doc = nlp(plain_text[:10000])
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

        # Path 1: spaCy marks the auxiliary as auxpass
        if token.dep_ in ("auxpass", "aux:pass") and token.head.pos_ == "VERB":
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
        if not has_aux:
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
    # Zero-copula: ADJ as ROOT with nsubj child
    root_tokens = [t for t in sent if t.dep_ == "ROOT"]
    if root_tokens and root_tokens[0].pos_ == "ADJ":
        adj = root_tokens[0]
        if any(c.dep_ == "nsubj" for c in adj.children):
            if adj.lemma_.lower() in EMOTION_LEXICON_PL:
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
                    "confidence": 0.55,
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


def _analyze_show_dont_tell_pl(
    plain_text: str,
    language: str,
    confidence_threshold: float = 0.5,
    cap: int = 5
) -> list[dict]:
    """4-detector show-don't-tell pipeline for Polish with em-dash dialogue exclusion."""
    if language != "pl":
        return []
    suggestions = []
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
        doc = nlp(plain_text[:10000])
    except Exception:
        return []

    detectors = [
        _detect_emotion_label_pl,
        _detect_filter_verb_pl,
        _detect_realize_verb_pl,
        _detect_adverb_emotion_pl,
    ]

    seen_offsets: set = set()
    for sent in doc.sents:
        if len(suggestions) >= cap:
            break
        if _is_dialogue_pl(sent):
            continue
        for detector in detectors:
            if len(suggestions) >= cap:
                break
            result = detector(sent)
            if result is None:
                continue
            if result["confidence"] < confidence_threshold:
                continue
            start_char = result["start_char"]
            if start_char in seen_offsets:
                continue
            seen_offsets.add(start_char)
            end_char = result["end_char"]
            matched_text = plain_text[start_char:end_char]
            context, hl_start, hl_end = _build_context(plain_text, start_char, end_char)
            suggestions.append({
                "id": _make_id("show_dont_tell", matched_text, start_char),
                "type": "show_dont_tell",
                "entity_type": result["entity_type"],
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
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
        doc = nlp(plain_text[:10000])
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

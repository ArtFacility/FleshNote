import re
from routes.janitor import _build_context, _make_id

# --- Hungarian SDT lexicons ---
LINKING_VERBS_HU = {"van", "volt", "lesz", "lett", "marad", "tűnik", "látszik"}

SPEECH_VERBS_HU = {
    "mond", "kérdez", "kiált", "suttog", "mormol", "felel",
    "válaszol", "szól", "ordít", "morog", "könyörög", "gondol", "töpreng", "tűnődik"
}

FILTER_VERBS_HU = {"lát", "hall", "érez", "észrevesz", "figyel", "megfigyel", "szagol"}

REALIZE_VERBS_HU = {"rájön", "megért", "tud", "felismer", "érez", "dönt", "belát"}

EMOTION_LEXICON_HU = {
    "dühös", "mérges", "szomorú", "boldog", "félős", "ijedt", "aggódó", "ideges",
    "féltékeny", "izgatott", "lehangolt", "magányos", "kétségbeesett", "reménykedő",
    "büszke", "csalódott", "zavart", "szégyenlős", "undorodó", "elkeseredett",
    "szorongó", "rettegő", "bosszús", "elégedett", "bűntudatos", "borús",
    "boldogtalan", "nyugtalan", "reménytelen", "megtört",
}

EMOTION_ADVERBS_HU = {
    "dühösen", "szomorúan", "boldogan", "idegesen", "szorongva", "keserűen",
    "féltékenyen", "kétségbeesetten", "büszkén", "haragosan", "örömmel", "nyomorultul",
}

STATE_EXEMPTIONS_HU = {
    "magas", "alacsony", "öreg", "fiatal", "nyitott", "zárt", "halott", "élő",
    "üres", "tele", "sötét", "világos", "született", "csendes", "hangos",
    "kész", "részeg",
}

# Adverbs to ignore in weak-adverb detection (grammatical adverbs and conjunctions)
IGNORE_ADVERBS_HU = {
    "nagyon", "olyan", "ilyen", "hogyan", "sokan", "igazán", "valóban",
    # Conjunctions/relative adverbs that end in -en/-an but are not manner adverbs
    "miközben", "ahogyan", "mielőtt", "miután", "amikor", "amennyiben",
}

# Known weak adverbs that indicate emotion/state telling
WEAK_ADVERBS_HU = {
    "hirtelen", "gyorsan", "láthatóan", "szomorúan", "dühösen",
    "hangosan", "halkan", "lassan", "boldogan", "könnyen",
    "nehezen", "sietve",
}

# Fixed grammatical forms ending in -va/-ve that are not passive participles
PASSIVE_EXEMPTIONS_HU = {"kivéve", "beleszámítva", "figyelembe"}

# --- Five Senses Lexicons (Hungarian) ---
# Uses word stems — Hungarian is agglutinative, so matching is prefix-based in _count_senses_hu.
SIGHT_STEMS_HU = (
    "lát", "néz", "pillant", "szemlél", "megfigyel", "fény", "sötét", "szín",
    "ragyog", "csillog", "villog", "halvány", "látható", "homályos", "bámul",
    "megpillant", "vakít", "szikrázik",
)
SOUND_STEMS_HU = (
    "hall", "figyel", "hang", "csendes", "csend", "zaj", "zúg", "zörög",
    "döng", "suttog", "kiált", "mormol", "morog", "ordít", "csörög", "kopog",
    "robaj", "mennydörög", "csikorg", "füttyent", "kattant", "süvít",
)
SMELL_STEMS_HU = (
    "szagol", "illat", "bűz", "büdös", "aroma", "dohos", "füstös", "szagú",
    "bűzlik", "parfüm", "szaglás", "szimatol",
)
TOUCH_STEMS_HU = (
    "érint", "simít", "simogat", "kemény", "puha", "hideg", "meleg", "sima",
    "durva", "nyirkos", "száraz", "ragacsos", "selymes", "szorít", "dörzsöl",
    "bizserg", "zsibbad", "remeg", "reszket", "tapint",
)
TASTE_STEMS_HU = (
    "ízlik", "ízlel", "keserű", "édes", "savanyú", "sós", "ízletes", "nyel",
    "harap", "rág", "nyalint", "kortyol", "zamatos", "fanyar", "csípős", "émelygős",
)
HU_SENSES_STEMS = {
    "látás": SIGHT_STEMS_HU,
    "hallás": SOUND_STEMS_HU,
    "szaglás": SMELL_STEMS_HU,
    "tapintás": TOUCH_STEMS_HU,
    "ízlelés": TASTE_STEMS_HU,
}


def _count_senses_hu(plain_text: str) -> dict:
    """Count sense word hits per sense for Hungarian text using stem prefix matching."""
    words = re.findall(r'\b\w+\b', plain_text.lower())
    result = {}
    for sense, stems in HU_SENSES_STEMS.items():
        count = sum(1 for w in words if any(w.startswith(s) for s in stems))
        result[sense] = count
    return result


def _analyze_five_senses_hu(plain_text: str, language: str) -> list[dict]:
    """Flag senses completely absent from the chapter text (Hungarian)."""
    if language != "hu":
        return []
    counts = _count_senses_hu(plain_text)
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


def _analyze_weak_adverbs_hu(plain_text: str, language: str, cap: int = 5) -> list[dict]:
    """Detect weak adverbs modifying verbs in Hungarian text."""
    if language != "hu":
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
        if lower_text in WEAK_ADVERBS_HU:
            is_weak = True
        elif (lower_text.endswith("an") or lower_text.endswith("en")
              or lower_text.endswith("ul") or lower_text.endswith("ül")):
            if token.head.pos_ == "VERB" and lower_text not in IGNORE_ADVERBS_HU:
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


def _analyze_passive_voice_hu(plain_text: str, language: str, cap: int = 3) -> list[dict]:
    """Detect passive-like participle constructions (-va/-ve suffix) in Hungarian."""
    if language != "hu":
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
        if not (lower_text.endswith("va") or lower_text.endswith("ve")):
            continue
        if lower_text in PASSIVE_EXEMPTIONS_HU:
            continue
        if token.pos_ not in ("ADV", "VERB"):
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


def _is_dialogue_hu(sent) -> bool:
    """Return True if this sentence is (part of) dialogue — including em-dash lines."""
    text = sent.text
    if '\u201e' in text or '\u00bb' in text or '"' in text:
        return True
    stripped = text.lstrip()
    if stripped.startswith('\u2014') or stripped.startswith('\u2013'):
        return True
    for token in sent:
        if token.lemma_ in SPEECH_VERBS_HU:
            for child in token.children:
                if child.dep_ in ("ccomp", "parataxis", "obj"):
                    return True
    return False


def _detect_emotion_label_hu(sent) -> dict | None:
    """Detect: linking verb + emotion adj, or zero-copula adj as ROOT."""
    # Path 1: Linking verb + ADJ child
    for token in sent:
        if token.lemma_ in LINKING_VERBS_HU:
            for child in token.children:
                if child.pos_ == "ADJ":
                    lemma = child.lemma_.lower()
                    if lemma in STATE_EXEMPTIONS_HU:
                        continue
                    if lemma in EMOTION_LEXICON_HU:
                        start_char = min(token.idx, child.idx)
                        end_char = max(token.idx + len(token.text), child.idx + len(child.text))
                        return {
                            "start_char": start_char,
                            "end_char": end_char,
                            "entity_type": "emotion_label",
                            "confidence": 0.75,
                        }
    # Path 2: Zero copula — ADJ as ROOT with nsubj child
    root_tokens = [t for t in sent if t.dep_ == "ROOT"]
    if root_tokens and root_tokens[0].pos_ == "ADJ":
        adj = root_tokens[0]
        if any(c.dep_ == "nsubj" for c in adj.children):
            if adj.lemma_.lower() in EMOTION_LEXICON_HU:
                return {
                    "start_char": adj.idx,
                    "end_char": adj.idx + len(adj.text),
                    "entity_type": "emotion_label",
                    "confidence": 0.65,
                }
    return None


def _detect_filter_verb_hu(sent) -> dict | None:
    """Detect: filter verb with subject + object clause."""
    for token in sent:
        if token.lemma_ in FILTER_VERBS_HU:
            has_subj = any(c.dep_ in ("nsubj", "nsubjpass") for c in token.children)
            has_obj = any(c.dep_ in ("dobj", "obj", "ccomp", "xcomp", "advcl") for c in token.children)
            if has_subj and has_obj:
                return {
                    "start_char": token.idx,
                    "end_char": token.idx + len(token.text),
                    "entity_type": "filter_verb",
                    "confidence": 0.50,
                }
    return None


def _detect_realize_verb_hu(sent) -> dict | None:
    """Detect: cognitive verb with complement clause."""
    for token in sent:
        if token.lemma_ in REALIZE_VERBS_HU:
            has_comp = any(c.dep_ in ("ccomp", "xcomp") for c in token.children)
            if has_comp:
                return {
                    "start_char": token.idx,
                    "end_char": token.idx + len(token.text),
                    "entity_type": "realize_verb",
                    "confidence": 0.55,
                }
    return None


def _detect_adverb_emotion_hu(sent) -> dict | None:
    """Detect: speech verb + emotion adverb modifier."""
    for token in sent:
        if token.dep_ == "ROOT" and token.lemma_ in SPEECH_VERBS_HU:
            for child in token.children:
                if child.dep_ == "advmod" and child.lemma_.lower() in EMOTION_ADVERBS_HU:
                    start_char = min(token.idx, child.idx)
                    end_char = max(token.idx + len(token.text), child.idx + len(child.text))
                    return {
                        "start_char": start_char,
                        "end_char": end_char,
                        "entity_type": "adverb_emotion",
                        "confidence": 0.65,
                    }
    return None


def _analyze_show_dont_tell_hu(
    plain_text: str,
    language: str,
    confidence_threshold: float = 0.5,
    cap: int = 5
) -> list[dict]:
    """4-detector show-don't-tell pipeline for Hungarian with em-dash dialogue exclusion."""
    if language != "hu":
        return []
    suggestions = []
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(language)
        doc = nlp(plain_text[:10000])
    except Exception:
        return []

    detectors = [
        _detect_emotion_label_hu,
        _detect_filter_verb_hu,
        _detect_realize_verb_hu,
        _detect_adverb_emotion_hu,
    ]

    seen_offsets: set = set()
    for sent in doc.sents:
        if len(suggestions) >= cap:
            break
        if _is_dialogue_hu(sent):
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


def _analyze_pacing_hu(
    plain_text: str,
    language: str,
    cap: int = 2
) -> list[dict]:
    if language != "hu":
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

        s1, s2, s3 = sentences[i], sentences[i+1], sentences[i+2]

        def get_first_word(sent):
            for t in sent:
                if not t.is_punct and not t.is_space:
                    return t
            return None

        t1, t2, t3 = get_first_word(s1), get_first_word(s2), get_first_word(s3)
        if not t1 or not t2 or not t3:
            continue

        trigger = False
        reason = ""

        # We only trigger on exact word matches to avoid broad POS false-positives
        if t1.text.lower() == t2.text.lower() == t3.text.lower():
            trigger = True
            reason = f'"{t1.text.lower()}"'

        if trigger:
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
                "entity_type": reason,
                "matched_text": matched_text,
                "context": context,
                "context_highlight_start": hl_start,
                "context_highlight_end": hl_end,
                "char_offset": start_char,
                "replacement": None
            })

    return suggestions

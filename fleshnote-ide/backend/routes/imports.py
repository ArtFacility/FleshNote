"""
FleshNote API — Import Routes
Chapter splitting from manuscript files + spaCy NER extraction.
"""

import hashlib
import os
import re
import sqlite3
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from manuscript_import import paragraphs_to_html, preview_files, word_count

router = APIRouter()


class SplitPreviewRequest(BaseModel):
    project_path: str
    file_path: str | None = None          # a single manuscript file
    file_paths: list[str] | None = None   # several files and/or folders


class ConfirmSplitsRequest(BaseModel):
    project_path: str
    # [{"title": str, "paragraphs": [str]}]; a plain "content" string is accepted too
    splits: list[dict]
    pov_character_id: str | None = None
    target_word_count: int | None = None   # None: the project's default chapter target
    insert_after: int | None = None        # chapter number to insert after; None appends
    # A brand-new project starts with an empty "Chapter 1". The new-project
    # import flow asks for it to be replaced by the manuscript.
    replace_placeholder: bool = False


class NerExtractRequest(BaseModel):
    text: str
    language: str = "en"


class ChapterText(BaseModel):
    index: int
    title: str
    content: str


class NerAnalyzeRequest(BaseModel):
    project_path: str
    texts: list[ChapterText] | None = None
    text: str | None = None
    language: str = "en"
    # Optional caller-chosen id; while the analysis runs, its progress can be
    # read from /api/project/import/ner-progress.
    job_id: str | None = None


class BulkEntityDef(BaseModel):
    name: str
    type: str  # "character", "location", "lore"
    lore_category: str | None = None
    aliases: list[str] = []


class BulkCreateEntitiesRequest(BaseModel):
    project_path: str
    entities: list[BulkEntityDef]
    # Also link every mention of the new entities in the project's chapters.
    link_in_chapters: bool = False


class NlpLoadRequest(BaseModel):
    language: str


class ExternalEntitiesRequest(BaseModel):
    source_project_path: str
    target_project_path: str


class ExternalEntityDef(BaseModel):
    name: str
    type: str  # "character", "location", "lore", "group"
    aliases: list[str] = []
    # Character fields
    role: str | None = None
    species: str | None = None
    surface_goal: str | None = None
    true_goal: str | None = None
    bio: str | None = None
    # Location fields
    region: str | None = None
    description: str | None = None
    # Lore fields
    lore_category: str | None = None
    classification: str | None = None
    origin: str | None = None
    # Group fields
    group_type: str | None = None
    surface_agenda: str | None = None
    true_agenda: str | None = None
    # Shared
    notes: str | None = None


class ExternalEntitiesConfirmRequest(BaseModel):
    target_project_path: str
    entities: list[ExternalEntityDef]


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _plain_text_to_html(text: str) -> str:
    """
    Convert plain text with newlines into HTML <p> tags for TipTap.

    - Double newlines (\\n\\n) become paragraph breaks (<p>...</p>)
    - Single newlines (\\n) within a paragraph become <br> tags
    - Empty paragraphs are skipped
    """
    if not text or not text.strip():
        return ""

    # If the text already contains HTML tags, return as-is
    if "<p>" in text or "<br" in text or re.search(r'<h[1-6][>\s]', text):
        return text

    # Split on double newlines to get paragraphs
    paragraphs = re.split(r'\n{2,}', text.strip())

    html_parts = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        # Markdown heading lines (e.g. scaffolded "# Chapter 1: ...") become <h1>-<h6>
        heading_match = re.match(r'^(#{1,6})\s+(.+)$', para)
        if heading_match:
            level = len(heading_match.group(1))
            html_parts.append(f"<h{level}>{heading_match.group(2).strip()}</h{level}>")
            continue
        # Convert single newlines within a paragraph to <br> tags
        para_html = para.replace('\n', '<br>')
        html_parts.append(f"<p>{para_html}</p>")

    return "".join(html_parts)


def _split_paragraphs(split: dict) -> list[str]:
    paragraphs = split.get("paragraphs")
    if isinstance(paragraphs, list):
        return [str(p) for p in paragraphs if str(p).strip()]
    content = split.get("content") or ""
    return [p.strip() for p in re.split(r"\n{2,}", content) if p.strip()]


def _is_untouched_placeholder(cursor, project_path: str) -> str | None:
    """The id of a new project's empty default Chapter 1, if that is all the project holds."""
    cursor.execute(
        "SELECT id, title, word_count, status, md_filename FROM chapters WHERE deleted = 0"
    )
    rows = cursor.fetchall()
    if len(rows) != 1:
        return None
    row = rows[0]
    if row["word_count"] or row["status"] != "planned" or row["title"] != "Chapter 1":
        return None
    md_path = os.path.join(project_path, "md", row["md_filename"] or "")
    if os.path.exists(md_path):
        with open(md_path, "r", encoding="utf-8") as f:
            body = re.sub(r"<[^>]+>", " ", f.read())
        if body.replace("#", " ").split() not in ([], ["Chapter", "1"]):
            return None
    return row["id"]


@router.post("/api/project/import/split-preview")
def split_preview(req: SplitPreviewRequest):
    """Read manuscript files (or folders of them) and return proposed chapter splits."""
    paths = list(req.file_paths or [])
    if req.file_path:
        paths.insert(0, req.file_path)
    if not paths:
        raise HTTPException(status_code=400, detail="No files given")
    missing = [p for p in paths if not os.path.exists(p)]
    if missing:
        raise HTTPException(status_code=404, detail=f"File not found: {missing[0]}")
    return preview_files(paths)


@router.post("/api/project/import/confirm-splits")
def confirm_splits(req: ConfirmSplitsRequest):
    """Commit reviewed chapter splits: one transaction, logged for sync."""
    from sync_core import log_change
    from chapter_numbers import park_deleted_chapter_numbers, retire_chapter, shift_chapters_after

    splits = [s for s in req.splits if isinstance(s, dict)]
    if not splits:
        raise HTTPException(status_code=400, detail="Nothing to import")

    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    md_dir = os.path.join(req.project_path, "md")
    os.makedirs(md_dir, exist_ok=True)
    written: list[str] = []
    try:
        target = req.target_word_count
        if target is None:
            cursor.execute("SELECT config_value FROM project_config WHERE config_key = 'default_chapter_target'")
            row = cursor.fetchone()
            target = int(row[0]) if row and str(row[0]).isdigit() else 4000

        park_deleted_chapter_numbers(cursor)
        if req.replace_placeholder:
            placeholder = _is_untouched_placeholder(cursor, req.project_path)
            if placeholder:
                retire_chapter(cursor, placeholder)

        cursor.execute("SELECT COALESCE(MAX(chapter_number), 0) FROM chapters WHERE deleted = 0")
        last = cursor.fetchone()[0]
        after = last if req.insert_after is None else max(0, min(req.insert_after, last))
        shift_chapters_after(cursor, after, len(splits))

        created = []
        for i, split in enumerate(splits):
            num = after + 1 + i
            title = (split.get("title") or "").strip() or f"Chapter {num}"
            paragraphs = _split_paragraphs(split)
            words = sum(word_count(p) for p in paragraphs)
            status = "draft" if words else "planned"
            pov_id = req.pov_character_id if i == 0 else None

            slug = re.sub(r"[^\w\s-]", "", title.lower().strip())
            slug = re.sub(r"[\s_]+", "_", slug)[:40] or "chapter"
            md_filename = f"ch_{num:03d}_{slug}_{uuid.uuid4().hex[:8]}.md"
            md_path = os.path.join(md_dir, md_filename)
            prose = paragraphs_to_html(paragraphs)
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(prose)
            written.append(md_path)

            chap_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO chapters (id, chapter_number, title, status, pov_character_id,
                                      target_word_count, md_filename, word_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (chap_id, num, title, status, pov_id, target, md_filename, words))
            log_change(cursor, "chapters", chap_id, {
                "chapter_number": num,
                "title": title,
                "status": status,
                "pov_character_id": pov_id,
                "target_word_count": target,
                "md_filename": md_filename,
                "word_count": words,
                "prose_hash": hashlib.sha256(prose.encode("utf-8")).hexdigest(),
            })
            created.append({
                "id": chap_id,
                "chapter_number": num,
                "title": title,
                "status": status,
                "word_count": words,
                "md_filename": md_filename,
            })

        conn.commit()
        return {"chapters": created}
    except Exception:
        conn.rollback()
        for path in written:
            try:
                os.remove(path)
            except OSError:
                pass
        raise
    finally:
        conn.close()


@router.post("/api/project/import/ner-extract")
def ner_extract(req: NerExtractRequest):
    """Run spaCy NER on raw text and return tagged entities."""
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(req.language)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load NLP model for {req.language}: {e}"
        )

    doc = nlp(req.text)

    entities = []
    seen = set()
    for ent in doc.ents:
        key = (ent.text, ent.label_)
        if key in seen:
            continue
        seen.add(key)

        # Map spaCy labels to FleshNote entity types
        entity_type = None
        if ent.label_ == "PERSON":
            entity_type = "character"
        elif ent.label_ in ("GPE", "LOC", "FAC"):
            entity_type = "location"
        elif ent.label_ == "ORG":
            entity_type = "group"

        if entity_type:
            entities.append({
                "text": ent.text,
                "type": entity_type,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char,
            })

    return {"entities": entities}


def _clean_entity_name(text: str) -> str | None:
    """
    Clean up a raw spaCy entity text to extract the actual name.
    Strips dialogue prefixes, possessives, colon-dialogue artifacts,
    and other noise.  Returns None if the result is garbage.
    """
    name = text.strip()
    # Reject entities with newlines (multi-line garbage)
    if "\n" in name:
        return None

    # Split on colon-quote dialogue artifacts:
    #   "Gareth:"well"  ->  "Gareth"
    #   "surprised:"im" ->  "surprised"
    #   "bite:"hmmm"    ->  "bite"
    colon_match = re.match(
        r'^([A-Za-z][A-Za-z\s]*?)\s*:\s*["\u201c\u201d\'\u2018\u2019]', name
    )
    if colon_match:
        name = colon_match.group(1).strip()

    # Strip possessive suffix: "Sophia's" -> "Sophia"
    if name.endswith("'s") or name.endswith("\u2019s"):
        name = name[:-2].strip()
    # Normalize curly quotes to straight
    name = name.replace("\u2019", "'").replace("\u2018", "'")
    name = name.replace("\u201c", '"').replace("\u201d", '"')
    # Strip leading dialogue/noise words (applied repeatedly)
    NOISE_PREFIXES = [
        "sorry ", "damn ", "damned ", "hey ", "oh ", "dear ", "poor ",
        "i'm ", "im ", "i am ", "it's ", "its ", "i\u2019m ",
        "catching ", "mr ", "mr. ", "mrs ", "mrs. ", "ms ", "ms. ",
        "old ", "young ", "the ", "a ",
        "uncle ", "aunt ", "taking ", "calling ",
    ]
    changed = True
    while changed:
        changed = False
        lower = name.lower()
        for prefix in NOISE_PREFIXES:
            if lower.startswith(prefix) and len(name) > len(prefix) + 1:
                name = name[len(prefix):].strip()
                changed = True
                break
    # Reject if it contains connectives that signal garbage phrases
    # e.g. "Pickle is Matheus sitting" -> garbage
    lower_name = name.lower()
    GARBAGE_PATTERNS = [" is ", " are ", " was ", " were ", " has ", " have "]
    for pat in GARBAGE_PATTERNS:
        if pat in lower_name:
            # Take only the part before the connective
            name = name[:lower_name.index(pat)].strip()
            break

    # Reject entities containing dash-space patterns ("Green - Scor")
    if " - " in name or " \u2013 " in name or " \u2014 " in name:
        return None
    # Reject entities containing ellipsis ("Yea… Dad")
    if "\u2026" in name or "..." in name:
        return None

    # Only keep up to 3 words max for a name
    words = name.split()
    if len(words) > 3:
        name = " ".join(words[:3])
    # Final cleanup
    name = name.strip(" -\u2013\u2014:;,.'\"!?")
    if not name or len(name) < 2:
        return None
    # Reject if it's all uppercase shouting (e.g. "WHAT'S GOING ON")
    if name.isupper() and len(name) > 4:
        return None
    # Reject names starting with a digit/ordinal ("45th Adept", "2nd year")
    if re.match(r'^\d', name):
        return None
    return name


# Common English words that spaCy incorrectly classifies as named entities
_STOPWORD_ENTITIES = {
    "i", "me", "my", "you", "he", "she", "it", "we", "they",
    "the", "a", "an", "this", "that", "yes", "no", "ok",
    "haha", "hahaha", "oh", "ah", "um", "hmm",
    "shit", "damn", "chill", "hey", "hi", "hello",
    "calm", "surprised", "anger", "angry", "watching", "down",
    "mind", "heat", "air", "cold", "light", "liquid",
    "mom", "dad", "uncle", "aunt",
    "thoughts", "hundreds",
    # Round 4: common nouns / interjections that leak through as entities
    "moon", "footsteps", "huff", "ya", "yea", "babyy", "baby",
    "creepy", "kid", "im", "bite", "rank",
}


# Models label entities differently: huSpaCy uses PER/LOC/ORG/MISC, the Polish
# models persName/placeName/geogName/orgName. Normalize to the English set.
_LABEL_ALIASES = {
    "PER": "PERSON",
    "persName": "PERSON",
    "placeName": "GPE",
    "geogName": "LOC",
    "orgName": "ORG",
}

# Languages whose models give dictionary forms for names ("Bokával" -> "Boka").
_LEMMATIZED_LANGUAGES = {"hu", "pl"}

# Licence boilerplate and markup from public-domain ebooks.
_BOILERPLATE_MARKERS = ("gutenberg", "literary archive foundation", "ebook", "illustration")

# Words of these kinds at the edge of a name span are the model gluing a
# neighbour on ("Felharsan Geréb" = "rings out Geréb"), not part of the name.
_EDGE_POS_TO_TRIM = {
    "VERB", "AUX", "ADV", "ADJ", "PRON", "DET", "ADP", "CCONJ", "SCONJ",
    "INTJ", "NUM", "PART", "PUNCT",
}

MAX_SNIPPETS = 3


def _core_tokens(ent, lowercase_lemmas: set) -> list:
    """
    The entity's tokens with glued-on non-name words trimmed from both ends: words
    tagged as verbs, adjectives and the like, or capitalized only because they
    start a sentence (the text uses them in lowercase elsewhere).
    """
    def glued(tok):
        return tok.pos_ in _EDGE_POS_TO_TRIM or (tok.lemma_ or tok.text).lower() in lowercase_lemmas

    tokens = list(ent)
    while len(tokens) > 1 and glued(tokens[0]):
        tokens = tokens[1:]
    while len(tokens) > 1 and glued(tokens[-1]):
        tokens = tokens[:-1]
    return tokens


def _surface_name(tokens) -> str:
    return "".join(t.text_with_ws for t in tokens).strip()


def _lemma_name(tokens) -> str:
    """The dictionary form of a name, keeping the original capitalization of each word."""
    words = []
    for tok in tokens:
        lemma = tok.lemma_ or tok.text
        if tok.text[:1].isupper() and lemma[:1].islower():
            lemma = lemma[:1].upper() + lemma[1:]
        words.append(lemma + tok.whitespace_)
    return "".join(words).strip()


def _fold(text: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))


def _alias_is_glued(alias: str, main: str, other_names: list[str], lowercase_lemmas: set) -> bool:
    """
    An alternative spelling that is really the main name glued to a neighbour:
    another character ("Boka Cseléhez") or an ordinary word. Offered, but off.
    """
    extra = [w for w in alias.split() if w not in main.split()]
    if not extra or len(alias.split()) <= len(main.split()):
        return False
    for word in extra:
        folded = _fold(word)
        if folded in lowercase_lemmas:
            return True
        # An inflected form of another name ("Cseléhez" from "Csele"); the bare
        # name itself can be part of a real full name ("Kuno Lichtenstein").
        if any(len(o) >= 3 and folded != _fold(o) and folded.startswith(_fold(o)[:4]) for o in other_names):
            return True
    return False


_ENTITY_TABLES = ("characters", "locations", "lore_entities", "groups")


def _known_names(project_path: str) -> set[str]:
    """Lower-cased names and aliases of everything the project already has."""
    import json

    known: set[str] = set()
    db_path = os.path.join(project_path or "", "fleshnote.db")
    if not os.path.exists(db_path):
        return known
    conn = _get_db(project_path)
    try:
        for table in _ENTITY_TABLES:
            for row in conn.execute(f"SELECT name, aliases FROM {table} WHERE deleted = 0"):
                if row["name"]:
                    known.add(row["name"].strip().lower())
                try:
                    known.update(a.strip().lower() for a in json.loads(row["aliases"] or "[]") if a)
                except (ValueError, TypeError):
                    pass
    finally:
        conn.close()
    return known


def _reads_as_common_word(name: str, lowercase_counts: dict, frequency: int) -> bool:
    """A one-word 'name' the text also uses in lowercase as often is probably an ordinary word."""
    if " " in name or not name[:1].isupper():
        return False
    return lowercase_counts.get(name.lower(), 0) >= frequency


PIECE_CHARS = 4000


def _text_pieces(text: str):
    """Splits text at paragraph breaks into pieces of about PIECE_CHARS."""
    piece = []
    size = 0
    for para in text.split("\n\n"):
        piece.append(para)
        size += len(para) + 2
        if size >= PIECE_CHARS:
            yield "\n\n".join(piece)
            piece, size = [], 0
    if piece:
        yield "\n\n".join(piece)


# Progress of running analyses, keyed by job_id. Stages: "loading" (language
# model), "reading" (chapter by chapter; done/total count characters), "grouping".
_NER_PROGRESS: dict[str, dict] = {}


class NerProgressRequest(BaseModel):
    job_id: str


@router.post("/api/project/import/ner-progress")
def ner_progress(req: NerProgressRequest):
    return _NER_PROGRESS.get(req.job_id) or {"stage": "unknown"}


@router.post("/api/project/import/ner-analyze")
def ner_analyze(req: NerAnalyzeRequest):
    """
    Run batch NER analysis on multiple chapter texts (or a single pasted text).
    Returns grouped, deduplicated entities with frequency, chapter mapping,
    context snippets, and alias detection.
    """
    progress = {"stage": "loading", "chapter": 0, "chapters": 0, "done": 0, "total": 0}
    if req.job_id:
        _NER_PROGRESS[req.job_id] = progress
    try:
        return _ner_analyze(req, progress)
    finally:
        if req.job_id:
            _NER_PROGRESS.pop(req.job_id, None)


def _ner_analyze(req: NerAnalyzeRequest, progress: dict):
    try:
        from nlp_manager import get_nlp
        nlp = get_nlp(req.language)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load NLP model for {req.language}: {e}"
        )

    # Labels worth keeping: named entities that could be story elements
    # Skip noise labels: DATE, TIME, CARDINAL, ORDINAL, QUANTITY, PERCENT, MONEY
    KEEP_LABELS = {
        "PERSON", "GPE", "LOC", "FAC", "ORG",
        "NORP", "PRODUCT", "WORK_OF_ART", "EVENT", "LAW", "MISC",
    }
    lemmatize = req.language in _LEMMATIZED_LANGUAGES
    cased_script = req.language != "ar"

    # Build list of (chapter_index, content) from either texts or text
    chapters = []
    if req.texts:
        chapters = [(t.index, t.content) for t in req.texts]
    elif req.text:
        chapters = [(0, req.text)]
    else:
        return {"confident": [], "low_confidence": []}

    # Collect all entity occurrences across chapters
    # key: case-folded cleaned name -> entity data
    entity_map = {}
    lowercase_counts: dict[str, int] = {}
    lowercase_lemmas: set[str] = set()

    progress.update(stage="reading", chapters=len(chapters),
                    total=sum(len(c or "") for _, c in chapters))
    for position, (ch_index, content) in enumerate(chapters):
        progress["chapter"] = position + 1
        if not content or not content.strip():
            continue

        # Paragraph-sized pieces: names never span paragraphs, and the
        # progress moves while a long chapter is read.
        chapter_start = progress["done"]
        for piece in _text_pieces(content):
            doc = nlp(piece)
            progress["done"] += len(piece)
            for tok in doc:
                if tok.text[:1].islower():
                    lowercase_counts[tok.text] = lowercase_counts.get(tok.text, 0) + 1
                    lowercase_lemmas.add((tok.lemma_ or tok.text).lower())

            for ent in doc.ents:
                label = _LABEL_ALIASES.get(ent.label_, ent.label_)
                # Filter out noise labels
                if label not in KEEP_LABELS:
                    continue

                # Clean the entity name. Inflected languages group by the
                # dictionary form but show the spelling the text uses most.
                core = _core_tokens(ent, lowercase_lemmas)
                cleaned = _clean_entity_name(_surface_name(core))
                if not cleaned:
                    continue
                group_name = (_clean_entity_name(_lemma_name(core)) or cleaned) if lemmatize else cleaned
                # Names start with a capital; "bush" or "company" are ordinary words.
                if cased_script and not cleaned[:1].isupper():
                    continue
                if any(marker in cleaned.lower() for marker in _BOILERPLATE_MARKERS):
                    continue

                # Skip pure numbers
                if re.match(r'^[\d\s.,!?]+$', cleaned):
                    continue
                # Skip common English words that aren't real entities
                if cleaned.lower() in _STOPWORD_ENTITIES:
                    continue

                fold_key = group_name.lower()

                # Context snippet: the sentence containing this entity
                snippet = ""
                try:
                    sent = ent.sent
                    if sent:
                        snippet = sent.text.strip()[:200]
                except Exception:
                    start = max(0, ent.start_char - 40)
                    end = min(len(doc.text), ent.end_char + 120)
                    snippet = doc.text[start:end].strip()

                # A lone word tagged as a verb, adverb… ("Belevágott") is rarely a name.
                weak = len(core) == 1 and core[0].pos_ in _EDGE_POS_TO_TRIM

                if fold_key not in entity_map:
                    entity_map[fold_key] = {
                        "weak": 0,
                        "name": cleaned,
                        "dictionary_form": group_name,
                        "name_counts": {cleaned: 1},
                        "spacy_label": label,
                        "frequency": 0,
                        "chapter_indices": set(),
                        "snippet": snippet,
                        "snippets": [snippet] if snippet else [],
                    }
                else:
                    # Track casing variants
                    existing = entity_map[fold_key]
                    existing["name_counts"][cleaned] = (
                        existing["name_counts"].get(cleaned, 0) + 1
                    )
                    # Quotes from different chapters show the name in more than one light.
                    if (snippet and len(existing["snippets"]) < MAX_SNIPPETS
                            and ch_index not in existing["chapter_indices"]):
                        existing["snippets"].append(snippet)

                entity_map[fold_key]["frequency"] += 1
                entity_map[fold_key]["weak"] += 1 if weak else 0
                entity_map[fold_key]["chapter_indices"].add(ch_index)

        progress["done"] = chapter_start + len(content)

    progress["stage"] = "grouping"

    # Display name: the dictionary form when the text itself uses it ("Kraków",
    # not the more frequent "Krakowa"); otherwise the most frequent spelling, since
    # lemmatizers sometimes clip unfamiliar names ("Nemecs").
    for fold_key, data in entity_map.items():
        spellings = {n.lower(): n for n in data["name_counts"]}
        dictionary = data["dictionary_form"].lower()
        if dictionary in spellings:
            data["name"] = spellings[dictionary]
        else:
            data["name"] = max(data["name_counts"], key=lambda n: (data["name_counts"][n], -len(n)))

    # Map spaCy labels to FleshNote types
    # ORG is intentionally mapped to None — many character names get
    # misclassified as ORG by spaCy, so we let the user decide.
    LABEL_MAP = {
        "PERSON": "character",
        "GPE": "location",
        "LOC": "location",
        "FAC": "location",
    }

    for data in entity_map.values():
        data["suggested_type"] = LABEL_MAP.get(data["spacy_label"])
        # "Absurd" or "Company" at the start of a sentence: let the writer decide.
        if _reads_as_common_word(data["name"], lowercase_counts, data["frequency"]):
            data["suggested_type"] = None
        # Rare lone words tagged as verbs and the like; a name used dozens of
        # times is a name whatever its tag.
        if data["weak"] * 2 > data["frequency"] and data["frequency"] < 10:
            data["suggested_type"] = None

    # Heuristic: single-word ORG entities with high frequency in fiction
    # are almost always character names that spaCy misclassified.
    # Real organizations in fiction are usually multi-word ("The Order of Embers").
    # Promote high-frequency single-word ORGs to character.
    for data in entity_map.values():
        if (data["spacy_label"] == "ORG"
                and data["suggested_type"] is None
                and len(data["name"].split()) == 1
                and data["frequency"] >= 3):
            data["suggested_type"] = "character"
            data["spacy_label"] = "PERSON"  # reclassify for alias detection

    # Also handle informal possessives without apostrophe:
    # "Torins" -> merge with "Torin", "Hannas" -> merge with "Hanna"
    possessive_merges = {}
    all_keys = list(entity_map.keys())
    for fold_key in all_keys:
        if fold_key.endswith("s") and len(fold_key) > 3:
            base = fold_key[:-1]
            if base in entity_map and base != fold_key:
                possessive_merges[fold_key] = base
    for poss_key, base_key in possessive_merges.items():
        if poss_key in entity_map and base_key in entity_map:
            base = entity_map[base_key]
            poss = entity_map[poss_key]
            base["frequency"] += poss["frequency"]
            base["chapter_indices"] |= poss["chapter_indices"]
            base["snippets"] = (base["snippets"] + poss["snippets"])[:MAX_SNIPPETS]
            entity_map.pop(poss_key, None)

    # Detect aliases: within each label group AND across PERSON/ORG,
    # find substring matches. Many names appear as both PERSON and ORG
    # at different points, so we merge across those labels too.

    # Build merge-friendly groups: PERSON+ORG together, rest by label
    merge_groups = {}
    for fold_key, data in entity_map.items():
        label = data["spacy_label"]
        group_key = "NAME" if label in ("PERSON", "ORG") else label
        if group_key not in merge_groups:
            merge_groups[group_key] = []
        merge_groups[group_key].append((fold_key, data))

    # Track which entities are aliases of which
    alias_targets = {}  # fold_key of alias -> fold_key of primary

    for group_key, group in merge_groups.items():
        # Sort by name length descending (longest = most likely primary)
        group.sort(key=lambda x: len(x[1]["name"]), reverse=True)

        for i, (long_key, long_data) in enumerate(group):
            long_words = long_data["name"].lower().split()
            for j, (short_key, short_data) in enumerate(group):
                if i == j or short_key in alias_targets or long_key in alias_targets:
                    continue
                short_name = short_data["name"].lower()
                # Check if short name is a word-boundary match in long name.
                # The form the text uses more often becomes the main name:
                # "Geréb" over a rare "Felharsant Geréb", "Marlow" over "Charlie Marlow".
                if short_name in long_words and len(short_name) >= 2:
                    if short_data["frequency"] > long_data["frequency"]:
                        alias_targets[long_key] = short_key
                        break
                    alias_targets[short_key] = long_key

    # Phase 2: Cross-group prefix/containment alias detection.
    # Catches nicknames across label groups:
    #   "Wern" (WORK_OF_ART) -> "Werniel" (PERSON)
    #   "Syl" (PERSON)       -> "Sylvie" (ORG)
    #   "Hannah" (PERSON)    -> "Hanna" (PERSON)  (containment)
    #   "Cselének" (HU, unlemmatized) -> "Csele"; accents are ignored ("Bokáék" -> "Boka").
    # Only names of the same kind merge: "Mari" (a person) stays apart from
    # "Mária-utca" (a street).
    def compatible(a, b):
        ta, tb = entity_map[a]["suggested_type"], entity_map[b]["suggested_type"]
        return ta is None or tb is None or ta == tb

    remaining_keys = [k for k in entity_map if k not in alias_targets]
    for i, key_a in enumerate(remaining_keys):
        if key_a in alias_targets:
            continue
        name_a = _fold(entity_map[key_a]["name"])
        if len(name_a) < 3:
            continue
        for key_b in remaining_keys[i + 1:]:
            if key_b in alias_targets or key_a in alias_targets:
                continue
            name_b = _fold(entity_map[key_b]["name"])
            if len(name_b) < 3 or not compatible(key_a, key_b):
                continue
            # Check if one name is a prefix of the other
            if not ((name_b.startswith(name_a) and len(name_b) > len(name_a))
                    or (name_a.startswith(name_b) and len(name_a) > len(name_b))):
                continue
            # Make the higher-frequency one the primary
            if entity_map[key_a]["frequency"] >= entity_map[key_b]["frequency"]:
                alias_targets[key_b] = key_a
            else:
                alias_targets[key_a] = key_b

    # An alias of an alias belongs to the final primary.
    def root(key):
        seen = set()
        while key in alias_targets and key not in seen:
            seen.add(key)
            key = alias_targets[key]
        return key

    alias_targets = {k: root(k) for k in alias_targets if root(k) != k}

    # Merge aliases into their primaries
    for alias_key, primary_key in alias_targets.items():
        if primary_key in entity_map and alias_key in entity_map:
            primary = entity_map[primary_key]
            alias_data = entity_map[alias_key]
            if "aliases" not in primary:
                primary["aliases"] = []
            primary["aliases"].append(alias_data["name"])
            # Merge frequency and chapters
            primary["frequency"] += alias_data["frequency"]
            primary["chapter_indices"] |= alias_data["chapter_indices"]
            primary["snippets"] = (primary["snippets"] + alias_data["snippets"])[:MAX_SNIPPETS]
            # If the alias was PERSON and the primary was ORG,
            # upgrade the primary to PERSON (more likely correct)
            if (alias_data["spacy_label"] == "PERSON"
                    and primary["spacy_label"] == "ORG"):
                primary["spacy_label"] = "PERSON"
                primary["suggested_type"] = "character"

    # Remove alias entries from entity_map
    for alias_key in alias_targets:
        entity_map.pop(alias_key, None)

    # Final heuristic: if an entity name contains a location keyword,
    # override the type to location.  Runs AFTER alias merging so that
    # ORG→PERSON upgrades don't clobber the keyword-based override.
    # Catches misclassifications like "Nadia Adept School" -> PERSON.
    _LOCATION_KEYWORDS = {
        "school", "academy", "temple", "tower", "castle", "palace",
        "city", "town", "village", "forest", "mountain", "river",
        "lake", "sea", "ocean", "island", "kingdom", "empire",
        "republic", "cave", "dungeon", "keep", "pass", "fort",
    }
    for data in entity_map.values():
        name_words = {w.lower() for w in data["name"].split()}
        if name_words & _LOCATION_KEYWORDS:
            data["suggested_type"] = "location"

    # Split into confident and low_confidence. Names the project already has
    # (as a name or an alias) are left out; only their count is reported.
    confident = []
    low_confidence = []
    folded_lemmas = {_fold(l) for l in lowercase_lemmas}
    known = _known_names(req.project_path)
    already_known = 0

    for fold_key, data in list(entity_map.items()):
        if data["name"].lower() in known or any(a.lower() in known for a in data.get("aliases", [])):
            already_known += 1
            continue
        others = [d["name"] for k, d in entity_map.items() if k != fold_key]
        seen_aliases = {data["name"].lower()}
        data["aliases"] = [
            a for a in data.get("aliases", [])
            if a.lower() not in seen_aliases and not seen_aliases.add(a.lower())
        ]
        entity_out = {
            "name": data["name"],
            "suggested_type": data["suggested_type"],
            "spacy_label": data["spacy_label"],
            "frequency": data["frequency"],
            "chapter_count": len(data["chapter_indices"]),
            "chapter_indices": sorted(data["chapter_indices"]),
            "snippet": data["snippet"],
            "snippets": data["snippets"],
            "aliases": data.get("aliases", []),
            # Whether each alias should start switched on in the review.
            "aliases_on": [
                not _alias_is_glued(a, data["name"], others, folded_lemmas)
                for a in data.get("aliases", [])
            ],
        }

        if data["suggested_type"] and data["frequency"] >= 2:
            confident.append(entity_out)
        else:
            low_confidence.append(entity_out)

    # Sort by frequency descending
    confident.sort(key=lambda e: e["frequency"], reverse=True)
    low_confidence.sort(key=lambda e: e["frequency"], reverse=True)

    return {
        "confident": confident,
        "low_confidence": low_confidence,
        "already_known": already_known,
    }


@router.post("/api/project/import/bulk-create-entities")
def bulk_create_entities(req: BulkCreateEntitiesRequest):
    """Create multiple entities of different types in one transaction."""
    import json

    from sync_core import log_change

    known = _known_names(req.project_path)
    already_known = set(known)
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    created = []
    skipped = 0

    for entity in req.entities:
        aliases_json = json.dumps(entity.aliases) if entity.aliases else "[]"
        # Never create a second copy of something the project already has.
        if entity.name.strip().lower() in known:
            skipped += 1
            continue
        known.add(entity.name.strip().lower())

        ent_id = str(uuid.uuid4())
        if entity.type == "character":
            cursor.execute(
                "INSERT INTO characters (id, name, aliases) VALUES (?, ?, ?)",
                (ent_id, entity.name, aliases_json),
            )
            log_change(cursor, "characters", ent_id, {"name": entity.name, "aliases": entity.aliases})
            created.append({
                "id": ent_id,
                "type": "character",
                "name": entity.name,
            })

        elif entity.type == "location":
            cursor.execute(
                "INSERT INTO locations (id, name, aliases) VALUES (?, ?, ?)",
                (ent_id, entity.name, aliases_json),
            )
            log_change(cursor, "locations", ent_id, {"name": entity.name, "aliases": entity.aliases})
            created.append({
                "id": ent_id,
                "type": "location",
                "name": entity.name,
            })

        elif entity.type == "lore":
            category = entity.lore_category or "item"
            cursor.execute(
                "INSERT INTO lore_entities (id, name, category, aliases) VALUES (?, ?, ?, ?)",
                (ent_id, entity.name, category, aliases_json),
            )
            log_change(cursor, "lore_entities", ent_id,
                       {"name": entity.name, "category": category, "aliases": entity.aliases})
            created.append({
                "id": ent_id,
                "type": "lore",
                "name": entity.name,
                "category": category,
            })

    conn.commit()
    conn.close()

    linked = {"links": 0, "chapters": 0}
    if req.link_in_chapters and created:
        aliases_by_name = {e.name: e.aliases for e in req.entities}
        targets = [{**c, "aliases": aliases_by_name.get(c["name"], [])} for c in created]
        # The entities are already saved; a chapter that can't be linked
        # (say, a file another program holds open) must not undo that.
        try:
            linked = _link_names_in_chapters(req.project_path, targets, blocked=already_known)
        except Exception as e:
            print(f"[import] Linking names in chapters failed: {e}")
            linked = {"links": 0, "chapters": 0, "error": str(e)}
    return {"created": created, "skipped_existing": skipped, "linked": linked}


def _link_names_in_chapters(project_path: str, entities: list[dict], blocked: set[str]) -> dict:
    """
    Wraps every mention of the given entities in the project's chapters in an
    entity link. Each chapter that changes keeps a 'pre_link' history snapshot,
    so the linking can be undone from the chapter's History.
    """
    from prose_linker import NameLinker, spellings_for
    from project_io import safe_md_path
    from routes.chapter_history import _create_snapshot
    from routes.chapters import _update_entity_appearances
    from sync_core import log_change

    linker = NameLinker(spellings_for(entities, blocked))
    md_dir = os.path.join(project_path, "md")
    conn = _get_db(project_path)
    cursor = conn.cursor()
    originals: list[tuple[str, str]] = []
    links = 0
    try:
        rows = cursor.execute(
            "SELECT id, md_filename FROM chapters WHERE deleted = 0 AND md_filename IS NOT NULL"
        ).fetchall()
        for row in rows:
            md_path = safe_md_path(md_dir, row["md_filename"])
            if not md_path or not os.path.exists(md_path):
                continue
            with open(md_path, "r", encoding="utf-8") as f:
                before = f.read()
            after, count = linker.link(before)
            if not count:
                continue
            try:
                _create_snapshot(cursor, project_path, row["id"], "pre_link")
            except sqlite3.Error as e:  # projects from before chapter History
                print(f"[import] No history snapshot before linking: {e}")
            originals.append((md_path, before))
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(after)
            _update_entity_appearances(cursor, row["id"], after)
            log_change(cursor, "chapters", row["id"],
                       {"prose_hash": hashlib.sha256(after.encode("utf-8")).hexdigest()})
            links += count
        conn.commit()
    except Exception:
        conn.rollback()
        for md_path, before in originals:
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(before)
        raise
    finally:
        conn.close()
    return {"links": links, "chapters": len(originals)}


@router.post("/api/nlp/load")
def nlp_load(req: NlpLoadRequest):
    """Preload or download a spaCy model for a specific language."""
    from nlp_manager import get_nlp
    try:
        # get_nlp will block and download if necessary, emitting progress to stdout
        get_nlp(req.language)
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── External Project Entity Import ──────────────────────────────────

@router.post("/api/project/import/external-entities")
def get_external_entities(req: ExternalEntitiesRequest):
    """Read all entities from another FleshNote project for import."""
    import json

    source_db = os.path.join(req.source_project_path, "fleshnote.db")
    if not os.path.exists(source_db):
        raise HTTPException(status_code=404, detail="No fleshnote.db found in selected folder")

    # Read source entities
    src = sqlite3.connect(source_db)
    src.row_factory = sqlite3.Row
    sc = src.cursor()

    source_entities = []

    sc.execute("SELECT * FROM characters ORDER BY id ASC")
    for row in sc.fetchall():
        source_entities.append({
            "type": "character", "name": row["name"],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "role": row["role"], "species": row["species"],
            "surface_goal": row["surface_goal"], "true_goal": row["true_goal"],
            "bio": row["bio"], "notes": row["notes"],
        })

    sc.execute("SELECT * FROM locations ORDER BY id ASC")
    for row in sc.fetchall():
        source_entities.append({
            "type": "location", "name": row["name"],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "region": row["region"], "description": row["description"],
            "notes": row["notes"],
        })

    sc.execute("SELECT * FROM lore_entities ORDER BY id ASC")
    for row in sc.fetchall():
        source_entities.append({
            "type": "lore", "name": row["name"],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "lore_category": row["category"], "classification": row["classification"],
            "description": row["description"], "origin": row["origin"],
            "notes": row["notes"],
        })

    sc.execute("SELECT * FROM groups ORDER BY id ASC")
    for row in sc.fetchall():
        source_entities.append({
            "type": "group", "name": row["name"],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "group_type": row["group_type"], "description": row["description"],
            "surface_agenda": row["surface_agenda"], "true_agenda": row["true_agenda"],
            "notes": row["notes"],
        })

    src.close()

    # Collect existing names in target project for dedup hints
    tgt = _get_db(req.target_project_path)
    tc = tgt.cursor()
    existing_names = set()
    for table in ("characters", "locations", "lore_entities", "groups"):
        tc.execute(f"SELECT name FROM {table}")
        for row in tc.fetchall():
            existing_names.add(row["name"].lower())
    tgt.close()

    return {
        "source_entities": source_entities,
        "existing_names": list(existing_names),
    }


@router.post("/api/project/import/external-entities-confirm")
def confirm_external_entities(req: ExternalEntitiesConfirmRequest):
    """Bulk-create entities imported from an external project."""
    import json

    conn = _get_db(req.target_project_path)
    cursor = conn.cursor()
    created = []

    for entity in req.entities:
        aliases_json = json.dumps(entity.aliases) if entity.aliases else "[]"

        import uuid
        ent_id = str(uuid.uuid4())
        if entity.type == "character":
            cursor.execute("""
                INSERT INTO characters (id, name, aliases, role, species,
                                        surface_goal, true_goal, bio, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (ent_id, entity.name, aliases_json, entity.role or "",
                  entity.species or "", entity.surface_goal or "",
                  entity.true_goal or "", entity.bio or "", entity.notes or ""))
            created.append({"id": ent_id, "type": "character", "name": entity.name})

        elif entity.type == "location":
            cursor.execute("""
                INSERT INTO locations (id, name, aliases, region, description, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (ent_id, entity.name, aliases_json, entity.region or "",
                  entity.description or "", entity.notes or ""))
            created.append({"id": ent_id, "type": "location", "name": entity.name})

        elif entity.type == "lore":
            category = entity.lore_category or "item"
            cursor.execute("""
                INSERT INTO lore_entities (id, name, aliases, category, classification,
                                           description, origin, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (ent_id, entity.name, aliases_json, category,
                  entity.classification or "", entity.description or "",
                  entity.origin or "", entity.notes or ""))
            created.append({"id": ent_id, "type": "lore", "name": entity.name, "category": category})

        elif entity.type == "group":
            cursor.execute("""
                INSERT INTO groups (id, name, aliases, group_type, description,
                                    surface_agenda, true_agenda, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (ent_id, entity.name, aliases_json, entity.group_type or "",
                  entity.description or "", entity.surface_agenda or "",
                  entity.true_agenda or "", entity.notes or ""))
            created.append({"id": ent_id, "type": "group", "name": entity.name})

    conn.commit()
    conn.close()
    return {"created": created}

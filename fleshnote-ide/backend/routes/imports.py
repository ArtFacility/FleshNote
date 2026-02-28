"""
FleshNote API — Import Routes
Chapter splitting from manuscript files + spaCy NER extraction.
"""

import os
import re
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class SplitPreviewRequest(BaseModel):
    project_path: str
    file_path: str


class ConfirmSplitsRequest(BaseModel):
    project_path: str
    splits: list[dict]  # [{"title": "Chapter 1", "content": "..."}]
    pov_character_id: int | None = None
    target_word_count: int = 4000


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


class BulkEntityDef(BaseModel):
    name: str
    type: str  # "character", "location", "lore"
    lore_category: str | None = None
    aliases: list[str] = []


class BulkCreateEntitiesRequest(BaseModel):
    project_path: str
    entities: list[BulkEntityDef]


class NlpLoadRequest(BaseModel):
    language: str


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
    if "<p>" in text or "<br" in text:
        return text

    # Split on double newlines to get paragraphs
    paragraphs = re.split(r'\n{2,}', text.strip())

    html_parts = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        # Convert single newlines within a paragraph to <br> tags
        para_html = para.replace('\n', '<br>')
        html_parts.append(f"<p>{para_html}</p>")

    return "".join(html_parts)


def _read_file(file_path: str) -> str:
    """Read a file and return its text content."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext in (".txt", ".md"):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()

    elif ext == ".docx":
        try:
            import docx
            doc = docx.Document(file_path)
            paragraphs = []
            for para in doc.paragraphs:
                # Preserve heading info as markdown markers
                if para.style.name.startswith("Heading 1"):
                    paragraphs.append(f"# {para.text}")
                elif para.style.name.startswith("Heading 2"):
                    paragraphs.append(f"## {para.text}")
                else:
                    paragraphs.append(para.text)
            return "\n\n".join(paragraphs)
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="python-docx is not installed. Run: pip install python-docx"
            )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")


def _heuristic_split(text: str) -> list[dict]:
    """
    Split text into chapters using a waterfall of heuristics:
    1. Markdown headings (# Chapter, ## Title)
    2. DOCX-converted headings (already converted to # in _read_file)
    3. Regex patterns (Chapter X, Prologue, Epilogue, Part X)
    4. Delimiter patterns (---, ***, ###)
    5. Large whitespace gaps (4+ blank lines)
    """
    lines = text.split("\n")
    splits = []
    current_title = ""
    current_lines = []

    # Combined pattern for chapter-like headings
    chapter_pattern = re.compile(
        r'^(?:#\s+|##\s+)?'  # optional markdown heading
        r'(?:chapter|prologue|epilogue|part|act|book)\s*'
        r'(?:one|two|three|four|five|six|seven|eight|nine|ten|'
        r'eleven|twelve|thirteen|fourteen|fifteen|sixteen|'
        r'seventeen|eighteen|nineteen|twenty|\d+)?'
        r'[\s:.\-—]*(.*)$',
        re.IGNORECASE
    )

    # Delimiter pattern
    delimiter_pattern = re.compile(r'^(?:\*{3,}|-{3,}|#{3,}|={3,})\s*$')

    # Track consecutive blank lines
    blank_count = 0
    BLANK_THRESHOLD = 4

    for i, line in enumerate(lines):
        stripped = line.strip()

        # Check for chapter heading
        match = chapter_pattern.match(stripped)
        if match and len(stripped) > 0:
            # Save previous chunk if it has content
            if current_lines or current_title:
                content = "\n".join(current_lines).strip()
                if content or current_title:
                    splits.append({
                        "title": current_title or f"Section {len(splits) + 1}",
                        "content": content,
                        "preview": content[:150] if content else "",
                        "word_count": len(content.split()) if content else 0,
                    })

            # Extract title from the heading line
            title_suffix = match.group(1).strip()
            # Rebuild a cleaner title
            heading_text = stripped.lstrip("#").strip()
            current_title = heading_text if heading_text else f"Chapter {len(splits) + 1}"
            current_lines = []
            blank_count = 0
            continue

        # Check for delimiter
        if delimiter_pattern.match(stripped):
            if current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    splits.append({
                        "title": current_title or f"Section {len(splits) + 1}",
                        "content": content,
                        "preview": content[:150] if content else "",
                        "word_count": len(content.split()) if content else 0,
                    })
                current_title = ""
                current_lines = []
                blank_count = 0
                continue

        # Track blank lines
        if not stripped:
            blank_count += 1
            if blank_count >= BLANK_THRESHOLD and current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    splits.append({
                        "title": current_title or f"Section {len(splits) + 1}",
                        "content": content,
                        "preview": content[:150] if content else "",
                        "word_count": len(content.split()) if content else 0,
                    })
                current_title = ""
                current_lines = []
                blank_count = 0
                continue
        else:
            blank_count = 0

        current_lines.append(line)

    # Don't forget the last chunk
    if current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            splits.append({
                "title": current_title or f"Section {len(splits) + 1}",
                "content": content,
                "preview": content[:150] if content else "",
                "word_count": len(content.split()) if content else 0,
            })

    # If no splits were found, treat the whole file as one chapter
    if not splits and text.strip():
        splits.append({
            "title": "Chapter 1",
            "content": text.strip(),
            "preview": text.strip()[:150],
            "word_count": len(text.split()),
        })

    return splits


@router.post("/api/project/import/split-preview")
def split_preview(req: SplitPreviewRequest):
    """Read a manuscript file and return proposed chapter splits."""
    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail="File not found")

    text = _read_file(req.file_path)
    splits = _heuristic_split(text)

    return {
        "splits": splits,
        "total_words": sum(s["word_count"] for s in splits),
        "total_chapters": len(splits),
    }


@router.post("/api/project/import/confirm-splits")
def confirm_splits(req: ConfirmSplitsRequest):
    """Commit approved chapter splits to the database and create md files."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("SELECT COALESCE(MAX(chapter_number), 0) FROM chapters")
    start_num = cursor.fetchone()[0] + 1

    md_dir = os.path.join(req.project_path, "md")
    os.makedirs(md_dir, exist_ok=True)

    created = []
    for i, split in enumerate(req.splits):
        num = start_num + i
        title = split.get("title", f"Chapter {num}")
        content = split.get("content", "")

        # Create safe filename
        slug = re.sub(r'[^\w\s-]', '', title.lower().strip())
        slug = re.sub(r'[\s_]+', '_', slug)[:50]
        md_filename = f"ch_{num:03d}_{slug}.md"

        status = "draft" if content else "planned"
        word_count = len(content.split()) if content else 0
        pov_id = req.pov_character_id if i == 0 else None

        cursor.execute("""
            INSERT INTO chapters (chapter_number, title, status, pov_character_id,
                                  target_word_count, md_filename, word_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (num, title, status, pov_id, req.target_word_count, md_filename, word_count))

        # Convert plain text to HTML paragraphs for TipTap, then write the md file
        html_content = _plain_text_to_html(content)
        md_path = os.path.join(md_dir, md_filename)
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        created.append({
            "id": cursor.lastrowid,
            "chapter_number": num,
            "title": title,
            "status": status,
            "word_count": word_count,
            "md_filename": md_filename,
        })

    conn.commit()
    conn.close()
    return {"chapters": created}


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


@router.post("/api/project/import/ner-analyze")
def ner_analyze(req: NerAnalyzeRequest):
    """
    Run batch NER analysis on multiple chapter texts (or a single pasted text).
    Returns grouped, deduplicated entities with frequency, chapter mapping,
    context snippets, and alias detection.
    """
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
        "NORP", "PRODUCT", "WORK_OF_ART", "EVENT", "LAW", "LANGUAGE",
    }

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

    for ch_index, content in chapters:
        if not content or not content.strip():
            continue

        doc = nlp(content)

        for ent in doc.ents:
            # Filter out noise labels
            if ent.label_ not in KEEP_LABELS:
                continue

            # Clean the entity name
            cleaned = _clean_entity_name(ent.text)
            if not cleaned:
                continue

            # Skip pure numbers
            if re.match(r'^[\d\s.,!?]+$', cleaned):
                continue
            # Skip common English words that aren't real entities
            if cleaned.lower() in _STOPWORD_ENTITIES:
                continue

            fold_key = cleaned.lower()

            if fold_key not in entity_map:
                # Extract context snippet (sentence containing this entity)
                snippet = ""
                try:
                    sent = ent.sent
                    if sent:
                        snippet = sent.text.strip()[:200]
                except Exception:
                    # Fallback: extract surrounding text
                    start = max(0, ent.start_char - 40)
                    end = min(len(content), ent.end_char + 120)
                    snippet = content[start:end].strip()

                entity_map[fold_key] = {
                    "name": cleaned,
                    "name_counts": {cleaned: 1},
                    "spacy_label": ent.label_,
                    "frequency": 0,
                    "chapter_indices": set(),
                    "snippet": snippet,
                }
            else:
                # Track casing variants
                existing = entity_map[fold_key]
                existing["name_counts"][cleaned] = (
                    existing["name_counts"].get(cleaned, 0) + 1
                )

            entity_map[fold_key]["frequency"] += 1
            entity_map[fold_key]["chapter_indices"].add(ch_index)

    # Resolve display name to the most frequent casing
    for fold_key, data in entity_map.items():
        best_name = max(data["name_counts"], key=data["name_counts"].get)
        data["name"] = best_name

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
                # Check if short name is a word-boundary match in long name
                if short_name in long_words and len(short_name) >= 2:
                    alias_targets[short_key] = long_key

    # Phase 2: Cross-group prefix/containment alias detection.
    # Catches nicknames across label groups:
    #   "Wern" (WORK_OF_ART) -> "Werniel" (PERSON)
    #   "Syl" (PERSON)       -> "Sylvie" (ORG)
    #   "Hannah" (PERSON)    -> "Hanna" (PERSON)  (containment)
    remaining_keys = [k for k in entity_map if k not in alias_targets]
    for i, key_a in enumerate(remaining_keys):
        if key_a in alias_targets:
            continue
        name_a = entity_map[key_a]["name"].lower()
        if len(name_a) < 3:
            continue
        for key_b in remaining_keys[i + 1:]:
            if key_b in alias_targets:
                continue
            name_b = entity_map[key_b]["name"].lower()
            if len(name_b) < 3:
                continue
            # Check if one name is a prefix of the other
            is_related = False
            if name_b.startswith(name_a) and len(name_b) > len(name_a):
                is_related = True
            elif name_a.startswith(name_b) and len(name_a) > len(name_b):
                is_related = True
            if not is_related:
                continue
            # Make the higher-frequency one the primary
            freq_a = entity_map[key_a]["frequency"]
            freq_b = entity_map[key_b]["frequency"]
            if freq_a >= freq_b:
                alias_targets[key_b] = key_a
            else:
                alias_targets[key_a] = key_b
            break

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

    # Split into confident and low_confidence
    confident = []
    low_confidence = []

    for fold_key, data in entity_map.items():
        entity_out = {
            "name": data["name"],
            "suggested_type": data["suggested_type"],
            "spacy_label": data["spacy_label"],
            "frequency": data["frequency"],
            "chapter_count": len(data["chapter_indices"]),
            "chapter_indices": sorted(data["chapter_indices"]),
            "snippet": data["snippet"],
            "aliases": data.get("aliases", []),
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
    }


@router.post("/api/project/import/bulk-create-entities")
def bulk_create_entities(req: BulkCreateEntitiesRequest):
    """Create multiple entities of different types in one transaction."""
    import json

    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    created = []

    for entity in req.entities:
        aliases_json = json.dumps(entity.aliases) if entity.aliases else "[]"

        if entity.type == "character":
            cursor.execute(
                "INSERT INTO characters (name, aliases) VALUES (?, ?)",
                (entity.name, aliases_json),
            )
            created.append({
                "id": cursor.lastrowid,
                "type": "character",
                "name": entity.name,
            })

        elif entity.type == "location":
            cursor.execute(
                "INSERT INTO locations (name, aliases) VALUES (?, ?)",
                (entity.name, aliases_json),
            )
            created.append({
                "id": cursor.lastrowid,
                "type": "location",
                "name": entity.name,
            })

        elif entity.type == "lore":
            category = entity.lore_category or "item"
            cursor.execute(
                "INSERT INTO lore_entities (name, category, aliases) VALUES (?, ?, ?)",
                (entity.name, category, aliases_json),
            )
            created.append({
                "id": cursor.lastrowid,
                "type": "lore",
                "name": entity.name,
                "category": category,
            })

    conn.commit()
    conn.close()
    return {"created": created}


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

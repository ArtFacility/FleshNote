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

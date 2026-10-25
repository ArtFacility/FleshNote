"""
Manuscript import: reads .txt / .md / .docx files and proposes chapter splits.

A file is first turned into *blocks* (paragraphs, headings, scene breaks), then
cut into chapters at chapter headings. Paragraph text uses a tiny markup that
both the backend (HTML for the editor) and the import review screen render:

    **bold**   *italic*   _italic_   \\*  (a literal asterisk)   \\_ (literal underscore)
    "### Title"  a sub-heading inside a chapter
    "* * *"      a scene break

Splitting rules, in order:
  1. Heading styles / markdown headings: the shallowest level used at least
     twice marks chapters (a lone higher heading is the book title).
  2. Otherwise chapter-like lines: a short line on its own that starts with a
     chapter keyword followed by a number ("Chapter 3", "CHAPTER IV:",
     "1. fejezet", "Rozdział trzeci", "الفصل الأول"), or a standalone keyword
     such as "Prologue". Prose that merely starts with "Part…" or "Act…" is
     not a heading.
  3. Numbered lines ("1", "IV.", "IV. The Return") that count up like
     chapters, restarting at 1 in each part, and are spaced like chapters
     (page numbers and numbered lists are too close together). They combine
     with part headings: "Part One" followed by "I.", "II."…
  4. No headings at all: big blank gaps, or scene breaks when the pieces are
     chapter-sized. Otherwise the file stays one chapter.
"""

from __future__ import annotations

import html
import os
import re

SUPPORTED_EXTENSIONS = (".txt", ".md", ".markdown", ".docx")

SCENE_BREAK = "* * *"

# ── Chapter heading vocabulary ────────────────────────────────────────────────

_NUMBERED_KEYWORDS = [
    # en
    "chapter", "part", "book", "act", "volume",
    # hu
    "fejezet", "rész", "könyv", "felvonás", "kötet",
    # pl
    "rozdział", "część", "księga", "akt", "tom",
    # ar
    "الفصل", "فصل", "الجزء", "جزء", "الباب", "باب",
]

_STANDALONE_KEYWORDS = [
    # en
    "prologue", "epilogue", "interlude", "afterword", "foreword", "preface",
    # hu
    "prológus", "epilógus", "előszó", "utószó", "közjáték",
    # pl
    "prolog", "epilog", "przedmowa", "posłowie", "interludium",
    # ar
    "مقدمة", "المقدمة", "خاتمة", "الخاتمة", "تمهيد",
]

_EN_UNITS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
_EN_NUMBER_WORDS = _EN_UNITS + [
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety", "hundred",
    "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth",
    "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth",
    "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth",
    "twentieth", "last", "final",
]
_HU_NUMBER_WORDS = [
    "első", "második", "harmadik", "negyedik", "ötödik", "hatodik", "hetedik",
    "nyolcadik", "kilencedik", "tizedik", "tizenegyedik", "tizenkettedik",
    "huszadik", "utolsó",
]
_PL_NUMBER_WORDS = [
    "pierwszy", "drugi", "trzeci", "czwarty", "piąty", "szósty", "siódmy",
    "ósmy", "dziewiąty", "dziesiąty", "jedenasty", "dwunasty", "dwudziesty",
    "pierwsza", "druga", "trzecia", "czwarta", "piąta", "szósta", "siódma",
    "ósma", "dziewiąta", "dziesiąta", "ostatni", "ostatnia",
]
_AR_NUMBER_WORDS = [
    "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع",
    "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الأخير",
]


def _alt(words):
    # Longest first so "twentieth" wins over "twenty".
    return "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True))


_NUM_WORD = _alt(_EN_NUMBER_WORDS + _HU_NUMBER_WORDS + _PL_NUMBER_WORDS + _AR_NUMBER_WORDS)
_DIGITS = r"(?:\d{1,4}|[٠-٩]{1,4})"
# A well-formed roman numeral (so "civil" or "dim" never count).
_ROMAN = r"(?=[mdclxvi])m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})"
_WORDY = rf"(?:{_ROMAN}|(?:{_NUM_WORD})(?:[\s-](?:{_NUM_WORD}))?)"
_NUM = rf"(?:{_DIGITS}|{_WORDY})"
_SEP = r"[:.\-—–]"

_NUMBERED_RE = re.compile(
    rf"^(?:{_alt(_NUMBERED_KEYWORDS)})(?:\s*{_DIGITS}|\s+{_WORDY})(?![\w])\.?(?:\s*{_SEP}\s*|\s+)?(?P<rest>.*)$",
    re.IGNORECASE,
)
_NUMBER_FIRST_RE = re.compile(
    rf"^{_NUM}\.?\s+(?:{_alt(_NUMBERED_KEYWORDS)})(?![\w])\.?(?:\s*{_SEP}\s*(?P<rest>.*))?$",
    re.IGNORECASE,
)
_STANDALONE_RE = re.compile(
    rf"^(?:{_alt(_STANDALONE_KEYWORDS)})(?![\w])\s*(?:{_SEP}\s*(?P<rest>.+))?$",
    re.IGNORECASE,
)
_BARE_NUMBER_RE = re.compile(r"^(?:(\d{1,3})|([IVXLCDM]{1,7}))\.?$")
# "IV. The Return": a numeral, a dot, then a capitalized title.
_NUMBERED_TITLE_RE = re.compile(r"^(?:(\d{1,3})|([IVXLCDM]{1,7}))\.\s+(?=[^\W\d_])(.{1,76})$")
_MD_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*$")
_BREAK_RE = re.compile(r"^(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,}|(?:~\s*){3,}|(?:=\s*){3,}|#|§|(?:•\s*){3,})$")

# Public-domain ebooks wrap the book in licence text between these markers.
_EBOOK_START_RE = re.compile(r"^\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG", re.IGNORECASE)
_EBOOK_END_RE = re.compile(r"^\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG", re.IGNORECASE)

MAX_HEADING_CHARS = 80
GAP_BLANK_LINES = 4
CHAPTER_SIZED_WORDS = 1500
# A file without any headings shorter than this is one chapter, never a book to cut up.
WHOLE_BOOK_MIN_WORDS = 8000
FRONT_MATTER_MAX_WORDS = 1500


def is_chapter_heading(text: str) -> bool:
    """True when a single line reads as a chapter heading rather than prose."""
    line = " ".join(text.split())
    if not line or len(line) > MAX_HEADING_CHARS or "\n" in text:
        return False
    m = _NUMBERED_RE.match(line)
    if m:
        rest = m.group("rest") or ""
        # "Chapter 3 begins where the last one ended." is a sentence, not a title.
        return not (rest.rstrip().endswith((".", "?", "!")) and len(rest.split()) > 6)
    return bool(_NUMBER_FIRST_RE.match(line) or _STANDALONE_RE.match(line))


def _roman_value(s: str) -> int:
    vals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    total = 0
    for i, ch in enumerate(s):
        v = vals[ch]
        total += -v if i + 1 < len(s) and vals[s[i + 1]] > v else v
    return total


def word_count(text: str) -> int:
    if text == SCENE_BREAK:
        return 0
    return len(re.sub(r"[*_#\\]", " ", text).split())


# ── Reading files into blocks ─────────────────────────────────────────────────
# A block is {"kind": "para" | "h1" | "h2" | "h3" | "title" | "break" | "gap", "text": str}


def _decode(raw: bytes) -> str:
    # "Unicode" text exports from Word and older Notepad are UTF-16 with a byte-order mark.
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16")
    for enc in ("utf-8-sig", "cp1250", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def _classify(text: str) -> dict:
    stripped = text.strip()
    if _BREAK_RE.match(stripped):
        return {"kind": "break", "text": SCENE_BREAK}
    m = _MD_HEADING_RE.match(stripped)
    if m and "\n" not in stripped:
        level = len(m.group(1))
        return {"kind": "h1" if level == 1 else "h2" if level == 2 else "h3", "text": m.group(2).strip()}
    return {"kind": "para", "text": stripped}


def text_to_blocks(text: str) -> list[dict]:
    """Plain text / markdown → blocks, coping with both blank-line and one-line-per-paragraph files."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").lstrip("﻿")
    lines = text.split("\n")
    nonblank = sum(1 for l in lines if l.strip())
    blank = len(lines) - nonblank

    blocks: list[dict] = []
    if nonblank >= 20 and blank < nonblank * 0.1:
        # One line per paragraph, almost no blank lines.
        for line in lines:
            if line.strip():
                blocks.append(_classify(line))
        return blocks

    groups: list[list[str]] = []
    current: list[str] = []
    blank_run = 0
    for line in lines:
        if line.strip():
            if blank_run >= GAP_BLANK_LINES and groups:
                groups.append(["\x00gap"])
            blank_run = 0
            current.append(line.rstrip())
        else:
            blank_run += 1
            if current:
                groups.append(current)
                current = []
    if current:
        groups.append(current)

    # Hard-wrapped text (fixed-width lines) gets its line breaks joined back up.
    inner = [len(l) for g in groups if len(g) > 1 for l in g[:-1]]
    hard_wrapped = len(inner) >= 10 and sum(45 <= n <= 90 for n in inner) >= 0.7 * len(inner)

    for g in groups:
        if g == ["\x00gap"]:
            blocks.append({"kind": "gap", "text": ""})
            continue
        # A heading glued to the paragraph below it ("Chapter 1\nIt was…").
        while len(g) > 1 and (is_chapter_heading(g[0]) or _MD_HEADING_RE.match(g[0].strip())):
            blocks.append(_classify(g[0]))
            g = g[1:]
        joined = " ".join(l.strip() for l in g) if hard_wrapped else "\n".join(l.strip() for l in g)
        blocks.append(_classify(joined))
    return blocks


def _escape_markup(s: str) -> str:
    return s.replace("\\", "\\\\").replace("*", "\\*").replace("_", "\\_")


def _text_runs(paragraph):
    """
    Every run that shows text, in order: plain runs plus those inside
    hyperlinks, fields and tracked insertions (paragraph.runs skips those),
    but not tracked deletions.
    """
    from docx.text.run import Run

    return [Run(r, paragraph) for r in paragraph._p.xpath(".//w:r[not(ancestor::w:del)]")]


def _runs_to_markup(paragraph) -> str:
    """docx runs → markup, keeping bold and italics."""
    segments: list[list] = []
    for run in _text_runs(paragraph):
        if not run.text:
            continue
        flags = (bool(run.bold), bool(run.italic))
        if segments and segments[-1][1] == flags:
            segments[-1][0] += run.text
        else:
            segments.append([run.text, flags])
    out = []
    for text, (bold, italic) in segments:
        core = text.strip()
        if not core or not (bold or italic):
            out.append(_escape_markup(text))
            continue
        lead = text[: len(text) - len(text.lstrip())]
        trail = text[len(text.rstrip()):]
        inner = _escape_markup(core)
        if italic:
            inner = f"_{inner}_"
        if bold:
            inner = f"**{inner}**"
        out.append(f"{lead}{inner}{trail}")
    return "".join(out)


def docx_to_blocks(path: str) -> list[dict]:
    import docx  # python-docx

    document = docx.Document(path)
    blocks: list[dict] = []
    for para in document.paragraphs:
        plain = para.text.strip()
        if not plain:
            continue
        style = (para.style.name or "").lower() if para.style is not None else ""
        if style == "title":
            blocks.append({"kind": "title", "text": plain})
        elif style.startswith("heading 1"):
            blocks.append({"kind": "h1", "text": plain})
        elif style.startswith("heading 2"):
            blocks.append({"kind": "h2", "text": plain})
        elif style.startswith("heading"):
            blocks.append({"kind": "h3", "text": plain})
        elif _BREAK_RE.match(plain):
            blocks.append({"kind": "break", "text": SCENE_BREAK})
        else:
            markup = _runs_to_markup(para).strip()
            # Never lose words to formatting: if the run walk missed any, keep the plain text.
            if word_count(markup) < len(plain.split()):
                markup = _escape_markup(plain)
            blocks.append({"kind": "para", "text": markup})
    return blocks


def read_blocks(path: str) -> list[dict]:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".docx":
        return docx_to_blocks(path)
    if ext in (".txt", ".md", ".markdown"):
        with open(path, "rb") as f:
            return text_to_blocks(_decode(f.read()))
    raise ValueError(f"Unsupported file type: {ext}")


# ── Splitting blocks into chapters ────────────────────────────────────────────


def _block_as_paragraph(block: dict) -> str | None:
    kind = block["kind"]
    if kind == "gap":
        return None
    if kind == "break":
        return SCENE_BREAK
    if kind in ("h1", "h2", "h3"):
        return f"### {_escape_markup(block['text'])}"
    if kind == "title":
        return _escape_markup(block["text"])
    return block["text"]


def _make_chunk(title: str, paragraphs: list[str], source: str | None, flag: str | None = None) -> dict:
    # Scene breaks at the edges of a chapter are leftovers of the split.
    while paragraphs and paragraphs[0] == SCENE_BREAK:
        paragraphs = paragraphs[1:]
    while paragraphs and paragraphs[-1] == SCENE_BREAK:
        paragraphs = paragraphs[:-1]
    words = sum(word_count(p) for p in paragraphs)
    if flag is None and words == 0:
        flag = "empty"
    return {
        "title": title,
        "paragraphs": paragraphs,
        "content": "\n\n".join(paragraphs),
        "word_count": words,
        "flag": flag,
        "source": source,
    }


def _numbered_run(blocks: list[dict]) -> list[int]:
    """Indexes of numbered lines that count up like chapters (1, 2, 3… restarting at 1 per part)."""
    found = []
    for i, b in enumerate(blocks):
        if b["kind"] != "para":
            continue
        line = " ".join(b["text"].split())
        m = _BARE_NUMBER_RE.match(line)
        if not m:
            m = _NUMBERED_TITLE_RE.match(line)
            if not m or line.rstrip().endswith((".", ",", ";")) or len(line.split()) > 14:
                continue
        found.append((i, int(m.group(1)) if m.group(1) else _roman_value(m.group(2))))
    if len(found) < 3 or found[0][1] != 1:
        return []
    good = sum(1 for a, b in zip(found, found[1:]) if b[1] == a[1] + 1 or b[1] == 1)
    total_words = sum(word_count(b["text"]) for b in blocks if b["kind"] == "para")
    if good >= 0.8 * (len(found) - 1) and total_words / len(found) >= 800:
        return [i for i, _ in found]
    return []


def _heading_indexes(blocks: list[dict]) -> list[int]:
    """Indexes of the blocks that start a chapter."""
    counts = {k: sum(1 for b in blocks if b["kind"] == k) for k in ("h1", "h2")}
    if counts["h1"] >= 2:
        return [i for i, b in enumerate(blocks) if b["kind"] == "h1"]
    if counts["h2"] >= 2:
        return [i for i, b in enumerate(blocks) if b["kind"] == "h2"]

    keyword = [
        i for i, b in enumerate(blocks)
        if b["kind"] in ("h1", "h2") or (b["kind"] == "para" and is_chapter_heading(b["text"]))
    ]
    return sorted(set(keyword) | set(_numbered_run(blocks)))


TOC_ENTRY_MAX_WORDS = 15


def _flag_contents_runs(chunks: list[dict]) -> list[dict]:
    """Three or more near-empty headings in a row are a table of contents (long titles may wrap)."""
    out = list(chunks)
    i = 0
    while i < len(out):
        j = i
        while j < len(out) and out[j]["word_count"] <= TOC_ENTRY_MAX_WORDS:
            j += 1
        if j - i >= 3:
            for k in range(i, j):
                out[k] = {**out[k], "flag": "empty"}
        i = max(j, i + 1)
    return out


def _fold_part_headings(chunks: list[dict]) -> list[dict]:
    """
    A heading with no text of its own, right before another heading, is a part
    title ("Part One" above "Chapter 1"): it moves into the next chapter as a
    sub-heading instead of becoming an empty chapter. Three or more empty
    headings in a row are a table of contents and stay as they are.
    """
    out, i = [], 0
    while i < len(chunks):
        j = i
        while j < len(chunks) and chunks[j]["flag"] == "empty":
            j += 1
        run = j - i
        if 0 < run <= 2 and j < len(chunks) and chunks[j]["flag"] is None:
            target = chunks[j]
            heads = [f"### {_escape_markup(c['title'])}" for c in chunks[i:j]]
            out.append(_make_chunk(target["title"], heads + target["paragraphs"], target["source"]))
            i = j + 1
        elif run:
            out.extend(chunks[i:j])
            i = j
        else:
            out.append(chunks[i])
            i += 1
    return out


def _split_on(blocks: list[dict], kind: str, source: str | None, titles: str) -> list[dict]:
    chunks, current = [], []
    for b in blocks:
        if b["kind"] == kind:
            if current:
                chunks.append(current)
            current = []
        else:
            p = _block_as_paragraph(b)
            if p is not None:
                current.append(p)
    if current:
        chunks.append(current)
    return [_make_chunk(f"{titles} {i + 1}", c, source) for i, c in enumerate(chunks)]


def split_blocks(blocks: list[dict], source: str | None = None, fallback_title: str = "Chapter 1",
                 one_chapter_unless_headed: bool = False) -> list[dict]:
    """
    Cuts blocks into chapter chunks.

    one_chapter_unless_headed: used when several files are imported at once.
    A file is then one chapter unless it clearly holds several (two or more
    headings); a single heading at its top becomes the chapter title.
    """
    # Licence text after the ebook's end marker becomes flagged back matter.
    back_matter = None
    end = next((i for i, b in enumerate(blocks) if _EBOOK_END_RE.match(b["text"])), None)
    if end is not None:
        tail = [p for p in (_block_as_paragraph(b) for b in blocks[end:]) if p is not None]
        back_matter = _make_chunk("Back matter", tail, source, flag="back")
        blocks = blocks[:end]
    chunks = _split_blocks(blocks, source, fallback_title, one_chapter_unless_headed)
    return chunks + [back_matter] if back_matter else chunks


def _split_blocks(blocks, source, fallback_title, one_chapter_unless_headed):
    heads = _heading_indexes(blocks)

    if one_chapter_unless_headed and len(heads) < 2:
        title = fallback_title
        body = blocks
        if heads and all(b["kind"] in ("title", "gap") for b in blocks[: heads[0]]):
            title = " ".join(blocks[heads[0]]["text"].split())
            body = blocks[: heads[0]] + blocks[heads[0] + 1:]
        elif blocks and blocks[0]["kind"] == "title":
            title, body = blocks[0]["text"], blocks[1:]
        paragraphs = [p for p in (_block_as_paragraph(b) for b in body) if p is not None]
        return [_make_chunk(title, paragraphs, source)]

    if not heads:
        words = sum(word_count(b["text"]) for b in blocks if b["kind"] == "para")
        if words < WHOLE_BOOK_MIN_WORDS:
            paragraphs = [p for p in (_block_as_paragraph(b) for b in blocks) if p is not None]
            return [_make_chunk(fallback_title, paragraphs, source)]
        if any(b["kind"] == "gap" for b in blocks):
            return _split_on(blocks, "gap", source, "Section")
        breaks = sum(1 for b in blocks if b["kind"] == "break")
        if breaks and words / (breaks + 1) >= CHAPTER_SIZED_WORDS:
            return _split_on(blocks, "break", source, "Chapter")
        paragraphs = [p for p in (_block_as_paragraph(b) for b in blocks) if p is not None]
        return [_make_chunk(fallback_title, paragraphs, source)]

    chunks = []
    front = [p for p in (_block_as_paragraph(b) for b in blocks[: heads[0]]) if p is not None]
    if front:
        front_words = sum(word_count(p) for p in front)
        if front_words > FRONT_MATTER_MAX_WORDS:
            chunks.append(_make_chunk("Opening", front, source))
        else:
            chunks.append(_make_chunk("Front matter", front, source, flag="front"))

    body = []
    for n, start in enumerate(heads):
        end = heads[n + 1] if n + 1 < len(heads) else len(blocks)
        title = " ".join(blocks[start]["text"].split())
        paragraphs = [p for p in (_block_as_paragraph(b) for b in blocks[start + 1: end]) if p is not None]
        body.append(_make_chunk(title, paragraphs, source))
    return chunks + _fold_part_headings(_flag_contents_runs(body))


# ── Files and folders ─────────────────────────────────────────────────────────


def natural_key(name: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def expand_paths(paths: list[str]) -> list[str]:
    """Files as given plus the supported files inside any folder, in natural name order."""
    files = []
    for p in paths:
        if os.path.isdir(p):
            for name in os.listdir(p):
                full = os.path.join(p, name)
                if os.path.isfile(full) and os.path.splitext(name)[1].lower() in SUPPORTED_EXTENSIONS:
                    files.append(full)
        else:
            files.append(p)
    seen, unique = set(), []
    for f in files:
        key = os.path.normcase(os.path.abspath(f))
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return sorted(unique, key=lambda f: natural_key(os.path.basename(f)))


def title_from_filename(path: str) -> str:
    stem = os.path.splitext(os.path.basename(path))[0]
    stem = re.sub(r"\s*\(\d+\)$", "", stem)  # "Chapter 3 (1)": a download-copy suffix
    stem = re.sub(r"[_]+", " ", stem).strip()
    return stem or "Chapter"


def preview_files(paths: list[str]) -> dict:
    """Reads and splits files. Several files: one chapter per file unless a file clearly holds more."""
    files = expand_paths(paths)
    many = len(files) > 1
    splits, report = [], []
    for path in files:
        name = os.path.basename(path)
        try:
            blocks = read_blocks(path)
            chunks = split_blocks(
                blocks,
                source=name,
                # Files added one at a time are named after themselves, not all "Chapter 1".
                fallback_title=title_from_filename(path),
                one_chapter_unless_headed=many,
            )
            splits.extend(chunks)
            report.append({"name": name, "chapters": len(chunks)})
        except Exception as e:  # one bad file shouldn't sink the batch
            report.append({"name": name, "chapters": 0, "error": str(e)})
    return {
        "splits": splits,
        "files": report,
        "total_words": sum(s["word_count"] for s in splits),
        "total_chapters": len(splits),
    }


# ── Markup → editor HTML ──────────────────────────────────────────────────────

_STRONG_RE = re.compile(r"\*\*(?=\S)(.+?)(?<=\S)\*\*")
_EM_STAR_RE = re.compile(r"(?<![\\*])\*(?=[^\s*])(.+?)(?<=[^\s\\])\*")
_EM_UNDER_RE = re.compile(r"(?<![\w\\])_(?=\S)(.+?)(?<=[^\s\\])_(?!\w)")


def inline_to_html(text: str) -> str:
    out = html.escape(text, quote=False)
    out = _STRONG_RE.sub(r"<strong>\1</strong>", out)
    out = _EM_STAR_RE.sub(r"<em>\1</em>", out)
    out = _EM_UNDER_RE.sub(r"<em>\1</em>", out)
    out = out.replace("\\*", "*").replace("\\_", "_").replace("\\\\", "\\")
    return out.replace("\n", "<br>")


def paragraphs_to_html(paragraphs: list[str]) -> str:
    parts = []
    for p in paragraphs:
        if not p.strip():
            continue
        if p == SCENE_BREAK:
            parts.append(f"<p>{SCENE_BREAK}</p>")
        elif p.startswith("### "):
            parts.append(f"<h3>{inline_to_html(p[4:])}</h3>")
        else:
            parts.append(f"<p>{inline_to_html(p)}</p>")
    return "".join(parts)

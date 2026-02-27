# FleshNote Export Pipeline — Formatting Guidelines

## Architecture Overview

The export pipeline is a two-stage process:

```
Internal .md (with custom syntax) → Stage 1: STRIP → Stage 2: RENDER → Output file
```

**Stage 1 (Strip)** transforms your internal markdown into clean intermediate text based on content mode.
**Stage 2 (Render)** formats that intermediate text into the target file format.

The stripping logic should live in Python (FastAPI backend) since it needs SQLite access to resolve entity links into descriptions/footnotes.

---

## Stage 1: Content Mode Stripping

### Prose Only
- `@mentions` and entity links → plain text (just the display name, no link)
- `[[entity:uuid]]` syntax → resolved display name from DB
- Epistemic markers (`{secret:...}`, `{knows:...}`) → removed entirely
- Quick notes → removed
- Export annotations → removed
- Chapter headings preserved as `# Chapter Title`
- Scene breaks (`---` or `***`) preserved

### With Annotations
- Same as Prose Only, PLUS:
- Export annotation markers → converted to footnotes/endnotes
- Resolve annotation content from DB, format as `[^1]` style references
- Quick notes still removed (they're working notes, not reader-facing)

### Full Annotated
- Entity links → format-appropriate rich links (see per-format specs below)
- Epistemic markers → comments or margin notes
- Export annotations → footnotes
- Quick notes → removed (never export these, they're internal scaffolding)
- Preserve chapter structure and scene breaks

---

## Stage 2: Format-Specific Rendering

---

### .txt — Plain Text

The simplest format. Zero styling, pure content.

```
Encoding:        UTF-8
Line endings:    LF (\n)
Line wrapping:   None (let the editor wrap)
Chapter breaks:  Two blank lines + chapter title in CAPS + one blank line
Scene breaks:    One blank line + "* * *" + one blank line
Paragraphs:      Separated by one blank line (no indentation)
Annotations:     Endnotes at bottom: [1], [2], etc. with a "---" separator
```

Example structure:
```

THE MERCHANT'S GAMBIT

The harbor stank of salt and broken promises. Kael pulled
his cloak tighter as he pushed through the crowd.

* * *

She found him at the docks, exactly where she knew he'd be.

---
Notes:
[1] This scene parallels the opening of Book 2.
```

No metadata header. No formatting. If someone opens this in Notepad, it should read perfectly.

---

### .md — Clean Markdown

Portable, standard Markdown. Must work in Obsidian, GitHub, Typora, any renderer.

```
Encoding:        UTF-8
Headings:        # for chapter titles, ## for sub-chapters if any
Scene breaks:    ---  (thematic break)
Paragraphs:      Separated by one blank line
Bold/Italic:     Preserved from source if present in prose
Annotations:     Standard footnote syntax [^1] with definitions at bottom
Entity links:    Prose Only → plain text
                 Full → **bold** on first occurrence per chapter
```

**Critical: Strip ALL custom FleshNote syntax.** The output must be valid CommonMark. No `[[entity:uuid]]`, no `@mention` syntax, no `{epistemic:...}` blocks. If a Markdown parser chokes on it, you've left custom syntax in.

Frontmatter (optional, top of file):
```yaml
---
title: "The Fleshstone Chronicles"
author: "Imi Hartmann"
date: "2026-02-25"
---
```

---

### .html — Self-Contained HTML

One file. Embedded CSS. No external dependencies. Opens in any browser and looks like a real book page.

```
DOCTYPE:         html5
Encoding:        UTF-8 meta charset
Font stack:      "Literata", "Georgia", "Times New Roman", serif
                 (import Literata from Google Fonts via <link> in <head>)
Body max-width:  38em (roughly 65-70 characters per line — optimal reading)
Body margin:     0 auto (centered)
Body padding:    3em 1.5em
Background:      #fafaf7 (warm off-white, not harsh #fff)
Text color:      #2a2a2a (soft black)
Font size:       1.125rem (18px base)
Line height:     1.7
Paragraph:       margin-bottom: 1em. NO text-indent on first paragraph
                 after a heading or break. All others: text-indent: 1.5em,
                 margin-bottom: 0 (book-style indented paragraphs)
Chapter titles:  <h2>, font-size: 1.6em, margin-top: 3em, text-align: center,
                 letter-spacing: 0.05em, text-transform: uppercase (optional)
Scene breaks:    <hr> styled as centered "* * *" or "◆" via CSS pseudo-element,
                 no visible line — border: none, text-align: center
Footnotes:       <sup><a href="#fn1">[1]</a></sup> in text,
                 <section class="footnotes"> at end of each chapter or document
                 Footnote section: smaller font (0.85em), color: #666
```

**Full Annotated mode additions:**
- Entity first-mentions: `<span class="entity" title="Character description from DB">Name</span>`
  with CSS: `.entity { border-bottom: 1px dotted #999; cursor: help; }`
- Epistemic markers: `<aside class="epistemic">` blocks, styled as margin notes
  with CSS: small font, italic, muted color, left border accent

**Print stylesheet** (include via `@media print`):
```css
@media print {
  body { max-width: 100%; padding: 0; font-size: 11pt; }
  a { text-decoration: none; color: inherit; }
  .no-print { display: none; }
}
```

---

### .docx — Word Document

Use `python-docx`. Define styles programmatically, do NOT rely on default Normal template.

#### Non-Book-Ready (default manuscript format)

This is the "editor submission" standard — what agents and publishers expect.

```
Page size:       Letter (8.5" × 11")
Margins:         1" all sides
Font:            Times New Roman, 12pt
Line spacing:    Double (2.0)
Paragraph:       First-line indent 0.5", no space between paragraphs
                 First paragraph after heading: NO indent
Alignment:       Left-aligned (ragged right). NEVER justified.
Chapter titles:  Same font, 14pt bold, centered, page break before each
                 Insert 4-6 blank lines before chapter title for "drop"
Scene breaks:    Centered "#" on its own line, with a blank line above and below
Headers:         Author surname / TITLE (shortened) — right-aligned, every page
                 Or: TITLE on left pages, CHAPTER TITLE on right pages
Footers:         Page number, centered
                 Start numbering from 1 at Chapter 1 (front matter uses roman)
Annotations:     Word footnotes via python-docx footnote API
                 (shows at bottom of page with superscript reference)
```

**Style definitions to create in python-docx:**
```python
styles_to_define = {
    'FN Body':          {'font': 'Times New Roman', 'size': Pt(12), 'line_spacing': 2.0,
                         'first_line_indent': Inches(0.5), 'space_after': Pt(0)},
    'FN Body First':    {'font': 'Times New Roman', 'size': Pt(12), 'line_spacing': 2.0,
                         'first_line_indent': Inches(0),  'space_after': Pt(0)},
    'FN Chapter':       {'font': 'Times New Roman', 'size': Pt(14), 'bold': True,
                         'alignment': WD_ALIGN.CENTER, 'page_break_before': True,
                         'space_before': Pt(72)},
    'FN Scene Break':   {'font': 'Times New Roman', 'size': Pt(12),
                         'alignment': WD_ALIGN.CENTER, 'space_before': Pt(12),
                         'space_after': Pt(12)},
}
```

#### Book-Ready (print-formatted)

Uses the trim size, gutter, outer, font size, and leading from the Book Visualizer metrics.

```
Page size:       Trim size (e.g. 5" × 8" for Standard)
Margins:
  Top:           metrics.topIn (0.6" - 0.75")
  Bottom:        metrics.bottomIn (0.7" - 0.85")
  Inside/Gutter: metrics.gutterIn (0.375" - 0.875", from industry spec table)
  Outside:       metrics.outerIn (0.5" - 0.875")
  *** USE MIRROR MARGINS in python-docx so left/right pages flip correctly ***
Font:            Garamond or Palatino, metrics.fontSize (9.5pt - 12pt)
                 Fallback: Georgia, then Times New Roman
Line spacing:    metrics.leading (fontSize × 1.4, roughly)
                 Set as EXACT leading in points, not "multiple"
Paragraph:       First-line indent 0.25" (smaller than manuscript, this is typeset)
                 No space between paragraphs
                 First paragraph after heading: NO indent
Alignment:       Justified with hyphenation hints
                 (python-docx can't do auto-hyphenation, but justified looks right
                  at book widths — only looks bad on wide Letter pages)
Chapter titles:  Start each chapter on a recto (right/odd) page
                 Insert blank verso if needed: add a section break
                 Title: centered, small-caps, 14pt, generous space above (1.5")
                 Optional: chapter number above title in smaller text
Scene breaks:    Centered ornamental character: ◆ or ❧ or * * *
                 Space above/below: 0.5 line
Headers:         Running heads: author name on verso (left), chapter title on recto
                 Omit header on chapter opening pages
Footers:         Page number centered, same font as body at 9pt
                 Front matter (if any): lowercase roman numerals
                 Body: arabic starting at 1
Page breaks:     python-docx: section_start = WD_SECTION_START.ODD_PAGE for chapters
```

**Mirror margins setup in python-docx:**
```python
from docx.shared import Inches
section = document.sections[0]
section.page_width = Inches(5)       # trim width
section.page_height = Inches(8)      # trim height
section.top_margin = Inches(0.75)
section.bottom_margin = Inches(0.85)
section.left_margin = Inches(0.625)  # gutter (inside)
section.right_margin = Inches(0.625) # outer
section.gutter = Inches(0)          # use left_margin as gutter instead
# For true mirror margins, set in the XML:
# section._sectPr.attrib[qn('w:mirrorMargins')] = '1'
```

---

### .pdf — PDF

Render from HTML using **weasyprint** (preferred) or wkhtmltopdf.

#### Non-Book-Ready

Same as the HTML spec above but with `@page` CSS rules:

```css
@page {
  size: letter;
  margin: 1in;
}
body {
  font-family: "Literata", Georgia, serif;
  font-size: 12pt;
  line-height: 2;          /* double-spaced manuscript */
  text-align: left;
}
h2 {
  page-break-before: always;
  text-align: center;
  margin-top: 72pt;        /* chapter title drop */
}
```

#### Book-Ready

```css
@page {
  size: 5in 8in;            /* trim size */
  margin-top: 0.75in;
  margin-bottom: 0.85in;
}
@page :left {
  margin-left: 0.625in;     /* outer on left/verso pages */
  margin-right: 0.625in;    /* gutter on left pages */
}
@page :right {
  margin-left: 0.625in;     /* gutter on right/recto pages */
  margin-right: 0.625in;    /* outer on right pages */
}
body {
  font-family: "Garamond", "Palatino", Georgia, serif;
  font-size: 11pt;           /* from metrics */
  line-height: 15.4pt;       /* fontSize × 1.4 */
  text-align: justify;
  orphans: 2;                /* never leave fewer than 2 lines at bottom */
  widows: 2;                 /* or top of a page */
  hyphens: auto;
  -webkit-hyphens: auto;
}
p {
  text-indent: 0.25in;
  margin: 0;
}
p:first-of-type,
h2 + p,
hr + p {
  text-indent: 0;           /* no indent after headings/breaks */
}
h2 {
  page-break-before: right;  /* chapters start on recto */
  text-align: center;
  font-variant: small-caps;
  font-size: 14pt;
  letter-spacing: 0.05em;
  margin-top: 1.5in;
  margin-bottom: 0.5in;
}
hr {
  border: none;
  text-align: center;
  margin: 0.3in 0;
}
hr::after {
  content: "◆";
  color: #999;
}

/* Running headers & page numbers via @page margin boxes */
@page :left {
  @top-left { content: "Author Name"; font-size: 8pt; color: #999; }
}
@page :right {
  @top-right { content: string(chapter-title); font-size: 8pt; color: #999; }
}
@page :first {
  @top-left { content: none; }
  @top-right { content: none; }
}
@page {
  @bottom-center { content: counter(page); font-size: 9pt; }
}
h2 { string-set: chapter-title content(); }
```

**WeasyPrint notes:**
- Supports `@page :left/:right`, `@page :first`, and margin boxes
- Supports `string-set` for running headers
- Does NOT support JavaScript — all layout must be CSS
- Install with: `pip install weasyprint`
- Render: `weasyprint.HTML(string=html_content).write_pdf('output.pdf')`

---

### .epub — E-Book

Use **ebooklib** (`pip install ebooklib`).

```
Structure:
  - One XHTML file per chapter
  - Embedded CSS (same as HTML spec but simpler)
  - Table of contents generated from chapter headings
  - Cover image (optional — could render from the book visualizer SVG)
  - Metadata: title, author, language, date, identifier (UUID)

Font:            Do NOT embed fonts. E-readers use their own.
                 Specify font-family as fallback hint only:
                 "Georgia, serif" in CSS
Font size:       Do NOT set absolute sizes. Use relative: 1em for body.
                 The reader controls font size.
Line height:     1.6em (relative, not absolute)
Paragraph:       text-indent: 1.5em; margin: 0
                 First para after heading: text-indent: 0
Scene breaks:    <hr/> styled as centered ornament
Chapter titles:  <h1> (epub uses h1 for chapter level, not h2)
Images:          If any, must be embedded in the epub container
                 Max recommended: 1000px wide, JPEG or PNG
Annotations:     Epub supports footnotes as popup links:
                 <a epub:type="noteref" href="#fn1">[1]</a>
                 <aside epub:type="footnote" id="fn1"><p>Note text</p></aside>
```

**Epub CSS (keep it minimal, readers override almost everything):**
```css
body { margin: 1em; line-height: 1.6; }
p { text-indent: 1.5em; margin: 0; }
h1 + p, hr + p { text-indent: 0; }
h1 { text-align: center; margin: 2em 0 1em; font-size: 1.4em; }
hr { border: none; text-align: center; margin: 1em 0; }
hr::after { content: "◆"; color: #999; }
.footnote { font-size: 0.85em; color: #666; }
```

---

## General Rules (All Formats)

1. **Chapter detection:** Split on your `# ` headings in the internal markdown. Each `# ` becomes a chapter.

2. **Paragraph rules:**
   - Every paragraph gets first-line indent EXCEPT:
     - First paragraph of a chapter
     - First paragraph after a scene break
     - First paragraph after a heading
   - This is called "no-indent-after-break" and it's universal in professional typesetting

3. **Scene breaks:** Whatever the source uses (`---`, `***`, `* * *`), normalize to format-appropriate output. Never output a raw `---` in docx/pdf — convert to styled element.

4. **Smart quotes:** Convert straight quotes `"` `'` to curly quotes `"` `"` `'` `'` during strip phase. Also convert `--` to em-dash `—` and `...` to ellipsis `…`. This is a one-time regex pass.

5. **Encoding:** Always UTF-8. Never ASCII. Your users write in EN/HU/PL/AR — the text must survive intact.

6. **RTL support:** If the manuscript language is Arabic (detected from your i18next locale), flip all margin directions and set `dir="rtl"` on the root element. For mixed content, use `<bdo>` tags.

7. **File naming:** `{ProjectTitle}_{Format}_{Timestamp}.{ext}` — no spaces, use underscores. Example: `The_Fleshstone_Chronicles_pdf_20260225.pdf`

---

## Python Module Structure Suggestion

```
fleshnote/export/
├── __init__.py
├── pipeline.py          # Main ExportPipeline class
├── strip.py             # Content mode stripping (needs DB access)
│   ├── strip_prose()
│   ├── strip_annotated()
│   └── strip_full()
├── render_txt.py        # → .txt
├── render_md.py         # → .md
├── render_html.py       # → .html (also used as intermediate for PDF)
├── render_docx.py       # → .docx (python-docx)
├── render_pdf.py        # → .pdf (weasyprint from HTML)
├── render_epub.py       # → .epub (ebooklib)
├── typography.py        # Smart quotes, em-dashes, ellipsis, etc.
├── specs.py             # TRIM_SIZES, getGutterForPages, getBookMetrics
└── templates/
    ├── manuscript.css    # Non-book-ready HTML/PDF styles
    └── bookready.css     # Book-ready HTML/PDF styles (with @page rules)
```

Usage:
```python
from fleshnote.export.pipeline import ExportPipeline

pipeline = ExportPipeline(project_id="abc123", db=get_db())
pipeline.export(
    content_mode="prose",       # "prose" | "notes" | "full"
    format="pdf",               # "txt" | "md" | "html" | "docx" | "pdf" | "epub"
    book_ready=True,
    trim="standard",
    overrides={"font_size": 11, "gutter": 0.625},  # optional manual overrides
    output_path="/exports/The_Fleshstone_Chronicles.pdf"
)
```

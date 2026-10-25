# Exporting in FleshNote

FleshNote exports the manuscript in six formats, from a plain backup to a print-ready book.

## Supported Formats

- **.pdf**: printed by the app's own Chromium, in one of two layouts:
  - **Printed book**: the chosen trim size (pocket 4.25"×6.87", standard 5"×8", large 6"×9"), mirrored margins with the gutter on the binding side of every page, page numbers, justified and hyphenated text in Crimson Pro, each chapter on a new page, and chapter one on a right-hand page.
  - **Submission manuscript**: standard manuscript format for agents and editors: US Letter, 1-inch margins, 12 pt Times double-spaced, "Surname / TITLE / page" in the header, "#" for scene breaks, and a title page with the word count.
- **.docx (Microsoft Word)**: the same two layouts as editable Word documents (mirrored margins, page-number fields, italics, bold and line breaks kept).
- **.epub (E-Book)**: reflowable EPUB 3 with a title page, a table of contents and the manuscript's language.
- **.md (Markdown)**: emphasis, links, lists and footnotes as Markdown, for Obsidian, GitHub and the like.
- **.html**: one self-contained file with the font embedded; follows the reader's light or dark mode.
- **.txt**: plain text, notes collected at the end.

Every format gets book typography (curly quotes in the manuscript language, em dashes, ellipses). Deleted chapters are never exported, and a new export never overwrites an earlier one.

## Export Modes

1. **Prose Only**: the text alone. Entity links become plain text; annotations and quick notes are left out (the passages they mark stay).
2. **With Annotations**: annotations become numbered footnotes at the end of each chapter.
3. **Full Annotated**: footnotes plus visible entity, twist and foreshadowing links.

## Preview

- **PDF and Word:** the *Pages* tab shows the real printed pages (the same document the PDF export prints, drawn with pdf.js) as book spreads, with the true page count, page-turn controls, a scrubber with chapter marks, and an optional *Margins* overlay of the text block and gutter. Word pages follow the same layout, though Word may break lines slightly differently. The *Cover* tab (printed book only) sketches the closed book at the trim size, with the spine width from the real page count and the colour and rune from the bookshelf.
- **HTML, EPUB, Markdown, text:** the first selected chapter as it reads in that format.

## Technical Details

- Pipeline: `backend/export/` (see `EXPORT_GUIDELINES.md` for the module map). PDFs are laid out as print HTML by the backend and printed by the Electron main process (`printToPDF`).
- `python-docx` for Word, `EbookLib` for EPUB, `lxml` for parsing chapter HTML, `pyphen` for hyphenation.
- Tests: `backend/test_export.py`; page-layout review with measured margins: `backend/tools/export_review.py`.

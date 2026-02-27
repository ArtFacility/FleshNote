# Exporting in FleshNote

FleshNote provides a professional-grade export pipeline designed for authors who need to transition from raw drafting to publication-ready formats.

## Supported Formats

- **.docx (Microsoft Word)**: Industry-standard manuscript format. Uses standard paragraph styles, centered chapter headings, and 12pt Times New Roman-adjacent typography. Perfect for sending to editors or traditional publishers.
- **.pdf (Print-Ready)**: High-fidelity PDF generation with book-ready page layouts. Supports customizable trim sizes (e.g., 5"x8", 6"x9"), gutter margins for binding, and automatic font-size optimization.
- **.epub (E-Book)**: Reflowable e-book format compatible with Kindle, Apple Books, and Kobo. Standardized structural layout for electronic reading devices.
- **.md (Markdown)**: Clean, portable Markdown for use in external tools like Obsidian, Scrivener (via import), or GitHub.
- **.html**: Self-contained web view of your project with embedded CSS for beautiful browser-based reading.
- **.txt**: Pure raw text for minimal archival purposes.

## Export Modes

You can control exactly what content is exported:

1. **Prose Only**: Strips all lore links, annotations, and quick notes. Pure narrative text.
2. **With Annotations**: Converts `@lore` annotations into footnotes (or bracketed text depending on format). Discards private quick notes.
3. **Full Annotated**: Preserves entity links and epistemic markers in a format-appropriate way (e.g., hyperlinked text in PDF/HTML).

## Book-Ready Formatting (Pro Logic)

The PDF export module includes a specialized "Book-Ready" toggle. When enabled:

- **Trim Size**: Select from industry-standard sizes.
- **Auto-Optimization**: The system calculates the ideal font size and leading based on your total word count and selected trim size to hit a "natural" page count.
- **Gutter & Outer Margins**: Automatically adjusts for inner binding (gutter) versus outer readable space.
- **Spine Calculation**: Estimates spine width based on page count to assist in cover design.

## Live Preview

The Export Modal features a **Live Preview** tab. This provides a real-time visualization of how your text will look on the physical page (for PDF) or as a structured document (for other formats) without needing to perform a full file write.

## Technical Details

The export pipeline is powered by a Python backend using:
- `python-docx` for Word generation.
- `EbookLib` for EPUB generation.
- `spaCy` for final-pass entity cleaning.
- Custom CSS-to-HTML conversion for PDF rendering.

---
*FleshNote Export Module v0.5.0*

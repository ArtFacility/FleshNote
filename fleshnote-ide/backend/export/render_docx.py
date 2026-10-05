import io

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from export.render_html import TRIM_SIZES

_FONT = "Times New Roman"

# How visible links look in Full Annotated mode: (bold, italic, colour)
_LINK_STYLES = {
    "char": (True, False, None),
    "group": (True, False, None),
    "loc": (False, True, None),
    "item": (False, True, None),
    "lore": (False, True, None),
}


def _page_field(paragraph):
    """Appends a PAGE field (the current page number)."""
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    run = OxmlElement("w:r")
    text = OxmlElement("w:t")
    text.text = "1"
    run.append(text)
    field.append(run)
    paragraph._p.append(field)


def _mirror_margins(doc):
    """Turns on mirrored margins, so the inside (gutter) margin sits on the
    binding side of both left and right pages. The switch lives in the
    document settings, before defaultTabStop in the schema order."""
    settings = doc.settings.element
    if settings.find(qn("w:mirrorMargins")) is not None:
        return
    el = OxmlElement("w:mirrorMargins")
    anchor = settings.find(qn("w:defaultTabStop"))
    if anchor is not None:
        anchor.addprevious(el)
    else:
        settings.insert(0, el)


def _keep_break_lines_short(doc):
    """Stops Word from stretching the line before a manual line break
    (Shift+Enter) across the full width of a justified paragraph."""
    compat = doc.settings.element.find(qn("w:compat"))
    if compat is None:
        compat = OxmlElement("w:compat")
        doc.settings.element.append(compat)
    if compat.find(qn("w:doNotExpandShiftReturn")) is None:
        # comes before the compatSetting entries in the schema order
        compat.insert(0, OxmlElement("w:doNotExpandShiftReturn"))


def _add_runs(p, runs, note_ref, font_size, full):
    for r in runs:
        if r.kind == "br":
            p.add_run().add_break(WD_BREAK.LINE)
            continue
        if r.kind == "fnref":
            ref = p.add_run(note_ref(r.data.get("n", 0)))
            ref.font.superscript = True
            continue
        if not r.text:
            continue
        run = p.add_run(r.text)
        if "i" in r.marks:
            run.italic = True
        if "b" in r.marks:
            run.bold = True
        if "u" in r.marks or r.href:
            run.underline = True
        if "s" in r.marks:
            run.font.strike = True
        if "sup" in r.marks:
            run.font.superscript = True
        if "sub" in r.marks:
            run.font.subscript = True
        if "code" in r.marks:
            run.font.name = "Consolas"
        if full and r.kind == "entity":
            bold, italic, colour = _LINK_STYLES.get(r.data.get("type"), (False, True, None))
            run.bold = run.bold or bold
            run.italic = run.italic or italic
        elif full and r.kind == "twist":
            foreshadow = r.data.get("type") == "foreshadow"
            run.bold, run.italic = (None, True) if foreshadow else (True, None)
            run.font.color.rgb = RGBColor(0x78, 0x55, 0x9A) if foreshadow else RGBColor(0x2E, 0x7D, 0x32)
        elif full and r.kind == "epistemic":
            run.italic = True
            run.text = "[%s: %s]" % (r.data.get("type", ""), r.text)


def _centered(doc, text, size=None, italic=False, space_before=0, space_after=0, small_caps=False):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pf = p.paragraph_format
    pf.first_line_indent = Inches(0)
    pf.space_before = Pt(space_before)
    pf.space_after = Pt(space_after)
    pf.keep_with_next = True
    run = p.add_run(text)
    run.italic = italic or None
    run.font.small_caps = small_caps or None
    if size:
        run.font.size = Pt(size)
    return p


def render(project_title, author_name, chapters, content_mode, overrides=None, book_ready=True,
           word_count=0) -> bytes:
    """A Word document. book_ready gives a trim-size book (mirrored margins,
    page numbers, justified text); otherwise standard manuscript format
    (US Letter, 1-inch margins, 12 pt double-spaced, "Surname / TITLE / page"
    header)."""
    o = overrides or {}
    full = content_mode == "full"
    doc = Document()
    section = doc.sections[0]

    if book_ready:
        width, height, top, bottom = TRIM_SIZES.get(o.get("trim") or "standard", TRIM_SIZES["standard"])
        font_size = o.get("font_size") or 11
        section.page_width, section.page_height = Inches(width), Inches(height)
        section.top_margin, section.bottom_margin = Inches(top), Inches(bottom)
        section.left_margin = Inches(o.get("gutter") or 0.5)    # inside: the binding side
        section.right_margin = Inches(o.get("outer") or 0.5)
        _mirror_margins(doc)
        _keep_break_lines_short(doc)
        line_spacing, indent, align, scene = 1.15, Inches(0.25), WD_ALIGN_PARAGRAPH.JUSTIFY, "* * *"
        sink = Pt(round(height * 72 * 0.14))
    else:
        width, height = 8.5, 11.0
        font_size = 12
        section.page_width, section.page_height = Inches(width), Inches(height)
        for side in ("top_margin", "bottom_margin", "left_margin", "right_margin"):
            setattr(section, side, Inches(1))
        line_spacing, indent, align, scene = 2.0, Inches(0.5), WD_ALIGN_PARAGRAPH.LEFT, "#"
        sink = Pt(2.2 * 72)

    normal = doc.styles["Normal"]
    normal.font.name = _FONT
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), _FONT)
    normal.font.size = Pt(font_size)
    pf = normal.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
    pf.line_spacing = line_spacing
    pf.first_line_indent = indent
    pf.alignment = align
    pf.space_after = Pt(0)
    pf.space_before = Pt(0)
    pf.widow_control = True

    # Title page
    section.different_first_page_header_footer = True
    if book_ready:
        _centered(doc, project_title, size=font_size * 2, space_before=height * 72 * 0.3, space_after=12)
        if author_name:
            _centered(doc, author_name, italic=True)
        footer = section.footer.paragraphs[0]
        footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
        footer.paragraph_format.first_line_indent = Inches(0)
        _page_field(footer)
    else:
        top = doc.add_paragraph()
        top.paragraph_format.first_line_indent = Inches(0)
        top.paragraph_format.line_spacing = 1.0
        top.paragraph_format.tab_stops.add_tab_stop(Inches(6.5), WD_TAB_ALIGNMENT.RIGHT)
        top.add_run(author_name or "")
        top.add_run("\tabout %s words" % format(int(round(word_count, -2) if word_count >= 1000 else word_count), ","))
        _centered(doc, (project_title or "").upper(), space_before=3 * 72)
        if author_name:
            _centered(doc, "by %s" % author_name)
        header = section.header.paragraphs[0]
        header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        header.paragraph_format.first_line_indent = Inches(0)
        surname = (author_name or "").split()[-1] if (author_name or "").split() else ""
        header.add_run("%s / %s / " % (surname, (project_title or "").upper()) if surname
                       else "%s / " % (project_title or "").upper())
        _page_field(header)

    for idx, ch in enumerate(chapters):
        opener = None
        if ch.label:
            opener = _centered(doc, ch.label, space_before=sink.pt, small_caps=book_ready)
        title = _centered(doc, ch.title, size=font_size * (1.5 if book_ready else 1),
                          space_before=0 if ch.label else sink.pt, space_after=font_size * 1.5)
        (opener or title).paragraph_format.page_break_before = True

        def note_ref(n):
            return str(n)

        after_break = True
        for b in ch.blocks:
            if b.kind == "scene":
                p = _centered(doc, scene, space_before=font_size * 0.5 if book_ready else 0,
                              space_after=font_size * 0.5 if book_ready else 0)
                p.paragraph_format.keep_with_next = True
                after_break = True
                continue
            p = doc.add_paragraph()
            if b.kind == "h":
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.first_line_indent = Inches(0)
                p.paragraph_format.space_before = Pt(font_size)
                p.paragraph_format.keep_with_next = True
                _add_runs(p, b.runs, note_ref, font_size, full)
                for run in p.runs:
                    run.bold = True
                after_break = True
                continue
            if b.kind == "li":
                p.paragraph_format.first_line_indent = Inches(-0.2)
                p.paragraph_format.left_indent = Inches(0.35 + 0.3 * b.level)
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.add_run("%d. " % b.number if b.ordered else "• ")
                after_break = True
            elif b.kind == "quote":
                p.paragraph_format.left_indent = Inches(0.4)
                p.paragraph_format.right_indent = Inches(0.4)
                p.paragraph_format.first_line_indent = Inches(0)
                after_break = True
            elif after_break:
                # books set the first paragraph after a heading or break flush left;
                # manuscript format indents every paragraph
                if book_ready:
                    p.paragraph_format.first_line_indent = Inches(0)
                after_break = False
            _add_runs(p, b.runs, note_ref, font_size, full)

        if ch.footnotes:
            rule = doc.add_paragraph()
            rule.paragraph_format.first_line_indent = Inches(0)
            rule.paragraph_format.space_before = Pt(font_size)
            rule.add_run("—" * 6)
            for i, note in enumerate(ch.footnotes, 1):
                p = doc.add_paragraph()
                p.paragraph_format.first_line_indent = Inches(0)
                p.paragraph_format.line_spacing = 1.0
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                num = p.add_run("%d " % i)
                num.font.superscript = True
                body = p.add_run(note or "")
                body.font.size = Pt(max(8, font_size - 2))

    stream = io.BytesIO()
    doc.save(stream)
    return stream.getvalue()

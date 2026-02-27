from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
import re
import io

def render(project_title, author_name, chapters, content_mode, overrides=None) -> bytes:
    """
    Renders chapters to a professional DOCX document.
    Standard Manuscript Format (Double spaced, TNR 12pt, 1" margins)
    or Book-Ready format based on overrides.
    Returns bytes of the generated file.
    """
    doc = Document()
    
    # 0. Formatting Constants
    # TRIM_SIZES: { key: (width_inches, height_inches) }
    TRIM_SIZES = {
        'pocket': (4.25, 6.87),
        'standard': (5.0, 8.0),
        'large': (6.0, 9.0)
    }
    
    # Defaults
    trim_key = overrides.get('trim', 'standard') if overrides else 'standard'
    font_size = overrides.get('font_size', 12) if overrides else 12
    gutter = overrides.get('gutter', 0.5) if overrides else 0.5
    
    width, height = TRIM_SIZES.get(trim_key, TRIM_SIZES['standard'])
    
    # 1. Setup Document Sections (Margins and Size)
    section = doc.sections[0]
    section.page_width = Inches(width)
    section.page_height = Inches(height)
    
    # Standard margins + gutter on left
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.75)
    section.left_margin = Inches(0.75 + gutter)
    section.right_margin = Inches(0.75)
    
    # 2. Setup Default Style (Normal)
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(font_size)
    
    pf = style.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.DOUBLE
    pf.first_line_indent = Inches(0.5)
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
    pf.space_after = Pt(0)
    pf.space_before = Pt(0)

    # 3. Title Page (Optional but good for Stage 2)
    # For now, let's just start with the content to keep it simple and clean.
    
    # 4. Chapters
    for idx, chapter in enumerate(chapters):
        # Chapter Heading
        # We don't want indent for headings
        h = doc.add_paragraph()
        h_run = h.add_run(chapter.get('title', f"Chapter {idx+1}").upper())
        h_run.bold = True
        h.alignment = WD_ALIGN_PARAGRAPH.CENTER
        h.paragraph_format.first_line_indent = Inches(0)
        h.paragraph_format.space_before = Pt(24)
        h.paragraph_format.space_after = Pt(12)
        
        text = chapter.get('text', '')
        footnotes = chapter.get('footnotes', [])
        
        # Handle Footnotes (In DOCX we can use real footnotes)
        # However, for the first pass, let's keep it simple and match the text/md behavior
        # where we might just append them at the end or use [[1]].
        # Actually docx supports .add_footnote() but it's nested in runs.
        
        # Clean up markers
        text = re.sub(r'\[\[ENTITY_REF:[^:]+:([^\]]+)\]\]', r'\1', text)
        text = re.sub(r'\[\[ENTITY_LINK:[^:]+:[^:]+:([^:]+):[^\]]*\]\]', r'\1', text)
        text = re.sub(r'\{(secret|knows|believes):([^}]+)\}', r'', text)
        
        # Process paragraphs
        paragraphs = text.split('\n')
        for p_text in paragraphs:
            p_text = p_text.strip()
            if not p_text:
                continue
            
            if p_text in ('---', '***', '* * *'):
                # Scene Break
                sb = doc.add_paragraph("* * *")
                sb.alignment = WD_ALIGN_PARAGRAPH.CENTER
                sb.paragraph_format.first_line_indent = Inches(0)
            else:
                p = doc.add_paragraph(p_text)
                
        # Chapter Break (Page Break)
        if idx < len(chapters) - 1:
            doc.add_page_break()

    # Save to BytesIO
    target_stream = io.BytesIO()
    doc.save(target_stream)
    return target_stream.getvalue()

from xhtml2pdf import pisa
import io
import os
from export.render_html import render as render_html

def render(project_title, author_name, chapters, content_mode, overrides=None) -> bytes:
    """
    Renders chapters to a professional PDF document via HTML intermediate.
    """
    # 1. Generate HTML string first
    # We pass for_pdf=True to resolve CSS variables and remove external fonts that crash xhtml2pdf
    html_content = render_html(project_title, author_name, chapters, content_mode, overrides, for_pdf=True)
    
    # 2. Convert to PDF
    pdf_buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(
        html_content,
        dest=pdf_buffer,
        encoding='utf-8'
    )
    
    if pisa_status.err:
        raise Exception(f"PDF Generation failed: {pisa_status.err}")
        
    return pdf_buffer.getvalue()

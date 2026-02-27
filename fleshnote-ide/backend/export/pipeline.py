import os
import sqlite3
import datetime
import re

from export.typography import apply_typography
from export.strip import strip_prose, strip_notes, strip_full
import export.render_txt as render_txt
import export.render_md as render_md
import export.render_html as render_html
import export.render_docx as render_docx
import export.render_pdf as render_pdf
import export.render_epub as render_epub

class ExportPipeline:
    def __init__(self, project_path: str):
        self.project_path = project_path
        self.db_path = os.path.join(project_path, "fleshnote.db")
        self.md_dir = os.path.join(project_path, "md")
        self.export_dir = os.path.join(project_path, "exports")
        
        if not os.path.exists(self.export_dir):
            os.makedirs(self.export_dir)

        # Get metadata
        self.project_title = os.path.basename(project_path)
        self.author_name = ""
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT config_value FROM project_config WHERE config_key = 'project_name'")
            row = cursor.fetchone()
            if row: self.project_title = row[0]
            
            cursor.execute("SELECT config_value FROM project_config WHERE config_key = 'author_name'")
            row = cursor.fetchone()
            if row: self.author_name = row[0]
            conn.close()
        except:
            pass

    def get_chapters_ordered(self):
        """Retrieve all chapters from DB ordered by chapter_number"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, chapter_number, md_filename FROM chapters ORDER BY chapter_number ASC")
        rows = cursor.fetchall()
        
        chapters = []
        for row in rows:
            chapter_id, title, chapter_number, md_filename = row
            
            # Read the .md source of truth
            file_path = os.path.join(self.md_dir, md_filename)
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
            else:
                text = ""
                
            chapters.append({
                'id': chapter_id,
                'title': title,
                'num': chapter_number,
                'text': text,
                'footnotes': []
            })
            
        conn.close()
        return chapters

    def get_preview(self, content_mode: str, overrides: dict = None):
        """Returns HTML for the first chapter for preview purposes."""
        chapters = self.get_chapters_ordered()
        if not chapters:
            return "<p>No chapters to preview.</p>"
            
        # Only preview the first chapter
        preview_chapter = chapters[0]
        conn = sqlite3.connect(self.db_path)
        
        text = apply_typography(preview_chapter['text'])
        if content_mode == 'prose':
            text = strip_prose(text, conn, remove_html=False) # Keep tags for HTML preview
            footnotes = []
        elif content_mode == 'notes':
            text, footnotes = strip_notes(text, conn, remove_html=False)
        else:
            text, footnotes = strip_full(text, conn, remove_html=False)
            
        preview_chapter['text'] = text
        preview_chapter['footnotes'] = footnotes
        conn.close()
        
        # Render a mini version of HTML
        return render_html.render(self.project_title, self.author_name, [preview_chapter], content_mode, overrides)

    def run(self, content_mode: str, fmt: str, book_ready: bool = False, overrides: dict = None):
        """Executes the export pipeline returning the output filepath"""
        chapters = self.get_chapters_ordered()
        conn = sqlite3.connect(self.db_path)
        
        # --- STAGE 1: STRIP & TYPOGRAPHY ---
        remove_html = fmt in ('txt', 'md', 'docx')
        
        for ch in chapters:
            text = apply_typography(ch['text'])
            
            if content_mode == 'prose':
                text = strip_prose(text, conn, remove_html=remove_html)
                footnotes = []
            elif content_mode == 'notes':
                text, footnotes = strip_notes(text, conn, remove_html=remove_html)
            else:
                text, footnotes = strip_full(text, conn, remove_html=remove_html)
                
            ch['text'] = text
            ch['footnotes'] = footnotes
            
        conn.close()
        
        # --- STAGE 2: RENDER ---
        rendered_output = ""
        
        if fmt == 'txt':
            rendered_output = render_txt.render(chapters, content_mode)
        elif fmt == 'md':
            rendered_output = render_md.render(self.project_title, self.author_name, chapters, content_mode)
        elif fmt == 'html':
            rendered_output = render_html.render(self.project_title, self.author_name, chapters, content_mode, overrides)
        elif fmt == 'docx':
            rendered_output = render_docx.render(self.project_title, self.author_name, chapters, content_mode, overrides)
        elif fmt == 'pdf':
            rendered_output = render_pdf.render(self.project_title, self.author_name, chapters, content_mode, overrides)
        elif fmt == 'epub':
            rendered_output = render_epub.render(self.project_title, self.author_name, chapters, content_mode)
        else:
            rendered_output = "Unknown format."
            
        # Write to Output File
        slug = re.sub(r'[^A-Z0-9_\-]', '_', self.project_title, flags=re.IGNORECASE)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{slug}_{fmt}_{timestamp}.{fmt}"
        filepath = os.path.join(self.export_dir, filename)
        
        mode = 'wb' if isinstance(rendered_output, bytes) else 'w'
        encoding = None if isinstance(rendered_output, bytes) else 'utf-8'
        
        with open(filepath, mode, encoding=encoding) as f:
            f.write(rendered_output)
            
        return filepath

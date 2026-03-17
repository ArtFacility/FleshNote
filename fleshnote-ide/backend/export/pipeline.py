import os
import sqlite3
import datetime
import re

from export.typography import apply_typography
from export.strip import strip_prose, strip_notes, strip_full, strip_todo
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

    def get_chapters_ordered(self, chapter_ids: list = None):
        """Retrieve chapters from DB ordered by chapter_number. Optionally filter by IDs."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, chapter_number, md_filename FROM chapters ORDER BY chapter_number ASC")
        rows = cursor.fetchall()

        id_set = set(chapter_ids) if chapter_ids else None

        chapters = []
        for row in rows:
            chapter_id, title, chapter_number, md_filename = row

            if id_set is not None and chapter_id not in id_set:
                continue

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

    def get_preview(self, content_mode: str, fmt: str = 'html', overrides: dict = None, chapter_ids: list = None):
        """Returns HTML for the first chapter for preview purposes."""
        chapters = self.get_chapters_ordered(chapter_ids)
        if not chapters:
            return "<p>No chapters to preview.</p>"

        preview_chapter = chapters[0]
        conn = sqlite3.connect(self.db_path)

        # For plain-text formats (txt, md) strip HTML tags; otherwise keep them for HTML rendering
        plain_formats = ('txt', 'md')
        remove_html = fmt in plain_formats

        text = apply_typography(preview_chapter['text'])
        text, _ = strip_todo(text)

        if content_mode == 'prose':
            text = strip_prose(text, conn, remove_html=remove_html)
            footnotes = []
        elif content_mode == 'notes':
            text, footnotes = strip_notes(text, conn, remove_html=remove_html)
        else:
            text, footnotes = strip_full(text, conn, remove_html=remove_html)

        preview_chapter['text'] = text
        preview_chapter['footnotes'] = footnotes
        conn.close()

        if fmt == 'txt':
            plain = render_txt.render([preview_chapter], content_mode)
            return (
                "<html><body style='margin:0;background:#111;'>"
                "<pre style='font-family:monospace;font-size:13px;color:#ccc;"
                "padding:20px;white-space:pre-wrap;word-break:break-word;'>"
                + plain.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                + "</pre></body></html>"
            )
        if fmt == 'md':
            md_text = render_md.render(self.project_title, self.author_name, [preview_chapter], content_mode)
            return (
                "<html><body style='margin:0;background:#111;'>"
                "<pre style='font-family:monospace;font-size:13px;color:#ccc;"
                "padding:20px;white-space:pre-wrap;word-break:break-word;'>"
                + md_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                + "</pre></body></html>"
            )

        return render_html.render(self.project_title, self.author_name, [preview_chapter], content_mode, overrides)

    def run(self, content_mode: str, fmt: str, book_ready: bool = False, overrides: dict = None, chapter_ids: list = None):
        """Executes the export pipeline returning the output filepath"""
        chapters = self.get_chapters_ordered(chapter_ids)
        conn = sqlite3.connect(self.db_path)
        
        # --- STAGE 2: RENDER ---
        rendered_output = ""
        todo_count = 0
        remove_html = fmt in ('txt', 'md', 'docx')
        
        for ch in chapters:
            text = apply_typography(ch['text'])
            text, t_count = strip_todo(text)
            todo_count += t_count
            
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
        
        # --- STAGE 3: RENDER ---
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
            
        return filepath, todo_count

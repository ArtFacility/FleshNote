import datetime
import json
import os
import re
import sqlite3

from project_io import safe_md_path
from export.document import build_chapter
from export.strip import resolve_markers, strip_todo
from export.typography import apply_typography
import export.render_txt as render_txt
import export.render_md as render_md
import export.render_html as render_html
import export.render_docx as render_docx
import export.render_pdf as render_pdf
import export.render_epub as render_epub

FORMATS = ("txt", "md", "html", "docx", "pdf", "epub")


class ExportPipeline:
    """Reads a project's chapters and renders them in one export format.

    Each chapter goes through the same steps: drop #TODO notes, resolve the
    FleshNote markers for the content mode, parse the HTML into blocks
    (export/document.py), apply typography to the text, then render.
    """

    def __init__(self, project_path: str):
        self.project_path = project_path
        self.db_path = os.path.join(project_path, "fleshnote.db")
        self.md_dir = os.path.join(project_path, "md")
        self.export_dir = os.path.join(project_path, "exports")
        os.makedirs(self.export_dir, exist_ok=True)

        self.project_title = os.path.basename(project_path)
        self.author_name = ""
        self.lang = "en"
        try:
            conn = sqlite3.connect(self.db_path)
            config = dict(conn.execute(
                "SELECT config_key, config_value FROM project_config "
                "WHERE config_key IN ('project_name', 'author_name', 'story_language')").fetchall())
            conn.close()
            self.project_title = config.get("project_name") or self.project_title
            self.author_name = config.get("author_name") or ""
            self.lang = (config.get("story_language") or "en").split("-")[0].lower()
        except Exception:
            pass
        self.project_id = None
        try:
            with open(os.path.join(project_path, "fleshnote_project.json"), encoding="utf-8") as f:
                self.project_id = json.load(f).get("project_id")
        except Exception:
            pass

    def _chapter_rows(self, conn, chapter_ids=None):
        rows = conn.execute(
            "SELECT id, title, chapter_number, md_filename FROM chapters "
            "WHERE deleted = 0 ORDER BY chapter_number ASC").fetchall()
        if chapter_ids:
            wanted = {str(c) for c in chapter_ids}
            rows = [r for r in rows if str(r[0]) in wanted]
        return rows

    def chapters(self, content_mode: str, chapter_ids=None, limit=None):
        """The selected chapters as export documents, plus how many #TODO notes were dropped."""
        conn = sqlite3.connect(self.db_path)
        try:
            out, todo_count = [], 0
            for chapter_id, title, number, md_filename in self._chapter_rows(conn, chapter_ids)[:limit]:
                path = safe_md_path(self.md_dir, md_filename)
                text = ""
                if path and os.path.exists(path):
                    with open(path, "r", encoding="utf-8") as f:
                        text = f.read()
                text, todos = strip_todo(text)
                todo_count += todos
                text, notes = resolve_markers(text, conn, content_mode)
                notes = [apply_typography(n, self.lang) for n in notes]
                out.append(build_chapter(title or "Chapter %s" % number, text, notes, self.lang))
            return out, todo_count
        finally:
            conn.close()

    def cover_png(self):
        """The drawn front cover (PNG bytes), when the project has one."""
        from routes.cover import front_render_path
        path = front_render_path(self.project_path)
        if not path:
            return None
        with open(path, "rb") as f:
            return f.read()

    @staticmethod
    def word_count(chapters) -> int:
        return sum(len(b.plain.split()) for ch in chapters for b in ch.blocks)

    def render(self, content_mode, fmt, book_ready=False, overrides=None, chapters=None):
        """Renders chapters (from chapters()) as str or bytes."""
        title, author = self.project_title, self.author_name
        if fmt == "txt":
            return render_txt.render(title, author, chapters)
        if fmt == "md":
            return render_md.render(title, author, chapters, content_mode)
        if fmt == "html":
            return render_html.document(title, author, chapters, self.lang)
        if fmt == "docx":
            return render_docx.render(title, author, chapters, content_mode, overrides, book_ready,
                                      word_count=self.word_count(chapters))
        if fmt == "pdf":
            return render_pdf.render(title, author, chapters, book_ready, overrides, self.lang,
                                     word_count=self.word_count(chapters))
        if fmt == "epub":
            ident = "urn:uuid:%s" % self.project_id if self.project_id else None
            return render_epub.render(title, author, chapters, self.lang, ident, self.cover_png())
        raise ValueError("Unknown export format: %s" % fmt)

    def get_preview(self, content_mode: str, fmt: str = "html", overrides=None, chapter_ids=None,
                    book_ready=False):
        """HTML showing the first selected chapter the way the format renders it."""
        chapters, _ = self.chapters(content_mode, chapter_ids, limit=1)
        if not chapters:
            return "<p>No chapters to preview.</p>"
        if fmt in ("txt", "md"):
            text = self.render(content_mode, fmt, chapters=chapters)
            return ("<html><body style='margin:0;background:#111;'>"
                    "<pre style='font-family:monospace;font-size:13px;color:#ccc;"
                    "padding:20px;white-space:pre-wrap;word-break:break-word;'>"
                    + text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    + "</pre></body></html>")
        return render_html.document(self.project_title, self.author_name, chapters, self.lang)

    def print_document(self, content_mode: str, book_ready: bool = True, overrides=None, chapter_ids=None) -> str:
        """The PDF print document for the selected chapters, without writing a file
        (the export window prints it to show the real pages)."""
        chapters, _ = self.chapters(content_mode, chapter_ids)
        return self.render(content_mode, "pdf", book_ready, overrides, chapters)

    def output_path(self, content_mode: str, fmt: str) -> str:
        """A new file in the project's exports folder; never overwrites an earlier export."""
        slug = re.sub(r"[^A-Z0-9_\-]+", "_", self.project_title, flags=re.IGNORECASE).strip("_") or "export"
        stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        base = "%s_%s_%s" % (slug, content_mode, stamp)
        path = os.path.join(self.export_dir, "%s.%s" % (base, fmt))
        n = 2
        while os.path.exists(path):
            path = os.path.join(self.export_dir, "%s_%d.%s" % (base, n, fmt))
            n += 1
        return path

    def run(self, content_mode: str, fmt: str, book_ready: bool = False, overrides=None, chapter_ids=None):
        """Exports to a new file. Returns (filepath, todo_count, print_html).

        A PDF is not written here: print_html is the print document, and the
        caller (the Electron main process) prints it to filepath. For every
        other format print_html is None and the file is written.
        """
        if fmt not in FORMATS:
            raise ValueError("Unknown export format: %s" % fmt)
        chapters, todo_count = self.chapters(content_mode, chapter_ids)
        rendered = self.render(content_mode, fmt, book_ready, overrides, chapters)
        filepath = self.output_path(content_mode, fmt)
        if fmt == "pdf":
            return filepath, todo_count, rendered
        if isinstance(rendered, bytes):
            with open(filepath, "wb") as f:
                f.write(rendered)
        else:
            with open(filepath, "w", encoding="utf-8", newline="\n") as f:
                f.write(rendered)
        return filepath, todo_count, None

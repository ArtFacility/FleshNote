from ebooklib import epub
import os
import re
import io

def render(project_title, author_name, chapters, content_mode) -> bytes:
    """
    Renders chapters to a reflowable EPUB e-book.
    """
    book = epub.EpubBook()

    # Set metadata
    book.set_identifier(f"fleshnote-project-{project_title.lower().replace(' ', '-')}")
    book.set_title(project_title)
    book.set_language('en')
    if author_name:
        book.add_author(author_name)

    # Add TOC and Spine lists
    book_spine = ['nav']
    toc = []

    # Process Chapters
    for idx, chapter in enumerate(chapters):
        title = chapter.get('title', f"Chapter {idx+1}")
        file_name = f"chap_{idx+1:03d}.xhtml"
        
        # Create chapter object
        c = epub.EpubHtml(title=title, file_name=file_name, lang='en')
        
        content_html = []
        content_html.append(f"<h1>{title}</h1>")
        
        text = chapter.get('text', '')
        footnotes = chapter.get('footnotes', [])

        # Replace footnote ref placeholders with inline superscript links
        for i, fn in enumerate(footnotes):
            fn_idx = i + 1
            text = text.replace(
                f"[[FOOTNOTE_REF:{fn_idx}]]",
                f'<sup><a href="#fn{fn_idx}" id="ref{fn_idx}" epub:type="noteref">[{fn_idx}]</a></sup>'
            )

        # Clean remaining markers
        text = re.sub(r'\[\[ENTITY_REF:[^:]+:([^\]]+)\]\]', r'\1', text)
        text = re.sub(r'\[\[ENTITY_LINK:[^:]+:[^:]+:([^:]+):[^\]]*\]\]', r'\1', text)
        text = re.sub(r'\[\[TWIST_REF:([^:]+):([^\]]+)\]\]', r'\2', text)
        text = re.sub(r'\{(secret|knows|believes):([^}]+)\}', r'', text)

        if '<p>' not in text:
            blocks = text.split('\n')
            for b in blocks:
                if b.strip():
                    content_html.append(f"<p>{b.strip()}</p>")
        else:
            content_html.append(text)

        # Per-chapter footnotes as EPUB aside
        if footnotes:
            content_html.append('<aside epub:type="footnote">')
            content_html.append('<ol class="footnotes">')
            for i, fn in enumerate(footnotes):
                fn_idx = i + 1
                content_html.append(f'<li id="fn{fn_idx}"><a href="#ref{fn_idx}">^</a> {fn}</li>')
            content_html.append('</ol>')
            content_html.append('</aside>')

        c.content = u"<html><body>" + u"".join(content_html) + u"</body></html>"
        
        # Add to book
        book.add_item(c)
        book_spine.append(c)
        toc.append(epub.Link(file_name, title, f"chap{idx+1}"))

    # Set TOC and Spine
    book.toc = tuple(toc)
    book.spine = book_spine
    book.add_item(epub.EpubNav())
    book.add_item(epub.EpubNcx())

    # Write to buffer
    out = io.BytesIO()
    epub.write_epub(out, book, {})
    return out.getvalue()

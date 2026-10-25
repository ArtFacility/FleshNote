import io
import uuid

from ebooklib import epub

from export.render_html import _chapter_html, esc

_CSS = """
body { font-family: serif; line-height: 1.5; }
h1.book-title { text-align: center; font-weight: normal; margin-top: 30%; }
p.author { text-align: center; font-style: italic; text-indent: 0; }
.chapter-label { text-align: center; font-variant: small-caps; letter-spacing: 0.1em; text-indent: 0; margin: 3em 0 0; }
h2.chapter-title { text-align: center; font-weight: normal; margin: 0.3em 0 1.5em; }
h3 { text-align: center; font-size: 1em; }
p { margin: 0; text-indent: 1.3em; }
p.first, p.scene { text-indent: 0; }
p.scene { text-align: center; margin: 1em 0; }
blockquote { margin: 0.8em 1.5em; }
.note-ref { font-size: 0.7em; vertical-align: super; line-height: 0; }
.footnotes { margin-top: 2em; font-size: 0.85em; border-top: 1px solid #999; }
.entity.char, .entity.group, .twist { font-weight: bold; }
.entity.loc, .entity.item, .entity.lore, .foreshadow, .epistemic { font-style: italic; }
a { text-decoration: none; }
"""


def render(project_title, author_name, chapters, lang="en", identifier=None, cover_png=None) -> bytes:
    """A reflowable EPUB 3 with a title page, a table of contents and one file per
    chapter. cover_png (bytes) becomes the book's cover image."""
    book = epub.EpubBook()
    book.set_identifier(identifier or "urn:uuid:%s" % uuid.uuid4())
    book.set_title(project_title)
    book.set_language(lang or "en")
    if author_name:
        book.add_author(author_name)
    if cover_png:
        book.set_cover("images/cover.png", cover_png)

    style = epub.EpubItem(uid="style", file_name="style/book.css", media_type="text/css", content=_CSS)
    book.add_item(style)

    title_page = epub.EpubHtml(title=project_title, file_name="title.xhtml", lang=lang)
    title_page.content = '<h1 class="book-title">%s</h1>%s' % (
        esc(project_title), '<p class="author">%s</p>' % esc(author_name) if author_name else "")
    title_page.add_item(style)
    book.add_item(title_page)

    spine, toc = (["cover"] if cover_png else []) + [title_page, "nav"], []
    for idx, ch in enumerate(chapters):
        item = epub.EpubHtml(title=ch.title, file_name="chap_%03d.xhtml" % (idx + 1), lang=lang)
        item.content = _chapter_html(idx, ch)
        item.add_item(style)
        book.add_item(item)
        spine.append(item)
        toc.append(item)

    book.toc = tuple(toc)
    book.spine = spine
    book.add_item(epub.EpubNav())
    book.add_item(epub.EpubNcx())
    out = io.BytesIO()
    epub.write_epub(out, book, {})
    return out.getvalue()

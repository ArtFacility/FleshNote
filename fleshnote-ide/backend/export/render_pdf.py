from export import render_html


def render(project_title, author_name, chapters, book_ready=True, overrides=None, lang="en", word_count=0) -> str:
    """The print document for a PDF. The app prints it with Chromium
    (webContents.printToPDF with preferCSSPageSize), which honours the @page
    size, the mirrored margins and the page numbers set in its CSS.

    book_ready gives a trim-size book; otherwise standard manuscript format."""
    o = overrides or {}
    if book_ready:
        return render_html.print_book(project_title, author_name, chapters, lang=lang,
                                      trim=o.get("trim") or "standard", font_size=o.get("font_size"),
                                      gutter=o.get("gutter"), outer=o.get("outer"))
    return render_html.print_manuscript(project_title, author_name, chapters, lang=lang, word_count=word_count)

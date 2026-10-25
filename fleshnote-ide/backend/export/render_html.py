"""HTML rendering of the export block model: the standalone .html export, the
live preview, and the print documents the app turns into a PDF.

The PDF is printed by Chromium (the Electron main process), so the print CSS
can use @page sizes, mirrored :left/:right margins and page-number margin boxes.
"""
import base64
import dataclasses
import functools
import html
import os
import re

_FONT_DIR = os.path.join(os.path.dirname(__file__), "templates", "fonts")

# Trim sizes in inches: (width, height, top margin, bottom margin)
TRIM_SIZES = {
    "pocket": (4.25, 6.87, 0.6, 0.7),
    "standard": (5.0, 8.0, 0.75, 0.85),
    "large": (6.0, 9.0, 0.75, 0.85),
}

_MARK_ORDER = (("code", "code"), ("sub", "sub"), ("sup", "sup"), ("s", "s"), ("u", "u"), ("b", "strong"), ("i", "em"))


def esc(text) -> str:
    return html.escape(str(text or ""), quote=True)


def _css_string(text: str) -> str:
    """A CSS string literal (for content: in margin boxes)."""
    return '"%s"' % str(text or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")


@functools.lru_cache(maxsize=1)
def font_faces() -> str:
    """@font-face rules with Crimson Pro embedded, so exports look the same offline
    and on machines without the font."""
    faces = []
    for file, weight, style in (("CrimsonPro-Regular.ttf", 400, "normal"),
                                ("CrimsonPro-Medium.ttf", 600, "normal"),
                                ("CrimsonPro-Italic.ttf", 400, "italic")):
        path = os.path.join(_FONT_DIR, file)
        if not os.path.exists(path):
            continue
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode("ascii")
        faces.append("@font-face { font-family: 'Crimson Pro'; font-weight: %d; font-style: %s; "
                     "src: url(data:font/ttf;base64,%s) format('truetype'); }" % (weight, style, data))
    return "\n".join(faces)


def runs_html(runs, note_ref) -> str:
    """Inline HTML for a block's runs. note_ref(n) returns the markup for footnote n."""
    parts = []
    for r in runs:
        if r.kind == "br":
            parts.append("<br/>")
            continue
        if r.kind == "fnref":
            parts.append(note_ref(r.data.get("n", 0)))
            continue
        t = html.escape(r.text, quote=False)
        for mark, tag in _MARK_ORDER:
            if mark in r.marks:
                t = "<%s>%s</%s>" % (tag, t, tag)
        if r.href:
            t = '<a href="%s">%s</a>' % (esc(r.href), t)
        kind_type = r.data.get("type", "")
        if r.kind == "entity":
            title = (' title="%s"' % esc(r.data["desc"])) if r.data.get("desc") else ""
            t = '<span class="entity %s"%s>%s</span>' % (esc(kind_type), title, t)
        elif r.kind == "twist":
            t = '<span class="%s">%s</span>' % ("foreshadow" if kind_type == "foreshadow" else "twist", t)
        elif r.kind == "epistemic":
            t = '<span class="epistemic"><span class="epistemic-kind">%s:</span> %s</span>' % (esc(kind_type), t)
        parts.append(t)
    return "".join(parts)


def blocks_html(blocks, note_ref, scene="* * *") -> str:
    out = []
    list_stack = []  # open list tags

    def close_lists(depth=-1):
        while len(list_stack) > depth + 1:
            out.append("</%s>" % list_stack.pop())

    after_break = True
    for b in blocks:
        if b.kind != "li":
            close_lists()
        if b.kind == "scene":
            out.append('<p class="scene" role="separator">%s</p>' % esc(scene))
            after_break = True
            continue
        body = runs_html(b.runs, note_ref)
        if b.kind == "h":
            out.append("<h3>%s</h3>" % body)
            after_break = True
        elif b.kind == "li":
            tag = "ol" if b.ordered else "ul"
            close_lists(b.level)
            while len(list_stack) < b.level + 1:
                list_stack.append(tag)
                out.append("<%s>" % tag)
            out.append("<li>%s</li>" % body)
            after_break = True
        elif b.kind == "quote":
            out.append("<blockquote><p>%s</p></blockquote>" % body)
            after_break = True
        else:
            out.append('<p class="first">%s</p>' % body if after_break else "<p>%s</p>" % body)
            after_break = False
    close_lists()
    return "\n".join(out)


def _chapter_html(idx, chapter, scene="* * *") -> str:
    """One chapter as a <section>, with its footnotes at the end."""
    cid = "ch%d" % (idx + 1)

    def note_ref(n):
        return '<sup class="note-ref"><a href="#%sfn%d" id="%sref%d">%d</a></sup>' % (cid, n, cid, n, n)

    out = ['<section class="chapter" id="%s">' % cid]
    if chapter.label:
        out.append('<p class="chapter-label">%s</p>' % esc(chapter.label))
    out.append('<h2 class="chapter-title">%s</h2>' % esc(chapter.title))
    out.append(blocks_html(chapter.blocks, note_ref, scene))
    if chapter.footnotes:
        out.append('<aside class="footnotes"><ol>')
        for i, note in enumerate(chapter.footnotes, 1):
            out.append('<li id="%sfn%d">%s <a class="note-back" href="#%sref%d">\u21a9</a></li>' % (
                cid, i, esc(note), cid, i))
        out.append("</ol></aside>")
    out.append("</section>")
    return "\n".join(out)


_SHARED_CSS = """
.entity { border-bottom: 1px dotted currentColor; }
.entity.char, .entity.group { font-weight: 600; }
.entity.loc, .entity.item, .entity.lore { font-style: italic; }
.twist { font-weight: 600; color: #2e7d32; }
.foreshadow { font-style: italic; color: #78559a; }
.epistemic { font-style: italic; color: #666; }
.epistemic-kind { font-variant: small-caps; }
.note-ref { font-size: 0.7em; line-height: 0; }
.note-ref a, .note-back { text-decoration: none; color: inherit; }
blockquote { margin: 0.8em 1.5em; }
ul, ol { margin: 0.6em 0 0.6em 1.5em; padding: 0; }
"""


def document(project_title, author_name, chapters, lang="en", title_page=True) -> str:
    """The standalone, self-contained .html export (also used for the preview)."""
    css = font_faces() + _SHARED_CSS + """
html { background: #f4f1ea; }
body { font-family: 'Crimson Pro', Georgia, 'Times New Roman', serif; font-size: 1.2rem; line-height: 1.6;
       color: #222; max-width: 34em; margin: 0 auto; padding: 3em 1.5em 6em; background: #fffdf8;
       box-shadow: 0 0 30px rgba(0,0,0,0.06); text-rendering: optimizeLegibility; }
header.title-page { text-align: center; margin: 4em 0 6em; }
header.title-page h1 { font-weight: 400; font-size: 2.4em; letter-spacing: 0.04em; margin: 0 0 0.3em; }
header.title-page .author { font-style: italic; color: #555; font-size: 1.15em; }
.chapter { margin-top: 5em; }
.chapter-label { text-align: center; font-variant: small-caps; letter-spacing: 0.12em; color: #777; margin: 0; }
h2.chapter-title { text-align: center; font-weight: 400; font-size: 1.7em; margin: 0.2em 0 1.6em; }
h3 { text-align: center; font-weight: 600; font-size: 1.05em; margin: 1.6em 0 0.8em; }
p { margin: 0; text-indent: 1.4em; }
p.first, p.scene { text-indent: 0; }
p.scene { text-align: center; margin: 1em 0; letter-spacing: 0.3em; color: #777; }
.footnotes { margin-top: 2.5em; padding-top: 0.6em; border-top: 1px solid #ddd; font-size: 0.85em; color: #555; }
.footnotes ol { margin-left: 1.2em; }
@media (prefers-color-scheme: dark) {
  html { background: #161513; } body { background: #1f1d1a; color: #ddd8cc; box-shadow: none; }
  .chapter-label, p.scene, header.title-page .author, .footnotes { color: #a39d90; }
}
"""
    out = ["<!DOCTYPE html>", '<html lang="%s">' % esc(lang), "<head>", '<meta charset="utf-8" />',
           '<meta name="viewport" content="width=device-width, initial-scale=1" />',
           "<title>%s</title>" % esc(project_title), "<style>%s</style>" % css, "</head>", "<body>"]
    if title_page:
        out.append('<header class="title-page"><h1>%s</h1>%s</header>' % (
            esc(project_title), '<div class="author">%s</div>' % esc(author_name) if author_name else ""))
    for idx, ch in enumerate(chapters):
        out.append(_chapter_html(idx, ch))
    out += ["</body>", "</html>"]
    return "\n".join(out)


_HYPHEN_LANGS = {"en": "en_US", "hu": "hu_HU", "pl": "pl_PL"}
_LONG_WORD = re.compile(r"[^\W\d_]{6,}")


@functools.lru_cache(maxsize=4)
def _hyphenator(lang: str):
    try:
        import pyphen
        name = _HYPHEN_LANGS.get(lang)
        return pyphen.Pyphen(lang=name, left=3, right=3) if name else None
    except Exception:
        return None


def _hyphenated(chapters, lang):
    """Copies of the chapters with soft hyphens in long words, so justified
    print text can break words instead of stretching spaces (Chromium in
    Electron ships no hyphenation dictionaries of its own)."""
    dic = _hyphenator(lang)
    if dic is None:
        return chapters

    def soft(text):
        return _LONG_WORD.sub(lambda m: dic.inserted(m.group(0), hyphen="­"), text)

    out = []
    for ch in chapters:
        blocks = []
        for b in ch.blocks:
            runs = [dataclasses.replace(r, text=soft(r.text)) if r.kind not in ("br", "fnref") else r
                    for r in b.runs] if b.kind in ("p", "quote") else b.runs
            blocks.append(dataclasses.replace(b, runs=runs))
        out.append(dataclasses.replace(ch, blocks=blocks))
    return out


def _surname(author_name: str) -> str:
    parts = (author_name or "").split()
    return parts[-1] if parts else ""


def print_book(project_title, author_name, chapters, lang="en", trim="standard",
               font_size=None, gutter=None, outer=None) -> str:
    """A trim-size book for print: mirrored margins (the gutter on the binding
    side of every page), page numbers, justified and hyphenated text, each
    chapter on a new page."""
    width, height, top, bottom = TRIM_SIZES.get(trim, TRIM_SIZES["standard"])
    font_size = font_size or 11
    gutter = gutter or 0.5
    outer = outer or 0.5
    css = font_faces() + _SHARED_CSS + """
@page { size: %(w)sin %(h)sin; margin: %(top)sin %(outer)sin %(bottom)sin %(outer)sin;
        @bottom-center { content: counter(page); font-family: 'Crimson Pro', serif; font-size: %(folio)spt; } }
@page :left { margin-left: %(outer)sin; margin-right: %(gutter)sin; }
@page :right { margin-left: %(gutter)sin; margin-right: %(outer)sin; }
@page front { @bottom-center { content: none; } }
html, body { margin: 0; padding: 0; }
body { font-family: 'Crimson Pro', Georgia, serif; font-size: %(fs)spt; line-height: 1.32; color: #000;
       text-align: justify; hyphens: manual; widows: 2; orphans: 2; font-kerning: normal;
       font-variant-ligatures: common-ligatures; }
.title-page { page: front; break-after: page; height: %(content_h)sin; display: flex; flex-direction: column;
              justify-content: center; text-align: center; }
.title-page h1 { font-weight: 400; font-size: 2.1em; letter-spacing: 0.04em; margin: 0 0 0.6em; hyphens: none; }
.title-page .author { font-style: italic; font-size: 1.15em; }
.blank-page { page: front; break-after: page; height: 1px; }
.chapter { break-before: page; }
.chapter-label { text-align: center; font-variant: small-caps; letter-spacing: 0.14em; margin: %(sink)sin 0 0; text-indent: 0; }
h2.chapter-title { text-align: center; font-weight: 400; font-size: 1.55em; margin: 0.15em 0 1.4em; hyphens: none;
                   break-after: avoid; }
.chapter-label + h2.chapter-title { margin-top: 0.15em; }
.chapter > h2.chapter-title:first-child { margin-top: %(sink)sin; }
h3 { text-align: center; font-weight: 600; font-size: 1em; margin: 1.2em 0 0.6em; break-after: avoid; }
p { margin: 0; text-indent: 1.2em; }
p.first, p.scene { text-indent: 0; }
p.scene { text-align: center; margin: 0.9em 0; letter-spacing: 0.3em; break-after: avoid; }
.footnotes { margin-top: 1.4em; padding-top: 0.4em; border-top: 0.5pt solid #000; font-size: 0.82em;
             text-align: left; }
.footnotes ol { margin: 0 0 0 1.2em; }
a { color: inherit; text-decoration: none; }
""" % {"w": width, "h": height, "top": top, "bottom": bottom, "outer": outer, "gutter": gutter,
       "fs": font_size, "folio": max(7, round(font_size * 0.8, 1)), "sink": round(height * 0.17, 2),
       "content_h": round(height - top - bottom - 0.05, 2)}
    out = ["<!DOCTYPE html>", '<html lang="%s">' % esc(lang), "<head>", '<meta charset="utf-8" />',
           "<title>%s</title>" % esc(project_title), "<style>%s</style>" % css, "</head>", "<body>",
           '<div class="title-page"><h1>%s</h1>%s</div>' % (
               esc(project_title), '<div class="author">%s</div>' % esc(author_name) if author_name else ""),
           # the back of the title page stays blank, so chapter one opens on a right-hand page
           '<div class="blank-page"></div>']
    for idx, ch in enumerate(_hyphenated(chapters, lang)):
        out.append(_chapter_html(idx, ch))
    out += ["</body>", "</html>"]
    return "\n".join(out)


def print_manuscript(project_title, author_name, chapters, lang="en", word_count=0) -> str:
    """Standard manuscript format for submissions: US Letter, 1-inch margins,
    12 pt Times, double-spaced, "Surname / TITLE / page" in the header, and
    "#" for scene breaks."""
    header = "%s / %s / " % (_surname(author_name), (project_title or "").upper()) if author_name \
        else "%s / " % (project_title or "").upper()
    css = _SHARED_CSS + """
@page { size: 8.5in 11in; margin: 1in;
        @top-right { content: %(header)s counter(page); font-family: 'Times New Roman', Times, 'Liberation Serif', serif;
                     font-size: 12pt; } }
@page front { @top-right { content: none; } }
html, body { margin: 0; padding: 0; }
body { font-family: 'Times New Roman', Times, 'Liberation Serif', serif; font-size: 12pt; line-height: 2;
       color: #000; text-align: left; widows: 2; orphans: 2; }
.title-page { page: front; break-after: page; height: 8.9in; position: relative; }
.title-page .contact { line-height: 1.2; }
.title-page .count { position: absolute; top: 0; right: 0; line-height: 1.2; }
.title-page .center { position: absolute; top: 3.6in; left: 0; right: 0; text-align: center; }
.title-page h1 { font-size: 12pt; font-weight: normal; text-transform: uppercase; margin: 0; }
.chapter { break-before: page; padding-top: 2.4in; }
.chapter-label, h2.chapter-title { text-align: center; font-size: 12pt; font-weight: normal; margin: 0; }
h2.chapter-title { margin-bottom: 1em; }
h3 { font-size: 12pt; font-weight: normal; text-align: center; margin: 0; }
p { margin: 0; text-indent: 0.5in; }
p.scene { text-indent: 0; text-align: center; margin: 0; letter-spacing: 0; }
strong { font-weight: bold; }
em { font-style: italic; }
.footnotes { margin-top: 1em; border-top: 1px solid #000; line-height: 1.5; font-size: 11pt; }
a { color: inherit; text-decoration: none; }
""" % {"header": _css_string(header)}
    words = "about %s words" % format(int(round(word_count, -2) if word_count >= 1000 else word_count), ",")
    out = ["<!DOCTYPE html>", '<html lang="%s">' % esc(lang), "<head>", '<meta charset="utf-8" />',
           "<title>%s</title>" % esc(project_title), "<style>%s</style>" % css, "</head>", "<body>",
           '<div class="title-page"><div class="contact">%s</div><div class="count">%s</div>'
           '<div class="center"><h1>%s</h1>%s</div></div>' % (
               esc(author_name), esc(words), esc(project_title),
               "<div>by %s</div>" % esc(author_name) if author_name else "")]
    for idx, ch in enumerate(chapters):
        out.append(_chapter_html(idx, ch, scene="#"))
    out += ["</body>", "</html>"]
    return "\n".join(out)

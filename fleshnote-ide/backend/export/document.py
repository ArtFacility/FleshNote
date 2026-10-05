"""Chapter HTML as a small block model that every export format renders from.

A chapter file holds the editor's HTML. After export/strip.py has resolved the
FleshNote markers, parse_blocks() reads it with lxml into blocks (paragraphs,
headings, scene breaks, list items, quotes), each a list of runs carrying
inline formatting. Typography is applied to the runs' text, never to markup,
so attribute values and tags stay intact.
"""
import html
import re
from dataclasses import dataclass, field

from lxml import html as lxml_html

from export.typography import typeset

_MARK_TAGS = {
    "em": "i", "i": "i", "strong": "b", "b": "b", "u": "u",
    "s": "s", "strike": "s", "del": "s", "code": "code", "sup": "sup", "sub": "sub",
}
_HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
_CONTAINERS = {"div", "section", "article", "main", "body", "table", "tbody", "thead", "tr", "td", "th", "figure"}

# A paragraph made only of these characters is a scene break ("* * *", "#", "---").
_SCENE_CHARS = set("*#~-—–⁂·•◆◇❖✦ ")


@dataclass
class Run:
    text: str = ""
    marks: frozenset = frozenset()
    href: str | None = None
    kind: str = "text"   # text | br | fnref | entity | twist | epistemic
    data: dict = field(default_factory=dict)


@dataclass
class Block:
    kind: str            # p | h | scene | li | quote
    runs: list = field(default_factory=list)
    level: int = 0       # heading level, or list nesting depth
    ordered: bool = False
    number: int = 0      # position within an ordered list

    @property
    def plain(self) -> str:
        return "".join(r.text for r in self.runs if r.kind != "fnref")


@dataclass
class Chapter:
    title: str
    blocks: list
    footnotes: list = field(default_factory=list)
    label: str = ""      # a heading the chapter text opened with, e.g. "Chapter 1"


def _tag(el) -> str:
    return el.tag.lower() if isinstance(el.tag, str) else ""


def _inline(el, marks, href, ref, out):
    """Appends the runs inside el (not its tail)."""
    _text_run(el.text, marks, href, ref, out)
    for child in el:
        _inline_child(child, marks, href, ref, out)
        _text_run(child.tail, marks, href, ref, out)


def _text_run(t, marks, href, ref, out):
    if t:
        kind, data = ref if ref else ("text", {})
        out.append(Run(t.replace("\r", "").replace("\n", " "), marks, href, kind, data))


def _inline_child(child, marks, href, ref, out):
    """Appends the runs of one inline element (not its tail)."""
    tag = _tag(child)
    if tag == "br":
        out.append(Run("\n", kind="br"))
    elif tag == "fn-ref":
        out.append(Run("", kind="fnref", data={"n": int(child.get("n") or 0)}))
    elif tag in ("img", "script", "style") or not tag:
        pass
    else:
        m = marks | {_MARK_TAGS[tag]} if tag in _MARK_TAGS else marks
        h = child.get("href") if tag == "a" else href
        r = ref
        if tag == "x-ref":
            r = (child.get("kind") or "entity", {"type": child.get("type") or "", "desc": child.get("desc") or ""})
        _inline(child, m, h, r, out)


def _is_scene(runs) -> bool:
    text = "".join(r.text for r in runs).strip()
    return bool(text) and len(text) <= 12 and all(c in _SCENE_CHARS for c in text)


def _has_content(runs) -> bool:
    return any(r.kind == "fnref" or r.text.strip() for r in runs)


def _paragraph(el, kind, out):
    runs = []
    _inline(el, frozenset(), None, None, runs)
    if _is_scene(runs):
        out.append(Block("scene"))
    elif _has_content(runs):
        out.append(Block(kind, runs))


def _list(el, out, depth):
    ordered = _tag(el) == "ol"
    number = 0
    for li in el:
        if _tag(li) != "li":
            continue
        number += 1
        runs, nested = [], []
        if li.text and li.text.strip():
            runs.append(Run(li.text.strip()))
        for child in li:
            tag = _tag(child)
            if tag in ("ul", "ol"):
                nested.append(child)
            elif tag == "p":
                if runs:
                    runs.append(Run("\n", kind="br"))
                _inline(child, frozenset(), None, None, runs)
            else:
                holder = []
                _inline(child, frozenset(), None, None, holder)
                runs.extend(holder)
            if child.tail and child.tail.strip():
                runs.append(Run(child.tail.strip()))
        if _has_content(runs):
            out.append(Block("li", runs, level=depth, ordered=ordered, number=number))
        for sub in nested:
            _list(sub, out, depth + 1)


def _blocks(container, out, quote=False):
    pending = []

    def flush():
        if _has_content(pending):
            if _is_scene(pending):
                out.append(Block("scene"))
            else:
                out.append(Block("quote" if quote else "p", pending[:]))
        pending.clear()

    if container.text:
        pending.append(Run(container.text.replace("\n", " ")))
    for child in container:
        tag = _tag(child)
        if tag in ("p", "pre"):
            flush()
            _paragraph(child, "quote" if quote else "p", out)
        elif tag in _HEADINGS:
            flush()
            runs = []
            _inline(child, frozenset(), None, None, runs)
            if _has_content(runs):
                out.append(Block("h", runs, level=int(tag[1])))
        elif tag == "hr":
            flush()
            out.append(Block("scene"))
        elif tag in ("ul", "ol"):
            flush()
            _list(child, out, 0)
        elif tag == "blockquote":
            flush()
            _blocks(child, out, quote=True)
        elif tag in _CONTAINERS:
            flush()
            _blocks(child, out, quote)
        elif tag:
            _inline_child(child, frozenset(), None, None, pending)
        if child.tail:
            pending.append(Run(child.tail.replace("\n", " ")))
    flush()


def _plain_text_to_html(text: str) -> str:
    """Chapter files from before the editor stored HTML are plain text:
    blank lines separate paragraphs and "# " lines are headings."""
    parts = []
    for para in re.split(r"\n{2,}", text.strip()):
        para = para.strip()
        if not para:
            continue
        m = re.match(r"^(#{1,6})\s+(.+)$", para)
        if m:
            parts.append("<h%d>%s</h%d>" % (len(m.group(1)), html.escape(m.group(2).strip()), len(m.group(1))))
        else:
            parts.append("<p>%s</p>" % html.escape(para).replace("\n", "<br>"))
    return "".join(parts)


def parse_blocks(chapter_html: str) -> list:
    if not chapter_html or not chapter_html.strip():
        return []
    if not re.search(r"<(p|h[1-6]|br|ul|ol|hr|div|blockquote)[\s>/]", chapter_html, re.IGNORECASE):
        chapter_html = _plain_text_to_html(chapter_html)
    root = lxml_html.fragment_fromstring(chapter_html, create_parent="div")
    out = []
    _blocks(root, out)
    return out


def _trim(runs):
    """Drops whitespace at the edges of a block and around line breaks."""
    texts = [i for i, r in enumerate(runs) if r.kind not in ("br", "fnref")]
    if texts:
        runs[texts[0]].text = runs[texts[0]].text.lstrip()
        runs[texts[-1]].text = runs[texts[-1]].text.rstrip()
    for i, r in enumerate(runs):
        if r.kind == "br":
            if i > 0 and runs[i - 1].kind not in ("br", "fnref"):
                runs[i - 1].text = runs[i - 1].text.rstrip()
            if i + 1 < len(runs) and runs[i + 1].kind not in ("br", "fnref"):
                runs[i + 1].text = runs[i + 1].text.lstrip()
    return [r for r in runs if r.text or r.kind in ("br", "fnref")]


def typeset_blocks(blocks, lang: str = "en"):
    for block in blocks:
        prev = ""
        for run in block.runs:
            if run.kind == "br":
                prev = "\n"
            elif run.kind != "fnref" and run.text:
                run.text = typeset(run.text, prev, lang)
                prev = run.text[-1]
        block.runs = _trim(block.runs)
    # merge consecutive scene breaks
    out = []
    for block in blocks:
        if block.kind == "scene" and out and out[-1].kind == "scene":
            continue
        out.append(block)
    while out and out[0].kind == "scene":
        out.pop(0)
    while out and out[-1].kind == "scene":
        out.pop()
    return out


def _norm(text: str) -> str:
    return re.sub(r"[\W_]+", " ", text).strip().casefold()


def build_chapter(title: str, chapter_html: str, footnotes: list, lang: str = "en") -> Chapter:
    """Blocks for one chapter. A heading the text opens with (scaffolded
    chapters start with "# Chapter 1") is not repeated under the chapter title:
    it is dropped when it says the same thing, otherwise kept as a label."""
    blocks = typeset_blocks(parse_blocks(chapter_html), lang)
    title = (title or "").strip()
    label = ""
    if blocks and blocks[0].kind == "h":
        first = blocks.pop(0).plain.strip()
        if not title:
            title = first
        elif _norm(first) and _norm(first) not in _norm(title):
            if _norm(title) in _norm(first):
                title = first
            else:
                label = first
    return Chapter(title=title, blocks=blocks, footnotes=footnotes, label=label)

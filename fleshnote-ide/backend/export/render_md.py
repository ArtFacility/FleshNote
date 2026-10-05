import datetime
import json
import re

_SPECIAL = re.compile(r"([\\`*_\[\]<>])")
_MARKS = (("code", "`", "`"), ("s", "~~", "~~"), ("b", "**", "**"), ("i", "*", "*"))


def _escape(text: str) -> str:
    return _SPECIAL.sub(r"\\\1", text)


def _wrap(text: str, left: str, right: str) -> str:
    """Wraps text in emphasis markers, keeping edge spaces outside them."""
    core = text.strip()
    if not core:
        return text
    lead = text[: len(text) - len(text.lstrip())]
    trail = text[len(text.rstrip()):]
    return lead + left + core + right + trail


def runs_md(runs, note_ref, full: bool) -> str:
    parts = []
    for r in runs:
        if r.kind == "br":
            parts.append("  \n")
            continue
        if r.kind == "fnref":
            parts.append(note_ref(r.data.get("n", 0)))
            continue
        t = r.text if "code" in r.marks else _escape(r.text)
        for mark, left, right in _MARKS:
            if mark in r.marks:
                t = _wrap(t, left, right)
        if r.href:
            t = "[%s](%s)" % (t, r.href.replace(")", "%29"))
        if full and r.kind == "entity":
            t = _wrap(t, "**", "**")
        elif full and r.kind == "epistemic":
            t = "[%s: %s]" % (r.data.get("type", ""), t)
        parts.append(t)
    return "".join(parts)


def _block_start(text: str) -> str:
    """Escapes a paragraph start that Markdown would read as a heading, list or quote."""
    return re.sub(r"^(\s*)([#>+-]|\d+\.)(\s)", r"\1\\\2\3", text)


def render(project_title, author_name, chapters, content_mode) -> str:
    full = content_mode == "full"
    out = ["---", "title: %s" % json.dumps(project_title, ensure_ascii=False),
           "author: %s" % json.dumps(author_name or "", ensure_ascii=False),
           'date: "%s"' % datetime.date.today().isoformat(), "---", ""]
    notes = []
    for ch in chapters:
        offset = len(notes)
        notes.extend(ch.footnotes)

        def ref(n, offset=offset):
            return "[^%d]" % (offset + n)

        out += ["# %s" % _escape(ch.title), ""]
        if ch.label:
            out += ["*%s*" % _escape(ch.label), ""]
        for i, b in enumerate(ch.blocks):
            if b.kind == "scene":
                out.append("* * *")
            elif b.kind == "h":
                out.append("### %s" % runs_md(b.runs, ref, full))
            elif b.kind == "li":
                bullet = "%d. " % b.number if b.ordered else "- "
                out.append("  " * b.level + bullet + runs_md(b.runs, ref, full))
                if i + 1 < len(ch.blocks) and ch.blocks[i + 1].kind == "li":
                    continue  # keep a list's items together
            elif b.kind == "quote":
                out.append("\n".join("> " + line for line in runs_md(b.runs, ref, full).split("\n")))
            else:
                out.append(_block_start(runs_md(b.runs, ref, full)))
            out.append("")
    if notes:
        out += ["---", ""]
        for i, note in enumerate(notes, 1):
            out.append("[^%d]: %s" % (i, _escape(note)))
    return "\n".join(out).rstrip() + "\n"

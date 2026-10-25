import re

# Double quotes per manuscript language: (opening, closing).
_DOUBLE_QUOTES = {
    "hu": ("„", "”"),   # „…”
    "pl": ("„", "”"),   # „…”
    "ar": ("«", "»"),   # «…»
}
_DEFAULT_DOUBLE = ("“", "”")  # “…”

# After these characters a quote opens rather than closes.
_OPENING_CONTEXT = set(" \t\n ([{—–-/“‘„«")

# Words that start with an apostrophe ('tis, 'em, '90s) take ’, not an opening ‘.
_ELISION = re.compile(r"(?:tis|twas|twere|em|til|cause|bout|round|n)\b|\d", re.IGNORECASE)


def typeset(text: str, prev: str = "", lang: str = "en") -> str:
    """Book typography for one run of plain text (never markup).

    prev is the character printed just before this run ("" at the start of a
    paragraph), so a quote at the edge of an italic run still opens or closes
    correctly.

    - straight quotes become curly quotes for the manuscript language
    - "--" and "---" become an em dash, "..." an ellipsis
    - runs of spaces collapse to one space
    """
    if not text:
        return text
    text = text.replace("---", "—").replace("--", "—").replace("...", "…")
    text = re.sub(r" {2,}", " ", text)
    if '"' not in text and "'" not in text:
        return text
    open_d, close_d = _DOUBLE_QUOTES.get(lang, _DEFAULT_DOUBLE)
    out = []
    for i, ch in enumerate(text):
        before = out[-1] if out else prev
        opens = not before or before in _OPENING_CONTEXT
        if ch == '"':
            out.append(open_d if opens else close_d)
        elif ch == "'":
            if not opens or _ELISION.match(text, i + 1):
                out.append("’")
            else:
                out.append("‘")
        else:
            out.append(ch)
    return "".join(out)


def apply_typography(text: str, lang: str = "en") -> str:
    """typeset() for a standalone plain string, such as a footnote."""
    return typeset(text, "", lang)

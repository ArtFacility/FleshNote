import re

def apply_typography(text: str) -> str:
    """
    Applies standard typographic replacements to the text, matching the EXPORT_GUIDELINES.
    1. Straight quotes to curly quotes (smart quotes)
    2. Double hyphen -- to em-dash —
    3. Three dots ... to ellipsis …
    """
    if not text:
        return text

    # Handle em-dashes
    text = text.replace("--", "—")
    # Handle ellipsis
    text = text.replace("...", "…")

    # Handle smart quotes
    # Replace " at start of string or following whitespace/punctuation with opening quote
    text = re.sub(r'(^|[\s\(\[\{])"', r'\1“', text)
    # Replace remaining " with closing quote
    text = text.replace('"', '”')

    # Replace ' at start of string or following whitespace/punctuation with opening single quote
    text = re.sub(r"(^|[\s\(\[\{])'", r"\1‘", text)
    # Replace remaining ' with closing single quote (also used for apostrophes)
    text = text.replace("'", "’")

    return text

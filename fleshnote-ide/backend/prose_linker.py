"""
Links names in chapter files: every whole-word occurrence of a known spelling
becomes an entity marker, {{char:<id>|Boka}}.

Chapter files are HTML with {{type:id|text}} markers for entity links,
foreshadowing, knowledge and the like. Only the text between them is touched:
tags (attributes included) and every existing marker are left as they are, so
a name inside a foreshadow's text is never wrapped a second time.

Matching is case-sensitive and whole-word, longest spelling first, so
"Geréb Dezső" wins over "Geréb", and an inflected "Bokának" only links when
that exact spelling is one of the names.
"""
import html
import re

# Entity type → the short form used in chapter markers.
MARKER_TYPE = {"character": "char", "location": "loc", "lore": "item", "group": "group"}

# Existing markers and tags, matched in one pass so a marker that contains
# tags ({{foreshadow:3|a <em>glint</em>}}) is skipped as a whole.
_PROTECTED = re.compile(r"\{\{[^}]*\}\}|<[^>]*>")


class NameLinker:
    def __init__(self, spellings: dict[str, tuple[str, str]]):
        """`spellings`: name as written → (entity type, entity id)."""
        usable = {}
        for name, (etype, eid) in spellings.items():
            name = name.strip()
            short = MARKER_TYPE.get(etype)
            # A marker's text cannot hold "|" or "}"; a one-letter name links noise.
            if not short or len(name) < 2 or any(c in name for c in "|}{"):
                continue
            usable[html.escape(name, quote=False)] = f"{{{{{short}:{eid}|"
        self._open = usable
        if usable:
            alternation = "|".join(re.escape(n) for n in sorted(usable, key=len, reverse=True))
            self._pattern = re.compile(rf"(?<![\w&])(?:{alternation})(?!\w)")
        else:
            self._pattern = None

    def link(self, text: str) -> tuple[str, int]:
        """Returns the linked text and how many links were added."""
        if not self._pattern or not text:
            return text, 0
        out = []
        count = 0
        last = 0

        def link_plain(plain: str) -> str:
            nonlocal count

            def wrap(m):
                nonlocal count
                count += 1
                return f"{self._open[m.group(0)]}{m.group(0)}}}}}"

            return self._pattern.sub(wrap, plain)

        for m in _PROTECTED.finditer(text):
            out.append(link_plain(text[last:m.start()]))
            out.append(m.group(0))
            last = m.end()
        out.append(link_plain(text[last:]))
        return "".join(out), count


def spellings_for(entities: list[dict], blocked: set[str]) -> dict[str, tuple[str, str]]:
    """
    Collects the spellings to link from entities shaped
    {"id", "type", "name", "aliases"}. A spelling two entities share, or one in
    `blocked` (lower-cased names the project already uses), is left out: it
    can't be told which one is meant.
    """
    owners: dict[str, set] = {}
    by_spelling: dict[str, tuple[str, str]] = {}
    for ent in entities:
        for spelling in [ent["name"], *(ent.get("aliases") or [])]:
            spelling = (spelling or "").strip()
            if not spelling:
                continue
            owners.setdefault(spelling, set()).add(ent["id"])
            by_spelling[spelling] = (ent["type"], ent["id"])
    return {
        s: target for s, target in by_spelling.items()
        if len(owners[s]) == 1 and s.lower() not in blocked
    }

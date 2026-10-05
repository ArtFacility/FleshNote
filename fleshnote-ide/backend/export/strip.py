import html
import re
import sqlite3

# Patterns matching chapters.py markers: {{char:2|Sophia}}
# IDs are UUIDs since the UUID migration (legacy numeric IDs still match).
_FLESHNOTE_MARKER_PATTERN = re.compile(r'\{\{(char|loc|item|lore|group|quicknote|secret|annotation):([^:|}]+)\|([^}]+)\}\}')
_TWIST_MARKER_PATTERN = re.compile(r'\{\{(twist|foreshadow):([^:|}]+)\|([^}]+)\}\}')
_KNOWLEDGE_REL_PATTERN = re.compile(r'\{\{(knowledge|relationship|milestone):([^:|}]+):([^:|}]+)\|([^}]+)\}\}')
_TIME_MARKER_PATTERN = re.compile(r'\{\{time:[^:|}]+:[^:|}]+\|([^}]*)\}\}')
_EPISTEMIC_PATTERN = re.compile(r'\{(secret|knows|believes):([^}]+)\}')
_HTML_TAG_PATTERN = re.compile(r'<[^>]+>')
_TODO_PATTERN = re.compile(r'#TODO.*?(?=\u200B|</p>|<br>|<br/>|\n|$)', re.IGNORECASE)

# ── Raw-span normalization ──────────────────────────────────────────────────
# The chapter save pipeline (chapters.py) deliberately leaves a mark span as
# raw HTML whenever its inner content contains tags (e.g. a time span holding a
# <br>, or an entity span wrapping a nested time marker). Those raw spans
# round-trip fine in the editor but would slip past the marker patterns above,
# so exports first fold them back into marker form, innermost-first.

_ENTITY_TYPE_TO_SHORT = {
    "character": "char",
    "location": "loc",
    "lore": "item",
}

# Inner capture allows anything except a nested span, so replacement can run
# innermost-first and iterate outward.
_INNER = r'((?:(?!</?span).)*?)'
_RAW_TIME_SPAN = re.compile(
    r'<span[^>]*?data-time-id="([^"]+)"[^>]*?data-color-index="([^"]+)"[^>]*?>' + _INNER + r'</span>', re.DOTALL)
_RAW_ENTITY_SPAN = re.compile(
    r'<span[^>]*?data-entity-type="([^"]+)"[^>]*?data-entity-id="([^"]+)"[^>]*?>' + _INNER + r'</span>', re.DOTALL)
_RAW_KNOWLEDGE_SPAN = re.compile(
    r'<span[^>]*?data-knowledge-id="([^"]+)"[^>]*?data-character-id="([^"]+)"[^>]*?>' + _INNER + r'</span>', re.DOTALL)
_RAW_RELATIONSHIP_SPAN = re.compile(
    r'<span[^>]*?data-relationship-id="([^"]+)"[^>]*?data-character-id="([^"]+)"[^>]*?>' + _INNER + r'</span>', re.DOTALL)
_RAW_MILESTONE_SPAN = re.compile(
    r'<span[^>]*?data-milestone-id="([^"]+)"[^>]*?data-group-id="([^"]+)"[^>]*?>' + _INNER + r'</span>', re.DOTALL)
_RAW_TWIST_SPAN = re.compile(
    r'<span[^>]*?data-twist-type="([^"]+)"[^>]*?data-twist-id="([^"]+)"[^>]*?>' + _INNER + r'</span>', re.DOTALL)


def _normalize_raw_spans(text: str) -> str:
    """Fold the save pipeline's raw-span fallback forms back into {{marker}} form."""
    def entity_repl(m):
        short = _ENTITY_TYPE_TO_SHORT.get(m.group(1), m.group(1))
        return '{{%s:%s|%s}}' % (short, m.group(2), m.group(3))

    for _ in range(5):  # bounded by realistic span nesting depth
        new = _RAW_TIME_SPAN.sub(lambda m: '{{time:%s:%s|%s}}' % (m.group(1), m.group(2), m.group(3)), text)
        new = _RAW_ENTITY_SPAN.sub(entity_repl, new)
        new = _RAW_KNOWLEDGE_SPAN.sub(lambda m: '{{knowledge:%s:%s|%s}}' % (m.group(1), m.group(2), m.group(3)), new)
        new = _RAW_RELATIONSHIP_SPAN.sub(lambda m: '{{relationship:%s:%s|%s}}' % (m.group(1), m.group(2), m.group(3)), new)
        new = _RAW_MILESTONE_SPAN.sub(lambda m: '{{milestone:%s:%s|%s}}' % (m.group(1), m.group(2), m.group(3)), new)
        new = _RAW_TWIST_SPAN.sub(lambda m: '{{%s:%s|%s}}' % (m.group(1), m.group(2), m.group(3)), new)
        if new == text:
            return new
        text = new
    return text

def _resolve_annotation_content(db_conn, entity_id: str, short_type: str) -> str:
    cursor = db_conn.cursor()
    try:
        if short_type == 'annotation':
            cursor.execute("SELECT content FROM annotations WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
        elif short_type in ('item', 'lore'):
            cursor.execute("SELECT description FROM lore_entities WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
    except Exception:
        pass
    return ""


def strip_todo(text: str) -> tuple[str, int]:
    """Removes #TODO and following text until end of paragraph/line."""
    todos_found = len(_TODO_PATTERN.findall(text))
    text = _TODO_PATTERN.sub('', text)
    return text, todos_found


def resolve_markers(text: str, db_conn, mode: str) -> tuple[str, list[str]]:
    """Turns a chapter file's markers into plain HTML for the export parser.

    mode is 'prose' (links become plain text), 'notes' (annotations become
    footnotes) or 'full' (annotations become footnotes and entity, twist and
    epistemic links stay visible). The text a marker wraps is always kept: a
    quick note or annotation marks a passage of the manuscript, and only the
    note itself is left out.

    Footnote references come out as <fn-ref n="1"></fn-ref>, numbered per
    chapter, and visible links as <x-ref kind=".." type="..">text</x-ref>;
    export/document.py reads both. Returns (html, footnote texts).
    """
    text = _normalize_raw_spans(text)
    text = _TIME_MARKER_PATTERN.sub(r'\1', text)
    text = _KNOWLEDGE_REL_PATTERN.sub(r'\4', text)
    full = mode == 'full'
    notes: list[str] = []

    def twist(m):
        if not full:
            return m.group(3)
        return '<x-ref kind="twist" type="%s">%s</x-ref>' % (m.group(1), m.group(3))

    def epistemic(m):
        if not full:
            return ''
        return '<x-ref kind="epistemic" type="%s">%s</x-ref>' % (m.group(1), m.group(2))

    def marker(m):
        stype, sid, inner = m.group(1), m.group(2), m.group(3)
        if stype == 'annotation':
            if mode == 'prose':
                return inner
            notes.append(_resolve_annotation_content(db_conn, sid, stype) or html.unescape(_HTML_TAG_PATTERN.sub('', inner)))
            return '%s<fn-ref n="%d"></fn-ref>' % (inner, len(notes))
        if not full or stype == 'quicknote':
            return inner
        desc = _resolve_annotation_content(db_conn, sid, stype)
        return '<x-ref kind="entity" type="%s" desc="%s">%s</x-ref>' % (stype, html.escape(desc or '', quote=True), inner)

    text = _TWIST_MARKER_PATTERN.sub(twist, text)
    text = _EPISTEMIC_PATTERN.sub(epistemic, text)
    text = _FLESHNOTE_MARKER_PATTERN.sub(marker, text)
    return text, notes

import re
import sqlite3

# Patterns matching chapters.py markers: {{char:2|Sophia}}
_FLESHNOTE_MARKER_PATTERN = re.compile(r'\{\{(char|loc|item|lore|group|quicknote|secret|annotation):(\d+)\|([^}]+)\}\}')
_TWIST_MARKER_PATTERN = re.compile(r'\{\{(twist|foreshadow):(\d+)\|([^}]+)\}\}')
_KNOWLEDGE_REL_PATTERN = re.compile(r'\{\{(knowledge|relationship):(\d+):(\d+)\|([^}]+)\}\}')
_TIME_MARKER_PATTERN = re.compile(r'\{\{time:\d+:\d+\|([^}]*)\}\}')
_EPISTEMIC_PATTERN = re.compile(r'\{(secret|knows|believes):([^}]+)\}')
_HTML_TAG_PATTERN = re.compile(r'<[^>]+>')
_TODO_PATTERN = re.compile(r'#TODO.*?(?=\u200B|</p>|<br>|<br/>|\n|$)', re.IGNORECASE)

def _resolve_entity_name(db_conn, entity_id: str, short_type: str) -> str:
    cursor = db_conn.cursor()
    try:
        if short_type == 'char':
            cursor.execute("SELECT name FROM characters WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
        elif short_type == 'loc':
            cursor.execute("SELECT name FROM locations WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
        elif short_type == 'group':
            cursor.execute("SELECT name FROM groups WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
        elif short_type == 'secret':
            cursor.execute("SELECT title FROM secrets WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
        else: # item, lore
            cursor.execute("SELECT name FROM lore_entities WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
    except Exception:
        pass
    
    return "" # Fallback to empty so we can use the text inside the marker

def _resolve_annotation_content(db_conn, entity_id: str, short_type: str) -> str:
    cursor = db_conn.cursor()
    try:
        if short_type == 'annotation':
            cursor.execute("SELECT content FROM annotations WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
        elif short_type == 'secret':
            cursor.execute("SELECT description FROM secrets WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
        elif short_type in ('item', 'lore'):
            cursor.execute("SELECT description FROM lore_entities WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            if row: return row[0]
    except Exception:
        pass
    return ""

def strip_html(text: str) -> str:
    """Removes HTML tags and converts common ones to newlines if needed."""
    # Convert <p> and <br> to newlines before stripping to preserve paragraph breaks
    text = text.replace('</p>', '\n').replace('<br>', '\n').replace('<br/>', '\n')
    return _HTML_TAG_PATTERN.sub('', text)

def strip_todo(text: str) -> tuple[str, int]:
    """Removes #TODO and following text until end of paragraph/line."""
    todos_found = len(_TODO_PATTERN.findall(text))
    text = _TODO_PATTERN.sub('', text)
    return text, todos_found

def _strip_knowledge_rel_markers(text: str) -> str:
    """Strip knowledge/relationship markers to plain text (author-only metadata)."""
    return _KNOWLEDGE_REL_PATTERN.sub(r'\4', text)


def strip_prose(text: str, db_conn, remove_html: bool = True) -> str:
    """Prose Only mode: removing all markers, converting links to plain text."""
    text = _TIME_MARKER_PATTERN.sub(r'\1', text)
    text = _strip_knowledge_rel_markers(text)
    text = _EPISTEMIC_PATTERN.sub('', text)
    # Strip twist/foreshadow markers to plain text
    text = _TWIST_MARKER_PATTERN.sub(r'\3', text)

    def resolve_marker(match):
        return match.group(3)

    text = _FLESHNOTE_MARKER_PATTERN.sub(resolve_marker, text)

    if remove_html:
        text = strip_html(text)

    return text

def strip_notes(text: str, db_conn, remove_html: bool = True) -> tuple[str, list[str]]:
    """With Annotations mode: export annotations -> footnotes. Quick notes removed."""
    text = _TIME_MARKER_PATTERN.sub(r'\1', text)
    text = _strip_knowledge_rel_markers(text)
    text = _EPISTEMIC_PATTERN.sub('', text)
    # Strip twist/foreshadow markers to plain text in annotation-only mode
    text = _TWIST_MARKER_PATTERN.sub(r'\3', text)

    notes_extracted = []

    def resolve_marker(match):
        stype = match.group(1)
        sid = match.group(2)
        original_text = match.group(3)

        if stype == 'annotation':
            content = _resolve_annotation_content(db_conn, sid, stype)
            notes_extracted.append(content if content else original_text)
            idx = len(notes_extracted)
            return f"{original_text}[[FOOTNOTE_REF:{idx}]]"

        if stype == 'quicknote':
            return ""  # Quick notes are author-only, never exported

        return original_text

    text = _FLESHNOTE_MARKER_PATTERN.sub(resolve_marker, text)
    
    if remove_html:
        text = strip_html(text)
        
    return text, notes_extracted

def strip_full(text: str, db_conn, remove_html: bool = False) -> tuple[str, list[str]]:
    """Full Annotated mode: annotations become footnotes, entity/twist links preserved."""
    text = _TIME_MARKER_PATTERN.sub(r'\1', text)
    text = _strip_knowledge_rel_markers(text)

    notes_extracted = []

    # In full mode, preserve twist/foreshadow as styled tokens for the renderer
    text = _TWIST_MARKER_PATTERN.sub(lambda m: f"[[TWIST_REF:{m.group(1)}:{m.group(3)}]]", text)

    def resolve_marker(match):
        stype = match.group(1)
        sid = match.group(2)
        original_text = match.group(3)

        if stype == 'annotation':
            content = _resolve_annotation_content(db_conn, sid, stype)
            notes_extracted.append(content if content else original_text)
            idx = len(notes_extracted)
            return f"{original_text}[[FOOTNOTE_REF:{idx}]]"

        if stype == 'quicknote':
            return ""  # Author only

        desc = _resolve_annotation_content(db_conn, sid, stype)

        if stype in ('secret', 'lore', 'item') and desc:
            return f"[[ENTITY_LINK:{stype}:{sid}:{original_text}:{desc}]]"

        return f"[[ENTITY_REF:{stype}:{original_text}]]"

    text = _FLESHNOTE_MARKER_PATTERN.sub(resolve_marker, text)

    if remove_html:
        text = strip_html(text)

    return text, notes_extracted

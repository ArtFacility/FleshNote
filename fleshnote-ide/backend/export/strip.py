import re
import sqlite3

# Patterns matching chapters.py markers: {{char:2|Sophia}}
_FLESHNOTE_MARKER_PATTERN = re.compile(r'\{\{(char|loc|item|lore|group|quicknote|secret):(\d+)\|([^}]+)\}\}')
_EPISTEMIC_PATTERN = re.compile(r'\{(secret|knows|believes):([^}]+)\}')
_HTML_TAG_PATTERN = re.compile(r'<[^>]+>')

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
        if short_type == 'secret':
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

def strip_prose(text: str, db_conn, remove_html: bool = True) -> str:
    """Prose Only mode: removing all markers, converting links to plain text."""
    text = _EPISTEMIC_PATTERN.sub('', text)
    
    def resolve_marker(match):
        stype = match.group(1)
        sid = match.group(2)
        original_text = match.group(3)
        
        # In prose mode, we just want the text. 
        # But we check if we should resolve it to the "Official" name if it's different?
        # Usually we keep the text the user wrote in the prose.
        return original_text
        
    text = _FLESHNOTE_MARKER_PATTERN.sub(resolve_marker, text)
    
    if remove_html:
        text = strip_html(text)
        
    return text

def strip_notes(text: str, db_conn, remove_html: bool = True) -> tuple[str, list[str]]:
    """With Annotations mode: export annotations -> footnotes. Quick notes removed."""
    text = _EPISTEMIC_PATTERN.sub('', text)
    
    notes_extracted = []
    
    def resolve_marker(match):
        stype = match.group(1)
        sid = match.group(2)
        original_text = match.group(3)
        
        if stype in ('secret', 'lore', 'item'):
            # These can be annotations
            content = _resolve_annotation_content(db_conn, sid, stype)
            if content:
                notes_extracted.append(content)
                idx = len(notes_extracted)
                return f"{original_text}[[FOOTNOTE_REF:{idx}]]"
        
        if stype == 'quicknote':
            return "" # Strip quicknotes in this mode
            
        return original_text
        
    text = _FLESHNOTE_MARKER_PATTERN.sub(resolve_marker, text)
    
    if remove_html:
        text = strip_html(text)
        
    return text, notes_extracted

def strip_full(text: str, db_conn, remove_html: bool = False) -> tuple[str, list[str]]:
    """Full Annotated mode: epistemic markers and entity links are preserved for the renderer."""
    
    def resolve_marker(match):
        stype = match.group(1)
        sid = match.group(2)
        original_text = match.group(3)
        
        if stype == 'quicknote':
            return "" # Author only
            
        # For full mode, we keep a more descriptive internal tag for the renderer
        desc = _resolve_annotation_content(db_conn, sid, stype)
        
        if stype in ('secret', 'lore', 'item') and desc:
            # Also treat it as a footnote in addition to being a link?
            # Or just a link with a hover. Renderer will decide.
            return f"[[ENTITY_LINK:{stype}:{sid}:{original_text}:{desc}]]"
        
        return f"[[ENTITY_REF:{stype}:{original_text}]]"

    text = _FLESHNOTE_MARKER_PATTERN.sub(resolve_marker, text)
    
    # Footnotes for secrets/lore if they have descriptions
    notes_extracted = []
    # (Actually we might have already handled this above by passing desc to the renderer)
    
    if remove_html:
        text = strip_html(text)
        
    return text, notes_extracted

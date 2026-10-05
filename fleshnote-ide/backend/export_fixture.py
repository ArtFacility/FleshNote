"""A small project whose chapters use every construct the editor can save, for
export tests (test_export.py) and the visual export review script.

Chapter files are written in the form the chapter save pipeline produces:
entity/annotation/time markers, raw spans where a mark wraps other tags,
TipTap's inline formatting, headings, lists, scene breaks and HTML entities.
"""
import os
import shutil
import sqlite3

import db_setup

CHAR_ID = "c0ffee00-0000-4000-8000-000000000001"
LORE_ID = "c0ffee00-0000-4000-8000-000000000002"
NOTE_ID = "c0ffee00-0000-4000-8000-000000000003"
QUICK_ID = "c0ffee00-0000-4000-8000-000000000004"
TIME_ID = "c0ffee00-0000-4000-8000-000000000005"
TWIST_ID = "c0ffee00-0000-4000-8000-000000000006"

ANNOTATION_TEXT = "The harbor was renamed in the second draft."
LORE_DESC = "An oil lamp that never goes out."
QUICK_TEXT = "QUICKNOTE-SECRET check the tide tables"
DELETED_TEXT = "DELETED-CHAPTER-TEXT should never be exported"

CHAPTER_ONE = (
    "<h1>Chapter 1</h1>"
    '<p>"Light them," said {{char:%(c)s|Mara}}. "All of them &amp; quickly."</p>'
    "<p>'Tis late, she thought. It's always late--the <em>lamps</em> were "
    "<strong>cold</strong> and the {{annotation:%(a)s|harbor}} slept...</p>"
    '<p><span data-time-id="%(t)s" data-color-index="2" class="time-link">'
    "The year before,<br>the wall fell.</span></p>"
    '<p>A <span data-entity-type="character" data-entity-id="%(c)s" '
    'class="entity-link character"><em>Mara</em></span> stood alone.</p>'
    "<p>{{quicknote:%(q)s|The tide}} turned. #TODO fix this line</p>"
    "<p>* * *</p>"
    "<p>Tom &lt;3 Jerry. {{item:%(l)s|the Lantern}} glowed. {{twist:%(w)s|It was him}}.</p>"
    "<hr>"
    "<p>Two  spaces  here and a <s>struck</s> <u>underlined</u> "
    '<a href="https://example.org">link</a>.</p>'
    "<ul><li><p>first item</p></li><li><p>second item</p></li></ul>"
    "<p>---</p>"
    "<p>The end of the first chapter.</p>"
) % {"c": CHAR_ID, "a": NOTE_ID, "t": TIME_ID, "q": QUICK_ID, "l": LORE_ID, "w": TWIST_ID}

# A long plain chapter so book layouts have several pages to look at.
_PARA = ("The wall ran along the harbor for a mile, and nobody walked it after dark. "
         "The keeper said the stones were older than the town, older than the lamps, "
         "older than the names the town had given them. \"Ask the sea,\" he said, "
         "when anyone asked him why.")
CHAPTER_TWO = "".join("<p>%s</p>" % _PARA for _ in range(40))


def build(root: str, name: str = "Export Fixture") -> str:
    """Creates the fixture project under root and returns its path."""
    path = os.path.join(root, name + ".flnote")
    if os.path.exists(path):
        shutil.rmtree(path)
    os.makedirs(os.path.join(path, "md"))
    os.makedirs(os.path.join(path, "exports"))
    db_setup.generate_project_db(path, {
        "project_name": name, "author_name": "Ada Quill", "genre": "fantasy",
        "story_language": "en", "narrative_framework": "three_act",
        "scaffold_chapters": False, "target_word_count": 20000, "default_chapter_target": 3500,
    })
    conn = sqlite3.connect(os.path.join(path, "fleshnote.db"))
    conn.execute("DELETE FROM chapters")
    conn.execute("INSERT INTO characters (id, name) VALUES (?, 'Mara')", (CHAR_ID,))
    conn.execute("INSERT INTO lore_entities (id, name, category, description) VALUES (?, 'the Lantern', 'item', ?)",
                 (LORE_ID, LORE_DESC))
    conn.execute("INSERT INTO annotations (id, content) VALUES (?, ?)", (NOTE_ID, ANNOTATION_TEXT))
    conn.execute("INSERT INTO quick_notes (id, content, note_type) VALUES (?, ?, 'Note')", (QUICK_ID, QUICK_TEXT))
    chapters = [
        ("ch-1", 1, "The Lamps", CHAPTER_ONE, 0),
        ("ch-2", 2, "Fire & Ice <Part Two>", CHAPTER_TWO, 0),
        ("ch-3", 3, "Cut Chapter", "<p>%s</p>" % DELETED_TEXT, 1),
    ]
    for cid, num, title, text, deleted in chapters:
        md = "ch_%03d.md" % num
        with open(os.path.join(path, "md", md), "w", encoding="utf-8") as f:
            f.write(text)
        conn.execute("INSERT INTO chapters (id, chapter_number, title, status, md_filename, word_count, deleted) "
                     "VALUES (?, ?, ?, 'draft', ?, ?, ?)", (cid, num, title, md, len(text.split()), deleted))
    conn.commit()
    conn.close()
    return path

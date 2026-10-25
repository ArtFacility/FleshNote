"""Builds a FleshNote 1.2 project with the 1.2 code itself, for the migration tests.

    python tools/make_v1_fixture.py <path to a 1.2 checkout's fleshnote-ide/backend> <output project dir>

Get a 1.2 checkout with:  git clone --branch main --single-branch <repo> FleshNote-1.2-main
(v1.2.0 is the last release on main before 2.0.)

Everything goes through 1.2's own schema and route functions, so the result is
exactly what a 1.2 user has on disk: integer ids, and chapter files saved by
1.2's save pipeline with every marker type it wrote (entity, quick note,
annotation, twist, foreshadow, knowledge, relationship, time override), plus
the tables those saves fill (appearances, foreshadowings, offsets).

The output is committed under test_fixtures/v1_2/; regenerate only when the
fixture needs to cover more.
"""
import asyncio
import inspect
import os
import shutil
import sys

V1_BACKEND = os.path.abspath(sys.argv[1])
OUT = os.path.abspath(sys.argv[2])

# only the 1.2 backend is importable from here on (not this checkout's backend or tools)
_HERE = os.path.dirname(os.path.abspath(__file__))
_OURS = {os.path.normcase(_HERE), os.path.normcase(os.path.dirname(_HERE))}
sys.path = [V1_BACKEND] + [p for p in sys.path if os.path.normcase(os.path.abspath(p or ".")) not in _OURS]
os.chdir(V1_BACKEND)

from fastapi import BackgroundTasks  # noqa: E402

import db_setup  # noqa: E402
from routes import (annotations, boards, chapters, characters, entities, groups, image_references,  # noqa: E402
                    knowledge, locations, quick_notes, relationships, twists, world_times)


def call(fn, model, **kw):
    return run(fn(model(project_path=OUT, **kw)))


def run(res):
    """Some 1.2 endpoints are async."""
    return asyncio.run(res) if inspect.iscoroutine(res) else res


def new_id(res, *keys):
    """The id a 1.2 create endpoint returned (they differ in shape)."""
    if isinstance(res, dict):
        for k in keys + ("id",):
            if k in res and isinstance(res[k], int):
                return res[k]
        for v in res.values():
            if isinstance(v, dict) and isinstance(v.get("id"), int):
                return v["id"]
    raise RuntimeError("no id in %r" % (res,))


if os.path.exists(OUT):
    shutil.rmtree(OUT)
os.makedirs(os.path.join(OUT, "md"))
os.makedirs(os.path.join(OUT, "assets"))

db_setup.generate_project_db(OUT, {
    "project_name": "Legacy Harbor", "author_name": "Ada Quill", "genre": "fantasy",
    "narrative_framework": "three_act", "story_language": "en",
    "track_groups": True, "track_knowledge": True, "track_dual_timeline": True,
    "track_species": True, "species_label": "Kin", "group_label": "Guild",
    "default_chapter_target": 3000,
    "lore_categories": ["item", "language", "ritual"],
})

# ── entities ──
mara = new_id(call(characters.create_character, characters.CharacterCreate, name="Mara Venn", role="protagonist",
                   aliases=["Mara"], bio="The last lamplighter."), "character_id")
joss = new_id(call(characters.create_character, characters.CharacterCreate, name="Joss", role="deuteragonist"), "character_id")
kan = new_id(call(characters.create_character, characters.CharacterCreate, name="Kan", role="antagonist"), "character_id")
guild = new_id(call(groups.create_group, groups.GroupCreate, name="The Lamplighters", group_type="guild"), "group_id")
run(characters.update_character(characters.CharacterUpdate(project_path=OUT, character_id=joss, group_id=guild)))
harbor = new_id(call(locations.create_location, locations.LocationCreate, name="Greyhaven Harbor", region="Coast"), "location_id")
tower = new_id(call(locations.create_location, locations.LocationCreate, name="The Old Light", parent_location_id=harbor), "location_id")
lantern = new_id(call(entities.create_lore_entity, entities.LoreEntityCreate, name="Ember Lantern", category="item",
                      description="A lamp that never goes out."), "entity_id", "lore_entity_id")
tongue = new_id(call(entities.create_lore_entity, entities.LoreEntityCreate, name="Old Tongue", category="language"),
                "entity_id", "lore_entity_id")

ch = []
for i, title in enumerate(["The Lamps", "Low Tide", "The Keeper"]):
    ch.append(new_id(call(chapters.create_chapter, chapters.ChapterCreate, title=title, pov_character_id=mara,
                          status="draft"), "chapter_id"))

twist = new_id(call(twists.create_twist, twists.TwistCreate, title="Joss is the keeper", twist_type="identity",
                    reveal_chapter_id=ch[2], characters_who_know=[kan]), "twist_id")
fact = new_id(call(knowledge.create_knowledge_state, knowledge.KnowledgeStateCreate, character_id=mara,
                   fact="The lantern burns on memories.", source_entity_type="lore", source_entity_id=lantern,
                   learned_in_chapter=ch[0]), "knowledge_id", "knowledge_state_id")
secret = new_id(call(knowledge.create_knowledge_state, knowledge.KnowledgeStateCreate, character_id=kan,
                     fact="Joss serves the guild.", source_entity_type="group", source_entity_id=guild,
                     learned_in_chapter=ch[1], is_secret=1, reveal_in_chapter=ch[2]), "knowledge_id", "knowledge_state_id")
rel = new_id(call(relationships.create_relationship, relationships.RelationshipCreate, character_id=mara,
                  target_character_id=joss, rel_type="rival", chapter_id=ch[1]), "relationship_id")
flashback = new_id(call(world_times.create_world_time, world_times.WorldTimeCreate, chapter_id=ch[1],
                        world_date="1 Frostmonth 812", label="Flashback", color_index=2), "world_time_id")
qnote = new_id(call(quick_notes.create_quick_note, quick_notes.QuickNoteCreate, content="Check the tide tables",
                    note_type="Research"), "note_id", "quick_note_id")
anno = new_id(call(annotations.create_annotation, annotations.AnnotationCreate,
                   content="Greyhaven was called Saltmere in the first draft."), "annotation_id")

board = new_id(call(boards.create_board, boards.BoardCreate, name="Who knows what"), "board_id")
item_a = new_id(call(boards.create_item, boards.ItemCreate, board_id=board, name="Mara", item_type="character",
                     entity_id=mara, entity_type="character"), "item_id")
item_b = new_id(call(boards.create_item, boards.ItemCreate, board_id=board, name="The Old Light", item_type="location",
                     entity_id=tower, entity_type="location", pos_x=200), "item_id")
call(boards.create_connection, boards.ConnectionCreate, board_id=board, item_start_id=item_a, item_end_id=item_b,
     title="keeps")

with open(os.path.join(OUT, "assets", "img_mara0000001.png"), "wb") as f:
    f.write(bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                          "1f15c4890000000d49444154789c636060f80f0000040101005b62d5dc0000000049454e44ae426082"))
call(image_references.create_image_ref, image_references.ImageRefCreate, entity_id=mara, entity_type="char",
     image_path="assets/img_mara0000001.png", is_icon=1)


# ── chapters, saved through 1.2's pipeline from the editor's HTML ──
def ent(kind, eid, text):
    return '<span data-entity-type="%s" data-entity-id="%d" class="entity-link %s">%s</span>' % (kind, eid, kind, text)


def save(chapter_id, html):
    bg = BackgroundTasks()
    run(chapters.save_chapter_content(chapters.ChapterSave(project_path=OUT, chapter_id=chapter_id, content=html,
                                                           word_count=len(html.split())), bg))
    for task in bg.tasks:  # 1.2 records offsets/appearances in background tasks
        run(task.func(*task.args, **task.kwargs))


save(ch[0], "".join([
    "<h1>Chapter 1</h1>",
    "<p>%s climbed %s with the %s in her hand.</p>" % (ent("character", mara, "Mara"), ent("location", tower, "the Old Light"),
                                                        ent("lore", lantern, "Ember Lantern")),
    '<p>She knew <span data-knowledge-id="%d" data-character-id="%d">it burned on memories</span>. ' % (fact, mara),
    "%s had warned her once, in the %s.</p>" % (ent("character", joss, "Joss"), ent("lore", tongue, "Old Tongue")),
    '<p>Below, the %s slept. <span data-twist-type="foreshadow" data-twist-id="%d">A second lamp moved on the cliff.</span></p>'
    % (ent("location", harbor, "harbor"), twist),
    "<p>%s and the tide turned. #TODO tighten this</p>" % ent("quicknote", qnote, "The water rose"),
]))
save(ch[1], "".join([
    '<p><span data-time-id="%d" data-color-index="2">Years before, the light had never failed.</span></p>' % flashback,
    '<p><span data-relationship-id="%d" data-character-id="%d">Mara would never forgive Joss</span> for that winter.</p>'
    % (rel, mara),
    "<p>The %s met in secret. %s was named in the %s.</p>" % (ent("group", guild, "Lamplighters"),
                                                            ent("character", kan, "Kan"), ent("annotation", anno, "harbor ledger")),
    '<p><span data-knowledge-id="%d" data-character-id="%d">Kan knew who Joss served.</span></p>' % (secret, kan),
]))
save(ch[2], "".join([
    "<p>%s turned. <span data-twist-type=\"twist\" data-twist-id=\"%d\">The keeper had been Joss all along.</span></p>"
    % (ent("character", mara, "Mara"), twist),
    "<p>* * *</p><p>The %s went dark.</p>" % ent("location", tower, "Old Light"),
]))

print("1.2 fixture written to", OUT)

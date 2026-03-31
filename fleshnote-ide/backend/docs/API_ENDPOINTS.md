# FleshNote API Endpoints

All endpoints use **POST** method. Request bodies are JSON with `project_path` identifying the active project. Backend runs at `http://127.0.0.1:8000`.

---

## Project Management

Defined in `backend/main.py`.

### `POST /api/projects`

Scan a workspace directory for FleshNote projects.

**Request:**

```json
{ "workspace_path": "C:/Users/name/FleshNote" }
```

**Response:**

```json
{
  "projects": [{ "name": "My Novel", "path": "C:/.../My Novel", "lastModified": "2026-02-20T..." }]
}
```

---

### `POST /api/project/init`

Create a new project: directory structure, SQLite database, config entries.

**Request:**

```json
{
  "workspace_path": "C:/Users/name/FleshNote",
  "project_name": "My Novel",
  "questionnaire": {
    "genre": "fantasy",
    "author_name": "Author",
    "track_species": true,
    "core_mechanic": "magic",
    "mechanic_label": "Magic System",
    "track_groups": true,
    "group_label": "Faction",
    "track_milestones": true,
    "track_knowledge": true,
    "track_dual_timeline": true,
    "default_chapter_target": 4000,
    "lore_categories": ["mechanic", "item", "artifact", "creature", "material"]
  }
}
```

**Response:**

```json
{ "status": "ok", "project_path": "C:/.../My Novel", "db_path": "C:/.../fleshnote.db" }
```

**Side effects:** Creates `fleshnote.db` with all 10 tables, `md/` directory, populates `project_config` table.

---

### `POST /api/project/load`

Load an existing project's configuration.

**Request:**

```json
{ "project_path": "C:/.../My Novel" }
```

**Response:**

```json
{
  "status": "ok",
  "config": {
    "project_name": "My Novel",
    "genre": "fantasy",
    "track_species": true,
    "species_label": "Species",
    "lore_categories": ["mechanic", "item", "artifact"],
    "default_chapter_target": 4000
  }
}
```

Config values are auto-typed: `"true"`/`"false"` become booleans, JSON strings are parsed, numeric strings become integers.

---

## Chapters

Defined in `backend/routes/chapters.py`.

### `POST /api/project/chapters`

List all chapters ordered by chapter number, joined with POV character name.

**Request:**

```json
{ "project_path": "C:/.../My Novel" }
```

**Response:**

```json
{
  "chapters": [
    {
      "id": 1,
      "chapter_number": 1,
      "title": "Chapter 1",
      "status": "writing",
      "pov_character_id": 1,
      "pov_name": "Ren",
      "world_time": "4E-314, 3rd Moon, Day 17",
      "narrative_time": 1,
      "word_count": 2450,
      "target_word_count": 4000,
      "md_filename": "ch_001_chapter_1.md",
      "synopsis": null,
      "notes": null,
      "created_at": "2026-02-20T...",
      "updated_at": "2026-02-20T..."
    }
  ]
}
```

---

### `POST /api/project/chapter/create`

Create a single chapter with an empty markdown file.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "title": "The Arrival",
  "chapter_number": 2,
  "pov_character_id": 1,
  "target_word_count": 4000,
  "status": "writing"
}
```

- `chapter_number` auto-increments if omitted.
- `title` defaults to `"Chapter N"` if empty.

**Response:**

```json
{
  "chapter": {
    "id": 2,
    "chapter_number": 2,
    "title": "The Arrival",
    "status": "writing",
    "pov_character_id": 1,
    "pov_name": "Ren",
    "word_count": 0,
    "target_word_count": 4000,
    "md_filename": "ch_002_the_arrival.md"
  }
}
```

**Side effects:** Creates empty file at `{project_path}/md/ch_002_the_arrival.md`.

---

### `POST /api/project/chapters/bulk-create`

Create multiple chapters at once (used by Story Scope wizard).

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "count": 10,
  "pov_character_id": 1,
  "target_word_count": 4000
}
```

**Response:**

```json
{
  "chapters": [
    {
      "id": 3,
      "chapter_number": 3,
      "title": "Chapter 3",
      "status": "planned",
      "md_filename": "ch_003_untitled.md"
    }
  ]
}
```

First chapter gets `status: "writing"` and the provided `pov_character_id`. Rest get `status: "planned"` with no POV.

---

### `POST /api/project/chapter/load`

Load a chapter's content from its markdown file, converting entity markers to TipTap HTML.

**Request:**

```json
{ "project_path": "C:/.../My Novel", "chapter_id": 1 }
```

**Response:**

```json
{
  "content": "<p>Sophia walked into <span data-entity-type=\"location\" data-entity-id=\"2\" class=\"entity-link location\">the Academy</span>.</p>",
  "md_filename": "ch_001_chapter_1.md"
}
```

**Processing pipeline:**

1. Read raw markdown from disk
2. `_plain_text_to_html()` — convert plain text paragraphs to `<p>` tags
3. `_entity_md_to_html()` — convert `{{char:5|Sophia}}` to entity-link spans

---

### `POST /api/project/chapter/save`

Save chapter content, converting entity HTML back to markdown markers, and tracking entity appearances.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "chapter_id": 1,
  "content": "<p><span data-entity-type=\"character\" data-entity-id=\"5\">Sophia</span> arrived.</p>",
  "word_count": 2450
}
```

**Response:**

```json
{ "status": "saved", "word_count": 2450 }
```

**Processing pipeline:**

1. `_entity_html_to_md()` — convert entity-link spans to `{{char:5|Sophia}}`
2. Write markdown to disk
3. `_update_entity_appearances()` — scan for `{{type:id|text}}` markers, upsert into `entity_appearances`
4. Update `chapters.word_count` and `chapters.updated_at`

---

### `POST /api/project/chapter/update`

Update chapter metadata (POV, status, title, world time).

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "chapter_id": 1,
  "pov_character_id": 2,
  "status": "draft"
}
```

All fields except `project_path` and `chapter_id` are optional. Only provided fields are updated. Setting `pov_character_id` to `0` clears the POV.

**Response:**

```json
{
  "chapter": {
    "id": 1,
    "chapter_number": 1,
    "title": "Chapter 1",
    "status": "draft",
    "pov_character_id": 2,
    "pov_name": "Sophia",
    "word_count": 2450,
    "target_word_count": 4000,
    "md_filename": "ch_001_chapter_1.md",
    "world_time": null
  }
}
```

---

### `POST /api/project/chapter/delete`

Delete a chapter from the database and remove its markdown file. Shifts all subsequent chapters down by 1 to heal the numbering gap.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "chapter_id": 1
}
```

**Response:**

```json
{
  "status": "ok",
  "deleted_number": 1
}
```

---

### `POST /api/project/chapter/insert`

Insert a new blank chapter chronologically relative to an anchor chapter. Shifts all subsequent chapters up by 1 to make room.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "anchor_chapter_id": 1,
  "direction": "above" // can be "above" or "below"
}
```

**Response:**

```json
{
  "chapter": {
    "id": 5,
    "chapter_number": 1,
    "title": "Chapter 1",
    "status": "planned",
    "pov_character_id": null,
    "pov_name": null,
    "word_count": 0,
    "target_word_count": 4000,
    "md_filename": "ch_001_untitled_a1b2c3d4.md"
  }
}
```

---

## Characters

Defined in `backend/routes/characters.py`.

### `POST /api/project/characters`

List all characters.

**Request:**

```json
{ "project_path": "C:/.../My Novel" }
```

**Response:**

```json
{
  "characters": [
    {
      "id": 1,
      "name": "Ren",
      "aliases": ["the Magistra"],
      "role": "Protagonist",
      "status": "Alive",
      "species": "Human",
      "group_id": null,
      "surface_goal": "Graduate from the Academy",
      "true_goal": "Find out what happened to her mother",
      "bio": "A first-year student at the Academy...",
      "notes": "Secretly has latent abilities"
    }
  ]
}
```

---

### `POST /api/project/character/create`

Create a single character.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "name": "Sophia",
  "role": "Supporting",
  "status": "Alive",
  "species": "Human",
  "bio": "Ren's roommate and closest friend.",
  "aliases": ["Sophie"],
  "surface_goal": "Protect Ren",
  "true_goal": "Report to the Council",
  "notes": ""
}
```

All fields except `project_path` and `name` have defaults (empty strings/null).

**Response:**

```json
{
  "character": {
    "id": 2,
    "name": "Sophia",
    "role": "Supporting",
    "status": "Alive",
    "species": "Human",
    "bio": "Ren's roommate and closest friend."
  }
}
```

---

### `POST /api/project/characters/bulk-create`

Create multiple characters at once (used during import/onboarding).

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "characters": [
    { "name": "Ren", "role": "Protagonist", "species": "Human", "bio": "..." },
    { "name": "Sophia", "role": "Supporting" }
  ]
}
```

**Response:**

```json
{
  "characters": [
    { "id": 1, "name": "Ren", "role": "Protagonist" },
    { "id": 2, "name": "Sophia", "role": "Supporting" }
  ]
}
```

---

## Locations

Defined in `backend/routes/locations.py`.

### `POST /api/project/locations`

List all locations.

**Request:**

```json
{ "project_path": "C:/.../My Novel" }
```

**Response:**

```json
{
  "locations": [
    {
      "id": 1,
      "name": "The Academy",
      "aliases": ["Academis Arcana"],
      "region": "Central District",
      "parent_location_id": null,
      "description": "The premier institution for magical study.",
      "notes": ""
    }
  ]
}
```

---

### `POST /api/project/location/create`

Create a single location.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "name": "The Academy",
  "region": "Central District",
  "description": "The premier institution for magical study.",
  "parent_location_id": null,
  "aliases": ["Academis Arcana"],
  "notes": ""
}
```

**Response:**

```json
{
  "location": { "id": 1, "name": "The Academy", "region": "Central District" }
}
```

---

### `POST /api/project/location/weather`

List all weather states for a specific location.

**Request:**

```json
{ "project_path": "C:/.../My Novel", "location_id": 1 }
```

**Response:**

```json
{
  "weather_states": [
    {
      "id": 1,
      "location_id": 1,
      "world_time": "4E-314, Day 17",
      "weather": "Sunny",
      "temperature": "24°C",
      "moisture": "Dry"
    }
  ]
}
```

---

### `POST /api/project/location/weather/create`

Create a new weather state entry.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "location_id": 1,
  "world_time": "4E-314, Day 18",
  "weather": "Rainy",
  "temperature": "18°C",
  "moisture": "Humid"
}
```

**Response:**

```json
{
  "weather_state": { "id": 2, "location_id": 1, "world_time": "4E-314, Day 18" }
}
```

---

### `POST /api/project/location/weather/update`

Update an existing weather state.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "weather_state_id": 2,
  "weather": "Thunderstorm"
}
```

**Response:**

```json
{
  "weather_state": { "id": 2, "weather": "Thunderstorm", ... }
}
```

---

### `POST /api/project/location/weather/delete`

Delete a weather state.

**Request:**

```json
{ "project_path": "C:/.../My Novel", "weather_state_id": 2 }
```

**Response:**

```json
{ "status": "ok" }
```

---

## Entities

Defined in `backend/routes/entities.py`.

### `POST /api/project/entities`

Get all entities (characters, locations, lore entities, groups) for the linkification engine. Returns names and aliases for matching.

**Request:**

```json
{ "project_path": "C:/.../My Novel" }
```

**Response:**

```json
{
  "entities": [
    { "id": 1, "type": "character", "name": "Sophia", "aliases": ["Sophie"] },
    { "id": 1, "type": "lore", "name": "Etheric Compass", "aliases": [], "category": "item" },
    { "id": 1, "type": "location", "name": "The Academy", "aliases": ["Academis Arcana"] },
    { "id": 1, "type": "group", "name": "The Council", "aliases": ["High Council"] }
  ]
}
```

---

### `POST /api/project/lore-entity/create`

Create a lore entity (item, magic system, artifact, creature, etc.).

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "name": "Etheric Compass",
  "category": "item",
  "aliases": ["the Compass"],
  "description": "A standard-issue navigation device."
}
```

**Response:**

```json
{
  "entity": {
    "id": 1,
    "type": "lore",
    "name": "Etheric Compass",
    "category": "item",
    "aliases": ["the Compass"]
  }
}
```

---

## Import

Defined in `backend/routes/imports.py`.

### `POST /api/project/import/split-preview`

Analyze a manuscript file and propose chapter splits using heuristic detection.

**Request:**

```json
{ "project_path": "C:/.../My Novel", "file_path": "C:/Documents/manuscript.docx" }
```

Supported formats: `.txt`, `.md`, `.docx`

**Response:**

```json
{
  "splits": [
    {
      "title": "Chapter 1: The Beginning",
      "content": "Full chapter text...",
      "preview": "First 150 characters...",
      "word_count": 3200
    }
  ],
  "total_words": 48000,
  "total_chapters": 15
}
```

**Split heuristics (priority order):**

1. Markdown headings (`# Chapter`, `## Title`)
2. DOCX headings (converted to `#` internally)
3. Regex patterns: `Chapter/Prologue/Epilogue/Part/Act/Book` + number words or digits
4. Delimiter patterns: `---`, `***`, `###`, `===`
5. Large whitespace gaps (4+ blank lines)

---

### `POST /api/project/import/confirm-splits`

Commit the approved chapter splits to the database and create markdown files.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "splits": [{ "title": "Chapter 1", "content": "Raw text..." }],
  "pov_character_id": 1,
  "target_word_count": 4000
}
```

**Response:**

```json
{
  "chapters": [
    {
      "id": 1,
      "chapter_number": 1,
      "title": "Chapter 1",
      "status": "draft",
      "word_count": 3200,
      "md_filename": "ch_001_chapter_1.md"
    }
  ]
}
```

**Side effects:** Converts plain text to HTML `<p>` tags, writes to `{project_path}/md/{filename}`.

---

### `POST /api/project/import/ner-extract`

Run spaCy Named Entity Recognition on text.

**Request:**

```json
{ "text": "Sophia walked through Ironhaven toward the Academy of Stars." }
```

**Response:**

```json
{
  "entities": [
    { "text": "Sophia", "type": "character", "label": "PERSON", "start": 0, "end": 6 },
    { "text": "Ironhaven", "type": "location", "label": "GPE", "start": 22, "end": 31 },
    { "text": "the Academy of Stars", "type": "location", "label": "FAC", "start": 39, "end": 59 }
  ]
}
```

**Label mapping:** `PERSON` -> character, `GPE`/`LOC`/`FAC` -> location, `ORG` -> group.

**Dependency:** Requires `spacy` and `en_core_web_sm` model installed in `backend/.venv/`.

---

## Analytics & Telemetry

Defined in `backend/routes/stats.py`.

### `POST /api/project/stats`

Retrieve global writing statistics, daily logs, and entity mention offsets for the Analytics Dashboard.

**Request:**

```json
{ "project_path": "C:/.../My Novel" }
```

**Response:**

```json
{
  "global_stats": {
    "sprints_started": "12",
    "sprints_completed": "9",
    "sprints_abandoned": "3",
    "time_editor_minutes": "145",
    "time_planner_minutes": "20"
  },
  "stat_logs": [
    {
      "log_date": "2026-03-08",
      "new_words": 1500,
      "deleted_words": 300,
      "new_entities": 2,
      "deleted_entities": 0,
      "new_twists": 0
    }
  ],
  "entity_mentions": [
    {
      "id": 1,
      "entity_type": "character",
      "entity_id": 5,
      "chapter_id": 2,
      "word_offset": 124,
      "created_at": "2026-03-08T..."
    }
  ]
}
```

---

### `POST /api/project/stats/update`

Increment or set a global key-value statistic directly in the SQLite schema over IPC bindings. Solves race conditions by avoiding overlapping saves.

**Request:**

```json
{
  "project_path": "C:/.../My Novel",
  "stat_key": "time_editor_minutes",
  "increment_by": 1,
  "set_value": ""
}
```

If `increment_by` is not 0, it adds to the existing value (falling back to setting it if not numeric). Otherwise, it sets the value equal to `set_value`.

**Response:**

```json
{ 
  "status": "ok", 
  "stat_key": "time_editor_minutes", 
  "new_value": "12" 
}
```

---

## Annotations

Defined in `backend/routes/annotations.py`.

### `POST /api/project/annotations/list`
Fetch all generic annotations for a chapter.
**Request:** `{ "project_path": "...", "chapter_id": 1 }`
**Response:** `{ "annotations": [ { "id": 1, ... } ] }`

### `POST /api/project/annotations/create`
Create a new annotation linked to a specific text offset.
**Request:** `{ "project_path": "...", "chapter_id": 1, "text_quote": "...", "note": "...", "word_offset": 100 }`
**Response:** `{ "annotation": { ... } }`

### `POST /api/project/annotations/update`
Update an annotation's note text.
**Request:** `{ "project_path": "...", "annotation_id": 1, "note": "Updated note" }`
**Response:** `{ "status": "ok" }`

### `POST /api/project/annotations/delete`
Delete an annotation by ID.
**Request:** `{ "project_path": "...", "annotation_id": 1 }`
**Response:** `{ "status": "ok" }`

---

## Sketchboards

Defined in `backend/routes/boards.py`. Provides endpoints for creating node-graph maps.

- `POST /api/project/boards/list`: Returns list of all sketchboards.
- `POST /api/project/boards/create`: Creates a new board `{ "name": "...", "board_type": "custom" }`.
- `POST /api/project/boards/update`: Updates board metadata (name, focus, zoom).
- `POST /api/project/boards/delete`: Deletes a board.
- `POST /api/project/boards/get`: Returns full board state `{ "board": {...}, "items": [...], "connections": [...] }`.
- `POST /api/project/boards/items/create`: Creates a node on a board.
- `POST /api/project/boards/items/update`: Updates a node's position, size, text, or color.
- `POST /api/project/boards/items/delete`: Deletes a node.
- `POST /api/project/boards/connections/create`: Creates a connecting line between two nodes.
- `POST /api/project/boards/connections/update`: Modifies a connection (curve offset, color, label).
- `POST /api/project/boards/connections/delete`: Removes a connection line.

---

## Twists & Foreshadowing

Defined in `backend/routes/twists.py`.

- `POST /api/project/twists`: Lists all twists.
- `POST /api/project/twist/create`: Creates a twist (requires `title`, `reveal_chapter_id`).
- `POST /api/project/twist/update`: Updates twist metadata or status (`planned`, `hinted`, `revealed`).
- `POST /api/project/twist/delete`: Deletes a twist (cascades to foreshadowings).
- `POST /api/project/foreshadows`: Lists all foreshadowing hints for the project.
- `POST /api/project/foreshadow/create`: Creates a new hint linking a target twist to a specific chapter/offset.
- `POST /api/project/foreshadow/update`: Updates a hint's exact offset or text selection.
- `POST /api/project/foreshadow/delete`: Removes a hint.
- `POST /api/project/twists/stats`: Computes spacing and density metrics (e.g., detecting missing clues or bad spacing).

---

## Planner Integration

Defined in `backend/routes/planner.py`.

- `POST /api/project/planner/settings/get`: Gets singleton planner UI settings (theme, cursor_pct).
- `POST /api/project/planner/settings/update`: Saves toggles (e.g., `shadow_visible`).
- `POST /api/project/planner/blocks`: Lists all surface and shadow blocks.
- `POST /api/project/planner/block/save`: Creates or updates a plot block. Returns row status.
- `POST /api/project/planner/block/delete`: Deletes a plot block via UUID.
- `POST /api/project/planner/arcs`: Lists all character/narrative arcs.
- `POST /api/project/planner/arc/save`: Creates/updates arc lines.
- `POST /api/project/planner/arc/delete`: Remvoes an arc layer via UUID.

---

## Achievements

Defined in `backend/routes/achievements.py`. Computes and awards gamification badges.

- `POST /api/project/achievements/progress`: Computes current unlock percentages for all badges based on SQLite aggregates (e.g., total words written, items deleted).
- `POST /api/project/achievements/award`: Explictly persists a newly unlocked tier into the database to prevent re-triggering animations.

---

## Calendar & Time

Defined in `backend/routes/calendar.py` and `backend/routes/world_times.py`.

- `POST /api/project/calendar/config/get`: Retrieves the custom world-building calendar configuration (months, days, seasons).
- `POST /api/project/calendar/config/update`: Updates calendar structure keys.
- `POST /api/project/calendar/age`: Computes a character's exact age in years based on a custom `birth_date` string and a target `current_date` string.
- `POST /api/project/world-times/list`: Gets paragraph-level time overrides (flashbacks, memories) for a specific chapter.
- `POST /api/project/world-times/create`: Creates a time override marker linked to a chapter.
- `POST /api/project/world-times/update`: Modifies an override's label or assigned color.
- `POST /api/project/world-times/delete`: Deletes a time override marker.

---

## Entity Manager & Groups

Defined in `backend/routes/entity_manager.py` and `backend/routes/groups.py`.

- `POST /api/project/entities/bulk-delete`: Deletes multiple entities mapping across characters, lore, and locations. Cleans up dependent tables safely.
- `POST /api/project/entities/merge`: Consolidates duplicate entities. Rewrites `entity_mentions` and inline markdown links inside chapters. Absorbs distinct aliases and notes.
- `POST /api/project/groups`: Lists all factions/groups.
- `POST /api/project/group/create`: Creates a new group.
- `POST /api/project/group/update`: Updates group metadata (true_agenda, surface_agenda).
- `POST /api/project/group/delete`: Deletes a group.

---

## History Timeline (World Events)

Defined in `backend/routes/history.py`.

- `POST /api/project/history/entries`: Fetches all timeline events, filterable by `entity_type`, `entity_id`, or `event_type`.
- `POST /api/project/history/entry/create`: Adds a discrete event tied to an in-universe year/date.
- `POST /api/project/history/entry/update`: Modifies event properties.
- `POST /api/project/history/entry/delete`: Deletes a timeline event.

---

## Knowledge States (Epistemic Filtering)

Defined in `backend/routes/knowledge.py`.

- `POST /api/project/knowledge`: Lists all known facts for a project.
- `POST /api/project/knowledge/create`: Asserts that a Character learned a Fact about a Source Entity. Optionally pins this to a `learned_in_chapter` or `world_time`.
- `POST /api/project/knowledge/update`: Modifies fact text, secret status, or learned locations.
- `POST /api/project/knowledge/delete`: Removes a fact.
- `POST /api/project/knowledge/for_character`: Retrieves filtered knowledge for the Entity POV inspector, dynamically constrained by `narrative_time` (chapter limits) or `world_time`.

---

## Quick Notes & Secrets

Defined in `backend/routes/quick_notes.py` and `backend/routes/secrets.py`.

- `POST /api/project/quick-notes`: Lists all floating sticky notes.
- `POST /api/project/quick-note/create`: Creates a note of a specific `note_type` (e.g., TODO, Note).
- `POST /api/project/quick-note/update`: Re-categorizes a note's type.
- `POST /api/project/quick-note/delete`: Deletes a note.
- `POST /api/project/secrets`: Lists all author-level secrets.
- `POST /api/project/secret/create`: Creates a secret tracked via `characters_who_know` and `danger_phrases`.
- `POST /api/project/secret/update`: Updates secret status (`hidden`, `hinted`, `revealed`) or linked reveal chapters.

---

## NLP Utilities (Spellcheck & Synonyms)

Defined in `backend/routes/spellcheck.py` and `backend/routes/synonyms.py`.

- `POST /api/project/spellcheck`: Checks a single word against local dictionaries `(OOMW / Hunspell)` and project `ignore_list`. Returns top 6 typo suggestions.
- `POST /api/project/spellcheck/ignore`: Appends a valid custom word to the project's permanent safe-list.
- `POST /api/synonyms/lookup`: Returns WordNet synsets (definitions and synonyms) for a selected word, falling back to English automatically if language-specific data yields nothing.
- `POST /api/synonyms/check-data`: Checks if NLTK `omw-1.4` and extended data is downloaded.
- `POST /api/synonyms/ensure-data`: Non-blocking endpoint to kick off NLTK corpus downloads into the user's `AppData`.

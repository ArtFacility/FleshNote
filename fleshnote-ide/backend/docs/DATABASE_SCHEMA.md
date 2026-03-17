# FleshNote Database Schema

SQLite database at `{project_path}/fleshnote.db`. WAL mode enabled for concurrent reads.

All 10 tables are always created regardless of feature toggles. Features are enabled/disabled via `project_config` entries, not schema changes. This allows retroactive feature enabling without migrations.

Defined in `backend/db_setup.py`.

---

## 1. `project_config`

Key-value store for all project settings and UI toggles.

| Column         | Type             | Description                               |
| -------------- | ---------------- | ----------------------------------------- |
| `config_key`   | TEXT PRIMARY KEY | Setting identifier                        |
| `config_value` | TEXT             | Setting value (stringified)               |
| `config_type`  | TEXT             | One of: `toggle`, `label`, `meta`, `json` |

**Key entries:**

| Key                      | Type   | Example                          | Description                           |
| ------------------------ | ------ | -------------------------------- | ------------------------------------- |
| `project_name`           | meta   | `"My Novel"`                     | Display name                          |
| `author_name`            | meta   | `"Author"`                       | Author display name                   |
| `genre`                  | meta   | `"fantasy"`                      | Genre baseline                        |
| `track_species`          | toggle | `"true"`                         | Enable species field on characters    |
| `track_groups`           | toggle | `"true"`                         | Enable groups/factions                |
| `track_knowledge`        | toggle | `"true"`                         | Enable epistemic filtering            |
| `track_dual_timeline`    | toggle | `"true"`                         | Enable world_time + narrative_time    |
| `species_label`          | label  | `"Species"`                      | UI label for species field            |
| `mechanic_label`         | label  | `"Magic System"`                 | UI label for core mechanic            |
| `group_label`            | label  | `"Faction"`                      | UI label for groups                   |
| `core_mechanic`          | meta   | `"magic"`                        | One of: `magic`, `tech`, `none`       |
| `lore_categories`        | json   | `["mechanic","item","artifact"]` | Available lore entity categories      |
| `default_chapter_target` | meta   | `"4000"`                         | Default word count target per chapter |
| `created_at`             | meta   | `"2026-02-20T..."`               | Project creation timestamp            |

---

## 2. `chapters`

Core table for chapter management. Each chapter corresponds to a markdown file on disk.

| Column              | Type      | Constraints                             | Description                                                |
| ------------------- | --------- | --------------------------------------- | ---------------------------------------------------------- |
| `id`                | INTEGER   | PRIMARY KEY AUTOINCREMENT               |                                                            |
| `chapter_number`    | INTEGER   | NOT NULL UNIQUE                         | Display/sort order                                         |
| `title`             | TEXT      |                                         | Chapter title                                              |
| `status`            | TEXT      |                                         | `planned`, `writing`, `draft`, `revised`, `final`          |
| `pov_character_id`  | INTEGER   | FK -> characters(id) ON DELETE SET NULL | POV character for this chapter                             |
| `world_time`        | TEXT      |                                         | In-universe date (e.g. `"4E-314, 3rd Moon, Day 17"`)       |
| `narrative_time`    | INTEGER   |                                         | Ordinal reading order position                             |
| `word_count`        | INTEGER   | DEFAULT 0                               | Current word count                                         |
| `target_word_count` | INTEGER   | DEFAULT 4000                            | Target word count                                          |
| `md_filename`       | TEXT      |                                         | Filename in `md/` directory (e.g. `ch_004_the_arrival.md`) |
| `synopsis`          | TEXT      |                                         | Brief summary for author reference                         |
| `notes`             | TEXT      |                                         | Freeform author notes                                      |
| `created_at`        | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP               |                                                            |
| `updated_at`        | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP               | Updated on every save                                      |

**Indexes:** `idx_chapter_number`, `idx_chapter_status`, `idx_chapter_pov`

**Markdown files** stored at `{project_path}/md/{md_filename}`. Files contain entity markers in the format `{{char:5|Sophia}}`.

---

## 3. `characters`

Character profiles. All fields always present; optional fields toggled via `project_config`.

| Column         | Type      | Constraints                         | Description                                          |
| -------------- | --------- | ----------------------------------- | ---------------------------------------------------- |
| `id`           | INTEGER   | PRIMARY KEY AUTOINCREMENT           |                                                      |
| `name`         | TEXT      | NOT NULL                            | Display name                                         |
| `aliases`      | TEXT      |                                     | JSON array: `["the Magistra", "Vael"]`               |
| `role`         | TEXT      |                                     | `Protagonist`, `Antagonist`, `Supporting`, or custom |
| `status`       | TEXT      |                                     | `Alive`, `Dead`, `Unknown`                           |
| `species`      | TEXT      |                                     | Toggled by `track_species` config                    |
| `group_id`     | INTEGER   | FK -> groups(id) ON DELETE SET NULL | Toggled by `track_groups` config                     |
| `surface_goal` | TEXT      |                                     | Public-facing goal (visible to readers)              |
| `true_goal`    | TEXT      |                                     | Hidden goal (author-only, shown in Author View)      |
| `bio`          | TEXT      |                                     | Character biography                                  |
| `notes`        | TEXT      |                                     | Author's private notes                               |
| `created_at`   | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP           |                                                      |
| `updated_at`   | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP           |                                                      |

**Index:** `idx_char_name`

---

## 4. `groups`

Factions, organizations, noble houses, crews, etc. UI label controlled by `project_config.group_label`.

| Column           | Type      | Constraints               | Description                               |
| ---------------- | --------- | ------------------------- | ----------------------------------------- |
| `id`             | INTEGER   | PRIMARY KEY AUTOINCREMENT |                                           |
| `name`           | TEXT      | NOT NULL                  | Display name                              |
| `aliases`        | TEXT      |                           | JSON array                                |
| `group_type`     | TEXT      |                           | e.g. `military`, `religious`, `political` |
| `description`    | TEXT      |                           |                                           |
| `surface_agenda` | TEXT      |                           | Public-facing goal                        |
| `true_agenda`    | TEXT      |                           | Hidden goal (author-only)                 |
| `notes`          | TEXT      |                           |                                           |
| `created_at`     | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |                                           |

**Index:** `idx_group_name`

---

## 5. `lore_entities`

Catch-all for items, magic systems, technology, artifacts, creatures, materials. Categories defined in `project_config.lore_categories`.

| Column           | Type      | Constraints               | Description                                                 |
| ---------------- | --------- | ------------------------- | ----------------------------------------------------------- |
| `id`             | INTEGER   | PRIMARY KEY AUTOINCREMENT |                                                             |
| `name`           | TEXT      | NOT NULL                  | Display name                                                |
| `aliases`        | TEXT      |                           | JSON array                                                  |
| `category`       | TEXT      | NOT NULL                  | e.g. `mechanic`, `item`, `artifact`, `creature`, `material` |
| `classification` | TEXT      |                           | e.g. `Class IV Restricted`, `Common`, `Legendary`           |
| `description`    | TEXT      |                           |                                                             |
| `rules`          | TEXT      |                           | Hard constraints, physics, limitations                      |
| `limitations`    | TEXT      |                           | What it cannot do                                           |
| `origin`         | TEXT      |                           | Where it comes from                                         |
| `notes`          | TEXT      |                           |                                                             |
| `created_at`     | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |                                                             |
| `updated_at`     | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |                                                             |

**Indexes:** `idx_lore_name`, `idx_lore_category`

---

## 6. `locations`

Hierarchical location tree via self-referencing foreign key.

| Column               | Type      | Constraints                            | Description                 |
| -------------------- | --------- | -------------------------------------- | --------------------------- |
| `id`                 | INTEGER   | PRIMARY KEY AUTOINCREMENT              |                             |
| `name`               | TEXT      | NOT NULL                               | Display name                |
| `aliases`            | TEXT      |                                        | JSON array                  |
| `region`             | TEXT      |                                        | Broad geographic area       |
| `parent_location_id` | INTEGER   | FK -> locations(id) ON DELETE SET NULL | Parent location for nesting |
| `description`        | TEXT      |                                        |                             |
| `notes`              | TEXT      |                                        |                             |
| `created_at`         | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP              |                             |

**Indexes:** `idx_location_name`, `idx_location_parent`

---

## 7. `entity_appearances`

Junction table tracking which entities appear in which chapters. Auto-populated on chapter save by scanning markdown for `{{type:id|text}}` markers.

| Column                 | Type    | Constraints                                    | Description                              |
| ---------------------- | ------- | ---------------------------------------------- | ---------------------------------------- |
| `id`                   | INTEGER | PRIMARY KEY AUTOINCREMENT                      |                                          |
| `entity_type`          | TEXT    |                                                | `character`, `lore`, `location`, `group` |
| `entity_id`            | INTEGER | NOT NULL                                       | FK to the respective entity table        |
| `chapter_id`           | INTEGER | NOT NULL, FK -> chapters(id) ON DELETE CASCADE |                                          |
| `first_mention_offset` | INTEGER |                                                | Character position in markdown file      |

**Constraints:** `UNIQUE(entity_type, entity_id, chapter_id)` prevents duplicates.
**Indexes:** `idx_appearances_entity`, `idx_appearances_chapter`

---

## 8. `knowledge_states`

Epistemic filtering system. Tracks what each character knows and when they learned it. Used by the Entity Inspector's POV Filter mode to hide unknown details.

| Column               | Type      | Constraints                                      | Description                                   |
| -------------------- | --------- | ------------------------------------------------ | --------------------------------------------- |
| `id`                 | INTEGER   | PRIMARY KEY AUTOINCREMENT                        |                                               |
| `character_id`       | INTEGER   | NOT NULL, FK -> characters(id) ON DELETE CASCADE | Who knows this fact                           |
| `fact`               | TEXT      | NOT NULL                                         | The piece of knowledge                        |
| `source_entity_type` | TEXT      |                                                  | What entity this fact is about                |
| `source_entity_id`   | INTEGER   |                                                  | FK to the source entity                       |
| `learned_in_chapter` | INTEGER   | FK -> chapters(id) ON DELETE SET NULL            | `NULL` = knows from the start                 |
| `world_time`         | TEXT      |                                                  | In-universe time when character learned this  |
| `is_secret`          | INTEGER   | DEFAULT 0                                        | `1` = author-only, character cannot know this |
| `reveal_in_chapter`  | INTEGER   | FK -> chapters(id) ON DELETE SET NULL            | Planned reveal chapter                        |
| `notes`              | TEXT      |                                                  |                                               |
| `word_offset`        | INTEGER   |                                                  | Links fact to a textual position              |
| `created_at`         | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP                        |                                               |

**POV filtering query:**

```sql
SELECT fact FROM knowledge_states
WHERE character_id = :pov_id
  AND (learned_in_chapter <= :current_chapter OR learned_in_chapter IS NULL)
  AND is_secret = 0
```

**Indexes:** `idx_knowledge_char`, `idx_knowledge_chapter`, `idx_knowledge_source`

---

## 10. `twists`

Major plot reveals or secrets. Used in conjunction with foreshadowings to track narrative payoff on the timeline.

| Column                | Type      | Constraints                           | Description                                              |
| --------------------- | --------- | ------------------------------------- | -------------------------------------------------------- |
| `id`                  | INTEGER   | PRIMARY KEY AUTOINCREMENT             |                                                          |
| `title`               | TEXT      | NOT NULL                              | Twist title / name                                       |
| `description`         | TEXT      |                                       | Explanation                                              |
| `twist_type`          | TEXT      |                                       | Category or type of twist                                |
| `reveal_chapter_id`   | INTEGER   | FK -> chapters(id) ON DELETE SET NULL | The chapter where the reveal happens                     |
| `reveal_word_offset`  | INTEGER   |                                       | Precise word offset in the chapter                       |
| `characters_who_know` | TEXT      |                                       | JSON array of characters aware                           |
| `status`              | TEXT      | DEFAULT 'planned'                     | `planned`, `hinted`, `revealed`                          |
| `notes`               | TEXT      |                                       | Freeform notes                                           |
| `created_at`          | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP             |                                                          |

**Indexes:** `idx_twist_reveal`, `idx_twist_status`

---

## 11. `foreshadowings`

Precise markers linking a specific word offset in a chapter to a Twist. This powers the visual lines on the planner.

| Column          | Type      | Constraints                                 | Description                                              |
| --------------- | --------- | ------------------------------------------- | -------------------------------------------------------- |
| `id`            | INTEGER   | PRIMARY KEY AUTOINCREMENT                   |                                                          |
| `twist_id`      | INTEGER   | NOT NULL, FK -> twists(id) ON DELETE CASCADE | Twist this clues to                                      |
| `chapter_id`    | INTEGER   | NOT NULL, FK -> chapters(id) ON DELETE CASCADE | Chapter where clue is placed                             |
| `word_offset`   | INTEGER   | NOT NULL                                    | Spot in the chapter                                      |
| `selected_text` | TEXT      |                                             | The actual clue text                                     |
| `created_at`    | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP                   |                                                          |

**Indexes:** `idx_foreshadow_twist`, `idx_foreshadow_chapter`

---

## 12. `planner_settings` (Singleton)

Global planner states: cursor progress, visibility, and theme description.

| Column            | Type    | Constraints               | Description                                |
| ----------------- | ------- | ------------------------- | ------------------------------------------ |
| `id`              | INTEGER | PRIMARY KEY CHECK(id = 1) | Singleton table (id always 1)              |
| `theme`           | TEXT    | DEFAULT ''                | Max length 120                             |
| `cursor_pct`      | REAL    | DEFAULT 0                 | Current reading location out of 100%       |
| `writing_started` | INTEGER | DEFAULT 0                 | Boolean-as-int                             |
| `shadow_visible`  | INTEGER | DEFAULT 0                 | Toggles visibility of shadow layer elements|
| `updated_at`      | TEXT    | DEFAULT CURRENT_TIMESTAMP |                                            |

---

## 13. `planner_blocks`

Plot milestones and story beats in the planner.

| Column                 | Type    | Constraints                           | Description                               |
| ---------------------- | ------- | ------------------------------------- | ----------------------------------------- |
| `id`                   | TEXT    | PRIMARY KEY                           | UUID                                      |
| `layer`                | TEXT    | DEFAULT 'surface'                     | `surface` or `shadow`                     |
| `block_type`           | TEXT    | NOT NULL                              |                                           |
| `label`                | TEXT    | DEFAULT ''                            | Max length 50                             |
| `pct`                  | REAL    | NOT NULL                              | Horizontal position %                     |
| `lane`                 | INTEGER | DEFAULT 0                             | Vertical lane (0, 1, 2)                   |
| `chapter_id`           | INTEGER | FK -> chapters(id) ON DELETE SET NULL | Linked chapter                            |
| `chapter_status`       | TEXT    |                                       | Tracks chapter status                     |
| `added_during_writing` | INTEGER | DEFAULT 0                             |                                           |
| `sort_order`           | INTEGER | DEFAULT 0                             |                                           |
| `created_at`           | TEXT    | DEFAULT CURRENT_TIMESTAMP             |                                           |
| `updated_at`           | TEXT    | DEFAULT CURRENT_TIMESTAMP             |                                           |

**Indexes:** `idx_blocks_layer`, `idx_blocks_chapter`

---

## 14. `planner_arcs`

| Column        | Type    | Constraints                | Description                |
| ------------- | ------- | -------------------------- | -------------------------- |
| `id`          | TEXT    | PRIMARY KEY                | UUID                       |
| `layer`       | TEXT    | DEFAULT 'surface'          | `surface` or `shadow`      |
| `name`        | TEXT    | DEFAULT ''                 | Max length 24              |
| `description` | TEXT    | DEFAULT ''                 | Max length 80              |
| `color`       | TEXT    | DEFAULT '#d97706'          | Hex color                  |
| `start_pct`   | REAL    | NOT NULL DEFAULT 0         | Start %                    |
| `end_pct`     | REAL    | NOT NULL DEFAULT 100       | End %                      |
| `sort_order`  | INTEGER | DEFAULT 0                  |                            |
| `created_at`  | TEXT    | DEFAULT CURRENT_TIMESTAMP  |                            |
| `updated_at`  | TEXT    | DEFAULT CURRENT_TIMESTAMP  |                            |

**Indexes:** `idx_arcs_layer`

---

## 15. `character_relationships`

Tracks evolving dynamics between characters.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `character_id` | INTEGER | NOT NULL, FK -> characters(id) | Source character |
| `target_character_id` | INTEGER | NOT NULL, FK -> characters(id) | Target character |
| `rel_type` | TEXT | NOT NULL | Dynamic labels |
| `notes` | TEXT | | Author context |
| `chapter_id` | INTEGER | FK -> chapters(id) | Where the shift happened |
| `word_offset` | INTEGER | | Precise position |
| `world_time` | TEXT | | Custom world date |
| `is_one_sided` | INTEGER | DEFAULT 1 | 1=Unidirectional, 0=Mutual |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

---

## 16. `calendar_config`

Stores custom world-building calendar definitions.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `config_key` | TEXT | PRIMARY KEY | E.g., `months`, `seasons` |
| `config_value` | TEXT | | JSON or string values |

---

## 17. `stats` & `stat_logs`

**`stats`**: Global project metrics.
- `stat_key` (TEXT PK)
- `stat_value` (TEXT)

**`stat_logs`**: Daily activity feed.
- `timestamp`: AUTO PK
- `new_words`, `deleted_words`, `new_entities`, `deleted_entities`, `new_twists`
- `event_context`: Origin of the log (e.g., `chapter_save`)

---

## 18. `entity_mentions`

Precise tracking of entity markers within chapters. Powers the Entity Auditor.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY | |
| `entity_type` | TEXT | | `character`, `lore`, etc |
| `entity_id` | INTEGER | | |
| `chapter_id` | INTEGER | FK -> chapters(id) | |
| `word_offset` | INTEGER | | Precise location |

---

## 19. `achievements`

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (Hardcoded ID) |
| `unlocked_at` | TIMESTAMP | Timestamp of completion |

---

## 20. `history_entries`

Timeline events for the world-building visualization.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY |
| `entity_type` | TEXT | |
| `entity_id` | INTEGER | |
| `title` | TEXT | |
| `event_type` | TEXT | |
| `date_year` | INTEGER | |
| `date_month` | INTEGER | |
| `date_day` | INTEGER | |
| `date_precise`| INTEGER | Boolean check |

---

## 21. `world_times` (Time Overrides)

Lets writers mark paragraph ranges as flashbacks, timeskips, or memories with a different in-universe date.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `chapter_id` | INTEGER | NOT NULL, FK -> chapters(id) ON DELETE CASCADE | |
| `world_date` | TEXT | NOT NULL | Custom world date string |
| `label` | TEXT | | User description |
| `color_index` | INTEGER | NOT NULL DEFAULT 0 | Color for the time gutter |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | |

---

## 22. `boards` (Sketchboards)

Visual node-graph boards for mapping systems and relationships.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `name` | TEXT | NOT NULL DEFAULT 'New Board' | |
| `board_type` | TEXT | NOT NULL DEFAULT 'custom' | |
| `icon` | TEXT | DEFAULT '✦' | Clickable to pick symbols |
| `zoom` | REAL | DEFAULT 1.0 | |
| `pan_x` | REAL | DEFAULT 0.0 | |
| `pan_y` | REAL | DEFAULT 0.0 | |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | |

---

## 23. `board_items`

Nodes placed on a Sketchboard.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `board_id` | INTEGER | NOT NULL, FK -> boards(id) ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL | |
| `item_type` | TEXT | NOT NULL DEFAULT 'concept' | |
| `entity_id` | INTEGER | DEFAULT NULL | FK to entities if linked |
| `entity_type` | TEXT | DEFAULT NULL | |
| `description` | TEXT | DEFAULT '' | |
| `pos_x` | REAL | NOT NULL DEFAULT 0 | |
| `pos_y` | REAL | NOT NULL DEFAULT 0 | |
| `size_x` | REAL | NOT NULL DEFAULT 140 | |
| `size_y` | REAL | NOT NULL DEFAULT 60 | |
| `color` | TEXT | NOT NULL DEFAULT '#888888' | |
| `z_index` | INTEGER | NOT NULL DEFAULT 0 | |

**Index:** `idx_board_items_board`

---

## 24. `item_connections`

Lines drawn between Sketchboard nodes.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `board_id` | INTEGER | NOT NULL, FK -> boards(id) ON DELETE CASCADE | |
| `item_start_id` | INTEGER | NOT NULL, FK -> board_items(id) ON DELETE CASCADE | |
| `item_end_id` | INTEGER | NOT NULL, FK -> board_items(id) ON DELETE CASCADE | |
| `conn_type` | TEXT | NOT NULL DEFAULT 'solid' | |
| `conn_color` | TEXT | NOT NULL DEFAULT '#888888' | |
| `title` | TEXT | DEFAULT '' | |
| `directed` | INTEGER | NOT NULL DEFAULT 1 | 0 = bidirectional |
| `curve_offset` | REAL | NOT NULL DEFAULT 0.0 | |

**Index:** `idx_connections_board`

---

## Entity Relationship Diagram

```
project_config (standalone key-value store)
planner_settings (standalone singleton)

chapters ──FK──> characters (pov_character_id)
characters ──FK──> groups (group_id)
locations ──FK──> locations (parent_location_id, self-referencing)

entity_appearances ──FK──> chapters (chapter_id, CASCADE)
  links to: characters | lore_entities | locations | groups (via entity_type + entity_id)

knowledge_states ──FK──> characters (character_id, CASCADE)
knowledge_states ──FK──> chapters (learned_in_chapter, reveal_in_chapter)

secrets ──FK──> chapters (reveal_chapter_id)

twists ──FK──> chapters (reveal_chapter_id)
foreshadowings ──FK──> chapters (chapter_id)
foreshadowings ──FK──> twists (twist_id)

planner_blocks ──FK──> chapters (chapter_id)
```

---

## JSON Field Conventions

Several tables use TEXT columns to store JSON arrays:

| Table          | Column              | Format                             |
| -------------- | ------------------- | ---------------------------------- |
| characters     | aliases             | `["the Magistra", "Vael"]`         |
| groups         | aliases             | `["High Council"]`                 |
| lore_entities  | aliases             | `["the Compass"]`                  |
| locations      | aliases             | `["Academis Arcana"]`              |
| secrets        | characters_who_know | `[1, 3, 7]` (character IDs)        |
| secrets        | danger_phrases      | `["his true name"]`                |
| twists         | characters_who_know | `[1, 3, 7]` (character IDs)        |
| project_config | lore_categories     | `["mechanic", "item", "artifact"]` |

All JSON fields are stored with `json.dumps()` and parsed with `json.loads()` in the Python backend.

# FleshNote Database Schema (Version 2)

SQLite database at `{project_path}/fleshnote.db`. WAL mode enabled for concurrent reads.

All tables are always created regardless of feature toggles. Features are enabled/disabled via `project_config` entries, not schema changes.

Defined in `backend/db_setup.py`.

---

## 1. `project_config`

Key-value store for all project settings and UI toggles.

| Column         | Type             | Description                               |
| -------------- | ---------------- | ----------------------------------------- |
| `config_key`   | TEXT PRIMARY KEY | Setting identifier                        |
| `config_value` | TEXT             | Setting value (stringified)               |
| `config_type`  | TEXT             | One of: `toggle`, `label`, `meta`, `json` |

---

## 2. `chapters`

Core table for chapter management. Each chapter corresponds to a markdown file on disk.

| Column              | Type      | Constraints                             | Description                                                |
| ------------------- | --------- | --------------------------------------- | ---------------------------------------------------------- |
| `id`                | TEXT      | PRIMARY KEY (UUID v4)                   | Generated automatically or via Python                      |
| `chapter_number`    | INTEGER   | NOT NULL UNIQUE                         | Display/sort order                                         |
| `title`             | TEXT      |                                         | Chapter title                                              |
| `status`            | TEXT      |                                         | `planned`, `writing`, `draft`, `revised`, `final`          |
| `pov_character_id`  | TEXT      | FK -> characters(id) ON DELETE SET NULL | POV character for this chapter                             |
| `world_time`        | TEXT      |                                         | In-universe date (e.g. `"4E-314, Day 17"`)                 |
| `narrative_time`    | INTEGER   |                                         | Reading order position                                     |
| `word_count`        | INTEGER   | DEFAULT 0                               | Current word count                                         |
| `target_word_count` | INTEGER   | DEFAULT 4000                            | Target word count                                          |
| `md_filename`       | TEXT      |                                         | Filename in `md/` directory (e.g. `ch_004_the_arrival.md`) |
| `synopsis`          | TEXT      |                                         | Brief summary for author reference                         |
| `notes`             | TEXT      |                                         | Freeform author notes                                      |
| `deleted`           | INTEGER   | DEFAULT 0                               | Soft delete flag (1 = deleted)                             |
| `deleted_at`        | TEXT      |                                         | Soft delete timestamp                                      |
| `created_at`        | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP               |                                                            |
| `updated_at`        | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP               | Updated on every save                                      |

**Markdown files** stored at `{project_path}/md/{md_filename}`. Files contain entity markers in the format `{{char:uuid-string|Sophia}}`.

---

## 3. `characters`

Character profiles. All fields always present; optional fields toggled via `project_config`.

| Column         | Type      | Constraints                         | Description                                          |
| -------------- | --------- | ----------------------------------- | ---------------------------------------------------- |
| `id`           | TEXT      | PRIMARY KEY (UUID v4)               |                                                      |
| `name`         | TEXT      | NOT NULL                            | Display name                                         |
| `aliases`      | TEXT      |                                     | JSON array: `["the Magistra", "Vael"]`               |
| `role`         | TEXT      |                                     | `Protagonist`, `Antagonist`, `Supporting`, or custom |
| `status`       | TEXT      |                                     | `Alive`, `Dead`, `Unknown`                           |
| `species`      | TEXT      |                                     | Toggled by `track_species` config                    |
| `group_id`     | TEXT      | FK -> groups(id) ON DELETE SET NULL | Toggled by `track_groups` config                     |
| `surface_goal` | TEXT      |                                     | Public-facing goal (visible to readers)              |
| `true_goal`    | TEXT      |                                     | Hidden goal (author-only, shown in Author View)      |
| `bio`          | TEXT      |                                     | Character biography                                  |
| `notes`        | TEXT      |                                     | Author's private notes                               |
| `birth_date`   | TEXT      |                                     | In-universe birth date (custom calendar string)      |
| `deleted`      | INTEGER   | DEFAULT 0                               | Soft delete flag                                     |
| `deleted_at`   | TEXT      |                                     | Soft delete timestamp                                |
| `created_at`   | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP           |                                                      |
| `updated_at`   | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP           |                                                      |

---

## 4. `groups`

Factions, organizations, noble houses, crews, etc. UI label controlled by `project_config.group_label`.

| Column           | Type      | Constraints               | Description                               |
| ---------------- | --------- | ------------------------- | ----------------------------------------- |
| `id`             | TEXT      | PRIMARY KEY (UUID v4)     |                                           |
| `name`           | TEXT      | NOT NULL                  | Display name                              |
| `aliases`        | TEXT      |                           | JSON array                                |
| `group_type`     | TEXT      |                           | e.g. `military`, `religious`, `political` |
| `description`    | TEXT      |                           |                                           |
| `surface_agenda` | TEXT      |                           | Public-facing goal                        |
| `true_agenda`    | TEXT      |                           | Hidden goal (author-only)                 |
| `notes`          | TEXT      |                           |                                           |
| `deleted`        | INTEGER   | DEFAULT 0                 | Soft delete flag                          |
| `deleted_at`     | TEXT      |                           | Soft delete timestamp                     |
| `created_at`     | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |                                           |

---

## 5. `lore_entities`

Catch-all for items, magic systems, technology, artifacts, creatures, materials. Categories defined in `project_config.lore_categories`.

| Column           | Type      | Constraints               | Description                                                 |
| ---------------- | --------- | ------------------------- | ----------------------------------------------------------- |
| `id`             | TEXT      | PRIMARY KEY (UUID v4)     |                                                             |
| `name`           | TEXT      | NOT NULL                  | Display name                                                |
| `aliases`        | TEXT      |                           | JSON array                                                  |
| `category`       | TEXT      | NOT NULL                  | e.g. `mechanic`, `item`, `artifact`, `creature`, `material` |
| `classification` | TEXT      |                           | e.g. `Class IV Restricted`, `Common`, `Legendary`           |
| `description`    | TEXT      |                           |                                                             |
| `rules`          | TEXT      |                           | Hard constraints, physics, limitations                      |
| `limitations`    | TEXT      |                           | What it cannot do                                           |
| `origin`         | TEXT      |                           | Where it comes from                                         |
| `notes`          | TEXT      |                           |                                                             |
| `deleted`        | INTEGER   | DEFAULT 0                 | Soft delete flag                          |
| `deleted_at`     | TEXT      |                           | Soft delete timestamp                     |
| `created_at`     | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |                                                             |
| `updated_at`     | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |                                                             |

---

## 6. `locations`

Hierarchical location tree via self-referencing foreign key.

| Column               | Type      | Constraints                            | Description                 |
| -------------------- | --------- | -------------------------------------- | --------------------------- |
| `id`                 | TEXT      | PRIMARY KEY (UUID v4)                  |                             |
| `name`               | TEXT      | NOT NULL                               | Display name                |
| `aliases`            | TEXT      |                                        | JSON array                  |
| `region`             | TEXT      |                                        | Broad geographic area       |
| `parent_location_id` | TEXT      | FK -> locations(id) ON DELETE SET NULL | Parent location for nesting |
| `description`        | TEXT      |                                        |                             |
| `notes`              | TEXT      |                                        |                             |
| `deleted`            | INTEGER   | DEFAULT 0                              | Soft delete flag            |
| `deleted_at`         | TEXT      |                                        | Soft delete timestamp       |
| `created_at`         | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP              |                             |

---

## 6.5. `location_weather_states`

Tracks weather, temperature, and moisture for specific locations at specific world times.

| Column        | Type      | Constraints                          | Description                               |
| ------------- | --------- | ------------------------------------ | ----------------------------------------- |
| `id`          | TEXT      | PRIMARY KEY (UUID v4)                |                                           |
| `location_id` | TEXT      | NOT NULL, FK -> locations(id) CASCADE | The location this weather state applies to |
| `world_time`  | TEXT      | NOT NULL                             | In-universe date (e.g. `"4E-314, Day 17"`) |
| `weather`     | TEXT      |                                      | Current weather (e.g. `"Sunny"`, `"Rainy"`) |
| `temperature` | TEXT      |                                      | e.g. `"24°C"`, `"Cold"`                   |
| `moisture`    | TEXT      |                                      | e.g. `"Humid"`, `"Dry"`                   |
| `deleted`     | INTEGER   | DEFAULT 0                            | Soft delete flag                          |
| `deleted_at`  | TEXT      |                                      | Soft delete timestamp                     |
| `created_at`  | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP            |                                           |
| `updated_at`  | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP            |                                           |

---

## 7. `entity_appearances`

Junction table tracking which entities appear in which chapters. Auto-populated on chapter save.

| Column                 | Type    | Constraints                                    | Description                              |
| ---------------------- | ------- | ---------------------------------------------- | ---------------------------------------- |
| `id`                   | TEXT    | PRIMARY KEY (UUID v4)                          |                                          |
| `entity_type`          | TEXT    |                                                | `character`, `lore`, `location`, `group` |
| `entity_id`            | TEXT    | NOT NULL                                       | FK to the respective entity table        |
| `chapter_id`           | TEXT    | NOT NULL, FK -> chapters(id) ON DELETE CASCADE |                                          |
| `first_mention_offset` | INTEGER |                                                | Character position in markdown file      |

---

## 8. `knowledge_states`

Epistemic filtering system. Tracks what each character knows and when they learned it.

| Column               | Type      | Constraints                                      | Description                                   |
| -------------------- | --------- | ------------------------------------------------ | --------------------------------------------- |
| `id`                 | TEXT      | PRIMARY KEY (UUID v4)                            |                                               |
| `character_id`       | TEXT      | NOT NULL, FK -> characters(id) ON DELETE CASCADE | Who knows this fact                           |
| `fact`               | TEXT      | NOT NULL                                         | The piece of knowledge                        |
| `source_entity_type` | TEXT      |                                                  | What entity this fact is about                |
| `source_entity_id`   | TEXT      |                                                  | FK to the source entity                       |
| `learned_in_chapter` | TEXT      | FK -> chapters(id) ON DELETE SET NULL            | `NULL` = knows from the start                 |
| `world_time`         | TEXT      |                                                  | In-universe time when character learned this  |
| `is_secret`          | INTEGER   | DEFAULT 0                                        | `1` = author-only, character cannot know this |
| `reveal_in_chapter`  | TEXT      | FK -> chapters(id) ON DELETE SET NULL            | Planned reveal chapter                        |
| `notes`              | TEXT      |                                                  |                                               |
| `word_offset`        | INTEGER   |                                                  | Links fact to a textual position              |
| `created_at`         | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP                        |                                               |

---

## 10. `twists`

Major plot reveals or secrets. Used in conjunction with foreshadowings to track narrative payoff on the planner.

| Column                | Type      | Constraints                           | Description                                              |
| --------------------- | --------- | ------------------------------------- | -------------------------------------------------------- |
| `id`                  | TEXT      | PRIMARY KEY (UUID v4)                 | Twist ID                                                 |
| `title`               | TEXT      | NOT NULL                              | Twist title / name                                       |
| `description`         | TEXT      |                                       | Explanation                                              |
| `twist_type`          | TEXT      |                                       | Category or type of twist                                |
| `reveal_chapter_id`   | TEXT      | FK -> chapters(id) ON DELETE SET NULL | The chapter where the reveal happens                     |
| `reveal_word_offset`  | INTEGER   |                                       | Precise word offset in the chapter                       |
| `characters_who_know` | TEXT      |                                       | JSON array of character UUIDs                            |
| `status`              | TEXT      | DEFAULT 'planned'                     | `planned`, `hinted`, `revealed`                          |
| `notes`               | TEXT      |                                       | Freeform notes                                           |
| `deleted`             | INTEGER   | DEFAULT 0                             | Soft delete flag                                         |
| `deleted_at`          | TEXT      |                                       | Soft delete timestamp                                    |
| `created_at`          | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP             |                                                          |

---

## 11. `foreshadowings`

Precise markers linking a specific word offset in a chapter to a Twist.

| Column          | Type      | Constraints                                 | Description                                              |
| --------------- | --------- | ------------------------------------------- | -------------------------------------------------------- |
| `id`            | TEXT      | PRIMARY KEY (UUID v4)                       |                                                          |
| `twist_id`      | TEXT      | NOT NULL, FK -> twists(id) ON DELETE CASCADE | Twist this clues to                                      |
| `chapter_id`    | TEXT      | NOT NULL, FK -> chapters(id) ON DELETE CASCADE | Chapter where clue is placed                             |
| `word_offset`   | INTEGER   | NOT NULL                                    | Spot in the chapter                                      |
| `selected_text` | TEXT      |                                             | The actual clue text                                     |
| `deleted`       | INTEGER   | DEFAULT 0                                   | Soft delete flag                                         |
| `deleted_at`    | TEXT      |                                             | Soft delete timestamp                                    |
| `created_at`    | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP                   |                                                          |

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
| `chapter_id`           | TEXT    | FK -> chapters(id) ON DELETE SET NULL | Linked chapter                            |
| `chapter_status`       | TEXT    |                                       | Tracks chapter status                     |
| `added_during_writing` | INTEGER | DEFAULT 0                             |                                           |
| `sort_order`           | INTEGER | DEFAULT 0                             |                                           |
| `created_at`           | TEXT    | DEFAULT CURRENT_TIMESTAMP             |                                           |
| `updated_at`           | TEXT    | DEFAULT CURRENT_TIMESTAMP             |                                           |

---

## 14. `planner_arcs`

Visual arc representations on the planner.

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

---

## 15. `character_relationships`

Tracks evolving dynamics between characters.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | |
| `character_id` | TEXT | NOT NULL, FK -> characters(id) | Source character |
| `target_character_id` | TEXT | NOT NULL, FK -> characters(id) | Target character |
| `rel_type` | TEXT | NOT NULL | Dynamic labels |
| `notes` | TEXT | | Author context |
| `chapter_id` | TEXT | FK -> chapters(id) | Where the shift happened |
| `word_offset` | INTEGER | | Precise position |
| `world_time` | TEXT | | Custom world date |
| `is_one_sided` | INTEGER | DEFAULT 1 | 1=Unidirectional, 0=Mutual |
| `deleted` | INTEGER | DEFAULT 0 | Soft delete flag |
| `deleted_at` | TEXT | | Soft delete timestamp |
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
- `id` (TEXT PK UUID)
- `timestamp`: TIMESTAMP
- `new_words`, `deleted_words`, `new_entities`, `deleted_entities`, `new_twists`
- `event_context`: Origin of the log (e.g., `chapter_save`)

---

## 18. `entity_mentions`

Precise tracking of entity markers within chapters. Powers the Entity Auditor.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | |
| `entity_type` | TEXT | | `character`, `lore`, etc |
| `entity_id` | TEXT | | Target entity ID |
| `chapter_id` | TEXT | FK -> chapters(id) | Chapter ID |
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
| `id` | TEXT | PRIMARY KEY (UUID v4) |
| `entity_type` | TEXT | |
| `entity_id` | TEXT | |
| `title` | TEXT | |
| `event_type` | TEXT | |
| `date_year` | INTEGER | |
| `date_month` | INTEGER | |
| `date_day` | INTEGER | |
| `date_precise`| INTEGER | Boolean check |
| `related_entity_type`| TEXT | Polymorphic type |
| `related_entity_id`| TEXT | Polymorphic ID |

---

## 21. `world_times` (Time Overrides)

Paragraph ranges marked as flashbacks, timeskips, or memories.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | |
| `chapter_id` | TEXT | NOT NULL, FK -> chapters(id) ON DELETE CASCADE | |
| `world_date` | TEXT | NOT NULL | Custom world date string |
| `label` | TEXT | | User description |
| `color_index` | INTEGER | NOT NULL DEFAULT 0 | Color index |
| `deleted` | INTEGER | DEFAULT 0 | Soft delete flag |
| `deleted_at` | TEXT | | Soft delete timestamp |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | |

---

## 22. `boards` (Sketchboards)

Visual node-graph boards for mapping systems and relationships.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | |
| `name` | TEXT | NOT NULL DEFAULT 'New Board' | |
| `board_type` | TEXT | NOT NULL DEFAULT 'custom' | |
| `icon` | TEXT | DEFAULT '✦' | |
| `zoom` | REAL | DEFAULT 1.0 | |
| `pan_x` | REAL | DEFAULT 0.0 | |
| `pan_y` | REAL | DEFAULT 0.0 | |
| `deleted` | INTEGER | DEFAULT 0 | Soft delete flag |
| `deleted_at` | TEXT | | Soft delete timestamp |
| `created_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TEXT | DEFAULT CURRENT_TIMESTAMP | |

---

## 23. `board_items`

Nodes placed on a Sketchboard.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | |
| `board_id` | TEXT | NOT NULL, FK -> boards(id) ON DELETE CASCADE | |
| `name` | TEXT | NOT NULL | |
| `item_type` | TEXT | NOT NULL DEFAULT 'concept' | |
| `entity_id` | TEXT | DEFAULT NULL | Linked entity ID |
| `entity_type` | TEXT | DEFAULT NULL | |
| `description` | TEXT | DEFAULT '' | |
| `pos_x` | REAL | NOT NULL DEFAULT 0 | |
| `pos_y` | REAL | NOT NULL DEFAULT 0 | |
| `size_x` | REAL | NOT NULL DEFAULT 140 | |
| `size_y` | REAL | NOT NULL DEFAULT 60 | |
| `color` | TEXT | NOT NULL DEFAULT '#888888' | |
| `z_index` | INTEGER | NOT NULL DEFAULT 0 | |
| `deleted` | INTEGER | DEFAULT 0 | Soft delete flag |
| `deleted_at` | TEXT | | Soft delete timestamp |

---

## 24. `item_connections`

Lines drawn between Sketchboard nodes.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | |
| `board_id` | TEXT | NOT NULL, FK -> boards(id) ON DELETE CASCADE | |
| `item_start_id` | TEXT | NOT NULL, FK -> board_items(id) ON DELETE CASCADE | |
| `item_end_id` | TEXT | NOT NULL, FK -> board_items(id) ON DELETE CASCADE | |
| `conn_type` | TEXT | NOT NULL DEFAULT 'solid' | |
| `conn_color` | TEXT | NOT NULL DEFAULT '#888888' | |
| `title` | TEXT | DEFAULT '' | |
| `directed` | INTEGER | NOT NULL DEFAULT 1 | |
| `curve_offset` | REAL | NOT NULL DEFAULT 0.0 | |
| `deleted` | INTEGER | DEFAULT 0 | Soft delete flag |
| `deleted_at` | TEXT | | Soft delete timestamp |

---

## 25. `quick_notes`

Short, contextual text notes.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | |
| `content` | TEXT | NOT NULL | The text content |
| `note_type` | TEXT | NOT NULL DEFAULT 'Note' | |
| `deleted` | INTEGER | DEFAULT 0 | Soft delete flag |
| `deleted_at` | TEXT | | Soft delete timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

---

## 26. `annotations`

Short inline review comments / notes.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | |
| `content` | TEXT | NOT NULL | |
| `deleted` | INTEGER | DEFAULT 0 | Soft delete flag |
| `deleted_at` | TEXT | | Soft delete timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | |

---

## 27. `change_log`

Offline-sync audit log for the planned companion app. Column-level Last-Writer-Wins: one
row per changed column, storing the **new value** stamped with a Hybrid Logical Clock.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | |
| `table_name` | TEXT | NOT NULL | Target table name |
| `row_id` | TEXT | NOT NULL | ID of the modified row |
| `column_name` | TEXT | NOT NULL | Which column changed |
| `value` | TEXT | | New value (stringified; `NULL` for tombstoned/cleared) |
| `hlc` | TEXT | NOT NULL | Hybrid Logical Clock stamp — LWW ordering key |
| `device_id` | TEXT | NOT NULL | Origin device that made the change |
| `origin` | TEXT | NOT NULL | Change source (e.g. `desktop`) |

---

## 28. `pentimento_sessions`

One row per writing session for a chapter (the "Process" tab telemetry). Sessions are
sealed with a SHA-256 chain hash (`previous_session_hash` -> `session_hash`) for a
tamper-evident receipt, and their ops may later be compacted into `summary_json`.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | Session ID |
| `chapter_id` | TEXT | NOT NULL, FK -> chapters(id) ON DELETE CASCADE | |
| `device_id` | TEXT | NOT NULL | Device the session was written on |
| `session_num` | INTEGER | NOT NULL | Per-chapter ordinal (1, 2, 3, …) |
| `start_time` | TEXT | NOT NULL | ISO timestamp when the session opened |
| `end_time` | TEXT | | ISO timestamp when the session was sealed |
| `previous_session_hash` | TEXT | | Prior session's `session_hash` (chain link) |
| `session_hash` | TEXT | | SHA-256 sealing this session's ops |
| `summary_json` | TEXT | | Compacted aggregate totals once raw ops are pruned |
| `created_at` | TEXT | DEFAULT `datetime('now')` | |

---

## 29. `pentimento_ops`

Coalesced writing operations — **runs**, not raw keystrokes (consecutive typing in one
paragraph is merged into a single op with a `duration_ms`). Drives the per-paragraph
heatmap and the replay pacing overlay. Deleted for compacted sessions (see `summary_json`).

> Note: ops are deltas only, with no baseline text, so past prose is **not** reconstructable
> from this table — the replay reconstructs content from `chapter_snapshots` and uses ops
> purely for typing rhythm. See `docs/PENTIMENTO.md`.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | Op ID |
| `session_id` | TEXT | NOT NULL, FK -> pentimento_sessions(id) ON DELETE CASCADE | |
| `chapter_id` | TEXT | NOT NULL, FK -> chapters(id) ON DELETE CASCADE | |
| `timestamp` | TEXT | NOT NULL | ISO timestamp of the run |
| `op_type` | TEXT | NOT NULL | `insert`, `delete`, `paste`, `pause` |
| `para_index` | INTEGER | NOT NULL | Paragraph index within the chapter |
| `char_offset` | INTEGER | NOT NULL | Character offset within that paragraph |
| `length` | INTEGER | DEFAULT 0 | Characters affected |
| `text_content` | TEXT | | Text inserted/deleted (deletes may be stored reversed) |
| `duration_ms` | INTEGER | DEFAULT 0 | Time spent on this coalesced run |
| `origin` | TEXT | NOT NULL | Capture source (e.g. `desktop`) |

---

## 30. `chapter_snapshots`

Full-text prose snapshots — the ground truth for history rollback and replay. Stores the
chapter's markdown (zlib-compressed) at each session boundary, plus manual pins and
pre-restore safety copies. Session snapshots dedup on `prose_hash`; manual/pre-restore
snapshots are always kept.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PRIMARY KEY (UUID v4) | Snapshot ID |
| `chapter_id` | TEXT | NOT NULL, FK -> chapters(id) ON DELETE CASCADE | |
| `created_at` | TEXT | NOT NULL | ISO timestamp |
| `kind` | TEXT | NOT NULL | `session` (auto), `manual` (pinned), `pre_restore` (undo safety) |
| `label` | TEXT | | Optional user label for a manual pin |
| `word_count` | INTEGER | DEFAULT 0 | Word count at snapshot time |
| `prose_hash` | TEXT | NOT NULL | SHA-256 of the markdown (dedup + ancestry) |
| `content_gz` | BLOB | NOT NULL | zlib-compressed markdown (canonical on-disk form) |
| `byte_size` | INTEGER | DEFAULT 0 | `len(content_gz)`, for storage accounting |
| `session_id` | TEXT | | Linked sealed session (session snapshots only; nullable) |
| `session_hash` | TEXT | | Receipt linkage (nullable) |
| `device_id` | TEXT | NOT NULL | Device that created the snapshot |

Indexed by `idx_chapter_snapshots_chapter` on `(chapter_id, created_at)`.

---

## 31. `sync_meta`

Single-row (`id = 1`) local sync state for the planned companion app.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY, CHECK (`id = 1`) | Enforces a single row |
| `last_hlc` | TEXT | | Highest Hybrid Logical Clock stamp seen locally |
| `version_vector` | TEXT | DEFAULT `'{}'` | Per-device version vector (JSON) |

---

## JSON Field Conventions

Several tables use TEXT columns to store JSON arrays:

| Table          | Column              | Format                             |
| -------------- | ------------------- | ---------------------------------- |
| characters     | aliases             | `["the Magistra", "Vael"]`         |
| groups         | aliases             | `["High Council"]`                 |
| lore_entities  | aliases             | `["the Compass"]`                  |
| locations      | aliases             | `["Academis Arcana"]`              |
| twists         | characters_who_know | `["uuid1", "uuid2"]` (char UUIDs)  |
| project_config | lore_categories     | `["mechanic", "item", "artifact"]` |

All JSON fields are stored with `json.dumps()` and parsed with `json.loads()` in the Python backend.

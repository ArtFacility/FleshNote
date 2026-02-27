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
| `track_milestones`       | toggle | `"true"`                         | Enable milestone tracking             |
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
| `is_secret`          | INTEGER   | DEFAULT 0                                        | `1` = author-only, character cannot know this |
| `reveal_in_chapter`  | INTEGER   | FK -> chapters(id) ON DELETE SET NULL            | Planned reveal chapter                        |
| `notes`              | TEXT      |                                                  |                                               |
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

## 9. `milestones`

Plot points with prerequisites. Prerequisites stored as JSON for Phase 1 flexibility.

| Column              | Type      | Constraints                           | Description                                               |
| ------------------- | --------- | ------------------------------------- | --------------------------------------------------------- |
| `id`                | INTEGER   | PRIMARY KEY AUTOINCREMENT             |                                                           |
| `title`             | TEXT      | NOT NULL                              | Milestone title                                           |
| `description`       | TEXT      |                                       |                                                           |
| `target_chapter_id` | INTEGER   | FK -> chapters(id) ON DELETE SET NULL | Chapter where this should trigger                         |
| `prerequisites`     | TEXT      |                                       | JSON array: `["violation_count >= 3", "knows_secret_12"]` |
| `status`            | TEXT      |                                       | `pending`, `ready`, `triggered`, `abandoned`              |
| `priority`          | TEXT      |                                       | `low`, `normal`, `high`, `critical`                       |
| `notes`             | TEXT      |                                       |                                                           |
| `created_at`        | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP             |                                                           |

**Indexes:** `idx_milestone_chapter`, `idx_milestone_status`

---

## 10. `secrets`

Hidden information tied to the epistemic system. Phase 2 AI features use `danger_phrases` to detect accidental reveals in prose.

| Column                | Type      | Constraints                           | Description                                              |
| --------------------- | --------- | ------------------------------------- | -------------------------------------------------------- |
| `id`                  | INTEGER   | PRIMARY KEY AUTOINCREMENT             |                                                          |
| `title`               | TEXT      | NOT NULL                              | e.g. `"Mystery POV is Bob"`                              |
| `description`         | TEXT      |                                       |                                                          |
| `secret_type`         | TEXT      |                                       | `identity`, `motive`, `event`, `ability`, `relationship` |
| `reveal_chapter_id`   | INTEGER   | FK -> chapters(id) ON DELETE SET NULL | When it gets revealed                                    |
| `characters_who_know` | TEXT      |                                       | JSON array of character IDs                              |
| `danger_phrases`      | TEXT      |                                       | JSON array: `["his true name", "the real heir"]`         |
| `status`              | TEXT      |                                       | `hidden`, `hinted`, `revealed`                           |
| `notes`               | TEXT      |                                       |                                                          |
| `created_at`          | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP             |                                                          |

**Indexes:** `idx_secret_reveal`, `idx_secret_status`

---

## Entity Relationship Diagram

```
project_config (standalone key-value store)

chapters ──FK──> characters (pov_character_id)
characters ──FK──> groups (group_id)
locations ──FK──> locations (parent_location_id, self-referencing)

entity_appearances ──FK──> chapters (chapter_id, CASCADE)
  links to: characters | lore_entities | locations | groups (via entity_type + entity_id)

knowledge_states ──FK──> characters (character_id, CASCADE)
knowledge_states ──FK──> chapters (learned_in_chapter, reveal_in_chapter)

milestones ──FK──> chapters (target_chapter_id)

secrets ──FK──> chapters (reveal_chapter_id)
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
| milestones     | prerequisites       | `["violation_count >= 3"]`         |
| secrets        | characters_who_know | `[1, 3, 7]` (character IDs)        |
| secrets        | danger_phrases      | `["his true name"]`                |
| project_config | lore_categories     | `["mechanic", "item", "artifact"]` |

All JSON fields are stored with `json.dumps()` and parsed with `json.loads()` in the Python backend.

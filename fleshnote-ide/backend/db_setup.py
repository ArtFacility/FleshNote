"""
FleshNote IDE — Project Database Generator
Phase 1: No AI, pure SQLite + config-driven UI toggling.

Usage:
    from fleshnote_db import generate_project_db, run_onboarding

    # Interactive CLI onboarding (or wire this into your Electron frontend)
    answers = run_onboarding()

    # Generate the database
    db_path = generate_project_db("/path/to/project", answers)
"""

import sqlite3
import os
import json
from datetime import datetime


# ─── GENRE PRESETS ────────────────────────────────────────────────────────────
# These auto-fill sensible defaults so the user doesn't have to configure
# everything from scratch. They can override any of these in the questionnaire.

GENRE_PRESETS = {
    "fantasy": {
        "track_species": True,
        "species_label": "Species",
        "core_mechanic": "magic",
        "mechanic_label": "Magic System",
        "track_groups": True,
        "group_label": "Factions",
        "track_knowledge": True,
        "track_dual_timeline": True,
        "default_lore_categories": ["mechanic", "item", "artifact", "creature", "material"],
    },
    "sci-fi": {
        "track_species": True,
        "species_label": "Species",
        "core_mechanic": "tech",
        "mechanic_label": "Technology",
        "track_groups": True,
        "group_label": "Organizations",
        "track_knowledge": True,
        "track_dual_timeline": True,
        "default_lore_categories": ["tech", "item", "weapon", "vehicle", "material"],
    },
    "romance": {
        "track_species": False,
        "species_label": "Species",
        "core_mechanic": "none",
        "mechanic_label": "",
        "track_groups": False,
        "group_label": "Social Circles",
        "track_knowledge": True,
        "track_dual_timeline": False,
        "default_lore_categories": ["item", "tradition", "location_detail"],
    },
    "thriller": {
        "track_species": False,
        "species_label": "Species",
        "core_mechanic": "none",
        "mechanic_label": "",
        "track_groups": True,
        "group_label": "Organizations",
        "track_knowledge": True,  # Thrillers NEED epistemic tracking
        "track_dual_timeline": True,  # Flashbacks, reveals, etc.
        "default_lore_categories": ["item", "evidence", "weapon", "document"],
    },
    "custom": {
        "track_species": False,
        "species_label": "Species",
        "core_mechanic": "none",
        "mechanic_label": "",
        "track_groups": False,
        "group_label": "Groups",
        "track_knowledge": True,
        "track_dual_timeline": False,
        "default_lore_categories": ["item"],
    },
}


# ─── ONBOARDING QUESTIONNAIRE ────────────────────────────────────────────────
# In production, this is a React wizard in Electron. This CLI version
# mirrors the same questions for testing and backend validation.


def run_onboarding() -> dict:
    """
    Interactive CLI onboarding. Returns a config dict that gets passed
    to generate_project_db(). In the real app, the React frontend collects
    these answers and POSTs them to the /api/project/create endpoint.
    """
    print("\n" + "=" * 60)
    print("  FLESHNOTE — New Project Setup")
    print("=" * 60)

    answers = {}

    # ── Project Metadata ──────────────────────────────────────
    answers["project_name"] = input("\n  Project name: ").strip() or "Untitled Project"
    answers["author_name"] = input("  Author name: ").strip() or "Anonymous"

    # ── Genre Baseline ────────────────────────────────────────
    print("\n  Genre baseline (sets sensible defaults, fully overridable):")
    print("    1. Fantasy")
    print("    2. Sci-Fi")
    print("    3. Romance")
    print("    4. Thriller")
    print("    5. Custom (blank slate)")

    genre_map = {"1": "fantasy", "2": "sci-fi", "3": "romance", "4": "thriller", "5": "custom"}
    genre_choice = input("  Select [1-5]: ").strip()
    genre = genre_map.get(genre_choice, "custom")
    answers["genre"] = genre

    # Load preset defaults
    preset = GENRE_PRESETS[genre].copy()

    # ── Species Tracking ──────────────────────────────────────
    species_default = "Y" if preset["track_species"] else "N"
    species_input = input(f"\n  Track species/race? [{species_default}] (Y/N): ").strip().upper()
    if species_input:
        answers["track_species"] = species_input == "Y"
    else:
        answers["track_species"] = preset["track_species"]

    if answers["track_species"]:
        label = input(f'  Label for species field? ["{preset["species_label"]}"]: ').strip()
        answers["species_label"] = label if label else preset["species_label"]
    else:
        answers["species_label"] = preset["species_label"]

    # ── Core Mechanic ─────────────────────────────────────────
    print(f'\n  Core mechanic system? (current default: {preset["core_mechanic"]})')
    print("    1. Magic")
    print("    2. Tech")
    print("    3. None")

    mech_map = {"1": "magic", "2": "tech", "3": "none"}
    mech_default = {"magic": "1", "tech": "2", "none": "3"}.get(preset["core_mechanic"], "3")
    mech_input = input(f"  Select [1-3] (default {mech_default}): ").strip()
    answers["core_mechanic"] = mech_map.get(mech_input, preset["core_mechanic"])

    if answers["core_mechanic"] != "none":
        default_label = preset["mechanic_label"]
        if answers["core_mechanic"] == "magic" and default_label == "Technology":
            default_label = "Magic System"
        elif answers["core_mechanic"] == "tech" and default_label == "Magic System":
            default_label = "Technology"

        label = input(f'  Custom label for mechanics? ["{default_label}"] (e.g., "Bending", "Cyberware"): ').strip()
        answers["mechanic_label"] = label if label else default_label
    else:
        answers["mechanic_label"] = ""

    # ── Group/Faction Tracking ────────────────────────────────
    group_default = "Y" if preset["track_groups"] else "N"
    group_input = input(f"\n  Track groups/factions? [{group_default}] (Y/N): ").strip().upper()
    if group_input:
        answers["track_groups"] = group_input == "Y"
    else:
        answers["track_groups"] = preset["track_groups"]

    if answers["track_groups"]:
        label = input(f'  Label for groups? ["{preset["group_label"]}"] (e.g., "Noble Houses", "Corporations"): ').strip()
        answers["group_label"] = label if label else preset["group_label"]
    else:
        answers["group_label"] = preset["group_label"]

    # ── Advanced Features ─────────────────────────────────────
    # Advanced Features
    print("\n  Advanced features (recommended for complex narratives):")

    # Knowledge states / epistemic filtering
    ks_default = "Y" if preset["track_knowledge"] else "N"
    ks_input = input(f"  Enable epistemic filtering (who knows what)? [{ks_default}] (Y/N): ").strip().upper()
    answers["track_knowledge"] = (ks_input == "Y") if ks_input else preset["track_knowledge"]

    # Dual timeline
    dt_default = "Y" if preset["track_dual_timeline"] else "N"
    dt_input = input(f"  Track dual timeline (world time vs narrative time)? [{dt_default}] (Y/N): ").strip().upper()
    answers["track_dual_timeline"] = (dt_input == "Y") if dt_input else preset["track_dual_timeline"]

    # ── Chapter Targets ───────────────────────────────────────
    target = input("\n  Default word target per chapter? [4000]: ").strip()
    answers["default_chapter_target"] = int(target) if target.isdigit() else 4000

    # ── Lore Categories ───────────────────────────────────────
    print(f'\n  Default lore categories for this genre: {preset["default_lore_categories"]}')
    extra = input("  Add extra categories? (comma-separated, or Enter to skip): ").strip()
    answers["lore_categories"] = preset["default_lore_categories"].copy()
    if extra:
        answers["lore_categories"].extend([c.strip().lower() for c in extra.split(",") if c.strip()])

    # ── Summary ───────────────────────────────────────────────
    print("\n" + "-" * 60)
    print(f"  Project:    {answers['project_name']}")
    print(f"  Genre:      {genre}")
    print(f"  Species:    {'ON' if answers['track_species'] else 'OFF'}")
    print(f"  Mechanic:   {answers.get('mechanic_label', 'None') or 'None'}")
    print(f"  Groups:     {'ON — ' + answers['group_label'] if answers['track_groups'] else 'OFF'}")
    print(f"  Epistemic:  {'ON' if answers['track_knowledge'] else 'OFF'}")
    print(f"  Dual Time:  {'ON' if answers['track_dual_timeline'] else 'OFF'}")
    print(f"  Ch. Target: {answers['default_chapter_target']} words")
    print(f"  Lore Cats:  {answers['lore_categories']}")
    print("-" * 60)

    confirm = input("\n  Confirm? (Y/N): ").strip().upper()
    if confirm != "Y":
        print("  Aborted.")
        return {}

    return answers


# ─── DATABASE GENERATOR ──────────────────────────────────────────────────────


def generate_project_db(project_path: str, answers: dict) -> str:
    """
    Builds the SQLite database with a kitchen-sink schema.
    All tables are always created. The config table controls what the
    frontend shows/hides, so users can retroactively enable features
    without needing schema migrations.

    Args:
        project_path: Directory where fleshnote.db will be created.
        answers: Dict from run_onboarding() or from the React frontend POST.

    Returns:
        Path to the created database file.
    """
    if not answers:
        raise ValueError("No onboarding answers provided.")

    os.makedirs(project_path, exist_ok=True)
    db_path = os.path.join(project_path, "fleshnote.db")
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL;")  # Better concurrent read performance
    conn.execute("PRAGMA foreign_keys=ON;")
    cursor = conn.cursor()

    # ══════════════════════════════════════════════════════════
    # TABLE 1: PROJECT CONFIG
    # The brain of the UI. Every toggle, label, and preference
    # lives here. The frontend reads this on load and adjusts
    # its layout accordingly. No migrations needed — just flip
    # a config row and the UI adapts.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS project_config (
            config_key   TEXT PRIMARY KEY,
            config_value TEXT,
            config_type  TEXT  -- 'toggle', 'label', 'meta', 'json'
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 2: CHAPTERS
    # The backbone of the entire app. Every feature — progress
    # bar, chunk loading, POV assignment, dual timeline, word
    # count tracking — reads from this table.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chapters (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            chapter_number      INTEGER NOT NULL UNIQUE,
            title               TEXT,
            status              TEXT    DEFAULT 'planned',
                                        -- planned | writing | draft | revised | final
            pov_character_id    INTEGER,
            world_time          TEXT,    -- in-universe date, e.g. '4E-314, 3rd Moon, Day 17'
            narrative_time      INTEGER, -- ordinal: reading order position
            word_count          INTEGER DEFAULT 0,
            target_word_count   INTEGER DEFAULT 4000,
            md_filename         TEXT,    -- e.g. 'ch_004_second_violation.md'
            synopsis            TEXT,    -- brief chapter summary for the author
            notes               TEXT,    -- freeform author notes
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pov_character_id) REFERENCES characters(id)
                ON DELETE SET NULL
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 3: CHARACTERS
    # Kitchen-sink design. Fields like species are always present
    # in the schema but hidden in the UI via project_config
    # toggles. This means enabling species tracking 6 chapters
    # in is just a config flip, not a migration.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS characters (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            aliases         TEXT,    -- JSON array: ["the Magistra", "Vael", "First Circle"]
                                     -- Used by linkification engine to match all references
            role            TEXT,    -- e.g. 'Protagonist', 'Antagonist', 'Supporting'
            status          TEXT,    -- e.g. 'Alive', 'Dead', 'Unknown'
            species         TEXT,    -- Toggled via config: track_species
            group_id        INTEGER, -- FK to groups table, toggled via config: track_groups
            surface_goal    TEXT,    -- What they say they want
            true_goal       TEXT,    -- What they actually want (author-only)
            bio             TEXT,
            notes           TEXT,    -- Freeform author notes
            birth_date      TEXT,    -- In-universe birth date (custom calendar string)
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id)
                ON DELETE SET NULL
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 4: GROUPS / FACTIONS
    # A single flexible table for any organizational structure:
    # factions, noble houses, corporations, cults, crews, etc.
    # The label is controlled by project_config -> group_label.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            aliases         TEXT,    -- JSON array for linkification
            group_type      TEXT,    -- sub-category if needed (e.g. 'military', 'religious')
            description     TEXT,
            surface_agenda  TEXT,    -- Public-facing goal
            true_agenda     TEXT,    -- Hidden goal (author-only)
            notes           TEXT,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 5: LORE ENTITIES
    # Catch-all for items, magic systems, tech, artifacts,
    # materials, creatures, etc. The 'category' field is
    # filterable, and available categories are stored in
    # project_config as a JSON array so users can add custom
    # ones at any time.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS lore_entities (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            aliases         TEXT,    -- JSON array for linkification
            category        TEXT NOT NULL,
                                     -- e.g. 'mechanic', 'item', 'artifact', 'creature'
            classification  TEXT,    -- e.g. 'Class IV Restricted', 'Common', 'Legendary'
            description     TEXT,
            rules           TEXT,    -- Hard constraints / physics / limitations
            limitations     TEXT,    -- What it CAN'T do (just as important)
            origin          TEXT,    -- Where it comes from
            notes           TEXT,    -- Freeform author notes
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 6: LOCATIONS
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT NOT NULL,
            aliases         TEXT,    -- JSON array for linkification
            region          TEXT,
            parent_location_id INTEGER, -- For hierarchical locations
                                        -- (room -> building -> city -> region)
            description     TEXT,
            notes           TEXT,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_location_id) REFERENCES locations(id)
                ON DELETE SET NULL
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 7: ENTITY APPEARANCES (Junction Table)
    # Many-to-many: tracks which entities appear in which
    # chapters. Powers the "Ch.1, Ch.3, Ch.5" tags in the
    # entity inspector and the cross-chapter search system.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS entity_appearances (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type     TEXT NOT NULL,
                             -- 'character', 'lore', 'location', 'group'
            entity_id       INTEGER NOT NULL,
            chapter_id      INTEGER NOT NULL,
            first_mention_offset INTEGER, -- Character position in the md file.
                                          -- Powers "jump to first mention" in search.
            FOREIGN KEY (chapter_id) REFERENCES chapters(id)
                ON DELETE CASCADE,
            UNIQUE(entity_type, entity_id, chapter_id)
                -- Prevent duplicate entries for same entity in same chapter
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 8: KNOWLEDGE STATES (Epistemic Filtering)
    # The killer feature. Tracks what each character knows and
    # when they learned it. The frontend queries this to filter
    # entity detail panels by the current POV character's
    # knowledge state.
    #
    # Query pattern for POV filtering:
    #   SELECT fact FROM knowledge_states
    #   WHERE character_id = :pov_id
    #     AND (learned_in_chapter <= :current_chapter
    #          OR learned_in_chapter IS NULL)
    #     AND is_secret = 0
    #
    # Toggled via config: track_knowledge
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_states (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id        INTEGER NOT NULL,
            fact                TEXT NOT NULL,
            source_entity_type  TEXT,    -- What entity this fact is about
                                         -- ('character', 'lore', 'location', 'group')
            source_entity_id    INTEGER, -- FK to the relevant entity
            learned_in_chapter  INTEGER, -- NULL = character knows from the start
            world_time          TEXT,    -- In-universe time when character learned this
                                         -- Used for world-time filtering in non-linear stories
            is_secret           INTEGER DEFAULT 0,
                                         -- 1 = author-only info the character CAN'T know
            reveal_in_chapter   INTEGER, -- Planned chapter for the reveal (author planning)
            notes               TEXT,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            word_offset         INTEGER, -- Optional, links fact to a textual position
            FOREIGN KEY (character_id) REFERENCES characters(id)
                ON DELETE CASCADE,
            FOREIGN KEY (learned_in_chapter) REFERENCES chapters(id)
                ON DELETE SET NULL,
            FOREIGN KEY (reveal_in_chapter) REFERENCES chapters(id)
                ON DELETE SET NULL
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 10: TWISTS
    # Major plot reveals or secrets. Used in conjunction with
    # foreshadowings to track narrative payoff on the timeline.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS twists (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            title               TEXT NOT NULL,
            description         TEXT,
            twist_type          TEXT,
            reveal_chapter_id   INTEGER,
            reveal_word_offset  INTEGER,
            characters_who_know TEXT,
            status              TEXT DEFAULT 'planned',
            notes               TEXT,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reveal_chapter_id) REFERENCES chapters(id)
                ON DELETE SET NULL
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 10.5: FORESHADOWINGS
    # Precise markers linking a specific word offset in a chapter
    # to a Twist. This powers the visual lines on the planner.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS foreshadowings (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            twist_id            INTEGER NOT NULL,
            chapter_id          INTEGER NOT NULL,
            word_offset         INTEGER NOT NULL,
            selected_text       TEXT,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (twist_id) REFERENCES twists(id)
                ON DELETE CASCADE,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id)
                ON DELETE CASCADE
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 11: PLANNER SETTINGS (Singleton)
    # Global planner states: cursor progress, visibility, and 
    # theme description.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS planner_settings (
            id              INTEGER PRIMARY KEY CHECK(id = 1),
            theme           TEXT DEFAULT '' CHECK(length(theme) <= 120),
            cursor_pct      REAL DEFAULT 0 CHECK(cursor_pct >= 0 AND cursor_pct <= 100),
            writing_started INTEGER DEFAULT 0,
            shadow_visible  INTEGER DEFAULT 0,
            updated_at      TEXT DEFAULT (datetime('now'))
        )
    """)
    # Seed the singleton on DB creation
    cursor.execute("INSERT OR IGNORE INTO planner_settings (id) VALUES (1)")

    # ══════════════════════════════════════════════════════════
    # TABLE 12: PLANNER BLOCKS
    # Plot milestones and story beats in the planner.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS planner_blocks (
            id                   TEXT PRIMARY KEY,
            layer                TEXT NOT NULL DEFAULT 'surface'
                                     CHECK(layer IN ('surface', 'shadow')),
            block_type           TEXT NOT NULL,
            label                TEXT DEFAULT '' CHECK(length(label) <= 50),
            pct                  REAL NOT NULL CHECK(pct >= 0 AND pct <= 100),
            lane                 INTEGER DEFAULT 0 CHECK(lane IN (0, 1, 2)),
            chapter_id           INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
            chapter_status       TEXT CHECK(chapter_status IN
                                     (NULL, 'planned', 'writing', 'draft', 'revised', 'final')),
            added_during_writing INTEGER DEFAULT 0,
            sort_order           INTEGER DEFAULT 0,
            created_at           TEXT DEFAULT (datetime('now')),
            updated_at           TEXT DEFAULT (datetime('now'))
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 13: PLANNER ARCS
    # Character arcs (surface) or hidden forces (shadow).
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS planner_arcs (
            id          TEXT PRIMARY KEY,
            layer       TEXT NOT NULL DEFAULT 'surface'
                            CHECK(layer IN ('surface', 'shadow')),
            name        TEXT DEFAULT '' CHECK(length(name) <= 24),
            description TEXT DEFAULT '' CHECK(length(description) <= 80),
            color       TEXT NOT NULL DEFAULT '#d97706',
            start_pct   REAL NOT NULL DEFAULT 0
                            CHECK(start_pct >= 0 AND start_pct <= 100),
            end_pct     REAL NOT NULL DEFAULT 100
                            CHECK(end_pct >= 0 AND end_pct <= 100),
            sort_order  INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now')),
            CHECK(start_pct < end_pct)
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 13.5: CHARACTER RELATIONSHIPS
    # Tracks dynamic relationships between characters over time.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS character_relationships (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id        INTEGER NOT NULL,
            target_character_id INTEGER NOT NULL,
            rel_type            TEXT NOT NULL,
            notes               TEXT,
            chapter_id          INTEGER,
            word_offset         INTEGER,
            world_time          TEXT,
            is_one_sided        INTEGER DEFAULT 1,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
            FOREIGN KEY (target_character_id) REFERENCES characters(id) ON DELETE CASCADE,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE: WORLD_TIMES (Paragraph-level time overrides)
    # Lets writers mark paragraph ranges as flashbacks, timeskips,
    # or memories with a different in-universe date.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS world_times (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            chapter_id  INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
            world_date  TEXT NOT NULL,
            label       TEXT,
            color_index INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)

    # ══════════════════════════════════════════════════════════
    # SKETCHBOARDS: boards, board_items, item_connections
    # Visual node-graph boards for mapping systems and relationships.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS boards (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL DEFAULT 'New Board',
            board_type TEXT NOT NULL DEFAULT 'custom',
            icon       TEXT DEFAULT '✦',
            zoom       REAL DEFAULT 1.0,
            pan_x      REAL DEFAULT 0.0,
            pan_y      REAL DEFAULT 0.0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS board_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            item_type   TEXT NOT NULL DEFAULT 'concept',
            entity_id   INTEGER DEFAULT NULL,
            entity_type TEXT DEFAULT NULL,
            description TEXT DEFAULT '',
            pos_x       REAL NOT NULL DEFAULT 0,
            pos_y       REAL NOT NULL DEFAULT 0,
            size_x      REAL NOT NULL DEFAULT 140,
            size_y      REAL NOT NULL DEFAULT 60,
            color       TEXT NOT NULL DEFAULT '#888888',
            z_index     INTEGER NOT NULL DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS item_connections (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id      INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
            item_start_id INTEGER NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
            item_end_id   INTEGER NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
            conn_type     TEXT NOT NULL DEFAULT 'solid',
            conn_color    TEXT NOT NULL DEFAULT '#888888',
            title         TEXT DEFAULT '',
            directed      INTEGER NOT NULL DEFAULT 1,
            curve_offset  REAL NOT NULL DEFAULT 0.0
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_board_items_board ON board_items(board_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_connections_board ON item_connections(board_id);")

    # ══════════════════════════════════════════════════════════
    # TABLE 15: STATS (Aggregated Statistics)
    # Simple key/value store for global project stats (e.g. days
    # writing, total focus time, etc.)
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stats (
            stat_key   TEXT PRIMARY KEY,
            stat_value TEXT
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 16: STAT_LOGS (Daily / Session Activity)
    # Tracks writing habits over time for the GitHub-style heatmap.
    # We store new_words and deleted_words separately at user request.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stat_logs (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            new_words         INTEGER DEFAULT 0,
            deleted_words     INTEGER DEFAULT 0,
            new_entities      INTEGER DEFAULT 0,
            deleted_entities  INTEGER DEFAULT 0,
            new_twists        INTEGER DEFAULT 0,
            event_context     TEXT -- e.g. "chapter_save", "focus_kamikaze", "project_init"
        )
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 17: ENTITY_MENTIONS (Precise Offset Tracking)
    # Logs exact word_offset for entity mentions in chapters
    # populated via TipTap frontend during autosaves.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS entity_mentions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type   TEXT NOT NULL,
            entity_id     INTEGER NOT NULL,
            chapter_id    INTEGER NOT NULL,
            word_offset   INTEGER NOT NULL,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
            -- Does not enforce UNIQUE on chapter_id because entities can appear multiple times
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS achievements (
            id TEXT PRIMARY KEY,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # ══════════════════════════════════════════════════════════
    # TRIGGER: UPDATE_BLOCK_CHAPTER_STATUS
    # Sync planner blocks when chapter status changes natively
    # ══════════════════════════════════════════════════════════
    
    cursor.execute("""
        CREATE TRIGGER IF NOT EXISTS update_block_chapter_status
        AFTER UPDATE OF status ON chapters
        BEGIN
            UPDATE planner_blocks
            SET chapter_status = NEW.status,
                updated_at = datetime('now')
            WHERE chapter_id = NEW.id;
        END;
    """)

    # ══════════════════════════════════════════════════════════
    # TABLE 14: CALENDAR CONFIG
    # Custom calendar system for worldbuilding. Stores the
    # full calendar definition as key/value pairs (same pattern
    # as project_config). Writers can define custom months,
    # week days, seasons, and epoch labels for their world.
    # Toggled via project_config: track_custom_calendar
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS calendar_config (
            config_key   TEXT PRIMARY KEY,
            config_value TEXT
        )
    """)

    calendar_defaults = [
        ("calendar_enabled", "false"),
        ("epoch_label", "Age"),
        ("months", json.dumps([
            {"name": "January", "days": 31},
            {"name": "February", "days": 28},
            {"name": "March", "days": 31},
            {"name": "April", "days": 30},
            {"name": "May", "days": 31},
            {"name": "June", "days": 30},
            {"name": "July", "days": 31},
            {"name": "August", "days": 31},
            {"name": "September", "days": 30},
            {"name": "October", "days": 31},
            {"name": "November", "days": 30},
            {"name": "December", "days": 31},
        ])),
        ("days_per_week", "7"),
        ("week_day_names", json.dumps(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])),
        ("seasons", json.dumps([
            {"name": "Spring", "start_month": 3},
            {"name": "Summer", "start_month": 6},
            {"name": "Autumn", "start_month": 9},
            {"name": "Winter", "start_month": 12},
        ])),
        ("story_start_year", str(answers.get("story_start_year", "2016"))),
        ("story_start_month", str(answers.get("story_start_month", "5"))),
        ("story_start_day", str(answers.get("story_start_day", "28"))),
    ]

    cursor.executemany(
        "INSERT OR IGNORE INTO calendar_config (config_key, config_value) VALUES (?, ?)",
        calendar_defaults,
    )

    # ══════════════════════════════════════════════════════════
    # HISTORY ENTRIES
    # Timeline events for entities (characters, locations, lore).
    # Tracks births, deaths, events, actions, and interactions
    # across the in-universe calendar for the history timeline.
    # ══════════════════════════════════════════════════════════

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history_entries (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type          TEXT NOT NULL,
            entity_id            INTEGER NOT NULL,
            title                TEXT NOT NULL,
            description          TEXT,
            event_type           TEXT NOT NULL,
            date_year            INTEGER NOT NULL,
            date_month           INTEGER,
            date_day             INTEGER,
            date_precise         INTEGER DEFAULT 0,
            related_entity_type  TEXT,
            related_entity_id    INTEGER,
            created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ══════════════════════════════════════════════════════════
    # INDEXES
    # Targeted indexes for the queries the frontend runs most:
    # - Entity linkification (name lookups across all tables)
    # - Chapter navigation
    # - Epistemic filtering
    # - Appearance tracking
    # ══════════════════════════════════════════════════════════

    indexes = [
        # Chapter lookups
        "CREATE INDEX IF NOT EXISTS idx_chapter_number ON chapters(chapter_number);",
        "CREATE INDEX IF NOT EXISTS idx_chapter_status ON chapters(status);",
        "CREATE INDEX IF NOT EXISTS idx_chapter_pov ON chapters(pov_character_id);",

        # Character name search (linkification engine)
        "CREATE INDEX IF NOT EXISTS idx_char_name ON characters(name);",

        # Lore lookups
        "CREATE INDEX IF NOT EXISTS idx_lore_name ON lore_entities(name);",
        "CREATE INDEX IF NOT EXISTS idx_lore_category ON lore_entities(category);",

        # Location lookups
        "CREATE INDEX IF NOT EXISTS idx_location_name ON locations(name);",
        "CREATE INDEX IF NOT EXISTS idx_location_parent ON locations(parent_location_id);",

        # Group lookups
        "CREATE INDEX IF NOT EXISTS idx_group_name ON groups(name);",

        # Appearance tracking (which entities appear where)
        "CREATE INDEX IF NOT EXISTS idx_appearances_entity ON entity_appearances(entity_type, entity_id);",
        "CREATE INDEX IF NOT EXISTS idx_appearances_chapter ON entity_appearances(chapter_id);",

        # Epistemic filtering (the hot query path)
        "CREATE INDEX IF NOT EXISTS idx_knowledge_char ON knowledge_states(character_id);",
        "CREATE INDEX IF NOT EXISTS idx_knowledge_chapter ON knowledge_states(character_id, learned_in_chapter);",
        "CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_states(source_entity_type, source_entity_id);",

        # Twists and foreshadowings
        "CREATE INDEX IF NOT EXISTS idx_twist_reveal ON twists(reveal_chapter_id);",
        "CREATE INDEX IF NOT EXISTS idx_twist_status ON twists(status);",
        "CREATE INDEX IF NOT EXISTS idx_foreshadow_twist ON foreshadowings(twist_id);",
        "CREATE INDEX IF NOT EXISTS idx_foreshadow_chapter ON foreshadowings(chapter_id);",

        # Planner indexes
        "CREATE INDEX IF NOT EXISTS idx_blocks_layer ON planner_blocks(layer);",
        "CREATE INDEX IF NOT EXISTS idx_blocks_chapter ON planner_blocks(chapter_id);",
        "CREATE INDEX IF NOT EXISTS idx_arcs_layer ON planner_arcs(layer);",

        # Stats indexes
        "CREATE INDEX IF NOT EXISTS idx_stat_logs_timestamp ON stat_logs(timestamp);",
        "CREATE INDEX IF NOT EXISTS idx_entity_mentions_chapter ON entity_mentions(chapter_id);",
        "CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON entity_mentions(entity_type, entity_id);",

        # History timeline indexes
        "CREATE INDEX IF NOT EXISTS idx_history_entity ON history_entries(entity_type, entity_id);",
        "CREATE INDEX IF NOT EXISTS idx_history_event_type ON history_entries(event_type);",
        "CREATE INDEX IF NOT EXISTS idx_history_date ON history_entries(date_year);",
    ]

    for idx in indexes:
        cursor.execute(idx)

    # ══════════════════════════════════════════════════════════
    # POPULATE CONFIG FROM QUESTIONNAIRE ANSWERS
    # ══════════════════════════════════════════════════════════

    configs = [
        # ── Meta ──────────────────────────────────────────────
        ("project_name", answers.get("project_name", "Untitled"), "meta"),
        ("author_name", answers.get("author_name", "Anonymous"), "meta"),
        ("genre", answers.get("genre", "custom"), "meta"),
        ("created_at", datetime.utcnow().isoformat(), "meta"),

        # ── Feature Toggles ───────────────────────────────────
        ("track_species", str(answers.get("track_species", False)).lower(), "toggle"),
        ("track_groups", str(answers.get("track_groups", False)).lower(), "toggle"),
        ("track_knowledge", str(answers.get("track_knowledge", True)).lower(), "toggle"),
        ("track_dual_timeline", str(answers.get("track_dual_timeline", False)).lower(), "toggle"),
        ("track_custom_calendar", str(answers.get("track_custom_calendar", False)).lower(), "toggle"),
        ("core_mechanic", answers.get("core_mechanic", "none"), "meta"),

        # ── Custom Labels ─────────────────────────────────────
        # These let the frontend display "Noble Houses" instead of
        # "Groups" or "Bending" instead of "Magic System" — the
        # user's vocabulary, not ours.
        ("species_label", answers.get("species_label", "Species"), "label"),
        ("mechanic_label", answers.get("mechanic_label", ""), "label"),
        ("group_label", answers.get("group_label", "Factions"), "label"),

        # ── Lore Categories ───────────────────────────────────
        # JSON array of available lore categories. The frontend
        # uses this to populate dropdown menus and filter options.
        # Users can add more at any time via settings.
        ("lore_categories", json.dumps(answers.get("lore_categories", ["item"])), "json"),

        # ── Chapter Defaults ──────────────────────────────────
        ("default_chapter_target", str(answers.get("default_chapter_target", 4000)), "meta"),
    ]

    cursor.executemany(
        "INSERT OR REPLACE INTO project_config (config_key, config_value, config_type) VALUES (?, ?, ?)",
        configs,
    )

    conn.commit()
    conn.close()

    print(f"\n  Database created: {db_path}")
    return db_path


# ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────
# These will be used by your FastAPI endpoints.


def apply_migrations(db_path: str):
    """Applies any necessary schema updates to existing projects."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check locations table for updated_at
        cursor.execute("PRAGMA table_info(locations)")
        columns = [col[1] for col in cursor.fetchall()]
        if "updated_at" not in columns:
            cursor.execute("ALTER TABLE locations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            
        # Check groups table for updated_at
        cursor.execute("PRAGMA table_info(groups)")
        columns = [col[1] for col in cursor.fetchall()]
        if "updated_at" not in columns:
            cursor.execute("ALTER TABLE groups ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

        # Check knowledge_states table for world_time and word_offset
        cursor.execute("PRAGMA table_info(knowledge_states)")
        columns = [col[1] for col in cursor.fetchall()]
        if "world_time" not in columns:
            cursor.execute("ALTER TABLE knowledge_states ADD COLUMN world_time TEXT")
        if "word_offset" not in columns:
            cursor.execute("ALTER TABLE knowledge_states ADD COLUMN word_offset INTEGER")

        # Create new analytics tables if they don't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stats (
                stat_key   TEXT PRIMARY KEY,
                stat_value TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stat_logs (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                new_words         INTEGER DEFAULT 0,
                deleted_words     INTEGER DEFAULT 0,
                new_entities      INTEGER DEFAULT 0,
                deleted_entities  INTEGER DEFAULT 0,
                new_twists        INTEGER DEFAULT 0,
                event_context     TEXT
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS entity_mentions (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type   TEXT NOT NULL,
                entity_id     INTEGER NOT NULL,
                chapter_id    INTEGER NOT NULL,
                word_offset   INTEGER NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS achievements (
                id TEXT PRIMARY KEY,
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_stat_logs_timestamp ON stat_logs(timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_entity_mentions_chapter ON entity_mentions(chapter_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON entity_mentions(entity_type, entity_id);")

        # Planner Migrations (Add safely into existing DBs)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS planner_settings (
            id              INTEGER PRIMARY KEY CHECK(id = 1),
            theme           TEXT DEFAULT '' CHECK(length(theme) <= 120),
            cursor_pct      REAL DEFAULT 0 CHECK(cursor_pct >= 0 AND cursor_pct <= 100),
            writing_started INTEGER DEFAULT 0,
            shadow_visible  INTEGER DEFAULT 0,
            updated_at      TEXT DEFAULT (datetime('now'))
        )
        """)
        cursor.execute("INSERT OR IGNORE INTO planner_settings (id) VALUES (1)")

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS planner_blocks (
            id                   TEXT PRIMARY KEY,
            layer                TEXT NOT NULL DEFAULT 'surface'
                                     CHECK(layer IN ('surface', 'shadow')),
            block_type           TEXT NOT NULL,
            label                TEXT DEFAULT '' CHECK(length(label) <= 50),
            pct                  REAL NOT NULL CHECK(pct >= 0 AND pct <= 100),
            lane                 INTEGER DEFAULT 0 CHECK(lane IN (0, 1, 2)),
            chapter_id           INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
            chapter_status       TEXT CHECK(chapter_status IN
                                     (NULL, 'planned', 'writing', 'draft', 'revised', 'final')),
            added_during_writing INTEGER DEFAULT 0,
            sort_order           INTEGER DEFAULT 0,
            created_at           TEXT DEFAULT (datetime('now')),
            updated_at           TEXT DEFAULT (datetime('now'))
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS planner_arcs (
            id          TEXT PRIMARY KEY,
            layer       TEXT NOT NULL DEFAULT 'surface'
                            CHECK(layer IN ('surface', 'shadow')),
            name        TEXT DEFAULT '' CHECK(length(name) <= 24),
            description TEXT DEFAULT '' CHECK(length(description) <= 80),
            color       TEXT NOT NULL DEFAULT '#d97706',
            start_pct   REAL NOT NULL DEFAULT 0
                            CHECK(start_pct >= 0 AND start_pct <= 100),
            end_pct     REAL NOT NULL DEFAULT 100
                            CHECK(end_pct >= 0 AND end_pct <= 100),
            sort_order  INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now')),
            CHECK(start_pct < end_pct)
        )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_blocks_layer ON planner_blocks(layer);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_blocks_chapter ON planner_blocks(chapter_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_arcs_layer ON planner_arcs(layer);")

        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS update_block_chapter_status
            AFTER UPDATE OF status ON chapters
            BEGIN
                UPDATE planner_blocks
                SET chapter_status = NEW.status,
                    updated_at = datetime('now')
                WHERE chapter_id = NEW.id;
            END;
        """)

        # Drop secrets table
        cursor.execute("DROP TABLE IF EXISTS secrets")

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS twists (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            title               TEXT NOT NULL,
            description         TEXT,
            twist_type          TEXT,
            reveal_chapter_id   INTEGER,
            reveal_word_offset  INTEGER,
            characters_who_know TEXT,
            status              TEXT DEFAULT 'planned',
            notes               TEXT,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reveal_chapter_id) REFERENCES chapters(id)
                ON DELETE SET NULL
        )
        """)

        # Migrate existing twists table to add reveal_word_offset if missing
        try:
            cursor.execute("ALTER TABLE twists ADD COLUMN reveal_word_offset INTEGER")
        except Exception:
            pass  # column already exists

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS foreshadowings (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            twist_id            INTEGER NOT NULL,
            chapter_id          INTEGER NOT NULL,
            word_offset         INTEGER NOT NULL,
            selected_text       TEXT,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (twist_id) REFERENCES twists(id)
                ON DELETE CASCADE,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id)
                ON DELETE CASCADE
        )
        """)

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_twist_reveal ON twists(reveal_chapter_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_twist_status ON twists(status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_foreshadow_twist ON foreshadowings(twist_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_foreshadow_chapter ON foreshadowings(chapter_id);")

        # History timeline entries
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS history_entries (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type          TEXT NOT NULL,
                entity_id            INTEGER NOT NULL,
                title                TEXT NOT NULL,
                description          TEXT,
                event_type           TEXT NOT NULL,
                date_year            INTEGER NOT NULL,
                date_month           INTEGER,
                date_day             INTEGER,
                date_precise         INTEGER DEFAULT 0,
                related_entity_type  TEXT,
                related_entity_id    INTEGER,
                created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_entity ON history_entries(entity_type, entity_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_event_type ON history_entries(event_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_date ON history_entries(date_year);")

        # Calendar defaults for story start (for existing projects)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS calendar_config (
                config_key   TEXT PRIMARY KEY,
                config_value TEXT
            )
        """)
        cursor.execute("INSERT OR IGNORE INTO calendar_config (config_key, config_value) VALUES (?, ?)", ("story_start_year", "0"))
        cursor.execute("INSERT OR IGNORE INTO calendar_config (config_key, config_value) VALUES (?, ?)", ("story_start_month", "1"))
        cursor.execute("INSERT OR IGNORE INTO calendar_config (config_key, config_value) VALUES (?, ?)", ("story_start_day", "1"))

        # World times (paragraph-level time overrides)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS world_times (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                chapter_id  INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
                world_date  TEXT NOT NULL,
                label       TEXT,
                color_index INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS boards (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL DEFAULT 'New Board',
                board_type TEXT NOT NULL DEFAULT 'custom',
                icon       TEXT DEFAULT '✦',
                zoom       REAL DEFAULT 1.0,
                pan_x      REAL DEFAULT 0.0,
                pan_y      REAL DEFAULT 0.0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS board_items (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                item_type   TEXT NOT NULL DEFAULT 'concept',
                entity_id   INTEGER DEFAULT NULL,
                entity_type TEXT DEFAULT NULL,
                description TEXT DEFAULT '',
                pos_x       REAL NOT NULL DEFAULT 0,
                pos_y       REAL NOT NULL DEFAULT 0,
                size_x      REAL NOT NULL DEFAULT 140,
                size_y      REAL NOT NULL DEFAULT 60,
                color       TEXT NOT NULL DEFAULT '#888888',
                z_index     INTEGER NOT NULL DEFAULT 0
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS item_connections (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                board_id      INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
                item_start_id INTEGER NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
                item_end_id   INTEGER NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
                conn_type     TEXT NOT NULL DEFAULT 'solid',
                conn_color    TEXT NOT NULL DEFAULT '#888888',
                title         TEXT DEFAULT '',
                directed      INTEGER NOT NULL DEFAULT 1,
                curve_offset  REAL NOT NULL DEFAULT 0.0
            )
        """)
        # Add conn_color to existing item_connections tables (safe if column already exists)
        try:
            cursor.execute("ALTER TABLE item_connections ADD COLUMN conn_color TEXT NOT NULL DEFAULT '#888888'")
        except Exception:
            pass

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_board_items_board ON board_items(board_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_connections_board ON item_connections(board_id);")

        conn.commit()
    except Exception as e:
        print(f"Warning: Migration failed: {e}")
    finally:
        conn.close()


def get_config(db_path: str) -> dict:
    """Load all config as a flat dict. Frontend calls this on startup."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT config_key, config_value, config_type FROM project_config")
    rows = cursor.fetchall()
    conn.close()

    config = {}
    for key, value, ctype in rows:
        if ctype == "toggle":
            config[key] = value == "true"
        elif ctype == "json":
            config[key] = json.loads(value)
        else:
            config[key] = value
    return config


def update_config(db_path: str, key: str, value, config_type: str = None):
    """Update a single config value. Used when user changes settings mid-project."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    if isinstance(value, bool):
        store_value = str(value).lower()
        config_type = config_type or "toggle"
    elif isinstance(value, (list, dict)):
        store_value = json.dumps(value)
        config_type = config_type or "json"
    else:
        store_value = str(value)
        config_type = config_type or "meta"

    cursor.execute(
        "INSERT OR REPLACE INTO project_config (config_key, config_value, config_type) VALUES (?, ?, ?)",
        (key, store_value, config_type),
    )
    conn.commit()
    conn.close()


def get_all_entity_names(db_path: str) -> list[dict]:
    """
    Returns all entity names and aliases for the linkification engine.
    Called on chapter load to build the regex match list.

    Returns a list of dicts:
        [{"name": "Ren Alcazar", "type": "character", "id": 1,
          "aliases": ["Ren", "Alcazar", "the Aspirant"]}, ...]
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    entities = []

    # Characters
    cursor.execute("SELECT id, name, aliases FROM characters")
    for row in cursor.fetchall():
        aliases = json.loads(row[2]) if row[2] else []
        entities.append({"id": row[0], "type": "character", "name": row[1], "aliases": aliases})

    # Lore entities
    cursor.execute("SELECT id, name, aliases, category FROM lore_entities")
    for row in cursor.fetchall():
        aliases = json.loads(row[2]) if row[2] else []
        entities.append({"id": row[0], "type": "lore", "name": row[1], "aliases": aliases, "category": row[3]})

    # Locations
    cursor.execute("SELECT id, name, aliases FROM locations")
    for row in cursor.fetchall():
        aliases = json.loads(row[2]) if row[2] else []
        entities.append({"id": row[0], "type": "location", "name": row[1], "aliases": aliases})

    # Groups
    cursor.execute("SELECT id, name, aliases FROM groups")
    for row in cursor.fetchall():
        aliases = json.loads(row[2]) if row[2] else []
        entities.append({"id": row[0], "type": "group", "name": row[1], "aliases": aliases})

    conn.close()
    return entities


def get_knowledge_for_pov(db_path: str, character_id: int, current_chapter: int) -> list[dict]:
    """
    Returns all facts the given POV character knows up to the current chapter.
    This is the core epistemic filter query.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, fact, source_entity_type, source_entity_id,
               learned_in_chapter, is_secret, notes, world_time
        FROM knowledge_states
        WHERE character_id = ?
          AND is_secret = 0
          AND (learned_in_chapter <= ? OR learned_in_chapter IS NULL)
        ORDER BY learned_in_chapter ASC
        """,
        (character_id, current_chapter),
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r[0],
            "fact": r[1],
            "source_entity_type": r[2],
            "source_entity_id": r[3],
            "learned_in_chapter": r[4],
            "is_secret": bool(r[5]),
            "notes": r[6],
            "world_time": r[7],
        }
        for r in rows
    ]


# ─── CLI ENTRY POINT ─────────────────────────────────────────────────────────


if __name__ == "__main__":
    answers = run_onboarding()
    if answers:
        project_dir = os.path.join(os.getcwd(), "projects", answers["project_name"].replace(" ", "_"))
        db_path = generate_project_db(project_dir, answers)

        # Verify
        config = get_config(db_path)
        print("\n  Loaded config verification:")
        for k, v in config.items():
            print(f"    {k}: {v}")
        print("\n  Done. Start writing.")

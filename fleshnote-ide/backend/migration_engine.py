import os
import json
import uuid
import sqlite3
import shutil
import re
from datetime import datetime
from db_setup import generate_project_db

# Reference columns copy_table() remaps and that fall back to the old id on a miss.
# Covers polymorphic entity_id columns AND direct FKs whose target can go missing
# (e.g. foreshadowings.twist_id → a deleted/never-migrated twist). The sweep asserts
# none of these still hold an old integer id after migration.
REMAPPED_REF_COLUMNS = [
    ("image_references", "entity_id"),
    ("board_items", "entity_id"),
    ("knowledge_states", "source_entity_id"),
    ("history_entries", "entity_id"),
    ("history_entries", "related_entity_id"),
    ("entity_appearances", "entity_id"),
    ("entity_mentions", "entity_id"),
    ("foreshadowings", "twist_id"),
]


def _verify_polymorphic_integrity(cursor) -> list[dict]:
    """
    Scan every remapped reference column in the migrated (v2) DB for values that still
    look like old integer PKs (i.e. never got remapped to a UUID). Returns a list of
    orphan reports; an empty list means the migration remapped everything cleanly.
    Post-migration UUIDs contain hyphens; old int ids are pure digits — a pure-digit
    (or otherwise hyphen-less) non-null value is an orphaned reference.
    """
    orphans = []
    for table, column in REMAPPED_REF_COLUMNS:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
        if not cursor.fetchone():
            continue
        # Non-null values with no hyphen are not UUIDs → un-remapped old ids.
        cursor.execute(
            f"SELECT COUNT(*) FROM {table} "
            f"WHERE {column} IS NOT NULL AND CAST({column} AS TEXT) NOT LIKE '%-%'"
        )
        count = cursor.fetchone()[0]
        if count:
            # Grab a few sample entity_type values to make drift diagnosable.
            type_col = "source_entity_type" if column == "source_entity_id" else \
                       ("related_entity_type" if column == "related_entity_id" else "entity_type")
            try:
                cursor.execute(
                    f"SELECT DISTINCT {type_col} FROM {table} "
                    f"WHERE {column} IS NOT NULL AND CAST({column} AS TEXT) NOT LIKE '%-%' LIMIT 5"
                )
                sample_types = [r[0] for r in cursor.fetchall()]
            except Exception:
                sample_types = []
            report = {"table": table, "column": column, "count": count, "entity_types": sample_types}
            orphans.append(report)
            print(f"Warning: integrity sweep found {count} un-remapped {table}.{column} "
                  f"reference(s); entity_type sample: {sample_types}")
    return orphans


def migrate_project(project_path: str) -> dict:
    """
    Migrates a FleshNote project from Schema v1 (integer IDs) to Schema v2 (UUIDs, soft deletes).
    Returns a dict with status and details.
    """
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        return {"status": "error", "message": "Database not found in project folder"}

    # 1. Check if migration is actually needed
    json_path = os.path.join(project_path, "fleshnote_project.json")
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
                if meta.get("schema_version", 1) >= 2:
                    return {"status": "ok", "message": "Project is already upgraded to version 2"}
        except Exception:
            pass

    # Backup the database first
    db_backup_path = os.path.join(project_path, "fleshnote.db.bak")
    try:
        shutil.copy2(db_path, db_backup_path)
    except Exception as e:
        return {"status": "error", "message": f"Failed to create database backup: {str(e)}"}

    temp_project_dir = os.path.join(project_path, "temp_mig")
    if os.path.exists(temp_project_dir):
        shutil.rmtree(temp_project_dir)
    os.makedirs(temp_project_dir)

    try:
        # 2. Open old DB to extract configs for initialization
        old_conn = sqlite3.connect(db_path)
        old_conn.row_factory = sqlite3.Row
        old_cursor = old_conn.cursor()

        # Load project config entries to populate answers dictionary
        old_cursor.execute("SELECT config_key, config_value, config_type FROM project_config")
        config_rows = old_cursor.fetchall()
        
        answers = {
            "project_name": os.path.basename(project_path),
            "author_name": "Anonymous",
            "genre": "custom"
        }
        
        # Populate questionnaire answers from old config
        for row in config_rows:
            key = row["config_key"]
            val = row["config_value"]
            ctype = row["config_type"]
            
            if ctype == "toggle":
                answers[key] = (val.lower() == "true")
            elif ctype == "json":
                try:
                    answers[key] = json.loads(val)
                except Exception:
                    answers[key] = val
            elif ctype == "label" or ctype == "meta":
                if val.isdigit() and key in ["default_chapter_target"]:
                    answers[key] = int(val)
                else:
                    answers[key] = val

        # Load calendar config if present
        try:
            old_cursor.execute("SELECT config_key, config_value FROM calendar_config")
            cal_rows = old_cursor.fetchall()
            for row in cal_rows:
                key = row["config_key"]
                val = row["config_value"]
                if val.lower() in ["true", "false"]:
                    answers[key] = (val.lower() == "true")
                elif val.startswith("[") or val.startswith("{"):
                    try:
                        answers[key] = json.loads(val)
                    except Exception:
                        answers[key] = val
                elif val.isdigit():
                    answers[key] = int(val)
                else:
                    answers[key] = val
        except Exception:
            pass # calendar config might not exist in very old DBs

        # 3. Create clean migrated database schema using updated generate_project_db
        temp_db_path = generate_project_db(temp_project_dir, answers)
        new_conn = sqlite3.connect(temp_db_path)
        new_cursor = new_conn.cursor()

        # 4. Generate UUID mappings for all tables
        # Mapping has structure: table_name -> { old_integer_id: new_uuid_str }
        mappings = {}
        tables_to_map = [
            "chapters", "characters", "groups", "lore_entities", "locations",
            "location_weather_states", "knowledge_states", "twists",
            "foreshadowings", "character_relationships", "world_times",
            "boards", "board_items", "item_connections", "history_entries",
            "image_references", "quick_notes", "annotations", "stat_logs", "entity_appearances",
            "entity_mentions"
        ]

        for table in tables_to_map:
            mappings[table] = {}
            # Verify if table exists in the old database
            old_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if not old_cursor.fetchone():
                continue
            
            # Fetch all old IDs
            old_cursor.execute(f"SELECT id FROM {table}")
            rows = old_cursor.fetchall()
            for r in rows:
                mappings[table][r["id"]] = str(uuid.uuid4())

        # 5. Helper function to copy and remap tables
        def copy_table(table_name: str, fk_remappers: dict = None):
            old_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            if not old_cursor.fetchone():
                return

            new_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            if not new_cursor.fetchone():
                print(f"Warning: Table {table_name} does not exist in the new database schema. Skipping copy.")
                return

            old_cursor.execute(f"SELECT * FROM {table_name}")
            rows = old_cursor.fetchall()
            if not rows:
                return

            # Get columns from new table to ensure we insert matching fields
            new_cursor.execute(f"PRAGMA table_info({table_name})")
            new_cols = [col[1] for col in new_cursor.fetchall()]

            for r in rows:
                row_dict = dict(r)
                old_id = row_dict.get("id")

                # Remap primary key 'id' to the pre-generated UUID
                if "id" in row_dict and table_name in mappings and old_id in mappings[table_name]:
                    row_dict["id"] = mappings[table_name][old_id]

                # Remap foreign keys
                if fk_remappers:
                    for field, ref_table in fk_remappers.items():
                        if field in row_dict and row_dict[field] is not None:
                            old_ref = row_dict[field]
                            # Handle polymorphic reference remapping (e.g. source_entity_id, entity_id)
                            if ref_table == "polymorphic":
                                type_field = "source_entity_type" if field == "source_entity_id" else "entity_type"
                                entity_type = row_dict.get(type_field)
                                # Map entity types to table names. Covers BOTH the long
                                # names used by most polymorphic tables (board_items,
                                # knowledge_states, history_entries, entity_appearances,
                                # entity_mentions) AND the short DB codes stored by
                                # image_references (entityTypeToDbCode: char/loc/item/group).
                                # Missing char/loc here previously orphaned all character
                                # and location image references on migration.
                                table_map = {
                                    "character": "characters", "char": "characters",
                                    "location": "locations", "loc": "locations",
                                    "lore": "lore_entities", "item": "lore_entities",
                                    "group": "groups"
                                }
                                ref_table_mapped = table_map.get(entity_type)
                                if ref_table_mapped and ref_table_mapped in mappings:
                                    row_dict[field] = mappings[ref_table_mapped].get(old_ref, old_ref)
                                else:
                                    # Unknown/unmapped entity_type — leave value as-is but
                                    # flag it, so vocabulary drift never orphans rows silently.
                                    print(f"Warning: {table_name}.{field} has unmapped "
                                          f"{type_field}={entity_type!r} (value {old_ref!r}); "
                                          f"reference left un-remapped.")
                            # Handle board item endpoints
                            elif ref_table == "board_item_ends":
                                row_dict[field] = mappings["board_items"].get(old_ref, old_ref)
                            else:
                                if ref_table in mappings:
                                    row_dict[field] = mappings[ref_table].get(old_ref, old_ref)

                # Special treatment for twists character list: twists.characters_who_know is a JSON array
                if table_name == "twists" and "characters_who_know" in row_dict and row_dict["characters_who_know"]:
                    try:
                        old_char_ids = json.loads(row_dict["characters_who_know"])
                        if isinstance(old_char_ids, list):
                            new_char_uuids = [mappings["characters"].get(cid, str(cid)) for cid in old_char_ids]
                            row_dict["characters_who_know"] = json.dumps(new_char_uuids)
                    except Exception:
                        pass

                # Filter dictionary keys to match new table schema (ignoring added deleted/deleted_at if not populated)
                columns_to_insert = [c for c in row_dict.keys() if c in new_cols]
                values = [row_dict[c] for c in columns_to_insert]
                
                placeholders = ", ".join(["?"] * len(columns_to_insert))
                col_names = ", ".join(columns_to_insert)
                query = f"INSERT OR REPLACE INTO {table_name} ({col_names}) VALUES ({placeholders})"
                
                new_cursor.execute(query, values)

        # Copy tables with foreign key relationships
        copy_table("chapters", {"pov_character_id": "characters"})
        copy_table("characters", {"group_id": "groups"})
        copy_table("groups")
        copy_table("lore_entities")
        copy_table("locations", {"parent_location_id": "locations"})
        copy_table("location_weather_states", {"location_id": "locations"})
        copy_table("entity_appearances", {"entity_id": "polymorphic", "chapter_id": "chapters"})
        copy_table("knowledge_states", {
            "character_id": "characters",
            "source_entity_id": "polymorphic",
            "learned_in_chapter": "chapters",
            "reveal_in_chapter": "chapters"
        })
        copy_table("twists", {"reveal_chapter_id": "chapters"})
        copy_table("foreshadowings", {"twist_id": "twists", "chapter_id": "chapters"})
        copy_table("character_relationships", {
            "character_id": "characters",
            "target_character_id": "characters",
            "chapter_id": "chapters"
        })
        copy_table("world_times", {"chapter_id": "chapters"})
        copy_table("boards")
        copy_table("board_items", {"board_id": "boards", "entity_id": "polymorphic"})
        copy_table("item_connections", {
            "board_id": "boards",
            "item_start_id": "board_item_ends",
            "item_end_id": "board_item_ends"
        })
        copy_table("history_entries", {"entity_id": "polymorphic", "related_entity_id": "polymorphic"})
        copy_table("image_references", {"entity_id": "polymorphic"})
        copy_table("quick_notes")
        copy_table("annotations")
        copy_table("stat_logs")
        copy_table("entity_mentions", {"entity_id": "polymorphic", "chapter_id": "chapters"})

        # Copy singleton / config tables (no PK UUID mapping needed)
        copy_table("planner_settings")
        # Planner blocks and arcs use UUIDs already, but block.chapter_id must be remapped
        copy_table("planner_blocks", {"chapter_id": "chapters"})
        copy_table("planner_arcs")
        copy_table("achievements")
        
        # Sync stats as-is if the table exists in the old database
        old_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='stats'")
        if old_cursor.fetchone():
            old_cursor.execute("SELECT * FROM stats")
            stats_rows = old_cursor.fetchall()
            for r in stats_rows:
                new_cursor.execute("INSERT OR REPLACE INTO stats (stat_key, stat_value) VALUES (?, ?)", (r["stat_key"], r["stat_value"]))

        # 5b. Integrity sweep: assert no polymorphic entity_id kept an old integer id.
        # Warn + report (does not abort) so one stray row never blocks a good migration.
        integrity_orphans = _verify_polymorphic_integrity(new_cursor)

        new_conn.commit()
        new_conn.close()
        old_conn.close()

        # 6. Refactor markdown files with the new UUID entity tags
        md_dir = os.path.join(project_path, "md")
        if os.path.exists(md_dir):
            for file_name in os.listdir(md_dir):
                if not file_name.endswith(".md"):
                    continue
                file_path = os.path.join(md_dir, file_name)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        md_content = f.read()

                    # Regex matching tags: {{type:id|text}}
                    # Group 1 = type, Group 2 = id, Group 3 = text
                    pattern = r"\{\{(char|loc|item|lore|group|foreshadow|twist|quicknote|time|relationship):([^|]+)\|([^}]+)\}\}"
                    
                    def replacer(match):
                        tag_type = match.group(1)
                        old_id_str = match.group(2)
                        text = match.group(3)

                        # Match tag types to the table whose id the tag actually carries.
                        # NOTE: a {{foreshadow:N}} tag's N is the TWIST id it foreshadows
                        # (see chapters.py _update_foreshadowings, which inserts it as
                        # foreshadowings.twist_id) — NOT a foreshadowings row id. So it must
                        # remap against 'twists', same as {{twist:N}}. Mapping it to
                        # 'foreshadowings' silently mis-converted foreshadow markers.
                        table_map = {
                            "char": "characters",
                            "loc": "locations",
                            "item": "lore_entities",
                            "lore": "lore_entities",
                            "group": "groups",
                            "foreshadow": "twists",
                            "twist": "twists"
                        }
                        
                        table_key = table_map.get(tag_type)
                        
                        # Only convert if the ID is purely digits (meaning it's an old integer key)
                        if old_id_str.isdigit() and table_key:
                            old_id = int(old_id_str)
                            new_uuid = mappings.get(table_key, {}).get(old_id)
                            if new_uuid:
                                return f"{{{{{tag_type}:{new_uuid}|{text}}}}}"
                        
                        # Return original if not remapped
                        return match.group(0)

                    new_md_content = re.sub(pattern, replacer, md_content)
                    
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(new_md_content)
                except Exception as e:
                    print(f"Warning: Failed to update entity tags in markdown file {file_name}: {e}")

        # 7. Finalize database swap
        shutil.move(temp_db_path, db_path)
        shutil.rmtree(temp_project_dir)

        # 8. Create fleshnote_project.json descriptor file
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump({
                "project_name": os.path.basename(project_path),
                "schema_version": 2,
                "created_version": "1.2.0",
                "last_opened_version": "1.3.0",
                "project_id": str(uuid.uuid4())
            }, f, indent=2)

        result = {"status": "ok", "message": "Project database and markdown files migrated successfully to Schema version 2."}
        if integrity_orphans:
            total = sum(o["count"] for o in integrity_orphans)
            result["warnings"] = integrity_orphans
            result["message"] += (f" Note: {total} reference(s) across "
                                  f"{len(integrity_orphans)} table(s) could not be remapped "
                                  f"and may be orphaned.")
        return result

    except Exception as e:
        # Close database connections if they are still open to release file locks on Windows
        try:
            new_conn.close()
        except:
            pass
        try:
            old_conn.close()
        except:
            pass
        # Rollback: restore backup
        if os.path.exists(db_backup_path):
            try:
                shutil.copy2(db_backup_path, db_path)
            except:
                pass
        if os.path.exists(temp_project_dir):
            try:
                shutil.rmtree(temp_project_dir)
            except Exception as clean_err:
                print(f"Warning: Failed to clean up temp migration directory: {clean_err}")
        return {"status": "error", "message": f"Migration failed: {str(e)}"}

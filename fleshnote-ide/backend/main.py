import os
import re
import json
import shutil
import sqlite3
import uuid

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from db_setup import generate_project_db, apply_migrations
import project_io
import migration_engine

from routes.chapters import router as chapters_router
from routes.characters import router as characters_router
from routes.locations import router as locations_router
from routes.entities import router as entities_router
from routes.imports import router as imports_router
from routes.groups import router as groups_router
from routes.knowledge import router as knowledge_router
from routes.secrets import router as secrets_router
from routes.twists import router as twists_router
from routes.calendar import router as calendar_router
from routes.quick_notes import router as quick_notes_router
from routes.annotations import router as annotations_router
from routes.settings import router as settings_router
from routes.export import router as export_router
from routes.planner import router as planner_router
from routes.stats import router as stats_router
from routes.achievements import router as achievements_router
from routes.entity_manager import router as entity_manager_router
from routes.history import router as history_router
from routes.relationships import router as relationships_router
from routes.synonyms import router as synonyms_router
from routes.spellcheck import router as spellcheck_router
from routes.world_times import router as world_times_router
from routes.boards import router as boards_router
from routes.janitor import router as janitor_router
from routes.story_pulse import router as story_pulse_router
from routes.image_references import router as image_references_router
from routes.name_gen import router as name_gen_router
from routes.sync import router as sync_router
from routes.remote_sync import router as remote_sync_router
from routes.pentimento import router as pentimento_router
from routes.chapter_history import router as chapter_history_router
from routes.review_export import router as review_export_router
from routes.review_notes import router as review_notes_router
from routes.vault_export import router as vault_export_router

app = FastAPI(title="FleshNote API")

# Mount route modules
app.include_router(chapters_router)
app.include_router(characters_router)
app.include_router(locations_router)
app.include_router(entities_router)
app.include_router(imports_router)
app.include_router(groups_router)
app.include_router(knowledge_router)
app.include_router(secrets_router)
app.include_router(twists_router)
app.include_router(calendar_router)
app.include_router(quick_notes_router)
app.include_router(annotations_router)
app.include_router(settings_router)
app.include_router(export_router)
app.include_router(planner_router)
app.include_router(stats_router)
app.include_router(achievements_router)
app.include_router(entity_manager_router)
app.include_router(history_router)
app.include_router(relationships_router)
app.include_router(synonyms_router)
app.include_router(spellcheck_router)
app.include_router(world_times_router)
app.include_router(boards_router)
app.include_router(janitor_router)
app.include_router(story_pulse_router)
app.include_router(image_references_router)
app.include_router(name_gen_router)
app.include_router(sync_router)
app.include_router(remote_sync_router)
app.include_router(pentimento_router)
app.include_router(chapter_history_router)
app.include_router(review_export_router)
app.include_router(review_notes_router)
app.include_router(vault_export_router)

# Define our data models so FastAPI knows what to expect
class WorkspaceRequest(BaseModel):
  workspace_path: str


class ProjectCreateRequest(BaseModel):
  workspace_path: str
  project_name: str
  questionnaire: dict  # This catches the JSON answers from the frontend

class ProjectLoadRequest(BaseModel):
  project_path: str


class ProjectConfigRequest(BaseModel):
  project_path: str


class ProjectConfigUpdateRequest(BaseModel):
  project_path: str
  config_key: str
  config_value: str | int | float | bool | list | dict
  config_type: str = "text"


@app.get("/")
def read_root():
  return {"status": "FleshNote Backend is alive"}


def _get_project_last_opened(project_path: str) -> int | None:
  """
  Returns the last-opened timestamp (Unix ms) for a project.
  Reads last_opened_at from project_config; falls back to fleshnote.db mtime.
  Returns None if no DB exists (not a FleshNote project).
  """
  db_path = os.path.join(project_path, "fleshnote.db")
  if not os.path.exists(db_path):
    return None
  try:
    conn = sqlite3.connect(db_path)
    row = conn.execute(
      "SELECT config_value FROM project_config WHERE config_key = 'last_opened_at'"
    ).fetchone()
    conn.close()
    if row and row[0]:
      return int(row[0])
  except Exception:
    pass
  # Fall back to DB file modification time
  return int(os.path.getmtime(db_path) * 1000)


_BOOK_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _get_book_stats(project_path: str) -> dict:
  """
  Bookshelf data for the project picker: manuscript size, chapter completion
  and the book's cosmetic look (color + rovás glyph from project_config).
  Never raises — legacy/unmigrated schemas degrade to zeros/nulls.
  """
  stats = {
    "word_count": 0,
    "chapter_count": 0,
    "final_count": 0,
    "finished": False,
    "book_color": None,
    "book_rune": None,
  }
  db_path = os.path.join(project_path, "fleshnote.db")
  if not os.path.exists(db_path):
    return stats
  try:
    conn = sqlite3.connect(db_path)
    try:
      agg = "SELECT COALESCE(SUM(word_count), 0), COUNT(*), COALESCE(SUM(status = 'final'), 0) FROM chapters"
      try:
        row = conn.execute(agg + " WHERE deleted = 0").fetchone()
      except sqlite3.OperationalError:
        # v1 schema has no soft-delete column
        row = conn.execute(agg).fetchone()
      stats["word_count"], stats["chapter_count"], stats["final_count"] = (int(v or 0) for v in row)
    except Exception:
      pass
    try:
      # Look values arrive via shared .flnote files/sync — only pass through
      # a plain hex color and a single rovás glyph (they end up in CSS).
      for key, value in conn.execute(
        "SELECT config_key, config_value FROM project_config WHERE config_key IN ('book_color', 'book_rune')"
      ):
        if key == "book_color" and value and _BOOK_COLOR_RE.match(value):
          stats[key] = value
        elif key == "book_rune" and value and len(value) == 1 and 0x10C80 <= ord(value) <= 0x10CFF:
          stats[key] = value
    except Exception:
      pass
    conn.close()
  except Exception:
    pass
  stats["finished"] = stats["chapter_count"] > 0 and stats["final_count"] == stats["chapter_count"]
  return stats


@app.post("/api/projects")
def scan_workspace(request: WorkspaceRequest):
  """Scans the given workspace path for valid FleshNote projects."""
  path = request.workspace_path

  if not os.path.exists(path):
    raise HTTPException(status_code=404, detail="Workspace path does not exist")

  projects = []
  seen_ids = set()

  try:
    for item in os.listdir(path):
      item_path = os.path.join(path, item)
      if not os.path.isdir(item_path):
        continue
      last_opened = _get_project_last_opened(item_path)
      if last_opened is None:
        continue  # Skip non-FleshNote directories
      
      # Determine if project needs migration (Schema Version 2)
      json_path = os.path.join(item_path, "fleshnote_project.json")
      needs_migration = True
      project_id = None
      if os.path.exists(json_path):
        try:
          with open(json_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
            if metadata.get("schema_version", 1) >= 2:
              needs_migration = False
            project_id = metadata.get("project_id")
        except Exception:
          pass
      # Clones/copies share a project_id; the picker needs a per-folder key
      if not project_id or project_id in seen_ids:
        project_id = item_path
      seen_ids.add(project_id)

      projects.append({
        "name": project_io.display_name(item),
        "path": item_path,
        # Stable across renames/moves; legacy projects without one fall back to path
        "project_id": project_id,
        "is_legacy": project_io.is_legacy_folder(item_path),
        "lastOpened": last_opened,  # Unix ms timestamp — formatted by frontend
        "needs_migration": needs_migration,
        **_get_book_stats(item_path),
      })
    # Sort most-recently-opened first
    projects.sort(key=lambda p: p["lastOpened"], reverse=True)
    return {"projects": projects}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/project/init")
def initialize_project(request: ProjectCreateRequest):
  # Projects are extensioned folders: 'MyNovel.flnote' (behaves like a single
  # file for users; still a directory on disk). project_name stays extension-free.
  project_dir = os.path.join(
    request.workspace_path, project_io.with_ext(request.project_name))

  if os.path.exists(project_dir):
    raise HTTPException(status_code=400, detail="Project folder already exists")

  try:
    # 1. Build the physical folders
    os.makedirs(project_dir)
    os.makedirs(os.path.join(project_dir, "md"))
    os.makedirs(os.path.join(project_dir, "exports"))

    # 2. Generate the SQLite DB using the questionnaire payload
    db_path = generate_project_db(project_dir, request.questionnaire)

    # 3. Create fleshnote_project.json descriptor
    project_json_path = os.path.join(project_dir, "fleshnote_project.json")
    with open(project_json_path, "w", encoding="utf-8") as f:
      json.dump({
        "project_name": project_io.sanitize_project_name(request.project_name),
        "schema_version": 2,
        "created_version": "2.1.0",
        "last_opened_version": "2.1.0",
        "project_id": str(uuid.uuid4())
      }, f, indent=2)

    # 4. Cosmetic: document-style folder icon (desktop.ini / gio metadata).
    from folder_icon import apply_folder_icon
    apply_folder_icon(project_dir)

    return {
      "status": "success",
      "project_path": project_dir,
      "db_path": db_path
    }
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


class ProjectMigrateRequest(BaseModel):
  project_path: str

@app.post("/api/project/migrate")
def migrate_project_endpoint(request: ProjectMigrateRequest):
  from migration_engine import migrate_project
  res = migrate_project(request.project_path)
  if res.get("status") == "error":
    raise HTTPException(status_code=500, detail=res.get("message"))
  return res


class ModernizeRequest(BaseModel):
  workspace_path: str


class ModernizeResult(BaseModel):
  name: str
  old_path: str
  new_path: str | None = None
  status: str        # "ok" | "renamed" | "migrated" | "error"
  message: str = ""


def _needs_migration_flag(project_path: str) -> bool:
  json_path = os.path.join(project_path, "fleshnote_project.json")
  if os.path.exists(json_path):
    try:
      with open(json_path, "r", encoding="utf-8") as f:
        if json.load(f).get("schema_version", 1) >= 2:
          return False
    except Exception:
      pass
  return True


@app.post("/api/projects/modernize")
def modernize_projects(request: ModernizeRequest):
  """One-click upgrade of legacy project folders:
  rename 'MyNovel' -> 'MyNovel.flnote', then run the schema v1->v2 migration
  for projects that still need it. Safe to call from the picker context (no
  project is open, so no db file locks). Per-project results; never aborts."""
  from migration_engine import migrate_project
  path = request.workspace_path
  if not os.path.exists(path):
    raise HTTPException(status_code=404, detail="Workspace path does not exist")

  results = []
  for item in os.listdir(path):
    item_path = os.path.join(path, item)
    if not project_io.is_legacy_folder(item_path):
      continue
    target = os.path.join(path, project_io.with_ext(project_io.display_name(item)))
    if os.path.exists(target):
      results.append({"name": project_io.display_name(item), "old_path": item_path,
                      "status": "error", "message": f"Target already exists: {target}"})
      continue
    try:
      os.rename(item_path, target)
    except OSError as e:
      results.append({"name": project_io.display_name(item), "old_path": item_path,
                      "status": "error", "message": f"Rename failed: {e}"})
      continue
    status = "renamed"
    message = ""
    if _needs_migration_flag(target):
      res = migrate_project(target)
      if res.get("status") == "error":
        status = "error"
        message = res.get("message", "Schema migration failed")
      else:
        status = "migrated"
    results.append({"name": project_io.display_name(item), "old_path": item_path,
                    "new_path": target, "status": status, "message": message})
  return {"results": results}


class ExportFlnoteRequest(BaseModel):
  project_path: str
  dest_path: str


@app.post("/api/project/export-flnote")
def export_flnote(request: ExportFlnoteRequest):
  """Write the project as a single-file .flnote ZIP (share/backup artifact).
  dest_path comes from the Electron save dialog. Never zips a live WAL db."""
  db_path = os.path.join(request.project_path, "fleshnote.db")
  if not os.path.exists(db_path):
    raise HTTPException(status_code=404, detail="Database not found in project folder")
  if not request.dest_path.lower().endswith(project_io.PROJECT_EXT):
    raise HTTPException(status_code=400, detail="Destination must end with .flnote")
  if os.path.exists(request.dest_path):
    raise HTTPException(status_code=400, detail="Destination file already exists")
  try:
    project_io.zip_project(request.project_path, request.dest_path)
  except Exception as e:
    raise HTTPException(status_code=500, detail=f"Export failed: {e}")
  return {"status": "ok", "path": request.dest_path}


class ImportFlnoteRequest(BaseModel):
  zip_path: str
  workspace_path: str


@app.post("/api/project/import-flnote")
def import_flnote(request: ImportFlnoteRequest):
  """Import a shared single-file .flnote ZIP into the workspace as a new
  extensioned project folder. Validates hard (zip-slip/bombs/allowlist) and
  auto-runs the v1->v2 migration for legacy-schema projects."""
  import tempfile
  if not os.path.isfile(request.zip_path):
    raise HTTPException(status_code=404, detail="File not found")
  if not os.path.isdir(request.workspace_path):
    raise HTTPException(status_code=400, detail="Workspace path does not exist")

  tmp_root = tempfile.mkdtemp(prefix="fleshnote_import_")
  try:
    extract_dir = os.path.join(tmp_root, "project")
    try:
      project_io.safe_extract_zip(request.zip_path, extract_dir, allowlist=True)
    except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))

    if not os.path.exists(os.path.join(extract_dir, "fleshnote.db")):
      raise HTTPException(status_code=400, detail="Not a FleshNote project (missing fleshnote.db)")
    json_path = os.path.join(extract_dir, "fleshnote_project.json")
    if not os.path.exists(json_path):
      raise HTTPException(status_code=400, detail="Not a FleshNote project (missing descriptor)")

    with open(json_path, "r", encoding="utf-8") as f:
      meta = json.load(f)
    base = project_io.sanitize_project_name(str(meta.get("project_name") or "Imported Project"))
    target = project_io.next_available_project_dir(request.workspace_path, base)
    shutil.copytree(extract_dir, target)
  except HTTPException:
    shutil.rmtree(tmp_root, ignore_errors=True)
    raise
  except Exception as e:
    shutil.rmtree(tmp_root, ignore_errors=True)
    raise HTTPException(status_code=500, detail=f"Import failed: {e}")
  finally:
    shutil.rmtree(tmp_root, ignore_errors=True)

  if _needs_migration_flag(target):
    from migration_engine import migrate_project
    res = migrate_project(target)
    if res.get("status") == "error":
      # keep the imported project, but surface the failure
      return {"status": "ok", "project_path": target, "name": project_io.display_name(os.path.basename(target)),
              "needs_migration": True, "message": res.get("message")}

  return {"status": "ok", "project_path": target,
          "name": project_io.display_name(os.path.basename(target))}


def ensure_project_id(project_path: str):
  json_path = os.path.join(project_path, "fleshnote_project.json")
  if os.path.exists(json_path):
    try:
      with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
      if "project_id" not in data:
        data["project_id"] = str(uuid.uuid4())
        with open(json_path, "w", encoding="utf-8") as f:
          json.dump(data, f, indent=2)
    except Exception as e:
      print(f"Warning: Failed to backfill project_id: {e}")


@app.post("/api/project/load")
def load_project(request: ProjectLoadRequest):
  """Loads an existing project's configuration."""
  db_path = os.path.join(request.project_path, "fleshnote.db")

  if not os.path.exists(db_path):
    raise HTTPException(status_code=404, detail="Database not found in project folder")

  # Backfill project_id if it's missing from fleshnote_project.json
  ensure_project_id(request.project_path)

  # Block load if it needs migration
  json_path = os.path.join(request.project_path, "fleshnote_project.json")
  needs_migration = True
  if os.path.exists(json_path):
    try:
      with open(json_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)
        if metadata.get("schema_version", 1) >= 2:
          needs_migration = False
    except Exception:
      pass
  
  if needs_migration:
    raise HTTPException(
      status_code=400,
      detail="Project requires migration to schema version 2 before loading."
    )

  try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT config_key, config_value, config_type FROM project_config")
    rows = cursor.fetchall()
    conn.close()

    # Reconstruct the config dictionary
    config = {}
    for key, value, ctype in rows:
      if ctype == 'toggle':
        config[key] = (value.lower() == 'true')
      elif ctype == 'json':
        try:
          config[key] = json.loads(value)
        except:
          config[key] = value
      else:
        config[key] = value

    # Apply any pending migrations to the schema (v2 schema onwards)
    try:
      apply_migrations(db_path)
    except Exception as e:
      print(f"Warning: Failed to apply migrations: {e}")

    return {"status": "success", "config": config}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/project/config")
def get_project_config(request: ProjectConfigRequest):
  """Fetches the current project configuration, or returns defaults if uninitialized."""
  db_path = os.path.join(request.project_path, "fleshnote.db")

  # Default fallback configuration for empty projects
  default_config = {
      "project_name": os.path.basename(request.project_path),
      "author_name": "",
      "genre": "",
      "default_chapter_target": 4000,
      "track_species": False,
      "species_label": "Species",
      "track_groups": False,
      "group_label": "Faction",
      "core_mechanic": "none",
      "mechanic_label": "System",
      "lore_categories": ["item", "artifact", "material"],
      "track_knowledge": False,
      "track_dual_timeline": False,
      "track_custom_calendar": False,
      "story_language": "en",
      "feature_sensory_check": False,
      "feature_voice_detector": False
  }

  if not os.path.exists(db_path):
    print(f"INFO: Database not found at {db_path}. Returning default config.", flush=True)
    return {"status": "success", "config": default_config, "is_default": True}

  try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT config_key, config_value, config_type FROM project_config")
    rows = cursor.fetchall()
    conn.close()

    config = default_config.copy()
    for key, value, ctype in rows:
      if ctype == 'toggle':
        config[key] = (value.lower() == 'true')
      elif ctype == 'json':
        try:
          config[key] = json.loads(value)
        except:
          config[key] = value
      elif ctype == 'int':
        try:
          config[key] = int(value)
        except:
          config[key] = value
      else:
        config[key] = value

    return {"status": "success", "config": config}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/project/config/update")
def update_project_config(request: ProjectConfigUpdateRequest):
  """Updates a specific project configuration value."""
  db_path = os.path.join(request.project_path, "fleshnote.db")

  if not os.path.exists(db_path):
    raise HTTPException(status_code=404, detail="Database not found")

  try:
    # Prepare the value for SQL
    val = request.config_value
    if request.config_type == 'json' and isinstance(val, (list, dict)):
      val_str = json.dumps(val)
    elif isinstance(val, bool):
      val_str = 'true' if val else 'false'
    else:
      val_str = str(val)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
      INSERT INTO project_config (config_key, config_value, config_type)
      VALUES (?, ?, ?)
      ON CONFLICT(config_key) DO UPDATE SET
        config_value = excluded.config_value,
        config_type = excluded.config_type
    """, (request.config_key, val_str, request.config_type))

    # Log changes for authoritative (AUTH) keys only
    LOCAL_CONFIG_KEYS = {"active_sprint", "last_opened_at", "name_gen_settings"}
    if request.config_key not in LOCAL_CONFIG_KEYS:
      from sync_core import log_change
      # Note: config_type is part of the schema and synced as well
      log_change(cursor, "project_config", request.config_key, {
        "config_value": val_str,
        "config_type": request.config_type
      })

    conn.commit()
    conn.close()
    return {"status": "success"}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
  import uvicorn

  # Run the server on port 8000
  uvicorn.run(app, host="127.0.0.1", port=8000)

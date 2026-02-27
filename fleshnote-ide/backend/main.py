import os
import json
import sqlite3

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from db_setup import generate_project_db, apply_migrations

from routes.chapters import router as chapters_router
from routes.characters import router as characters_router
from routes.locations import router as locations_router
from routes.entities import router as entities_router
from routes.imports import router as imports_router
from routes.groups import router as groups_router
from routes.knowledge import router as knowledge_router
from routes.secrets import router as secrets_router
from routes.calendar import router as calendar_router
from routes.quick_notes import router as quick_notes_router
from routes.settings import router as settings_router
from routes.export import router as export_router

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
app.include_router(calendar_router)
app.include_router(quick_notes_router)
app.include_router(settings_router)
app.include_router(export_router)

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


@app.post("/api/projects")
def scan_workspace(request: WorkspaceRequest):
  """Scans the given workspace path for valid FleshNote projects."""
  path = request.workspace_path

  if not os.path.exists(path):
    raise HTTPException(status_code=404, detail="Workspace path does not exist")

  projects = []

  # Very basic scan: look for directories inside the workspace
  try:
    for item in os.listdir(path):
      item_path = os.path.join(path, item)
      if os.path.isdir(item_path):
        # We'll refine this later to only check for folders with a valid sqlite DB
        projects.append({
          "name": item,
          "path": item_path,
          "lastModified": "Just now"  # Will implement actual stat checks later
        })
    return {"projects": projects}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/project/init")
def initialize_project(request: ProjectCreateRequest):
  project_dir = os.path.join(request.workspace_path, request.project_name)

  if os.path.exists(project_dir):
    raise HTTPException(status_code=400, detail="Project folder already exists")

  try:
    # 1. Build the physical folders
    os.makedirs(project_dir)
    os.makedirs(os.path.join(project_dir, "md"))
    os.makedirs(os.path.join(project_dir, "exports"))

    # 2. Generate the SQLite DB using the questionnaire payload
    db_path = generate_project_db(project_dir, request.questionnaire)

    return {
      "status": "success",
      "project_path": project_dir,
      "db_path": db_path
    }
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/project/load")
def load_project(request: ProjectLoadRequest):
  """Loads an existing project's configuration."""
  db_path = os.path.join(request.project_path, "fleshnote.db")

  if not os.path.exists(db_path):
    raise HTTPException(status_code=404, detail="Database not found in project folder")

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

    # Apply any pending migrations to the schema
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
      "track_milestones": False,
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
    conn.commit()
    conn.close()
    return {"status": "success"}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
  import uvicorn

  # Run the server on port 8000
  uvicorn.run(app, host="127.0.0.1", port=8000)

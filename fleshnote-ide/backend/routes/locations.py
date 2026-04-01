"""
FleshNote API — Location Routes
CRUD operations for locations.
"""

import os
import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


class LocationCreate(BaseModel):
    project_path: str
    name: str
    region: str = ""
    description: str = ""
    parent_location_id: int | None = None
    aliases: list[str] = []
    notes: str = ""


class LocationUpdate(BaseModel):
    project_path: str
    location_id: int
    name: str | None = None
    region: str | None = None
    description: str | None = None
    parent_location_id: int | None = None
    aliases: list[str] | None = None
    notes: str | None = None

class LocationDelete(BaseModel):
    project_path: str
    location_id: int

class WeatherStateCreate(BaseModel):
    project_path: str
    location_id: int
    world_time: str
    weather: str = ""
    temperature: str = ""
    moisture: str = ""

class WeatherStateUpdate(BaseModel):
    project_path: str
    weather_state_id: int
    world_time: str | None = None
    weather: str | None = None
    temperature: str | None = None
    moisture: str | None = None

class WeatherStateDelete(BaseModel):
    project_path: str
    weather_state_id: int

class WeatherStateListQuery(BaseModel):
    project_path: str
    location_id: int

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


@router.post("/api/project/locations")
def get_locations(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM locations ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()

    locations = []
    for row in rows:
        locations.append({
            "id": row["id"],
            "name": row["name"],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "region": row["region"],
            "parent_location_id": row["parent_location_id"],
            "description": row["description"],
            "notes": row["notes"],
        })

    return {"locations": locations}


@router.post("/api/project/location/create")
def create_location(req: LocationCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO locations (name, aliases, region, parent_location_id, description, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        req.name,
        json.dumps(req.aliases) if req.aliases else None,
        req.region,
        req.parent_location_id,
        req.description,
        req.notes,
    ))

    loc_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "location": {
            "id": loc_id,
            "name": req.name,
            "region": req.region,
        }
    }


@router.post("/api/project/location/update")
def update_location(req: LocationUpdate):
    """Update a location's fields. Only non-None fields are updated."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []

    for field_name in ["name", "region", "description", "parent_location_id", "notes"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)

    if req.aliases is not None:
        fields.append("aliases = ?")
        values.append(json.dumps(req.aliases))

    fields.append("updated_at = CURRENT_TIMESTAMP")

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(req.location_id)

    cursor.execute(
        f"UPDATE locations SET {', '.join(fields)} WHERE id = ?",
        values
    )
    conn.commit()

    # Return updated location
    cursor.execute("SELECT * FROM locations WHERE id = ?", (req.location_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Location not found")

    return {
        "location": {
            "id": row["id"],
            "name": row["name"],
            "aliases": json.loads(row["aliases"]) if row["aliases"] else [],
            "region": row["region"],
            "parent_location_id": row["parent_location_id"],
            "description": row["description"],
            "notes": row["notes"],
        }
    }


@router.post("/api/project/location/delete")
def delete_location(req: LocationDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM locations WHERE id = ?", (req.location_id,))
    cursor.execute("DELETE FROM image_references WHERE entity_type = 'loc' AND entity_id = ?", (req.location_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}


@router.post("/api/project/location/weather")
def get_weather_states(req: WeatherStateListQuery):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM location_weather_states WHERE location_id = ? ORDER BY world_time ASC",
        (req.location_id,)
    )
    rows = cursor.fetchall()
    conn.close()

    states = []
    for row in rows:
        states.append({
            "id": row["id"],
            "location_id": row["location_id"],
            "world_time": row["world_time"],
            "weather": row["weather"],
            "temperature": row["temperature"],
            "moisture": row["moisture"],
        })
    return {"weather_states": states}


@router.post("/api/project/location/weather/create")
def create_weather_state(req: WeatherStateCreate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO location_weather_states (location_id, world_time, weather, temperature, moisture)
        VALUES (?, ?, ?, ?, ?)
    """, (req.location_id, req.world_time, req.weather, req.temperature, req.moisture))
    
    state_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "weather_state": {
            "id": state_id,
            "location_id": req.location_id,
            "world_time": req.world_time,
            "weather": req.weather,
            "temperature": req.temperature,
            "moisture": req.moisture,
        }
    }


@router.post("/api/project/location/weather/update")
def update_weather_state(req: WeatherStateUpdate):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    fields = []
    values = []

    for field_name in ["world_time", "weather", "temperature", "moisture"]:
        val = getattr(req, field_name)
        if val is not None:
            fields.append(f"{field_name} = ?")
            values.append(val)

    fields.append("updated_at = CURRENT_TIMESTAMP")

    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(req.weather_state_id)

    cursor.execute(
        f"UPDATE location_weather_states SET {', '.join(fields)} WHERE id = ?",
        values
    )
    conn.commit()

    cursor.execute("SELECT * FROM location_weather_states WHERE id = ?", (req.weather_state_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Weather state not found")

    return {
        "weather_state": {
            "id": row["id"],
            "location_id": row["location_id"],
            "world_time": row["world_time"],
            "weather": row["weather"],
            "temperature": row["temperature"],
            "moisture": row["moisture"],
        }
    }


@router.post("/api/project/location/weather/delete")
def delete_weather_state(req: WeatherStateDelete):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM location_weather_states WHERE id = ?", (req.weather_state_id,))
    conn.commit()
    conn.close()
    return {"status": "ok"}

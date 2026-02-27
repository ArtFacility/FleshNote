"""
FleshNote API — Calendar Routes
Custom calendar configuration and age calculation for worldbuilding.
"""

import os
import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProjectPath(BaseModel):
    project_path: str


class CalendarUpdate(BaseModel):
    project_path: str
    updates: dict  # { config_key: config_value, ... }


class AgeCalculation(BaseModel):
    project_path: str
    birth_date: str     # Free-text birth date string
    world_time: str     # Free-text current world time string


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


@router.post("/api/project/calendar/config")
def get_calendar_config(req: ProjectPath):
    """Get the full calendar configuration."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Check if calendar_config table exists (for older projects)
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='calendar_config'
    """)
    if not cursor.fetchone():
        conn.close()
        return {"config": {"calendar_enabled": "false"}}

    cursor.execute("SELECT config_key, config_value FROM calendar_config")
    rows = cursor.fetchall()
    conn.close()

    config = {}
    for row in rows:
        key = row["config_key"]
        val = row["config_value"]
        # Try to parse JSON values
        try:
            config[key] = json.loads(val)
        except (json.JSONDecodeError, TypeError):
            config[key] = val

    return {"config": config}


@router.post("/api/project/calendar/update")
def update_calendar_config(req: CalendarUpdate):
    """Update one or more calendar config entries."""
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Ensure calendar_config table exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS calendar_config (
            config_key   TEXT PRIMARY KEY,
            config_value TEXT
        )
    """)

    for key, value in req.updates.items():
        if isinstance(value, (list, dict)):
            store_value = json.dumps(value)
        elif isinstance(value, bool):
            store_value = str(value).lower()
        else:
            store_value = str(value)

        cursor.execute(
            "INSERT OR REPLACE INTO calendar_config (config_key, config_value) VALUES (?, ?)",
            (key, store_value)
        )

    conn.commit()

    # Return updated config
    cursor.execute("SELECT config_key, config_value FROM calendar_config")
    rows = cursor.fetchall()
    conn.close()

    config = {}
    for row in rows:
        key = row["config_key"]
        val = row["config_value"]
        try:
            config[key] = json.loads(val)
        except (json.JSONDecodeError, TypeError):
            config[key] = val

    return {"config": config}


@router.post("/api/project/calendar/calculate-age")
def calculate_age(req: AgeCalculation):
    """
    Calculate age based on birth_date and world_time strings.

    This is a best-effort calculation. If the calendar has structured
    month data, we try to compute in custom calendar years. Otherwise,
    we return a simple text comparison.

    For the MVP, birth_date and world_time are free-text strings.
    We attempt to extract numeric year values for basic age calculation.
    """
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # Load calendar config
    cursor.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='calendar_config'
    """)
    has_table = cursor.fetchone()

    calendar_config = {}
    if has_table:
        cursor.execute("SELECT config_key, config_value FROM calendar_config")
        for row in cursor.fetchall():
            try:
                calendar_config[row["config_key"]] = json.loads(row["config_value"])
            except (json.JSONDecodeError, TypeError):
                calendar_config[row["config_key"]] = row["config_value"]

    conn.close()

    # Try to extract numeric year values from the strings
    # Look for patterns like "Year 314", "4E-314", "314", etc.
    import re

    def extract_year(text):
        """Extract the most likely year number from a date string."""
        # Pattern: explicit "year X" or "Y X" or just a standalone large number
        patterns = [
            r'[Yy]ear\s+(\d+)',           # "Year 314"
            r'(\d+)\s*[Ee]',              # "4E" (epoch number)
            r'[Ee]\s*-?\s*(\d+)',         # "E-314"
            r'\b(\d{2,})\b',             # Any 2+ digit number (last resort)
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return int(match.group(1))
        return None

    birth_year = extract_year(req.birth_date)
    current_year = extract_year(req.world_time)

    if birth_year is not None and current_year is not None:
        age = current_year - birth_year
        epoch_label = calendar_config.get("epoch_label", "years")
        return {
            "age": age,
            "age_text": f"{age} {epoch_label.lower()}" if age >= 0 else "Not yet born",
            "birth_year": birth_year,
            "current_year": current_year,
            "calculated": True,
        }

    return {
        "age": None,
        "age_text": "Cannot calculate (free-text dates)",
        "birth_year": birth_year,
        "current_year": current_year,
        "calculated": False,
    }

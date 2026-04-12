"""
real_names.py — Real Name Lookup via Local CSV Datasets

Loads first/last name CSVs from data/real/<origin>.csv and picks a
random first + last name matching the requested origin and gender.

CSV format expected (UTF-8, with header row):
    name,type,gender
    Anna,first,female
    Kovács,last,any
    ...

Columns:
  name   — the name string
  type   — "first" or "last"
  gender — "male", "female", or "any"

You can add new origin files (e.g. data/real/japanese.csv) and reference
them with NameGenConfig(mode="real", real_origin="japanese").
"""

from __future__ import annotations
import csv
import random
from pathlib import Path
from functools import lru_cache
from .config import NameGenConfig

# ---------------------------------------------------------------------------
# Data directory
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).parent / "data" / "real"


# ---------------------------------------------------------------------------
# CSV loading with cache
# ---------------------------------------------------------------------------

class RealNameError(Exception):
    pass


@lru_cache(maxsize=16)
def _load_csv(origin: str) -> dict[str, list[str]]:
    """
    Load and cache name lists from <origin>.csv.
    Returns a dict with keys: male_first, female_first, male_last, female_last, any_last
    """
    path = _DATA_DIR / f"{origin}.csv"
    if not path.exists():
        available = list_origins()
        raise RealNameError(
            f"Origin '{origin}' not found. Available: {available}. "
            f"Add a '{origin}.csv' file to {_DATA_DIR} to support this origin."
        )

    res: dict[str, list[str]] = {
        "male_first": [],
        "female_first": [],
        "male_last": [],
        "female_last": [],
        "any_last": []
    }

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name    = row.get("name", "").strip()
            kind    = row.get("type", "").strip().lower()
            gender  = row.get("gender", "any").strip().lower()

            if not name:
                continue

            if kind == "first":
                if gender in ("male", "any"):
                    res["male_first"].append(name)
                if gender in ("female", "any"):
                    res["female_first"].append(name)
            elif kind == "last":
                if gender == "male":
                    res["male_last"].append(name)
                elif gender == "female":
                    res["female_last"].append(name)
                else:
                    res["any_last"].append(name)

    if not (res["male_last"] or res["female_last"] or res["any_last"]):
        raise RealNameError(f"'{origin}.csv' contains no last names (type=last).")

    return res


# ---------------------------------------------------------------------------
# Origin listing
# ---------------------------------------------------------------------------

def list_origins() -> list[str]:
    """Return sorted list of all available real-name origins (without .csv)."""
    if not _DATA_DIR.exists():
        return []
    return sorted(p.stem for p in _DATA_DIR.glob("*.csv"))


# ---------------------------------------------------------------------------
# Public generator
# ---------------------------------------------------------------------------

def generate_real_name(config: NameGenConfig) -> str:
    """
    Pick a real first + last name from the dataset for the given origin.

    Returns "Firstname Lastname" as a single string.
    Retries up to config.max_retries times to satisfy uniqueness.
    """
    names = _load_csv(config.real_origin)

    # Determine requested pool gender
    req_gender = config.real_gender
    existing = set(config.existing_names or [])

    def pick() -> str:
        # 1. Decide on a specific gender for this pick if 'any'
        # We prefer picking from the requested gender, or a random one if 'any'
        pick_gender = req_gender
        if pick_gender == "any":
            pick_gender = random.choice(["male", "female"])
        
        # 2. Select first name pool
        if pick_gender == "male":
            first_pool = names["male_first"] or names["female_first"]
        else:
            first_pool = names["female_first"] or names["male_first"]
            
        if not first_pool:
            return "Unknown" # Should not happen given _load_csv checks
            
        first = random.choice(first_pool)
        
        # 3. Select last name pool based on same gender
        if pick_gender == "male":
            last_pool = names["male_last"] + names["any_last"]
        else:
            last_pool = names["female_last"] + names["any_last"]
            
        # Fallback to the other gender's pool if the requested one is empty
        if not last_pool:
            last_pool = names["male_last"] + names["female_last"] + names["any_last"]
            
        last = random.choice(last_pool)
        
        if hasattr(config, 'real_flip_surname') and config.real_flip_surname:
            return f"{last} {first}"
        return f"{first} {last}"

    candidate = pick()
    for _ in range(config.max_retries):
        if existing and candidate in existing:
            candidate = pick()
        else:
            break

    return candidate

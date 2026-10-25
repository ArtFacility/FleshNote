import os
import sqlite3
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .calendar import extract_year

router = APIRouter()

class ProjectAchievementsRequest(BaseModel):
    project_path: str


def _safe_scalar(cursor, sql, default=0):
    """Metric query that can never break the whole achievements endpoint —
    a missing/legacy table just contributes its default."""
    try:
        cursor.execute(sql)
        row = cursor.fetchone()
        return row[0] if row and row[0] is not None else default
    except Exception:
        return default

ACHIEVEMENTS_DEF = [
    { "id": "w100", "tier": "bronze", "maxProgress": 100, "isHidden": False, "type": "words" },
    { "id": "w500", "tier": "bronze", "maxProgress": 500, "isHidden": False, "type": "words" },
    { "id": "w1000", "tier": "silver", "maxProgress": 1000, "isHidden": False, "type": "words" },
    { "id": "w5000", "tier": "gold", "maxProgress": 5000, "isHidden": False, "type": "words" },
    { "id": "w10000", "tier": "amber", "maxProgress": 10000, "isHidden": True, "type": "words" },
    { "id": "w25000", "tier": "gold", "maxProgress": 25000, "isHidden": True, "type": "words" },
    { "id": "w50000", "tier": "amber", "maxProgress": 50000, "isHidden": True, "type": "words" },
    { "id": "ent1", "tier": "bronze", "maxProgress": 1, "isHidden": False, "type": "entities" },
    { "id": "ent5", "tier": "silver", "maxProgress": 5, "isHidden": False, "type": "entities" },
    { "id": "twist1", "tier": "silver", "maxProgress": 1, "isHidden": True, "type": "twists" },
    { "id": "twist5", "tier": "amber", "maxProgress": 5, "isHidden": True, "type": "twists" },
    { "id": "streak5", "tier": "bronze", "maxProgress": 5, "isHidden": False, "type": "streak" },
    { "id": "streak30", "tier": "amber", "maxProgress": 30, "isHidden": False, "type": "streak" },
    { "id": "streak100", "tier": "amber", "maxProgress": 100, "isHidden": True, "type": "streak" },
    { "id": "ruthless", "tier": "gold", "maxProgress": 1000, "isHidden": True, "type": "deleted_words" },
    # Process & dedication (telemetry-driven)
    { "id": "time6000", "tier": "gold", "maxProgress": 6000, "isHidden": True, "type": "minutes" },       # 100 hours in-app
    { "id": "nightowl", "tier": "silver", "maxProgress": 1, "isHidden": True, "type": "night" },         # wrote between 00:00–06:00
    { "id": "marathon", "tier": "gold", "maxProgress": 1, "isHidden": True, "type": "marathon" },        # a 2h+ continuous session
    
    # Quirks & Easter Eggs
    { "id": "outliner", "tier": "bronze", "maxProgress": 1, "isHidden": True, "type": "outliner" },
    { "id": "discovery", "tier": "amber", "maxProgress": 1, "isHidden": True, "type": "discovery" },
    { "id": "planner_1", "tier": "bronze", "maxProgress": 1, "isHidden": True, "type": "planner_1" },
    { "id": "chekhov_1", "tier": "bronze", "maxProgress": 1, "isHidden": True, "type": "chekhov" },
    { "id": "chekhov_5", "tier": "silver", "maxProgress": 5, "isHidden": True, "type": "chekhov" },
    { "id": "chekhov_10", "tier": "gold", "maxProgress": 10, "isHidden": True, "type": "chekhov" },
    { "id": "beta", "tier": "gold", "maxProgress": 1, "isHidden": True, "type": "beta" },
    { "id": "steves", "tier": "silver", "maxProgress": 1, "isHidden": True, "type": "steves" },
    { "id": "asspull", "tier": "amber", "maxProgress": 1, "isHidden": True, "type": "asspull" },
    { "id": "zen", "tier": "silver", "maxProgress": 1, "isHidden": True, "type": "zen" },
    { "id": "hemingway", "tier": "gold", "maxProgress": 1, "isHidden": True, "type": "hemingway" },
    { "id": "combo", "tier": "gold", "maxProgress": 1, "isHidden": True, "type": "combo" },
    { "id": "retcon", "tier": "amber", "maxProgress": 1, "isHidden": True, "type": "retcon" },
]

@router.post("/api/project/achievements")
def get_achievements(request: ProjectAchievementsRequest):
    """
    Computes current achievement progress dynamically, auto-awards newly met 
    thresholds into the db, and returns the merged state.
    """
    db_path = os.path.join(request.project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Legacy-safe column patch: record what the metrics were at unlock time so
        # a badge can never "un-unlock" visually when the live metric later drops.
        try:
            cols = [c[1] for c in cursor.execute("PRAGMA table_info(achievements)").fetchall()]
            if "progress_at_unlock" not in cols:
                cursor.execute("ALTER TABLE achievements ADD COLUMN progress_at_unlock INTEGER")
                conn.commit()
        except Exception:
            pass

        # 1. Gather Metrics (every query failure-safe)

        # Words (Sum of all chapter word counts)
        total_words = _safe_scalar(cursor, "SELECT SUM(word_count) as total FROM chapters WHERE status != 'planned'")

        # Entities (Count of characters)
        total_entities = _safe_scalar(cursor, "SELECT COUNT(*) as total FROM characters")

        # Twists
        total_twists = _safe_scalar(cursor, "SELECT COUNT(*) as total FROM twists")

        # Ruthless (Deleted Words)
        total_deleted = _safe_scalar(cursor, "SELECT SUM(deleted_words) as total FROM stat_logs")

        # Total in-app minutes (legacy stats counter)
        total_minutes = int(_safe_scalar(cursor, "SELECT stat_value FROM stats WHERE stat_key = 'time_total_minutes'"))

        # Night writing (any writing op between 00:00 and 06:00 local)
        night_ops = _safe_scalar(cursor, """
            SELECT COUNT(*) as total FROM pentimento_ops
            WHERE op_type IN ('insert', 'delete', 'paste')
              AND CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 0 AND 5
        """)

        # Marathon: longest continuous session span, in minutes
        marathon_minutes = _safe_scalar(cursor, """
            SELECT MAX((julianday(end_time) - julianday(start_time)) * 1440.0)
            FROM pentimento_sessions WHERE end_time IS NOT NULL
        """)

        # Streak Calculation
        daily_logs = []
        try:
            cursor.execute('''
                SELECT date(timestamp, 'localtime') as log_date, SUM(new_words) as new_words
                FROM stat_logs
                GROUP BY log_date
                ORDER BY log_date DESC
                LIMIT 365
            ''')
            daily_logs = cursor.fetchall()
        except Exception:
            daily_logs = []

        log_map = {row["log_date"]: row["new_words"] for row in daily_logs}
        today = datetime.now()

        active_streak = 0
        for i in range(3650):
            d = datetime.fromordinal(today.toordinal() - i)
            ds = d.strftime("%Y-%m-%d")

            new_words = log_map.get(ds, 0)

            if i == 0 and new_words == 0:
                continue

            if new_words > 0:
                active_streak += 1
            else:
                break

        metrics = {
            "words": int(total_words),
            "entities": int(total_entities),
            "twists": int(total_twists),
            "deleted_words": int(total_deleted),
            "streak": int(active_streak),
            "minutes": max(0, total_minutes),
            "night": 1 if night_ops > 0 else 0,
            "marathon": 1 if float(marathon_minutes or 0) >= 120 else 0,
        }

        # --- Easter Eggs & Quirks Data Aggregation ---

        # Outliner & Discovery & All According to Plan
        blocks_count = int(_safe_scalar(cursor, "SELECT COUNT(*) as total FROM planner_blocks"))

        metrics["outliner"] = 1 if (blocks_count >= 5 and total_words < 100) else 0
        metrics["discovery"] = 1 if (total_words >= 2000 and blocks_count == 0) else 0
        metrics["planner_1"] = 1 if blocks_count >= 1 else 0

        # Chekhov's Gun / Gunman / Apocalypse
        metrics["chekhov"] = int(_safe_scalar(cursor, """
            SELECT MAX(f_count) as max_f
            FROM (
                SELECT COUNT(*) as f_count FROM foreshadowings GROUP BY twist_id
            )
        """))

        # Beta Reader
        non_beta_chapters = int(_safe_scalar(cursor, "SELECT COUNT(*) as total FROM chapters WHERE status NOT IN ('revised', 'final') AND status != 'planned'"))
        actual_chapters = int(_safe_scalar(cursor, "SELECT COUNT(*) as total FROM chapters WHERE status != 'planned'"))
        metrics["beta"] = 1 if (actual_chapters > 0 and non_beta_chapters == 0) else 0

        # Planet of Steves
        max_steves = int(_safe_scalar(cursor, """
            SELECT MAX(c_count) as max_c
            FROM (
                SELECT COUNT(*) as c_count FROM characters GROUP BY lower(name)
            )
        """))
        metrics["steves"] = 1 if max_steves >= 3 else 0

        # Asspull: knowledge year < birth year
        try:
            cursor.execute("""
                SELECT ks.world_time as knowledge_time, c.birth_date
                FROM knowledge_states ks
                JOIN characters c ON ks.character_id = c.id
                WHERE ks.world_time IS NOT NULL AND c.birth_date IS NOT NULL
                  AND ks.world_time != '' AND c.birth_date != ''
            """)
            asspull_rows = cursor.fetchall()
        except Exception:
            asspull_rows = []
        asspull_achieved = 0
        for r in asspull_rows:
            k_year = extract_year(r["knowledge_time"])
            b_year = extract_year(r["birth_date"])
            if k_year is not None and b_year is not None and k_year < b_year:
                asspull_achieved = 1
                break
        metrics["asspull"] = asspull_achieved

        # Stats based quirks (Gardener, Editor's Nightmare, Street Writer, Retcon)
        try:
            cursor.execute("SELECT stat_key, stat_value FROM stats")
            gstats = {r["stat_key"]: r["stat_value"] for r in cursor.fetchall()}
        except Exception:
            gstats = {}
        
        metrics["zen"] = 1 if int(gstats.get("zen_sprints_400", 0)) >= 1 else 0
        metrics["hemingway"] = 1 if int(gstats.get("hemingway_sprints_1000", 0)) >= 1 else 0
        metrics["combo"] = 1 if int(gstats.get("max_combo", 0)) >= 100 else 0
        metrics["retcon"] = 1 if int(gstats.get("retcon_achieved", 0)) >= 1 else 0

        # 2. Fetch already unlocked achievements (with their unlock-time progress)
        unlocked = {}
        unlocked_at = {}
        try:
            cursor.execute("SELECT id, progress_at_unlock, unlocked_at FROM achievements")
            for row in cursor.fetchall():
                unlocked[row["id"]] = row["progress_at_unlock"]
                unlocked_at[row["id"]] = row["unlocked_at"]
        except Exception:
            unlocked = {}
            unlocked_at = {}
        unlocked_ids = set(unlocked.keys())

        # 3. Compute Progress & Award
        results = []
        newly_unlocked = []

        for ach in ACHIEVEMENTS_DEF:
            ach_id = ach["id"]
            ach_type = ach["type"]
            max_p = ach["maxProgress"]

            current_p = metrics.get(ach_type, 0)
            is_unlocked = ach_id in unlocked_ids

            if not is_unlocked and current_p >= max_p:
                is_unlocked = True
                newly_unlocked.append((ach_id, current_p))

            results.append({
                "id": ach_id,
                "tier": ach["tier"],
                "maxProgress": max_p,
                "currentProgress": current_p,
                "isHidden": ach["isHidden"],
                "isUnlocked": is_unlocked,
                "type": ach_type,
                "progressAtUnlock": unlocked.get(ach_id) if is_unlocked else None,
                "unlockedAt": unlocked_at.get(ach_id) if is_unlocked else None
            })

        # 4. Save newly unlocked (with their unlock-time progress) and backfill
        #    older unlocks so previously-earned badges keep their achieved value.
        if newly_unlocked:
            cursor.executemany(
                "INSERT OR IGNORE INTO achievements (id, progress_at_unlock) VALUES (?, ?)",
                newly_unlocked)
        backfills = [(ach["maxProgress"], ach["id"]) for ach in ACHIEVEMENTS_DEF
                     if ach["id"] in unlocked_ids and unlocked.get(ach["id"]) is None]
        if backfills:
            cursor.executemany(
                "UPDATE achievements SET progress_at_unlock = ? WHERE id = ? AND progress_at_unlock IS NULL",
                backfills)
        if newly_unlocked or backfills:
            conn.commit()

        conn.close()

        return {"status": "success", "achievements": results}

    except Exception as e:
        print(f"Error fetching achievements: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))

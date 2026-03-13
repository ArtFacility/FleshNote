import os
import sqlite3
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .calendar import extract_year

router = APIRouter()

class ProjectAchievementsRequest(BaseModel):
    project_path: str

ACHIEVEMENTS_DEF = [
    { "id": "w100", "tier": "bronze", "maxProgress": 100, "isHidden": False, "type": "words" },
    { "id": "w500", "tier": "bronze", "maxProgress": 500, "isHidden": False, "type": "words" },
    { "id": "w1000", "tier": "silver", "maxProgress": 1000, "isHidden": False, "type": "words" },
    { "id": "w5000", "tier": "gold", "maxProgress": 5000, "isHidden": False, "type": "words" },
    { "id": "w10000", "tier": "amber", "maxProgress": 10000, "isHidden": True, "type": "words" },
    { "id": "ent1", "tier": "bronze", "maxProgress": 1, "isHidden": False, "type": "entities" },
    { "id": "ent5", "tier": "silver", "maxProgress": 5, "isHidden": False, "type": "entities" },
    { "id": "twist1", "tier": "silver", "maxProgress": 1, "isHidden": True, "type": "twists" },
    { "id": "twist5", "tier": "amber", "maxProgress": 5, "isHidden": True, "type": "twists" },
    { "id": "streak5", "tier": "bronze", "maxProgress": 5, "isHidden": False, "type": "streak" },
    { "id": "streak30", "tier": "amber", "maxProgress": 30, "isHidden": False, "type": "streak" },
    { "id": "ruthless", "tier": "gold", "maxProgress": 1000, "isHidden": True, "type": "deleted_words" },
    
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

        # 1. Gather Metrics
        
        # Words (Sum of all chapter word counts)
        cursor.execute("SELECT SUM(word_count) as total FROM chapters WHERE status != 'planned'")
        row = cursor.fetchone()
        total_words = row["total"] if row and row["total"] else 0

        # Entities (Count of characters)
        cursor.execute("SELECT COUNT(*) as total FROM characters")
        row = cursor.fetchone()
        total_entities = row["total"] if row and row["total"] else 0
        
        # Twists
        cursor.execute("SELECT COUNT(*) as total FROM twists")
        row = cursor.fetchone()
        total_twists = row["total"] if row and row["total"] else 0

        # Ruthless (Deleted Words)
        cursor.execute("SELECT SUM(deleted_words) as total FROM stat_logs")
        row = cursor.fetchone()
        total_deleted = row["total"] if row and row["total"] else 0

        # Streak Calculation
        cursor.execute('''
            SELECT date(timestamp, 'localtime') as log_date, SUM(new_words) as new_words
            FROM stat_logs
            GROUP BY log_date
            ORDER BY log_date DESC
            LIMIT 365
        ''')
        daily_logs = cursor.fetchall()
        
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
            "streak": int(active_streak)
        }
        
        # --- Easter Eggs & Quirks Data Aggregation ---
        
        # Outliner & Discovery & All According to Plan
        cursor.execute("SELECT COUNT(*) as total FROM planner_blocks")
        row = cursor.fetchone()
        blocks_count = int(row["total"] if row and row["total"] else 0)
        
        metrics["outliner"] = 1 if (blocks_count >= 5 and total_words < 100) else 0
        metrics["discovery"] = 1 if (total_words >= 2000 and blocks_count == 0) else 0
        metrics["planner_1"] = 1 if blocks_count >= 1 else 0

        # Chekhov's Gun / Gunman / Apocalypse
        cursor.execute("""
            SELECT MAX(f_count) as max_f 
            FROM (
                SELECT COUNT(*) as f_count FROM foreshadowings GROUP BY twist_id
            )
        """)
        row = cursor.fetchone()
        metrics["chekhov"] = int(row["max_f"] if row and row["max_f"] else 0)
        
        # Beta Reader
        cursor.execute("SELECT COUNT(*) as total FROM chapters WHERE status NOT IN ('revised', 'final') AND status != 'planned'")
        row1 = cursor.fetchone()
        non_beta_chapters = int(row1["total"] if row1 and row1["total"] else 0)
        
        cursor.execute("SELECT COUNT(*) as total FROM chapters WHERE status != 'planned'")
        row2 = cursor.fetchone()
        actual_chapters = int(row2["total"] if row2 and row2["total"] else 0)
        metrics["beta"] = 1 if (actual_chapters > 0 and non_beta_chapters == 0) else 0

        # Planet of Steves
        cursor.execute("""
            SELECT MAX(c_count) as max_c 
            FROM (
                SELECT COUNT(*) as c_count FROM characters GROUP BY lower(name)
            )
        """)
        row = cursor.fetchone()
        max_steves = int(row["max_c"] if row and row["max_c"] else 0)
        metrics["steves"] = 1 if max_steves >= 3 else 0

        # Asspull: knowledge year < birth year
        cursor.execute("""
            SELECT ks.world_time as knowledge_time, c.birth_date 
            FROM knowledge_states ks 
            JOIN characters c ON ks.character_id = c.id
            WHERE ks.world_time IS NOT NULL AND c.birth_date IS NOT NULL
              AND ks.world_time != '' AND c.birth_date != ''
        """)
        asspull_rows = cursor.fetchall()
        asspull_achieved = 0
        for r in asspull_rows:
            k_year = extract_year(r["knowledge_time"])
            b_year = extract_year(r["birth_date"])
            if k_year is not None and b_year is not None and k_year < b_year:
                asspull_achieved = 1
                break
        metrics["asspull"] = asspull_achieved
        
        # Stats based quirks (Gardener, Editor's Nightmare, Street Writer, Retcon)
        cursor.execute("SELECT stat_key, stat_value FROM stats")
        gstats = {r["stat_key"]: r["stat_value"] for r in cursor.fetchall()}
        
        metrics["zen"] = 1 if int(gstats.get("zen_sprints_400", 0)) >= 1 else 0
        metrics["hemingway"] = 1 if int(gstats.get("hemingway_sprints_1000", 0)) >= 1 else 0
        metrics["combo"] = 1 if int(gstats.get("max_combo", 0)) >= 100 else 0
        metrics["retcon"] = 1 if int(gstats.get("retcon_achieved", 0)) >= 1 else 0

        # 2. Fetch already unlocked achievements
        cursor.execute("SELECT id FROM achievements")
        unlocked_rows = cursor.fetchall()
        unlocked_ids = {row["id"] for row in unlocked_rows}

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
                newly_unlocked.append((ach_id,))
                
            results.append({
                "id": ach_id,
                "tier": ach["tier"],
                "maxProgress": max_p,
                "currentProgress": current_p,
                "isHidden": ach["isHidden"],
                "isUnlocked": is_unlocked,
                "type": ach_type
            })

        # 4. Save newly unlocked
        if newly_unlocked:
            cursor.executemany("INSERT OR IGNORE INTO achievements (id) VALUES (?)", newly_unlocked)
            conn.commit()

        conn.close()

        return {"status": "success", "achievements": results}

    except Exception as e:
        print(f"Error fetching achievements: {e}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))

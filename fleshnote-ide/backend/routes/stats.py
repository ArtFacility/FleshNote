"""
FleshNote API — Stats Routes
Retrieve global writing statistics, daily logs, and entity mention offsets.
"""

import os
import sqlite3
import re
import json
from collections import Counter
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter()

class ProjectPath(BaseModel):
    project_path: str

class StatUpdateRequest(BaseModel):
    project_path: str
    stat_key: str
    increment_by: int = 0
    set_value: str = ""

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def _calculate_top_words(project_path: str):
    """Calculate the top 10 most used words across all chapters, ignoring stop words and entities."""
    try:
        conn = _get_db(project_path)
        cursor = conn.cursor()
        
        # 1. Get project language
        cursor.execute("SELECT config_value FROM project_config WHERE config_key = 'story_language'")
        row = cursor.fetchone()
        lang = row["config_value"] if row else "en"
        
        # 2. Get all entities to use as stopwords
        cursor.execute("""
            SELECT name FROM characters
            UNION SELECT name FROM locations
            UNION SELECT name FROM lore_entities
            UNION SELECT name FROM groups
        """)
        entity_names = [r["name"].lower() for r in cursor.fetchall()]
        
        entity_words = set()
        for name in entity_names:
            for word in re.findall(r'\b[^\W\d_]+\b', name):
                entity_words.add(word)

        # 3. Load NLP stopwords if available, else fallback
        stopwords: set[str] = set()
        try:
            from nlp_manager import get_nlp
            nlp = get_nlp(lang)
            if hasattr(nlp.Defaults, 'stop_words') and nlp.Defaults.stop_words:
                stopwords = set(list(nlp.Defaults.stop_words))
            else:
                raise ValueError("Empty spacy stopwords")
        except Exception:
            # Fallback to local JSON configuration
            stopwords_path = os.path.join(os.path.dirname(__file__), "..", "stopwords.json")
            if os.path.exists(stopwords_path):
                with open(stopwords_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    stopwords = set(data.get(lang, data.get("en", [])))
            else:
                stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", "of", "it", "is", "as", "was", "that", "this", "my", "your", "his", "her", "their", "are", "we", "you", "i", "he", "she", "they", "be", "have"}
        
        stopwords.update(entity_words)
        
        # 4. Read all chapter markdown files
        cursor.execute("SELECT md_filename FROM chapters WHERE md_filename IS NOT NULL")
        chapters = cursor.fetchall()
        
        md_dir = os.path.join(project_path, "md")
        word_counter = Counter()
        
        for ch in chapters:
            md_path = os.path.join(md_dir, ch["md_filename"])
            if os.path.exists(md_path):
                with open(md_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    # Remove markers
                    content = re.sub(r'\{\{[^}]+\}\}', ' ', content)
                    # Remove HTML
                    content = re.sub(r'<[^>]+>', ' ', content)
                    # Extract words (2 chars or more, ignoring digits/underscores)
                    words = re.findall(r'\b[^\W\d_]{2,}\b', content.lower())
                    filtered = [w for w in words if w not in stopwords]
                    word_counter.update(filtered)
        
        top_50 = word_counter.most_common(50)
        top_50_json = json.dumps([{"word": w, "count": c} for w, c in top_50])
        
        # Save to stats table (we'll keep using the old key for frontend compatibility unless we rename everywhere)
        cursor.execute("SELECT stat_value FROM stats WHERE stat_key = 'top_10_words'")
        if cursor.fetchone():
            cursor.execute("UPDATE stats SET stat_value = ? WHERE stat_key = 'top_10_words'", (top_50_json,))
        else:
            cursor.execute("INSERT INTO stats (stat_key, stat_value) VALUES ('top_10_words', ?)", (top_50_json,))
            
        conn.commit()
    except Exception as e:
        print(f"Error calculating top words: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

@router.post("/api/project/stats")
def get_stats(req: ProjectPath):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()

    # 1. Global Stats
    cursor.execute("SELECT stat_key, stat_value FROM stats")
    global_stats = {row["stat_key"]: row["stat_value"] for row in cursor.fetchall()}

    # 2. Stat Logs (Hourly, Daily, Monthly Rollups for Heatmap/Line Chart)
    # Hourly
    cursor.execute("""
        SELECT 
            strftime('%Y-%m-%d %H:00:00', timestamp) as log_date,
            SUM(new_words) as new_words,
            SUM(deleted_words) as deleted_words,
            SUM(new_entities) as new_entities,
            SUM(deleted_entities) as deleted_entities,
            SUM(new_twists) as new_twists
        FROM stat_logs
        GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp)
        ORDER BY log_date ASC
    """)
    hourly_logs = [dict(row) for row in cursor.fetchall()]

    # Daily
    cursor.execute("""
        SELECT 
            DATE(timestamp) as log_date,
            SUM(new_words) as new_words,
            SUM(deleted_words) as deleted_words,
            SUM(new_entities) as new_entities,
            SUM(deleted_entities) as deleted_entities,
            SUM(new_twists) as new_twists
        FROM stat_logs
        GROUP BY DATE(timestamp)
        ORDER BY log_date ASC
    """)
    daily_logs = [dict(row) for row in cursor.fetchall()]

    # Monthly
    cursor.execute("""
        SELECT 
            strftime('%Y-%m', timestamp) as log_date,
            SUM(new_words) as new_words,
            SUM(deleted_words) as deleted_words,
            SUM(new_entities) as new_entities,
            SUM(deleted_entities) as deleted_entities,
            SUM(new_twists) as new_twists
        FROM stat_logs
        GROUP BY strftime('%Y-%m', timestamp)
        ORDER BY log_date ASC
    """)
    monthly_logs = [dict(row) for row in cursor.fetchall()]

    stat_logs = {
        "hourly": hourly_logs,
        "daily": daily_logs,
        "monthly": monthly_logs
    }

    # 3. Entity Mentions
    cursor.execute("""
        SELECT id, entity_type, entity_id, chapter_id, word_offset, created_at
        FROM entity_mentions
        ORDER BY chapter_id ASC, word_offset ASC
    """)
    entity_mentions = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        "global_stats": global_stats,
        "stat_logs": stat_logs,
        "entity_mentions": entity_mentions
    }

@router.post("/api/project/stats/update")
def update_stat(req: StatUpdateRequest):
    conn = _get_db(req.project_path)
    cursor = conn.cursor()
    
    try:
        # Check if the stat key already exists
        cursor.execute("SELECT stat_value FROM stats WHERE stat_key = ?", (req.stat_key,))
        row = cursor.fetchone()
        
        if row:
            # Update existing
            if req.increment_by != 0:
                # Assuming current value is an integer or float
                try:
                    current = float(row["stat_value"]) if "." in row["stat_value"] else int(row["stat_value"])
                    new_val = str(current + req.increment_by)
                except ValueError:
                    # Fallback if it wasn't numeric
                    new_val = str(req.increment_by)
            else:
                if req.stat_key.startswith("max_"):
                    try:
                        current = float(row["stat_value"])
                        new_num = float(req.set_value)
                        new_val = str(int(max(current, new_num))) if req.set_value.isdigit() else str(max(current, new_num))
                    except ValueError:
                        new_val = req.set_value
                else:
                    new_val = req.set_value
                
            cursor.execute("UPDATE stats SET stat_value = ? WHERE stat_key = ?", (new_val, req.stat_key))
        else:
            # Insert new
            new_val = str(req.increment_by) if req.increment_by != 0 else req.set_value
            cursor.execute("INSERT INTO stats (stat_key, stat_value) VALUES (?, ?)", (req.stat_key, new_val))
            
        # Mirror worldbuilding stats to stat_logs for time-series charts
        if req.stat_key in ["new_entities", "deleted_entities", "new_twists"] and req.increment_by != 0:
            event_ctx = "system_action"
            # Get latest log to group by (within last 60 seconds)
            cursor.execute("""
                SELECT id, timestamp
                FROM stat_logs
                WHERE event_context = ?
                ORDER BY timestamp DESC
                LIMIT 1
            """, (event_ctx,))
            last_log = cursor.fetchone()
            
            import datetime
            update_existing = False
            if last_log:
                log_time = datetime.datetime.fromisoformat(last_log["timestamp"])
                if (datetime.datetime.utcnow() - log_time).total_seconds() < 60:
                    update_existing = True
                    
            if update_existing:
                # Dynamically update the specific column
                cursor.execute(f"""
                    UPDATE stat_logs 
                    SET {req.stat_key} = IFNULL({req.stat_key}, 0) + ?, timestamp = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (req.increment_by, last_log["id"]))
            else:
                cursor.execute(f"""
                    INSERT INTO stat_logs ({req.stat_key}, event_context) 
                    VALUES (?, ?)
                """, (req.increment_by, event_ctx))

        conn.commit()
        return {"status": "ok", "stat_key": req.stat_key, "new_value": new_val}
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

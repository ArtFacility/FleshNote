# Achievements System Architecture

The FleshNote achievements module is designed to monitor continuous writing progression and dynamically evaluate milestones against project statistics. 

The system utilizes an internal verification engine triggered passively when the frontend requests the achievements dashboard.

## 1. Database Schema
Achievements are stored per-project in the local SQLite database. Because achievement metadata (title, tier, goal amount) is hardcoded into the backend for dynamic updates, the database table only needs to store a junction representing fact-of-completion.

```sql
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

To see the full database context, please refer to [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

## 2. Defining New Achievements

All available achievements in the application are strictly defined in `backend/routes/achievements.py` within the `ACHIEVEMENTS_DEF` matrix.

To add a new achievement:
1. Open `backend/routes/achievements.py`
2. Append a new dictionary object to the `ACHIEVEMENTS_DEF` map with a unique `id` key.

```python
    "words_100k": {
        "title": "Novel Architect",
        "desc": "Write 100,000 words across your project.",
        "tier": "Amber",
        "maxProgress": 100000,
        "isHidden": False
    }
```

**Attributes:**
- `title` / `desc` : The fallback English title and description. (Note: These are usually superseded by the `react-i18next` localized JSON files on the frontend).
- `tier` : The graphical classification of the badge. Valid tiers: `Bronze`, `Silver`, `Gold`, `Amber`.
- `maxProgress` : The numerical threshold required to unlock the badge.
- `isHidden` : `True`/`False`. Hidden achievements obscure their description text string with a runic font in the UI until they are unlocked.

## 3. Calculation & Validation Pipeline

The endpoint `GET /api/project/achievements` is responsible for aggregating all live user data and comparing it against `ACHIEVEMENTS_DEF`.

When calculating progress for a new achievement, you **must** write the aggregation logic into the evaluation block inside the endpoint:

```python
# snippet from GET /api/project/achievements

# 1. Fetch live metrics (Words, Entities, Twists, Streaks)
live_words = calculate_total_words(conn)

# 2. Iterate against definitions
for ach_id, ach_def in ACHIEVEMENTS_DEF.items():
    current_progress = 0

    # 3. Map your new achievement ID to its triggering logic!
    if ach_id.startswith("words_"):
        current_progress = live_words
    elif ach_id == "my_new_achievement":
        current_progress = function_that_calculates_metric(conn)
```

If `current_progress >= maxProgress` and the achievement is missing from the `achievements` SQL table, the backend will natively insert an unlocked row with `CURRENT_TIMESTAMP` and immediately notify the UI that the user reached the milestone.

## 4. Localization (i18n)

When adding a new achievement, you must inject its translation strings into the React localization files:
`fleshnote-ide/src/renderer/src/locales/{en/hu/ar/pl}/translation.json`

Because FleshNote is deeply multilingual, the frontend directly pulls `achievements.{id}.title` and `achievements.{id}.desc` using `react-i18next`. The Python backend returns the `ach_id` specifically so the frontend can retrieve the correct localized template.

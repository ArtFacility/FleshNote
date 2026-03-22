# Analytics & Statistics Tracking

FleshNote tracks a variety of qualitative and quantitative writing telemetry to give authors deep insights into their writing habits without relying on heavy and intrusive external analytics providers. 

All telemetry is localized to the specific project via its SQLite database (`fleshnote.db`), and is computed without requiring the application's runtime to maintain heavy React state payloads.

---

## 1. Global Telemetry (`stats` table)
The `stats` table is a flexible Key-Value store mapped dynamically via `/api/project/stats/update`. 

Since multiple IDE panels can asynchronously write conflicting state updates (for example, the Editor auto-save firing at the exact same moment a Sprint concludes), this endpoint bypasses explicit value setting in favor of **native SQLite arithmetic increments**.

```json
{
  "project_path": "C:/...",
  "stat_key": "time_editor_minutes",
  "increment_by": 1
}
```

### Time Auditing
Inside the React context root (`FleshNoteIDE.jsx`), an invisible 60-second `setInterval` continually ticks over. It reads the active `mainView` (Editor, Planner, Analytics, Calendar) and fires an `api:updateStat` IPC increment to log time distribution gracefully. It will purposefully pause itself if a gap reveals the computer has gone to sleep.

### Focus & Sprints Consistency
- Sprints Started: Increments when a user confirms a Sprint Goal.
- Sprints Completed: Increments when a user explicitly hits "End Sprint" after reaching their target goal. Records Sprint Velocity to compute overall WPM averages.
- Sprints Abandoned: Detects "ghost" sessions. When a sprint is initialized, an `active_sprint` UNIX timestamp is serialized directly into the project's global config. If FleshNote restarts and locates a surviving `active_sprint` marker, it flags the session as abandoned via Alt-F4/force-quits.

---

## 2. Daily Output Logs (`stat_logs` table)
Rather than a single increment, the `stat_logs` table records highly granular snapshots. This acts as the backbone for the GitHub-styled Output Growth bar chart.

Whenever the Editor fires an auto-save (triggered upon pausing typing for 500ms), it computes the net change in words.
- If words increased since the previous save, it commits `new_words`.
- If words decreased since the previous save, it commits `deleted_words`.
- It also tracks `new_entities` (Character/Location creations) and `new_twists` to monitor project complexity over time.

These snapshots are automatically aggregated in `stats.py` via `GROUP BY DATE(timestamp)` and served back to the `StatsDashboard` component to calculate:
- **Ruthless Editor Ratio**: A visualization exposing exactly what percentage of all raw word output is discarded during editing.
- **Writing Streak**: A project-local streak counter that detects consecutive days with `new_words > 0`, ignoring gaps caused by system sleep or app closure.

---

## 3. Entity Presence Matrix (`entity_mentions` table)
As writers draft their scenes, TipTap marks entities seamlessly on the page via `{{type:ID|name}}` syntaxes. 

During the backend `/api/project/chapter/save` routine, Python intercepts these markers and registers explicit word-count offsets for each mention, allowing FleshNote to trace exactly how frequently (and exactly *when* within the project timeline) a given Character or Location features heavily, visualized inside the interactive **Entity Auditor** grid.

---

## 4. Vocabulary Analysis
FleshNote performs local frequency analysis on the project manuscript, filtering out common stop-words (e.g., "the", "and", "was") via the backend's internal dictionary. This generates a **Top 50 Filtered Words** cloud, helping authors identify overused crutch words or thematic patterns without sending data to an external NLP service.

---

## 5. Story Health Diagnostics
The "Story Health" tab provides an automated structural audit by cross-referencing telemetry across multiple tables:

- **Twist Logic Warnings**: Analyzes the Foreshadowing system to flag "orphan" twists (active but not linked to any chapter) or "paradoxical" dependencies.
- **Orphan Entities**: Flags Characters or Locations that have been created in the database but have zero mentions (`entity_mentions`) in the current manuscript.
- **Introduction Overload**: Detects "info-dump" chapters where more than 6 new entities are introduced for the first time, warning about potential reader cognitive load.
- **Pacing Balance**: Compares actual word counts against user-defined Chapter Targets, flagging chapters that deviate by more than 50% as potential pacing red flags.

---

## 6. Sensory Analysis & Readability
FleshNote provides deep linguistic feedback to improve prose quality:

- **Sensory Analysis (The 5 Senses)**: Analyzes the distribution of sensory vocabulary (sight, sound, smell, touch, taste) across the manuscript. Flags chapters where specific senses are completely absent, helping authors avoid "white room syndrome" and create more immersive settings.
- **Readability**: Computes text complexity metrics and highlights structural issues to ensure the prose remains engaging without being overly dense.

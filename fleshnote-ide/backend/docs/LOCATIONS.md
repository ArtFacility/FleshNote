# Location Entities & Environment System

Locations in FleshNote are more than just static metadata; they represent a hierarchical, time-aware environment system that influences both the UI and the narrative consistency.

---

## 1. Hierarchical Organization (The Tree)

FleshNote uses a self-referencing relationship in the database (`parent_location_id`) to allow for deep nesting of locations.

### Entity Manager Tree View
In the **Entity Manager -> Locations** tab, users can toggle between a standard grid and a specialized **Tree View**.
- **Visual Hierarchy**: Child locations are indented under their parents.
- **Drag & Drop**: You can reorganize your world by dragging one location onto another. This automatically updates the `parent_location_id` in the database.
- **Cyclic Protection**: Internally, the IDE prevents you from dragging a parent into one of its own descendants to avoid infinite loops.

**Example Hierarchy:**
- **The Northern Reach** (Region)
    - **Winterfell** (City)
        - **The Godswood** (Point of Interest)
        - **The Great Hall** (Interior)

---

## 2. Weather & Environment System

The **Location Inspector Panel** features a dedicated "Weather" tab that allows tracking environmental conditions over the course of the story.

### Time-Based Weather States
Weather is not static. You can define multiple weather states for a single location, each linked to a specific **World Time** (Custom Calendar date).
- **Weather**: (e.g., Sunny, Rainy, Blizzard, Ash-fall)
- **Temperature**: (e.g., Freezing, 22°C, Scorching)
- **Moisture/Humidity**: (e.g., Dry, Humid, Foggy)

### Weather Inheritance (Cascading Environment)
To reduce manual data entry, FleshNote implements an **Inheritance Model** for weather:
1.  When a location is inspected, the IDE looks for a weather state that matches the current **Effective World Time**.
2.  If the current location has no state defined for that time, the system checks its **Parent Location**.
3.  This recursive search continues up the tree (up to 5 levels deep).
4.  If a parent has a defined weather state, the child "inherits" it, and the UI displays an **"Inherited from [Parent Name]"** badge.

*Benefit: Setting "Heavy Rain" for the entire "London" region automatically applies it to "Baker Street" and "The British Museum" unless you explicitly override them with a specific local state.*

---

## 3. Cursor-Based Context

The weather displayed in the Inspector Panel is synchronized with your position in the manuscript.

- As you move your cursor through the text, the IDE identifies the **Effective World Time** (accounting for any [Time Overrides](./TIME_OVERRIDES.md)).
- The **Location Inspector** automatically refreshes to show what the weather was like *at that specific moment in the story* for the inspected location.

---

## 4. Database Integration

Weather data is stored in the `location_weather_states` table:
- `location_id`: Foreign key to `locations`.
- `world_time`: String matching the calendar format.
- `weather`, `temperature`, `moisture`: Text fields.

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the full table definition.

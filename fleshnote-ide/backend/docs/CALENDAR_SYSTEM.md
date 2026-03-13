# Calendar & Time System Architecture

FleshNote features a fully customizable worldbuilding calendar system, allowing authors to define non-Earth time structures (different month lengths, week days, seasons, and epochs) that permeate the entire IDE—from character birthdates to the Timeline Planner.

---

## 1. The Linear Projection Model
To enable complex chronological sorting and distance calculations (e.g., "how many days since the Great Fire?"), the system converts all discrete world dates into a **Linear Day Number**.

- **Formula**: `(Year * DaysPerYear) + DaysInPriorMonths + (Day - 1)`
- **Epoch**: Day 0 is defined as Year 0, Month 1, Day 1.
- **Math Utilities**: Logic is encapsulated in `src/renderer/src/utils/calendarUtils.js` via `dateToLinear()` and `linearToDisplay()`.

---

## 2. Configuration Schema
The calendar configuration is stored as a JSON object within the `fleshnote.db` global project config.

### Month Structure
Each month requires a `name` and a `days` count.
```json
{
  "months": [
    { "name": "Frostmere", "days": 32 },
    { "name": "Solstice", "days": 30 }
  ]
}
```

### Seasons & Epochs
Seasons are defined by their `start_month`. They are used for visual layering in the Planner. The `epoch_label` (e.g., "BCE", "Age of Ash") is appended to all display strings.

---

## 3. UI Components

### `CalendarDatePicker.jsx`
A high-performance reusable input component that supports two modes:
1. **Structured Mode**: A set of dropdowns/inputs for Year, Month, and Day that respects the `calConfig` limits.
2. **Raw/Free-Text Mode**: Allows legacy or unconventional date strings. The component uses `parseWorldDate()` to attempt to re-sync back to structured data if the user switches modes.

### `CustomCalendarPlanner.jsx`
The administrative interface for the time system. It features:
- **Earth Defaults Toggle**: Quickly reset to standard GMT calendars.
- **Proportional Visualizer**: A CSS-flex-based bar chart showing the scale of months and seasons relative to the total year length.
- **Debounced Auto-save**: Commits changes to the backend as the user types.

---

## 4. Backend Persistence
The calendar configuration is managed via the `/api/project/calendar` endpoints.
- **Storage**: `config` table in the SQLite database.
- **Scope**: Per-project. Changing the calendar in one project does not affect others.
- **Synchronization**: When a calendar is updated, the frontend triggers a global `onCalendarChanged` event to refresh all active date pickers and timeline views.

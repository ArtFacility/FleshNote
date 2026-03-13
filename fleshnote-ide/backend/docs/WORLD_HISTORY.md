# World History System

The World History system in FleshNote allows authors to document the absolute chronology of their setting, independent of how events are revealed in the manuscript.

---

## 1. World Time vs. Narrative Time

FleshNote distinguishes between two fundamentally different ways of tracking time:

| Feature | World History | Plot Planner |
| :--- | :--- | :--- |
| **Time Axis** | **World Time** (Dates) | **Narrative Time** (Chapters) |
| **Unit** | Years, Months, Days | Word Progress / Chapter Order |
| **Focus** | Chronology of the world | Structure of the reader's experience |
| **Example** | A character's birth 50 years ago. | A flashback occurring in Chapter 12. |

---

## 2. History Entries

The system tracks specific events tied to entities (Characters, Locations, Lore).

- **Event Types**:
    - `birth` / `death`: Automatically handles age calculations and lifespan bars.
    - `event`: General historical markers.
    - `action`: Specific deeds by an entity.
    - `interaction`: Events involving two entities (renders a connection line).
- **Precision**: Events can be "Year only", "Year/Month", or "Exact Day", allowing for fuzzy historical records.

---

## 3. The History Canvas (`WorldbuildAndHistory.jsx`)

The visualization renders entities as horizontal lanes.

- **Lane Rendering**: Entities are stacked vertically.
- **Connection Lines**: `interaction` events draw vertical paths between the involved lanes, making it easy to see when character paths cross.
- **Automatic Birth Detection**: If a character has a `birth_date` string in their profile, the system attempts to parse it and plot an auto-detected birth marker.

---

## 4. Calendar Integration

World History relys on the project's **Custom Calendar Configuration**. 
- Linear days are calculated from world dates to determine pixel positions.
- Years are labeled according to the configured `epoch_label` (e.g., "342 AC").

---

## 5. Usage in Worldbuilding

While the **Plot Planner** is for pacing your book, the **World History** is for avoiding "timeline rot"—ensuring that characters aren't 200 years old by mistake, that cities existed before they were visited, and that historical prerequisites for your plot are solid.

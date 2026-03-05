# FleshNote Twist System

The Twist System in FleshNote is designed to help authors plan, execute, and track major narrative reveals and their corresponding clues (foreshadowings) throughout the manuscript. It closely integrates with the Editor, the Twist Inspector Panel, and the Plot Planner.

---

## Core Concepts

1. **Twists**:
   - A major plot reveal, secret, or turning point.
   - Resides in a specific **Reveal Chapter**.
   - Can be tracked by status (`planned`, `hinted`, `revealed`).
   - Managed via the "Twist Inspector" panel.

2. **Foreshadowings**:
   - Specific words or phrases scattered in chapters *before* the reveal.
   - These are breadcrumbs or clues left for the reader.
   - In the editor, they appear with a distinct highlight (purple dashed line).

---

## Database Schema Integration

The system leverages two main tables to track relationships without breaking the markdown file structure.

### `twists` Table
| Column                | Description |
| --------------------- | ----------- |
| `id`                  | Primary string/integer identifier |
| `title`               | Summary label of the twist |
| `description`         | Long-form explanation |
| `reveal_chapter_id`   | The definitive chapter where the twist drops |
| `reveal_word_offset`  | Word count marker to pinpoint location |
| `status`              | General status tracked by the author |

### `foreshadowings` Table
| Column                | Description |
| --------------------- | ----------- |
| `id`                  | Primary Key |
| `twist_id`            | Foreign key linking back to `twists` |
| `chapter_id`          | The chapter where this clue is located |
| `word_offset`         | Pinpoints where down the chapter it appears |
| `selected_text`       | The actual text highlighted as a clue |

---

## Editor Integration

We use **TipTap (ProseMirror)** to represent twists and foreshadows directly in the text body via custom inline marks.

### Inline Markers
When saving to disk, the `EntityLinkMark` system processes twist links:

- **Foreshadows**: `{{foreshadow:TWIST_ID|The actual clue text}}`
- **Twists**: `{{twist:TWIST_ID|The big reveal statement}}`

### Cleanup Validation
If a twist changes chapters or is deleted entirely via the inspector, the application auto-cleans the stale marks. A `useEffect` hook in the Editor guarantees that dead link ids disappear quietly without breaking the plain text, ensuring clean markdown when the chapter is loaded.

---

## Twist Inspector Panel

The **Twist Inspector Panel** is a dedicated UI section on the left sidebar used for auditing twists.

- **Warnings Engine**: Automatically grades the "health" of your twist by running heuristics.
  - *Unforeshadowed*: The twist has zero clues leading up to it.
  - *Sparse*: Only 1 or 2 clues exist.
  - *Clustered*: The clues are bunched too close together (all in one chapter).
  - *Desert Gap*: There is an extensive gap (e.g., thousands of words or multiple chapters) between the last clue and the reveal.

- **Localization**: All these complex string warnings are translated via `react-i18next` utilizing variables injected into translation locale keys (`en/translation.json`, `hu/translation.json`, etc.).

---

## Plot Planner Visualization

The twists are actively visualized in the multi-layered **Plot Planner**. 
At the top rail of the planner, a visual lane drops indicator markers for:
1. Every foreshadowing relative to its timeline position.
2. The final twist Reveal point.

Connecting lines between the foreshadowing markers and the reveal marker let authors easily gauge the grouping and spacing of their clues. Tooltips on the twist markers dynamically display localized statuses and hint counts.

---

## Deletion and Safety

Deleting a twist in FleshNote triggers a comprehensive cascading delete:
1. The twist is deleted from the `twists` table.
2. The associated foreshadows are wiped from `foreshadowings`.
3. The next time the affected chapters are loaded in the TipTap editor, any lingering `{{twist:...}}` and `{{foreshadow:...}}` markdown sequences are instantly stripped and converted back into plain text, avoiding orphaned tags.

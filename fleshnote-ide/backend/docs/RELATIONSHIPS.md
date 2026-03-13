# Character Relationship System

FleshNote allows authors to track the evolving dynamics between characters over the course of a story. This system provides a structured way to document "Relationship Turning Points" that are anchored to specific moments in the manuscript and world time.

---

## 1. Relationship Turning Points

Unlike static character bios, FleshNote treats relationships as temporal data. A **Relationship Turning Point** is an entry that records a shift in how one character feels about another.

- **Trigger**: Created via the Editor context menu (Right-click selection -> Relationship Turning Point).
- **Context**: Automatically captures the `selected_text`, `chapter_id`, and `word_offset` where the turning point was identified.
- **World Time**: Can be anchored to a specific in-universe date using the world time picker.

---

## 2. Database Schema (`character_relationships`)

Relationships are stored in a dedicated junction table:

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY |
| `character_id` | INTEGER | The source character (Who feels this?) |
| `target_character_id` | INTEGER | The target character (Towards whom?) |
| `rel_type` | TEXT | E.g., `friendship`, `love`, `hate`, `spite`, `trust`. |
| `is_one_sided` | INTEGER | `1` = Unidirectional; `0` = Mutual (implies symmetry). |
| `notes` | TEXT | Author's explanation of the shift. |
| `world_time` | TEXT | In-universe date of the event. |
| `chapter_id` | INTEGER | Narrative anchor (Where is it written?). |

---

## 3. Directionality: Unidirectional vs. Mutual

- **Unidirectional (`is_one_sided = 1`)**: Represents subjective feelings (e.g., "Alice trusts Bob", but Bob might not trust Alice).
- **Mutual (`is_one_sided = 0`)**: Represents a shared state or established social bond (e.g., "Cousins", "Married"). The UI renders these as shared statuses.

---

## 4. UI Interaction

### Creation: Turning Point Popup
The `RelationshipTurningPointPopup.jsx` component allows selecting:
- The two characters involved (predicted automatically if their names are in the selected text).
- The relationship type (presets or custom).
- Notes and World Time.

### Inspection: Entity Inspector
The **Relationships** tab in the Character Inspector provides:
- A chronological list of all turning points affecting the character.
- **POV Filtering**: Hides relationship secrets if the current project view is filtered by a specific character's knowledge state.
- Quick-edit buttons to refine notes or delete erroneous entries.

---

## 5. Relationship Types (Presets)
While custom types are supported, the system provides standard presets for consistent tracking:
- **Friendship** (Green)
- **Love / Hate** (Red)
- **Trust / Distrust** (Cyan / Orange)
- **Spite** (Purple)
- **Guilt** (Blue)

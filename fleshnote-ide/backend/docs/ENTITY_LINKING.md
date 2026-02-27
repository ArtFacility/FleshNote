# FleshNote Entity Linking System

Deep-dive into how entity references are created, stored, rendered, and tracked across the FleshNote IDE.

---

## Overview

Entity linking connects prose text to structured data entries (characters, locations, items, groups). When an author writes "Sophia walked into the Academy", both "Sophia" and "the Academy" can be linked to their respective database records, enabling hover previews, click-to-inspect, cross-chapter tracking, and epistemic filtering.

---

## Storage Format

Entity links exist in two formats, converted at the load/save boundary in the Python backend.

### Markdown Format (on disk)

```
{{type:id|display_text}}
```

| Type Shortcut | Full Type | Example                    |
| ------------- | --------- | -------------------------- |
| `char`        | character | `{{char:5\|Sophia}}`       |
| `loc`         | location  | `{{loc:2\|the Academy}}`   |
| `item`        | lore      | `{{item:3\|the Compass}}`  |
| `lore`        | lore      | `{{lore:3\|the Compass}}`  |
| `group`       | group     | `{{group:1\|House Varen}}` |

**Example markdown file:**

```
{{char:1|Ren}} walked through the gates of {{loc:2|the Academy}},
clutching {{item:3|the Etheric Compass}} close to her chest.
She knew {{char:5|Sophia}} would be waiting inside.
```

### TipTap HTML Format (in editor memory)

```html
<span data-entity-type="character" data-entity-id="5" class="entity-link character">Sophia</span>
```

**Attributes:**

- `data-entity-type`: Full type name (`character`, `location`, `lore`, `group`)
- `data-entity-id`: Database ID of the entity
- `class`: `entity-link {type}` for CSS styling

---

## Conversion Functions

Located in `backend/routes/chapters.py`.

### `_entity_md_to_html(content: str) -> str`

Called during **chapter load**. Converts markdown markers to TipTap spans.

```python
# Input:  "{{char:5|Sophia}} arrived at {{loc:2|the Academy}}."
# Output: '<span data-entity-type="character" data-entity-id="5" class="entity-link character">Sophia</span> arrived at <span data-entity-type="location" data-entity-id="2" class="entity-link location">the Academy</span>.'
```

**Regex pattern:** `\{\{(char|loc|item|lore|group):(\d+)\|([^}]+)\}\}`

### `_entity_html_to_md(content: str) -> str`

Called during **chapter save**. Converts TipTap spans back to markdown markers.

```python
# Input:  '<span data-entity-type="character" data-entity-id="5" class="entity-link character">Sophia</span>'
# Output: '{{char:5|Sophia}}'
```

**Regex pattern:** `<span[^>]*?data-entity-type="([^"]+)"[^>]*?data-entity-id="(\d+)"[^>]*?>([^<]+)</span>`

### Type Mapping

```python
_ENTITY_TYPE_TO_SHORT = {
    "character": "char",
    "location": "loc",
    "lore": "item",
    "group": "group",
}

_SHORT_TO_ENTITY_TYPE = {
    "char": "character",
    "loc": "location",
    "item": "lore",
    "lore": "lore",
    "group": "group",
}
```

---

## TipTap Extension: EntityLinkMark

Located at `src/renderer/src/extensions/EntityLinkMark.js`.

A custom TipTap `Mark` that represents inline entity references in the editor.

### Attributes

| Attribute    | HTML Attribute     | Description                              |
| ------------ | ------------------ | ---------------------------------------- |
| `entityType` | `data-entity-type` | `character`, `location`, `lore`, `group` |
| `entityId`   | `data-entity-id`   | Database ID as string                    |

### Commands

| Command                                   | Description                               |
| ----------------------------------------- | ----------------------------------------- |
| `setEntityLink({ entityType, entityId })` | Apply entity mark to current selection    |
| `unsetEntityLink()`                       | Remove entity mark from current selection |

### parseHTML

Matches: `<span[data-entity-type]>`

### renderHTML

Outputs: `<span class="entity-link {type}" data-entity-type="..." data-entity-id="...">content</span>`

### CSS Styling (in `index.css`)

```css
.entity-link.character {
  border-bottom: 1px dotted var(--entity-character);
} /* amber */
.entity-link.location {
  border-bottom: 1px dotted var(--entity-location);
} /* green */
.entity-link.item,
.entity-link.lore {
  border-bottom: 1px dotted var(--entity-item);
} /* blue */
.entity-link.group {
  border-bottom: 1px dotted var(--entity-group);
} /* purple */
```

---

## Creating Entity Links

### Right-Click Context Menu

**Component:** `src/renderer/src/components/EntityContextMenu.jsx`

**Trigger:** Right-click with text selected in the editor.

**Flow:**

```
User right-clicks on text
  -> Editor.handleDOMEvents.contextmenu captures event
  -> If nothing is selected, gracefully falls back to catching the word under the mouse pointer via document.caretRangeFromPoint() and Auto-Highlights it.
  -> Gets selected text via window.getSelection()
  -> EntityContextMenu rendered at click position.
  -> useLayoutEffect checks bounding rect. If too close to screen edges, the menu shifts inwards and submenus flip to cascade to the left automatically.

EntityContextMenu shows:
  1. "Link to Existing" (if selected text matches entity name/alias)
     -> User clicks entity
     -> editor.chain().focus().setEntityLink({ entityType, entityId }).run()

  2. "Create New Entity" (Character / Item/Lore / Location)
     -> User clicks entity type
     -> API call: createCharacter / createLoreEntity / createLocation
     -> Returns new entity with ID
     -> editor.chain().focus().setEntityLink({ entityType, entityId }).run()
     -> onEntitiesChanged() refreshes the entity list
```

### Matching Logic

Selected text is compared (case-insensitive) against:

1. Entity `name` field
2. Every entry in the entity's `aliases` JSON array

If an exact match is found, the "Link to Existing" section appears at the top.
If a partial match is found (e.g. text is "Frosty", but character is "Sophia"), it populates the `"Add Alias To ->"` submenu with quick suggestions.

### Add Alias To... Feature

Allows authors to assign non-standard nicknames or variations permanently:

1. Under "Matches found", offers smart suggestions.
2. Clicking "Search..." opens the `AddAliasPopup` to query the entire project logic.
3. Automatically writes the alias to the DB (`addEntityAlias` endpoint) and instantly applies the TipTap `setEntityLink` command to the selected phrase!

---

## Dead Link Auto-Cleanup

To keep documents pristine when deleting entities globally:

1. The TipTap engine (in `Editor.jsx`) runs a debounced `useEffect` map over the document tree.
2. Scans `state.doc.descendants` comparing the ID attributes inside every `entityLink` mark against the master `entities` context array.
3. If an entity was deleted, the mark is automatically removed locally (reverting bounds to plain text) without needing direct instruction from the deletion component!

---

## Hover Cards

Inline component in `Editor.jsx`.

**Trigger:** Mouse hovers over any element with `data-entity-type` attribute.

**Flow:**

```
TipTap handleDOMEvents.mouseover
  -> event.target.closest('[data-entity-type]')
  -> If found: read entityType + entityId from DOM attributes
  -> Look up entity in the entities prop array
  -> Render EntityHoverCard positioned at element.getBoundingClientRect()
```

**Card contents:**

- Entity type badge (e.g. "character" in amber)
- Entity name
- Category (for lore entities)
- "Click to inspect" hint

**Dismissal:** `mouseout` from entity element clears the hover card.

---

## Entity Inspector Panel

**Component:** `src/renderer/src/components/EntityInspectorPanel.jsx`

**Trigger:** Click on an entity link in the editor.

**Flow:**

```
TipTap handleDOMEvents.click
  -> event.target.closest('[data-entity-type]')
  -> If found: call onEntityClick({ type, id })
  -> FleshNoteIDE.handleEntityClick looks up entity in entities array
  -> Sets inspectedEntity state
  -> Switches leftPanelMode from 'chapters' to 'entity'
  -> EntityInspectorPanel renders in left panel
```

**Returning to chapters:** Click X button in panel header.

---

## Appearance Tracking

### Auto-Tracking on Save

Located in `backend/routes/chapters.py`, function `_update_entity_appearances()`.

Called automatically every time a chapter is saved.

**Flow:**

```
chapter/save endpoint
  -> _entity_html_to_md(content) produces markdown
  -> _update_entity_appearances(cursor, chapter_id, md_content)
     -> DELETE FROM entity_appearances WHERE chapter_id = ?
     -> Scan markdown with regex: \{\{(type):(\d+)\|[^}]+\}\}
     -> For each unique (entity_type, entity_id):
        -> INSERT OR IGNORE INTO entity_appearances
```

**Result:** The `entity_appearances` table always reflects the current state of entity links in each chapter. No manual tracking needed.

### Query Pattern

To find all chapters where an entity appears:

```sql
SELECT chapter_id FROM entity_appearances
WHERE entity_type = 'character' AND entity_id = 5
ORDER BY chapter_id
```

To find all entities in a chapter:

```sql
SELECT entity_type, entity_id FROM entity_appearances
WHERE chapter_id = 1
```

---

## Epistemic Toggle

Located in `EntityInspectorPanel.jsx`.

### Author View (default)

- All entity information visible
- True goals, hidden details, author notes displayed
- Full transparency for the writer

### POV Filter

- Simulates what a reader knows at the current chapter
- Hides: true goals, author notes
- Uses `knowledge_states` table to determine visible facts
- Hidden details shown as redacted (CSS `.redacted` class)

**Toggle state:** Local `showHidden` boolean in component. Author View = `true`, POV Filter = `false`.

---

## Pipeline Summary

```
                         ┌─────────────┐
                         │  .md file   │
                         │  on disk    │
                         │             │
                         │ {{char:5|   │
                         │  Sophia}}   │
                         └──────┬──────┘
                                │
                    chapter/load │ chapter/save
                                │
                    ┌───────────┴───────────┐
                    │  Python Backend       │
                    │                       │
                    │  _entity_md_to_html   │
                    │  _entity_html_to_md   │
                    │  _update_appearances  │
                    └───────────┬───────────┘
                                │
                         IPC (3 layers)
                                │
                    ┌───────────┴───────────┐
                    │  TipTap Editor        │
                    │                       │
                    │  <span data-entity-   │
                    │   type="character"    │
                    │   data-entity-id="5"> │
                    │   Sophia</span>       │
                    │                       │
                    │  EntityLinkMark       │
                    │  (custom TipTap Mark) │
                    └───────────────────────┘
```

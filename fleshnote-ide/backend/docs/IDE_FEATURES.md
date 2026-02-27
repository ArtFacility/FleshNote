# FleshNote IDE Features

Comprehensive catalog of all implemented IDE features and their interactions.

---

## Layout

Three-panel layout with title bar, progress bar, and status bar:

```
+------------------------------------------------------------------+
| FLESHNOTE v0.1.0-alpha     Project Name        [_] [O] [X]       |  Title Bar
+------------------------------------------------------------------+
| [Manuscript] [====|====|====|====|====|====]  12,450 / 40,000    |  Progress Bar
+------------------------------------------------------------------+
|  CHAPTERS    |  POV: [Ren v]  STATUS: [Writing v]  2,450 / 4,000 |
|  +---------+ |  [B] [I] [U] [S] | [Clear]                       |  Format Bar
|  | 01 Ch.1 | |  -------------------------------------------------|
|  | 02 Ch.2 | |  Chapter 1                                        |
|  | 03 Ch.3 | |  The Beginning                                    |
|  | ...     | |                                                    |
|  |         | |  Sophia walked into the Academy...                 |  Editor
|  |         | |                                                    |
|  |         | |                                                    |
|  +---------+ |                                                    |
+------------------------------------------------------------------+
|  Project Name                        Markdown . UTF-8  Close Proj |  Status Bar
+------------------------------------------------------------------+
```

### Title Bar

- Project name display
- Window controls: minimize, maximize, close
- Custom frameless window with `titleBarStyle: 'hidden'`

### Progress Bar

- Visual representation of all chapters as segments
- Each segment fills proportionally to `word_count / target_word_count`
- Color-coded by status (amber = writing/draft, green = revised/final, gray = planned)
- Click a segment to switch to that chapter
- Tooltip on hover: chapter number, title, word count, status
- Total word count displayed on the right

### Status Bar

- Project name (left)
- Encoding info: `"Markdown . UTF-8"` (right)
- "Close Project" button returns to project picker

---

## Project Management

### Project Picker (Landing Screen)

- Lists all available projects in the workspace.
- Hovering over a project reveals a trashcan icon.
- Clicking the trashcan opens a styled, centered warning modal. Confirming will permanently `fs.rmSync` the project folder from disk.

---

## Localization & RTL Support

FleshNote IDE boasts robust native support for fully flipping its user interface via `i18n` to support Right-to-Left (RTL) reading formats (e.g. Arabic, Hebrew).

- **Translation Engine**: `react-i18next` handles all hardcoded strings seamlessly.
- **Dynamic RTL Toggling**: Selecting Arabic natively overrides `document.dir = 'rtl'` across the entire embedded Chromium container. 
- **Mirror-Safe CSS Philosophy**:
  Instead of rewriting the entire IDE's grid explicitly for RTL layouts with complex Media Queries, FleshNote IDE enforces CSS Logical Properties natively. 
  - `margin-left` is replaced by `margin-inline-start`
  - `padding-right` is replaced by `padding-inline-end`
  - Horizontal alignments like `right: 0` are replaced by `inset-inline-end: 0`

Because of this, changing the document reading direction physically mirrors every single pixel of the IDE interface automatically—including the TipTap editor engine flow, Context Menus, panel arrangements, and modal paddings without duplicating any styles!

---

## Left Panel

### Chapters Mode (default)

- Header: "Chapters" with + button to create new chapters
- Chapter list items showing:
  - Zero-padded chapter number (`01`, `02`, ...)
  - Chapter title
  - Word count / target words
  - Status badge (color-coded)
- Hovering over a chapter reveals quick actions:
  - Insert Above (shifts chapters and creates a new one)
  - Insert Below
  - Delete Chapter (with confirmation modal)
- Active chapter highlighted with amber border
- Click to switch chapters

### Entity Inspector Mode

- Triggered by clicking an entity link in the editor
- Header: "Entity Inspector" with X button to return to chapters
- Epistemic toggle (Author View / POV Filter)
- Full entity detail card (see Entity Inspector section below)

### Focus Mode

- When enabled, left panel collapses (CSS class `collapsed`)
- Toggled via "Focus" / "Exit Focus" button in editor toolbar
- Applies dynamic inline padding to the editor area to dramatically center your text according to `projectConfig_editor_padding`.

---

## Editor

### TipTap Configuration

- **StarterKit** (codeBlock and blockquote disabled)
- **Underline** extension
- **CharacterCount** extension
- **EntityLinkMark** custom mark extension
- **Placeholder**: "Begin writing..."
- Content format: HTML with entity-link spans

### Metadata Toolbar

Located above the formatting toolbar:

| Element    | Type                | Description                                                                                                                                |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| POV        | `<select>` dropdown | Choose POV character from project's character list. Changes persist via `updateChapter` API.                                               |
| Status     | `<select>` dropdown | One of: Planned, Writing, Draft, Revised, Final. Color-coded. Setting to "Final" instantly auto-adjusts word target to current word count! |
| Word Count | Display & Input     | `{current} / {target} words`. Target count is an interactive number input field.                                                           |
| Focus      | Button              | Toggle focus mode (collapses side panels and narrows editor layout)                                                                        |

### Formatting Toolbar

Row of toggle buttons between metadata toolbar and editor content:

| Button                | TipTap Command      | Shortcut | Active State                |
| --------------------- | ------------------- | -------- | --------------------------- |
| **B** (Bold)          | `toggleBold()`      | Ctrl+B   | Amber highlight when active |
| _I_ (Italic)          | `toggleItalic()`    | Ctrl+I   | Amber highlight when active |
| U (Underline)         | `toggleUnderline()` | Ctrl+U   | Amber highlight when active |
| ~~S~~ (Strikethrough) | `toggleStrike()`    | -        | Amber highlight when active |
| Clear Format          | `unsetAllMarks()`   | -        | No active state             |

### Scrollable Content Area

- Chapter heading: `"Chapter N"` (mono font, uppercase)
- Chapter title: A borderless text `<input>` field overriding the chapter's DB title seamlessly.
- EditorContent: TipTap prose editor
- All three elements scroll together in a single container

### Auto-Save

- Debounced at 500ms after last keystroke
- Saves HTML content + word count via `saveChapterContent` API
- Backend converts entity spans to markdown markers before writing to disk

---

## Entity Link System

### Inline Entity Links

Text marked as entity links renders with type-specific styling:

- **Characters**: Amber dotted underline
- **Locations**: Green dotted underline
- **Items/Lore**: Blue dotted underline

### Right-Click Context Menu

When text is selected in the editor and right-clicked:

1. **"Link to Existing"** section (if selected text matches an entity name or alias):
   - Shows matching entities with type icon and name
   - Clicking applies the entity mark to the selection

2. **"Create New Entity"** section:
   - **Character**: Creates character with selected text as name
   - **Item/Lore**: Creates lore entity with selected text as name
   - **Location**: Creates location with selected text as name
   - Creates entity via API, then applies entity mark

3. **"Add Alias To..."** section:
   - Detects partial matches for immediate click-to-alias attachment.
   - Provides Search popup fallback.
   - Saves to DB and applies the inline tag instantly.

After creation, the entities list is refreshed automatically. `document.caretRangeFromPoint` is used natively so hovering right click over any text will auto-select it if nothing else is highlighted. It is perfectly bounds-checked to the screen width height to prevent clipping!

### Dead Link Formatting

Entities that are completely removed from the project via deletion interfaces (styled internal modals) are automatically stripped from any active documents in the TipTap rendering engine via recursive tree comparison.

### Hover Cards

When hovering over an entity link in the editor:

- Fixed-position card appears below the link
- Shows: entity type badge, entity name, category (if applicable)
- Hint: "Click to inspect"
- Disappears on mouseout

### Entity Inspector Panel

When clicking an entity link in the editor, the left panel switches to show:

**For Characters:**

- Type badge + name + role
- Bio section (serif text)
- Agendas section:
  - Surface Goal (visible, green icon)
  - True Goal (author-only, red icon, hidden in POV Filter mode)
- Known Details: status, species, aliases
- Author Notes (hidden in POV Filter mode)

**For Lore/Locations:**

- Type badge + name + category/region
- Description
- Aliases list

### Epistemic Toggle

Toggle switch at the top of the Entity Inspector:

- **Author View** (eye icon): Shows all information including true goals and author notes
- **POV Filter** (eye-off icon): Hides author-only information, simulating what a reader knows

---

## Chapter Management

### Create Chapter

- Click + button in left panel header
- Auto-assigns next chapter number
- Uses project's `default_chapter_target` for word count target
- Sets status to "writing"
- Creates empty markdown file on disk
- Auto-selects the new chapter

### Switch Chapters

- Click chapter in left panel list
- Click progress bar segment
- Content loads from markdown file via API

### Chapter Status Flow

```
planned -> writing -> draft -> revised -> final
```

Status can be set to any value at any time via the dropdown.

---

## Word Count Tracking

- TipTap's `CharacterCount` extension provides real-time word count
- Displayed in editor toolbar: `{current} / {target} words`
- Saved to database on every auto-save
- Aggregated across chapters in progress bar: `{total} / {total_target} words`
- Per-chapter progress visualized as fill percentage in progress bar segments

---

## Keyboard Shortcuts

| Shortcut                     | Action                   |
| ---------------------------- | ------------------------ |
| Ctrl+B                       | Toggle bold              |
| Ctrl+I                       | Toggle italic            |
| Ctrl+U                       | Toggle underline         |
| Right-click (with selection) | Open entity context menu |
| Escape                       | Close context menu       |

---

## Data Flow

```
User types in TipTap editor
  -> 500ms debounce
  -> Editor.onUpdate sends HTML + word count
  -> FleshNoteIDE.handleEditorUpdate
  -> window.api.saveChapterContent (Preload)
  -> ipcRenderer.invoke (IPC)
  -> backendPost('/api/project/chapter/save') (Main)
  -> Python FastAPI handler
  -> _entity_html_to_md: converts entity spans to {{type:id|text}}
  -> Writes markdown to disk
  -> _update_entity_appearances: scans for entity markers, updates DB
  -> Updates word_count in chapters table
```

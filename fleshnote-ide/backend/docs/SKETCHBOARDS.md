# Sketchboards

Boards for mapping how things in your world work: magic systems, technology, power, trade,
relationships. Open them from **World & History → Sketchboards**.

## Using a board

- **Shapes:** drag a shape from the tool rail onto the board, or click it in the rail and then on the
  board. You can also double-click empty space for a card, or press R / D / O / H / T / F (card,
  diamond, ellipse, hexagon, text, frame). Frames carry whatever sits inside them.
- **Linking entities:** type `@` while naming a node, search in the inspector, or drag a character,
  place or lore entry from the inspector onto the board or onto a node. A linked node shows the
  entity's current name and portrait. Unlink it to rename the node on its own.
- **Connections:** drag from one of a node's side squares to another node. Dropping on empty board
  makes a new node, already connected. Tab adds a connected node next to the selected one.
  - Lines can be straight, curved or elbowed.
  - Drag a line's middle squares to add bends; double-click a bend to remove it.
  - Ends can be none, arrow, bar, dot or diamond.
- **Legend:** name what lines and shapes mean.
  - Label a line, then **Save as a type**. After that, typing the same label on another line gives it
    that type.
  - Restyling a type (inspector, Board → Legend) restyles every line that still wears its look. A
    line restyled by hand keeps its own look and shows **Custom style**, with Reset or Update type.
  - Node kinds work the same way for shape and colour.
  - The legend box in the corner selects everything of a type on click and renames it on
    double-click.
- **Timeline** (clock button):
  - A node or line can appear at a chapter or world date, and can end at one. The inspector's
    Timeline section sets this; so does **Appears from here** / **Ends here** on the selection bar,
    using the scrubber's point. A linked node can appear at its entity's first mention.
  - The scrubber follows the chapter open in the editor; click a chapter in the top bar to move it.
    Drag the scrubber or use ← / → to look around freely. **Chapters** reads the board in reading
    order; **World time** reads it by in-world date.
  - Things not there yet show as faint outlines (or hide), things appearing at this point glow, and
    things that have ended dim.
- **In the manuscript** (book button): dims linked nodes whose entity no chapter mentions yet, and
  counts how many linked ideas appear in the book.
- **Templates:** "+ New board" offers Blank, Magic system, Tech tree, Power structure and Economy.
  Each comes with a legend and a few placeholder nodes.
- **Live boards:** **Relationships** and **Factions** boards draw their lines from the relationship
  tracker and the faction rosters at the scrubbed point. You arrange the nodes; the lines can't be
  edited on the board. Select a line and **Open in the relationship tracker** (or **Open the
  roster**) to change it where it lives: the board gives way to the editor with that inspector tab
  open, and a turning point marked in the text scrolls into view.
- **Make it an entity:** right-click an unlinked node to turn it into a character, place, lore entry
  or faction. For lore, properties named Rules, Limitations or Origin fill those fields.
- **Export / import:** the download button exports an Obsidian Canvas (`.canvas`) file or an SVG
  picture. "+ New board" can import a `.canvas` file. The Canvas format has no bends, dashes, shapes
  or times, so those are left out; an unlabelled line of a legend type is labelled with the type's
  name.
- **Obsidian vault export** (Export → Full project → Obsidian vault) writes every board to
  `Sketchboards/<name>.canvas`. A node linked to an entity becomes a file card showing that entity's
  note. Live boards are drawn as they stand at the end of the story.
- **Elsewhere in the app:**
  - An entity's inspector lists the boards it is on; a row opens the board centred on the node.
  - With **Project Settings → Worldbuilding → Sketchboard actions in the editor menu** switched on,
    right-clicking a linked name offers **Add to board** and **Appears from this chapter on**.
- Press `?` on a board for every shortcut. Undo and redo cover everything on a board, the legend
  included.

## Architecture

- **Code:**
  - `src/renderer/src/components/Sketchboards.jsx` (board list) and `components/sketchboard/`
    (canvas, panels, pure helpers).
  - Backend in `backend/routes/boards.py`, tests in `backend/test_boards.py`.
  - The pure helpers have `node --test` files next to them: `geometry`, `legend`, `timeline`,
    `templates`, `generated`, `promote` and `canvasFile`.
- **Tables:**
  - `boards` (with a JSON `settings` column).
  - `board_items` (nodes), `item_connections` (lines).
  - `board_edge_types` and `board_node_kinds` (the legend).
- **Schema changes are additive only** (`db_setup.BOARD_COLUMNS` / `ensure_board_schema`).
  - Older builds keep syncing and drawing the original columns (`color`, `conn_color`, `item_type`,
    `directed`, `curve_offset`), and every write keeps them at a best-effort equivalent.
  - Rows that only have the original columns are read into the current shape on load; nothing is
    rewritten on open.
- **Writes go through one batch endpoint**, so a multi-node move, a paste or an undo is one
  transaction.
  - Ids are made by the client, which keeps undo and redo instant.
  - A legend entry must exist before a line or node points at it, so the client sends legend puts
    first and legend deletes last.
- **Derived data is never stored or synced:** live entity names, first mentions, coverage, and the
  lines on live boards.
  - Live boards store only node positions. Each node id is a hash of board, kind and entity, so two
    devices placing the same entity make the same row.
  - Live nodes can't be deleted or unlinked; they would come back.
- **The viewport is per device:** it is saved but not synced.

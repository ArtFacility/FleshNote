# Sketchboards

Visual node-graph boards to map systems, magic, relationships, and lore in your project. Features introduced in `v0.8.6`.

## Features
- Infinite canvas with panning and zooming.
- Create unlimited standalone concepts or link nodes directly to existing database entities.
- Draw connections between nodes with customizable dash styles and a 16-color palette.
- Parallel connections are auto-staggered to prevent overlap.
- Board icons use Old Hungarian Unicode characters, Egyptian hieroglyphs, and technical symbols (using the bundled NotoSansOldHungarian font) and can be accessed via an icon picker.
- Time spent exploring and making connections in the Sketchboard automatically contributes to the "Plotting Time" recorded in Analytics.

## Architecture
- **Data Model:** Saved in `boards`, `board_items`, and `item_connections` tables inside the project's SQLite DB.
- **Node linkage:** A node can define an `entity_id` linking it to actual `characters`, `lore_entities`, `locations`, etc.
- Everything persists across sessions without leaving the SQLite application layout.

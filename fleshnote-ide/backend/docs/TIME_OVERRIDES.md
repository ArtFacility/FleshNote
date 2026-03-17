# Time Overrides

Mark specific paragraphs and passages with different in-universe dates directly in the editor to track flashbacks, memories, and timeskips, independent from the chapter's main `world_time`. Features introduced in `v0.8.5`.

## Features
- **Inline Selection:** Apply a Time Override by selecting text, right-clicking, and choosing "Time Override".
- **Time Gutter:** Overridden text is represented by distinctively colored vertical bars in the Time Gutter next to the editor margin.
- The Time Gutter automatically aligns and updates dynamically as the text is modified/expanded.
- **System Integration:** Relationship turning points and Knowledge States will automatically pull and auto-fill their corresponding `world_time` based on the active time override at the current cursor position.

## Technical Details
- **Persistence:** Time overrides are stored in the `world_times` table in the database.
- Each entry logs its associated `chapter_id`, `world_date`, and color index for rendering the gutter lines in the frontend.
- Overrides persist per-chapter across sessions, dynamically anchoring and sliding with prose edits.

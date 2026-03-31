# Time Overrides

Mark specific paragraphs and passages with different in-universe dates directly in the editor to track flashbacks, memories, and timeskips, independent from the chapter's main `world_time`. Features introduced in `v0.8.5`.

## Features
- **Inline Selection:** Apply a Time Override by selecting text, right-clicking, and choosing "Time Override".
- **Time Gutter:** Overridden text is represented by distinctively colored vertical bars in the Time Gutter next to the editor margin.
- The Time Gutter automatically aligns and updates dynamically as the text is modified/expanded.
- **System Integration:** Relationship turning points and Knowledge States will automatically pull and auto-fill their corresponding `world_time` based on the active time override at the current cursor position.
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

## Cursor-based Context Resolution

As of `v1.0.3`, the IDE uses the editor's cursor position to determine the **Effective World Time**. 

1.  **Editor Tracking**: The `Editor.jsx` component monitors selection changes. If the cursor is inside a `timeLink` mark, it resolves the corresponding `world_date` from the `world_times` table.
2.  **Global Synchronization**: The editor emits `onEffectiveTimeChange` to the main shell (`FleshNoteIDE.jsx`).
3.  **Inspector Filtering**: The shell passes this "Effective Time" down to all active inspector panels. 
    *   **Locations**: Automatically switches the weather display to the state matching the cursor's time (or inherits from parent locations).
    *   **Characters**: Filters Knowledge States and Relationship Turning Points to show only what was known or had occurred by that point in the story.

This synchronization ensures that as you write a flashback, your reference material (the sidebar) automatically updates to reflect the past state of the world.

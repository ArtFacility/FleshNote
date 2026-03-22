# Knowledge States (Epistemic Filtering)

The **Epistemic Filtering** system is one of FleshNote's most powerful structural tools. Designed specifically for mysteries, thrillers, and complex multi-POV narratives, it tracks *who knows what, and when they learned it*. 

By integrating this directly into the left-hand Entity Inspector panel, authors can view an entity's lore strictly through the eyes of a specific character at a specific point in time, avoiding accidental continuity errors where a character uses knowledge they haven't technically discovered yet.

---

## 1. Epistemic Architecture

Every factual detail (a "Knowledge State") is explicitly authored. Instead of writing a generic bio block for an entity, authors decompose the lore into discrete facts inside the `knowledge_states` table.

### Anatomy of a Fact
| Field | Function |
| :--- | :--- |
| **Fact Text** | The literal description (e.g. *"Actually an Imperial Spy"*). |
| **Source Entity** | The subject acting as the "target". What entity is this fact about? |
| **Character ID** | **Who** possesses this knowledge? |
| **Learned In Chapter** | **When** did they learn it? (Narrative Time constraint). |
| **World Time** | An alternative chronology constraint, used for non-linear structures. |
| **Is Secret** | Toggle for strictly "Author-Only" meta-context. |

---

## 2. The Three Filter Modes

The Entity Inspector provides a unified dropdown to switch "lenses" when hovering/inspecting an entity. This relies heavily on `POST /api/project/knowledge/for_character`.

### A. Author View (Unfiltered)
Bypasses all timestamps. Shows every fact related to the entity, including meta-secrets. This is the omniscient mode for editing the underlying database.

### B. Narrative View (Chapter-bound)
Constrains knowledge dynamically based on the **currently active chapter in the editor**. 
- The query drops any fact where `learned_in_chapter > current_chapter`.
- Example: If Bob learns Alice is a vampire in Chapter 10, viewing Alice's profile while editing Chapter 4 will *hide* the vampire fact.

### C. World Time View (Chronological)
For stories with wildly non-linear chapters (e.g. Chapter 1 is Year 2026, Chapter 2 is Year 1990 flashback), pacing-based logic fails. 
- The query evaluates the target fact's parsed `world_time` against the active chapter's declared `world_time`.
- Relies on `_extract_year` backend parsing math to evaluate chronological superiority regardless of chapter index.

---

## 3. UI Synchronization

When an author creates a new Fact inside the detail panel:
1. The frontend defaults the `learned_in_chapter` payload to the currently active UI chapter context.
2. The UI instantly fires an IPC call to write the data to SQLite.
3. The panel re-renders with the newly synthesized filtered view. 
4. Changing the active chapter in the central editor automatically dispatches a React state update to the sidebars, instantly fading in/out knowledge points based on the new temporal boundaries.

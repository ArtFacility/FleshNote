# FleshNote Project / Entity Manager

The **Project Manager** (internally represented as the consolidated Entity Manager) is the central command hub for performing high-level audits and structural changes to your manuscript's worldbuilding database. It replaces the older, fragmented dialog boxes with a comprehensive tabbed interface inside the React frontend.

---

## 1. The Tabbed Interface

The Entity Manager handles distinct "Domains" of the database in isolated table views:
- **Characters**
- **Groups / Factions**
- **Locations**
- **Lore Entities**
- **Twists**
- **QuickNotes & TODOs**

Each tab loads its domain-specific data from the FastAPI backend and renders a sortable, filterable React Table. Authors can rapidly search for elements (e.g. searching "Council" in the Groups tab) to narrow down large catalogs.

---

## 2. Bulk Entity Operations

The most powerful feature of the Project Manager is its capability for bulk database operations. Doing this cleanly is critical to prevent orphaned markdown tags and broken history timelines.

### Bulk Deletion
Authors can select multiple entities and delete them simultaneously. 
- **Endpoint**: `POST /api/project/entities/bulk-delete`
- **Safety**: A cascading SQL deletion natively drops all associated `history_entries`, `knowledge_states`, and `entity_appearances`. The frontend Editor component is instructed to strip the dead `{{type:id|text}}` tags upon next chapter load.

### Entity Merging
When duplicates are created (e.g. creating "The King" and then later creating "King Aegon"), authors can merge them into a single definitive entity.
- **Endpoint**: `POST /api/project/entities/merge`
- **Execution**:
  1. **Alias Absorption**: The source entity's name and aliases are parsed into a JSON array and appended to the target entity's `aliases` field.
  2. **Field Consolidation**: Notes, descriptions, or bios from the source entity are appended to the target if they don't overwrite existing distinct data.
  3. **Link Rewriting**: Crucially, the backend scans every markdown chapter file `md/*.md` and regex-replaces the source entity marker `{{char:2|King}}` with the target marker `{{char:5|King}}`.
  4. **Drop**: The source entity is safely deleted.

### Entity Renaming Workflow
When an author edits an entity's name (whether a Character, Location, Lore element, or Group) via the Entity Inspector Panel, the system automatically triggers the **Entity Rename Popup**. This intelligent workflow prevents orphaned text references and broken narrative flow.
- **Scanning**: The backend parses all markdown chapters via `/api/project/entities/scan-references`, searching for the entity's exact ID, the old name, and partial unique overlaps.
- **Exact vs Unique Matches**:
  - *Exact Matches*: Any markdown text explicitly using the exact old name of the entity.
  - *Unique Matches*: Variations or partial matches of the old name found in the manuscript.
- **Frontend Resolution**: The `EntityRenamePopup` provides a UI wizard showing all discovered references. The author can decide on a case-by-case basis whether to update the text to the new name, keep it, or automatically add the text as a new alias.
- **Execution**: The `/api/project/entities/replace-references` endpoint executes the approved replacements across all markdown files simultaneously.

---

## 3. Integrated TODOs and Quick Notes

The "Notes" tab consolidates all floating project-level sticky notes and TODOs.
- This allows writers to track tasks globally across the manuscript without cluttering the chapter texts.
- Uses the `quick_notes` table to persist small task strings.
- Distinct from Chapter Notes, these Quick Notes serve as high-level narrative reminders or structural to-dos.

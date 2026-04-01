# Image Reference System

FleshNote allows authors to attach **reference images** and **portrait icons** to any entity (characters, locations, lore items). The system is split into two distinct concepts — reference images for the gallery and icon images for the inspector header — and both are stored in the same database table with an `is_icon` flag to separate them.

---

## Concepts

### Reference Images

Reference images are visual concept art or mood boards associated with an entity. They appear in the **References tab** of every inspector panel (Character, Location, Entity) as a 2-column grid. Each image can have:

- A **caption** (click-to-edit inline)
- A **world-time tag** — when set, the image is only shown when the narrative is at or past that timestamp (in `world_time` filter mode)

Reference images are **not** shown in the icon slot; they live exclusively in the gallery view.

### Portrait Icons

Each entity has at most **one** icon at a time. This is a square-cropped portrait image displayed prominently in the entity inspector header at `64×64 px`. Icons:

- Are hidden from the gallery grid to avoid duplication
- Are replaced atomically — creating a new icon deletes the previous one from both the database and the filesystem
- Are stored as `256×256 PNG` files produced by the in-app canvas cropper

---

## Database Schema

The `image_references` table stores both gallery images and icons:

```sql
CREATE TABLE image_references (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id   INTEGER NOT NULL,
    entity_type TEXT NOT NULL,   -- 'char', 'loc', 'item', 'group'
    image_path  TEXT NOT NULL,   -- relative to project root, e.g. 'assets/img_abc.png'
    is_icon     INTEGER NOT NULL DEFAULT 0,
    world_time  TEXT,            -- optional in-universe timestamp, e.g. '4E-314, Day 12'
    caption     TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
);
```

**Entity type keys** used when building the bulk-icons lookup:

| Entity Type | Key Format         | Example          |
| :---------- | :----------------- | :--------------- |
| Character   | `char:<id>`        | `char:5`         |
| Location    | `loc:<id>`         | `loc:12`         |
| Lore Entity | `item:<id>`        | `item:3`         |
| Group       | `group:<id>`       | `group:1`        |

---

## File Storage

All image and icon files live in the project's `assets/` directory:

```
{project_path}/
└── assets/
    ├── img_a2f3c91e8b1a.jpg      # reference image (random UUID fragment filename)
    ├── icon_char_5_3f9a2b1c.png  # icon: entity_type + entity_id + UUID fragment
    └── ...
```

Both types use a `uuid4().hex[:12]` fragment to guarantee unique filenames. Icons use a more descriptive naming scheme (`icon_{type}_{id}_{uuid}`) to make them identifiable on disk.

---

## Backend Routes

Defined in `backend/routes/image_references.py`. All routes accept `POST` with JSON bodies.

### Upload Image

**`POST /api/project/image-ref/upload`**

Copies an image from any path on the filesystem into the project's `assets/` directory. Returns a relative path for subsequent DB operations.

```json
// Request
{ "project_path": "C:/.../My Novel", "source_path": "C:/Users/name/Pictures/face.jpg" }

// Response
{ "image_path": "assets/img_a2f3c91e8b1a.jpg" }
```

> **Note:** This endpoint performs a **raw file copy** with no DB write. It is always followed by a `/create` or `/save-icon` call.

---

### Save Icon Crop

**`POST /api/project/image-ref/save-icon`**

Accepts a base64-encoded PNG from the in-app canvas cropper, saves it as a new icon file, and atomically replaces the previous icon for that entity.

```json
// Request
{
  "project_path": "C:/.../My Novel",
  "entity_id": 5,
  "entity_type": "char",
  "image_data": "data:image/png;base64,iVBORw0KGgo..."
}

// Response
{ "image_path": "assets/icon_char_5_3f9a2b1c.png" }
```

**Atomicity:** Before inserting the new icon row, the old icon row is queried, its `image_path` is resolved, and the file is deleted with `os.remove()`. Then the new row is inserted and committed in one transaction.

---

### Create Image Reference

**`POST /api/project/image-ref/create`**

Adds a new gallery image record to the database. If the entity has no existing images, the uploaded image is automatically promoted to icon (`is_icon = 1`) regardless of the `is_icon` parameter supplied.

```json
// Request
{
  "project_path": "C:/.../My Novel",
  "entity_id": 5,
  "entity_type": "char",
  "image_path": "assets/img_a2f3c91e8b1a.jpg",
  "is_icon": 0,
  "world_time": "4E-314, Day 17",
  "caption": "Concept art from prologue"
}

// Response
{ "image_ref": { "id": 3, "entity_id": 5, "entity_type": "char", ... } }
```

---

### Update Image Reference

**`POST /api/project/image-ref/update`**

Updates any combination of `caption`, `world_time`, `is_icon`, or `sort_order`. Only provided (non-null) fields are written. If `is_icon` is set to `1`, all other icons for the same entity are first cleared.

```json
// Request
{
  "project_path": "C:/.../My Novel",
  "image_ref_id": 3,
  "caption": "Night market scene",
  "world_time": "4E-315, Day 3"
}

// Response
{ "image_ref": { "id": 3, "caption": "Night market scene", ... } }
```

---

### Delete Image Reference

**`POST /api/project/image-ref/delete`**

Deletes the database row. When `delete_file: true`, also removes the physical file from `assets/`. If the deleted image was an icon, the next available image is promoted to icon automatically.

```json
// Request
{
  "project_path": "C:/.../My Novel",
  "image_ref_id": 3,
  "delete_file": true
}

// Response
{ "ok": true }
```

---

### Get Images for Entity

**`POST /api/project/image-refs/for-entity`**

Retrieves all image references for a specific entity, ordered by `sort_order, id`. Supports two filter modes:

| `filter_mode`  | Behavior |
| :------------- | :------- |
| `"author"`     | Returns all images, ignoring world-time |
| `"world_time"` | Filters by year extracted from image's `world_time` vs. `current_world_time` |

```json
// Request
{
  "project_path": "C:/.../My Novel",
  "entity_type": "char",
  "entity_id": 5,
  "filter_mode": "world_time",
  "current_world_time": "4E-315, Day 10"
}

// Response
{
  "image_refs": [
    {
      "id": 2,
      "entity_id": 5,
      "entity_type": "char",
      "image_path": "assets/img_a2f3c91e8b1a.jpg",
      "is_icon": 0,
      "world_time": "4E-314, Day 12",
      "caption": "Pre-war portrait",
      "sort_order": 0
    }
  ]
}
```

**World-time filtering logic:** Years are extracted from freeform strings using a regex cascade (e.g., `Year 314`, `314E`, `E-314`, or bare 2+ digit numbers). Images with no `world_time` are always included. Images with a year **greater than** the current year are excluded.

---

### Get Bulk Icons

**`POST /api/project/image-refs/bulk-icons`**

Returns a flat dictionary of all entity icons in the project. Used by inspector panels on load to populate portraits without making N individual queries.

```json
// Request
{ "project_path": "C:/.../My Novel" }

// Response
{
  "icons": {
    "char:5":  "assets/icon_char_5_3f9a2b1c.png",
    "loc:12":  "assets/icon_loc_12_91aef230.png",
    "item:3":  "assets/icon_item_3_aa20bc11.png"
  }
}
```

---

## Frontend Implementation

The frontend implementation lives in `src/renderer/src/components/ide-panels/ImageGallery.jsx`. It is used as a sub-component inside every inspector panel's **References tab**.

### Props

```jsx
<ImageGallery
  projectPath="C:/.../My Novel"  // Active project path
  entityId={5}                    // Entity database ID
  entityType="char"               // 'char', 'loc', 'item', 'group'
  viewMode="author"               // 'author' | 'world_time'
  currentWorldTime="4E-315"       // Chapter's world time (for filtering)
  onIconChanged={loadIcon}        // Callback after icon is updated
  calConfig={calConfig}           // Calendar config for date picker
/>
```

> **i18n:** `ImageGallery` is fully localized via `react-i18next`. All UI strings are keyed under the `gallery.*` namespace (e.g. `gallery.setIcon`, `gallery.makeIcon`, `gallery.cropHint`). Translations exist for English, Hungarian, Arabic, and Polish.

### Gallery Flow

1. On mount / `entityId` / `viewMode` / `currentWorldTime` change → `loadImages()` is called
2. `getImageRefsForEntity` is called with filter params
3. Response is filtered: `is_icon = 1` rows are **excluded** from `displayRefs`
4. Gallery renders with staggered CSS animation (`gallery-item` class, `animationDelay`)
5. Previous images are retained until new data arrives (no loading flicker)

### Lightbox / Image Inspector

Clicking any gallery image opens a full-screen lightbox with an inline inspector panel beneath the image:
- Fade-in overlay + scale-in image (CSS keyframe animations)
- **Prev / Next** buttons (square, not round) for multi-image navigation
- **Keyboard shortcuts:** `←` / `→` to navigate, `Escape` to close
- **Amber-colored** close (`×`) button for visibility
- Counter badge (`2 / 7`) at the top
- Inspector panel below the image (in author mode) containing:
  - **Description** field — click to edit inline; full text visible without truncation
  - **Set Time** button — opens an inline CalendarDatePicker popup
  - **★ Make Icon** button — triggers the cropper using this existing image (no re-upload)
  - **Delete** button

The gallery thumbnail shows a truncated one-line caption with a native tooltip (`title` attribute) for the full description on hover. Clicking a thumbnail opens the lightbox inspector.

### Icon Cropper Flow

The icon cropper is a pure canvas implementation (no external libraries). It can be triggered two ways:

**From a new file upload:**
1. User clicks **"Set Icon"** button → `window.api.openImage()` opens the system file picker
2. The selected file is uploaded via `api:uploadImageRef` → a **temporary** full-resolution file is written to `assets/`
3. `cropperIsTemp` flag is set to `true`; `cropperSrc` is set to the temp path
4. After save or cancel, `api:deleteAssetFile` is called to clean up the temp file

**From an existing gallery image ("Make Icon"):**
1. User clicks **★ Make Icon** on a gallery card or in the lightbox inspector
2. `cropperSrc` is set to the existing image's relative path; `cropperIsTemp` is `false`
3. No temp file is written; no cleanup needed after save or cancel

**In both cases:**
4. The `IconCropper` overlay renders centered on screen:
   - The image is displayed at up to `500×450` display pixels
   - User drags the amber-bordered square to reposition the crop
   - Scroll wheel resizes the crop square (centered)
5. On **"Save Icon"**: the crop region is drawn to an offscreen `<canvas>` at `256×256 px`, exported as base64 PNG, sent to `api:saveIconCrop`
6. `onIconChanged()` is called so the parent inspector panel refreshes its portrait display

On **"Cancel"**: temp file cleanup only occurs when `cropperIsTemp` is `true`.

### IPC / Electron Bridge

All API calls go through `window.api` (defined in `src/preload/index.ts`):

```ts
// Image Reference methods
openImage()                          // dialog:openImage
uploadImageRef(payload)              // api:uploadImageRef
createImageRef(payload)              // api:createImageRef
saveIconCrop(payload)                // api:saveIconCrop
updateImageRef(payload)              // api:updateImageRef
deleteImageRef(payload)              // api:deleteImageRef
getImageRefsForEntity(payload)       // api:getImageRefsForEntity
getBulkEntityIcons(payload)          // api:getBulkEntityIcons
deleteAssetFile(payload)             // api:deleteAssetFile
```

**`api:deleteAssetFile`** is an Electron-side handler (not a backend route). It directly calls `fs.unlinkSync` on the resolved path, after verifying the path contains `/assets/` to prevent arbitrary file deletion.

---

## Inspector Panel Integration

Icon loading is performed by each inspector panel independently using `getBulkEntityIcons`:

```jsx
const loadIcon = useCallback(async () => {
  const res = await window.api.getBulkEntityIcons({ project_path: projectPath })
  setIconPath(res?.icons?.[`char:${entity.id}`] || null)
}, [projectPath, entity?.id])

useEffect(() => { loadIcon() }, [loadIcon])
```

Icons are rendered in the entity header at `64×64 px`:

```jsx
{iconPath && (
  <img
    src={`fleshnote-asset://load/${projectPath.replace(/\\/g, '/')}/${iconPath}`}
    style={{ width: 64, height: 64, borderRadius: 6, objectFit: 'cover' }}
  />
)}
```

### `onIconChanged` Propagation Chain

When a user changes an icon inside an inspector panel, the change must propagate upward to the **EntityManager grid** (which shows small `44×44` entity thumbnails) and the **EntityHoverCard** cache. The wiring is:

1. `ImageGallery` calls `onIconChanged()` after `api:saveIconCrop` succeeds
2. `CharacterInspectorPanel` / `LocationInspectorPanel` receive this and call both:
   - Their own internal `loadIcon()` (updates the inspector header portrait)
   - The externally-provided `onIconChanged?.()` prop
3. `EntityManager` passes `onIconChanged={loadEntityIcons}` to both inspector panels, so the grid thumbnails refresh immediately
4. In `Editor.jsx`, `clearEntityHoverCaches()` (exported from `EntityHoverCard.jsx`) is called whenever the `entities` prop changes, ensuring the hover card icon cache is invalidated after any entity mutation

In the **Entity Manager** grid view, icons are rendered at `44×44 px` on the entity card.

The custom `fleshnote-asset://load/` protocol is handled by the Electron main process and reads files from the local filesystem, bypassing browser security restrictions on `file://` URLs.

---

## EntityHoverCard

The editor's link-hover tooltip lives in `src/renderer/src/components/EntityHoverCard.jsx`. It is mounted in `Editor.jsx` and receives data from the editor's `mouseover` DOM event handler.

### Props

```jsx
<EntityHoverCard
  data={hoverCard}              // { entityType, entityId } | { twistType, twistId } | null
  position={hoverPos}           // { x, y } — fixed screen coords (rect.left, rect.bottom + 4)
  entities={entities}           // Full entity list from FleshNoteIDE state
  projectPath={projectPath}     // Active project path
  effectiveWorldTime={effectiveWorldTime}  // Resolved world time at cursor
/>
```

### Enriched content per entity type

| Type | Extra info shown |
| :--- | :--- |
| `character` | Icon (40×40) + age at scene time (via `api:calculateAge`) |
| `location` | Icon + current weather (from `entity.current_weather`) |
| `lore` / `item` | Icon + category + classification |
| `quicknote` | Note-type chip (colored) + content (truncated at 200 chars) |
| `annotation` | Content (truncated at 200 chars) |
| `twist` | Title + description (truncated at 120 chars) + foreshadow count |
| `foreshadow` | "◈ Foreshadow hint for:" label + the target twist's title + description |

For twist and foreshadow links the hover is triggered by `[data-twist-type]` / `[data-twist-id]` attributes on the spans rendered by `TwistLinkMark.js`.

### Caching

Three module-level `Map` caches prevent redundant API calls during repeated hovers within a session:

| Cache | Key | Contents |
| :--- | :--- | :--- |
| `iconCache` | `projectPath` | Full bulk-icon map `{ 'char:5': 'assets/...' }` |
| `ageCache` | `"<birth_date>|<world_time>|<projectPath>"` | `api:calculateAge` result |
| `twistCache` | `"<projectPath>|<twistId>"` | `api:getTwistDetail` result |

Caches are cleared by calling the exported `clearEntityHoverCaches()` function. `Editor.jsx` calls this whenever `entities` changes (i.e. after any entity mutation). The twist cache is intentionally **not** cleared there — twist data changes through its own dedicated inspector flow.

### Icon key mapping

The bulk-icon map returned by the backend uses the raw `entity_type` DB string as key prefix (e.g. `char:5`, `loc:12`). The hover card translates front-end entity types to these prefixes via:

```js
const ICON_PREFIX = { character: 'char', location: 'loc', lore: 'lore', item: 'lore' }
```

> Note: Both `lore` and `item` entity types resolve to the `lore:` prefix because the backend stores lore entities with `entity_type = 'lore'` in the `image_references` table.

---

## Design Decisions

| Decision | Rationale |
| :--- | :--- |
| Icons excluded from gallery grid | Prevents the icon from appearing twice — once in the header and once in the gallery |
| Single icon per entity enforced by backend | Ensures consistency; the atomicity of `save-icon` prevents orphaned icon rows |
| Temp file upload + delete pattern | Required because the browser canvas needs a displayable URL; base64 data URLs of full-size images can exceed memory limits |
| `api:deleteAssetFile` in Electron main (not backend) | Avoids the round-trip to the Python backend for a simple FS operation; also lets us do the safety check in the same process |
| World-time filter via year extraction | World-time strings are freeform (e.g., "Third Year of the Red Moon") so full date parsing isn't reliable; year comparison is a practical approximation consistent with the rest of the codebase |

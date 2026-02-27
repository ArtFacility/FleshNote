# FleshNote IDE Architecture

High-level overview of the application architecture, communication patterns, and conventions.

---

## Technology Stack

| Layer         | Technology           | Purpose                                |
| ------------- | -------------------- | -------------------------------------- |
| Desktop Shell | Electron             | Window management, native dialogs, IPC |
| Frontend      | React + Vite         | UI components and state management     |
| Editor        | TipTap (ProseMirror) | Rich text editing with custom marks    |
| Styling       | Vanilla CSS          | Custom properties, no frameworks       |
| Backend       | Python FastAPI       | API server, file I/O, NLP processing   |
| Database      | SQLite (WAL mode)    | Per-project data storage               |
| NLP           | spaCy / HuSpaCy      | Named Entity Recognition for import (Dynamic AppData Installation) |

---

## 3-Layer IPC Architecture

All communication flows through three layers: React components never talk directly to the backend.

```
┌────────────────────────┐
│  React Components      │  src/renderer/src/components/
│                        │
│  window.api.method()   │  Calls exposed API methods
└──────────┬─────────────┘
           │
           │  contextBridge (secure)
           │
┌──────────▼─────────────┐
│  Preload Script        │  src/preload/index.ts
│                        │
│  ipcRenderer.invoke()  │  Sends to main process
└──────────┬─────────────┘
           │
           │  IPC channel
           │
┌──────────▼─────────────┐
│  Main Process          │  src/main/index.ts
│                        │
│  backendPost()         │  HTTP POST to Python
└──────────┬─────────────┘
           │
           │  HTTP (localhost:8000)
           │
┌──────────▼─────────────┐
│  Python FastAPI        │  backend/main.py + backend/routes/
│                        │
│  SQLite + File I/O     │  Data persistence
└────────────────────────┘
```

### Preload Layer (`src/preload/index.ts`)

Exposes `window.api` object to renderer via Electron's `contextBridge`. Each method wraps an `ipcRenderer.invoke()` call.

**Methods by domain:**

| Domain     | Methods                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Workspace  | `selectFolder()`, `getProjects()`, `initProject()`, `getGlobalConfig()`, `updateGlobalConfig()`, `loadProject()`              |
| Chapters   | `getChapters()`, `createChapter()`, `bulkCreateChapters()`, `loadChapterContent()`, `saveChapterContent()`, `updateChapter()` |
| Characters | `getCharacters()`, `createCharacter()`, `bulkCreateCharacters()`                                                              |
| Locations  | `getLocations()`, `createLocation()`                                                                                          |
| Entities   | `getEntities()`, `createLoreEntity()`                                                                                         |
| Import     | `openFile()`, `importSplitPreview()`, `importConfirmSplits()`, `importNerExtract()`                                           |
| Window     | `minimizeWindow()`, `maximizeWindow()`, `closeWindow()`                                                                       |

### Main Process (`src/main/index.ts`)

Responsibilities:

1. **Start Python backend** — spawns `backend/.venv/Scripts/python.exe backend/main.py`
2. **Wait for backend** — polls `http://127.0.0.1:8000/` until responsive
3. **Register IPC handlers** — each maps to a `backendPost()` call
4. **Global config** — reads/writes `{userData}/fleshnote_config.json`
5. **Window management** — frameless window with custom title bar
6. **Native dialogs** — folder picker, file picker

### Backend (`backend/main.py`)

FastAPI application mounting route modules:

```python
from routes import chapters, characters, locations, entities, imports

app.include_router(chapters.router)
app.include_router(characters.router)
app.include_router(locations.router)
app.include_router(entities.router)
app.include_router(imports.router)
```

Each route module provides its own `_get_db()` helper for SQLite connections.

---

## File Organization

```
fleshnote-ide/
├── backend/
│   ├── main.py              # FastAPI app, project init/load endpoints
│   ├── db_setup.py           # Schema generator (10 tables, indexes)
│   ├── routes/
│   │   ├── chapters.py       # Chapter CRUD + entity link conversion
│   │   ├── characters.py     # Character CRUD
│   │   ├── locations.py      # Location CRUD
│   │   ├── entities.py       # Aggregated entity listing + lore entity CRUD
│   │   └── imports.py        # Manuscript splitting + NER extraction
│   ├── docs/                 # This documentation
│   └── .venv/                # Python virtual environment
│
├── src/
│   ├── main/
│   │   └── index.ts          # Electron main process, IPC handlers
│   ├── preload/
│   │   └── index.ts          # contextBridge API exposure
│   └── renderer/
│       └── src/
│           ├── App.jsx       # View router (picker -> questionnaire -> setup -> ide)
│           ├── index.css     # All styles (custom properties, no frameworks)
│           ├── main.tsx      # React entry point
│           ├── components/
│           │   ├── FleshNoteIDE.jsx           # Main IDE shell
│           │   ├── Editor.jsx                 # TipTap editor with toolbars
│           │   ├── EntityContextMenu.jsx      # Right-click entity creation
│           │   ├── EntityInspectorPanel.jsx   # Entity detail in left sidebar
│           │   ├── ProjectQuestionnaire.jsx   # 3-step onboarding wizard
│           │   └── ProjectSetup.jsx           # Post-questionnaire setup
│           └── extensions/
│               └── EntityLinkMark.js          # Custom TipTap mark
│
├── resources/                # App icons
├── package.json
└── electron.vite.config.ts
```

---

## Project Data Structure

Each FleshNote project is a directory containing:

```
My Novel/
├── fleshnote.db              # SQLite database (WAL mode)
└── md/
    ├── ch_001_chapter_1.md
    ├── ch_002_the_arrival.md
    ├── ch_003_untitled.md
    └── ...
```

- **`fleshnote.db`**: All structured data (config, characters, entities, chapters metadata, knowledge states)
- **`md/`**: Markdown files with prose content and entity markers (`{{char:5|Sophia}}`)

---

## API Conventions

1. **All endpoints use POST** — even read operations. This allows `project_path` to be sent in the request body consistently.

2. **`project_path` in every request** — identifies which project's database to connect to. No global state on the server.

3. **Route organization** — one Python file per domain in `backend/routes/`, each with its own `APIRouter` and `_get_db()` helper.

4. **Response shapes** — singular entities wrapped in type key (`{ "chapter": {...} }`), lists wrapped in plural key (`{ "chapters": [...] }`).

---

## Styling Conventions

1. **Vanilla CSS only** — no CSS frameworks, no CSS-in-JS, no utility classes
2. **Custom properties** — all colors, fonts, and spacing defined as CSS variables in `index.css`
3. **Inline SVGs** — all icons are inline SVG components, no icon libraries
4. **Dark theme** — single theme, no light mode
5. **Font stack**:
   - `--font-sans`: Inter (UI text)
   - `--font-serif`: Crimson Pro (prose/editor text)
   - `--font-mono`: JetBrains Mono (labels, code, metadata)
6. **Color tokens**:
   - `--accent-amber`: Primary accent (active states, highlights)
   - `--accent-green`: Success/revised states
   - `--accent-red`: Danger/hidden states
   - `--entity-character`: Amber (character entity links)
   - `--entity-location`: Green (location entity links)
   - `--entity-item`: Blue (item/lore entity links)

---

## Backend Startup Sequence

```
1. Electron app.whenReady()
2. startPythonBackend()
   -> spawn(backend/.venv/Scripts/python.exe, [backend/main.py])
3. waitForBackend()
   -> Poll GET http://127.0.0.1:8000/ every 200ms until 200 OK
4. Register all IPC handlers
5. createWindow()
   -> BrowserWindow with frameless titlebar
   -> Load Vite dev server (dev) or built HTML (prod)
```

**Shutdown:**

```
1. app.on('window-all-closed')
   -> pythonProcess.kill()
   -> app.quit()
2. app.on('will-quit')
   -> pythonProcess.kill() (safety net)
```

---

## Data Flow Patterns

### Chapter Load

```
User clicks chapter in left panel
  -> FleshNoteIDE.loadChapter(chapter)
  -> window.api.loadChapterContent(projectPath, chapterId)
  -> IPC -> backendPost('/api/project/chapter/load')
  -> Python reads .md file from disk
  -> _plain_text_to_html(): convert plain text to <p> tags
  -> _entity_md_to_html(): convert {{char:5|Sophia}} to <span> tags
  -> Returns HTML to renderer
  -> editor.commands.setContent(html)
```

### Chapter Save (auto-save, 500ms debounce)

```
User types in TipTap editor
  -> 500ms debounce timer
  -> editor.getHTML() + editor.storage.characterCount.words()
  -> FleshNoteIDE.handleEditorUpdate(html, wordCount)
  -> window.api.saveChapterContent({ project_path, chapter_id, content, word_count })
  -> IPC -> backendPost('/api/project/chapter/save')
  -> Python: _entity_html_to_md(content) converts spans to {{}} markers
  -> Write markdown to disk
  -> _update_entity_appearances(): scan markers, upsert entity_appearances table
  -> UPDATE chapters SET word_count, updated_at
```

### Entity Creation from Context Menu

```
User selects text -> Right-clicks -> "Create Character"
  -> window.api.createCharacter({ project_path, name: selectedText })
  -> IPC -> backendPost('/api/project/character/create')
  -> Python inserts into characters table, returns { character: { id, name } }
  -> editor.chain().focus().setEntityLink({ entityType: 'character', entityId: id }).run()
  -> TipTap wraps selection in entity-link span
  -> onEntitiesChanged() triggers entity list refresh
```

---

## Import Pipeline

```
User selects file (.txt / .md / .docx)
  -> window.api.importSplitPreview({ project_path, file_path })
  -> Python reads file:
     - .txt/.md: read as UTF-8 text
     - .docx: python-docx extracts paragraphs, preserves headings as #
  -> Heuristic splitting (5 strategies, priority order):
     1. Markdown headings
     2. DOCX headings
     3. Regex: Chapter/Prologue/Epilogue patterns
     4. Delimiters: ---, ***, ###, ===
     5. Large whitespace gaps (4+ blank lines)
  -> Returns splits[] with title, content, preview, word_count

User reviews, renames, merges splits
  -> window.api.importConfirmSplits({ project_path, splits, pov_character_id, target_word_count })
  -> Python creates chapters in DB, writes .md files
  -> Returns created chapters[]

Optional: NER entity extraction
  -> window.api.importNerExtract(combinedText)
  -> spaCy en_core_web_sm processes text
  -> Returns entities[] with text, type, label, start, end
  -> User reviews, approves entities
  -> Approved entities created via respective create endpoints
```

---

## Dependencies

### JavaScript (package.json)

- `electron` — Desktop shell
- `@electron-toolkit/preload` — Preload utilities
- `@electron-toolkit/utils` — Main process utilities
- `@tiptap/react` — React bindings for TipTap
- `@tiptap/starter-kit` — Core editor extensions
- `@tiptap/extension-placeholder` — Empty editor placeholder
- `@tiptap/extension-character-count` — Word counting
- `@tiptap/extension-underline` — Underline formatting
- `@tiptap/core` — Core TipTap API (for custom marks)
- `react`, `react-dom` — UI framework
- `vite`, `electron-vite` — Build tooling

### Python (backend/.venv)

- `fastapi` — API framework
- `uvicorn` — ASGI server
- `pydantic` — Request validation
- `spacy` — NLP/NER processing
- `en_core_web_sm` — English language model
- `python-docx` — DOCX file reading (optional)

---

## NLP Model Management

To prevent massive native executable bloat from packaging heavy NLP datasets directly into the Electron/PyInstaller binaries, FleshNote IDE dynamically fetches required NLP models directly into the user's permanent local roaming profile (e.g. `AppData` on Windows).

```
1. Frontend checks window.api.checkNlpModel(langCode)
2. If missing, window.api.loadNlpModel(language) fires
3. Python backend (nlp_manager.py) determines the optimal pip strategy:
   - Official models: Uses spacy.cli.download to map to explicit explosion tarballs on Github
   - Custom variants (like 'huspacy' for Hungarian): explicitly queries the huggingface latest wheel
4. Launches an asynchronous subprocess.Popen running `pip install --target {app_data_models_dir}`
5. Yields DOWNLOAD_PROGRESS stdout logs parsed automatically by IPC back to the React UI
```
This architecture keeps the base application slim while reliably caching language AI toolings system-wide.

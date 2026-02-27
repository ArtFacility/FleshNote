# FleshNote Onboarding Flow

Step-by-step walkthrough of how a user creates a new project and enters the IDE.

---

## View State Machine

```
ProjectPicker -> ProjectQuestionnaire -> ProjectSetup -> FleshNoteIDE
     ^                                                        |
     |                                                        |
     +------------------  "Close Project"  -------------------+
```

Managed by `src/renderer/src/App.jsx` via `view` state.

---

## Step 1: Project Picker

**Component:** `App.jsx` (inline)

### First Launch

1. User clicks "Choose Workspace Folder"
2. OS folder picker dialog opens
3. Selected path saved to global config (`{userData}/fleshnote_config.json`)
4. Workspace scanned for existing projects via `POST /api/projects`

### Returning User

1. App loads saved workspace path from global config
2. Auto-scans for projects
3. Shows project cards: name, word count, status

### Actions

- **Click project card** -> Load project config -> Enter IDE (`view: 'ide'`)
- **Click "+ New Project"** -> Enter Questionnaire (`view: 'questionnaire'`)
- **Click "Change Workspace"** -> Open folder picker, re-scan

---

## Step 2: Project Questionnaire

**Component:** `src/renderer/src/components/ProjectQuestionnaire.jsx`

A 3-step wizard that collects project metadata and worldbuilding configuration.

### Step 1 of 3: Project Metadata

| Field        | Type              | Description                                          |
| ------------ | ----------------- | ---------------------------------------------------- |
| Project Name | Text input        | Required. Used as directory name.                    |
| Author Name  | Text input        | Stored in project config.                            |
| Genre        | 5-option selector | `fantasy`, `sci-fi`, `romance`, `thriller`, `custom` |

**Genre selection auto-fills sensible defaults for Step 2 and 3.** The user can override any default.

### Step 2 of 3: Worldbuilding Constraints

| Field          | Type                          | Default varies by genre                     |
| -------------- | ----------------------------- | ------------------------------------------- |
| Track Species? | Toggle                        | Fantasy/Sci-Fi: on, Romance/Thriller: off   |
| Species Label  | Text input                    | Shown when toggle is on. Default: "Species" |
| Core Mechanic  | 3-option: Magic / Tech / None | Fantasy: Magic, Sci-Fi: Tech, others: None  |
| Mechanic Label | Text input                    | Default: "Magic System" or "Technology"     |
| Track Groups?  | Toggle                        | Fantasy/Sci-Fi/Thriller: on, Romance: off   |
| Group Label    | Text input                    | Default: "Faction"                          |

### Step 3 of 3: Advanced Systems

| Field                 | Type                 | Default varies by genre                   |
| --------------------- | -------------------- | ----------------------------------------- |
| Epistemic Filtering   | Toggle               | Fantasy/Sci-Fi/Thriller: on, Romance: on  |
| Plot Milestones       | Toggle               | All: on                                   |
| Dual Timeline         | Toggle               | Fantasy/Sci-Fi/Thriller: on, Romance: off |
| Chapter Target        | Number input         | Default: 4000                             |
| Extra Lore Categories | Comma-separated text | Varies by genre                           |

### Genre Presets

| Setting         | Fantasy                                      | Sci-Fi                                | Romance                          | Thriller                         | Custom |
| --------------- | -------------------------------------------- | ------------------------------------- | -------------------------------- | -------------------------------- | ------ |
| Species         | on                                           | on                                    | off                              | off                              | off    |
| Mechanic        | magic                                        | tech                                  | none                             | none                             | none   |
| Groups          | on                                           | on                                    | off                              | on                               | off    |
| Milestones      | on                                           | on                                    | on                               | on                               | on     |
| Knowledge       | on                                           | on                                    | on                               | on                               | on     |
| Dual Timeline   | on                                           | on                                    | off                              | on                               | off    |
| Lore Categories | mechanic, item, artifact, creature, material | tech, item, weapon, vehicle, material | item, tradition, location_detail | item, evidence, weapon, document | item   |

### Submission

Calls `POST /api/project/init` with the questionnaire payload. This creates:

1. Project directory at `{workspace}/{project_name}/`
2. `md/` subdirectory for chapter markdown files
3. `fleshnote.db` with all 10 tables
4. `project_config` entries populated from questionnaire answers

Transitions to: `view: 'setup'`

---

## Step 3: Project Setup

**Component:** `src/renderer/src/components/ProjectSetup.jsx`

### Mode Selection (Step 0)

Two paths:

1. **Start Fresh** - Build your world from scratch
2. **Import Story** - Import an existing manuscript

Each path is a 3-step sub-wizard.

---

### Fresh Path

#### Step 1: World & Setting

| Field             | Type       | Description                          |
| ----------------- | ---------- | ------------------------------------ |
| World Name        | Text input | Name of the story's world            |
| Starting Location | Text input | Where Ch.1 takes place               |
| Region            | Text input | Broader area the location belongs to |

Creates a location entry via `POST /api/project/location/create`.

#### Step 2: Characters

Interactive character creation form:

| Field   | Type       | Description                              |
| ------- | ---------- | ---------------------------------------- |
| Name    | Text input | Required                                 |
| Role    | Select     | Protagonist, Antagonist, Supporting      |
| Age     | Text input | Optional                                 |
| Species | Text input | Only shown if `track_species` is enabled |
| Bio     | Textarea   | Character description                    |

- Can add multiple characters
- First character auto-assigned as POV for Chapter 1
- Creates characters via `POST /api/project/character/create`
- At least one character required to proceed

#### Step 3: Story Scope

Presets for initial chapter count:

| Preset      | Chapters   | Description        |
| ----------- | ---------- | ------------------ |
| Short Story | 3          | Quick narrative    |
| Novella     | 10         | Mid-length work    |
| Novel       | 25         | Standard novel     |
| Epic        | 40         | Extended narrative |
| Custom      | User input | Any number         |

Creates chapters via `POST /api/project/chapters/bulk-create`:

- Chapter 1: `status: "writing"`, assigned first character as POV
- Chapters 2+: `status: "planned"`, no POV

Transitions to: `view: 'ide'`

---

### Import Path

#### Step 1: Manuscript Import

1. User clicks "Select File" -> OS file picker (`.txt`, `.md`, `.docx`)
2. File analyzed via `POST /api/project/import/split-preview`
3. Heuristic chapter splits displayed as preview cards:
   - Title (editable)
   - First 150 characters preview
   - Word count
4. User can merge/rename/reorder splits
5. User can load additional files (accumulates splits)
6. Click "Confirm Splits" -> `POST /api/project/import/confirm-splits`
7. Chapters created with `status: "draft"`, markdown files written

#### Step 2: Worldbuilding Data (Optional)

- "Skip" button available
- If not skipped: launches NER Entity Extractor
  - Sends combined chapter text to `POST /api/project/import/ner-extract`
  - spaCy identifies: characters (PERSON), locations (GPE/LOC/FAC), groups (ORG)
  - User reviews and approves/rejects each detected entity
  - Approved entities created via respective creation endpoints

#### Step 3: Character Setup

- Same as Fresh Path Step 2
- Pre-populated with NER-detected characters (if Step 2 wasn't skipped)
- At least one character required

Transitions to: `view: 'ide'`

---

## Post-Onboarding: IDE Entry

Once setup completes:

1. `App.jsx` stores `projectPath` and `projectConfig` in state
2. Renders `FleshNoteIDE` component
3. IDE loads chapters, characters, entities in parallel
4. Auto-selects first chapter with `status: "writing"` (or last chapter)
5. User starts writing

---

## Data Flow Summary

```
Questionnaire answers
  -> POST /api/project/init
  -> Creates DB with project_config entries
  -> Returns project_path

Setup wizard
  -> POST /api/project/location/create (world setting)
  -> POST /api/project/character/create (each character)
  -> POST /api/project/chapters/bulk-create (story scope)
  OR
  -> POST /api/project/import/split-preview (analyze manuscript)
  -> POST /api/project/import/confirm-splits (create chapters)
  -> POST /api/project/import/ner-extract (optional NLP)

IDE ready
  -> POST /api/project/chapters (load chapter list)
  -> POST /api/project/characters (load character list)
  -> POST /api/project/entities (load entity list)
  -> POST /api/project/chapter/load (load first chapter content)
```

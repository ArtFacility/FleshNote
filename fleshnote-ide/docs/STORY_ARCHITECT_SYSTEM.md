# FleshNote Story Architect & Narrative Blueprint Engine
## Comprehensive System Manual & Architectural Reference

> **Document Version:** 1.0.0  
> **Status:** Production / Implemented (Milestone 2)  
> **Target Application:** FleshNote IDE v2.0+  
> **Design Brand Reference:** [App Brand & Design Philosophy](file:///C:/Other%20Projects/fleshnote-site/docs/brand-guide.html) (`docs/brand-guide.html`)

---

## 1. Executive Summary & Design Philosophy

The **Story Architect & Narrative Blueprint Engine** is FleshNote's foundational onboarding and structural planning system. It solves the critical tension between two diametrically opposed writer personas:

1. **The Focused Writer (Existing Manuscript / Concrete Plan):** Authors with existing drafts or a clear plan who want immediate access to the manuscript canvas without questionnaire friction.
2. **The Exploring Architect (Idea Incubation / Unstructured Discovery):** Authors who do not yet have their story mapped, who need creative sparks, archetypal frameworks, and structured scaffolding to overcome the blank page.

```
                         [ New Project Trigger ]
                                    │
                                    ▼
                         [ NewProjectChoiceModal ]
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
[ Existing Project / Concrete Plan ]               [ Explore / Discover Story ]
         │                                                     │
         ▼                                                     ▼
[ ProjectQuestionnaire ]                              [ StoryArchitectSuite ]
(Classic direct onboarding)                           (5-Step Creative Engine)
         │                                                     │
         └──────────────────────────┬──────────────────────────┘
                                    ▼
                        [ Direct Chapter Editor ]
                     (Instant drafting environment)
```

### The Core Philosophy: "Write First, Note Second"

FleshNote was born from *FleshStone*—a project where worldbuilding notes and magic systems languished in note apps for years while chapter prose was procrastinated. The Story Architect is designed to **convert worldbuilding impulses directly into prose-ready manuscript files**.

Every entity rolled in the brainstorm step and every beat chosen in the framework engine is immediately seeded into the active project database and scaffolded as real chapter files, dropping the author directly into Chapter 1 with zero intermediate barriers.

---

## 2. Design Guide & Brand Aesthetic Alignment

All components of the Story Architect strictly adhere to the official [FleshNote Brand & App Design Guide](file:///C:/Other%20Projects/fleshnote-site/docs/brand-guide.html):

### A. The "Hard Edges Only" Geometry (`border-radius: 0px`)
FleshNote evokes the hybrid aesthetic of a **medieval scriptorium merged with a code terminal**. 

* **Strict Zero Border-Radius Policy:** Functional UI components—modal dialogs, action buttons, cards, text inputs, dropdowns, tabs, chips, and trait slots—**must never use rounded corners**. Sharp 90° rectangular geometry conveys tactical solidity, density, and professional focus.
* **Exceptions:** Only the outermost desktop application window frame (`8px`) is allowed minimal curvature by OS convention.

### B. Old Hungarian Rovás Runes as Universal Visual Motif
Cartoon emojis (`🎲`, `🎰`, `👤`, `🛡️`, `⚡`, `🗺️`) are strictly banned from the user interface. In their place, authentic **Székely-Hungarian Rovásírás** (Unicode block `U+10C80–U+10CFF`) glyphs provide thematic elegance, rendered via the bundled `NotoSansOldHungarian` font stack:

| Rovás Rune | Phonetic / Name | Placement in Story Architect | Thematic / Narrative Role |
| :---: | :---: | :--- | :--- |
| **𐳌** | F (Flesh) | `NewProjectChoiceModal` (Existing Manuscript) | Primary sigil of FleshNote; organic manuscript prose |
| **𐲦** | T (Structure) | `NewProjectChoiceModal` & Compass Selector | Structural blueprint, compass, architectural rigor |
| **𐳌𐳖𐳉𐳤𐳙𐳛𐳦𐳉** | FLESHNOTE | Modal header brand sigil | Full brand name in authentic bound-rune script |
| **𐲌** | F (Origin) | `StoryArchitectSuite` Step 1 Indicator | Identity, naming, genesis of the project |
| **𐲐** | I (Spark) | Step 2 Indicator & Dice Re-roll Buttons | The creative spark; rolling traits, loglines, names |
| **𐲛** | O (Realm) | Step 3 Indicator & Location Spark Launcher | World systems, territory, biomes, geography |
| **𐲤** | TY (Person) | Character Spark Launcher & Roster Cards | Character archetype, personhood, dramatis personae |
| **𐲈** | ER (Shield) | Trait Vault: Strengths & Virtues Header | Armor, virtue, moral strength, shielding |
| **𐲮** | ZS (Conflict) | Step 5 Indicator & Trait Vault: Flaws Header | Pacing, dramatic friction, fatal flaws, rupture |
| **𐲉** | E (Energy) | Full Spark Re-spin Buttons & Empty Roster | Dynamic catalyst, creative incubation |
| **𐲥** / **𐳉** / **𐳍** | Craft Runes | `NarrativeCurveView` Inflection Nodes | Inflection markers (Midpoint, Pinch Point, Dark Night) |

### C. Semantic Entity Color Palette
Colors in FleshNote are semantic, not decorative:
* **Characters (`--accent-amber` / `#d4a052`):** Warm gold amber applied to character names, roles, and strengths.
* **Locations (`--entity-location` / `--accent-blue` `#60a5fa` / `#5c9e6e`):** Atmospheric blue and forest green applied to site archetypes and geography.
* **Flaws & Conflict (`--accent-red` / `#e11d48` / `#c45c5c`):** Rose and crimson applied to character flaws, dramatic crises, and destructive actions.
* **Strengths & Virtues (`#34d399` / `#10b981`):** Emerald green applied to positive virtues and moral qualities.

---

## 3. The 5-Step Story Architect Suite (`StoryArchitectSuite.jsx`)

When an author selects **"No, I don't know my story yet"**, the full-screen Story Architect Suite opens.

```
[Step 1: Identity] ──► [Step 2: Brainstorm] ──► [Step 3: World] ──► [Step 4: Compass] ──► [Step 5: Pacing]
     (Metadata)            (Sparks & Slots)       (Lore/Time)        (Frameworks)        (Scaffold & Launch)
```

### Step 1: Identity & Metadata
* Captures **Project Title** and **Author Name**.
* Selects **Manuscript Primary Language** (`en`, `hu`, `pl`, etc.).
* **Zero-Friction Fallback:** Removes required universe dates; automatically falls back to an in-universe randomized calendar seed (`randomYear`, `randomMonth`, `randomDay`) so exploratory authors are never blocked by timeline dates.

### Step 2: Brainstorm (Sigil Hub & Creative Forges)
A minimal, visually-driven idea incubation screen built to inspire rather than configure. Replaces the former industrial two-column workspace.

* **The Sigil Hub (`BrainstormHub.jsx`):**
  - **Story-About Bar:** A one-sentence madlibs story idea (genre-flavored via `rollStoryIdea` in the madlibs engine) with a single 𐲐 re-roll, rendered in serif italic.
  - **Genre Chips:** A chip row beneath the bar (Fantasy, Sci-Fi, Thriller, Romance, Horror, Mystery, Literary, Custom). Selection writes directly to the Story Compass (`formData.compass_genre`) so Step 4 comes pre-answered; re-rolling the bar regenerates a genre-flavored sentence.
  - **Two Square Launchers:** Hard-edged "Create your character" (𐲤, amber) and "Create a place" (𐲛, blue) buttons.
  - **The Sigil Stage:** The FleshNote wordmark (𐳌𐳖𐳉𐳤𐳙𐳛𐳦𐳉) centered with a slow glow pulse; every saved character/location orbits it as a Rovás rune on CSS-only orbit rings (counter-rotated to stay upright, `prefers-reduced-motion` falls back to a static ring). Hovering a rune shows a tooltip card (name, role/type, description); clicking it reopens the matching forge pre-filled for editing or removal.
  - **Non-blocking flow:** "Continue to World Systems →" / "Skip to next step →" beneath the stage.
* **The Forges (`CharacterForge.jsx` / `LocationForge.jsx`):** Full-screen creative workspaces that hide complexity behind two collapsible side notch-panels, keeping only the essential elements visible:
  - **Character Forge:** A hard-edged humanoid silhouette (inline SVG, amber) with a soft glow; the name input and 𐲐 dice sit in the top bar alongside **Re-imagine** (re-rolls name + role + age + traits + logline in one shot); the madlibs logline sits beneath the figure with its own quiet re-roll. **Right notch — Trait Vault:** searchable strengths/flaws lists (4+4 cap preserved); clicking a trait makes a floating green/red label drift onto the figure, and clicking the floating label unbinds it. **Left notch — two tabs:** *Essentials* (role, age slider with bracket badge, gender for name rolls) and *Name Engine* (Realistic/Preset/Procedural modes, culture/archetype selects).
  - **Location Forge:** A site-type-aware place glyph (spires / peaks / dome / ruins SVG variants, blue); same top-bar name + **Re-imagine** pattern with an atmospheric description beneath. **Right notch — Atmosphere:** description re-roll, landmark/sensory tags inserted on click, and generated name candidates. **Left notch — two tabs:** *Essentials* (site archetype, population/climate/scale sliders) and *Name Foundry* (all procedural levers: genre toggle, geography keywords, founder, history, native tongue/sci-fi fields, phonetic drift, vowel harmony).
  - **Footer:** "Add to story" commits the entity to the Sigil Stage (rune joins the orbit); editing an existing rune adds a two-step "Remove from story" confirmation.
* **Non-Blocking Flow:** The hub can be skipped entirely; entities spawned here are saved directly into the SQLite project database during project creation.

### Step 3: World Systems & Epistemic Tracking
* Toggles **Dual Timeline** (in-universe world chronology vs. reading order).
* Toggles **Knowledge State Tracking** (epistemic character knowledge offsets across chapters).
* Configures default lore taxonomy categories (`Item`, `Concept`, `Location Detail`).

### Step 4: The Story Compass & Dramatic Frameworks
Helps the author discover the ideal dramatic structure for their specific premise, via two modes (Simple ⟷ Advanced toggle in the step header):

#### Simple Mode (default) — Slider-Driven Synthesis
* **Feel Sliders:** *Emotional Intensity* (Gentle ↔ Overwhelming), *Journey Polarity* (Tragic Fall ↔ Triumphant Rise), and *Pacing Velocity* (Slow Burn ↔ Breakneck), plus compact Genre + Plot Archetype selects.
* **Procedural Synthesis (`backend/architecture_engine.py`):** A debounced `POST /api/project/planner/synthesize` call runs the sliders through composable curve transforms and returns the top-3 optimal stacks. Each slider maps to a parametric transform: `intensity` rescales curve amplitude around the midline, `polarity` biases the final third toward collapse/triumph, `pace` time-warps the shape (slow burn delays events into Act I; the 0/50/100 anchors stay fixed).
* **Dramatic Engine Pressure Profiles:** Each of the 14 engines applies a visible reshaping profile to the amber stakes curve (monster → sustained ramp, whydunit → staircase reveals, comedy → oscillating surges, institutionalized → linear system pressure, …) and swaps the stakes legend caption (e.g. Whydunit → "Secrets Revealed ↑" via `narrativeCurve.engineAxis*` keys). Engine fit metadata (`ENGINE_VISUALS[id].fits`) powers best-fit highlighting in Advanced mode.
* **Top-3 Stack Cards:** Each card shows framework + variant + engine + arc, a match badge, and a slider-derived "why it fits" line (`stackFitReason` template). The primary card auto-adopts live as sliders move; clicking a card makes that stack sticky. Adoption writes the full stack (framework/variant/engine/arc) into the same state the Advanced mode manages.
* **Mode toggle:** Simple ⟷ Advanced persisted as component state (default Simple).

#### Advanced Mode — Full Compass & Taxonomy (unchanged selection UI)
* **The 3 Compass Axes:**
  1. *Genre:* Literary, High Fantasy, Sci-Fi, Thriller, Romance, Horror, etc.
  2. *Narrative Dynamic:* Character-driven internal arc, Plot-driven high concept, Mystery puzzle, etc.
  3. *Plot Archetype:* Christopher Booker's 7 Basic Plots (*Overcoming the Monster*, *Rags to Riches*, *The Quest*, *Voyage & Return*, *Comedy*, *Tragedy*, *Rebirth*).
* **Recommendation Engine:** Calculates percentage match scores and displays the top 3 recommended frameworks with narrative rationale, while allowing full browsing of the complete catalog.
* **Architecture Stack Refinement Rows:** Structure Flavor variants, Dramatic Engine chips, and Emotional Arc chips — each row auto-filled, with amber best-fit dots: engine chips flagged when `ENGINE_VISUALS[id].fits` includes the selected framework; arc chips flagged when they match the framework's `default_arc` or the active variant's pinned `arc_id`.
* **Protagonist Auto-Detection:** The Step 2 character whose `role` contains "protagonist" (else the first character) is used as the protagonist; their name labels the character-state line and persists as `framework_protagonist` config.
* **Dual-Layer Narrative Curve (`NarrativeCurveView.jsx`):** Two smooth Bézier curves on one 0–100% timeline: **amber solid** = external Stakes & Tension (Layer 2 macro curve with gradient fill + glow; engine caption overrides the legend label), **blue dashed** = internal Character State (Layer 3 arc overlay). Color-coded Y-axis captions (PEAK/TRIUMPH top, STASIS/DESPAIR bottom), a legend row above, and Old Hungarian Rovás craft annotations on the amber curve (`NarrativeCurveView` props: `internalCurve`, `characterLabel`, `stakesLabelOverride`).
* **Persistence:** `/api/project/init` and `/api/project/planner/apply-framework` store the full stack in `project_config`: `narrative_framework`, `framework_variant`, `dramatic_engine`, `emotional_arc`, `framework_protagonist`.

#### Engine Test Suite (`backend/test_architecture_engine.py`)
Run with `python backend/test_architecture_engine.py`. ASCII-renders dual curves (`#` stakes, `o` state, `X` overlap) with marker/act labels, sweeps variants × engines × slider corner matrices (3×3×3 synthesis corners), and asserts: curve values stay in [0,1]; polarity lowers the ending; intensity raises the peak; pace warps timing; every variant curve differs from base; every engine profile visibly alters the curve; arc matching correlates with slider polarity; synthesized stacks stay coherent across all corner combos. Used to tune the procedural transforms against real output.

**Deeper invariants (fuzz battery, seeded RNG):** 80 random genre × archetype × slider combos assert per stack — variant belongs to its framework, arc exists, both curves stay in range, Kishōtenketsu never carries an aggressive engine (redirect protocol), a dark arc on a framework with a dark sub-architecture always adopts that variant, and suggested lengths stay in their convention range on 500-word steps.

#### Suggested Manuscript Length
* `suggest_word_count(...)` in `architecture_engine.py` derives a target word count from publishing conventions: `LENGTH_CONVENTIONS` (per-framework base ranges — e.g. Hero's Journey epic 90–140k base 110k, Kishōtenketsu literary 50–85k base 65k, Romancing the Beat 50–90k base 75k), adjusted by `GENRE_LENGTH_OFFSETS` (fantasy +15k, romance −15k, …) and `ENGINE_LENGTH_OFFSETS` (quest engines +10k, tight-pattern engines −5k, …), plus driver nudges (strongly bleak journeys −5k, maximal escalation +5k). Suggestions clamp to the framework range and round to 500-word steps.
* Synthesis stack cards carry a `length` object; Step 5 renders a "Suggested for this architecture" chip with an Adopt button, and adoption auto-fills the target word count until the user overrides it.
* **Step 5 sliders:** the raw number inputs are replaced by two sliders with 500-word steps — Total Target Novel Words (40k–200k) and Average Chapter Length (1k–10k) — with live value display and estimated-chapter calculation.

### Step 5: Pacing & Chapter Scaffolding
* **Word Targets:** Total target novel word count and average chapter target length, with live calculation of estimated chapter count.
* **Auto-Scaffold Starter Chapters Toggle:**
  - *Enabled:* FleshNote generates `.md` chapter files in `md/` named after each framework beat (e.g. *Chapter 1: The Ordinary World*, *Chapter 2: The Catalyst*) and links each beat block in the Plot Planner directly to its corresponding chapter file.
  - *Disabled:* Project initializes with a single clean *Chapter 1*.
* **Launch:** Direct initialization via `/api/project/init` that opens the manuscript editor immediately.

---

## 4. In-Project Framework Switcher (`FrameworkSwitcherModal.jsx`)

Authors can change, experiment with, or swap narrative frameworks at any time inside an existing project:

```
[ Plot Planner Toolbar ] ──► "Frameworks" Button ──► [ FrameworkSwitcherModal ]
                                                             │
                                        ┌────────────────────┴────────────────────┐
                                        ▼                                         ▼
                             [ Wipe and Replace ]                      [ Keep Existing / Overlay ]
                         (Replaces blocks & arcs;                   (Appends framework beats;
                          preserves chapter files)                   preserves current layout)
```

* **Wipe and Replace (Clean Slate):** Updates the project's framework metadata, deletes existing framework beat blocks from the planner, and seeds new beat blocks and tension curve coordinates. Includes Structure Flavor variant chips (stored `framework_variant` drives seeded labels; stored `emotional_arc` + `framework_protagonist` drive the blue character-state preview line). Existing manuscript chapter files and word counts are preserved.
* **Keep Existing (Overlay Beats):** Non-destructive mode that appends the framework beat blocks into the planner alongside existing blocks without overwriting custom arcs.

---

## 5. Catalog of Supported Narrative Frameworks

Defined in `fleshnote-ide/backend/framework_presets.py`:

| Framework | ID | Movements / Acts | Beats | Key Craft Inflection Glyphs | Best Suited For |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Three-Act Structure** | `three_act` | 3 Acts | 9 | `𐲦` Inciting, `𐲥` Midpoint, `𐳍` Climax | Classic commercial fiction, thrillers, mainstream novels |
| **Freytag's Pyramid** | `freytags_pyramid` | 5 Acts | 9 | `𐲌` Exposition, `𐳉` Climax, `𐲮` Catastrophe | Tragedies, dramatic literature, character downfalls |
| **The Hero's Journey** | `heros_journey` | 3 Acts | 12 | `𐲛` Threshold, `𐳍` Ordeal, `𐲦` Resurrection | Epic fantasy, sci-fi adventure, transformative mythic arcs |
| **Dan Harmon's Story Circle** | `story_circle` | 4 Quadrants | 8 | `𐲐` Search, `𐳉` Find, `𐲮` Price paid | Episodic novels, tight pacing, television-influenced arcs |
| **Kishōtenketsu** | `kishotenketsu` | 4 Phases | 4 | `𐲌` Ki, `𐲛` Shō, `𐲮` Ten (Twist), `𐲦` Ketsu | Dialectic fiction, twist-driven narratives, contemplative works |
| **Save the Cat! Beat Sheet** | `save_the_cat` | 3 Acts | 15 | `𐲐` Catalyst, `𐲥` Midpoint, `𐳉` Dark Night | High-concept commercial novels, fast-paced thrillers |
| **7-Point Story Structure** | `seven_point` | 3 Movements | 7 | `𐲦` Pinch 1, `𐲥` Midpoint, `𐳉` Pinch 2 | Structured genre fiction, mystery, romance |
| **Romancing the Beat** | `romance_beat` | 4 Phases | 14 | `𐲐` Meet, `𐲥` Midpoint, `𐲮` Dark Point, `𐲦` HEA | Romance, romantasy, dual-POV romantic subplots |
| **Custom / Freeform** | `custom` | Open | Open | — | Experimental fiction, pantsers, non-linear structures |

---

## 6. Complete Inventory of Files Touched

### Frontend Components (`fleshnote-ide/src/renderer/src/components/`)
* [NewProjectChoiceModal.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/NewProjectChoiceModal.jsx): Initial bifurcation modal separating existing projects from the Story Architect. Hard edges, Rovás branding (`𐳌`, `𐲦`, `𐳌𐳖𐳉𐳤𐳙𐳛𐳦𐳉`).
* [StoryArchitectSuite.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/StoryArchitectSuite.jsx): Main 5-step suite container, state management, recommendation calculation, and project initialization dispatcher.
* [BrainstormStep.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/BrainstormStep.jsx): Composition root for Step 2 — owns entity save/edit/delete state, story-idea generation, and routes between the hub and the two forges.
* [BrainstormHub.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/BrainstormHub.jsx): The Sigil Hub — story-about bar, genre chips, square launchers, and the orbiting-rune Sigil Stage.
* [CharacterForge.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/CharacterForge.jsx): Full-screen character creator — silhouette figure with floating trait labels, Trait Vault and Essentials/Name Engine notch panels.
* [LocationForge.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/LocationForge.jsx): Full-screen location creator — site-type place glyphs, Atmosphere and Essentials/Name Foundry notch panels.
* [NarrativeCurveView.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/NarrativeCurveView.jsx): SVG tension curve visualizer with cubic Bézier paths, gradient fill, control nodes, and Rovás craft markers.
* [FrameworkSwitcherModal.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/FrameworkSwitcherModal.jsx): In-project framework switcher with live tension curve preview and Wipe vs. Overlay application strategies.
* [ProjectPicker.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/ProjectPicker.jsx): Renders `NewProjectChoiceModal` when "+ New Project" is triggered.
* [FleshNotePlannerDesktop.jsx](file:///C:/GameDev/fleshnote/fleshnote-ide/src/renderer/src/components/FleshNotePlannerDesktop.jsx): Adds the "Frameworks" button to the Plot Planner toolbar.

### Language & Madlibs Engines (`src/renderer/src/utils/madlibs/`)
* `index.js`: Language dispatcher, wildcard surreal chance engine, trait extraction, procedural generator helpers, genre-conditioned story-idea engine (`rollStoryIdea`), and `STORY_GENRES` (single source of truth shared with the Compass step).
* `en.js`: English word library containing 70+ archetypes, 50+ conditions, 60+ catalysts, 50+ actions, 40+ subjects, 40+ stakes, 40 virtues, 40 flaws, 22 terrains, 13 spatial relations, 16 landmarks, 14 atmospheres, 16+ sentence templates, plus genre-flavor dictionaries and story templates for the hub bar.
* `../namegen.js`: Shared renderer-side wrappers for `window.api.generateName` / `generateLocationName` with madlibs fallbacks (used by both forges).
* `../frameworkStack.js`: `applyFrameworkVariant` (client-side curve/label resolution mirroring backend `resolve_framework`), `inferEngineForArchetype` (Compass archetype → Layer 1 engine mapping), and `ENGINE_AXIS_FALLBACKS` (per-engine stakes legend captions).

### Locales & i18n (`src/renderer/src/locales/`)
* `en/translation.json`, `hu/translation.json`, `pl/translation.json`: Translated labels for the entire suite, stripped of legacy emoji prefixes.

### Electron Main & Preload IPC (`src/main/` & `src/preload/`)
* `main/index.ts`: IPC handlers for framework catalog, recommendations, application, and name generation.
* `preload/index.ts`: Exposes `getFrameworkCatalog`, `getFrameworkRecommendations`, `applyFramework`, `generateName`, and `generateLocationName` to `window.api`.

### Backend API & Database (`backend/`)
* `backend/framework_presets.py`: 9 framework definitions with sub-architecture variants (`FRAMEWORK_VARIANTS`), Layer 1 dramatic engines (`DRAMATIC_ENGINES`), Layer 3 emotional arcs (`EMOTIONAL_ARCS` + `FRAMEWORK_DEFAULT_ARC`), variant resolver (`resolve_framework`), tension coordinates, craft markers, recommendation scoring algorithm (returns recommended variant/engine/arc), and chapter scaffolding generator.
* `backend/architecture_engine.py`: Procedural architecture engine — composable slider transforms (`transform_curve`), dramatic-engine pressure profiles + fit metadata (`ENGINE_VISUALS`), emotional-arc feature matching, synthesis contradiction protocols, and `suggest_word_count` manuscript-length conventions (`LENGTH_CONVENTIONS`, `GENRE_LENGTH_OFFSETS`). Pure functions, no DB access.
* `backend/test_architecture_engine.py`: ASCII dual-curve test suite — assertion battery + combination sweeps for the engine (run directly, no pytest).
* `backend/routes/planner.py`: Endpoints `/api/project/planner/frameworks`, `/api/project/planner/recommendations`, and `/api/project/planner/apply-framework`.
* `backend/db_setup.py`: Database seeder inserting `initial_characters` and `initial_locations` directly into SQLite tables, auto-assigning Chapter 1's starting POV character, and persisting the architecture stack config (`framework_variant`, `dramatic_engine`, `emotional_arc`, `framework_protagonist`).

---

## 7. IPC & REST API Interface Reference

### `GET /api/project/planner/frameworks`
Returns all framework presets with beat lists, act counts, and curve coordinates.

### `POST /api/project/planner/recommendations`
**Payload:**
```json
{
  "genre": "fantasy",
  "goal": "character_arc",
  "archetype": "quest"
}
```
**Response:** Ranked array of recommendations with `match_score`, `tagline`, and `match_reason`, plus the full architecture stack defaults (`recommended_variant`, `recommended_engine`, `recommended_arc`).

### `POST /api/project/planner/synthesize`
**Payload:**
```json
{
  "genre": "fantasy",
  "plot_archetype": "quest",
  "intensity": 0.85,
  "polarity": -0.85,
  "pace": 0.6
}
```
**Response:** `{ "status": "ok", "goal": "tragic_descent", "stacks": [ ... up to 3 cards ... ], "primary": { ... } }` — each stack card carries `framework_id`, `variant_id`, `engine_id`, `arc_id`, resolved slider-transformed `curve_points` (engine pressure included), matched `internal_curve`, `match_score`, and `drivers` (the slider coordinates used).

### `GET`/`POST /api/project/planner/frameworks`
Also returns `engines`, `arcs`, and `engine_meta` (pressure profiles, axis caption keys, fit lists) alongside `frameworks`.

### `POST /api/project/planner/apply-framework`
**Payload:**
```json
{
  "project_path": "C:/Path/To/Project",
  "framework_id": "three_act",
  "wipe_existing": true,
  "variant_id": "tragic_descent",
  "engine_id": "tragedy_engine",
  "arc_id": "fall_arc",
  "protagonist_name": "Sophia"
}
```
Optional fields default to `null`; provided values are written to `project_config` (`narrative_framework`, `framework_variant`, `dramatic_engine`, `emotional_arc`, `framework_protagonist`) and the variant's label/curve adjustments seed through into `planner_blocks`/`planner_arcs`.
**Response:** `{"success": true, "framework_id": "three_act", "blocks_created": 9}`.

---

## 8. Future Roadmap & Refinement Opportunities

> Deferred polish and bugfix items (including the "I know my story" flow redesign and manuscript-language-aware generation) are tracked in **[FUTURE_POLISH_2.0.md](FUTURE_POLISH_2.0.md)** — the dedicated finish-line session list. Companion-app translation of new features is tracked in the companion repo at `C:\Other Projects\fleshnote-companion\docs\DESKTOP_FEATURE_PARITY.md`.

1. **Multi-Language Madlibs Expansion:** Add native `hu.js`, `pl.js`, and `de.js` word libraries to expand the procedural generation dictionaries.
2. **Custom User Frameworks:** Allow authors to create, save, and export their own structural templates as JSON blueprints.
3. **Pacing Heatmap Integration:** Cross-reference framework tension curves against Pentimento paragraph telemetry to visualize actual manuscript pace vs. intended framework tension.
4. **Epistemic Seeding:** Automatically generate initial character secret/knowledge cards from rolled flaws during Step 2.

# Future Polish & Bugfix Session — 2.0 Finish Line

**Approach:** the foundations of the 2.0 feature set are done to a *serviceable* level. Rather than polishing each feature during its build, everything below is deferred to a dedicated polish + bugfixing session at the finish line. Add to this list instead of fixing mid-stream (unless something is actually broken for testing).

---

## 1. Language Support (manuscript-language aware)

- **Madlibs word libraries are English-only.** Story-idea generation, trait extraction, and all procedural text (`src/renderer/src/utils/madlibs/`) need native `hu.js` / `pl.js` libraries; `index.js` already dispatches by language — wire `story_language` (set in Step 1) into the dispatcher so generation follows the *manuscript* language, not the UI language.
- **Genre-conditioned story ideas** (`STORY_IDEA_DATA.genreFlavor`, `STORY_TEMPLATES`): per-language template sentences and genre flavor dictionaries.
- **Backend name generation:** `backend/tools/name_gen/` has location phonology for `en` only — add `hu`/`pl` location and character name libraries; `generateName` / `generateLocationName` should honor `story_language`.
- **UI language vs manuscript language:** confirm the UI copy makes the separation clear (UI can be Hungarian while the novel is English, and vice versa). Arabic RTL binding exists (`document.dir`) — keep any new UI RTL-safe.
- Rovás glyph usage is language-agnostic — keep as-is.

## 2. "I know my story" Flow Improvement ⚠️ DESIGN NOTE
> The skip path out of the Brainstorm step deserves a dedicated improvement — currently "skipping" is just the Continue button.

- Add an explicit **"I know my story"** shortcut on the Sigil Hub that jumps past Brainstorm to the Compass step in one tap.
- The flow should set expectations: entities can be created later in-project (Entity Manager), so skipping loses nothing.
- Verify the whole downstream path works with **zero brainstorm entities**: no protagonist → generic character-state label on the dual curve; suggested length unaffected; project init with empty `initial_characters/locations/notes`.
- Let users **paste an existing synopsis** as the story idea (and thus `story_summary`) instead of re-rolling generated ones — returning users likely already have a premise.
- Consider letting the story-about text pre-fill `synopsis` on Chapter 1 or the first planner block.

## 3. Visual Polish Sweep (accumulated "worth a look" items)
- Brainstorm hub: single-screen fit on small windows; empty-state hint position at stage bottom; note-editor flow (inline editor → purple 𐲀 rune on orbit).
- Forge float-tag animation (negative-delay fix) — confirm no residual jump on first paint.
- Dual-layer curve: blue dashed line legibility against the amber glow; axis captions (PEAK/TRIUMPH/STASIS/DESPAIR) crowding on narrow windows; tragic variants' inverted curves should read as intentional, not broken.
- Per-type orbit rings (characters inner / locations middle / notes outer) readability with mixed entity types.
- Step 5: word sliders + suggested-length chip — does the auto-updating target feel like it "moves on its own" when re-dragging Step 4 sliders? If so, switch to Adopt-only updates.
- Placeholder humanoid silhouette in CharacterForge — user will supply custom art; integrate it.
- Editable forges' descriptions: auto-grow textarea behavior on rapid typing.

## 4. Architecture Engine Polish
- **Per-beat contradiction checks** in the test suite (currently stack-level only): e.g. block labeled "Whole Heart HEA" must never coexist with a Fall-arc ending without an inversion variant.
- **Deeper Kishōtenketsu redirection** (research doc protocol): per-beat re-interpretation of the Ten when paired with aggressive engines, not just engine substitution.
- **Draggable curve points** (deferred decision from the Simple/Advanced design round) — user-sculpted arcs.
- **B-Story decoupling as an explicit UI toggle** (A-story external vs B-story internal braiding, per the research doc).
- Expand catalogs: Tobias' 20 Master Plots as engines; Polti's 36 situations as a subplot generator; full Murdock 10-stage Heroine's Journey and Hudson's Virgin's Promise as arcs; length conventions per subgenre (category romance vs epic romantasy).
- Variant authoring depth for `seven_point` (only 2 variants) and `custom`.

## 5. Known Loose Ends Found During Build
- `FrameworkSwitcherModal` "Beat Progression" header reads `selectedFramework.beats?.length` — the field is `blocks`, so the count always shows 0 (pre-existing bug).
- `brainstormEntities` (and `storySummary`) live only in suite state — leaving the wizard mid-flow loses them; consider sessionStorage persistence.
- `custom` framework with engine/arc chips: verify the flat slate + Flat Arc default feels intentional in the UI.
- Architecture stack is stored but the Plot Planner doesn't yet *display* the engine/arc anywhere in-project (only the switcher preview does).

## 6. Companion App Parity
- Tracked in the companion repo: `C:\Other Projects\fleshnote-companion\docs\DESKTOP_FEATURE_PARITY.md` — every 2.0 desktop feature that needs a mobile surface (Story Architect stack config, suggested length, story summary banner, planner variant labels, …). Revisit at the finish line.

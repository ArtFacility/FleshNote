# The Janitor (Stylistic & NLP Analysis)

The Janitor is an ambient background agent in FleshNote IDE that processes the current chapter's text in real-time, surfacing actionable suggestions to improve worldbuilding consistency and prose quality. It runs silently and never blocks the editor.

## Architecture & Request Flow

1. **Frontend Trigger**:
   After 10 seconds of inactivity, or when the user has typed 100+ new words since the last scan, a debounced trigger (`triggerJanitorAnalysis`) fires in `FleshNoteIDE.jsx`. If the chapter HTML hasn't changed since the last scan, the trigger is a no-op.

2. **IPC Transit**:
   The raw TipTap HTML of the current chapter is sent via `window.api.janitorAnalyze()` → IPC → POST `/api/project/janitor/analyze`. The payload includes the project path, chapter ID, story language, and the user's confidence threshold setting.

3. **Backend Processing**:
   `janitor.py` receives the payload. It strips HTML tags to produce a `plain_text` string (preserving char offsets for TipTap re-anchoring), and a `words_plain` variant with block-break spaces added for accurate word tokenization.

4. **Execution Pipeline**:
   The text is passed through **9 distinct analysis functions**. All results are merged into a single list of suggestion dicts and returned to the frontend.

5. **UI Rendering**:
   Suggestions populate `JanitorPanel.jsx`. Each card shows the matched text highlighted in context, with action and dismiss buttons. Dismissed suggestion IDs are stored in `localStorage` per chapter so they don't reappear. The panel supports full keyboard navigation (Alt+J to focus, arrows to move, Y/N to accept/dismiss, Escape to return to editor).

---

## The Analyzers

The Janitor uses `spaCy` for NER, POS tagging, and dependency parsing; `NLTK` WordNet for synonym suggestions; and `Hunspell` (via `phunspell`) for spell checking.

Hungarian text is routed to `hun_janitor.py` which implements all NLP analyzers with Hungarian-specific lexicons and grammar rules. English text stays in `janitor.py`.

---

### 1. Link Existing (`link_existing`)

**Goal**: Catch entity names the author forgot to formally link in the editor.

**Logic**: Iterates over all entities and aliases from the project's SQLite database, sorted by name length descending (to prefer longer matches). Uses regex word-boundary matching against `plain_text`. Skips any match that already falls within an existing entity `<span>` mark (tracked via `_get_linked_ranges`). Cap: 5 suggestions.

---

### 2. Create Entity (`create_entity`)

**Goal**: Spot newly introduced characters, locations, or organizations that should be catalogued.

**Logic**: Runs `spaCy` NER on the first 5000 chars. Maps spaCy labels to entity types (`PERSON` → character, `GPE`/`LOC`/`FAC` → location, `ORG` → lore). Skips any detected name that overlaps with (or is a substring of) an already-known entity or alias. Cap: 5 suggestions.

---

### 3. Alias (`alias`)

**Goal**: Suggest shorthand names that might deserve a formal alias entry.

**Logic**: For each multi-word entity name found in the text, checks if any single-word part (≥ 4 chars) appears standalone elsewhere in the text without the full name nearby (within 200 chars). If so, suggests adding it as an alias. Cap: 3 suggestions.

---

### 4. Typo (`typo`)

**Goal**: Catch basic spelling mistakes.

**Logic**: Tokenizes words from `words_plain` (the block-space-padded version) and checks each unique word against a `phunspell` (Hunspell) instance for the project's language. All project entity names and aliases are whitelisted automatically. Suggests the top Hunspell correction. Cap: 3 suggestions.

---

### 5. Synonym (`synonym`)

**Goal**: Elevate vocabulary by flagging overused weak words.

**Logic**: Matches tokens against a hard-coded `WEAK_WORDS` list (`"walked"`, `"said"`, `"very"`, `"got"`, etc.). On match, queries NLTK WordNet synsets to surface a stronger alternative. Cap: 2 suggestions.

---

### 6. Weak Adverbs (`weak_adverbs`)

**Goal**: Flag adverb-verb pairings that signal lazy prose (e.g. "walked slowly", "said quietly").

**Logic**:
- **English**: Uses spaCy POS tags to find `ADV` tokens ending in `-ly` whose syntactic head is a `VERB`. A curated `IGNORE_ADVERBS_EN` set filters common non-stylistic adverbs ("really", "simply", "only", "probably", etc.).
- **Hungarian**: Checks `ADV`/`ADJ` tokens against an explicit `WEAK_ADVERBS_HU` list and a suffix rule (`-an/-en/-ul/-ül` modifying a `VERB` head). A `IGNORE_ADVERBS_HU` set filters grammatical adverbs and conjunctions that share these suffixes ("miközben", "ahogyan", etc.).

Cap: 5 suggestions. Type stored as `weak_adverbs`.

---

### 7. Passive Voice (`passive_voice`)

**Goal**: Flag passive constructions that reduce narrative immediacy.

**Logic**:
- **English**: Uses spaCy's `auxpass` dependency tag to locate auxiliary passive verbs. The matched span covers both the auxiliary and its head verb.
- **Hungarian**: Detects verbal adverbs with `-va/-ve` suffixes (határozói igenév) on `ADV`/`VERB` POS tokens. A `PASSIVE_EXEMPTIONS_HU` set filters fixed grammatical forms ("kivéve" = "except").

Cap: 3 suggestions. Type stored as `passive_voice`.

---

### 8. Show, Don't Tell (`show_dont_tell`)

**Goal**: Detect "telling" patterns — places where the author states an emotion or perception directly instead of rendering it through action.

**Logic**: A 4-detector pipeline runs per sentence. Dialogue sentences are excluded before any detectors run.

#### Dialogue Exclusion

- **English** (`_is_dialogue_en`): Skips sentences containing quote characters (`"`, `"`, `«`, `»`, `'`, `'`). Also skips sentences where a speech verb (`say`, `whisper`, `shout`, etc.) has a `ccomp` or `parataxis` child.
- **Hungarian** (`_is_dialogue_hu`): Additionally skips lines that begin with an em-dash (`—` or `–`), the standard Hungarian typographic convention for dialogue.

#### The Four Detectors

| Detector | Pattern | EN Confidence | HU Confidence |
|---|---|---|---|
| `emotion_label` | Linking verb (`be`, `feel`, `seem`...) + emotion adjective (`furious`, `anxious`...) as `acomp`. State words (`tall`, `dead`, `born`...) are exempted. | 0.85 | 0.75 |
| `filter_verb` | Filter verb (`see`, `hear`, `feel`, `notice`...) with both a subject and an object clause — the POV camera is filtering experience through a character. | 0.60 | 0.50 |
| `realize_verb` | Cognitive verb (`realize`, `understand`, `know`, `decide`...) with a `ccomp`/`xcomp` complement clause. | 0.65 | 0.55 |
| `adverb_emotion` | Speech verb as ROOT + emotion adverb modifier (`angrily`, `sadly`, `furiously`...). | 0.75 | 0.65 |

HU confidence scores are 0.10 lower than EN equivalents to account for the ~75% UAS accuracy of the Hungarian spaCy model.

#### Confidence Threshold

The user can set a per-project `janitor_sdt_confidence` value (0.30–0.90, default 0.50) in Project Settings. Only detections meeting or exceeding this threshold are emitted. This allows writers to trade precision for recall.

The `entity_type` field on each suggestion stores the detector name (`emotion_label`, `filter_verb`, `realize_verb`, `adverb_emotion`) so the frontend can display a sub-label on the card (e.g. "Show, Don't Tell — emotion label").

Cap: 5 suggestions.

---

### 9. Sentence Rhythm & Pacing (`pacing`)

**Goal**: Catch repetitive sentence openings that create a droning rhythm.

**Logic**: Uses spaCy's sentence segmenter (`doc.sents`). Compares the first non-punctuation word of three consecutive sentences. If all three match exactly (case-insensitive), the block is flagged. Cap: 2 suggestions.

---

## Frontend Integration

### Suggestion Types & Visual Identity

Each suggestion type has a distinct runic icon and accent color in `JanitorPanel.jsx`:

| Type | Rune | Color |
|---|---|---|
| `link_existing` | ᚠ | Gold |
| `create_entity` | ᚢ | Blue |
| `alias` | ᚦ | Gold |
| `typo` | ᚱ | Red |
| `synonym` | ᛋ | Rose |
| `weak_adverbs` | ᛗ | Orange |
| `passive_voice` | ᛈ | Purple |
| `show_dont_tell` | ᛚ | Amber-orange |
| `pacing` | ᚫ | Blue |

### Settings (Project Settings → Janitor tab)

Each suggestion type can be toggled on/off independently. When Show, Don't Tell is enabled, a sensitivity slider controls the `janitor_sdt_confidence` threshold sent with every analysis request.

### Offset Mitigation (Paragraph Drift)

TipTap calculates node distances without accounting for raw `\n` characters between paragraphs, so Python's `plain_text` char offsets drift slightly from TipTap's internal positions as paragraph count grows.

**Solution**: The frontend actions (`navigateToCharOffset`, `replaceAtOffset`, `linkEntityAtOffset`) perform a **fuzzy radius search**. They use the backend's `char_offset` as a starting coordinate, scan neighboring text nodes within a safe radius, and perform a literal string search for `matched_text` to re-anchor the highlight precisely.

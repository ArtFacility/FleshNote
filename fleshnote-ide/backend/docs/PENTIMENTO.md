# Pentimento — "Process" Telemetry, Snapshots, History & Replay

*Pentimento* (the ghost of an earlier painting showing through a canvas) is FleshNote's
writing-process system. It records **how** a chapter was written — not just the final text —
and turns that into a per-paragraph effort heatmap, a tamper-evident session receipt, a
full prose history you can roll back to, and a replay that animates the chapter's growth.

It surfaces in three places:

- **Process tab** (`PentimentoTab.jsx`) — the heatmap + the replay simulation.
- **History panel** (`HistoryPanel.jsx`) — right-side panel to preview / pin / restore prose
  snapshots (mutually exclusive with the Janitor panel).
- **Settings** (`PentimentoSettings.jsx`) — capture/prose-history toggles, storage, compaction.

Two independent `project_config` toggles gate it (both default **on**):

| Config key           | Default | Gates |
| -------------------- | ------- | ----------------------------------------------- |
| `pentimento_capture` | `true`  | Recording of writing ops + sessions (the heatmap) |
| `prose_history`      | `true`  | Auto prose snapshots at session end (rollback + replay base) |

---

## 1. Capture — coalesced ops, not keystrokes

The frontend recorder (`utils/pentimentoRecorder.js`) hooks TipTap transactions and
**coalesces** them: consecutive typing at one place becomes a single *run* with a
`duration_ms`, rather than one row per key. Op types:

- `insert` — typing / added text
- `delete` — backspace / delete (backspace and forward-delete runs both store the removed
  text in document order)
- `paste` — a bulk insertion (a single change of more than 40 characters)
- `pause` — an idle gap above 2.5 s (marks thinking time, capped at 10 min)

**Coordinates.** Ops address a flat text model of the chapter: top-level blocks joined with
`\n`, inline leaf nodes (hard breaks, images) as U+FFFC. `para_index` + `char_offset` is
where the op starts, `text_content` is exactly what was inserted or removed (`\n` = a
paragraph break, so splits, merges and cross-paragraph deletions are ordinary ops) and
`length` is that text's length. Each ProseMirror step is diffed against the doc it applied
to, plugin-appended transactions are included, and a change that reached the doc without
an update event is recorded as a `machine` op. So **applying a session's ops in order
(timestamp, then rowid) to the text it started from reproduces the text it ended with.**
A run only continues at the exact position the last edit ended (typing elsewhere in the
same paragraph starts a new run). Sessions recorded before this format used ProseMirror
positions and are not reconstructable this way.

Runs are flushed to the backend every 12 s (or every 40 ops) and stored in
**`pentimento_ops`**. This keeps a full novel's process history in the low tens of MB.
`scripts/check_pentimento_recorder.mjs` fuzzes the recorder with random edits and checks
the reconstruction; `.claude/skills/run-app/pentimento_sim.mjs` drives the real app.

### Input provenance

Every op carries a `source`: **`human`** (hardware keyboard / IME / undo-restore),
**`paste`** (paste or drop), or **`machine`** (programmatic inserts — entity chips, AI
text, IDE features). The editor's `beforeinput` DOM handler maps the real input type to
a hint (`insertText`/`insertCompositionText` → human, `insertFromPaste`/`insertFromDrop`
→ paste, `historyUndo`/`historyRedo` → human, `insertReplacementText` → machine). Enter,
Backspace and Delete never reach `beforeinput` (ProseMirror handles them on keydown), so
a keydown hint covers them: it marks paragraph breaks and deletions as human, while text
inserted on Enter (a suggestion menu picking a name) stays machine. A hint only explains
a transaction within 500 ms. The recorder consumes one hint per transaction, falls back to
the transaction's own meta (`history$`, `uiEvent` paste/drop/cut), and classifies
everything else as `machine`. Runs of different sources are never merged. The replay shows a per-paragraph
rune cluster (Old Hungarian glyphs, right of each line) with the live typed/pasted/
assisted mix, appearing as paragraphs are written and vanishing when they're deleted.

### Sessions

A writing session opens when you start editing a chapter and is **sealed** at session end
into **`pentimento_sessions`**: `session_num` (per-chapter ordinal), `start_time`/`end_time`,
and a SHA-256 chain (`previous_session_hash` -> `session_hash`) so the process log is
tamper-evident. Old sessions can be **compacted** — their raw ops are pruned and replaced by
aggregate totals in `summary_json`.

Switching chapters, closing the project and closing the app all save the chapter first
and then seal its session, so the closing snapshot holds the last keystrokes. Closing the
window waits (up to 3 s) for the renderer to do this before the backend is stopped. Each
session keeps its own recorder state, so the old one is sealed in the background while
typing in the new chapter already goes to the next session.

**Crashes.** Ops the backend hasn't confirmed are mirrored about once a second to
`userData/pentimento-stash.json` (written by the main process, so a killed renderer or
app loses about a second). The next start delivers them with `recovery: true` (ops whose
fingerprint the session already holds are skipped) and seals the session. If that never
happens, `session/start` seals the chapter's latest unsealed session from the ops it has,
closed at its last op, and chains the new one onto it. Older unsealed sessions are left
alone: they already have a successor. A flush into a sealed session is refused (409), and
ending a sealed session again changes nothing.

Each session also carries a **`wpm_trace`** — a JSON array of `[para, word_offset, wpm]`
triples (wpm clamped 10–300), one per completed word the recorder saw being typed. The
offsets are read live from the TipTap doc at typing time, so a deletion mid-sentence
requires no bookkeeping — the next word's offset simply self-corrects. Deletions and
pauses restart the word clock so their dead time never deflates the next words' speed,
and pastes emit cap-speed (300) samples. The recorder is authoritative: every flush
**replaces** the stored trace, and the replay matches its diffed
words to samples by `(para, word_offset)` — so even messy sessions with rewrites stay
aligned. The trace lives on the session row, so it survives compaction and never syncs
(device-local, like all pentimento data).

---

## 2. Heatmap

`POST /api/project/pentimento/heatmap` aggregates live ops + compacted summaries into
per-paragraph metrics: time spent, chars inserted/deleted, revision count, day/night ratio,
churn (`deleted / (inserted + deleted)`), and a normalized `heat` value. The Process tab
paints each paragraph by effort, so heavily-reworked passages stand out.

---

## 3. Prose snapshots (the ground truth)

**Key constraint:** snapshots are the ground truth for past prose. A session's ops lead
exactly from its starting text to its ending text (see the coordinates above), but only
for sessions recorded in the current format, and compaction deletes ops outright. So
anything that needs *actual old text* (rollback, replay frames) relies on real snapshots.

That's **`chapter_snapshots`**: the chapter's markdown, zlib-compressed, captured at natural
checkpoints. `kind` is one of:

- `session` — auto-captured at session end (deduped on `prose_hash` so idle sessions don't
  create duplicates). Gated by `prose_history`. The same hook also fires at **session start**
  (`pentimento.py` `session_start`), giving every session a baseline "before" frame: a fresh
  chapter snapshots as an empty page, so its first writing session replays as typed text
  instead of appearing at once, and old chapters get an honest pre-session state to diff
  from. Start and end snapshots of one session share the same `session_id` (the replay uses
  that to label the starting frame).
- `manual` — a version the writer explicitly pinned (optional `label`). Always kept.
- `pre_restore` — a safety copy taken just before a restore, so restores are undoable.
- `pre_link` — a copy taken before the name finder linked character and place names in the
  chapter.

The auto-capture hooks live in `pentimento.py` `session/start` + `session/end`; the latest
editor save is flushed to the `md/` file before the session-end snapshot is taken so it
captures the sealed state.

---

## 4. History panel — rollback

`HistoryPanel.jsx` (a `.panel-right`, mutually exclusive with the Janitor panel) lists a
chapter's snapshots newest-first with word count + Δ, and offers:

- **Preview** — decompress the snapshot and diff it against the current prose (read-only).
- **Pin current version** — a `manual` snapshot with an optional label.
- **Restore** — two-step inline confirm (no native `confirm()`). Restore writes the snapshot
  md back to disk, re-runs the chapter trackers (entity appearances, foreshadowings,
  knowledge/relationship offsets), updates `word_count`, logs a `prose_hash` to `change_log`
  for sync ancestry, and takes a `pre_restore` snapshot first so the swap can be undone.

---

## 5. Replay simulation

The Process tab can **replay** how the chapter grew. Its design is *snapshot-anchored with an
op-paced overlay*:

1. **Base — snapshots.** The session snapshots (oldest -> newest, then the live chapter as the
   final frame) are the timeline. Because content always comes from real snapshots, the replay
   is guaranteed to converge on the exact current chapter text.
2. **Inline diff.** Consecutive snapshots are diffed at the paragraph level
   (`diffParagraphs`), and *modified* paragraphs are further reduced to their minimal changed
   span via common prefix/suffix trimming (`diffInline`, in `utils/proseDiff.js`). The
   animation deletes just the old span and types just the new one, leaving the rest of the
   paragraph steady — so a one-word edit reads as a one-word edit, not a full-line rewrite.
3. **Pacing overlay.** For each transition, the typing rhythm comes from the originating
    session with a three-tier fallback: the session's `wpm_trace` (per-word speeds, via
    `pentimentoOps`' `wpm_by_session`; words past the trace default to 40 WPM) → the raw
    `pentimento_ops` cadence (per-run `duration_ms`, when the volumes match the diffed
    text) → synthetic even pacing. Timing sources never supply content.

The manuscript view auto-scrolls to follow the active edit, and speed is adjustable
(default 3×).

---

## 6. Endpoints

**`backend/routes/pentimento.py`**

| Endpoint | Purpose |
| -------- | ------- |
| `POST /api/project/pentimento/session/start` | Open a writing session |
| `POST /api/project/pentimento/flush` | Ingest a batch of coalesced ops |
| `POST /api/project/pentimento/session/end` | Seal the session (+ auto snapshot if `prose_history`) |
| `POST /api/project/pentimento/heatmap` | Per-paragraph effort metrics |
| `POST /api/project/pentimento/ops` | Raw ops for a chapter, grouped by `session_id` (replay pacing) |
| `POST /api/project/pentimento/summary` | Whole-project totals (words, time, day/night, chain head) |
| `POST /api/project/pentimento/compact` | Prune old raw ops into `summary_json` |
| `POST /api/project/pentimento/clear` | Delete all telemetry |
| `POST /api/project/pentimento/storage` | Telemetry storage accounting |

**`backend/routes/chapter_history.py`**

| Endpoint | Purpose |
| -------- | ------- |
| `POST /api/project/chapter/history/list` | Snapshots for a chapter (metadata only, incl. `session_id`) |
| `POST /api/project/chapter/history/preview` | Decompress one snapshot -> HTML + word count |
| `POST /api/project/chapter/history/pin` | Create a `manual` snapshot |
| `POST /api/project/chapter/history/restore` | Restore a snapshot (with `pre_restore` safety copy) |
| `POST /api/project/chapter/history/storage` | Snapshot storage accounting |
| `POST /api/project/chapter/history/prune` | Keep last N per chapter; never prunes `manual` pins |
| `POST /api/project/chapter/history/clear` | Delete a chapter's snapshots |

IPC is wired the usual 3-layer way (`src/main/index.ts` handlers -> `src/preload/index.ts`
`window.api.*`): `pentimentoHeatmap`, `pentimentoOps`, and `chapterHistoryList/Preview/Pin/
Restore/Storage/Prune/Clear`.

---

## 7. Sealed Pentimento (Proof of Process)

Verification makes the process log *proveable*: every sealed session hash is blind-
timestamped by a timestamping authority (TSA), so a forger cannot fabricate or rewrite
history without spending the same real-world time the manuscript took to write.

**Privacy invariant:** only 64-character SHA-256 hashes ever leave the machine — never
prose, entity data, or client timestamps beyond the receipt itself.

### Flow

1. **Opt-in** (default off). First app launch asks on the Project Picker
   (`fn_pentimento_verification` in localStorage, mirrored to each project's
   `project_config` as `pentimento_verification`). Also per-project in
   Project Settings → Pentimento, plus a global Settings modal on the Picker
   (which also hosts the future ArtFacility account section).
2. **Rolling heads.** `pentimentoRecorder.js` maintains
   `head = SHA256(prev chain state + flushed op fingerprints)` — the same
   fingerprint format `session_end` seals with, advanced only after a confirmed
   flush. Every **10 minutes of active typing** the head is anchored
   (`POST /api/project/pentimento/anchor-head`).
3. **Seal anchoring.** `session/end` inserts a `seal` receipt row and anchors it in a
   background thread (a slow/unreachable TSA never stalls the editor).
4. **Receipts.** `server_receipts` stores: kind (`seal`/`head`), the anchored hash +
   previous hash, the TSA's `server_time`/`server_signature`/`key_id`, and optionally an
   **external RFC 3161 cross-anchor token** (freetsa.org by default, opt-in via
   `pentimento_external_tsa`) as an independent second opinion. Failures stay `pending`
   and retry opportunistically (up to 20 per anchor round). Gaps are flagged by the
   verifier, never fatal.
5. **Verification.**
   - **Web:** `fleshnote-site/verifier/` — fully client-side; the `.db` is parsed with
     vendored sql.js and never uploaded.
   - **CLI:** `tools/verify_pentimento.py` — same checks; `--keys-file` for a trustless
     offline mode. Exit 0 = pass, 1 = verification failure (chain/tamper), 2 = soft notes.

### What it proves (and what it doesn't)

The system proves **temporal existence**: a chain hash containing your ops existed at a
signed server time, and any later edit invalidates the anchored head. A forger must run
their fake-writing bot in real time for the manuscript's actual duration. It does not
cryptographically prove "human typing" — that's why the replay/heatmap visual evidence
ships alongside it.

### Components

| Piece | Location |
| ----- | -------- |
| Rolling head + active-typing anchoring | `src/renderer/src/utils/pentimentoRecorder.js` |
| TSA client (urllib, stdlib only; RFC 3161 encoder) | `backend/tsa_client.py` |
| Receipt insert/anchor/retry/queue, head+seal endpoints | `backend/routes/pentimento.py` |
| `server_receipts` table | `db_setup.py` (created on demand for legacy DBs) |
| TSA service (closed source, Go + Postgres/SQLite) | `C:\Other Projects\fleshnote-backend` |
| Web verifier | `C:\Other Projects\fleshnote-site\verifier\` |
| CLI verifier | `tools/verify_pentimento.py` |

---

## 8. Related tables

See `DATABASE_SCHEMA.md` §28 `pentimento_sessions`, §29 `pentimento_ops`,
§30 `chapter_snapshots`, and §27 `change_log` / §31 `sync_meta` (the sync ancestry that
restore writes into).

## 9. Key files

| File | Role |
| ---- | ---- |
| `src/renderer/src/utils/pentimentoRecorder.js` | TipTap op capture + coalescing |
| `src/renderer/src/utils/proseDiff.js` | `cleanProse`, `diffLines`, `diffParagraphs`, `diffInline` |
| `src/renderer/src/components/PentimentoTab.jsx` | Process tab — heatmap + replay simulation |
| `src/renderer/src/components/HistoryPanel.jsx` | Right-side rollback panel |
| `src/renderer/src/components/PentimentoSettings.jsx` | Toggles, storage, compaction UI |
| `backend/routes/pentimento.py` | Sessions, ops, heatmap, summary, compaction |
| `backend/routes/chapter_history.py` | Snapshots: list/preview/pin/restore/prune |

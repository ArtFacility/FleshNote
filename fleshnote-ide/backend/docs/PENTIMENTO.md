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
**coalesces** them: consecutive typing in the same paragraph becomes a single *run* with a
`duration_ms`, rather than one row per key. Op types:

- `insert` — typing / added text
- `delete` — backspace / delete (text may be stored **reversed** for backspace runs)
- `paste` — a bulk insertion (large single change)
- `pause` — an idle gap above the threshold (marks thinking time)

Runs are flushed to the backend and stored in **`pentimento_ops`**, keyed by
`para_index` + `char_offset`. This keeps a full novel's process history in the low tens of MB.

> **Coalescing artifact:** each word-run tends to append a trailing `\xa0` (nbsp) then delete
> it as a 0-duration bookkeeping op. Consumers should strip those toggles and use the
> `duration_ms` / ordering, not the literal nbsp.

### Sessions

A writing session opens when you start editing a chapter and is **sealed** at session end
into **`pentimento_sessions`**: `session_num` (per-chapter ordinal), `start_time`/`end_time`,
and a SHA-256 chain (`previous_session_hash` -> `session_hash`) so the process log is
tamper-evident. Old sessions can be **compacted** — their raw ops are pruned and replaced by
aggregate totals in `summary_json`.

---

## 2. Heatmap

`POST /api/project/pentimento/heatmap` aggregates live ops + compacted summaries into
per-paragraph metrics: time spent, chars inserted/deleted, revision count, day/night ratio,
churn (`deleted / (inserted + deleted)`), and a normalized `heat` value. The Process tab
paints each paragraph by effort, so heavily-reworked passages stand out.

---

## 3. Prose snapshots (the ground truth)

**Key constraint:** past prose is **not** reconstructable from `pentimento_ops`. The ops are
deltas with no baseline anchor, backspace runs are stored reversed, paragraph merges/splits
aren't tracked, and compaction deletes ops outright. So anything that needs *actual old text*
(rollback, replay) must rely on real snapshots.

That's **`chapter_snapshots`**: the chapter's markdown, zlib-compressed, captured at natural
checkpoints. `kind` is one of:

- `session` — auto-captured at session end (deduped on `prose_hash` so idle sessions don't
  create duplicates). Gated by `prose_history`.
- `manual` — a version the writer explicitly pinned (optional `label`). Always kept.
- `pre_restore` — a safety copy taken just before a restore, so restores are undoable.

The auto-capture hook lives in `pentimento.py` `session/end`; the latest editor save is
flushed to the `md/` file before the snapshot is taken so it captures the sealed state.

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
3. **Pacing overlay.** For each transition, the originating session's `pentimento_ops`
   (fetched via `pentimentoOps`, grouped by `session_id`) provide the *rhythm* — per-word
   cadence and pauses — for typing the new span, **when they match** the diffed text.
   Compacted or non-matching sessions fall back to synthetic even-paced typing. Ops never
   supply content, only timing.

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

## 7. Related tables

See `DATABASE_SCHEMA.md` §28 `pentimento_sessions`, §29 `pentimento_ops`,
§30 `chapter_snapshots`, and §27 `change_log` / §31 `sync_meta` (the sync ancestry that
restore writes into).

## 8. Key files

| File | Role |
| ---- | ---- |
| `src/renderer/src/utils/pentimentoRecorder.js` | TipTap op capture + coalescing |
| `src/renderer/src/utils/proseDiff.js` | `cleanProse`, `diffLines`, `diffParagraphs`, `diffInline` |
| `src/renderer/src/components/PentimentoTab.jsx` | Process tab — heatmap + replay simulation |
| `src/renderer/src/components/HistoryPanel.jsx` | Right-side rollback panel |
| `src/renderer/src/components/PentimentoSettings.jsx` | Toggles, storage, compaction UI |
| `backend/routes/pentimento.py` | Sessions, ops, heatmap, summary, compaction |
| `backend/routes/chapter_history.py` | Snapshots: list/preview/pin/restore/prune |

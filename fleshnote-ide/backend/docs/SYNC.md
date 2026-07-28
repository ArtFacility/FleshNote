# Sync Engine — Local Cross-Device Merge

FleshNote projects can be **synced between two copies** of the same project (e.g. a desktop
and a laptop, via a shared/USB/cloud-drive folder) without a server. Sync is **manual and
user-initiated**: you pick a second copy of the project, preview exactly what would change,
resolve any prose conflicts, and apply. The same change-tracking scaffolding (a
Hybrid Logical Clock + a `change_log`) is what the **companion app** syncs against, either
by raw folder or over the QR/LAN transport in §9.

**The desktop is always the authority.** Whichever device a change was made on, it's the
desktop that runs the diff/merge engine and resolves prose conflicts — the companion never
runs its own conflict-resolution UI against the desktop. This holds for both transports below.

- Backend: `backend/sync_core.py` (clock + logging primitives), `backend/routes/sync.py`
  (the diff/merge engine, folder-path based).
- Frontend: `src/renderer/src/components/SyncModal.jsx` (folder-path flow) and
  `RemoteSyncModal.jsx` (QR/LAN flow, §9), both sharing `SyncDiffView.jsx` for the
  conflict/changes UI. Opened from the header menu.
- IPC: `window.api.syncPreview` / `window.api.syncApply` (`src/main/index.ts` →
  `/api/project/sync/preview` and `/api/project/sync/apply`); `window.api.remoteSync*`
  for the QR/LAN flow (§9).
- Tables: `change_log`, `sync_meta` (see `DATABASE_SCHEMA.md` §27, §31).

---

## 1. The write path — how changes are tracked

Every mutating route records what changed, so sync has an authoritative history to merge.
`sync_core.py` provides the primitives (all called **inside** the route's transaction,
before commit):

- **`next_hlc(cursor)`** — issues a Hybrid Logical Clock stamp of the form
  `{ms:013d}:{ctr:05d}:{DEVICE_ID}` (millisecond time, a counter that breaks ties when the
  wall clock doesn't advance, and the authoring device id). Monotonic per device; stored as
  `sync_meta.last_hlc`. HLCs are **string-comparable** — lexicographic order == causal order.
- **`log_change(cursor, table, row_id, changes: dict)`** — appends **one `change_log` row per
  changed column** (`table_name`, `row_id`, `column_name`, new `value`, `hlc`, `device_id`,
  `origin`). This is column-level Last-Writer-Wins: the log stores the *new value*, stamped.
- **`log_soft_delete(...)`** — a tombstone (`deleted=1`, `deleted_at=<iso>`) logged the same
  way, so deletes propagate and merge like any other field.
- **`apply_update(...)`** — convenience wrapper: filters out `None` fields, builds the dynamic
  `UPDATE`, executes it, and emits the matching `log_change`.

`DEVICE_ID` comes from the `FLESHNOTE_DEVICE_ID` env var (set by the Electron main process),
with a random fallback for standalone script runs.

---

## 2. What gets compared — two independent diff models

Sync treats **structured entities** and **prose** completely differently, because they have
different notions of "changed".

### Entities — field-level LWW by HLC
For characters, locations, config, etc., a field is a *real* remote change only when:
1. its latest remote `change_log` HLC is unseen by local (per the version vector), **and**
2. no newer local edit to the same field exists (local HLC would win), **and**
3. the normalized remote value actually differs from the current local value.

`_norm()` collapses equivalent representations so identical clones never show phantom edits:
`NULL`, `""`, `"[]"`, `"{}"`, `"null"` all mean *empty*, and JSON is compared structurally
(`json.dumps(..., sort_keys=True)`). A remote `deleted=1` becomes a **delete**, a row that
doesn't exist locally becomes a **create**, otherwise an **update**.

### Prose (`md/` files) — hash ancestry, not "did both log something"
Chapter prose is tracked only as a `prose_hash` in `change_log`. Sync decides per chapter
from the **full hash history on both sides** (`_prose_history` → latest hash + the set of all
hashes each side has ever seen):

| Situation | Result |
| --------- | ------ |
| No remote history, or `latest_local == latest_remote` | **converged** — nothing to do |
| `latest_local` is in remote's history (remote advanced past it) | **clean take** remote→local |
| `latest_remote` is in local's history (local advanced past it) | local is **ahead** (pending push) |
| Neither latest is in the other's history | **conflict** — both diverged |

Resolving a conflict always writes a **fresh** `prose_hash`, so the two sides converge and
the same conflict can never reappear.

---

## 3. Version vectors

`sync_meta.version_vector` is a JSON map `device_id -> highest HLC seen from that device`.
`_unseen(logs, other_vv)` uses it to send only what the other side hasn't seen yet, and after
a successful apply the local vector is advanced to absorb the remote's vector and both
devices' clocks. This keeps repeated syncs cheap and idempotent.

---

## 4. Preview — `POST /api/project/sync/preview`

Read-only. Request `{ local_path, remote_path }`. Steps:
1. **Project-id guard** — both folders must have a `fleshnote_project.json` with the *same*
   `project_id`; otherwise it returns an error ("these are different projects — syncing would
   corrupt your manuscript") and does nothing.
2. Load each side's version vector + `change_log`, compute `unseen_remote` / `unseen_local`.
3. Build `entity_changes` (field diffs that would actually alter local state) and the prose
   plan (`prose_takes` + `prose_conflicts`, each conflict carrying both `local_text` and
   `remote_text` for the merge UI).
4. Return everything plus a `summary` (entity creates/updates/deletes, prose takes each
   direction, conflict count). The SyncModal renders this for review before anything is written.

## 5. Apply — `POST /api/project/sync/apply`

Request `{ local_path, remote_path, resolutions }`, where `resolutions` maps
`chapter_id -> "local" | "remote" | "<merged text>"` for each conflict. It **pulls remote
into local** (run it on each machine with roles swapped to converge both ways). Steps:

1. Re-check the project-id guard.
2. **Backup**: copy `fleshnote.db` → `fleshnote.db.bak` before touching anything.
3. **Entities**: apply each winning remote field change (UPDATE existing rows, or INSERT the
   remote row when it doesn't exist locally), and copy the winning remote `change_log` rows in
   (`INSERT OR IGNORE`) so they're marked seen.
4. **Prose**: for each clean `remote_to_local` take, copy the remote `md` file over local and
   copy its prose-hash log. For each conflict, write the resolved text (local / remote /
   merged), record remote's hash as a seen ancestor, then `log_change` a **fresh** `prose_hash`
   and update `word_count`.
5. **Recompute derived data** for every touched chapter — `_update_entity_appearances`,
   `_update_foreshadowings`, `_update_knowledge_offsets`, `_update_relationship_offsets`
   (reused from `routes/chapters.py`).
6. **Advance the version vector** and commit.

**Safety:** the whole apply runs in one transaction. On any error it rolls back, **restores
`fleshnote.db` from the `.bak`**, and raises; on success the `.bak` is removed. So a failed
sync never leaves a half-merged manuscript.

---

## 6. Frontend flow (`SyncModal.jsx`)

Opened from the header menu. The writer picks the other project folder, the modal calls
`syncPreview`, and shows the entity changes and prose plan. Conflicts get an inline diff
(`utils/proseDiff.js` `diffLines` / `cleanProse` — the same helpers the History panel uses)
with local / remote / keep-both choices. On confirm it calls `syncApply` with the collected
`resolutions`, then refreshes the project.

---

## 7. Design notes & limits

- **Manual, not real-time.** There is no background daemon or server; the user drives each
  merge and always previews first.
- **Directional apply.** `apply` only writes into `local`; `local_to_remote` takes are
  reported (local is ahead) but acted on by running sync from the other side. Bidirectional
  convergence = run it both ways.
- **Same-project only.** The `project_id` guard makes cross-project merges impossible.
- **Prose is file-level.** Conflict resolution is per chapter (choose a side or paste a merge),
  not a 3-way line merge — intentional, so the manuscript is never silently spliced.
- The `change_log` + HLC + version-vector substrate is deliberately generic so the planned
  **companion app** can sync against the same history without a schema change.

## 8. Key files

| File | Role |
| ---- | ---- |
| `backend/sync_core.py` | `DEVICE_ID`, `next_hlc`, `log_change`, `log_soft_delete`, `apply_update` |
| `backend/routes/sync.py` | Preview + apply engine (entity diff, prose ancestry, conflict merge, backup/rollback) |
| `src/renderer/src/components/SyncModal.jsx` | Folder pick → preview → conflict resolution → apply |
| `src/renderer/src/components/SyncDiffView.jsx` | Shared summary/conflicts/changes UI (used by `SyncModal` and `RemoteSyncModal`) |
| `src/renderer/src/utils/proseDiff.js` | `cleanProse` / `diffLines` for the conflict diff view |
| `sync_meta`, `change_log` tables | See `DATABASE_SCHEMA.md` §31, §27 |

---

## 9. Remote (QR/LAN) transport — desktop ↔ companion app

The folder-path flow above assumes both copies are reachable on the same filesystem. For a
phone, the desktop instead pairs over the LAN via a QR code and drives the *exact same*
`sync_preview` / `sync_apply` engine — the transport is different, the merge logic is not.

**Why a second server, not the main API.** The main FastAPI app only binds `127.0.0.1:8000`
(Electron-only). A phone needs a LAN-reachable endpoint, but binding the *entire* API to
`0.0.0.0` would expose every project route to the network. Instead a second, minimal FastAPI
app (`remote_app` in `backend/remote_sync_session.py`) is started **on demand** — only while
a pairing session is open — bound to `0.0.0.0` on an ephemeral port (8420-8429), with every
route gated by a per-session token. It's torn down (`server.should_exit`) on cancel, apply
completion, or session expiry, so the LAN port isn't listening at rest and the Windows
Firewall prompt only fires when the user actually opens "Sync with companion app."

### Flow

1. **Start** — `POST /api/project/remote-sync/start` (loopback, called from Electron) mints a
   session: a random token, picks a free port, discovers the desktop's LAN IP(s), and starts
   `remote_app`. Returns `{token, hosts, port, project_id, project_name, expires_at}`
   (10-minute TTL for the whole exchange).
2. **QR** — `RemoteSyncModal.jsx` encodes that payload as JSON into a QR code (`qrcode` npm
   package). The phone scans it and tries each host until one answers
   `GET /remote-sync/pair?token=...` on the LAN port.
3. **Upload** — phone `POST`s a zip of its project folder (`fleshnote.db` + `md/` +
   `fleshnote_project.json`) to `POST /remote-sync/upload?token=...`. The desktop extracts it
   to a temp dir (zip-slip guarded, size-capped) and immediately calls
   `sync_preview(SyncPreviewRequest(local_path=<desktop project>, remote_path=<temp dir>))` —
   the phone's upload is just a `remote_path` on local disk as far as the engine is concerned.
4. **Review + apply** — the desktop polls `POST /api/project/remote-sync/status`, and once the
   preview is ready renders it through the same `SyncDiffView` as the folder flow. Applying
   calls `POST /api/project/remote-sync/apply`, which runs `sync_apply(...)` against the temp
   dir exactly like a folder-based sync.
5. **Download-back** — after apply, the desktop zips its *own, now-merged* project folder and
   makes it available at `GET /remote-sync/download?token=...`. The phone calls
   `POST /remote-sync/complete?token=...` once it has it, which is what lets the desktop-side
   status flip to `downloaded` and the session close out.

### The download-back contract (read this before implementing the companion side)

The zip from `/remote-sync/download` is a **project folder**, not a database to blindly copy
over the phone's own `fleshnote.db`. **The companion must feed it into its own sync engine as
`remote_path`** (per `sync-readiness.md`, the companion's `SyncEngine` already accepts "two
project folders via its own connections") and pull it in the same directional way the desktop
pulled the phone's upload in step 3. A raw overwrite of the phone's `fleshnote.db` would:

- destroy the phone's device-local `pentimento_sessions` / `pentimento_ops` /
  `chapter_snapshots` (never part of `change_log`, see `PENTIMENTO.md` §7 — they're local
  history, not sync state), and
- clobber the phone's own `sync_meta` (`last_hlc`, `version_vector`), breaking future syncs.

So: desktop pulls phone in (steps 3-4), then phone pulls desktop in (step 5) — the same
directional-apply model as the folder flow, just automated over the LAN instead of the user
running sync twice by hand.

### Endpoints

**Loopback (`backend/routes/remote_sync.py`, mounted on the main app):**

| Endpoint | Purpose |
| -------- | ------- |
| `POST /api/project/remote-sync/start` | Mint a session, start the LAN server, return the QR payload |
| `POST /api/project/remote-sync/status` | Poll session status (`waiting → uploaded → ready → applying → applied → downloaded`, or `error`/`expired`) |
| `POST /api/project/remote-sync/preview` | Fetch the cached preview once `status == "ready"` |
| `POST /api/project/remote-sync/apply` | Apply with resolutions, zip the merged project for download |
| `POST /api/project/remote-sync/cancel` | Tear down the session and stop the LAN server |

**LAN (`remote_app` in `backend/remote_sync_session.py`, token-gated, only while a session is open):**

| Endpoint | Purpose |
| -------- | ------- |
| `GET /remote-sync/pair?token=` | Confirm the token and project identity before upload |
| `POST /remote-sync/upload?token=` | Upload the phone's project zip; triggers `sync_preview` |
| `GET /remote-sync/result?token=` | Poll for `ready`/`error` |
| `GET /remote-sync/download?token=` | Download the merged project zip after apply |
| `POST /remote-sync/complete?token=` | Ack download; flips status to `downloaded` |

### Known limits (scaffolding, not yet used by a real companion build)

- Single global session — starting a new one cancels any prior one. Fine for a one-window
  desktop app; would need to key sessions per-project if that assumption ever changes.
  IP discovery (`_get_local_ips`) picks the outbound-route interface and any non-loopback
  `gethostbyname` results — on a multi-NIC machine (VPN, virtual adapters) it may list an
  address the phone can't actually reach; the QR shows all candidates so the phone can try each.
- No retry/resume on upload — a dropped connection mid-upload just leaves the session in
  `waiting`, only recoverable by cancelling and re-pairing.
- The 10-minute TTL covers the whole exchange including how long the desktop user takes to
  review conflicts — generous for a fast pairing, but a slow reviewer could hit it.

## 10. Key files (remote transport)

| File | Role |
| ---- | ---- |
| `backend/remote_sync_session.py` | Session state machine, on-demand `remote_app`, zip pack/extract, IP discovery |
| `backend/routes/remote_sync.py` | Loopback routes; reuses `routes/sync.py`'s `sync_preview`/`sync_apply` verbatim |
| `src/renderer/src/components/RemoteSyncModal.jsx` | QR display → poll → `SyncDiffView` → apply → wait for phone download |

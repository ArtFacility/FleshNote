# Cloud Sync & Subscriptions — Design Plan (not yet implemented)

**Status: planning only.** Nothing in this doc exists in code yet. This captures the
architecture decided during brainstorming so it survives to whenever it's actually built.
Unlike the other docs in this folder, this one describes intent, not a built system.

## The problem

FleshNote desktop is FOSS. The mobile companion app is closed-source and uses Google Play
Billing for subscriptions — easy, handled entirely by Google. The desktop app has no
equivalent, and since it's open source, any client-side license/entitlement check is
decorative (a user can just patch it out). The website already has user accounts. The goal:
a **non-intrusive** way for the desktop app to talk to a subscription-gated cloud backend,
without embedding secrets or DRM logic in an open-source client.

## The core decision: server-side entitlement, client-side merge

The client never decides whether a user is subscribed — it just calls the server with a
token, and the server says yes or no. This is the only model that makes sense for a FOSS
client talking to a paid service (see Bitwarden, Standard Notes — same shape: FOSS client,
paid hosted service, server URL + token, no client-side license checks).

The bigger architectural point: **cloud sync is not a new sync engine.** It's a third
transport for the sync engine that already exists (`SYNC.md`), alongside the folder-path
flow and the QR/LAN flow built for the mobile companion. All three ultimately do the same
thing — hand `sync_preview`/`sync_apply` a `remote_path` folder on local disk and let the
existing `change_log` / Hybrid Logical Clock / version-vector diff engine do the work:

| Transport | `remote_path` comes from |
| --- | --- |
| Folder-path sync | a folder the user picks on disk |
| QR/LAN sync | a temp dir filled from a phone's upload over the LAN |
| Cloud sync | a temp dir filled from a download against `provider_url`, authenticated by `token` |

Because the version vector is keyed **per device**, not pairwise, the cloud copy is just
one more device in the same substrate — nothing about it conflicts with a phone syncing
over LAN, or two desktops syncing via a shared folder. All three can coexist on the same
project without any special-casing.

**Consequence for your server:** it doesn't need to run merge logic at all. It can be a
thin, dumb store — an authenticated project registry plus blob storage for a project's
`fleshnote.db` + `md/` state (reusing the same zip pack/extract code already written for
QR sync). All the actual diffing stays client-side, in code that already exists and is
already tested. You never end up maintaining two merge implementations in two languages.

## Auth — browser handoff, reusing existing infra

Decided: sign-in happens via browser handoff, not copy-pasting a token by hand. This
reuses the exact on-demand-loopback-server pattern already built for QR pairing
(`remote_sync_session.py`) — same shape, different purpose.

1. User clicks **"Sign in on your website"** in a new desktop "Account" settings panel.
2. Desktop starts a short-lived local HTTP listener on an ephemeral port and generates a
   one-time `state` nonce.
3. Desktop opens the system browser to
   `{provider_url}/auth/desktop?state=<nonce>&callback=http://127.0.0.1:<port>/callback`.
4. User logs in on the website (or is already logged in), sees an
   "Authorize FleshNote Desktop?" confirmation, and the website redirects the browser to
   the callback URL with a token.
5. The desktop's listener receives it, checks the `state` matches, stores the token, and
   tears the listener down.

**Token type:** mint a distinct **device/API token**, not the website's session cookie.
This gives you a natural "Active Devices" page on the website where a user can revoke
desktop access alone, without a password change — standard practice (GitHub PATs, `gh
auth login`, etc.) and cheap to build since you already have user accounts.

**Storage:** the token is a bearer credential — store it via Electron's `safeStorage`
(OS keychain), not a plaintext config file.

## Scope — per-project opt-in

Cloud capability is unlocked account-wide by signing in, but **each project opts in
individually** — matches how folder-path and QR sync are already per-project actions, and
respects that most users will have local-only projects (drafts, experiments) they never
want leaving their machine.

- Reuse the existing `project_id` from `fleshnote_project.json` as the cloud project key
  — no separate mapping table needed.
- A project menu entry: **"Link to Cloud"** registers `project_id` server-side. Once
  linked, a third sync option ("Sync to Cloud") appears alongside "Sync Project..." and
  "Sync with Companion App...".
- "Unlink" (stop syncing) should be a separate, explicit action from "Delete from cloud"
  (remove the server-side copy) — don't conflate the two.

## Provider URL — freely editable (Bitwarden-style)

Decided: the URL field is a real, editable setting, not hardcoded — prefilled to the
official endpoint, but swappable. Cost: the desktop client must treat "your own server"
as just another provider implementing the same contract, with **no special-casing** in
the client code. Since you're building both ends anyway, this costs nothing extra now and
buys FOSS goodwill (self-hosting becomes possible in principle, the way it is for
Bitwarden/Standard Notes) without committing to officially supporting third-party servers.

## One real difference from QR sync: async, not a live session

QR sync is a live pairing session with a human watching the whole time, so "always show
a preview before applying" was free — there's always someone there to click through it.
Cloud sync is asynchronous: a phone could push to the cloud while nobody's at the desktop.

Rule: **never auto-apply**, especially prose conflicts — same guarantee as the other two
transports. But the app *can* auto-check on startup (or periodically) and surface a quiet
"3 changes available from the cloud" affordance instead of requiring a manual click every
time. Auto-detect, manual-apply — not auto-apply.

## Minimal server API surface (sketch, for when the website side gets built)

- `POST /auth/desktop` (browser-facing, not an API call) — login + authorize screen,
  redirects to the desktop's callback with a token.
- `POST /devices/revoke` — website-side "Active Devices" management.
- `POST /projects/register` — link a `project_id` to the authenticated account.
- `POST /projects/unregister` — unlink (keep or delete server copy, explicit choice).
- `GET /projects/{project_id}/pull` — download the current server-side blob (or delta),
  Bearer-authenticated, entitlement-checked server-side.
- `POST /projects/{project_id}/push` — upload the desktop's post-merge state after apply.
- `GET /projects` — list what's linked, for the "Account" panel and startup auto-check.

None of these need to know anything about entities, chapters, or conflicts — they're pure
authenticated blob transport plus a subscription check. All the domain logic stays in
`sync_preview`/`sync_apply`, unchanged.

## Open items for later

- Whole-blob vs. delta storage server-side (start with whole-blob, matches the QR zip
  approach already written; revisit if project sizes or bandwidth become a problem).
- Whether "3 changes available" auto-check on startup should be silent-by-default or ask
  before even checking (privacy-conscious users may not want the app phoning home
  automatically even to check for updates).
- Rate limiting / abuse handling on the server once the URL is freely editable (a
  malicious or misconfigured custom provider shouldn't be able to hang the desktop app —
  the existing `MAX_UPLOAD_BYTES`-style caps and timeouts from the QR transport should
  carry over here).

# Remote (QR/LAN) Sync — Dev Must Test These Things

Everything in `SYNC.md` §9 was built and verified by an AI agent working headless (no
display, curl-only). That verification is real but partial — this is the list of what
still needs a human, a real phone, and an actual second device before this feature is
trusted. Nothing below is "probably fine"; it's explicitly unverified.

## Must test before relying on this at all

- [ ] **Real phone, real Wi-Fi.** Everything so far was self-to-self on one machine
  (loopback, and the machine's own LAN IP). Pair an actual phone against the desktop
  over a real home network. This is the only way to know if the QR payload, host
  discovery, and connection actually work end to end.
- [ ] **Windows Firewall prompt.** Does it fire the first time "Sync with companion app"
  is opened? Does allowing it work immediately, or does the in-flight session need to be
  restarted after granting the prompt? If the prompt is confusing or silently blocks with
  no error shown to the user, that's a UX bug worth fixing before this ships.
- [ ] **Packaged (PyInstaller) build, not the dev venv.** Every backend test so far ran
  via `python main.py` in `backend/.venv`. `python-multipart` was added to
  `backend.spec` hidden imports but never verified inside an actual built `backend.exe`.
  If it's missing, uploads will 500 only in the packaged app — build one and pair against
  it.
- [ ] **Visual check of `RemoteSyncModal.jsx`.** Never rendered — only build-verified.
  Confirm the QR code actually displays and is scannable at the given size, the layout
  doesn't overflow the 92vw modal, and it reads correctly in both light and dark theme.
- [ ] **Visual re-check of `SyncModal.jsx` (local-folder sync).** `SyncDiffView.jsx` was
  extracted out of this file to share with the QR modal. The diff was mechanical (pure
  move, no logic changes) and the build passes, but this touched the *working* sync flow
  — re-run a real local-folder sync and confirm nothing regressed before trusting it.

## Should test — real coverage gaps

- [ ] **An actual entity `update`, not just `create`.** The E2E test used two
  independently-migrated project copies, which get disjoint UUIDs — so the one merge it
  exercised was an INSERT (`action: "create"`). Real phone sync starts from a shared
  clone with matching UUIDs, so it will mostly hit the `update` branch of
  `_compute_entity_changes` / `sync_apply`. That branch is implemented (it's the same
  code the folder-based sync already uses) but never exercised through this transport.
- [ ] **A prose conflict over the QR transport.** Edit the same chapter differently on
  both "sides" before pairing and confirm `prose_conflicts` shows up correctly in
  `RemoteSyncModal`'s `SyncDiffView`, and that resolving it (keep mine / use theirs /
  manual merge) applies correctly. The E2E test only had entity field changes — prose
  conflict rendering through this specific modal is untested.
- [ ] **The download-back leg with a real companion build.** Only the desktop side was
  tested (`/remote-sync/download` returns a valid zip). No companion build exists yet to
  confirm it actually feeds that zip into its own `SyncEngine` as `remote_path` rather
  than overwriting its db — see the download-back contract in `SYNC.md` §9. This is a
  companion-app-side implementation task, not just a test.
- [ ] **Editing in the app while an apply is running.** `sync_apply` writes the live
  project DB. If the editor autosaves mid-apply, is there any corruption risk? This is
  the same exposure the existing folder-based sync already has (not a regression), but
  it's never been deliberately tested either.

## Edge cases worth trying

- [ ] **Session expiry mid-review.** Start a session, let the phone upload, then sit on
  the conflict-review screen past the 10-minute TTL. Confirm the UI shows `expired`
  cleanly instead of hanging or throwing a raw error on apply.
- [ ] **A large project (approaching the 200MB upload cap).** Confirm no timeout on a
  slow phone connection — there's currently no upload progress indicator, so a big
  upload may look frozen.
- [ ] **AP-isolated / guest Wi-Fi.** Common on public and some home guest networks —
  devices can't see each other even on the "same" network. Right now this just looks
  like the QR flow hanging forever (no specific error until the 10-minute TTL expires).
  Worth deciding whether a friendlier hint belongs here.
- [ ] **Rapid start → cancel → start cycles.** Confirm the ephemeral port
  (8420-8429) gets released and reused cleanly and no server threads pile up.
- [ ] **macOS / Linux**, if those backend builds are shipped — the LAN server, socket
  binding, and IP discovery (`_get_local_ips`) were only exercised on Windows.

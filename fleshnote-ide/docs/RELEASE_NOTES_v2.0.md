# FleshNote v2.0 — The Distributed & Living World Update

Welcome to **FleshNote v2.0**! This is the single largest release in FleshNote's history. Over the past several months, we completely rebuilt the architectural foundation of the application — transitioning from a single-machine, integer-based SQLite database to an offline-first, UUID-driven sync engine — while introducing transformative creative tools: **Factions & Groups**, the **Pentimento Writing Process Replay**, **Session History Rollback**, and **Cross-Device Sync**.

Here is the complete breakdown of everything new in 2.0.

---

## 🏛️ 1. Factions, Groups & Organizations

Worldbuilding isn't just about isolated characters or static map markers; it is about how people organize, align, fight, and build institutions. FleshNote 2.0 introduces first-class support for **Groups & Factions**.

### 👥 Roster & Rank Management
- **Members & Roles**: Assign characters to factions with specific ranks, roles, and titles (e.g., *Grandmaster*, *Infiltrator*, *Council Member*).
- **Temporal Membership**: Track when a character joined and when they left or were exiled, aligning perfectly with your story's chronological timeline.

### 🚩 Faction Milestones
- **Institutional History**: Log historic events — treaties, rebellions, schisms, founding charters, or collapses — with precise world dates.
- **Manuscript Context & Jumps**: Each milestone can link directly to the chapter and scene where it occurs, allowing one-click navigation between your world bible and your prose.

### ✍️ Seamless Manuscript Integration
You don't have to leave the manuscript editor to organize your factions:
- Highlight text in the editor, right-click, and open the **Group** context menu:
  - **Create Group**: Quickly establish a new group with the selected name and the effective world date automatically prefilled based on cursor position.
  - **Link Group**: Format selected text as an interactive faction link.
  - **Add Member**: Instantly draft a character into a faction right from the paragraph where it happens.
  - **Add Milestone**: Log an organizational turning point with the selected passage prefilled into the description.

### 🗺️ World History Timeline Integration
- Factions and their milestones are now fully integrated into the **World History** interactive timeline.
- Filter by faction or inspect organizational lifespans alongside character arcs and global world events.

---

## 🎨 2. Pentimento — The Living Writing Process

Named after the art term *pentimento* (where traces of an earlier painting emerge through the final canvas), this new engine records **how** your manuscript came into being, not just the final words on the page.

### 🔥 Effort & Rework Heatmaps
- The new **Process Tab** visualizes your manuscript through an effort heatmap.
- Identify at a glance which paragraphs flowed effortlessly and which required intense revision, backspacing, and structural rewriting.
- Metrics track typing duration, character insertions, deletions, churn ratio (`deleted / (inserted + deleted)`), and night vs. day writing habits.

### ⏱️ Replay & Process Simulation
- **Watch Your Chapter Grow**: Scrub through a timeline slider or hit Play to watch your chapter reconstruct itself from the very first sentence to the finished draft.
- **Op-Paced Playback**: Replay animates keystroke runs, deletions, and pauses realistically, giving you an intimate look at your creative flow.

### 🔒 Tamper-Evident Writing Telemetry
- Coalesced operational logging (`insert`, `delete`, `paste`, `pause`) tracks genuine writing momentum without bloating storage (tens of megabytes for an entire novel).
- Writing sessions are sealed at session-end using cryptographic SHA-256 hash chains, providing a verified proof of human authorship.

---

## ⏳ 3. Session History & Painless Rollbacks

Every writer knows the terror of accidental deletions, destructive edits, or trying out an experimental revision only to wish you could revert to yesterday's draft. FleshNote 2.0 introduces a dedicated **History Panel**.

### 📸 Automatic & Manual Prose Snapshots
- **Automatic Session Checkpoints**: FleshNote captures a compressed snapshot of your chapter prose at the close of every writing session.
- **Manual Pinning**: Pin crucial milestones before major overhauls with custom labels (e.g., *"Before Killing off Lord Julian"*).
- **Pre-Restore Safety Copies**: Restoring an older draft automatically snapshots your current text first, making restores 100% undoable.

### 🔍 Side-by-Side Visual Diffing
- Preview historical drafts in an inline diff viewer showing added and removed passages highlighted in green and red before deciding to restore.
- Full integrity updates: Restoring an older snapshot automatically recalculates word counts, updates entity appearances, and syncs epistemic knowledge state markers.

---

## 🔄 4. Cross-Device Sync & Companion App

FleshNote is now built for writers who move between a desktop workstation, a laptop on the train, and a mobile device on the go.

### 📲 Mobile Companion App Pairing
- **Zero Cloud Required (Serverless)**: Pair your desktop and companion app over your local Wi-Fi network using a secure one-time **QR code**.
- **Bidirectional Asset Transport**: Not only does your manuscript and database sync, but character portraits, sketchboard art, and reference images sync across devices as well.
- **Folder Sync**: If you prefer syncing via USB drive, Nextcloud, Dropbox, or Syncthing, folder-to-folder sync is fully supported with identical conflict-resolution guarantees.

### 🧠 Distributed Conflict Resolution
- Built on **Hybrid Logical Clocks (HLC)** and column-level **Last-Writer-Wins (LWW)** with tombstones for deleted records.
- **Prose Hash Ancestry**: Chapter conflicts are detected using cryptographic hash trees. If two devices edited the same chapter simultaneously, FleshNote presents a side-by-side merge interface rather than silently overwriting your work.

---

## ⚙️ 5. Under the Hood: Database Overhaul & Auto-Migration

To support multi-device sync, offline writes, and version history, FleshNote's backend underwent a massive engineering rewrite.

- **UUID Architecture**: Replaced legacy autoincrement integer IDs across all 30+ database tables with globally unique UUIDs, preventing ID collisions when creating entities across different devices offline.
- **Automatic Project Migrator**: On startup, FleshNote detects legacy databases, creates a timestamped safety backup, and automatically converts existing projects to the 2.0 schema without requiring manual export/import.
- **Database Concurrency & Hardening**: Implemented 30-second busy timeouts and immediate transaction locking to prevent SQLite database lock errors during heavy multi-window workloads.

---

## 📅 6. Calendar System & World Time Granularity

- **Day-Level Precision**: The calendar and world-time systems now track exact day/month/year dates across all inspectors, time overrides, and manuscript marks.
- **Dynamic Context Updates**: Moving your cursor across a flashback or time override immediately updates character age, weather, faction milestones, and knowledge states in the sidebar in real time.

---

## 🛠️ 7. Stability, Performance & Quality of Life

- **Undo/Redo (Ctrl+Z) Isolation**: Completely isolated undo/redo history stacks to the loaded chapter session, preventing undo from ever wiping a chapter back to an empty document.
- **Entity Creation Protection**: Added in-flight request debouncing, button locking, and backend 5-second duplicate guards to eliminate accidental multi-clicks and lag freezes.
- **Persistent Highlight Preferences**: Manuscript highlight toggles (entities, groups, milestones, twists) now persist across view navigation and project sessions.
- **Modernized Splash & UI**: Fresh 2.0 branding, streamlined icon-only tabs when space is constrained, and responsive popups with safe off-screen padding.

---

## 🌐 Read More & Download

FleshNote 2.0 is available now. Download the latest release or read more guides and documentation on our official website:

👉 **[artfacility.xyz](https://artfacility.xyz)**

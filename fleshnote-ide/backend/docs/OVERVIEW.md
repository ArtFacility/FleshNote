# FleshNote IDE - Developer Overview

Welcome to the FleshNote IDE codebase! This document serves as the primary entry point for AI Agents and developers. It provides a high-level briefing on what the project is, the core systems currently in place, where to find specific documentation, and our roadmap for future development.

## What is FleshNote?

*A no bullshit writing tool designed for writing first, with seamless notetaking second.*

FleshNote is envisioned strictly as a writing-oriented IDE devoid of the conventional distractions found in overbearing world-building toolsets. It fundamentally prioritizes placing words onto the page via a clean minimal IDE editor while shifting the heavier, lore-centric overhead into secondary, optionally accessible UI panels and NLP-driven background data extraction.

![fleshnote-overview](https://artfacility.xyz/fleshnote) <!-- Placeholder, illustrative of developer intent -->

## Core Pillars
1. **Writing First**: An unencumbered Markdown canvas designed around pure narrative drafting, target word goals, and focus sprint modes.
2. **Abstract Tracking**: Leveraging Local AI/NLP tools (spaCy) natively inside the app bundle allows writers to dump lore directly into an extractor pane, auto-categorizing entities without exhaustive manual data entry.
3. **Seamless Epistemic UI**: Features structured around 'who knows what'. Knowledge logic, secrets, and foreshadowing markers are injected without corrupting the prose.

## Documentation Guide (Where to look)

Depending on what you need to work on, refer to these specific documentation files in `backend/docs/`:

*   **`ARCHITECTURE.md`**: Read this for a high-level overview of the application architecture, 3-Layer IPC communication patterns, and file organization.
*   **`DATABASE_SCHEMA.md`**: Read this to understand the SQLite (WAL) database schema, config UI toggling, and JSON storage conventions.
*   **`IDE_FEATURES.md`**: Comprehensive catalog of primary frontend IDE features, layout, and Editor interactions (Focus modes, Entity linking, Auto-save).
*   **`PLANNER.md`**: Details the Plot Planner's infinite zoomable timeline, blocks, arcs, and layering systems.
*   **`TWISTS.md`**: Details the Twist system, foreshadowing markers, heuristic warnings, and plot payoff tracking.
*   **`API_ENDPOINTS.md`**: Details the FastAPI backend endpoints, request payloads and API structures.
*   **`ENTITY_LINKING.md` / `SPRINT_MODES.md` / `EXPORT_GUIDELINES.md`**: Specifics on these individual systems.

## Currently Implemented Systems
*   **Split-Pane IDE Layout**: A robust Electron/React shell encompassing a dual-pane view: the Manuscript Markdown editor versus the Entity Inspector/Setup workflow menus.
*   **TipTap Entity & Twist Linking**: The primary prose editor integrates TipTap, allowing authors to natively `@mention` or `Command+Click` highlighted text to magically spawn aliases, links, or quick notes. Handles `{{twist:ID}}` and `{{foreshadow:ID}}` markers.
*   **Python WAL SQLite Database**: A localized Python backend powered by FastAPI securely manages the deeply interconnected graph of relations, notes, chapters, and properties via SQLite Write-Ahead Logging for robust concurrency.
*   **NLP spaCy Integration**: Background entity recognition dynamically powers the "Data Extractor" module, parsing raw dumped text into formatted Lore sheets.
*   **Professional Export Pipeline**: Fully realized support for .docx (Manuscript Standard), .pdf (Print-Ready), and .epub (E-Book) formats with live preview and book-ready page layout logic. 
*   **Plot Planner & Focus Modes**: Visualizing "Foreshadowing" links, blocks, and arcs on a timeline graph to audit narrative pacing, while Focus sprint modes (Kamikaze, Fog, Zen) gamify the writing experience workflow.
*   **Localization & RTL Support**: An actively maintained i18next translation framework natively spanning English, Hungarian, Polish, and Arabic, automatically flipping layout constraints natively utilizing pure logical CSS properties (`inset-inline`, `margin-block`).
*   **Statistics & Custom Analytics**: A comprehensive dashboard (`StatsDashboard.jsx`) tracing writing telemetry (Sprint Consistency, Ruthless Editor Ratio, Time Auditing) and compiling an intuitive Entity Presence Matrix and World History timeline.

## Future Plans

These are the upcoming systems and features planned for implementation, categorized by priority and type.

### 1. Core Features (High Priority)
*   **Custom Calendar Maker**: Tools for the author to build and specify custom in-universe calendar systems for tracking time.

### 2. Quality of Life (QOL) Features (Medium Priority)
*   **Automatic Local Backups**: Silently archiving daily zip snapshots of the project database to combat user error and sync conflicts without relying on the cloud.
*   **Right Side Panel Integration**: A dedicated right-hand sidebar that will serve as the hub for the smart link adder suggestion system (via spaCy) and a centralized warning lister.
*   **Deep-Linked Knowledge States**: Making knowledge state references instantly clickable, taking the user directly to the exact words on the page where it's linked.
*   **Link Coloring Toggles**: A simple button/setting to quickly disable all entity link colorings in the editor, or selectively filter certain colorings for a cleaner reading experience.

### 3. "Cool" Smart Features (Lower Priority)
*   **Smart IDE Dialogue Highlighting**: Special Editor highlighting specifically distinguishing spoken dialogue from prose.
*   **Dialogue Collector & Tone Analyzer**: Automatically collecting a character's dialogue across the manuscript to analyze and display their specific "tone", showing the writer how differently their characters sound from one another.
*   **Synonym & Adjective Suggestor**: The right panel proactively suggesting changes to weak adjectives (and their modifiers) to punch up the prose.
*   **Typo & Most Used Words**: Basic typo fix suggestions and a tracker for the author's most overused words.

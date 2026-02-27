# FleshNote IDE - General Overview

*A no bullshit writing tool designed for writing first, with seamless notetaking second.*

FleshNote is envisioned strictly as a writing-oriented IDE devoid of the conventional distractions found in overbearing world-building toolsets. It fundamentally prioritizes placing words onto the page via a clean minimal IDE editor while shifting the heavier, lore-centric overhead into secondary, optionally accessible UI panels and NLP-driven background data extraction.

![fleshnote-overview](https://artfacility.xyz) <!-- Placeholder, illustrative of developer intent -->

## Core Pillars
1. **Writing First**: An unencumbered Markdown canvas designed around pure narrative drafting, target word goals, and focus mode. 
2. **Abstract Tracking**: Leveraging Local AI/NLP tools (spaCy) natively inside the app bundle allows writers to dump lore directly into an extractor pane, auto-categorizing entities, motives, and character sheets without exhaustive, tedious manual data entry.
3. **Seamless Epistemic UI**: Features structured around 'who knows what'. Knowledge logic, secrets, and foreshadowing markers are injected without corrupting the prose.

## Currently Implemented Features
*   **Split-Pane IDE Layout**: A robust Electron/React shell encompassing a dual-pane view: the Manuscript Markdown editor versus the Entity Inspector/Setup workflow menus.
*   **TipTap Entity Linking**: The primary prose editor integrates TipTap, allowing authors to natively `@mention` or `Command+Click` highlighted text to magically spawn aliases, links, or quick notes natively referenced against the central SQLite database.
*   **Python WAL SQLite Database**: A localized Python backend powered by FastAPI securely manages the deeply interconnected graph of relations, notes, chapters, and properties via SQLite Write-Ahead Logging for robust concurrency.
*   **NLP spaCy Integration**: Background entity recognition dynamically powers the "Data Extractor" module, parsing raw dumped text into formatted Lore sheets.
*   **Professional Export Pipeline**: Fully realized support for .docx (Manuscript Standard), .pdf (Print-Ready), and .epub (E-Book) formats with live preview and book-ready page layout logic. 
*   **Localization & RTL Support**: An actively maintained i18next translation framework natively spanning English, Hungarian, Polish, and Arabic, automatically flipping layout constraints natively utilizing pure logical CSS properties (`inset-inline`, `margin-block`). 

## Upcoming Roadmap & Tasks
*   **Theme Engine Completion**: Dynamic accent color pickers and deeper typography font overrides for users.
*   **Advanced Plot Board**: Visualizing "Foreshadowing" links and "Secrets" on a timeline graph to audit narrative pacing.
*   **Cloud Sync & Backup**: Enabling encrypted remote storage for cross-device writing sessions.
*   **Performance Scaling**: Iterating over the dual-process communication and local NLP memory overhead to guarantee flawless performance on 100k+ word manuscripts.

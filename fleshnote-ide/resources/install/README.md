# .flnote — Windows & Linux file-type registration

`.flnote` projects are extensioned **directories** on disk (live SQLite inside),
so Windows/Linux pickers always treat them as folders — no registry or theme
trick changes that. What we do instead: make folders *look* like FleshNote
project files, give the exported single-file artifacts their own identity, and
offer transparent compression for big projects.

## Icon set (generated from `../fileicon.png`)

`resources/icons/`:
- `fleshnote.ico` — multi-size ICO (16/24/32/48/64/128/256, PNG frames) for
  Windows ProgIDs and `desktop.ini`.
- `fleshnote-project-<size>.png` — same sizes for the Linux hicolor theme.

Regenerate: see `make_icons.ps1` history — input `C:\Gamedev\FleshNote\fileicon.png`,
square contain-fit at 96% scale, centered.

## Windows

1. **Per-folder icon** — `backend/folder_icon.py` runs on every project
   creation (`/api/project/init`): copies `.fleshnote.ico` into the project and
   writes `desktop.ini` (`IconResource`, hidden+system; folder gets ReadOnly).
   Result: Explorer shows the document icon instead of the generic folder one.
   Moved projects silently fall back to the generic icon.
   The backend carries `fleshnote.ico` + the 256px PNG via PyInstaller datas
   (`backend.spec` → `icons/`).
2. **Extension registration** (optional, per-user, no admin):
   `resources/install/register_flnote_windows.ps1` registers HKCU
   `FleshNote.Project` (icon + double-click opens the IDE with the project).
   Re-run after moving the IDE; `-Remove` unregisters.
3. **Space for big projects** — `resources/install/compact_flnote.ps1`:
   NTFS-compress a project folder (`compact /c /s:...`, transparent, instant,
   no format change; `-Undo` reverses).

## Linux

1. **Single-file artifacts** (the exported `.flnote` ZIP — a real file):
   `resources/install/install_flnote_linux.sh` installs the hicolor mimetypes
   PNG set + MIME registration (`application/x-fleshnote`, subclass zip,
   `*.flnote`) per user, then refreshes the mime/icon caches.
2. **Project folders** — directories have no MIME type in freedesktop, so the
   backend (Linux branch of `folder_icon.py`) sets a per-folder custom icon:
   `gio set <dir> metadata::custom-icon-uri file://…/fleshnote-project-256.png`
   (GNOME/Nautilus honors it; KDE can use the same metadata in recent
   versions; other file managers ignore it gracefully).

## Regenerating the icons

If `fileicon.png` changes, rerun the generator (PowerShell + GDI+):

    powershell -ExecutionPolicy Bypass -File <repo>\tools\make_icons.ps1

(kept next to this file in `tools/` if present; the generator lives in the
dev temp scripts otherwise).

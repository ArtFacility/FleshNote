# folder_icon.py — makes .flnote project folders look like FleshNote files.
#
# Windows: copies fleshnote.ico into the project and writes a desktop.ini
# ([.ShellClassInfo] IconResource) so Explorer shows the project icon instead
# of the generic folder icon. The folder itself stays a normal directory —
# this is cosmetic only (the live SQLite db keeps working exactly as before).
#
# Linux: best-effort `gio set <dir> metadata::custom-icon-uri` so GNOME/Files
# shows the document icon on the project folder (no desktop.ini equivalent).
#
# Both paths are best-effort and must NEVER fail project creation: if the icon
# asset can't be found or the FS refuses the attributes, we just skip.

import logging
import os
import shutil
import subprocess
import sys

log = logging.getLogger("fleshnote.folder_icon")

ICON_FILE = "fleshnote.ico"
ICON_PNG = "fleshnote-project-256.png"

# Candidate locations of resources/icons — dev repo first, then packaged
# layouts (PyInstaller _MEIPASS, electron extraResources, backend dist).
def _icon_candidates():
    names = [ICON_FILE, ICON_PNG]
    here = os.path.dirname(os.path.abspath(__file__))
    yield_from = []
    bases = [
        os.path.join(here, os.pardir, os.pardir, "resources", "icons"),  # dev: backend/../..
        os.path.join(here, os.pardir, "resources", "icons"),
        getattr(sys, "_MEIPASS", os.path.join(here, "icons")),
        os.path.join(here, "icons"),
        os.path.join(os.path.dirname(sys.executable), "resources", "icons"),
        os.path.join(os.path.dirname(sys.executable), "icons"),
    ]
    for base in bases:
        for name in names:
            yield_from.append(os.path.join(base, name))
    return yield_from


def _find_icon(want_ico=True):
    for path in _icon_candidates():
        name = os.path.basename(path)
        is_ico = name.endswith(".ico")
        if (want_ico and is_ico) or (not want_ico and not is_ico):
            if os.path.isfile(path):
                return path
    return None


def apply_folder_icon(project_dir: str) -> None:
    """Best-effort folder icon, Windows + Linux. Never raises."""
    try:
        if sys.platform == "win32":
            _windows_icon(project_dir)
        else:
            _linux_icon(project_dir)
    except Exception as exc:  # cosmetic only — swallow everything
        log.debug("folder icon skipped for %s: %s", project_dir, exc)


def _windows_icon(project_dir: str) -> None:
    ico_src = _find_icon(want_ico=True)
    if not ico_src:
        log.debug("fleshnote.ico not found — desktop.ini skipped")
        return
    ico_dst = os.path.join(project_dir, ".fleshnote.ico")
    if not os.path.isfile(ico_dst):
        shutil.copyfile(ico_src, ico_dst)

    # IconResource needs an absolute path; the copy travels with the folder
    # but a moved project just silently falls back to the generic folder icon.
    ini = os.path.join(project_dir, "desktop.ini")
    content = "[.ShellClassInfo]\r\nIconResource={},0\r\n".format(
        os.path.join(project_dir, ".fleshnote.ico"))
    with open(ini, "w", encoding="utf-8") as f:
        f.write(content)

    FILE_ATTRIBUTE_HIDDEN = 0x2
    FILE_ATTRIBUTE_SYSTEM = 0x4
    FILE_ATTRIBUTE_READONLY = 0x1
    # desktop.ini must be hidden+system for Explorer to honor it; the folder
    # gets ReadOnly (the documented switch that enables per-folder desktop.ini).
    os.chmod(ini, FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM)
    os.chmod(project_dir, FILE_ATTRIBUTE_READONLY)


def _linux_icon(project_dir: str) -> None:
    png_src = _find_icon(want_ico=False)
    if not png_src:
        return
    if shutil.which("gio"):
        subprocess.run(
            ["gio", "set", project_dir, "metadata::custom-icon-uri",
             "file://" + png_src],
            check=False, capture_output=True, timeout=5)

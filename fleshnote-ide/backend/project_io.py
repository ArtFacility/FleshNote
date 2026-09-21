"""
FleshNote — Project file-level I/O utilities
============================================

On-disk layout (v2.1+): every project is an extensioned folder so it behaves
like a single file for non-technical users:

    MyNovel.flnote/
        fleshnote.db            (SQLite, WAL mode)
        fleshnote_project.json  (descriptor)
        md/                     (chapter markdown)
        assets/                 (reference images)

Transport / share format: a single ZIP named `MyNovel.flnote` containing the
same tree (either at the archive root or nested under one root folder).

This module centralizes everything that touches those bytes:
- `.flnote` naming (sanitize / display / next free path)
- consistent SQLite snapshots (backup API — safe against live WAL)
- hardened ZIP creation and extraction (zip-slip, bombs, symlinks, allowlist)

Security reviewers' rules baked in here:
- NEVER zip or copy a live `fleshnote.db` directly — always snapshot via the
  SQLite backup API first (a raw file copy can capture a torn WAL state).
- NEVER trust archive member paths: validate, cap, allowlist, extract manually.
"""

import os
import re
import shutil
import sqlite3
import tempfile
import zipfile
import unicodedata

PROJECT_EXT = ".flnote"

# Contents every valid FleshNote archive must carry / may carry — nothing else
# gets extracted (junk like desktop.ini/Thumbs.db is silently skipped).
ALLOWED_TOP_FILES = {"fleshnote.db", "fleshnote_project.json"}
ALLOWED_TOP_DIRS = {"md", "assets"}
JUNK_NAMES = {"desktop.ini", "thumbs.db", ".ds_store", "fleshnote.db.bak"}

# Extraction caps (both compressed upload caps and these uncompressed caps are
# enforced — a 20 MB compressed zip bomb can expand to many GB otherwise).
MAX_ARCHIVE_FILES = 5000
MAX_ARCHIVE_UNCOMPRESSED = 512 * 1024 * 1024   # 512 MB total
MAX_ARCHIVE_SINGLE_FILE = 256 * 1024 * 1024    # 256 MB per file


# ── .flnote naming ──────────────────────────────────────────────────────────

def sanitize_project_name(name: str) -> str:
    """Make a user-supplied project name safe as a folder name on Windows/macOS/Linux.
    Strips an existing .flnote suffix so 'Foo.flnote' never becomes 'Foo.flnote.flnote'."""
    name = display_name(str(name or "").strip())
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name)
    name = re.sub(r"\s+", " ", name).strip()
    # Windows forbids names ending in a dot or space (silently truncates them).
    name = name.rstrip(". ")
    return name or "Untitled"


def display_name(folder_name: str) -> str:
    """Folder name -> human project name ('MyNovel.flnote' -> 'MyNovel')."""
    base = str(folder_name or "")
    if base.lower().endswith(PROJECT_EXT):
        base = base[: -len(PROJECT_EXT)]
    return base


def with_ext(project_name: str) -> str:
    """Human project name -> folder name ('MyNovel' -> 'MyNovel.flnote')."""
    return sanitize_project_name(project_name) + PROJECT_EXT


def next_available_project_dir(workspace_path: str, base_name: str) -> str:
    """First non-colliding '{name}.flnote' path in the workspace."""
    folder = with_ext(base_name)
    stem = display_name(folder)
    target = os.path.join(workspace_path, folder)
    i = 2
    while os.path.exists(target):
        target = os.path.join(workspace_path, f"{stem} ({i}){PROJECT_EXT}")
        i += 1
    return target


def is_fleshnote_project(dir_path: str) -> bool:
    """Marker-based detection (independent of the folder's name/extension)."""
    return os.path.isdir(dir_path) and (
        os.path.exists(os.path.join(dir_path, "fleshnote.db"))
        or os.path.exists(os.path.join(dir_path, "fleshnote_project.json"))
    )


def is_legacy_folder(dir_path: str) -> bool:
    """True if it's a valid project folder without the .flnote suffix."""
    return is_fleshnote_project(dir_path) and not os.path.basename(dir_path).lower().endswith(PROJECT_EXT)


# ── consistent SQLite snapshots (the WAL fix) ────────────────────────────────

def snapshot_db(project_path: str) -> str:
    """Return a path to a consistent temp-file snapshot of the project's
    fleshnote.db, using SQLite's backup API (WAL-aware, no torn state).
    Caller must os.remove() the returned file when done."""
    src = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(src):
        raise FileNotFoundError(f"Database not found: {src}")
    fd, tmp = tempfile.mkstemp(prefix="fleshnote_db_", suffix=".db")
    os.close(fd)
    try:
        os.remove(tmp)  # backup() needs a non-existent or empty target file
    except OSError:
        pass
    src_conn = sqlite3.connect(src)
    dst_conn = sqlite3.connect(tmp)
    try:
        src_conn.backup(dst_conn)
        dst_conn.commit()
    finally:
        dst_conn.close()
        src_conn.close()
    return tmp


def backup_db_file(project_path: str, backup_path: str) -> None:
    """Consistent {project_path}/fleshnote.db -> backup_path (snapshot copy).
    Use for .bak files before migrations / sync apply."""
    tmp = snapshot_db(project_path)
    try:
        shutil.move(tmp, backup_path)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def restore_db_file(project_path: str, backup_path: str) -> None:
    """Restore a backup over the live db — purges stale -wal/-shm files first,
    otherwise a leftover WAL can resurrect a torn state."""
    db_path = os.path.join(project_path, "fleshnote.db")
    for suffix in ("-wal", "-shm"):
        stale = db_path + suffix
        if os.path.exists(stale):
            try:
                os.remove(stale)
            except OSError:
                pass
    shutil.copy2(backup_path, db_path)


# ── archive creation ────────────────────────────────────────────────────────

def _zip_walk_files(project_path: str):
    """Yield (abs_path, rel_archive_name) for every file that travels in a
    .flnote archive: descriptor, snapshot-safe db, md/, assets/. Skips junk."""
    yield os.path.join(project_path, "fleshnote_project.json"), "fleshnote_project.json"
    for sub in ("md", "assets"):
        sub_dir = os.path.join(project_path, sub)
        if not os.path.isdir(sub_dir):
            continue
        for root, _dirs, files in os.walk(sub_dir):
            for fname in files:
                if fname.lower() in JUNK_NAMES or fname.lower().endswith(".bak"):
                    continue
                full = os.path.join(root, fname)
                yield full, os.path.relpath(full, project_path).replace(os.sep, "/")


def zip_project(project_path: str, dest_zip_path: str) -> str:
    """Write the project as a single-file .flnote ZIP to dest_zip_path.
    The db is snapshotted via the backup API first — never zip a live WAL db."""
    os.makedirs(os.path.dirname(dest_zip_path) or ".", exist_ok=True)
    db_path = os.path.join(project_path, "fleshnote.db")
    snapshot_tmp = snapshot_db(project_path) if os.path.exists(db_path) else None
    try:
        with zipfile.ZipFile(dest_zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            if snapshot_tmp and os.path.isfile(snapshot_tmp):
                zf.write(snapshot_tmp, "fleshnote.db")
            for full, rel in _zip_walk_files(project_path):
                if os.path.isfile(full):
                    zf.write(full, rel)
    finally:
        if snapshot_tmp and os.path.exists(snapshot_tmp):
            try:
                os.remove(snapshot_tmp)
            except OSError:
                pass
    return dest_zip_path


# ── hardened archive extraction ─────────────────────────────────────────────

def _member_type_ok(info: zipfile.ZipInfo) -> bool:
    """Reject symlinks/hardlinks/fifos/devices. Entries without POSIX type bits
    (Windows zip tools often store 0, or permission bits only) are treated as
    regular files — zipfile cannot materialize real symlinks without the
    symlink type bit anyway."""
    mode = info.external_attr >> 16
    ftype = mode & 0o170000
    return ftype in (0, 0o100000, 0o40000)


def validate_archive(zf: zipfile.ZipFile, allowlist: bool = True):
    """Validate every member of an open .flnote archive. Returns the extraction
    plan: list of (ZipInfo, normalized_arcname). Raises ValueError on anything
    unsafe: path escapes, bombs, symlinks, duplicates, unexpected entries."""
    infos = [i for i in zf.infolist() if not i.is_dir()]
    if len(infos) > MAX_ARCHIVE_FILES:
        raise ValueError("Archive contains too many files")

    # Optional single root folder ('MyNovel.flnote/…') — strip it so both
    # archive shapes (root-level and nested) normalize to the same tree.
    firsts = set()
    for i in infos:
        firsts.add(i.filename.replace("\\", "/").split("/", 1)[0])
    root_prefix = ""
    if len(firsts) == 1:
        only = next(iter(firsts))
        if (only not in ALLOWED_TOP_FILES and only not in ALLOWED_TOP_DIRS
                and only not in JUNK_NAMES and only.endswith(PROJECT_EXT)):
            root_prefix = only + "/"

    plan = []
    seen = set()
    total = 0
    for info in infos:
        name = info.filename.replace("\\", "/")
        if not name or name.startswith("/") or "\x00" in name:
            raise ValueError(f"Unsafe path in archive: {info.filename}")
        parts = name.split("/")
        if any(p == ".." for p in parts):
            raise ValueError(f"Unsafe path in archive: {info.filename}")
        drive = parts[0]
        if len(drive) >= 2 and drive[1] == ":":
            raise ValueError(f"Absolute path in archive: {info.filename}")
        if not _member_type_ok(info):
            raise ValueError(f"Unsupported file type in archive: {info.filename}")

        arcname = name[len(root_prefix):] if root_prefix and name.startswith(root_prefix) else name
        top = arcname.split("/", 1)[0]
        if allowlist:
            base = top.lower()
            if base in JUNK_NAMES or base.endswith(".bak"):
                continue  # junk travels sometimes; skip silently
            if top not in ALLOWED_TOP_FILES and top not in ALLOWED_TOP_DIRS:
                raise ValueError(f"Unexpected content in archive: {info.filename}")

        arcname = unicodedata.normalize("NFC", arcname)
        if arcname in seen:
            raise ValueError(f"Duplicate entry in archive: {arcname}")
        seen.add(arcname)

        total += info.file_size
        if total > MAX_ARCHIVE_UNCOMPRESSED:
            raise ValueError("Archive expands beyond the size limit (possible zip bomb)")
        if info.file_size > MAX_ARCHIVE_SINGLE_FILE:
            raise ValueError(f"Single file too large in archive: {info.filename}")
        plan.append((info, arcname))
    return plan


def safe_extract_zip(zip_path: str, dest_dir: str, allowlist: bool = True) -> str:
    """Extract a .flnote archive into dest_dir with full validation.
    Returns dest_dir. Raises ValueError on any unsafe content."""
    dest_dir = os.path.realpath(dest_dir)
    os.makedirs(dest_dir, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        plan = validate_archive(zf, allowlist=allowlist)
        for info, arcname in plan:
            target = os.path.realpath(os.path.join(dest_dir, arcname))
            if target != dest_dir and not target.startswith(dest_dir + os.sep):
                raise ValueError(f"Unsafe path in archive: {info.filename}")
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with zf.open(info) as src, open(target, "wb") as out:
                shutil.copyfileobj(src, out, length=1024 * 1024)
    return dest_dir

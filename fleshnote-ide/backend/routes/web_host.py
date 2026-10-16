"""
Web host: what Electron's main process does for the desktop app, for the browser build
(Seneschal Labs, src/web). Mounted only by web_main.py, never by main.py, so the desktop
backend and its frozen build don't have these routes.

Everything lives under one root folder (FLESHNOTE_WEB_ROOT):

    workspace/   the projects (the browser build has this one workspace)
    uploads/     files the browser sent (imports, review files, images), one folder each
    exports/     what an export wrote, for the browser to download
    reviews/     the review store (Electron keeps it in userData)
    Tutorial/    the bundled tutorial, copied on first use
    global_config.json

A demo copy (FLESHNOTE_WEB_DEMO=1, for guests invited on Labs) can be wiped back to empty with
/api/web/reset, by the Labs device only: it sends X-Labs-Admin, which the device strips from
every request it passes on from the site. The process then exits, and systemd starts it fresh.

Files are only read, served or deleted inside the root; paths are resolved first, so a
symlink pointing out of it doesn't count as inside.
"""
import base64
import json
import os
import re
import shutil
import tempfile
import threading
import uuid
import zipfile

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

MAX_UPLOAD = 500 * 1024 * 1024
COVER_IMAGE = re.compile(r"^assets/cover/(?:img|front|spine)_[0-9a-f]{12}\.(png|jpe?g|webp|gif|bmp)$")
TUTORIAL_SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Tutorial")


class ConfigRequest(BaseModel):
    update: dict | None = None


class ProjectPathRequest(BaseModel):
    project_path: str


class AssetDeleteRequest(BaseModel):
    project_path: str
    image_path: str


class CoverReadRequest(BaseModel):
    project_path: str
    path: str


# What a reset removes: everything the app wrote, but not the Python environment and models
# ./run keeps in the same folder (venv, python, uv, cache, .config).
RESET_NAMES = ("workspace", "uploads", "exports", "reviews", "Tutorial", "global_config.json")


def make_router(root: str, demo: bool = False, exit_after_reset=lambda: os._exit(3)) -> APIRouter:
    root = os.path.realpath(root)
    dirs = {name: os.path.join(root, name) for name in ("workspace", "uploads", "exports", "reviews")}
    for d in dirs.values():
        os.makedirs(d, exist_ok=True)
    config_path = os.path.join(root, "global_config.json")
    router = APIRouter()

    def inside(path: str, base: str = root) -> str | None:
        """The resolved path when it is base or under it, else None."""
        if not path:
            return None
        real = os.path.realpath(path)
        return real if real == base or real.startswith(base + os.sep) else None

    @router.post("/api/web/info")
    def info():
        return {**dirs, "root": root}

    @router.post("/api/web/config")
    def config(req: ConfigRequest):
        current = {}
        if os.path.exists(config_path):
            with open(config_path, encoding="utf-8") as f:
                current = json.load(f)
        if req.update:
            current.update(req.update)
            tmp = config_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(current, f, indent=2)
            os.replace(tmp, config_path)
        return current

    def clean(name: str) -> str:
        return re.sub(r"[^\w.\- ]", "_", name)[:120].strip(" .") or "file"

    @router.post("/api/web/upload")
    async def upload(file: UploadFile = File(...), batch: str | None = Form(None), relpath: str | None = Form(None)):
        """One file, in a folder of its own; or, with batch and relpath, one file of a picked
        folder, kept at its place in that folder (uploads/<batch>/<relpath>)."""
        if batch:
            if not re.fullmatch(r"[0-9a-z]{4,32}", batch):
                raise HTTPException(400, "Bad batch")
            parts = [clean(p) for p in (relpath or file.filename or "file").replace("\\", "/").split("/") if p not in ("", ".", "..")]
            folder = os.path.join(dirs["uploads"], batch, *parts[:-1]) if parts else os.path.join(dirs["uploads"], batch)
            name = parts[-1] if parts else "file"
        else:
            name = clean(os.path.basename((file.filename or "file").replace("\\", "/")))
            folder = os.path.join(dirs["uploads"], uuid.uuid4().hex[:12])
        os.makedirs(folder, exist_ok=True)
        dest = os.path.join(folder, name)
        size = 0
        with open(dest, "wb") as out:
            while chunk := await file.read(1 << 20):
                size += len(chunk)
                if size > MAX_UPLOAD:
                    out.close()
                    os.unlink(dest)
                    raise HTTPException(413, "File too large")
                out.write(chunk)
        return {"path": dest}

    @router.post("/api/web/export-dir")
    def export_dir():
        """A new empty folder under exports/, for an export that writes a folder of its own."""
        path = os.path.join(dirs["exports"], uuid.uuid4().hex[:12])
        os.makedirs(path)
        return {"path": path}

    @router.get("/api/web/file")
    def file(p: str, download: int = 0):
        """A file under the root: images inline, anything else as a download. A folder
        (an Obsidian vault export) comes as a zip. The renderer's image URLs end in ?v=<time>
        (a cache breaker), which arrives here as part of p."""
        real = inside(p)
        if (real is None or not os.path.exists(real)) and "?" in p:
            real = inside(p.split("?", 1)[0])
        if real is None or not os.path.exists(real):
            raise HTTPException(404, "Not found")
        if os.path.isdir(real):
            if inside(real, dirs["exports"]) is None:
                raise HTTPException(404, "Not found")
            fd, zip_path = tempfile.mkstemp(suffix=".zip", dir=dirs["exports"])
            os.close(fd)
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
                for folder, _, files in os.walk(real):
                    for f in files:
                        full = os.path.join(folder, f)
                        z.write(full, os.path.relpath(full, real))
            return FileResponse(zip_path, filename=os.path.basename(real) + ".zip",
                                headers={"Cache-Control": "no-store"})
        if download:
            return FileResponse(real, filename=os.path.basename(real), headers={"Cache-Control": "no-store"})
        return FileResponse(real, headers={"Cache-Control": "no-cache"})

    @router.post("/api/web/tutorial")
    def tutorial():
        dest = os.path.join(root, "Tutorial")
        if not os.path.exists(dest):
            shutil.copytree(TUTORIAL_SRC, dest, ignore=shutil.ignore_patterns("*.db-shm", "*.db-wal"))
        return {"path": dest, "migrate": not os.path.exists(os.path.join(dest, "fleshnote_project.json"))}

    @router.post("/api/web/project/delete")
    def delete_project(req: ProjectPathRequest):
        real = inside(req.project_path, dirs["workspace"])
        if real is None or real == dirs["workspace"]:
            return {"status": "error", "msg": "Only projects in the workspace can be deleted"}
        if not os.path.isdir(real):
            return {"status": "error", "msg": "Project not found on disk"}
        shutil.rmtree(real)
        return {"status": "ok"}

    @router.post("/api/web/asset/delete")
    def delete_asset(req: AssetDeleteRequest):
        real = inside(os.path.join(req.project_path, req.image_path))
        if real is None or "/assets/" not in real.replace("\\", "/"):
            return {"status": "error", "msg": "Invalid path"}
        if not os.path.isfile(real):
            return {"status": "error", "msg": "File not found"}
        os.unlink(real)
        return {"status": "ok"}

    @router.post("/api/web/cover/read")
    def cover_read(req: CoverReadRequest):
        m = COVER_IMAGE.match(req.path or "")
        if not m:
            return None
        full = os.path.join(req.project_path, *req.path.split("/"))
        if inside(full) is None or not os.path.isfile(full) or os.path.islink(full):
            return None
        ext = "jpeg" if m.group(1) == "jpg" else m.group(1)
        with open(full, "rb") as f:
            return {"mime": f"image/{ext}", "data": base64.b64encode(f.read()).decode("ascii")}

    @router.post("/api/web/reset")
    def reset(x_labs_admin: str | None = Header(None)):
        if not demo or x_labs_admin != "reset":
            raise HTTPException(404, "Not found")
        for name in RESET_NAMES:
            p = os.path.join(root, name)
            if os.path.isdir(p):
                shutil.rmtree(p, ignore_errors=True)
            elif os.path.exists(p):
                os.unlink(p)
        for d in dirs.values():
            os.makedirs(d, exist_ok=True)
        # Open databases and caches go with the process; systemd starts it again (Restart=on-failure).
        threading.Timer(0.5, exit_after_reset).start()
        return {"status": "ok"}

    return router

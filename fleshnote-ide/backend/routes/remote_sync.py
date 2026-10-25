"""
FleshNote API — Remote (QR/LAN) Sync Routes

Loopback-only routes, called by the Electron main process. These start/stop
a pairing session and drive preview/apply — the actual diff/merge is the
existing routes/sync.py engine, run unchanged against a temp folder holding
the phone's uploaded project (see remote_sync_session.py for the transport).
"""

import json
import os
from typing import Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import remote_sync_session as rss

router = APIRouter()


class RemoteSyncStartRequest(BaseModel):
    project_path: str


class CloneSendStartRequest(BaseModel):
    project_path: str


class CloneReceiveStartRequest(BaseModel):
    workspace_path: str


class RemoteSyncTokenRequest(BaseModel):
    token: str


class RemoteSyncApplyRequest(BaseModel):
    token: str
    resolutions: Dict[str, str]


def _project_id_and_name(project_path: str):
    json_path = os.path.join(project_path, "fleshnote_project.json")
    if not os.path.exists(json_path):
        raise HTTPException(status_code=400, detail="Missing fleshnote_project.json")
    with open(json_path, encoding="utf-8") as f:
        meta = json.load(f)
    project_id = meta.get("project_id")
    if not project_id:
        raise HTTPException(status_code=400, detail="Project has no project_id")
    return project_id, meta.get("project_name", "Untitled")


def _require_session(token: str) -> "rss.RemoteSyncSession":
    session = rss.get_session()
    if not session or session.token != token:
        raise HTTPException(status_code=404, detail="No active sync session")
    return session


@router.post("/api/project/remote-sync/start")
def remote_sync_start(req: RemoteSyncStartRequest):
    project_id, project_name = _project_id_and_name(req.project_path)
    return rss.start_session(req.project_path, project_id, project_name)


@router.post("/api/project/remote-sync/clone-send/start")
def clone_send_start(req: CloneSendStartRequest):
    """Serve this whole project to a fresh phone (desktop -> phone clone)."""
    project_id, project_name = _project_id_and_name(req.project_path)
    return rss.start_session(req.project_path, project_id, project_name, mode="clone_send")


@router.post("/api/project/remote-sync/clone-receive/start")
def clone_receive_start(req: CloneReceiveStartRequest):
    """Receive a whole project from a phone into the workspace (phone -> desktop clone)."""
    return rss.start_session(None, "", "Incoming project",
                             mode="clone_receive", workspace_path=req.workspace_path)


@router.post("/api/project/remote-sync/status")
def remote_sync_status(req: RemoteSyncTokenRequest):
    session = _require_session(req.token)
    return {
        "status": session.status,
        "error": session.error_message,
        "mode": session.mode,
        "cloned_project_path": session.cloned_project_path,
        "summary": (session.preview or {}).get("summary"),
    }


@router.post("/api/project/remote-sync/preview")
def remote_sync_preview(req: RemoteSyncTokenRequest):
    session = _require_session(req.token)
    if session.status != "ready" or not session.preview:
        raise HTTPException(status_code=409, detail=f"Preview not ready (status={session.status})")
    return session.preview


@router.post("/api/project/remote-sync/apply")
def remote_sync_apply(req: RemoteSyncApplyRequest):
    session = _require_session(req.token)
    if session.status != "ready":
        raise HTTPException(status_code=409, detail=f"Not ready to apply (status={session.status})")

    from routes.sync import sync_apply, SyncApplyRequest

    session.status = "applying"
    try:
        result = sync_apply(SyncApplyRequest(
            local_path=session.project_path,
            remote_path=session.remote_tmp_dir,
            resolutions=req.resolutions,
        ))
    except HTTPException as e:
        session.touch_error(str(e.detail))
        raise

    # Package the now-merged desktop project so the phone can pull it down as
    # ITS remote_path (see the download-back contract note in remote_sync_session.py).
    session.download_zip_path = rss._zip_project(session.project_path)
    session.status = "applied"
    return result


@router.post("/api/project/remote-sync/cancel")
def remote_sync_cancel(req: RemoteSyncTokenRequest):
    return rss.cancel_session(req.token)

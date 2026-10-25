"""Project vault export routes — Obsidian-ready Markdown or plain-text folder."""

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from export.vault import export_vault

router = APIRouter()


class VaultExportRequest(BaseModel):
    project_path: str
    dest_dir: str              # parent folder; backend names the vault folder itself
    fmt: str = "obsidian"      # 'obsidian' | 'txt'


@router.post("/api/project/export-vault")
def export_vault_route(request: VaultExportRequest):
    if not os.path.exists(os.path.join(request.project_path, "fleshnote.db")):
        raise HTTPException(status_code=404, detail="Database not found in project folder")
    if not os.path.isdir(request.dest_dir):
        raise HTTPException(status_code=400, detail="Destination folder does not exist")
    try:
        final, count = export_vault(request.project_path, request.dest_dir, request.fmt)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Vault export failed: {e}")
    return {"status": "ok", "path": final, "file_count": count}

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os

from export.pipeline import ExportPipeline

router = APIRouter()

class ExportRequest(BaseModel):
    project_path: str
    content_mode: str  # 'prose', 'notes', 'full'
    format: str        # 'txt', 'md', 'html', 'docx', 'pdf', 'epub'
    book_ready: bool = False
    trim: str = "standard"
    font_size: float | None = None
    gutter: float | None = None
    outer: float | None = None
    chapter_ids: list[int] | None = None  # None = export all chapters

@router.post("/api/project/export")
def export_project(request: ExportRequest):
    if not os.path.exists(request.project_path):
        raise HTTPException(status_code=404, detail="Project path not found")

    try:
        pipeline = ExportPipeline(request.project_path)
        overrides = {
            "font_size": request.font_size,
            "gutter": request.gutter,
            "outer": request.outer,
            "trim": request.trim
        }

        filepath, todo_count = pipeline.run(
            content_mode=request.content_mode,
            fmt=request.format,
            book_ready=request.book_ready,
            overrides=overrides,
            chapter_ids=request.chapter_ids
        )

        response = {
            "status": "success",
            "message": "Export completed successfully.",
            "filepath": filepath
        }

        if todo_count > 0:
            response["warnings"] = f"Removed {todo_count} #TODO tag(s) from the exported text."

        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/project/export/preview")
def export_preview(request: ExportRequest):
    if not os.path.exists(request.project_path):
        raise HTTPException(status_code=404, detail="Project path not found")

    try:
        pipeline = ExportPipeline(request.project_path)
        overrides = {
            "font_size": request.font_size,
            "gutter": request.gutter,
            "outer": request.outer,
            "trim": request.trim
        }

        html_preview = pipeline.get_preview(
            content_mode=request.content_mode,
            fmt=request.format,
            overrides=overrides,
            chapter_ids=request.chapter_ids
        )

        return {
            "status": "success",
            "html": html_preview
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

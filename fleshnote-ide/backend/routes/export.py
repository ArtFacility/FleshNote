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
    chapter_ids: list[str | int] | None = None  # None = export all chapters


def _overrides(request: ExportRequest) -> dict:
    return {"font_size": request.font_size, "gutter": request.gutter,
            "outer": request.outer, "trim": request.trim}


@router.post("/api/project/export")
def export_project(request: ExportRequest):
    """Writes the export into the project's exports folder.

    For a PDF nothing is written: the response has status "print", the print
    document in "html" and the target "filepath", and the app prints it."""
    if not os.path.exists(request.project_path):
        raise HTTPException(status_code=404, detail="Project path not found")

    try:
        pipeline = ExportPipeline(request.project_path)
        filepath, todo_count, print_html = pipeline.run(
            content_mode=request.content_mode,
            fmt=request.format,
            book_ready=request.book_ready,
            overrides=_overrides(request),
            chapter_ids=request.chapter_ids
        )
        response = {
            "status": "print" if print_html is not None else "success",
            "message": "Export completed successfully.",
            "filepath": filepath
        }
        if print_html is not None:
            response["html"] = print_html
        if todo_count > 0:
            response["warnings"] = f"Removed {todo_count} #TODO tag(s) from the exported text."
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/project/export/print-preview")
def export_print_preview(request: ExportRequest):
    """The PDF print document for the export window's page view; nothing is written."""
    if not os.path.exists(request.project_path):
        raise HTTPException(status_code=404, detail="Project path not found")
    try:
        pipeline = ExportPipeline(request.project_path)
        html = pipeline.print_document(request.content_mode, request.book_ready,
                                       _overrides(request), request.chapter_ids)
        return {"status": "success", "html": html}
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
        html_preview = pipeline.get_preview(
            content_mode=request.content_mode,
            fmt=request.format,
            overrides=_overrides(request),
            chapter_ids=request.chapter_ids,
            book_ready=request.book_ready,
        )
        return {
            "status": "success",
            "html": html_preview
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

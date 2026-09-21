import hashlib
import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

FORMAT = "fleshnote-review/1"
ENTITY_MARKER_RE = re.compile(
    r"\{\{(?:char|loc|item|lore|group|quicknote|annotation):([^|]+)\|([^}]+)\}\}"
)

SECRET_FIELDS = {
    "char": {"true_goal", "bio"},
    "loc": set(),
    "lore": {"origin"},
    "group": {"true_agenda", "philosophy", "internal_rules"},
}
PUBLIC_FIELDS = {
    "char": {"role", "status", "species", "surface_goal"},
    "loc": {"region", "description"},
    "lore": {"category", "classification", "description", "rules", "limitations"},
    "group": {"group_type", "description", "surface_agenda"},
}

NOTE_CATEGORIES = {"typo", "rewrite", "remove", "praise", "question", "comment"}
NOTE_QUOTE_MAX = 600
REANCHOR_MIN = 0.70


class ReviewScope(BaseModel):
    manuscript: bool = True
    entities: bool = False
    with_secrets: bool = False
    plot: bool = False
    chapter_ids: list[str] | None = None


class ExportReviewRequest(BaseModel):
    project_path: str
    dest_path: str
    scope: ReviewScope = ReviewScope()
    reviewer_label: str = ""


class OpenReviewRequest(BaseModel):
    path: str


class SaveReviewRequest(BaseModel):
    path: str
    package: dict


class CollectReviewRequest(BaseModel):
    project_path: str
    package_paths: list[str]


def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _effective_scope(scope: ReviewScope) -> ReviewScope:
    data = scope.model_dump()
    data["manuscript"] = True
    if not data["entities"]:
        data["with_secrets"] = False
    return ReviewScope(**data)


def _project_meta(project_path: str):
    json_path = os.path.join(project_path, "fleshnote_project.json")
    meta = {}
    if os.path.exists(json_path):
        with open(json_path, encoding="utf-8") as f:
            meta = json.load(f)
    return meta.get("project_id") or "", meta.get("project_name") or "Untitled"


def _read_md(project_path: str, md_filename: str | None) -> str:
    if not md_filename:
        return ""
    path = os.path.join(project_path, "md", md_filename)
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read()


def _parse_aliases(raw) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw if x]
    try:
        val = json.loads(raw)
        if isinstance(val, list):
            return [str(x) for x in val if x]
    except Exception:
        pass
    return []


def _entity_rows(conn, sql: str, typ: str, with_secrets: bool) -> list[dict]:
    try:
        rows = conn.execute(sql).fetchall()
    except sqlite3.OperationalError:
        return []
    secret = SECRET_FIELDS[typ]
    public = PUBLIC_FIELDS[typ]
    out = []
    for row in rows:
        keys = row.keys()
        entity = {"id": "", "type": typ, "name": "", "fields": {}, "aliases": []}
        for col in keys:
            val = row[col]
            if col == "id":
                entity["id"] = str(val or "")
            elif col == "name":
                entity["name"] = str(val or "").strip()
            elif col == "aliases":
                entity["aliases"] = _parse_aliases(val)
            else:
                if col in secret and not with_secrets:
                    continue
                if col not in secret and col not in public:
                    continue
                text = "" if val is None else str(val).strip()
                if text:
                    entity["fields"][col] = text
        if entity["id"] and entity["name"]:
            if not entity["fields"]:
                entity.pop("fields")
            if not entity["aliases"]:
                entity.pop("aliases")
            out.append(entity)
    return out


def _read_plot(conn) -> dict:
    plot = {"twists": []}
    try:
        twist_rows = conn.execute(
            """SELECT id, title, COALESCE(description,''), COALESCE(twist_type,''), COALESCE(status,'')
               FROM twists WHERE deleted = 0"""
        ).fetchall()
    except sqlite3.OperationalError:
        return plot
    twists = {}
    order = []
    for row in twist_rows:
        tid = row[0]
        twists[tid] = {
            "id": tid,
            "title": row[1] or "",
            "description": row[2] or "",
            "twist_type": row[3] or "",
            "status": row[4] or "",
            "foreshadowing": [],
        }
        order.append(tid)
    try:
        fs_rows = conn.execute(
            """SELECT twist_id, COALESCE(chapter_id,''), COALESCE(selected_text,'')
               FROM foreshadowings WHERE deleted = 0"""
        ).fetchall()
        for twist_id, chapter_id, text in fs_rows:
            if twist_id in twists:
                twists[twist_id]["foreshadowing"].append(
                    {"chapter_id": chapter_id, "selected_text": text}
                )
    except sqlite3.OperationalError:
        pass
    plot["twists"] = [twists[i] for i in order]
    return plot


def build_snapshot(project_path: str, scope: ReviewScope) -> dict:
    scope = _effective_scope(scope)
    desktop_id, title = _project_meta(project_path)
    conn = _get_db(project_path)
    try:
        chapters = conn.execute(
            """SELECT id, chapter_number, title, word_count, md_filename
               FROM chapters WHERE deleted = 0 ORDER BY chapter_number ASC"""
        ).fetchall()
        want = None
        if scope.chapter_ids:
            want = set(str(x) for x in scope.chapter_ids)
        snap_chapters = []
        checkpoints = []
        for ch in chapters:
            cid = str(ch["id"])
            if want is not None and cid not in want:
                continue
            text = _read_md(project_path, ch["md_filename"])
            if not scope.entities:
                text = ENTITY_MARKER_RE.sub(r"\2", text)
            digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
            snap_chapters.append({
                "id": cid,
                "number": ch["chapter_number"] or 0,
                "title": ch["title"] or "",
                "word_count": ch["word_count"] or 0,
                "text_md": text,
            })
            checkpoints.append({"chapter_id": cid, "sha256": digest})

        snap = {
            "version": 1,
            "project": {"desktop_id": desktop_id, "title": title},
            "scope": {
                "manuscript": True,
                "entities": scope.entities,
                "with_secrets": scope.with_secrets,
                "plot": scope.plot,
                "chapter_ids": list(scope.chapter_ids or []),
            },
            "chapters": snap_chapters,
            "checkpoints": {
                "captured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "chapters": checkpoints,
            },
        }
        if scope.entities:
            snap["entities"] = {
                "characters": _entity_rows(conn, "SELECT * FROM characters WHERE deleted = 0", "char", scope.with_secrets),
                "locations": _entity_rows(conn, "SELECT * FROM locations WHERE deleted = 0", "loc", scope.with_secrets),
                "lore": _entity_rows(conn, "SELECT * FROM lore_entities WHERE deleted = 0", "lore", scope.with_secrets),
                "groups": _entity_rows(conn, "SELECT * FROM groups WHERE deleted = 0", "group", scope.with_secrets),
            }
        if scope.plot:
            snap["plot"] = _read_plot(conn)
        return snap
    finally:
        conn.close()


def empty_package(snapshot: dict, reviewer_label: str = "") -> dict:
    return {
        "format": FORMAT,
        "crypto": None,
        "reviewer_label": reviewer_label or "",
        "snapshot": snapshot,
        "notes": [],
        "scores": [],
        "published": False,
    }


def load_package(path: str) -> dict:
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Review file not found")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("format") != FORMAT:
        raise HTTPException(status_code=400, detail="Not a fleshnote-review/1 file")
    return data


def save_package(path: str, package: dict):
    package["format"] = FORMAT
    if "crypto" not in package:
        package["crypto"] = None
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(package, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _utf16_units(s: str) -> list[int]:
    raw = s.encode("utf-16-le")
    return [raw[i] | (raw[i + 1] << 8) for i in range(0, len(raw), 2)]


def _u16_index_of(hay: list[int], needle: list[int]) -> int:
    n = len(needle)
    if n == 0 or n > len(hay):
        return -1
    for i in range(0, len(hay) - n + 1):
        if hay[i:i + n] == needle:
            return i
    return -1


def _u16_similarity(a: list[int], b: list[int], min_ratio: float) -> float:
    if len(a) != len(b) or not b:
        return 0.0
    max_dist = int((1 - min_ratio) * len(b))
    if a == b:
        return 1.0
    prev = list(range(len(b) + 1))
    curr = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        curr[0] = i
        row_min = curr[0]
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            v = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
            curr[j] = v
            if v < row_min:
                row_min = v
        if row_min > max_dist:
            return 0.0
        prev, curr = curr, prev
    d = prev[len(b)]
    if d > max_dist:
        return 0.0
    return 1 - d / len(b)


def reanchor_quote(text: str, quote: str):
    t = _utf16_units(text)
    q = _utf16_units(quote)
    if not q or len(q) > NOTE_QUOTE_MAX or len(t) < len(q):
        return None
    i = _u16_index_of(t, q)
    if i >= 0:
        return {"start": i, "end": i + len(q), "ratio": 1.0}
    step = max(1, len(q) // 8)
    best = {"start": 0, "end": 0, "ratio": 0.0}
    for i in range(0, len(t) - len(q) + 1, step):
        r = _u16_similarity(t[i:i + len(q)], q, REANCHOR_MIN)
        if r > best["ratio"]:
            best = {"start": i, "end": i + len(q), "ratio": r}
            if r == 1:
                break
    if best["ratio"] >= REANCHOR_MIN:
        return best
    return None


def _chapter_index(snap: dict) -> dict:
    shas = {c["chapter_id"]: c["sha256"] for c in (snap.get("checkpoints") or {}).get("chapters") or []}
    out = {}
    for ch in snap.get("chapters") or []:
        out[ch["id"]] = {"sha": shas.get(ch["id"], ""), "text": ch.get("text_md") or ""}
    return out


def migrate_notes(notes: list, prev_snap: dict, next_snap: dict):
    prev_idx = _chapter_index(prev_snap)
    next_idx = _chapter_index(next_snap)
    carried, dropped = [], []
    for n in notes or []:
        cid = n.get("chapter_id")
        p = prev_idx.get(cid)
        nx = next_idx.get(cid)
        if not p or not nx:
            dropped.append(n)
            continue
        if p["sha"] == nx["sha"] and nx["sha"]:
            carried.append(n)
            continue
        res = reanchor_quote(nx["text"], n.get("anchor_quote") or "")
        if res:
            nn = dict(n)
            nn["anchor_start"] = res["start"]
            nn["anchor_end"] = res["end"]
            carried.append(nn)
        else:
            dropped.append(n)
    return carried, dropped


@router.post("/api/review/export")
def export_review(req: ExportReviewRequest):
    if not os.path.exists(req.project_path):
        raise HTTPException(status_code=404, detail="Project path not found")
    snap = build_snapshot(req.project_path, req.scope)
    pkg = empty_package(snap, req.reviewer_label)
    save_package(req.dest_path, pkg)
    return {"status": "ok", "path": req.dest_path}


@router.post("/api/review/open")
def open_review(req: OpenReviewRequest):
    pkg = load_package(req.path)
    return {"status": "ok", "path": req.path, "package": pkg}


@router.post("/api/review/save")
def save_review(req: SaveReviewRequest):
    notes = req.package.get("notes") or []
    for n in notes:
        if n.get("category") not in NOTE_CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid note category")
        if not n.get("id"):
            n["id"] = str(uuid.uuid4())
        body = n.get("body") or ""
        if len(body) > 4000:
            n["body"] = body[:4000]
    save_package(req.path, req.package)
    return {"status": "ok", "path": req.path}


@router.post("/api/review/collect")
def collect_reviews(req: CollectReviewRequest):
    if not os.path.exists(req.project_path):
        raise HTTPException(status_code=404, detail="Project path not found")
    live = build_snapshot(req.project_path, ReviewScope(manuscript=True, entities=True, plot=True))
    live_id = live["project"]["desktop_id"]
    reviews = []
    dropped_total = 0
    for path in req.package_paths:
        pkg = load_package(path)
        snap = pkg.get("snapshot") or {}
        pkg_id = (snap.get("project") or {}).get("desktop_id")
        if live_id and pkg_id and pkg_id != live_id:
            raise HTTPException(
                status_code=400,
                detail=f"Review file does not belong to this project: {os.path.basename(path)}",
            )
        carried, dropped = migrate_notes(pkg.get("notes") or [], snap, live)
        dropped_total += len(dropped)
        label = pkg.get("reviewer_label") or os.path.splitext(os.path.basename(path))[0]
        for n in carried:
            n["reviewer_label"] = label
        reviews.append({
            "path": path,
            "label": label,
            "notes": carried,
            "scores": pkg.get("scores") or [],
            "dropped": len(dropped),
        })
    return {
        "status": "ok",
        "snapshot": live,
        "reviews": reviews,
        "dropped": dropped_total,
    }

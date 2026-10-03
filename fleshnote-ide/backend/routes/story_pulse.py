"""
FleshNote — Story Pulse: per-paragraph intensity and valence for the whole
manuscript (plan §5), for the planner's Story Pulse lane.

The features come from the Janitor's paragraph cache (fleshnote_cache.db), so
chapters the writer has opened cost nothing. Paragraphs never analyzed are
parsed within PULSE_BUDGET_S and cached; the rest are returned as pending with
the coverage, and fill in on later calls. There is deliberately no lexical
fallback: intensity is normalized over the whole book, and mixing two scoring
methods on one curve would distort it.
"""

import hashlib
import os
import re
import unicodedata

from fastapi import APIRouter
from pydantic import BaseModel

from project_io import safe_md_path

router = APIRouter()

PULSE_BUDGET_S = 3.0
MIN_WORDS = 4          # shorter blocks ('***', 'Chapter 3', a one-word line) aren't plotted
EXCERPT_CHARS = 140

# Whitespace collapsed by paragraph_key. Spelled out (not \s) so the editor's
# JS copy of the key (pulseGutter.js) matches it character for character.
_KEY_SPACE_RE = re.compile(r"[ \t\n\r\f\v\u00a0\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+")


def paragraph_key(text: str) -> str:
    """Content key the editor's Pulse gutter matches its live paragraphs by:
    sha1 of the NFC text with whitespace collapsed, over UTF-8 bytes."""
    norm = _KEY_SPACE_RE.sub(" ", unicodedata.normalize("NFC", text)).strip()
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()[:20]


# ── Corrections (plan §5.6): the writer's own values for a paragraph ─────────
# Matched to the current text by content key; after an edit the key changes and
# the correction is re-anchored to the most similar nearby paragraph (bounded
# Levenshtein ratio >= REANCHOR_MIN, one correction per paragraph). Short lines
# are never fuzzy-matched ("Yes, I know." is 70% like plenty of other dialogue).
# A correction that finds no paragraph is kept and reported as stale, never
# applied to the wrong text.
REANCHOR_MIN = 0.70
FUZZY_MIN_CHARS = 40
FUZZY_CANDIDATES = 6   # nearest paragraphs (by position) a lost correction is compared with
CORRECTION_TABLE = "paragraph_intensity_corrections"


def similarity(a: str, b: str, min_ratio: float = REANCHOR_MIN) -> float:
    """1 - edit distance / longer length, or 0.0 once it can't reach min_ratio
    (banded DP with an early exit, so unrelated paragraphs cost little)."""
    if a == b:
        return 1.0
    la, lb = len(a), len(b)
    longest = max(la, lb)
    if not longest or min(la, lb) / longest < min_ratio:
        return 0.0
    max_dist = int((1 - min_ratio) * longest)
    prev = list(range(lb + 1))
    for i in range(1, la + 1):
        lo, hi = max(1, i - max_dist), min(lb, i + max_dist)
        curr = [max_dist + 1] * (lb + 1)
        curr[0] = i
        row_min = curr[0] if lo == 1 else max_dist + 1
        ca = a[i - 1]
        for j in range(lo, hi + 1):
            v = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (ca != b[j - 1]))
            curr[j] = v
            if v < row_min:
                row_min = v
        if row_min > max_dist:
            return 0.0
        prev = curr
    d = prev[lb]
    return 0.0 if d > max_dist else 1 - d / longest


def match_corrections(rows: list[dict], keys: list[str], texts: list[str]):
    """One-to-one assignment of a chapter's corrections to its paragraphs.
    Returns ({paragraph index: row}, [(row, index) re-anchored], [stale rows])."""
    by_key: dict[str, list[int]] = {}
    for i, k in enumerate(keys):
        by_key.setdefault(k, []).append(i)
    taken: set[int] = set()
    matched: dict[int, dict] = {}
    rest = []
    for r in rows:  # exact keys first; a repeated text goes to the nearest copy
        cands = [i for i in by_key.get(r["para_hash"], []) if i not in taken]
        if cands:
            i = min(cands, key=lambda c: abs(c - (r["para_idx"] or 0)))
            taken.add(i)
            matched[i] = r
        else:
            rest.append(r)
    pairs = []
    for r in rest:
        anchor = r["anchor_text"] or ""
        if len(anchor) < FUZZY_MIN_CHARS:
            continue
        idx = r["para_idx"] or 0
        free = sorted((i for i in range(len(keys)) if i not in taken), key=lambda c: abs(c - idx))
        for i in free[:FUZZY_CANDIDATES]:
            ratio = similarity(anchor, texts[i])
            if ratio >= REANCHOR_MIN:
                pairs.append((-ratio, abs(i - idx), str(r["id"]), i, r))
    moved, placed = [], set()
    for _, _, rid, i, r in sorted(pairs, key=lambda p: p[:3]):
        if rid in placed or i in taken:
            continue
        placed.add(rid)
        taken.add(i)
        matched[i] = r
        moved.append((r, i))
    stale = [r for r in rest if str(r["id"]) not in placed]
    return matched, moved, stale


def _load_corrections(conn, chapter_id) -> list[dict]:
    rows = conn.execute(
        f"SELECT id, chapter_id, para_hash, para_idx, anchor_text, intensity, valence "
        f"FROM {CORRECTION_TABLE} WHERE chapter_id = ? AND deleted = 0 ORDER BY created_at, id",
        (str(chapter_id),)).fetchall()
    return [dict(r) for r in rows]


def _reanchor(conn, row: dict, key: str, text: str, idx: int) -> bool:
    """Persist a re-anchor. Guarded on the old key, so two overlapping requests
    (the planner lane polls this route) log the move only once."""
    from sync_core import log_change, _now_iso
    cur = conn.cursor()
    now = _now_iso()
    cur.execute(f"UPDATE {CORRECTION_TABLE} SET para_hash = ?, anchor_text = ?, para_idx = ?, updated_at = ? "
                f"WHERE id = ? AND para_hash = ?", (key, text, idx, now, row["id"], row["para_hash"]))
    if cur.rowcount:
        log_change(cur, CORRECTION_TABLE, row["id"],
                   {"para_hash": key, "anchor_text": text, "para_idx": idx, "updated_at": now})
        return True
    return False


class StoryPulseRequest(BaseModel):
    project_path: str
    language: str = "en"
    # True for the editor's gutter: read the paragraph cache only, never parse
    # (parsing costs CPU while the writer types; the Janitor fills the cache)
    cache_only: bool = False


@router.post("/api/project/story-pulse")
def story_pulse(req: StoryPulseRequest):
    import intensity_engine as IE
    from routes.chapters import md_to_editor_html
    from routes.janitor import _get_db
    from routes.janitor_paragraphs import CachedBlockReader, split_blocks_tagged

    try:
        conn = _get_db(req.project_path)
    except FileNotFoundError as e:
        return {"status": "error", "chapters": [], "error": str(e)}
    reader = None
    try:
        from db_setup import ensure_pulse_corrections
        ensure_pulse_corrections(conn.cursor())
        reanchored = False
        rows = conn.execute(
            "SELECT id, chapter_number, title, md_filename FROM chapters "
            "WHERE deleted = 0 ORDER BY chapter_number").fetchall()
        reader = CachedBlockReader(req.project_path, req.language,
                                   0.0 if req.cache_only else PULSE_BUDGET_S, label="pulse")
        weights: dict = {}
        try:
            weights = IE.load_weights()
            model_ok = req.language in weights["langs"]
        except (OSError, ValueError, KeyError):
            model_ok = False

        chapters, flat = [], []  # flat: every plotted paragraph in reading order
        for ch in rows:
            html = ""
            md_path = safe_md_path(os.path.join(req.project_path, "md"), ch["md_filename"]) if ch["md_filename"] else None
            if md_path and os.path.exists(md_path):
                with open(md_path, "r", encoding="utf-8") as f:
                    html = md_to_editor_html(f.read())
            blocks = [(i, start, text) for i, (start, text, tag) in enumerate(split_blocks_tagged(html))
                      if not tag.startswith("h") and len(text.split()) >= MIN_WORDS]
            results = reader.results([text for _, _, text in blocks]) if model_ok else [None] * len(blocks)
            paragraphs = []
            for (i, start, text), result in zip(blocks, results):
                para = {"block": i, "start": start, "key": paragraph_key(text), "words": len(text.split()),
                        "excerpt": text[:EXCERPT_CHARS]}
                rec = (result or {}).get("pulse")
                if rec is None:
                    para["pending"] = True
                else:
                    raw, valence = IE.score(rec, req.language, weights)
                    para.update(raw=round(raw, 3), valence=round(valence, 3),
                                emotions=IE.top_emotions(rec),
                                evidence=[[eid, word] for eid, word, _ in rec.get("ev", [])])
                paragraphs.append(para)
                flat.append(para)
            matched, moved, stale = match_corrections(
                _load_corrections(conn, ch["id"]), [p["key"] for p in paragraphs], [t for _, _, t in blocks])
            for row, idx in moved:
                reanchored |= _reanchor(conn, row, paragraphs[idx]["key"], blocks[idx][2], idx)
            if reanchored:
                # commit per chapter: later chapters may parse for seconds, and
                # chapter saves must not wait behind an open write transaction
                conn.commit()
                reanchored = False
            for idx, row in matched.items():
                paragraphs[idx]["_corr"] = row
            chapters.append({"chapter_id": ch["id"], "chapter_number": ch["chapter_number"],
                             "title": ch["title"] or f"Chapter {ch['chapter_number']}",
                             "words": sum(p["words"] for p in paragraphs), "paragraphs": paragraphs,
                             "stale_corrections": [
                                 {"id": r["id"], "para_idx": r["para_idx"], "excerpt": (r["anchor_text"] or "")[:EXCERPT_CHARS],
                                  "intensity": r["intensity"], "valence": r["valence"]} for r in stale]})

        # Book-wide passes over the scored paragraphs, in reading order.
        scored = [p for p in flat if "raw" in p]
        for p, x in zip(scored, IE.normalize([p["raw"] for p in scored])):
            p["intensity"] = round(x, 3)
        # The writer's corrections replace the measurement before the reader
        # model runs, so the felt line, mood and chapter stats follow them. The
        # normalization above stays on measured scores, so one correction never
        # rescales the rest of the book.
        for p in flat:
            corr = p.pop("_corr", None)
            if corr is None:
                continue
            p["measured"] = {"intensity": p.get("intensity"), "valence": p.get("valence")}
            p["intensity"] = round(min(1.0, max(0.0, corr["intensity"])), 3)
            p["valence"] = round(min(1.0, max(-1.0, corr["valence"])), 3)
            p["corrected"] = True
            p["correction_id"] = corr["id"]
            p.pop("pending", None)
        perceived = IE.perceive([p.get("intensity") for p in flat], [p["words"] for p in flat])
        mood = IE.mood_line([p.get("valence") for p in flat], [p["words"] for p in flat])
        for p, level, m in zip(flat, perceived, mood):
            if level is not None:
                p["perceived"] = round(level, 3)
                p["perceived_valence"] = round(m, 3)
        for ch in chapters:
            done = [p for p in ch["paragraphs"] if "intensity" in p]
            words = sum(p["words"] for p in done)
            ch["mean"] = round(sum(p["intensity"] * p["words"] for p in done) / words, 3) if words else None
            ch["peak"] = max((p["intensity"] for p in done), default=None)
        return {
            "status": "ok",
            # False: no weights for this language (e.g. 'ar'); nothing will ever
            # be scored, so the lane shouldn't keep asking
            "supported": model_ok,
            "relative": True,  # 0..1 is relative to the rest of this manuscript (§5.4)
            "weights_version": weights.get("weights_version") if model_ok else None,
            "coverage": {"scored": len(scored), "total": len(flat)},
            "chapters": chapters,
        }
    except Exception as e:
        return {"status": "error", "chapters": [], "error": str(e)}
    finally:
        if reader is not None:
            reader.close()
        conn.close()


class PulseCorrectionRequest(BaseModel):
    project_path: str
    chapter_id: str | int
    # the block texts of one gutter bar (more than one when the paragraph has
    # hard line breaks; the backend scores each of them as its own block)
    texts: list[str]
    # aligned with texts: the correction each block already carries (from the
    # last story-pulse answer), so an edited paragraph keeps its one row
    correction_ids: list[str | None] | None = None
    para_idx: int | None = None
    intensity: float | None = None
    valence: float | None = None
    reset: bool = False  # back to the measured values (soft delete)


@router.post("/api/project/story-pulse/correct")
def correct_paragraph(req: PulseCorrectionRequest):
    """Save (or reset) the writer's own values for a paragraph. Synced: each
    write goes to change_log like any authored data."""
    from db_setup import ensure_pulse_corrections
    from routes.janitor import _get_db
    from sync_core import log_change, log_soft_delete, _now_iso
    import uuid

    texts = [t for t in req.texts if t and t.strip()]
    if req.reset and not texts and any(req.correction_ids or []):
        texts = [""] * len(req.correction_ids)  # discard by id (a stale correction has no paragraph)
    elif not texts or (not req.reset and (req.intensity is None or req.valence is None)):
        return {"status": "error", "error": "texts and both values are required"}
    try:
        conn = _get_db(req.project_path)
    except FileNotFoundError as e:
        return {"status": "error", "error": str(e)}
    try:
        cur = conn.cursor()
        ensure_pulse_corrections(cur)
        chapter_id = str(req.chapter_id)
        now = _now_iso()
        out = []
        known = list(req.correction_ids or [])
        for n, text in enumerate(texts):
            key = paragraph_key(text) if text else None
            existing = cur.execute(
                f"SELECT id FROM {CORRECTION_TABLE} WHERE chapter_id = ? AND para_hash = ? AND deleted = 0",
                (chapter_id, key)).fetchall() if key else []
            cid = known[n] if n < len(known) else None
            if cid and (req.reset or not existing):
                existing = existing + cur.execute(
                    f"SELECT id FROM {CORRECTION_TABLE} WHERE id = ? AND chapter_id = ? AND deleted = 0",
                    (cid, chapter_id)).fetchall()
            existing = [(rid,) for rid in dict.fromkeys(r[0] for r in existing)]
            if req.reset:
                for (rid,) in existing:
                    cur.execute(f"UPDATE {CORRECTION_TABLE} SET deleted = 1, deleted_at = ? WHERE id = ?", (now, rid))
                    log_soft_delete(cur, CORRECTION_TABLE, rid)
                out.append({"key": key, "reset": True})
                continue
            values = {
                "intensity": round(min(1.0, max(0.0, req.intensity)), 3),
                "valence": round(min(1.0, max(-1.0, req.valence)), 3),
                "anchor_text": text,
                "para_idx": req.para_idx,
                "updated_at": now,
            }
            if existing:
                rid = existing[0][0]
                cur.execute(f"UPDATE {CORRECTION_TABLE} SET intensity = ?, valence = ?, anchor_text = ?, "
                            f"para_idx = ?, updated_at = ?, para_hash = ? WHERE id = ?",
                            (values["intensity"], values["valence"], text, req.para_idx, now, key, rid))
                log_change(cur, CORRECTION_TABLE, rid, {**values, "para_hash": key})
            else:
                rid = str(uuid.uuid4())
                cur.execute(f"INSERT INTO {CORRECTION_TABLE} (id, chapter_id, para_hash, para_idx, anchor_text, "
                            f"intensity, valence, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                            (rid, chapter_id, key, req.para_idx, text, values["intensity"], values["valence"], now))
                log_change(cur, CORRECTION_TABLE, rid, {"chapter_id": chapter_id, "para_hash": key,
                                                        "deleted": 0, **values})
            out.append({"key": key, "id": rid, "intensity": values["intensity"], "valence": values["valence"]})
        conn.commit()
        return {"status": "ok", "corrections": out}
    except Exception as e:
        return {"status": "error", "error": str(e)}
    finally:
        conn.close()

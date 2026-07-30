"""
FleshNote API — Sync Engine Routes
Bidirectional local cross-device synchronization.

Diff model
----------
- Entities: field-level Last-Write-Wins keyed by HLC. A remote field is only a real
  change if its normalized value differs from the local DB value (so identical clones and
  representation quirks like NULL-vs-"[]" never show phantom edits).
- Prose (md files): decided by prose_hash *ancestry* using the full change_log history of
  both sides — not by "did both sides log something." latest_local == latest_remote →
  nothing; one side's latest is in the other's history → clean take; otherwise → conflict.
  Resolving a conflict always writes a FRESH prose_hash so the state converges and the
  conflict cannot reappear.
"""

import os
import json
import shutil
import sqlite3
import hashlib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict

from sync_core import log_change

router = APIRouter()


class SyncPreviewRequest(BaseModel):
    local_path: str
    remote_path: str


class SyncApplyRequest(BaseModel):
    local_path: str
    remote_path: str
    resolutions: Dict[str, str]  # chapter_id -> "local" | "remote" | "<merged text>"


# ── DB helpers ──────────────────────────────────────────────────────────────

def _get_db(project_path: str):
    db_path = os.path.join(project_path, "fleshnote.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database not found")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _pk_col(table_name: str) -> str:
    return "config_key" if table_name in ["project_config", "calendar_config"] else "id"


def _get_display_name(cursor, table_name: str, row_id: str) -> str:
    pk_col = _pk_col(table_name)
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        cols = [c[1] for c in cursor.fetchall()]
        for label_col in ("name", "title"):
            if label_col in cols:
                cursor.execute(f"SELECT {label_col} FROM {table_name} WHERE {pk_col} = ?", (row_id,))
                row = cursor.fetchone()
                if row and row[0]:
                    return str(row[0])
        if "config_key" in cols:
            return str(row_id)
    except Exception:
        pass
    return f"{table_name} ({str(row_id)[:8]})"


def _norm(val) -> str:
    """Normalize a value for change detection so equivalent representations compare equal:
    NULL / '' / '[]' / '{}' / 'null' all mean 'empty', and JSON is compared structurally."""
    if val is None:
        return ""
    s = str(val).strip()
    if s in ("", "[]", "{}", "null", "None"):
        return ""
    try:
        return json.dumps(json.loads(s), sort_keys=True)
    except Exception:
        return s


# ── sync_meta / change_log loading ──────────────────────────────────────────

def _load_meta(cursor):
    cursor.execute("SELECT version_vector, last_hlc FROM sync_meta WHERE id=1")
    row = cursor.fetchone()
    vv = json.loads(row["version_vector"] or "{}") if row else {}
    last_hlc = (row["last_hlc"] if row else "") or ""
    device_id = last_hlc.split(":", 2)[2] if last_hlc.count(":") >= 2 else "unknown"
    return vv, last_hlc, device_id


def _all_logs(cursor):
    cursor.execute("SELECT * FROM change_log")
    return [dict(r) for r in cursor.fetchall()]


def _unseen(logs, other_vv):
    """Logs whose HLC is beyond what `other_vv` has seen for that authoring device."""
    return [lg for lg in logs if lg["hlc"] > other_vv.get(lg["device_id"], "")]


def _latest_by_field(logs):
    grouped = {}
    for lg in logs:
        key = (lg["table_name"], lg["row_id"], lg["column_name"])
        if key not in grouped or lg["hlc"] > grouped[key]["hlc"]:
            grouped[key] = lg
    return grouped


# ── Entity diff ─────────────────────────────────────────────────────────────

def _compute_entity_changes(cursor_local, cursor_remote, unseen_remote, unseen_local):
    """Return the list of remote field changes that would actually alter local state."""
    remote_grouped = _latest_by_field(unseen_remote)
    local_grouped = _latest_by_field(unseen_local)

    changes = []
    for key, remote_log in remote_grouped.items():
        table_name, row_id, column_name = key
        if column_name == "prose_hash":  # synthetic, handled by the prose engine
            continue

        local_log = local_grouped.get(key)
        if local_log and local_log["hlc"] > remote_log["hlc"]:
            continue  # local field edit is newer → local wins, no remote change

        pk_col = _pk_col(table_name)
        try:
            cursor_local.execute(
                f"SELECT {column_name} FROM {table_name} WHERE {pk_col} = ?", (row_id,)
            )
            local_row = cursor_local.fetchone()
        except Exception:
            continue  # unknown table/column on this schema — skip defensively

        exists_locally = local_row is not None
        remote_val = remote_log["value"]
        if exists_locally and _norm(local_row[0]) == _norm(remote_val):
            continue  # no-op: values already equivalent (kills NULL-vs-"[]" phantoms)

        if column_name == "deleted" and str(remote_val) == "1":
            action = "delete"
        elif not exists_locally:
            action = "create"
        else:
            action = "update"

        changes.append({
            "table": table_name,
            "row_id": row_id,
            "column": column_name,
            "display_name": _get_display_name(cursor_remote, table_name, row_id),
            "action": action,
            "value": remote_val if remote_val is not None else "",
        })
    return changes


def _entity_summary(changes):
    per_row = {}
    for ch in changes:
        rk = (ch["table"], ch["row_id"])
        act = ch["action"]
        cur = per_row.get(rk)
        # delete dominates; create beats update
        if act == "delete" or cur is None or (act == "create" and cur != "delete"):
            per_row[rk] = act
    return {
        "entity_creates": sum(1 for a in per_row.values() if a == "create"),
        "entity_updates": sum(1 for a in per_row.values() if a == "update"),
        "entity_deletes": sum(1 for a in per_row.values() if a == "delete"),
    }


# ── Prose diff (hash ancestry) ──────────────────────────────────────────────

def _prose_history(cursor):
    """chapter_id -> {'latest': value, 'latest_hlc': hlc, 'hashes': set(all values)}"""
    cursor.execute(
        "SELECT row_id, value, hlc FROM change_log "
        "WHERE table_name='chapters' AND column_name='prose_hash'"
    )
    hist = {}
    for row in cursor.fetchall():
        cid, val, hlc = row["row_id"], row["value"], row["hlc"]
        h = hist.setdefault(cid, {"latest": None, "latest_hlc": "", "hashes": set()})
        h["hashes"].add(val)
        if hlc > h["latest_hlc"]:
            h["latest_hlc"] = hlc
            h["latest"] = val
    return hist


def _read_md(project_path, cursor, chap_id):
    cursor.execute("SELECT title, md_filename FROM chapters WHERE id=?", (chap_id,))
    row = cursor.fetchone()
    if not row:
        return None, None, ""
    title, fname = row["title"], row["md_filename"]
    text = ""
    if fname:
        path = os.path.join(project_path, "md", fname)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
    return title, fname, text


def _compute_prose_plan(cursor_local, cursor_remote, local_path, remote_path):
    """Decide, per chapter, whether prose is converged / a clean take / a conflict,
    from the full prose_hash ancestry on both sides."""
    local_hist = _prose_history(cursor_local)
    remote_hist = _prose_history(cursor_remote)

    takes = []       # {chapter_id, title, direction, md_filename}
    conflicts = []   # {chapter_id, title, md_filename, local_text, remote_text}

    for chap_id in set(local_hist) | set(remote_hist):
        lh = local_hist.get(chap_id)
        rh = remote_hist.get(chap_id)
        latest_local = lh["latest"] if lh else None
        latest_remote = rh["latest"] if rh else None
        local_hashes = lh["hashes"] if lh else set()
        remote_hashes = rh["hashes"] if rh else set()

        title, fname, _ = _read_md(local_path, cursor_local, chap_id)
        if fname is None:
            title, fname, _ = _read_md(remote_path, cursor_remote, chap_id)

        if latest_remote is None or latest_local == latest_remote:
            continue  # nothing remote, or already identical → converged
        if latest_local is None or latest_local in remote_hashes:
            # remote advanced past what local has → clean take remote→local
            takes.append({"chapter_id": chap_id, "title": title,
                          "direction": "remote_to_local", "md_filename": fname})
        elif latest_remote in local_hashes:
            # local advanced past remote → local is ahead (pending push)
            takes.append({"chapter_id": chap_id, "title": title,
                          "direction": "local_to_remote", "md_filename": fname})
        else:
            _, _, local_text = _read_md(local_path, cursor_local, chap_id)
            _, _, remote_text = _read_md(remote_path, cursor_remote, chap_id)
            conflicts.append({"chapter_id": chap_id, "title": title, "md_filename": fname,
                              "local_text": local_text, "remote_text": remote_text})
    return takes, conflicts


# ── Project-id guard ────────────────────────────────────────────────────────

def _check_project_ids(local_path, remote_path):
    lp = os.path.join(local_path, "fleshnote_project.json")
    rp = os.path.join(remote_path, "fleshnote_project.json")
    if not os.path.exists(lp) or not os.path.exists(rp):
        raise HTTPException(status_code=400, detail="Missing project descriptor JSON files.")
    with open(lp, encoding="utf-8") as f:
        local_meta = json.load(f)
    with open(rp, encoding="utf-8") as f:
        remote_meta = json.load(f)
    lid, rid = local_meta.get("project_id"), remote_meta.get("project_id")
    if not lid or not rid or lid != rid:
        return None, None, False
    return local_meta, remote_meta, True


# ── Preview ─────────────────────────────────────────────────────────────────

@router.post("/api/project/sync/preview")
def sync_preview(req: SyncPreviewRequest):
    local_meta, remote_meta, ok = _check_project_ids(req.local_path, req.remote_path)
    if not ok:
        return {"status": "error",
                "message": "These are different projects — syncing would corrupt your manuscript."}

    local_conn = _get_db(req.local_path)
    remote_conn = _get_db(req.remote_path)
    try:
        cl, cr = local_conn.cursor(), remote_conn.cursor()
        local_vv, _, _ = _load_meta(cl)
        remote_vv, _, _ = _load_meta(cr)

        local_logs, remote_logs = _all_logs(cl), _all_logs(cr)
        unseen_remote = _unseen(remote_logs, local_vv)
        unseen_local = _unseen(local_logs, remote_vv)

        entity_changes = _compute_entity_changes(cl, cr, unseen_remote, unseen_local)
        takes, conflicts = _compute_prose_plan(cl, cr, req.local_path, req.remote_path)

        summary = _entity_summary(entity_changes)
        summary["prose_takes_remote"] = sum(1 for t in takes if t["direction"] == "remote_to_local")
        summary["prose_takes_local"] = sum(1 for t in takes if t["direction"] == "local_to_remote")
        summary["prose_conflicts"] = len(conflicts)

        return {
            "status": "ok",
            "project_id": local_meta.get("project_id"),
            "project_name": local_meta.get("project_name", "Untitled"),
            "entity_changes": entity_changes,
            "prose_takes": takes,
            "prose_conflicts": conflicts,
            "summary": summary,
        }
    finally:
        local_conn.close()
        remote_conn.close()


# ── Apply ───────────────────────────────────────────────────────────────────

@router.post("/api/project/sync/apply")
def sync_apply(req: SyncApplyRequest):
    _, _, ok = _check_project_ids(req.local_path, req.remote_path)
    if not ok:
        raise HTTPException(status_code=400,
                            detail="These are different projects — sync refused.")

    db_path = os.path.join(req.local_path, "fleshnote.db")
    db_bak_path = os.path.join(req.local_path, "fleshnote.db.bak")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Local database not found")
    try:
        shutil.copy2(db_path, db_bak_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create database backup: {str(e)}")

    local_conn = sqlite3.connect(db_path)
    local_conn.row_factory = sqlite3.Row
    remote_conn = _get_db(req.remote_path)
    try:
        cl, cr = local_conn.cursor(), remote_conn.cursor()
        local_vv, local_last_hlc, local_device = _load_meta(cl)
        remote_vv, remote_last_hlc, remote_device = _load_meta(cr)

        local_logs, remote_logs = _all_logs(cl), _all_logs(cr)
        unseen_remote = _unseen(remote_logs, local_vv)
        unseen_local = _unseen(local_logs, remote_vv)

        # 1. Entity field changes (reuse the exact same detection as preview)
        entity_changes = _compute_entity_changes(cl, cr, unseen_remote, unseen_local)
        remote_grouped = _latest_by_field(unseen_remote)

        # group changes per row for clean insert/update
        rows_to_apply = {}
        for ch in entity_changes:
            rows_to_apply.setdefault((ch["table"], ch["row_id"]), {})[ch["column"]] = ch["value"]

        for (table_name, row_id), field_vals in rows_to_apply.items():
            pk_col = _pk_col(table_name)
            cl.execute(f"SELECT 1 FROM {table_name} WHERE {pk_col} = ?", (row_id,))
            exists = cl.fetchone() is not None
            if exists:
                sets = ", ".join(f"{c} = ?" for c in field_vals)
                cl.execute(f"UPDATE {table_name} SET {sets} WHERE {pk_col} = ?",
                           list(field_vals.values()) + [row_id])
            else:
                cr.execute(f"SELECT * FROM {table_name} WHERE {pk_col} = ?", (row_id,))
                remote_row = cr.fetchone()
                if remote_row:
                    cols = list(remote_row.keys())
                    vals = [remote_row[c] for c in cols]
                    for c, v in field_vals.items():
                        if c in cols:
                            vals[cols.index(c)] = v
                    cl.execute(
                        f"INSERT INTO {table_name} ({', '.join(cols)}) "
                        f"VALUES ({', '.join(['?'] * len(cols))})", vals)

            # mark the winning remote logs as seen locally
            for c in field_vals:
                lg = remote_grouped.get((table_name, row_id, c))
                if lg:
                    cl.execute(
                        "INSERT OR IGNORE INTO change_log "
                        "(table_name, row_id, column_name, value, hlc, device_id, origin) "
                        "VALUES (?,?,?,?,?,?,?)",
                        (lg["table_name"], lg["row_id"], lg["column_name"], lg["value"],
                         lg["hlc"], lg["device_id"], lg["origin"]))

        # 2. Prose plan (same open cursors — no nested endpoint call)
        takes, conflicts = _compute_prose_plan(cl, cr, req.local_path, req.remote_path)
        touched = set()

        def _copy_remote_prose_log(chap_id):
            cr.execute(
                "SELECT * FROM change_log WHERE table_name='chapters' AND row_id=? "
                "AND column_name='prose_hash' ORDER BY hlc DESC LIMIT 1", (chap_id,))
            r = cr.fetchone()
            if r:
                cl.execute(
                    "INSERT OR IGNORE INTO change_log "
                    "(table_name, row_id, column_name, value, hlc, device_id, origin) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (r["table_name"], r["row_id"], r["column_name"], r["value"],
                     r["hlc"], r["device_id"], r["origin"]))

        # clean remote→local takes
        for take in takes:
            if take["direction"] != "remote_to_local" or not take["md_filename"]:
                continue
            rpath = os.path.join(req.remote_path, "md", take["md_filename"])
            lpath = os.path.join(req.local_path, "md", take["md_filename"])
            if os.path.exists(rpath):
                os.makedirs(os.path.dirname(lpath), exist_ok=True)
                shutil.copy2(rpath, lpath)
                _copy_remote_prose_log(take["chapter_id"])
                touched.add(take["chapter_id"])

        # Reference-image assets. image_references rows merge through the
        # change_log above, but the files live in assets/. Copy any remote asset
        # we don't already have — filenames are UUID-unique, so copy-if-absent
        # can't clobber a different image. Inside the backup/rollback envelope.
        remote_assets = os.path.join(req.remote_path, "assets")
        if os.path.isdir(remote_assets):
            for root, _dirs, files in os.walk(remote_assets):
                for fname in files:
                    src = os.path.join(root, fname)
                    rel = os.path.relpath(src, remote_assets)
                    dst = os.path.join(req.local_path, "assets", rel)
                    if not os.path.exists(dst):
                        os.makedirs(os.path.dirname(dst), exist_ok=True)
                        shutil.copy2(src, dst)

        # conflict resolutions — always end with a FRESH prose_hash so it converges
        for conflict in conflicts:
            chap_id, fname = conflict["chapter_id"], conflict["md_filename"]
            if not fname:
                continue
            lpath = os.path.join(req.local_path, "md", fname)
            rpath = os.path.join(req.remote_path, "md", fname)
            choice = req.resolutions.get(chap_id, "local")

            if choice == "remote":
                resolved = conflict["remote_text"]
            elif choice == "local":
                resolved = conflict["local_text"]
            else:
                resolved = choice  # custom merged text

            os.makedirs(os.path.dirname(lpath), exist_ok=True)
            with open(lpath, "w", encoding="utf-8") as f:
                f.write(resolved)

            # record remote's version as a seen ancestor so it can't re-conflict
            _copy_remote_prose_log(chap_id)

            new_hash = hashlib.sha256(resolved.encode("utf-8")).hexdigest()
            cl.execute("UPDATE chapters SET word_count=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                       (len(resolved.split()), chap_id))
            log_change(cl, "chapters", chap_id, {"prose_hash": new_hash})
            touched.add(chap_id)

        # 3. Recompute derived data for touched chapters
        from routes.chapters import (
            _update_entity_appearances, _update_foreshadowings,
            _update_knowledge_offsets, _update_relationship_offsets,
        )
        for chap_id in touched:
            cl.execute("SELECT md_filename FROM chapters WHERE id=? AND deleted=0", (chap_id,))
            row = cl.fetchone()
            if row and row["md_filename"]:
                lpath = os.path.join(req.local_path, "md", row["md_filename"])
                if os.path.exists(lpath):
                    with open(lpath, "r", encoding="utf-8") as f:
                        content = f.read()
                    _update_entity_appearances(cl, chap_id, content)
                    _update_foreshadowings(cl, chap_id, content)
                    _update_knowledge_offsets(cl, chap_id, content)
                    _update_relationship_offsets(cl, chap_id, content)

        # 4. Advance version vector: merge remote's, learn remote's clock, record our own
        for dev, hlc in remote_vv.items():
            local_vv[dev] = max(local_vv.get(dev, ""), hlc)
        if remote_device != "unknown" and remote_last_hlc:
            local_vv[remote_device] = max(local_vv.get(remote_device, ""), remote_last_hlc)
        if local_device != "unknown" and local_last_hlc:
            local_vv[local_device] = max(local_vv.get(local_device, ""), local_last_hlc)
        cl.execute("UPDATE sync_meta SET version_vector=? WHERE id=1", (json.dumps(local_vv),))

        local_conn.commit()
        return {"status": "ok"}

    except Exception as e:
        try:
            local_conn.rollback()
            local_conn.close()
        except Exception:
            pass
        if os.path.exists(db_bak_path):
            try:
                shutil.copy2(db_bak_path, db_path)
            except Exception as backup_err:
                print(f"CRITICAL: Failed to restore database backup: {str(backup_err)}")
        raise HTTPException(status_code=500, detail=f"Sync apply failed: {str(e)}")
    finally:
        try:
            local_conn.close()
        except Exception:
            pass
        remote_conn.close()
        if os.path.exists(db_bak_path):
            try:
                os.remove(db_bak_path)
            except OSError:
                pass

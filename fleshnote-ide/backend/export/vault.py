"""Project vault export — the "leave FleshNote with your data" exporter.

Produces a folder tree of Markdown (Obsidian-ready) or plain text files:

    <Dest>/
      Manuscript/01 — Chapter Title.md      (frontmatter: chapter, status, POV, world time)
      Characters/Sophia.md                  (frontmatter: type, aliases, role, ... + body sections)
      Locations/...   Groups & Factions/...   Lore/<category>/...
      Quick Notes/...   Twists & Secrets/...
      attachments/                          (entity images, obsidian mode only)
      Project Overview.md

FleshNote-specific telemetry (plot planner, Pentimento, world history timeline,
sketchboards, stats/achievements) is deliberately not exported.

Chapter conversion reuses the marker vocabulary from export/strip.py: on-disk
chapters use {{char:<id>|Name}} / {{loc:...}} / {{item:...}} markers,
{secret:...}/{knows:...} epistemic markers and the raw-HTML-span fallback form.
"""

import json
import os
import re
import shutil
import sqlite3
from datetime import date
from project_io import safe_md_path
from export.strip import (
    _normalize_raw_spans,
    _FLESHNOTE_MARKER_PATTERN,
    _TWIST_MARKER_PATTERN,
    _KNOWLEDGE_REL_PATTERN,
    _TIME_MARKER_PATTERN,
    _EPISTEMIC_PATTERN,
    _HTML_TAG_PATTERN,
)

FOLDER_MANUSCRIPT = "Manuscript"
FOLDER_CHARACTERS = "Characters"
FOLDER_LOCATIONS = "Locations"
FOLDER_GROUPS = "Groups & Factions"
FOLDER_LORE = "Lore"
FOLDER_QUICKNOTES = "Quick Notes"
FOLDER_TWISTS = "Twists & Secrets"
FOLDER_ATTACHMENTS = "attachments"

_FMT_SUFFIX = {"obsidian": " (Obsidian)", "txt": " (Plain Text)"}
_FORBIDDEN = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _sanitize_filename(name, fallback="Untitled"):
    name = _FORBIDDEN.sub("-", str(name or "")).strip(" .")
    return name or fallback


def _yaml_str(value):
    text = "" if value is None else str(value)
    text = text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
    return f'"{text}"'


def _yaml_list(items):
    return "[" + ", ".join(_yaml_str(i) for i in items) + "]"


def _clean_paragraphs(text):
    lines = [ln.rstrip() for ln in str(text or "").split("\n")]
    out = []
    for ln in lines:
        if not ln.strip() and (not out or not out[-1].strip()):
            continue
        out.append(ln)
    return "\n".join(out).strip()


def _read_text(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def _json_list(raw):
    try:
        val = json.loads(raw) if raw else []
        return val if isinstance(val, list) else []
    except (ValueError, TypeError):
        return []


class VaultExporter:
    def __init__(self, project_path, fmt="obsidian"):
        self.project_path = project_path
        self.fmt = "txt" if fmt == "txt" else "obsidian"
        self.db_path = os.path.join(project_path, "fleshnote.db")
        self.md_dir = os.path.join(project_path, "md")
        self.assets_dir = os.path.join(project_path, "assets")

        self.project_title = os.path.basename(project_path)
        self.author_name = ""
        self.config = {}
        self.calendar = {}

        # name -> True if unique across the whole vault
        self.wiki_names = {}
        # entity key ("char"|"loc"|"group"|"lore"|"secret", id) -> folder-qualified path
        self.entity_paths = {}
        self.chapter_paths = {}
        self.character_names = {}
        self.used_names = {}  # folder -> {filename: count}
        self.file_count = 0

    # ── database access ──────────────────────────────────────────────────

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _rows(self, conn, sql, params=()):
        try:
            return [dict(r) for r in conn.execute(sql, params).fetchall()]
        except sqlite3.Error:
            return []

    def _load_all_data(self, conn):
        for row in self._rows(conn, "SELECT config_key, config_value FROM project_config"):
            self.config[row["config_key"]] = row["config_value"]
        if self.config.get("project_name"):
            self.project_title = self.config["project_name"]
        self.author_name = self.config.get("author_name", "")

        self.characters = self._rows(conn, "SELECT * FROM characters WHERE deleted = 0")
        self.locations = self._rows(conn, "SELECT * FROM locations WHERE deleted = 0")
        self.groups = self._rows(conn, "SELECT * FROM groups WHERE deleted = 0")
        self.lore = self._rows(conn, "SELECT * FROM lore_entities WHERE deleted = 0")
        self.quick_notes = self._rows(
            conn, "SELECT * FROM quick_notes WHERE deleted = 0 ORDER BY created_at ASC")
        self.twists = self._rows(conn, "SELECT * FROM twists WHERE deleted = 0 ORDER BY id ASC")
        self.secrets = self._rows(conn, "SELECT * FROM secrets ORDER BY id ASC")
        self.foreshadowings = self._rows(conn, "SELECT * FROM foreshadowings WHERE deleted = 0")
        self.memberships = self._rows(conn, "SELECT * FROM group_memberships WHERE deleted = 0")
        self.relationships = self._rows(
            conn, "SELECT * FROM character_relationships WHERE deleted = 0")
        self.knowledge = self._rows(
            conn, "SELECT * FROM knowledge_states WHERE deleted = 0 ORDER BY id ASC")
        self.appearances = self._rows(conn, "SELECT * FROM entity_appearances")
        self.image_refs = self._rows(
            conn, "SELECT * FROM image_references WHERE deleted = 0 ORDER BY sort_order, id")
        self.chapters = self._rows(
            conn, "SELECT * FROM chapters WHERE deleted = 0 ORDER BY chapter_number ASC")
        self.weather_states = self._rows(
            conn, "SELECT * FROM location_weather_states WHERE deleted = 0")
        self.calendar = {r["config_key"]: r["config_value"] for r in
                         self._rows(conn, "SELECT config_key, config_value FROM calendar_config")}
        self.annotations_by_id = {
            str(a["id"]): a["content"] for a in self._rows(conn, "SELECT id, content FROM annotations")
        }

    # ── naming / linking ─────────────────────────────────────────────────

    def _build_name_map(self):
        counts = {}

        def claim(name, folder):
            name = str(name or "").strip()
            if not name:
                return
            counts.setdefault(name, []).append((folder, _sanitize_filename(name)))

        for c in self.characters:
            claim(c["name"], FOLDER_CHARACTERS)
        for l in self.locations:
            claim(l["name"], FOLDER_LOCATIONS)
        for g in self.groups:
            claim(g["name"], FOLDER_GROUPS)
        for e in self.lore:
            claim(e["name"], self._lore_folder(e))
        for s in self.secrets:
            claim(s["title"], FOLDER_TWISTS)
        for t in self.twists:
            claim(t["title"], FOLDER_TWISTS)
        for ch in self.chapters:
            claim(ch["title"] or f"Chapter {ch['chapter_number']}", FOLDER_MANUSCRIPT)

        self.wiki_names = {
            name: len(paths) == 1 for name, paths in counts.items()
        }
        self.entity_paths = {}
        for c in self.characters:
            self.entity_paths[("char", str(c["id"]))] = f"{FOLDER_CHARACTERS}/{_sanitize_filename(c['name'])}"
            self.character_names[str(c["id"])] = c["name"]
        for l in self.locations:
            self.entity_paths[("loc", str(l["id"]))] = f"{FOLDER_LOCATIONS}/{_sanitize_filename(l['name'])}"
        for g in self.groups:
            self.entity_paths[("group", str(g["id"]))] = f"{FOLDER_GROUPS}/{_sanitize_filename(g['name'])}"
        for e in self.lore:
            self.entity_paths[("lore", str(e["id"]))] = f"{self._lore_folder(e)}/{_sanitize_filename(e['name'])}"
        for s in self.secrets:
            self.entity_paths[("secret", str(s["id"]))] = f"{FOLDER_TWISTS}/{_sanitize_filename(s['title'])}"

    def _lore_folder(self, e):
        return f"{FOLDER_LORE}/{_sanitize_filename((e.get('category') or 'Misc').strip() or 'Misc')}"

    def _link(self, path, display=None):
        """Wiki link for a folder-qualified vault path; shortest unique form."""
        if not path:
            return ""
        base = path.split("/")[-1]
        if self.fmt == "txt":
            return display or base
        unique = self.wiki_names.get(base, False)
        if unique:
            return f"[[{base}]]" if not display or display == base else f"[[{base}|{display}]]"
        return f"[[{path}|{display or base}]]"

    def _entity_link(self, short_type, entity_id, display=""):
        norm = {"character": "char", "location": "loc", "item": "lore", "lore": "lore"}.get(short_type, short_type)
        path = self.entity_paths.get((norm, str(entity_id)))
        if path:
            return self._link(path, display or None)
        return display or ""

    def _chapter_link(self, num, title):
        label = f"Ch {num}: {title}" if title else f"Ch {num}"
        if self.fmt == "txt":
            return label
        return f"[[{FOLDER_MANUSCRIPT}/{self.chapter_file_stem(num, title)}|{label}]]"

    @staticmethod
    def chapter_file_stem(num, title):
        return f"{int(num):02d} — {_sanitize_filename(title)}"

    # ── writing helpers ──────────────────────────────────────────────────

    def _ext(self):
        return "md" if self.fmt == "obsidian" else "txt"

    def _write(self, relpath, content):
        path = os.path.join(self.root, *relpath.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        self.file_count += 1

    def _unique_filename(self, folder, name):
        safe = _sanitize_filename(name)
        seen = self.used_names.setdefault(folder, {})
        count = seen.get(safe, 0) + 1
        seen[safe] = count
        return safe if count == 1 else f"{safe} ({count})"

    def _write_entity_note(self, folder, title, frontmatter, body):
        name = self._unique_filename(folder, title)
        self._write(f"{folder}/{name}.{self._ext()}", frontmatter + body)

    def _frontmatter(self, fields):
        if self.fmt != "obsidian":
            return ""
        lines = ["---"]
        for k, v in fields.items():
            if v is None or v == "" or v == []:
                continue
            if isinstance(v, (list, tuple)):
                lines.append(f"{k}: {_yaml_list(list(v))}")
            else:
                lines.append(f"{k}: {_yaml_str(v)}")
        lines.append("---")
        return "\n".join(lines) + "\n\n"

    def _section(self, title, body):
        body = _clean_paragraphs(body)
        if not body:
            return ""
        return f"## {title}\n\n{body}\n\n"

    def _field(self, label, value):
        value = _clean_paragraphs(value)
        if not value:
            return ""
        if self.fmt == "obsidian":
            return f"**{label}:** {value}\n\n"
        return f"{label}: {value}\n\n"

    def _bullets(self, title, items):
        items = [i for i in items if str(i or "").strip()]
        if not items:
            return ""
        return f"## {title}\n\n" + "\n".join(f"- {i}" for i in items) + "\n\n"

    def _embed_image(self, basename):
        if self.fmt != "obsidian" or not basename:
            return ""
        return f"![[{basename}]]\n\n"

    # ── images ───────────────────────────────────────────────────────────

    def _icon_of(self, short_type, entity_id):
        for r in self.image_refs:
            if r["entity_type"] == short_type and str(r["entity_id"]) == str(entity_id) and r.get("is_icon"):
                return os.path.basename(r["image_path"])
        return None

    def _gallery_of(self, short_type, entity_id):
        return [os.path.basename(r["image_path"]) for r in self.image_refs
                if r["entity_type"] == short_type and str(r["entity_id"]) == str(entity_id)
                and not r.get("is_icon")]

    def copy_attachments(self):
        if self.fmt != "obsidian":
            return
        dest = os.path.join(self.root, FOLDER_ATTACHMENTS)
        os.makedirs(dest, exist_ok=True)
        # image_path is project data (syncable/importable) — only relative
        # 'assets/<name>' paths under the project's assets/ dir are allowed;
        # symlinks are never dereferenced and escapes are skipped.
        assets_dir = os.path.realpath(os.path.join(self.project_path, "assets"))
        for r in self.image_refs:
            rel = str(r["image_path"] or "").replace("\\", "/")
            if not rel or os.path.isabs(rel) or "\x00" in rel:
                continue
            parts = [p for p in rel.split("/") if p not in (".", "")]
            if len(parts) < 2 or parts[0] != "assets" or any(p == ".." for p in parts):
                continue
            src = os.path.realpath(os.path.join(assets_dir, *parts[1:]))
            try:
                contained = os.path.normcase(
                    os.path.commonpath([assets_dir, src])
                ) == os.path.normcase(assets_dir)
            except ValueError:
                contained = False
            if not contained or os.path.islink(src) or not os.path.isfile(src):
                continue
            target = os.path.join(dest, parts[-1])
            if not os.path.exists(target):
                shutil.copyfile(src, target)

    # ── chapter text conversion ──────────────────────────────────────────

    def convert_chapter_text(self, raw):
        text = _normalize_raw_spans(raw)
        text = _TIME_MARKER_PATTERN.sub(r"\1", text)
        text = _KNOWLEDGE_REL_PATTERN.sub(r"\4", text)
        text = _TWIST_MARKER_PATTERN.sub(r"\3", text)

        if self.fmt == "txt":
            text = _EPISTEMIC_PATTERN.sub(
                lambda m: f"[{m.group(1)}: {m.group(2).strip()}]", text)

        footnotes = []

        def resolve_entity(m):
            stype, sid, display = m.group(1), m.group(2), m.group(3)
            if stype == "annotation":
                content = self.annotations_by_id.get(str(sid)) or display
                footnotes.append(_clean_paragraphs(content))
                idx = len(footnotes)
                return f"{display}[^{idx}]" if self.fmt == "obsidian" else f"{display}[{idx}]"
            if stype == "quicknote":
                return display
            if stype == "secret":
                link = self._entity_link("secret", sid, display)
                return link or display
            etype = "lore" if stype in ("item", "lore") else stype
            link = self._entity_link(etype, sid, display)
            return link or display

        text = _FLESHNOTE_MARKER_PATTERN.sub(resolve_entity, text)

        if self.fmt == "obsidian":
            text = _EPISTEMIC_PATTERN.sub(
                lambda m: f"\n> [!info]- {m.group(1)}: {m.group(2).strip()}\n", text)

        text = text.replace("</p>", "\n").replace("<br>", "\n").replace("<br/>", "\n")
        text = _HTML_TAG_PATTERN.sub("", text)

        if footnotes:
            text += "\n\n---\n\n"
            text += "\n\n".join(
                (f"[^{i}]: {c}" if self.fmt == "obsidian" else f"[{i}]: {c}")
                for i, c in enumerate(footnotes, 1))

        return _clean_paragraphs(text)

    # ── note builders ────────────────────────────────────────────────────

    def manuscript_files(self):
        for ch in self.chapters:
            contained = safe_md_path(self.md_dir, ch.get("md_filename") or "")
            raw = _read_text(contained) if contained else ""
            text = self.convert_chapter_text(raw)
            pov = self.character_names.get(str(ch.get("pov_character_id") or ""), "")
            stem = self.chapter_file_stem(ch["chapter_number"], ch["title"])
            self.chapter_paths[str(ch["id"])] = f"{FOLDER_MANUSCRIPT}/{stem}"

            fm = self._frontmatter({
                "chapter": ch["chapter_number"],
                "title": ch["title"],
                "status": ch.get("status"),
                "pov": pov or None,
                "world_time": ch.get("world_time"),
                "words": ch.get("word_count"),
            })
            empty = "*empty chapter*" if self.fmt == "obsidian" else "(empty chapter)"
            body = fm + (text or empty)
            body += "\n\n"
            body += self._section("Synopsis", ch.get("synopsis"))
            body += self._section("Author notes", ch.get("notes"))
            self._write(f"{FOLDER_MANUSCRIPT}/{stem}.{self._ext()}", body)

    def character_note(self, c):
        cid = str(c["id"])
        group_links, memberships = [], []
        for m in self.memberships:
            if str(m["character_id"]) != cid:
                continue
            g = next((x for x in self.groups if str(x["id"]) == str(m["group_id"])), None)
            if g:
                group_links.append(g["name"])
            bits = [self._link(f"{FOLDER_GROUPS}/{_sanitize_filename(g['name'])}", g["name"]) if g else "?"]
            if m.get("role_title"):
                bits.append(m["role_title"])
            if m.get("standing"):
                bits.append(f"standing: {m['standing']}")
            if m.get("joined_date"):
                bits.append(f"joined {m['joined_date']}")
            if m.get("left_date"):
                bits.append(f"left {m['left_date']}")
            memberships.append(" — ".join(str(b) for b in bits if b))

        rel_lines = []
        for r in self.relationships:
            if str(r["character_id"]) != cid:
                continue
            target = self.character_names.get(str(r["target_character_id"]), "")
            line = f"{self._entity_link('char', r['target_character_id'], target)} — {r['rel_type']}"
            extra = []
            if r.get("world_time"):
                extra.append(str(r["world_time"]))
            if r.get("is_one_sided"):
                extra.append("one-sided")
            if r.get("notes"):
                extra.append(str(r["notes"]))
            if extra:
                line += f" ({'; '.join(extra)})"
            rel_lines.append(line)

        know_lines = []
        for k in self.knowledge:
            if str(k["character_id"]) != cid:
                continue
            bits = [k["fact"]]
            if k.get("source_entity_type") and k.get("source_entity_id"):
                about = self._entity_link(k["source_entity_type"], k["source_entity_id"])
                if about and about != (k.get("source_entity_id") or ""):
                    bits.append(f"about {about}")
            if k.get("learned_in_chapter"):
                ch = next((x for x in self.chapters if str(x["id"]) == str(k["learned_in_chapter"])), None)
                if ch:
                    bits.append(f"learned in {self._chapter_link(ch['chapter_number'], ch['title'])}")
            if k.get("is_secret"):
                bits.append("secret")
            know_lines.append(" · ".join(str(b) for b in bits))

        appears = [self.chapter_paths[str(ch["id"])] for ch in self.chapters
                   if any(a["chapter_id"] == ch["id"] and a["entity_type"] == "character"
                          and str(a["entity_id"]) == cid for a in self.appearances)]
        icon = self._icon_of("char", cid)
        gallery = self._gallery_of("char", cid)

        try:
            aliases = json.loads(c.get("aliases") or "[]")
        except (ValueError, TypeError):
            aliases = []

        body = self._embed_image(icon)
        body += self._field("Role", c.get("role"))
        body += self._field("Status", c.get("status"))
        body += self._field("Species", c.get("species"))
        body += self._field("Birth date", c.get("birth_date"))
        body += self._field("Surface goal", c.get("surface_goal"))
        body += self._field("True goal", c.get("true_goal"))
        body += self._section("Biography", c.get("bio"))
        body += self._section("Notes", c.get("notes"))
        body += self._bullets("Membership", memberships)
        body += self._bullets("Relationships", rel_lines)
        body += self._bullets("Knowledge", know_lines)
        if self.fmt == "obsidian" and gallery:
            body += "## Gallery\n\n" + "\n\n".join(f"![[{b}]]" for b in gallery) + "\n\n"
        body += self._bullets("Appears in", [f"[[{p}|{p.split('/')[-1]}]]" for p in appears] if self.fmt == "obsidian" else [p.split('/')[-1] for p in appears])

        fm = self._frontmatter({
            "name": c["name"],
            "type": "character",
            "aliases": aliases,
            "role": c.get("role"),
            "status": c.get("status"),
            "species": c.get("species"),
            "birth_date": c.get("birth_date"),
            "groups": group_links,
            "icon": f"[[{icon}]]" if icon else None,
        })
        self._write_entity_note(FOLDER_CHARACTERS, c["name"], fm, body)

    def location_note(self, l):
        lid = str(l["id"])
        parent = next((x for x in self.locations if str(x["id"]) == str(l.get("parent_location_id"))), None)
        weather_lines = []
        for w in self.weather_states:
            if str(w["location_id"]) != lid:
                continue
            bits = [w.get("world_time") or "", w.get("weather") or "", w.get("temperature") or ""]
            weather_lines.append(" — ".join(b for b in bits if b))
        appears = [self.chapter_paths[str(ch["id"])] for ch in self.chapters
                   if any(a["chapter_id"] == ch["id"] and a["entity_type"] == "location"
                          and str(a["entity_id"]) == lid for a in self.appearances)]
        icon = self._icon_of("loc", lid)
        gallery = self._gallery_of("loc", lid)

        body = self._embed_image(icon)
        body += self._field("Region", l.get("region"))
        if parent:
            body += self._field("Parent location", self._entity_link("loc", parent["id"]))
        body += self._section("Description", l.get("description"))
        body += self._section("Notes", l.get("notes"))
        body += self._bullets("Weather history", weather_lines)
        if self.fmt == "obsidian" and gallery:
            body += "## Gallery\n\n" + "\n\n".join(f"![[{b}]]" for b in gallery) + "\n\n"
        body += self._appears_section(appears)

        fm = self._frontmatter({
            "name": l["name"], "type": "location", "region": l.get("region"),
            "parent": parent["name"] if parent else None,
            "icon": f"[[{icon}]]" if icon else None,
        })
        self._write_entity_note(FOLDER_LOCATIONS, l["name"], fm, body)

    def group_note(self, g):
        gid = str(g["id"])
        parent = next((x for x in self.groups if str(x["id"]) == str(g.get("parent_group_id"))), None)
        hq = next((x for x in self.locations if str(x["id"]) == str(g.get("headquarters_location_id"))), None)
        member_lines = []
        for m in self.memberships:
            if str(m["group_id"]) != gid:
                continue
            name = self.character_names.get(str(m["character_id"]), m["character_id"])
            bits = [self._entity_link("char", m["character_id"], name)]
            if m.get("role_title"):
                bits.append(m["role_title"])
            if m.get("standing"):
                bits.append(f"standing: {m['standing']}")
            if m.get("joined_date"):
                bits.append(f"joined {m['joined_date']}")
            if m.get("left_date"):
                bits.append(f"left {m['left_date']}")
            member_lines.append(" — ".join(str(b) for b in bits if b))
        appears = [self.chapter_paths[str(ch["id"])] for ch in self.chapters
                   if any(a["chapter_id"] == ch["id"] and a["entity_type"] == "group"
                          and str(a["entity_id"]) == gid for a in self.appearances)]
        icon = self._icon_of("group", gid)

        body = self._embed_image(icon)
        body += self._field("Type", g.get("group_type"))
        if parent:
            body += self._field("Parent", self._entity_link("group", parent["id"]))
        if hq:
            body += self._field("Headquarters", self._entity_link("loc", hq["id"]))
        body += self._field("Founded", g.get("founded_date"))
        body += self._section("Description", g.get("description"))
        body += self._field("Surface agenda", g.get("surface_agenda"))
        body += self._field("True agenda", g.get("true_agenda"))
        body += self._section("Philosophy", g.get("philosophy"))
        body += self._section("Internal rules", g.get("internal_rules"))
        body += self._section("Notes", g.get("notes"))
        body += self._bullets("Members", member_lines)
        body += self._appears_section(appears)

        fm = self._frontmatter({
            "name": g["name"], "type": "group", "group_type": g.get("group_type"),
            "founded": g.get("founded_date"),
            "parent": parent["name"] if parent else None,
            "icon": f"[[{icon}]]" if icon else None,
        })
        self._write_entity_note(FOLDER_GROUPS, g["name"], fm, body)

    def lore_note(self, e):
        eid = str(e["id"])
        folder = self._lore_folder(e)
        appears = [self.chapter_paths[str(ch["id"])] for ch in self.chapters
                   if any(a["chapter_id"] == ch["id"] and a["entity_type"] == "lore"
                          and str(a["entity_id"]) == eid for a in self.appearances)]
        icon = self._icon_of("item", eid)
        gallery = self._gallery_of("item", eid)

        body = self._embed_image(icon)
        body += self._field("Classification", e.get("classification"))
        body += self._section("Description", e.get("description"))
        body += self._section("Rules", e.get("rules"))
        body += self._section("Limitations", e.get("limitations"))
        body += self._field("Origin", e.get("origin"))
        body += self._section("Notes", e.get("notes"))
        if self.fmt == "obsidian" and gallery:
            body += "## Gallery\n\n" + "\n\n".join(f"![[{b}]]" for b in gallery) + "\n\n"
        body += self._appears_section(appears)

        fm = self._frontmatter({
            "name": e["name"], "type": "lore", "category": e.get("category"),
            "classification": e.get("classification"),
            "icon": f"[[{icon}]]" if icon else None,
        })
        self._write_entity_note(folder, e["name"], fm, body)

    def secret_note(self, s):
        try:
            ids = json.loads(s.get("characters_who_know") or "[]")
        except (ValueError, TypeError):
            ids = []
        who = [self._entity_link("char", cid) for cid in ids]
        reveal = None
        if s.get("reveal_chapter_id"):
            ch = next((x for x in self.chapters if str(x["id"]) == str(s["reveal_chapter_id"])), None)
            if ch:
                reveal = self._chapter_link(ch["chapter_number"], ch["title"])
        try:
            danger = json.loads(s.get("danger_phrases") or "[]")
        except (ValueError, TypeError):
            danger = []

        body = self._field("Type", s.get("secret_type"))
        body += self._field("Status", s.get("status"))
        body += self._section("Description", s.get("description"))
        if reveal:
            body += self._field("Revealed in", reveal)
        body += self._bullets("Who knows", who)
        body += self._bullets("Danger phrases", danger)
        body += self._section("Notes", s.get("notes"))

        fm = self._frontmatter({"name": s["title"], "type": "secret",
                                "secret_type": s.get("secret_type"), "status": s.get("status")})
        self._write_entity_note(FOLDER_TWISTS, s["title"], fm, body)

    def twist_note(self, t):
        try:
            ids = json.loads(t.get("characters_who_know") or "[]")
        except (ValueError, TypeError):
            ids = []
        who = [self._entity_link("char", cid) for cid in ids]
        reveal = None
        if t.get("reveal_chapter_id"):
            ch = next((x for x in self.chapters if str(x["id"]) == str(t["reveal_chapter_id"])), None)
            if ch:
                reveal = self._chapter_link(ch["chapter_number"], ch["title"])
        fore_lines = []
        for f in self.foreshadowings:
            if str(f["twist_id"]) != str(t["id"]):
                continue
            ch = next((x for x in self.chapters if str(x["id"]) == str(f["chapter_id"])), None)
            where = self._chapter_link(ch["chapter_number"], ch["title"]) if ch else "?"
            text = _clean_paragraphs(f.get("selected_text") or "")
            fore_lines.append(f"{where}{(': ' + text) if text else ''}")

        body = self._field("Type", t.get("twist_type"))
        body += self._field("Status", t.get("status"))
        body += self._section("Description", t.get("description"))
        if reveal:
            body += self._field("Reveal chapter", reveal)
        body += self._bullets("Who knows", who)
        body += self._bullets("Foreshadowing", fore_lines)
        body += self._section("Notes", t.get("notes"))

        fm = self._frontmatter({"name": t["title"], "type": "twist",
                                "twist_type": t.get("twist_type"), "status": t.get("status")})
        self._write_entity_note(FOLDER_TWISTS, t["title"], fm, body)

    def quick_note_files(self):
        for q in self.quick_notes:
            content = _clean_paragraphs(q.get("content") or "")
            if not content:
                continue
            fm = self._frontmatter({"type": "quick note", "note_type": q.get("note_type"),
                                    "created": q.get("created_at")})
            self._write_entity_note(FOLDER_QUICKNOTES, content[:40], fm, content + "\n\n")

    def overview_file(self):
        lines = []
        if self.author_name:
            lines.append(f"Author: {self.author_name}")
        for key in ("genre", "story_language"):
            if self.config.get(key):
                lines.append(f"{key.replace('_', ' ').title()}: {self.config[key]}")
        if (self.calendar or {}).get("calendar_enabled") == "true":
            try:
                months = json.loads(self.calendar.get("months") or "[]")
            except (ValueError, TypeError):
                months = []
            lines.append(f"Calendar epoch: {self.calendar.get('epoch_label', '')}")
            lines.append("Calendar months: " + ", ".join(m.get("name", "") for m in months if isinstance(m, dict)))
            lines.append(f"Story starts: {self.calendar.get('story_start_year', '')}-"
                         f"{self.calendar.get('story_start_month', '')}-{self.calendar.get('story_start_day', '')}")

        counts = [
            ("Chapters", len(self.chapters)),
            ("Characters", len(self.characters)),
            ("Locations", len(self.locations)),
            ("Groups", len(self.groups)),
            ("Lore entities", len(self.lore)),
            ("Quick notes", len(self.quick_notes)),
            ("Twists", len(self.twists)),
            ("Secrets", len(self.secrets)),
        ]

        body = self._frontmatter({"name": self.project_title, "type": "project",
                                  "exported": self.today, "author": self.author_name or None})
        body += f"# {self.project_title}\n\n"
        if lines:
            body += _clean_paragraphs("\n".join(lines)) + "\n\n"
        body += self._bullets("Contents", [f"{k}: {v}" for k, v in counts])
        body += ("## Not exported\n\nPlot planner, Pentimento (writing-process telemetry), "
                 "world history timeline, sketchboards, statistics and achievements are "
                 "FleshNote-specific features and are not part of this export.\n")

        self._write(f"Project Overview.{self._ext()}", body)

    def _appears_section(self, paths):
        if not paths:
            return ""
        if self.fmt == "obsidian":
            items = [f"[[{p}|{p.split('/')[-1]}]]" for p in paths]
        else:
            items = [p.split("/")[-1] for p in paths]
        return self._bullets("Appears in", items)

    # ── orchestration ────────────────────────────────────────────────────

    def _write_entity_note(self, folder, title, frontmatter, body):
        name = self._unique_filename(folder, title)
        self._write(f"{folder}/{name}.{self._ext()}", frontmatter + body)

    def export(self, dest_dir):
        if not os.path.exists(self.db_path):
            raise ValueError("Not a FleshNote project (missing fleshnote.db)")

        conn = self._connect()
        try:
            self._load_all_data(conn)
        finally:
            conn.close()
        self._build_name_map()

        base = _sanitize_filename(self.project_title)
        final = os.path.join(dest_dir, base + _FMT_SUFFIX[self.fmt])
        if os.path.exists(final):
            raise ValueError(f"Destination folder already exists: {final}")

        from datetime import date
        self.today = date.today().isoformat()
        self.used_names = {}
        self.chapter_paths = {}
        self.file_count = 0

        self.root = final
        os.makedirs(self.root, exist_ok=True)

        self.copy_attachments()
        self.manuscript_files()
        for c in self.characters:
            self.character_note(c)
        for l in self.locations:
            self.location_note(l)
        for g in self.groups:
            self.group_note(g)
        for e in self.lore:
            self.lore_note(e)
        for s in self.secrets:
            self.secret_note(s)
        for t in self.twists:
            self.twist_note(t)
        self.quick_note_files()
        self.overview_file()

        return final, self.file_count


def export_vault(project_path, dest_dir, fmt="obsidian"):
    """Returns (final_folder, file_count)."""
    return VaultExporter(project_path, fmt).export(dest_dir)

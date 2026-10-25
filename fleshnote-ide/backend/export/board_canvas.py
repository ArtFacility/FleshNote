"""Sketchboards as JSON Canvas (https://jsoncanvas.org), the .canvas files Obsidian opens.

The same mapping as the board's own Canvas export in the app
(src/renderer/src/components/sketchboard/canvasFile.js), with one addition for
a vault: a node linked to an entity becomes a file card showing that entity's
note. The format has text cards, file cards, groups and straight connections
between sides, so shapes, line bends, dashes, end shapes other than arrows,
the legend and times are left out.

Live boards (relationships, factions) store only where their entities sit; their
lines are worked out here as they stand at the end of the story: each
direction's latest relationship turning point, and every faction membership.
"""

import json

# Brand colours as JSON Canvas presets ("1" red ... "6" purple).
_TO_PRESET = {"red": "1", "amber": "2", "green": "4", "blue": "5", "purple": "6"}
_SIDES = ("top", "right", "bottom", "left")

# Relationship types the tracker offers, as line colours; anything else is neutral.
_REL_COLOR = {
    "friendship": "green", "love": "red", "hate": "red", "spite": "purple",
    "guilt": "purple", "trust": "blue", "distrust": "amber",
}


def _round(v):
    try:
        return round(float(v))
    except (TypeError, ValueError):
        return 0


def _color(token):
    preset = _TO_PRESET.get(token)
    return {"color": preset} if preset else {}


def _card_text(n):
    name = (n.get("entity_name") or n.get("name") or "").strip()
    if n.get("shape") == "text":
        return name
    props = "\n".join(
        f"- {k}{': ' if k and v else ''}{v}" for k, v in (n.get("props") or []) if k or v)
    parts = [f"**{name}**" if name else "", (n.get("description") or "").strip(), props]
    return "\n\n".join(p for p in parts if p)


def _rel_label(rel_type):
    k = (rel_type or "").lower()
    return k.capitalize() if k in _REL_COLOR else (rel_type or "")


def live_edges(data, items):
    """The connections a live board draws at the end of the story, as board
    connections between its nodes. `data` is routes.boards.generated_data."""
    node_of = {(it["entity_type"], it["entity_id"]): it["id"]
               for it in items if it.get("entity_type") and it.get("entity_id")}
    out = []

    def add(key, a, b, **look):
        start, end = node_of.get(a), node_of.get(b)
        if start and end and start != end:
            out.append({"id": key, "item_start_id": start, "item_end_id": end,
                        "from_side": "auto", "to_side": "auto",
                        "start_marker": "none", "end_marker": "arrow",
                        "color_token": "neutral", "title": "", **look})

    if data.get("kind") == "relationships":
        latest = {(p["from"], p["to"]): p["history"][-1] for p in data.get("pairs", []) if p.get("history")}
        for (a, b), row in latest.items():
            back = latest.get((b, a))
            shared = row.get("mutual") and back is not None and back["id"] == row["id"]
            if shared and a > b:
                continue
            add(f"rel:{a}>{b}", ("character", a), ("character", b),
                start_marker="arrow" if shared else "none",
                color_token=_REL_COLOR.get((row.get("rel_type") or "").lower(), "neutral"),
                title=_rel_label(row.get("rel_type")))
        return out

    for link in data.get("links", []):
        role = link.get("role_title") or ""
        title = f"{role} (left)" if link.get("left_date") and role else ("left" if link.get("left_date") else role)
        add(f"member:{link['id']}", ("character", link["character_id"]), ("group", link["group_id"]),
            color_token="neutral" if link.get("left_date") else "amber", title=title)
    for p in data.get("parents", []):
        add(f"parent:{p['from']}", ("group", p["from"]), ("group", p["to"]), title="part of")
    return out


def board_canvas(items, connections, file_of=None, types=()):
    """A board as a JSON Canvas document (a string). `file_of(entity_type,
    entity_id)` gives the vault path of an entity's note, or None. The legend
    doesn't travel, so an unlabelled line of a type is labelled with the type's name."""
    ids = {n["id"] for n in items}
    type_name = {t["id"]: t["name"] for t in types}
    # Groups first: later nodes sit on top.
    ordered = sorted(items, key=lambda n: 0 if n.get("shape") == "frame" else 1)
    nodes = []
    for n in ordered:
        base = {"id": n["id"], "x": _round(n.get("pos_x")), "y": _round(n.get("pos_y")),
                "width": _round(n.get("size_x")), "height": _round(n.get("size_y")),
                **_color(n.get("color_token"))}
        path = file_of(n["entity_type"], n["entity_id"]) if (
            file_of and n.get("entity_type") and n.get("entity_id") and n.get("shape") != "frame") else None
        if n.get("shape") == "frame":
            nodes.append({**base, "type": "group", "label": (n.get("name") or "").strip()})
        elif path:
            nodes.append({**base, "type": "file", "file": path})
        else:
            nodes.append({**base, "type": "text", "text": _card_text(n)})
    edges = []
    for c in connections:
        if c["item_start_id"] not in ids or c["item_end_id"] not in ids:
            continue
        e = {"id": c["id"], "fromNode": c["item_start_id"]}
        if c.get("from_side") in _SIDES:
            e["fromSide"] = c["from_side"]
        e["fromEnd"] = "arrow" if c.get("start_marker") not in (None, "none") else "none"
        e["toNode"] = c["item_end_id"]
        if c.get("to_side") in _SIDES:
            e["toSide"] = c["to_side"]
        e["toEnd"] = "arrow" if c.get("end_marker") not in (None, "none") else "none"
        e.update(_color(c.get("color_token")))
        label = c.get("title") or type_name.get(c.get("type_id"))
        if label:
            e["label"] = label
        edges.append(e)
    return json.dumps({"nodes": nodes, "edges": edges}, ensure_ascii=False, indent="\t")

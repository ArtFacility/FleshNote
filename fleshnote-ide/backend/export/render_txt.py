def runs_text(runs, note_ref=lambda n: "[%d]" % n) -> str:
    return "".join("\n" if r.kind == "br" else note_ref(r.data.get("n", 0)) if r.kind == "fnref" else r.text
                   for r in runs)


def render(project_title, author_name, chapters) -> str:
    """Plain text: blank lines between paragraphs, notes collected at the end."""
    out = [project_title.upper()]
    if author_name:
        out.append("by %s" % author_name)
    out += ["", ""]
    notes = []

    for ch in chapters:
        offset = len(notes)
        notes.extend(ch.footnotes)

        def ref(n, offset=offset):
            return "[%d]" % (offset + n)

        if ch.label:
            out.append(ch.label)
        out.append(ch.title.upper())
        out.append("-" * max(3, len(ch.title)))
        out.append("")
        for b in ch.blocks:
            if b.kind == "scene":
                out.append("* * *")
            elif b.kind == "li":
                bullet = "%d. " % b.number if b.ordered else "- "
                out.append("  " * b.level + bullet + runs_text(b.runs, ref))
            elif b.kind == "quote":
                out.append("\n".join("    " + line for line in runs_text(b.runs, ref).split("\n")))
            else:
                out.append(runs_text(b.runs, ref))
            out.append("")
        out += ["", ""]

    if notes:
        out += ["NOTES", "-----", ""]
        for i, note in enumerate(notes, 1):
            out += ["[%d] %s" % (i, note), ""]
    return "\n".join(out).rstrip() + "\n"

"""
FleshNote IDE — Architecture Engine Test Suite
ASCII-renders dual narrative curves (# amber stakes, o blue state, X overlap),
prints marker/act labels, runs assertion batteries, and sweeps combination
matrices. Run directly:  python backend/test_architecture_engine.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from architecture_engine import (
    transform_curve,
    apply_pressure_profile,
    apply_pressure_profile as _app,
    synthesize_stack,
    pick_arc_for_sliders,
    pick_variant_for_sliders,
    suggest_word_count,
    ENGINE_VISUALS,
    LENGTH_CONVENTIONS,
)
from framework_presets import (
    FRAMEWORKS,
    FRAMEWORK_VARIANTS,
    resolve_framework,
    EMOTIONAL_ARCS,
    DRAMATIC_ENGINES,
)
import random

PASS, FAIL = [], []


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
    else:
        FAIL.append(f"{name} {detail}")


# ─────────────────────────────────────────────────────────────────────────────
# ASCII dual-curve renderer
# ─────────────────────────────────────────────────────────────────────────────

def render_ascii(external, internal=None, width=24, height=11, title=""):
    grid = [[" "] * width for _ in range(height)]

    def plot(pts, ch):
        for pt in pts:
            x = int(round(pt["pct"] / 100.0 * (width - 1)))
            y = int(round((1.0 - pt.get("tension", pt.get("state", 0.5))) * (height - 1)))
            grid[y][x] = ch if grid[y][x] == " " else "X"

    plot(external, "#")
    if internal:
        plot([{"pct": p["pct"], "tension": p["state"]} for p in internal], "o")

    lines = []
    if title:
        lines.append(title)
    lines.append("1.0 |" + "".join(grid[0]))
    for r in range(1, height):
        lines.append("    |" + "".join(grid[r]))
    lines.append("    +" + "-" * width)
    lines.append("    0%" + " " * (width - 7) + "50%   100%")
    return "\n".join(lines)


def labels_for(fw_resolved):
    markers = [m["title"] for m in fw_resolved.get("craft_markers", [])]
    arcs = [a["name"] for a in fw_resolved.get("arcs", [])]
    return markers, arcs


# ─────────────────────────────────────────────────────────────────────────────
# 1. Slider transform assertions
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 72)
print("1. SLIDER TRANSFORM ASSERTIONS (three_act base)")
print("=" * 72)

base = FRAMEWORKS["three_act"]["curve_points"]

for combo in [
    {"intensity": 0}, {"intensity": 1}, {"polarity": -1}, {"polarity": 1},
    {"pace": 0}, {"pace": 1},
    {"intensity": 1, "polarity": -1, "pace": 0},
    {"intensity": 1, "polarity": 1, "pace": 1},
]:
    out = transform_curve(base, **combo)
    vals = [p["tension"] for p in out]
    check(
        f"range {combo}",
        all(0.0 <= v <= 1.0 for v in vals),
        f"min={min(vals)} max={max(vals)}",
    )

low_end = transform_curve(base, polarity=-1)[-1]["tension"]
high_end = transform_curve(base, polarity=1)[-1]["tension"]
check("polarity lowers ending", low_end < high_end, f"low={low_end} high={high_end}")

peak_i0 = max(p["tension"] for p in transform_curve(base, intensity=0))
peak_i1 = max(p["tension"] for p in transform_curve(base, intensity=1))
check("intensity raises peak", peak_i1 > peak_i0, f"i0={peak_i0} i1={peak_i1}")

mid_slow = [p["pct"] for p in transform_curve(base, pace=0) if p["tension"] >= 0.5]
mid_fast = [p["pct"] for p in transform_curve(base, pace=1) if p["tension"] >= 0.5]
check("pace warps timing", min(mid_fast) <= min(mid_slow) if mid_slow and mid_fast else True,
      f"fast_first_high={min(mid_fast) if mid_fast else None} slow_first_high={min(mid_slow) if mid_slow else None}")

print()
print(render_ascii(
    transform_curve(base, intensity=1, polarity=-1, pace=1),
    None,
    title="three_act @ intensity=1 polarity=-1 pace=1 (breakneck tragic):",
))
print()

# ─────────────────────────────────────────────────────────────────────────────
# 2. Variant distinctness + label resolution
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 72)
print("2. VARIANT SWEEP (labels + curves per sub-architecture)")
print("=" * 72)

for fw_id, variants in FRAMEWORK_VARIANTS.items():
    if not variants:
        continue
    fw_base = FRAMEWORKS[fw_id]
    for v in variants:
        if v.get("curve_points"):
            differs = v["curve_points"] != fw_base["curve_points"]
            check(f"{fw_id}/{v['id']} curve differs from base", differs)
    resolved = resolve_framework(fw_id, variants[0]["id"])
    check(f"{fw_id} default variant resolves", resolved is not None)

tragic = resolve_framework("three_act", "tragic_descent")
tragic_markers, tragic_arcs = labels_for(tragic)
check("tragic marker renamed", "Illicit Triumph" in tragic_markers, str(tragic_markers))
check("tragic arc renamed", any("Catastrophe" in a for a in tragic_arcs), str(tragic_arcs))

print()
for fw_id in ("three_act", "five_act", "romancing_the_beat"):
    for v in FRAMEWORK_VARIANTS.get(fw_id, []):
        r = resolve_framework(fw_id, v["id"])
        m, a = labels_for(r)
        print(f"{fw_id}/{v['id']:16s} markers={m[:3]}{'…' if len(m) > 3 else ''} arcs={a}")
print()

# ─────────────────────────────────────────────────────────────────────────────
# 3. Engine pressure profiles — every engine must visibly change the curve
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 72)
print("3. DRAMATIC ENGINE PRESSURE PROFILES (applied to three_act base)")
print("=" * 72)

for engine in DRAMATIC_ENGINES:
    shaped = apply_pressure_profile(base, engine["id"])
    delta = max(abs(a["tension"] - b["tension"]) for a, b in zip(base, shaped))
    check(f"engine {engine['id']} alters curve", delta > 0.02, f"max_delta={delta:.3f}")
    check(f"engine {engine['id']} in range", all(0 <= p["tension"] <= 1 for p in shaped))
    check(f"engine {engine['id']} has axis caption", engine["id"] in ENGINE_VISUALS)

print()
for engine in DRAMATIC_ENGINES[:6]:
    shaped = apply_pressure_profile(base, engine["id"])
    print(render_ascii(shaped, None, width=40, title=f"{engine['name']} ({engine['id']}):"))
print()

# ─────────────────────────────────────────────────────────────────────────────
# 4. Emotional arc matching under slider extremes
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 72)
print("4. EMOTIONAL ARC MATCHING")
print("=" * 72)

check("tragic pull matches negative arc", pick_arc_for_sliders(0.7, -0.9)["id"] in ("oedipus", "fall_arc", "disillusionment", "from_bad_to_worse"),
      pick_arc_for_sliders(0.7, -0.9)["id"])
check("triumphant pull matches positive arc", pick_arc_for_sliders(0.8, 0.9)["id"] in ("boy_meets_girl", "cinderella", "positive_change", "corruption"),
      pick_arc_for_sliders(0.8, 0.9)["id"])
check("flat sliders match flat-ish arc", pick_arc_for_sliders(0.3, 0.0)["id"] in ("flat_arc", "which_way_is_up", "disillusionment"),
      pick_arc_for_sliders(0.3, 0.0)["id"])

for intensity, polarity in [(0.8, -0.9), (0.6, 0.8), (0.2, 0.0), (0.5, -0.4)]:
    arc = pick_arc_for_sliders(intensity, polarity)
    internal = transform_curve(arc["internal_curve"], intensity=intensity, polarity=polarity, field="state")
    print()
    print(f"intensity={intensity} polarity={polarity} -> {arc['name']} ({arc['id']})")
    print(render_ascii(apply_pressure_profile(base, "golden_fleece"), internal, width=40))

# ─────────────────────────────────────────────────────────────────────────────
# 5. Full synthesis matrix — every corner must produce a coherent stack
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 72)
print("5. SYNTHESIS MATRIX (3x3x3 corners + showcase)")
print("=" * 72)

for intensity in (0.0, 0.5, 1.0):
    for polarity in (-1.0, 0.0, 1.0):
        for pace in (0.0, 0.5, 1.0):
            res = synthesize_stack("fantasy", "quest", intensity, polarity, pace)
            s = res["primary"]
            check(f"stack i={intensity} p={polarity} v={pace}", s is not None)
            if s:
                check(
                    f"stack curves valid i={intensity} p={polarity} v={pace}",
                    all(0 <= pt["tension"] <= 1 for pt in s["curve_points"])
                    and all(0 <= pt["state"] <= 1 for pt in s["internal_curve"]),
                )

res = synthesize_stack("fantasy", "quest", 0.85, -0.85, 0.6)
s = res["primary"]
print(f"fantasy/quest  i=0.85 p=-0.85 v=0.6 → {s['name']} / {s['variant_label']} / arc: {s['arc_name']} (goal={res['goal']})")
print(render_ascii(s["curve_points"], s["internal_curve"], width=40))
r2 = resolve_framework(s["framework_id"], s["variant_id"])
m, a = labels_for(r2)
print(f"markers={m}")
print(f"acts={a}")
print()

# ─────────────────────────────────────────────────────────────────────────────
# 6. FUZZ INVARIANTS — 80 random stacks must stay coherent
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 72)
print("6. FUZZ INVARIANTS (random genre × archetype × slider combos)")
print("=" * 72)

AGGRESSIVE_ENGINES = ("monster_in_the_house", "dude_with_a_problem", "tragedy_engine", "institutionalized")
DARK_ARCS = ("fall_arc", "disillusionment", "from_bad_to_worse")

rng = random.Random(42)
genres = ["fantasy", "sci-fi", "thriller", "romance", "horror", "mystery", "literary"]
archetypes = ["quest", "monster", "voyage", "tragedy", "rags", "comedy", "rebirth"]

for n in range(80):
    g = rng.choice(genres)
    a = rng.choice(archetypes)
    i = rng.uniform(0, 1)
    p = rng.uniform(-1, 1)
    v = rng.uniform(0, 1)
    res = synthesize_stack(g, a, i, p, v)
    for s in res["stacks"]:
        tag = f"fuzz{n}({g},{a},i={i:.2f},p={p:.2f},v={v:.2f})/{s['framework_id']}"
        fw_variants = [x["id"] for x in FRAMEWORK_VARIANTS.get(s["framework_id"], [])]
        check(f"{tag} variant belongs to framework", s["variant_id"] in fw_variants or not fw_variants)
        check(f"{tag} arc exists", any(x["id"] == s["arc_id"] for x in EMOTIONAL_ARCS))
        check(
            f"{tag} curves in range",
            all(0 <= pt["tension"] <= 1 for pt in s["curve_points"])
            and all(0 <= pt["state"] <= 1 for pt in s["internal_curve"]),
        )
        # Non-conflict traditions must never carry an aggressive engine
        if s["framework_id"] == "kishotenketsu":
            check(f"{tag} kisho engine redirected", s["engine_id"] not in AGGRESSIVE_ENGINES, s["engine_id"])
        # Dark arc on a framework that HAS a dark variant → variant must be it
        if s["arc_id"] in DARK_ARCS:
            dark_vars = [
                x["id"]
                for x in FRAMEWORK_VARIANTS.get(s["framework_id"], [])
                if x.get("arc_id") and (x.get("arc_id") in DARK_ARCS)
            ]
            if dark_vars:
                check(f"{tag} dark arc → dark variant", s["variant_id"] in dark_vars, s["variant_id"])
        # Length suggestion conventions
        ln = s["length"]
        conv = LENGTH_CONVENTIONS[s["framework_id"]]
        check(f"{tag} length in range", conv["min"] <= ln["suggested"] <= conv["max"], str(ln))
        check(f"{tag} length 500-step", ln["suggested"] % 500 == 0, str(ln["suggested"]))

# ─────────────────────────────────────────────────────────────────────────────
# 7. SUGGESTED LENGTH CONVENTIONS
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 72)
print("7. SUGGESTED LENGTH CONVENTIONS")
print("=" * 72)

for fw_id, conv in LENGTH_CONVENTIONS.items():
    s = suggest_word_count(fw_id, genre="thriller")["suggested"]
    check(f"{fw_id} thriller base in range", conv["min"] <= s <= conv["max"], str(s))

romance_len = suggest_word_count("romancing_the_beat", genre="romance")["suggested"]
epic_len = suggest_word_count("heros_journey", "golden_fleece", genre="fantasy")["suggested"]
check("romance shorter than epic fantasy", romance_len < epic_len, f"{romance_len} vs {epic_len}")

grim_len = suggest_word_count("three_act", "tragedy_engine", "literary", {"polarity": -0.9, "intensity": 0.4})["suggested"]
check("bleak stories trend leaner", grim_len < suggest_word_count("three_act", genre="literary")["suggested"],
      f"{grim_len}")

print()
for fw_id in LENGTH_CONVENTIONS:
    r_f = suggest_word_count(fw_id, genre="fantasy")
    r_m = suggest_word_count(fw_id, genre="mystery")
    print(f"{fw_id:20s} fantasy={r_f['suggested']:6d}  mystery={r_m['suggested']:6d}  "
          f"range=[{r_f['min']}-{r_f['max']}]")
print()

# ─────────────────────────────────────────────────────────────────────────────

print("=" * 72)
print(f"RESULTS: {len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    for f in FAIL:
        print(f"  FAIL: {f}")
    sys.exit(1)
print("ALL OK")

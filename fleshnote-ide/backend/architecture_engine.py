"""
FleshNote IDE — Procedural Architecture Engine
Composable transforms for narrative curves: slider-driven synthesis (Simple mode),
Layer 1 dramatic-engine pressure profiles, and curve utilities shared by the
testing suite. Pure functions, no DB access.
"""

import math
from typing import Dict, Any, List, Optional

from framework_presets import (
    FRAMEWORKS,
    FRAMEWORK_VARIANTS,
    FRAMEWORK_DEFAULT_ARC,
    EMOTIONAL_ARCS,
    calculate_recommendations,
    infer_engine_for_archetype,
    resolve_framework,
)


# ─────────────────────────────────────────────────────────────────────────────
# Curve primitives
# ─────────────────────────────────────────────────────────────────────────────

def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _sample(points: List[Dict[str, Any]], pct: float, field: str) -> float:
    """Linear interpolation of a curve at an arbitrary percentage."""
    if not points:
        return 0.5
    pts = sorted(points, key=lambda p: p["pct"])
    if pct <= pts[0]["pct"]:
        return pts[0][field]
    if pct >= pts[-1]["pct"]:
        return pts[-1][field]
    for i in range(len(pts) - 1):
        if pts[i]["pct"] <= pct <= pts[i + 1]["pct"]:
            span = pts[i + 1]["pct"] - pts[i]["pct"] or 1.0
            t = (pct - pts[i]["pct"]) / span
            return pts[i][field] + t * (pts[i + 1][field] - pts[i][field])
    return 0.5


def _bump(pct: float, center: float, width: float = 12.0) -> float:
    """Gaussian bump centered on a timeline percentage (0..1 amplitude)."""
    return math.exp(-((pct - center) ** 2) / (2.0 * width * width))


def _ramp(pct: float) -> float:
    return pct / 100.0


def _blend_to(v: float, target: float, weight: float = 0.4) -> float:
    """Delta that pulls v toward a target shape without erasing it.
    weight=0 → no change; weight=1 → full replacement."""
    return weight * (target - v)


# ─────────────────────────────────────────────────────────────────────────────
# Slider transforms — compose on top of any base/variant curve
# ─────────────────────────────────────────────────────────────────────────────

def transform_curve(
    points: List[Dict[str, Any]],
    intensity: Optional[float] = None,
    polarity: Optional[float] = None,
    pace: Optional[float] = None,
    field: str = "tension",
) -> List[Dict[str, Any]]:
    """
    Applies composable slider transforms to a curve:
      intensity (0..1): rescales amplitude around the 0.5 midline.
      polarity  (-1..+1): biases the final third toward collapse (-) or triumph (+).
      pace      (0..1): time-warps the shape — slow burn delays events into Act I,
                          breakneck compresses them. The 0/50/100 anchors stay fixed.
    Always returns points on the original pct grid, values clamped to [0, 1].
    """
    if not points:
        return []
    base = sorted([dict(p) for p in points], key=lambda p: p["pct"])
    out: List[Dict[str, Any]] = []

    gamma = None
    if pace is not None:
        # Slow burn (pace 0) delays events → sample earlier original positions;
        # breakneck (pace 1) pulls them forward. 1.2 delayed → 0.8 accelerated.
        gamma = 1.2 - clamp(pace) * 0.4

    for pt in base:
        pct = float(pt["pct"])
        v = float(pt[field])

        # ── pace: piecewise time-warp, resampled back onto the original grid ──
        # Act III (pct >= 75) stays unwrapped: climax and resolution timing are
        # convention-fixed; slow burn/breakneck only reshape Acts I and II.
        if gamma is not None and gamma != 1.0 and 0 < pct < 75:
            if pct <= 50:
                warped = 50.0 * ((pct / 50.0) ** gamma)
            else:
                warped = 50.0 + 25.0 * (((pct - 50.0) / 25.0) ** gamma)
            v = _sample(base, warped, field)

        # ── intensity: amplitude around midline ──
        if intensity is not None:
            k = 0.7 + clamp(intensity) * 0.6
            v = 0.5 + (v - 0.5) * k

        # ── polarity: bias the final third ──
        if polarity is not None and polarity != 0:
            late_w = clamp((pct - 55.0) / 45.0)
            v += polarity * 0.18 * late_w
            if polarity < 0:
                v += polarity * 0.1 * late_w * late_w  # extra sag toward collapse

        out.append({"pct": pt["pct"], field: round(clamp(v), 4)})

    return out


# ─────────────────────────────────────────────────────────────────────────────
# Layer 1: Dramatic-engine pressure profiles + visual metadata
# profile(curve_value, pct) -> delta applied to the base curve value
# ─────────────────────────────────────────────────────────────────────────────

ENGINE_VISUALS: Dict[str, Dict[str, Any]] = {
    "monster_in_the_house": {
        "axis_caption_key": "engineAxisMonster",
        "fits": ["save_the_cat", "three_act", "seven_point", "story_circle"],
        "profile": lambda v, pct: _blend_to(
            v, 0.15 + 0.85 * _ramp(pct) ** 1.3 + 0.1 * _bump(pct, 88, 10), 0.4
        ),
    },
    "golden_fleece": {
        "axis_caption_key": "engineAxisFleece",
        "fits": ["heros_journey", "three_act", "story_circle", "kishotenketsu"],
        "profile": lambda v, pct: 0.12 * math.sin((pct / 100.0) * 2 * math.pi),
    },
    "voyage_and_return": {
        "axis_caption_key": "engineAxisVoyage",
        "fits": ["heros_journey", "story_circle", "kishotenketsu"],
        "profile": lambda v, pct: -0.11 * _bump(pct, 62, 16) + 0.08 * _bump(pct, 90, 10),
    },
    "rags_to_riches": {
        "axis_caption_key": "engineAxisRags",
        "fits": ["three_act", "story_circle", "save_the_cat", "romancing_the_beat"],
        "profile": lambda v, pct: -0.12 * _bump(pct, 33, 12) - 0.14 * _bump(pct, 68, 12) + 0.1 * _ramp(pct),
    },
    "comedy_engine": {
        "axis_caption_key": "engineAxisComedy",
        "fits": ["story_circle", "romancing_the_beat", "three_act", "save_the_cat"],
        "profile": lambda v, pct: 0.1 * math.sin((pct / 100.0) * math.pi * 3),
    },
    "tragedy_engine": {
        "axis_caption_key": "engineAxisTragedy",
        "fits": ["five_act", "three_act", "save_the_cat"],
        "profile": lambda v, pct: (v ** 1.25) - v,
    },
    "rebirth": {
        "axis_caption_key": "engineAxisRebirth",
        "fits": ["three_act", "story_circle", "romancing_the_beat", "kishotenketsu"],
        "profile": lambda v, pct: -0.13 * _bump(pct, 30, 12) + 0.08 * _bump(pct, 18, 8) + 0.11 * clamp((pct - 60.0) / 40.0),
    },
    "dude_with_a_problem": {
        "axis_caption_key": "engineAxisDude",
        "fits": ["save_the_cat", "seven_point", "three_act"],
        "profile": lambda v, pct: 0.13 * _bump(pct, 10, 9) + 0.07 * _ramp(pct),
    },
    "buddy_love": {
        "axis_caption_key": "engineAxisBuddy",
        "fits": ["romancing_the_beat", "story_circle", "three_act"],
        "profile": lambda v, pct: 0.09 * _bump(pct, 45, 13) + 0.1 * _bump(pct, 86, 10),
    },
    "whydunit": {
        "axis_caption_key": "engineAxisWhydunit",
        "fits": ["seven_point", "save_the_cat", "three_act"],
        "profile": lambda v, pct: (round(clamp(v, 0.1, 0.95) * 4) / 4.0) - v,
    },
    "fool_triumphant": {
        "axis_caption_key": "engineAxisFool",
        "fits": ["story_circle", "three_act", "save_the_cat"],
        "profile": lambda v, pct: -0.1 * _bump(pct, 52, 12) + 0.09 * _ramp(pct),
    },
    "out_of_the_bottle": {
        "axis_caption_key": "engineAxisBottle",
        "fits": ["three_act", "save_the_cat", "kishotenketsu"],
        "profile": lambda v, pct: 0.11 * _bump(pct, 72, 13),
    },
    "rites_of_passage": {
        "axis_caption_key": "engineAxisRites",
        "fits": ["three_act", "seven_point", "story_circle"],
        "profile": lambda v, pct: v * (0.75 + 0.25 * _ramp(pct)) - v,
    },
    "institutionalized": {
        "axis_caption_key": "engineAxisInstitution",
        "fits": ["five_act", "three_act", "seven_point"],
        "profile": lambda v, pct: _blend_to(v, 0.15 + 0.65 * _ramp(pct), 0.4),
    },
}


def apply_pressure_profile(
    points: List[Dict[str, Any]], engine_id: Optional[str], field: str = "tension"
) -> List[Dict[str, Any]]:
    """Reshapes a curve according to its dramatic engine's pressure profile."""
    meta = ENGINE_VISUALS.get(engine_id or "")
    if not meta:
        return [dict(p) for p in points]
    out = []
    for pt in points:
        pct = float(pt["pct"])
        v = float(pt[field])
        v = clamp(v + meta["profile"](v, pct))
        out.append({"pct": pt["pct"], field: round(v, 4)})
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Layer 3: emotional-arc feature extraction (for slider-distance matching)
# ─────────────────────────────────────────────────────────────────────────────

def arc_features(arc: Dict[str, Any]) -> Dict[str, float]:
    curve = arc.get("internal_curve", [])
    if not curve:
        return {"polarity": 0.0, "amplitude": 0.0}
    states = [p["state"] for p in curve]
    return {
        "polarity": states[-1] - states[0],
        "amplitude": max(states) - min(states),
    }


def pick_arc_for_sliders(intensity: float, polarity: float) -> Dict[str, Any]:
    """Chooses the emotional arc whose shape best matches the slider coordinates."""
    target_pol = clamp(polarity, -1, 1) * 0.6
    target_amp = 0.3 + clamp(intensity) * 0.5
    best, best_score = None, None
    for arc in EMOTIONAL_ARCS:
        f = arc_features(arc)
        score = (f["polarity"] - target_pol) ** 2 + 0.5 * (f["amplitude"] - target_amp) ** 2
        if best_score is None or score < best_score:
            best, best_score = arc, score
    return best


# Variant polarity hints — static table with keyword fallback
_VARIANT_POLARITY_HINTS: Dict[str, float] = {
    "tragic_descent": -0.85,
    "dark_finale": -0.9,
    "tragic_parting": -0.7,
    "disillusionment": -0.6,
    "restoration": 0.45,
    "heroine_integration": 0.3,
    "quiet_coda": 0.1,
    "hfn": 0.35,
    "bittersweet": 0.15,
    "false_victory": 0.1,
    "false_defeat": -0.15,
    "double_rupture": 0.0,
    "chaos_start": -0.2,
}

def variant_polarity_hint(variant_id: Optional[str]) -> float:
    if not variant_id:
        return 0.0
    if variant_id in _VARIANT_POLARITY_HINTS:
        return _VARIANT_POLARITY_HINTS[variant_id]
    lowered = variant_id.lower()
    if any(w in lowered for w in ("tragic", "dark", "fall", "ruin", "collapse")):
        return -0.8
    if any(w in lowered for w in ("restor", "rebirth", "triumph", "happy", "redempt")):
        return 0.5
    return 0.0


def pick_variant_for_sliders(framework_id: str, polarity: float) -> str:
    """Chooses the structure flavor whose emotional direction matches the sliders.
    The canonical 'classic' variant is preferred unless a flavored variant is a
    decisively better polarity match (avoids loading semantic-heavy variants on
    mid-range slider positions)."""
    variants = FRAMEWORK_VARIANTS.get(framework_id, [])
    if not variants:
        return ""
    target = clamp(polarity, -1, 1)
    best = min(
        variants,
        key=lambda v: (variant_polarity_hint(v["id"]) - target) ** 2,
    )
    classic = next((v for v in variants if v["id"] == "classic"), None)
    if classic:
        d_classic = (0.0 - target) ** 2
        d_best = (variant_polarity_hint(best["id"]) - target) ** 2
        if d_classic <= d_best + 0.15:
            return classic["id"]
    return best["id"]


# ─────────────────────────────────────────────────────────────────────────────
# SUGGESTED MANUSCRIPT LENGTH (established publishing conventions, in words)
# Base range per macro framework; genre/engine/driver modifiers adjust it.
# Suggestions are always rounded to 500-word steps.
# ─────────────────────────────────────────────────────────────────────────────
LENGTH_CONVENTIONS: Dict[str, Dict[str, int]] = {
    # framework: min / max / base — mainstream commercial norms per structure
    "three_act":          {"min": 70000, "max": 100000, "base": 85000},
    "five_act":           {"min": 60000, "max": 95000,  "base": 75000},
    "heros_journey":      {"min": 90000, "max": 140000, "base": 110000},
    "story_circle":       {"min": 55000, "max": 85000,  "base": 70000},
    "kishotenketsu":      {"min": 50000, "max": 85000,  "base": 65000},
    "save_the_cat":       {"min": 70000, "max": 100000, "base": 85000},
    "seven_point":        {"min": 75000, "max": 110000, "base": 90000},
    "romancing_the_beat": {"min": 50000, "max": 90000,  "base": 75000},
    "custom":             {"min": 40000, "max": 160000, "base": 80000},
}

GENRE_LENGTH_OFFSETS: Dict[str, int] = {
    "fantasy": 15000,
    "sci-fi": 10000,
    "thriller": 0,
    "romance": -15000,
    "horror": -10000,
    "mystery": 0,
    "literary": -5000,
    "custom": 0,
}

ENGINE_LENGTH_OFFSETS: Dict[str, int] = {
    "golden_fleece": 10000,
    "voyage_and_return": 5000,
    "monster_in_the_house": 0,
    "dude_with_a_problem": -5000,
    "whydunit": -5000,
    "buddy_love": -5000,
    "comedy_engine": -5000,
    "tragedy_engine": 0,
    "rebirth": 0,
    "fool_triumphant": 0,
    "out_of_the_bottle": 0,
    "rites_of_passage": 0,
    "institutionalized": 5000,
}


def suggest_word_count(
    framework_id: str,
    engine_id: Optional[str] = None,
    genre: str = "fantasy",
    drivers: Optional[Dict[str, float]] = None,
) -> Dict[str, int]:
    """
    Suggests a target word count from publishing conventions for the stack:
    framework base range, adjusted by genre offset, engine offset, and drivers
    (strongly bleak journeys trend leaner; maximal escalation needs more room).
    Returns {min, max, suggested}, suggested rounded to a 500-word step.
    """
    conv = LENGTH_CONVENTIONS.get(framework_id, LENGTH_CONVENTIONS["custom"])
    base = conv["base"]
    base += GENRE_LENGTH_OFFSETS.get((genre or "").lower(), 0)
    base += ENGINE_LENGTH_OFFSETS.get(engine_id or "", 0)
    if drivers:
        pol = float(drivers.get("polarity", 0) or 0)
        inten = float(drivers.get("intensity", 0.5) or 0.5)
        if pol <= -0.6:
            base -= 5000
        if inten >= 0.85:
            base += 5000
    suggested = max(conv["min"], min(conv["max"], base))
    suggested = int(round(suggested / 500.0) * 500)
    return {"min": conv["min"], "max": conv["max"], "suggested": suggested}


# ─────────────────────────────────────────────────────────────────────────────
# Synthesis: Simple mode sliders → optimal architecture stack
# ─────────────────────────────────────────────────────────────────────────────

def _goal_from_sliders(intensity: float, polarity: float, pace: float) -> str:
    if polarity <= -0.33:
        return "tragic_descent"
    if intensity <= 0.3:
        return "non_conflict"
    if pace >= 0.7 and intensity >= 0.6:
        return "commercial_thrill"
    if intensity >= 0.7:
        return "epic_journey"
    if pace <= 0.3:
        return "character_circle"
    return "commercial_thrill"


def synthesize_stack(
    genre: str = "fantasy",
    plot_archetype: str = "quest",
    intensity: float = 0.6,
    polarity: float = 0.2,
    pace: float = 0.5,
) -> Dict[str, Any]:
    """
    Returns the optimal architecture stack for Simple mode: up to three ranked
    stack cards, each carrying a resolved external curve (variant + sliders +
    engine pressure applied) and the matched internal curve.
    """
    goal = _goal_from_sliders(intensity, polarity, pace)
    recs = calculate_recommendations(genre, goal, plot_archetype)
    default_engine = infer_engine_for_archetype(plot_archetype)

    stacks = []
    for rec in recs[:3]:
        fw_id = rec["framework_id"]
        variant_id = pick_variant_for_sliders(fw_id, polarity)
        engine_id = default_engine

        # ── Research doc conflict protocols ──
        # 1. Non-conflict traditions redirect aggressive engines toward
        #    revelation-based dynamics instead of physical confrontation.
        if fw_id == "kishotenketsu" and engine_id in (
            "monster_in_the_house", "dude_with_a_problem", "tragedy_engine", "institutionalized"
        ):
            engine_id = "whydunit"

        # ── Emotional arc: variant pin > framework canon > slider match ──
        pinned = next(
            (v for v in FRAMEWORK_VARIANTS.get(fw_id, []) if v["id"] == variant_id), None
        )
        slider_arc = pick_arc_for_sliders(intensity, polarity)
        default_arc = next(
            (a for a in EMOTIONAL_ARCS if a["id"] == FRAMEWORK_DEFAULT_ARC.get(fw_id)), None
        )
        if pinned and pinned.get("arc_id"):
            arc = next(
                (a for a in EMOTIONAL_ARCS if a["id"] == pinned["arc_id"]), slider_arc
            )
        elif (
            default_arc
            and arc_features(slider_arc)["polarity"] * arc_features(default_arc)["polarity"] < 0
        ):
            # Slider arc contradicts the framework's canonical emotional direction
            arc = default_arc
        else:
            arc = slider_arc

        # 2. A dark arc on a framework with a dark sub-architecture pulls the
        #    stack toward that variant so labels/acts stay coherent (Affective
        #    Curve Inversion protocol).
        if arc_features(arc)["polarity"] < -0.25:
            dark_var = next(
                (
                    v
                    for v in FRAMEWORK_VARIANTS.get(fw_id, [])
                    if v.get("arc_id") and variant_polarity_hint(v["id"]) < -0.4
                ),
                None,
            )
            if dark_var and variant_id != dark_var["id"]:
                variant_id = dark_var["id"]
                arc = next(
                    (a for a in EMOTIONAL_ARCS if a["id"] == dark_var["arc_id"]), arc
                )

        fw = resolve_framework(fw_id, variant_id) or FRAMEWORKS[fw_id]
        external = transform_curve(
            fw["curve_points"], intensity=intensity, polarity=polarity, pace=pace
        )
        external = apply_pressure_profile(external, engine_id)
        internal = transform_curve(
            arc["internal_curve"], intensity=intensity, polarity=polarity, field="state"
        )

        variant_label = variant_id
        for v in FRAMEWORK_VARIANTS.get(fw_id, []):
            if v["id"] == variant_id:
                variant_label = v["label"]

        card_drivers = {
            "intensity": round(float(intensity), 2),
            "polarity": round(float(polarity), 2),
            "pace": round(float(pace), 2),
        }

        stacks.append({
            "framework_id": fw_id,
            "name": fw["name"],
            "beats_count": fw["beats_count"],
            "acts_count": fw["acts_count"],
            "variant_id": variant_id,
            "variant_label": variant_label,
            "engine_id": engine_id,
            "arc_id": arc["id"],
            "arc_name": arc["name"],
            "match_score": rec["match_score"],
            "curve_points": external,
            "internal_curve": internal,
            "length": suggest_word_count(fw_id, engine_id, genre, card_drivers),
            "drivers": card_drivers,
        })

    return {
        "goal": goal,
        "stacks": stacks,
        "primary": stacks[0] if stacks else None,
    }

"""
FleshNote IDE — Narrative Framework Presets & Seeding Engine
Taxonomic models adapted from 'Plot Structures and Frameworks.md'.
Operationalizes classical dramatic theory, mythic monomyths, and commercial beat sheets.
"""

import os
import copy
import uuid
import sqlite3
from typing import Dict, Any, List, Optional

FRAMEWORKS: Dict[str, Dict[str, Any]] = {
    "three_act": {
        "id": "three_act",
        "name": "Classical Three-Act",
        "tagline": "Fieldian Dramatic Arc",
        "category": "Classical Macro",
        "best_for": "Mainstream commercial fiction, thrillers, fantasy, sci-fi, adventure",
        "description": "Standardized dramatic architecture distributing narrative weight across Setup (25%), Confrontation (50%), and Resolution (25%).",
        "acts_count": 3,
        "beats_count": 10,
        "curve_points": [
            {"pct": 0, "tension": 0.20},
            {"pct": 12, "tension": 0.42},
            {"pct": 25, "tension": 0.48},
            {"pct": 37, "tension": 0.62},
            {"pct": 50, "tension": 0.72},
            {"pct": 62, "tension": 0.78},
            {"pct": 75, "tension": 0.35},
            {"pct": 80, "tension": 0.68},
            {"pct": 88, "tension": 0.96},
            {"pct": 98, "tension": 0.25}
        ],
        "craft_markers": [
            {
                "pct": 12,
                "rune": "𐲁",
                "title": "Inciting Incident",
                "concept": "Status Quo Disruption",
                "craft_notes": "A catalytic event knocks the protagonist's reality out of equilibrium and poses the core dramatic question."
            },
            {
                "pct": 25,
                "rune": "𐲈",
                "title": "Plot Point 1 (Lock-In)",
                "concept": "Irrevocable Threshold",
                "craft_notes": "The protagonist makes a decisive, irreversible commitment that severs the path back to the opening stasis."
            },
            {
                "pct": 50,
                "rune": "𐲉",
                "title": "Midpoint Fulcrum",
                "concept": "Reactive to Proactive Shift",
                "craft_notes": "The fulcrum shifts the character from passive coping to aggressive agency, often marked by a False Victory or False Defeat."
            },
            {
                "pct": 75,
                "rune": "𐲝",
                "title": "All Hope Lost",
                "concept": "Existential Dark Night",
                "craft_notes": "Legacy coping mechanisms collapse completely. The hero sheds their foundational flaw before finding the real solution."
            },
            {
                "pct": 88,
                "rune": "𐲡",
                "title": "Climax Reckoning",
                "concept": "Ultimate Confrontation",
                "craft_notes": "The fusion of internal psychological transformation with external tactical confrontation to decide the story's fate."
            }
        ],
        "arcs": [
            {
                "name": "Act I: Setup",
                "description": "Establishes stasis, latent stakes, and narrative trajectory.",
                "color": "#5c8ec4",
                "start_pct": 0.0,
                "end_pct": 25.0,
                "sort_order": 0,
            },
            {
                "name": "Act II-A: Confrontation",
                "description": "Escalating obstacles and reactive character coping mechanisms.",
                "color": "#d4a052",
                "start_pct": 25.0,
                "end_pct": 50.0,
                "sort_order": 1,
            },
            {
                "name": "Act II-B: The Offensive",
                "description": "Proactive drive following the midpoint fulcrum perceptual shift.",
                "color": "#ea580c",
                "start_pct": 50.0,
                "end_pct": 75.0,
                "sort_order": 2,
            },
            {
                "name": "Act III: Resolution",
                "description": "Climax reckoning, ultimate sacrifice, and new stasis.",
                "color": "#5c9e6e",
                "start_pct": 75.0,
                "end_pct": 100.0,
                "sort_order": 3,
            },
        ],
        "blocks": [
            {"label": "Ordinary World", "pct": 0.0, "block_type": "beat", "lane": 0},
            {"label": "Inciting Incident", "pct": 12.0, "block_type": "twist", "lane": 1},
            {"label": "Plot Point 1 (Lock-In)", "pct": 25.0, "block_type": "beat", "lane": 0},
            {"label": "Pinch Point 1", "pct": 37.0, "block_type": "twist", "lane": 1},
            {"label": "Midpoint Fulcrum", "pct": 50.0, "block_type": "climax", "lane": 0},
            {"label": "Pinch Point 2", "pct": 62.0, "block_type": "twist", "lane": 1},
            {"label": "All Hope Lost", "pct": 75.0, "block_type": "reveal", "lane": 0},
            {"label": "Break into Three", "pct": 80.0, "block_type": "beat", "lane": 1},
            {"label": "Climax Reckoning", "pct": 88.0, "block_type": "climax", "lane": 0},
            {"label": "New Equilibrium", "pct": 98.0, "block_type": "beat", "lane": 0},
        ],
    },
    "five_act": {
        "id": "five_act",
        "name": "Freytag's Pyramid",
        "tagline": "Five-Act Tragic Structure",
        "category": "Classical Macro",
        "best_for": "Literary tragedy, historical drama, grimdark fantasy, psychological horror",
        "description": "Symmetrical dramatic pyramid focusing on the moral rise and inevitable psychological fall of a flawed protagonist.",
        "acts_count": 5,
        "beats_count": 9,
        "curve_points": [
            {"pct": 0, "tension": 0.15},
            {"pct": 15, "tension": 0.38},
            {"pct": 32, "tension": 0.62},
            {"pct": 50, "tension": 0.90},
            {"pct": 60, "tension": 0.65},
            {"pct": 75, "tension": 0.76},
            {"pct": 92, "tension": 0.96},
            {"pct": 100, "tension": 0.15}
        ],
        "craft_markers": [
            {
                "pct": 15,
                "rune": "𐲁",
                "title": "Inciting Spark (Erregendes Moment)",
                "concept": "Fatal Ambition Ignition",
                "craft_notes": "The catalyst awakens the tragic flaw (hamartia), compelling the protagonist to make their first fateful moral compromise."
            },
            {
                "pct": 50,
                "rune": "𐲉",
                "title": "Apex Reversal (Peripeteia)",
                "concept": "The Peak of Fortune",
                "craft_notes": "The protagonist reaches their greatest triumph or hubris, triggering the irreversible moral turn toward ruin."
            },
            {
                "pct": 75,
                "rune": "𐲒",
                "title": "Moment of Final Suspense",
                "concept": "False Hope Before Catastrophe",
                "craft_notes": "A deceptive glimmer of escape surfaces, intensifying emotional tension just before the final collapse strikes."
            },
            {
                "pct": 92,
                "rune": "𐲡",
                "title": "Catastrophe Reckoning",
                "concept": "Cathartic Destruction",
                "craft_notes": "Total structural or existential reckoning where the protagonist pays the full price of their flaws, restoring societal order."
            }
        ],
        "arcs": [
            {
                "name": "Act I: Exposition",
                "description": "Status quo, tragic flaw (hamartia), and catalytic spark.",
                "color": "#5c8ec4",
                "start_pct": 0.0,
                "end_pct": 20.0,
                "sort_order": 0,
            },
            {
                "name": "Act II: Rising Action",
                "description": "Moral compromises and progressive entanglement of stakes.",
                "color": "#d4a052",
                "start_pct": 20.0,
                "end_pct": 45.0,
                "sort_order": 1,
            },
            {
                "name": "Act III: Climax Apex",
                "description": "Peripeteia reversal of fortune and critical realization.",
                "color": "#e11d48",
                "start_pct": 45.0,
                "end_pct": 65.0,
                "sort_order": 2,
            },
            {
                "name": "Act IV: Falling Action",
                "description": "Unraveling fallout and moment of final suspense.",
                "color": "#8b6ec4",
                "start_pct": 65.0,
                "end_pct": 85.0,
                "sort_order": 3,
            },
            {
                "name": "Act V: Catastrophe",
                "description": "Final catharsis, death, exile, or profound social shift.",
                "color": "#c45c5c",
                "start_pct": 85.0,
                "end_pct": 100.0,
                "sort_order": 4,
            },
        ],
        "blocks": [
            {"label": "Exposition & Flaw", "pct": 0.0, "block_type": "beat", "lane": 0},
            {"label": "Inciting Disruption", "pct": 15.0, "block_type": "twist", "lane": 1},
            {"label": "Rising Entanglement", "pct": 32.0, "block_type": "beat", "lane": 0},
            {"label": "Moral Compromise", "pct": 42.0, "block_type": "twist", "lane": 1},
            {"label": "Climax Apex (Peripeteia)", "pct": 50.0, "block_type": "climax", "lane": 0},
            {"label": "Tragic Reversal", "pct": 60.0, "block_type": "reveal", "lane": 1},
            {"label": "Moment of Final Suspense", "pct": 75.0, "block_type": "twist", "lane": 0},
            {"label": "Catastrophic Reckoning", "pct": 92.0, "block_type": "climax", "lane": 0},
            {"label": "Final Denouement", "pct": 99.0, "block_type": "beat", "lane": 1},
        ],
    },
    "heros_journey": {
        "id": "heros_journey",
        "name": "Hero's Journey",
        "tagline": "Vogler's 12-Stage Monomyth",
        "category": "Mythic & Archetypal",
        "best_for": "Epic fantasy, space opera, coming-of-age, mythic retellings",
        "description": "Classic archetypal journey mapping external adventure across a threshold to internal psychological individuation and return.",
        "acts_count": 3,
        "beats_count": 12,
        "curve_points": [
            {"pct": 0, "tension": 0.20},
            {"pct": 12, "tension": 0.35},
            {"pct": 25, "tension": 0.50},
            {"pct": 37, "tension": 0.58},
            {"pct": 50, "tension": 0.68},
            {"pct": 62, "tension": 0.88},
            {"pct": 70, "tension": 0.60},
            {"pct": 80, "tension": 0.74},
            {"pct": 90, "tension": 0.95},
            {"pct": 98, "tension": 0.20}
        ],
        "craft_markers": [
            {
                "pct": 25,
                "rune": "𐲈",
                "title": "Crossing 1st Threshold",
                "concept": "Special World Boundary",
                "craft_notes": "Leaving the familiar known realm behind to venture into the dangerous, enchanted, or hostile special world."
            },
            {
                "pct": 62,
                "rune": "𐲉",
                "title": "The Supreme Ordeal",
                "concept": "Ego-Death in Inmost Cave",
                "craft_notes": "The hero hits rock bottom and confronts ultimate mortality, emerging resurrected and possessing the hard-won treasure."
            },
            {
                "pct": 90,
                "rune": "𐲡",
                "title": "The Resurrection",
                "concept": "Final Transformed Trial",
                "craft_notes": "A severe final test where the hero must apply everything learned across the entire journey to seal ultimate victory."
            }
        ],
        "arcs": [
            {
                "name": "Phase I: Departure",
                "description": "Ordinary world, reluctance, mentor aid, and crossing the threshold.",
                "color": "#5c8ec4",
                "start_pct": 0.0,
                "end_pct": 25.0,
                "sort_order": 0,
            },
            {
                "name": "Phase II: Initiation",
                "description": "Trials of the special world, supreme ordeal, and claiming the prize.",
                "color": "#d4a052",
                "start_pct": 25.0,
                "end_pct": 75.0,
                "sort_order": 1,
            },
            {
                "name": "Phase III: Return",
                "description": "The road back, resurrection crisis, and bringing the elixir home.",
                "color": "#5c9e6e",
                "start_pct": 75.0,
                "end_pct": 100.0,
                "sort_order": 2,
            },
        ],
        "blocks": [
            {"label": "1. The Ordinary World", "pct": 0.0, "block_type": "beat", "lane": 0},
            {"label": "2. Call to Adventure", "pct": 8.0, "block_type": "beat", "lane": 1},
            {"label": "3. Refusal of the Call", "pct": 12.0, "block_type": "beat", "lane": 0},
            {"label": "4. Meeting the Mentor", "pct": 17.0, "block_type": "reveal", "lane": 1},
            {"label": "5. Crossing 1st Threshold", "pct": 25.0, "block_type": "beat", "lane": 0},
            {"label": "6. Tests, Allies & Enemies", "pct": 37.0, "block_type": "beat", "lane": 1},
            {"label": "7. Approach Inmost Cave", "pct": 50.0, "block_type": "beat", "lane": 0},
            {"label": "8. The Supreme Ordeal", "pct": 62.0, "block_type": "climax", "lane": 1},
            {"label": "9. Seizing the Reward", "pct": 70.0, "block_type": "reveal", "lane": 0},
            {"label": "10. The Road Back", "pct": 80.0, "block_type": "twist", "lane": 1},
            {"label": "11. The Resurrection", "pct": 90.0, "block_type": "climax", "lane": 0},
            {"label": "12. Return with Elixir", "pct": 98.0, "block_type": "beat", "lane": 0},
        ],
    },
    "story_circle": {
        "id": "story_circle",
        "name": "Story Circle",
        "tagline": "Dan Harmon's 8-Stage Cycle",
        "category": "Mythic & Archetypal",
        "best_for": "Fast-paced fiction, urban fantasy, episodic arcs, YA novels",
        "description": "Streamlined psychological cycle bisecting familiar order (upper hemisphere) and chaotic transformation (lower hemisphere).",
        "acts_count": 4,
        "beats_count": 8,
        "curve_points": [
            {"pct": 0, "tension": 0.18},
            {"pct": 12, "tension": 0.32},
            {"pct": 25, "tension": 0.48},
            {"pct": 37, "tension": 0.60},
            {"pct": 50, "tension": 0.75},
            {"pct": 62, "tension": 0.88},
            {"pct": 75, "tension": 0.70},
            {"pct": 95, "tension": 0.22}
        ],
        "craft_markers": [
            {
                "pct": 25,
                "rune": "𐲈",
                "title": "Go (Crossing Over)",
                "concept": "Order into Chaos",
                "craft_notes": "The protagonist steps past the boundary of the familiar into unfamiliar chaos to pursue their deep need."
            },
            {
                "pct": 50,
                "rune": "𐲉",
                "title": "Find (Discovery)",
                "concept": "Attaining the Goal",
                "craft_notes": "Reaching the nadir of the circle, the protagonist finds what they desired, but discovers reality is more complicated."
            },
            {
                "pct": 62,
                "rune": "𐲒",
                "title": "Take (Heavy Price)",
                "concept": "The Devastating Toll",
                "craft_notes": "Claiming the prize extracts a heavy sacrifice, shattering former illusions and forcing genuine internal change."
            }
        ],
        "arcs": [
            {
                "name": "Zone of Order",
                "description": "Comfort zone, familiarity, and realization of discontent.",
                "color": "#5c8ec4",
                "start_pct": 0.0,
                "end_pct": 25.0,
                "sort_order": 0,
            },
            {
                "name": "Descent into Chaos",
                "description": "Entering unfamiliar realm and adapting to trials.",
                "color": "#ea580c",
                "start_pct": 25.0,
                "end_pct": 50.0,
                "sort_order": 1,
            },
            {
                "name": "Abyss & Heavy Price",
                "description": "Finding the core prize and paying the devastating cost.",
                "color": "#e11d48",
                "start_pct": 50.0,
                "end_pct": 75.0,
                "sort_order": 2,
            },
            {
                "name": "Mastery & Return",
                "description": "Crossing back into the world transformed by change.",
                "color": "#5c9e6e",
                "start_pct": 75.0,
                "end_pct": 100.0,
                "sort_order": 3,
            },
        ],
        "blocks": [
            {"label": "1. You (Comfort Zone)", "pct": 0.0, "block_type": "beat", "lane": 0},
            {"label": "2. Need (Discontent)", "pct": 12.0, "block_type": "beat", "lane": 1},
            {"label": "3. Go (Crossing Over)", "pct": 25.0, "block_type": "beat", "lane": 0},
            {"label": "4. Search (Adaptation)", "pct": 37.0, "block_type": "beat", "lane": 1},
            {"label": "5. Find (Discovery)", "pct": 50.0, "block_type": "climax", "lane": 0},
            {"label": "6. Take (Heavy Price)", "pct": 62.0, "block_type": "twist", "lane": 1},
            {"label": "7. Return (Crossing Back)", "pct": 75.0, "block_type": "reveal", "lane": 0},
            {"label": "8. Change (Transformed)", "pct": 95.0, "block_type": "beat", "lane": 0},
        ],
    },
    "kishotenketsu": {
        "id": "kishotenketsu",
        "name": "Kishōtenketsu",
        "tagline": "Non-Conflict Juxtaposition",
        "category": "Eastern Tradition",
        "best_for": "Literary fiction, cozy mysteries, slice-of-life, philosophical sci-fi",
        "description": "Four-part non-binary structural model creating narrative momentum via thematic juxtaposition, contextual twist, and cognitive epiphany.",
        "acts_count": 4,
        "beats_count": 8,
        "curve_points": [
            {"pct": 0, "tension": 0.15},
            {"pct": 25, "tension": 0.22},
            {"pct": 48, "tension": 0.25},
            {"pct": 52, "tension": 0.72},
            {"pct": 65, "tension": 0.65},
            {"pct": 75, "tension": 0.45},
            {"pct": 90, "tension": 0.85},
            {"pct": 100, "tension": 0.20}
        ],
        "craft_markers": [
            {
                "pct": 50,
                "rune": "𐲁",
                "title": "Ten (The Rupture)",
                "concept": "Orthogonal Contextual Shift",
                "craft_notes": "Not an antagonistic clash, but a surprising, seemingly disconnected element that forces the reader to rethink the whole narrative."
            },
            {
                "pct": 75,
                "rune": "𐲥",
                "title": "Ketsu (Synthesis)",
                "concept": "Harmonious Epiphany",
                "craft_notes": "Reconciles the unexpected rupture with the premise, resolving tension not through victory but through enlightened understanding."
            }
        ],
        "arcs": [
            {
                "name": "Ki: Introduction",
                "description": "Baseline circumstances and peaceful stasis without conflict.",
                "color": "#5c8ec4",
                "start_pct": 0.0,
                "end_pct": 25.0,
                "sort_order": 0,
            },
            {
                "name": "Shō: Development",
                "description": "Deepening thematic patterns and character relationships.",
                "color": "#5c9e6e",
                "start_pct": 25.0,
                "end_pct": 50.0,
                "sort_order": 1,
            },
            {
                "name": "Ten: The Twist",
                "description": "Orthogonal rupture introducing an unexpected new context.",
                "color": "#db2777",
                "start_pct": 50.0,
                "end_pct": 75.0,
                "sort_order": 2,
            },
            {
                "name": "Ketsu: Reconciliation",
                "description": "Epiphanic synthesis reconciling rupture into harmony.",
                "color": "#d4a052",
                "start_pct": 75.0,
                "end_pct": 100.0,
                "sort_order": 3,
            },
        ],
        "blocks": [
            {"label": "Ki (Introduction)", "pct": 0.0, "block_type": "beat", "lane": 0},
            {"label": "Baseline Harmony", "pct": 12.0, "block_type": "beat", "lane": 1},
            {"label": "Shō (Development)", "pct": 25.0, "block_type": "beat", "lane": 0},
            {"label": "Deepening Resonance", "pct": 38.0, "block_type": "beat", "lane": 1},
            {"label": "Ten (The Rupture)", "pct": 50.0, "block_type": "twist", "lane": 0},
            {"label": "Contextual Shock", "pct": 62.0, "block_type": "reveal", "lane": 1},
            {"label": "Ketsu (Reconciliation)", "pct": 75.0, "block_type": "beat", "lane": 0},
            {"label": "Holistic Epiphany", "pct": 92.0, "block_type": "climax", "lane": 0},
        ],
    },
    "save_the_cat": {
        "id": "save_the_cat",
        "name": "Save the Cat!",
        "tagline": "Blake Snyder 15-Beat Matrix",
        "category": "Commercial Beat Sheets",
        "best_for": "Commercial thrillers, spec-fic, romantic comedies, fast-paced YA",
        "description": "Highly disciplined 15-beat screenplay formula adapted for prose, anchoring pace from Opening Image to Final Transformation.",
        "acts_count": 4,
        "beats_count": 15,
        "curve_points": [
            {"pct": 0, "tension": 0.18},
            {"pct": 12, "tension": 0.40},
            {"pct": 20, "tension": 0.52},
            {"pct": 32, "tension": 0.60},
            {"pct": 50, "tension": 0.74},
            {"pct": 65, "tension": 0.78},
            {"pct": 75, "tension": 0.32},
            {"pct": 80, "tension": 0.65},
            {"pct": 90, "tension": 0.98},
            {"pct": 100, "tension": 0.22}
        ],
        "craft_markers": [
            {
                "pct": 5,
                "rune": "𐲀",
                "title": "Theme Stated",
                "concept": "The Core Lesson Planted",
                "craft_notes": "A peripheral character or situation whispers the spiritual truth the protagonist must internalize by the story's end."
            },
            {
                "pct": 12,
                "rune": "𐲁",
                "title": "The Catalyst",
                "concept": "Life-Altering Shock",
                "craft_notes": "Knocks down the old house of cards; the hero's flawed comfortable life cannot survive this disruption."
            },
            {
                "pct": 50,
                "rune": "𐲉",
                "title": "Midpoint Stakes Shift",
                "concept": "False Triumph or Collapse",
                "craft_notes": "Ticking clock tightens, the stakes become personal, and the fun-and-games phase transitions to real danger."
            },
            {
                "pct": 75,
                "rune": "𐲝",
                "title": "All Is Lost / Whiff of Death",
                "concept": "The Old Self Dies",
                "craft_notes": "An apparent defeat or death forces the hero to confront their fundamental misconception and find renewed resolve."
            },
            {
                "pct": 90,
                "rune": "𐲡",
                "title": "Five-Point Finale",
                "concept": "The Ultimate Proof",
                "craft_notes": "The hero puts their new worldview to the test in an escalating showdown, succeeding on transformed terms."
            }
        ],
        "arcs": [
            {
                "name": "Act I: Thesis",
                "description": "Ordinary world, theme stated, and debate before the choice.",
                "color": "#5c8ec4",
                "start_pct": 0.0,
                "end_pct": 20.0,
                "sort_order": 0,
            },
            {
                "name": "Act II-A: Antithesis",
                "description": "Fun and games exploring the upside-down world.",
                "color": "#d4a052",
                "start_pct": 20.0,
                "end_pct": 50.0,
                "sort_order": 1,
            },
            {
                "name": "Act II-B: Pressure",
                "description": "Bad guys close in, leading to the All Is Lost collapse.",
                "color": "#ea580c",
                "start_pct": 50.0,
                "end_pct": 75.0,
                "sort_order": 2,
            },
            {
                "name": "Act III: Synthesis",
                "description": "Dark night breakthroughs, five-point finale, and triumph.",
                "color": "#5c9e6e",
                "start_pct": 75.0,
                "end_pct": 100.0,
                "sort_order": 3,
            },
        ],
        "blocks": [
            {"label": "1. Opening Image", "pct": 0.0, "block_type": "beat", "lane": 0},
            {"label": "2. Theme Stated", "pct": 5.0, "block_type": "reveal", "lane": 1},
            {"label": "3. Set-Up", "pct": 9.0, "block_type": "beat", "lane": 0},
            {"label": "4. Catalyst", "pct": 12.0, "block_type": "twist", "lane": 1},
            {"label": "5. Debate", "pct": 17.0, "block_type": "beat", "lane": 0},
            {"label": "6. Break into Two", "pct": 20.0, "block_type": "beat", "lane": 1},
            {"label": "7. B Story", "pct": 22.0, "block_type": "reveal", "lane": 2},
            {"label": "8. Fun and Games", "pct": 32.0, "block_type": "beat", "lane": 0},
            {"label": "9. Midpoint", "pct": 50.0, "block_type": "climax", "lane": 0},
            {"label": "10. Bad Guys Close In", "pct": 58.0, "block_type": "beat", "lane": 1},
            {"label": "11. All Is Lost", "pct": 75.0, "block_type": "twist", "lane": 0},
            {"label": "12. Dark Night of Soul", "pct": 77.0, "block_type": "reveal", "lane": 1},
            {"label": "13. Break into Three", "pct": 80.0, "block_type": "beat", "lane": 0},
            {"label": "14. Five-Point Finale", "pct": 88.0, "block_type": "climax", "lane": 1},
            {"label": "15. Final Image", "pct": 100.0, "block_type": "beat", "lane": 0},
        ],
    },
    "seven_point": {
        "id": "seven_point",
        "name": "7-Point Structure",
        "tagline": "Dan Wells' Milestone Method",
        "category": "Commercial Beat Sheets",
        "best_for": "Sci-fi, locked-room mysteries, heist fiction, tightly plotted plots",
        "description": "Reverse-engineering plotting method starting from the Resolution and stepping through pivotal turnarounds.",
        "acts_count": 4,
        "beats_count": 7,
        "curve_points": [
            {"pct": 0, "tension": 0.20},
            {"pct": 25, "tension": 0.45},
            {"pct": 37, "tension": 0.62},
            {"pct": 50, "tension": 0.75},
            {"pct": 62, "tension": 0.82},
            {"pct": 75, "tension": 0.45},
            {"pct": 100, "tension": 0.95}
        ],
        "craft_markers": [
            {
                "pct": 0,
                "rune": "𐲀",
                "title": "The Hook",
                "concept": "The Antithesis of the Ending",
                "craft_notes": "Establish the protagonist in a condition directly opposite where they will end up, highlighting the distance they must travel."
            },
            {
                "pct": 50,
                "rune": "𐲉",
                "title": "The Midpoint",
                "concept": "From Reaction to Determination",
                "craft_notes": "The turning point where the hero stops letting the situation dictate their moves and decides to take the initiative."
            },
            {
                "pct": 75,
                "rune": "𐲒",
                "title": "Plot Turn 2",
                "concept": "Securing the Final Key",
                "craft_notes": "The protagonist gains the crucial piece of information or tool required to win, precipitating the final clash."
            }
        ],
        "arcs": [
            {
                "name": "Phase 1: Starting State",
                "description": "The hook establishes the starting condition opposite the ending.",
                "color": "#5c8ec4",
                "start_pct": 0.0,
                "end_pct": 25.0,
                "sort_order": 0,
            },
            {
                "name": "Phase 2: Rising Pressure",
                "description": "Moving into the active world and adapting under pressure.",
                "color": "#d4a052",
                "start_pct": 25.0,
                "end_pct": 50.0,
                "sort_order": 1,
            },
            {
                "name": "Phase 3: The Offensive",
                "description": "Proactive shift followed by a devastating setback.",
                "color": "#ea580c",
                "start_pct": 50.0,
                "end_pct": 75.0,
                "sort_order": 2,
            },
            {
                "name": "Phase 4: Resolution",
                "description": "The final realization, climax, and complete character growth.",
                "color": "#5c9e6e",
                "start_pct": 75.0,
                "end_pct": 100.0,
                "sort_order": 3,
            },
        ],
        "blocks": [
            {"label": "1. The Hook", "pct": 0.0, "block_type": "beat", "lane": 0},
            {"label": "2. Plot Turn 1", "pct": 25.0, "block_type": "twist", "lane": 1},
            {"label": "3. Pinch Point 1", "pct": 37.5, "block_type": "beat", "lane": 0},
            {"label": "4. Midpoint", "pct": 50.0, "block_type": "climax", "lane": 1},
            {"label": "5. Pinch Point 2", "pct": 62.5, "block_type": "twist", "lane": 0},
            {"label": "6. Plot Turn 2", "pct": 75.0, "block_type": "reveal", "lane": 1},
            {"label": "7. Resolution", "pct": 100.0, "block_type": "climax", "lane": 0},
        ],
    },
    "romancing_the_beat": {
        "id": "romancing_the_beat",
        "name": "Romancing the Beat",
        "tagline": "Gwen Hayes Romance Blueprint",
        "category": "Genre Specialized",
        "best_for": "Romance, rom-com, romantasy, relationship-driven stories",
        "description": "Standardized four-phase trajectory tracking emotional vulnerability from Meet Cute to Whole Heart HEA.",
        "acts_count": 4,
        "beats_count": 10,
        "curve_points": [
            {"pct": 0, "tension": 0.20},
            {"pct": 10, "tension": 0.45},
            {"pct": 20, "tension": 0.35},
            {"pct": 35, "tension": 0.58},
            {"pct": 50, "tension": 0.80},
            {"pct": 65, "tension": 0.70},
            {"pct": 75, "tension": 0.92},
            {"pct": 88, "tension": 0.88},
            {"pct": 98, "tension": 0.25}
        ],
        "craft_markers": [
            {
                "pct": 10,
                "rune": "𐲁",
                "title": "Meet Cute",
                "concept": "The Spark of Chemistry",
                "craft_notes": "The initial contact establishing emotional attraction, paired with the initial resistance or 'No Way' rationale."
            },
            {
                "pct": 50,
                "rune": "𐲉",
                "title": "Midpoint Kiss / Union",
                "concept": "Vulnerability Breakthrough",
                "craft_notes": "A moment of deep intimacy where the lovers let down their emotional guards, giving in to their true feelings."
            },
            {
                "pct": 75,
                "rune": "𐲝",
                "title": "The Crisis (Breakup)",
                "concept": "Internal Scars Collide",
                "craft_notes": "Old defense mechanisms reassert themselves. The relationship breaks apart because characters fear being hurt."
            },
            {
                "pct": 88,
                "rune": "𐲡",
                "title": "The Grand Gesture",
                "concept": "Emotional Truth Claimed",
                "craft_notes": "One or both leads prove they have grown by taking an immense emotional risk to declare their love unconditionally."
            }
        ],
        "arcs": [
            {
                "name": "Phase 1: Setup & Meet",
                "description": "Intro leads, Meet Cute, No Way resistance, and undeniable spark.",
                "color": "#db2777",
                "start_pct": 0.0,
                "end_pct": 25.0,
                "sort_order": 0,
            },
            {
                "name": "Phase 2: Falling in Love",
                "description": "Inkling of desire, deepening joy, and the midpoint breakthrough.",
                "color": "#d4a052",
                "start_pct": 25.0,
                "end_pct": 50.0,
                "sort_order": 1,
            },
            {
                "name": "Phase 3: The Crisis",
                "description": "Internal doubts encroach, leading to the devastating breakup.",
                "color": "#e11d48",
                "start_pct": 50.0,
                "end_pct": 75.0,
                "sort_order": 2,
            },
            {
                "name": "Phase 4: Whole Heart",
                "description": "Grand gesture, emotional truth, and Happily Ever After.",
                "color": "#059669",
                "start_pct": 75.0,
                "end_pct": 100.0,
                "sort_order": 3,
            },
        ],
        "blocks": [
            {"label": "1. Introduce Leads", "pct": 0.0, "block_type": "beat", "lane": 0},
            {"label": "2. Meet Cute", "pct": 10.0, "block_type": "twist", "lane": 1},
            {"label": "3. No Way (Resist)", "pct": 20.0, "block_type": "beat", "lane": 0},
            {"label": "4. Inkling of Desire", "pct": 30.0, "block_type": "reveal", "lane": 1},
            {"label": "5. Deepening Joy", "pct": 40.0, "block_type": "beat", "lane": 0},
            {"label": "6. Midpoint Kiss", "pct": 50.0, "block_type": "climax", "lane": 1},
            {"label": "7. Internal Doubts Surface", "pct": 62.0, "block_type": "twist", "lane": 0},
            {"label": "8. The Breakup (Crisis)", "pct": 75.0, "block_type": "reveal", "lane": 1},
            {"label": "9. Grand Gesture", "pct": 88.0, "block_type": "climax", "lane": 0},
            {"label": "10. Whole Heart HEA", "pct": 98.0, "block_type": "beat", "lane": 0},
        ],
    },
    "custom": {
        "id": "custom",
        "name": "Blank Slate",
        "tagline": "Organic / Freeform Planning",
        "category": "Custom",
        "best_for": "Pantser style, custom architectures, experimental formats",
        "description": "No pre-seeded arcs or blocks. Open canvas for unconstrained intuitive planning.",
        "acts_count": 0,
        "beats_count": 0,
        "curve_points": [
            {"pct": 0, "tension": 0.20},
            {"pct": 50, "tension": 0.20},
            {"pct": 100, "tension": 0.20}
        ],
        "craft_markers": [],
        "arcs": [],
        "blocks": [],
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# LAYER 1: DRAMATIC ENGINES (Booker's 7 Basic Plots ∪ Snyder's 10 Genres)
# Auto-mapped from the Story Compass "Plot Archetype" answer.
# ─────────────────────────────────────────────────────────────────────────────
DRAMATIC_ENGINES: List[Dict[str, Any]] = [
    {
        "id": "monster_in_the_house",
        "name": "Overcoming the Monster",
        "lineage": "Booker / Snyder: Monster in the House",
        "description": "Primal survival against an overwhelming evil in a confined environment.",
        "auto_map": ["monster"],
    },
    {
        "id": "golden_fleece",
        "name": "Golden Fleece",
        "lineage": "Booker: The Quest / Snyder: Golden Fleece",
        "description": "A road journey where outer milestones mirror inner growth toward a clear prize.",
        "auto_map": ["quest"],
    },
    {
        "id": "voyage_and_return",
        "name": "Voyage and Return",
        "lineage": "Booker's 7 Basic Plots",
        "description": "Falling into an alien realm; wonder turns to menace and escape transforms.",
        "auto_map": ["voyage"],
    },
    {
        "id": "rags_to_riches",
        "name": "Rags to Riches",
        "lineage": "Booker's 7 Basic Plots",
        "description": "An overlooked underdog is elevated, stripped down, and earns mature fulfillment.",
        "auto_map": ["rags"],
    },
    {
        "id": "comedy_engine",
        "name": "Comedy",
        "lineage": "Booker's 7 Basic Plots",
        "description": "Misunderstandings escalate until a clarifying reveal restores harmony.",
        "auto_map": ["comedy"],
    },
    {
        "id": "tragedy_engine",
        "name": "Tragedy",
        "lineage": "Booker's 7 Basic Plots",
        "description": "A hamartia-driven ambition pursued into inevitable ruin.",
        "auto_map": ["tragedy"],
    },
    {
        "id": "rebirth",
        "name": "Rebirth",
        "lineage": "Booker's 7 Basic Plots",
        "description": "A character trapped in moral stasis is redeemed through connection.",
        "auto_map": ["rebirth"],
    },
    {
        "id": "dude_with_a_problem",
        "name": "Dude with a Problem",
        "lineage": "Snyder's 10 Genres",
        "description": "An ordinary individual plunged into an extraordinary, lethal crisis.",
        "auto_map": [],
    },
    {
        "id": "buddy_love",
        "name": "Buddy Love",
        "lineage": "Snyder's 10 Genres",
        "description": "Two mismatched characters bound together who challenge and complete each other.",
        "auto_map": [],
    },
    {
        "id": "whydunit",
        "name": "Whydunit",
        "lineage": "Snyder's 10 Genres",
        "description": "A descent into human darkness to uncover the root cause of a crime.",
        "auto_map": [],
    },
    {
        "id": "fool_triumphant",
        "name": "The Fool Triumphant",
        "lineage": "Snyder's 10 Genres",
        "description": "An underestimated underdog proves the entire corrupt establishment wrong.",
        "auto_map": [],
    },
    {
        "id": "out_of_the_bottle",
        "name": "Out of the Bottle",
        "lineage": "Snyder's 10 Genres",
        "description": "A wish granted or curse unleashed teaches a human truth.",
        "auto_map": [],
    },
    {
        "id": "rites_of_passage",
        "name": "Rites of Passage",
        "lineage": "Snyder's 10 Genres",
        "description": "A universal life transition endured through fire until acceptance.",
        "auto_map": [],
    },
    {
        "id": "institutionalized",
        "name": "Institutionalized",
        "lineage": "Snyder's 10 Genres",
        "description": "The cost of belonging to a closed group: conformity versus rebellion.",
        "auto_map": [],
    },
]


def infer_engine_for_archetype(plot_archetype: str) -> str:
    """Maps a Story Compass plot archetype to its default dramatic engine id."""
    arch = (plot_archetype or "").lower().strip()
    for engine in DRAMATIC_ENGINES:
        if arch in engine["auto_map"]:
            return engine["id"]
    return "golden_fleece"


# ─────────────────────────────────────────────────────────────────────────────
# LAYER 3: EMOTIONAL ARCS (Vonnegut topographies ∪ Weiland character arcs)
# Each ships a pre-computed internal-state curve: state 1 = triumph, 0 = despair.
# ─────────────────────────────────────────────────────────────────────────────
EMOTIONAL_ARCS: List[Dict[str, Any]] = [
    {
        "id": "positive_change",
        "name": "Positive Change",
        "source": "Weiland",
        "description": "The protagonist begins bound to a destructive Lie, and through ordeal learns to embrace the Truth.",
        "internal_curve": [
            {"pct": 0, "state": 0.35}, {"pct": 20, "state": 0.3}, {"pct": 40, "state": 0.4},
            {"pct": 50, "state": 0.5}, {"pct": 62, "state": 0.3}, {"pct": 75, "state": 0.25},
            {"pct": 88, "state": 0.65}, {"pct": 100, "state": 0.9},
        ],
    },
    {
        "id": "flat_arc",
        "name": "Flat Arc",
        "source": "Weiland",
        "description": "The protagonist already holds the Truth and, challenged by a corrupt world, transforms it instead of themselves.",
        "internal_curve": [
            {"pct": 0, "state": 0.55}, {"pct": 25, "state": 0.5}, {"pct": 50, "state": 0.55},
            {"pct": 75, "state": 0.5}, {"pct": 100, "state": 0.62},
        ],
    },
    {
        "id": "disillusionment",
        "name": "Disillusionment",
        "source": "Weiland (Negative)",
        "description": "The protagonist believes an optimistic Lie — and a bleak reality breaks them of it.",
        "internal_curve": [
            {"pct": 0, "state": 0.5}, {"pct": 25, "state": 0.45}, {"pct": 50, "state": 0.35},
            {"pct": 75, "state": 0.25}, {"pct": 100, "state": 0.1},
        ],
    },
    {
        "id": "fall_arc",
        "name": "Fall",
        "source": "Weiland (Negative)",
        "description": "The protagonist clings stubbornly to a toxic Lie and spirals into moral ruin or madness.",
        "internal_curve": [
            {"pct": 0, "state": 0.4}, {"pct": 25, "state": 0.45}, {"pct": 50, "state": 0.55},
            {"pct": 62, "state": 0.65}, {"pct": 75, "state": 0.75}, {"pct": 88, "state": 0.85},
            {"pct": 100, "state": 0.12},
        ],
    },
    {
        "id": "corruption",
        "name": "Corruption",
        "source": "Weiland (Negative)",
        "description": "The protagonist knows the Truth but is seduced by power into embracing the Lie — ending as the antagonist.",
        "internal_curve": [
            {"pct": 0, "state": 0.3}, {"pct": 25, "state": 0.4}, {"pct": 50, "state": 0.55},
            {"pct": 62, "state": 0.7}, {"pct": 75, "state": 0.8}, {"pct": 88, "state": 0.9},
            {"pct": 100, "state": 0.85},
        ],
    },
    {
        "id": "man_in_hole",
        "name": "Man in a Hole",
        "source": "Vonnegut",
        "description": "Baseline stasis drops into sudden misfortune, then climbs to a higher ending.",
        "internal_curve": [
            {"pct": 0, "state": 0.6}, {"pct": 25, "state": 0.35}, {"pct": 50, "state": 0.22},
            {"pct": 62, "state": 0.2}, {"pct": 75, "state": 0.45}, {"pct": 88, "state": 0.65},
            {"pct": 100, "state": 0.8},
        ],
    },
    {
        "id": "boy_meets_girl",
        "name": "Boy Meets Girl",
        "source": "Vonnegut",
        "description": "The protagonist finds something wonderful, loses it in crisis, and regains it permanently.",
        "internal_curve": [
            {"pct": 0, "state": 0.4}, {"pct": 25, "state": 0.7}, {"pct": 40, "state": 0.75},
            {"pct": 50, "state": 0.3}, {"pct": 65, "state": 0.4}, {"pct": 75, "state": 0.5},
            {"pct": 88, "state": 0.75}, {"pct": 100, "state": 0.85},
        ],
    },
    {
        "id": "cinderella",
        "name": "Cinderella",
        "source": "Vonnegut",
        "description": "Misery relieved by temporary fortune, wiped out by crisis, then crowned with true triumph.",
        "internal_curve": [
            {"pct": 0, "state": 0.15}, {"pct": 15, "state": 0.55}, {"pct": 30, "state": 0.7},
            {"pct": 40, "state": 0.25}, {"pct": 55, "state": 0.6}, {"pct": 70, "state": 0.2},
            {"pct": 85, "state": 0.5}, {"pct": 100, "state": 0.9},
        ],
    },
    {
        "id": "oedipus",
        "name": "Oedipus",
        "source": "Vonnegut",
        "description": "The protagonist escapes misfortune and achieves prominence — only to plunge into catastrophe.",
        "internal_curve": [
            {"pct": 0, "state": 0.3}, {"pct": 25, "state": 0.55}, {"pct": 45, "state": 0.75},
            {"pct": 55, "state": 0.85}, {"pct": 70, "state": 0.6}, {"pct": 82, "state": 0.35},
            {"pct": 92, "state": 0.15}, {"pct": 100, "state": 0.08},
        ],
    },
    {
        "id": "from_bad_to_worse",
        "name": "From Bad to Worse",
        "source": "Vonnegut",
        "description": "A continuous tragic descent into misfortune, ending in ruin with no redeeming turn.",
        "internal_curve": [
            {"pct": 0, "state": 0.45}, {"pct": 25, "state": 0.35}, {"pct": 50, "state": 0.25},
            {"pct": 70, "state": 0.15}, {"pct": 85, "state": 0.1}, {"pct": 100, "state": 0.05},
        ],
    },
    {
        "id": "which_way_is_up",
        "name": "Which Way Is Up?",
        "source": "Vonnegut",
        "description": "An ambiguous ambivalence fluctuating around the baseline, resisting clear closure.",
        "internal_curve": [
            {"pct": 0, "state": 0.5}, {"pct": 20, "state": 0.6}, {"pct": 40, "state": 0.4},
            {"pct": 55, "state": 0.6}, {"pct": 70, "state": 0.45}, {"pct": 85, "state": 0.55},
            {"pct": 100, "state": 0.5},
        ],
    },
]

# Default emotional arc per macro framework (Layer 2 → Layer 3 auto-mapping)
FRAMEWORK_DEFAULT_ARC: Dict[str, str] = {
    "three_act": "positive_change",
    "five_act": "oedipus",
    "heros_journey": "man_in_hole",
    "story_circle": "man_in_hole",
    "kishotenketsu": "which_way_is_up",
    "save_the_cat": "positive_change",
    "seven_point": "positive_change",
    "romancing_the_beat": "boy_meets_girl",
    "custom": "flat_arc",
}

# ─────────────────────────────────────────────────────────────────────────────
# STRUCTURE FLAVOR VARIANTS (per-framework sub-architectures)
# Each variant may override curve_points and rename craft markers / blocks / arcs.
# The first variant in each list is the framework default.
# ─────────────────────────────────────────────────────────────────────────────
FRAMEWORK_VARIANTS: Dict[str, List[Dict[str, Any]]] = {
    "three_act": [
        {"id": "classic", "label": "Classic Field Arc", "description": "Setup, confrontation, and clean resolution with a proactive midpoint."},
        {
            "id": "false_victory",
            "label": "False-Victory Midpoint",
            "description": "The midpoint peaks with a premature triumph that blinds the hero while the real danger gathers beneath.",
            "curve_points": [
                {"pct": 0, "tension": 0.20}, {"pct": 12, "tension": 0.42}, {"pct": 25, "tension": 0.48},
                {"pct": 37, "tension": 0.62}, {"pct": 50, "tension": 0.84}, {"pct": 62, "tension": 0.58},
                {"pct": 75, "tension": 0.3}, {"pct": 80, "tension": 0.68}, {"pct": 88, "tension": 0.96},
                {"pct": 98, "tension": 0.25},
            ],
            "marker_labels": {"Midpoint Fulcrum": "False Victory", "Pinch Point 2": "The Long Slide"},
        },
        {
            "id": "false_defeat",
            "label": "False-Defeat Midpoint",
            "description": "The midpoint collapses into apparent loss, and the hero rebuilds toward the true climax from the wreckage.",
            "curve_points": [
                {"pct": 0, "tension": 0.20}, {"pct": 12, "tension": 0.42}, {"pct": 25, "tension": 0.48},
                {"pct": 37, "tension": 0.62}, {"pct": 50, "tension": 0.58}, {"pct": 62, "tension": 0.82},
                {"pct": 75, "tension": 0.35}, {"pct": 80, "tension": 0.68}, {"pct": 88, "tension": 0.96},
                {"pct": 98, "tension": 0.25},
            ],
            "marker_labels": {"Midpoint Fulcrum": "False Defeat", "Pinch Point 2": "The Rebound Peak"},
        },
        {
            "id": "tragic_descent",
            "label": "Tragic Descent",
            "description": "Inverted Act III: an illicit triumph at the midpoint seals the hero's doom; the finale is decay, not catharsis.",
            "curve_points": [
                {"pct": 0, "tension": 0.20}, {"pct": 12, "tension": 0.42}, {"pct": 25, "tension": 0.48},
                {"pct": 37, "tension": 0.62}, {"pct": 50, "tension": 0.86}, {"pct": 62, "tension": 0.9},
                {"pct": 75, "tension": 0.72}, {"pct": 80, "tension": 0.8}, {"pct": 88, "tension": 0.97},
                {"pct": 98, "tension": 0.05},
            ],
            "marker_labels": {"All Hope Lost": "Illicit Triumph", "Climax Reckoning": "Fatal Climax"},
            "arc_labels": {"Act III: Resolution": "Act III: Catastrophe"},
            "arc_id": "fall_arc",
        },
    ],
    "five_act": [
        {"id": "classic", "label": "Classic Tragedy", "description": "Freytag's symmetrical pyramid: rise, apex reversal, and cathartic catastrophe."},
        {
            "id": "restoration",
            "label": "Restoration Comedy",
            "description": "The same pyramid, but Act V restores societal order instead of destroying the protagonist.",
            "curve_points": [
                {"pct": 0, "tension": 0.15}, {"pct": 15, "tension": 0.38}, {"pct": 32, "tension": 0.62},
                {"pct": 50, "tension": 0.9}, {"pct": 60, "tension": 0.65}, {"pct": 75, "tension": 0.76},
                {"pct": 92, "tension": 0.8}, {"pct": 100, "tension": 0.4},
            ],
            "marker_labels": {"Catastrophe Reckoning": "Redemptive Reckoning"},
            "arc_labels": {"Act V: Catastrophe": "Act V: Restoration"},
            "arc_id": "cinderella",
        },
    ],
    "heros_journey": [
        {"id": "classic", "label": "Classic Monomyth", "description": "Vogler's full 12-stage arc from ordinary world to returning with the elixir."},
        {
            "id": "heroine_integration",
            "label": "Heroine's Integration",
            "description": "Murdock's inward turn: the ordeal becomes psychological descent, and the return is wholeness, not conquest.",
            "curve_points": [
                {"pct": 0, "tension": 0.20}, {"pct": 12, "tension": 0.35}, {"pct": 25, "tension": 0.5},
                {"pct": 37, "tension": 0.58}, {"pct": 50, "tension": 0.68}, {"pct": 62, "tension": 0.78},
                {"pct": 70, "tension": 0.55}, {"pct": 80, "tension": 0.7}, {"pct": 90, "tension": 0.85},
                {"pct": 98, "tension": 0.4},
            ],
            "marker_labels": {"The Supreme Ordeal": "Descent & Reckoning", "The Resurrection": "Integration & Wholeness"},
            "arc_labels": {"Phase III: Return": "Phase III: Integration"},
        },
    ],
    "story_circle": [
        {"id": "classic", "label": "Classic Descent", "description": "Harmon's comfort-into-chaos descent with a heavy price and transformed return."},
        {
            "id": "chaos_start",
            "label": "Chaos Start",
            "description": "The hemispheres inverted: the protagonist begins in chaos and fights their way toward order.",
            "curve_points": [
                {"pct": 0, "tension": 0.7}, {"pct": 12, "tension": 0.6}, {"pct": 25, "tension": 0.5},
                {"pct": 37, "tension": 0.45}, {"pct": 50, "tension": 0.4}, {"pct": 62, "tension": 0.65},
                {"pct": 75, "tension": 0.55}, {"pct": 95, "tension": 0.22},
            ],
            "marker_labels": {
                "Go (Crossing Over)": "Fall (Chaos Takes Hold)",
                "Find (Discovery)": "Find (The Way Out)",
            },
            "arc_labels": {"Zone of Order": "Zone of Chaos", "Descent into Chaos": "Climb toward Order"},
        },
    ],
    "kishotenketsu": [
        {"id": "classic", "label": "Classic Four-Part", "description": "Ki, Shō, Ten, Ketsu — a single orthogonal rupture synthesized into insight."},
        {
            "id": "double_rupture",
            "label": "Double Rupture",
            "description": "A second disconnection deepens the Ten before the Ketsu reconciles both ruptures at once.",
            "curve_points": [
                {"pct": 0, "tension": 0.15}, {"pct": 25, "tension": 0.22}, {"pct": 48, "tension": 0.25},
                {"pct": 55, "tension": 0.6}, {"pct": 62, "tension": 0.35}, {"pct": 72, "tension": 0.78},
                {"pct": 82, "tension": 0.6}, {"pct": 90, "tension": 0.85}, {"pct": 100, "tension": 0.25},
            ],
            "marker_labels": {"Ten (The Rupture)": "Ten (First Rupture)"},
        },
        {
            "id": "quiet_coda",
            "label": "Quiet Coda",
            "description": "A gentler rupture: the Ten whispers rather than ruptures, and the Ketsu resolves in quiet reflection.",
            "curve_points": [
                {"pct": 0, "tension": 0.15}, {"pct": 25, "tension": 0.22}, {"pct": 48, "tension": 0.25},
                {"pct": 52, "tension": 0.55}, {"pct": 65, "tension": 0.5}, {"pct": 75, "tension": 0.4},
                {"pct": 90, "tension": 0.6}, {"pct": 100, "tension": 0.25},
            ],
            "marker_labels": {"Ten (The Rupture)": "Ten (Soft Rupture)", "Ketsu (Synthesis)": "Ketsu (Quiet Reconciliation)"},
        },
    ],
    "save_the_cat": [
        {"id": "classic", "label": "Classic 15-Beat", "description": "Snyder's full beat matrix with a triumphant five-point finale."},
        {
            "id": "dark_finale",
            "label": "Dark Finale",
            "description": "Inverted Act III: the All Is Lost triumph seals the hero's fate and the finale executes moral decay.",
            "curve_points": [
                {"pct": 0, "tension": 0.18}, {"pct": 12, "tension": 0.4}, {"pct": 20, "tension": 0.52},
                {"pct": 32, "tension": 0.6}, {"pct": 50, "tension": 0.74}, {"pct": 65, "tension": 0.78},
                {"pct": 75, "tension": 0.32}, {"pct": 80, "tension": 0.65}, {"pct": 88, "tension": 0.9},
                {"pct": 90, "tension": 0.95}, {"pct": 100, "tension": 0.05},
            ],
            "marker_labels": {"Five-Point Finale": "Downfall Finale"},
            "arc_labels": {"Act III: Synthesis": "Act III: Collapse"},
            "arc_id": "fall_arc",
        },
    ],
    "seven_point": [
        {"id": "classic", "label": "Classic Resolution", "description": "Dan Wells' seven points with a full-throttle resolution proving complete growth."},
        {
            "id": "bittersweet",
            "label": "Bittersweet Resolution",
            "description": "The resolution still proves growth, but at a cost that tempers the final high.",
            "curve_points": [
                {"pct": 0, "tension": 0.2}, {"pct": 25, "tension": 0.45}, {"pct": 37, "tension": 0.62},
                {"pct": 50, "tension": 0.75}, {"pct": 62, "tension": 0.82}, {"pct": 75, "tension": 0.45},
                {"pct": 100, "tension": 0.7},
            ],
            "marker_labels": {"7. Resolution": "7. Bittersweet Resolution"},
            "arc_id": "flat_arc",
        },
    ],
    "romancing_the_beat": [
        {"id": "classic", "label": "Happily Ever After", "description": "Hayes' full arc from Meet Cute to mutual commitment and closure."},
        {
            "id": "hfn",
            "label": "Happy For Now",
            "description": "The grand gesture lands, but the ending is a hopeful truce rather than a sealed forever.",
            "curve_points": [
                {"pct": 0, "tension": 0.2}, {"pct": 10, "tension": 0.45}, {"pct": 20, "tension": 0.35},
                {"pct": 35, "tension": 0.58}, {"pct": 50, "tension": 0.8}, {"pct": 65, "tension": 0.7},
                {"pct": 75, "tension": 0.92}, {"pct": 88, "tension": 0.88}, {"pct": 98, "tension": 0.6},
            ],
            "marker_labels": {"10. Whole Heart HEA": "10. Happy For Now"},
        },
        {
            "id": "tragic_parting",
            "label": "Tragic Parting",
            "description": "The defense mechanisms win: the gesture is refused and the leads part changed but separate.",
            "curve_points": [
                {"pct": 0, "tension": 0.2}, {"pct": 10, "tension": 0.45}, {"pct": 20, "tension": 0.35},
                {"pct": 35, "tension": 0.58}, {"pct": 50, "tension": 0.8}, {"pct": 65, "tension": 0.7},
                {"pct": 75, "tension": 0.92}, {"pct": 88, "tension": 0.55}, {"pct": 98, "tension": 0.18},
            ],
            "marker_labels": {"The Grand Gesture": "The Gesture Refused"},
            "arc_labels": {"Phase 4: Whole Heart": "Phase 4: Aftermath"},
            "arc_id": "disillusionment",
        },
    ],
    "custom": [],
}


def resolve_framework(framework_id: str, variant_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Returns a deep copy of a framework descriptor with the requested structure
    variant applied (curve overrides + marker/block/arc label renames).
    The result always carries a "variants" list for the frontend chip row.
    """
    fw = FRAMEWORKS.get(framework_id)
    if not fw:
        return None

    merged = copy.deepcopy(fw)
    variants = copy.deepcopy(FRAMEWORK_VARIANTS.get(framework_id, []))
    merged["variants"] = variants
    merged["default_arc"] = FRAMEWORK_DEFAULT_ARC.get(framework_id)

    variant = next((v for v in variants if v["id"] == variant_id), None)
    if variant:
        if variant.get("curve_points"):
            merged["curve_points"] = copy.deepcopy(variant["curve_points"])
        if variant.get("marker_labels"):
            for m in merged.get("craft_markers", []):
                m["title"] = variant["marker_labels"].get(m["title"], m["title"])
            for b in merged.get("blocks", []):
                b["label"] = variant["marker_labels"].get(b["label"], b["label"])
        if variant.get("arc_labels"):
            for a in merged.get("arcs", []):
                a["name"] = variant["arc_labels"].get(a["name"], a["name"])
        merged["variant"] = {
            "id": variant["id"],
            "label": variant["label"],
            "description": variant["description"],
        }

    return merged


def get_all_frameworks() -> List[Dict[str, Any]]:
    """Returns all framework descriptors with variant lists merged in."""
    return [
        resolve_framework(fw_id)
        for fw_id in FRAMEWORKS
        if resolve_framework(fw_id) is not None
    ]


def get_default_variant(framework_id: str) -> Optional[Dict[str, Any]]:
    variants = FRAMEWORK_VARIANTS.get(framework_id, [])
    return variants[0] if variants else None


def calculate_recommendations(
    genre: str = "fantasy",
    narrative_goal: str = "commercial_thrill",
    plot_archetype: str = "quest"
) -> List[Dict[str, Any]]:
    """
    Computes match scores for all frameworks and returns the top 3 recommendations
    with tailored rationale strings based on the Story Compass inputs.
    """
    scores: Dict[str, float] = {k: 50.0 for k in FRAMEWORKS if k != "custom"}
    reasons: Dict[str, List[str]] = {k: [] for k in FRAMEWORKS}

    # Normalize inputs
    genre = (genre or "").lower().strip()
    narrative_goal = (narrative_goal or "").lower().strip()
    plot_archetype = (plot_archetype or "").lower().strip()

    # 1. Goal-based scoring
    if narrative_goal in ("commercial_thrill", "fast_paced"):
        scores["save_the_cat"] += 35.0
        reasons["save_the_cat"].append("High-velocity commercial pacing with precise tension beats")
        scores["seven_point"] += 28.0
        reasons["seven_point"].append("Tightly engineered plot turns and escalating stakes")
        scores["three_act"] += 20.0
        reasons["three_act"].append("Industry standard commercial escalation")
    elif narrative_goal in ("epic_journey", "mythic_quest"):
        scores["heros_journey"] += 40.0
        reasons["heros_journey"].append("Classic threshold journey linking external trials to inner mastery")
        scores["three_act"] += 25.0
        reasons["three_act"].append("Three distinct movements perfect for large-scale world progression")
        scores["story_circle"] += 20.0
        reasons["story_circle"].append("Clean psychological descent and return rhythm")
    elif narrative_goal in ("tragic_descent", "psychological"):
        scores["five_act"] += 45.0
        reasons["five_act"].append("Symmetrical tragic pyramid mapping hubris to catastrophic reckoning")
        scores["three_act"] += 15.0
    elif narrative_goal in ("emotional_romance", "romance_arc"):
        scores["romancing_the_beat"] += 50.0
        reasons["romancing_the_beat"].append("Specialized vulnerability tracking from Meet Cute to Whole Heart HEA")
        scores["save_the_cat"] += 20.0
    elif narrative_goal in ("non_conflict", "cozy", "philosophical"):
        scores["kishotenketsu"] += 50.0
        reasons["kishotenketsu"].append("Non-confrontational progression driven by juxtaposition and insight")
        scores["story_circle"] += 15.0
    elif narrative_goal in ("puzzle_mystery", "heist"):
        scores["seven_point"] += 35.0
        reasons["seven_point"].append("Reverse-engineering plotting method starting from the solved climax")
        scores["save_the_cat"] += 25.0
    elif narrative_goal in ("character_circle", "episodic"):
        scores["story_circle"] += 40.0
        reasons["story_circle"].append("Streamlined 8-step psychological transformation cycle")
        scores["heros_journey"] += 20.0

    # 2. Genre-based bonuses
    if genre == "romance":
        scores["romancing_the_beat"] += 30.0
        reasons["romancing_the_beat"].append("Tailored specifically for modern romance beat expectations")
    elif genre in ("thriller", "action"):
        scores["save_the_cat"] += 20.0
        scores["seven_point"] += 15.0
    elif genre in ("fantasy", "sci-fi"):
        scores["heros_journey"] += 18.0
        scores["three_act"] += 15.0
    elif genre in ("horror", "grimdark"):
        scores["five_act"] += 25.0
        reasons["five_act"].append("Dark, fatalistic descent fits high-stakes horror and tragedy")
    elif genre in ("literary", "drama"):
        scores["kishotenketsu"] += 20.0
        scores["five_act"] += 15.0

    # 3. Archetype bonuses
    if plot_archetype == "quest":
        scores["heros_journey"] += 20.0
        scores["three_act"] += 12.0
    elif plot_archetype == "monster":
        scores["save_the_cat"] += 15.0
        scores["three_act"] += 15.0
    elif plot_archetype == "tragedy":
        scores["five_act"] += 30.0
    elif plot_archetype == "voyage":
        scores["story_circle"] += 18.0
        scores["heros_journey"] += 15.0

    # Sort descending
    sorted_frameworks = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    top3 = []
    for fw_id, score in sorted_frameworks[:3]:
        fw = FRAMEWORKS.get(fw_id)
        if not fw:
            continue
        fw_reasons = reasons.get(fw_id, [])
        primary_reason = fw_reasons[0] if fw_reasons else fw.get("best_for", "")
        top3.append({
            "framework_id": fw_id,
            "name": fw["name"],
            "tagline": fw["tagline"],
            "category": fw["category"],
            "match_score": min(99, int(score)),
            "match_reason": primary_reason,
            "description": fw["description"],
            "acts_count": fw["acts_count"],
            "beats_count": fw["beats_count"],
            "recommended_variant": (get_default_variant(fw_id) or {}).get("id"),
            "recommended_engine": infer_engine_for_archetype(plot_archetype),
            "recommended_arc": FRAMEWORK_DEFAULT_ARC.get(fw_id, "positive_change"),
        })

    return top3


def seed_framework_in_db(
    cursor: sqlite3.Cursor,
    framework_id: str,
    clear_existing: bool = True,
    variant_id: Optional[str] = None
) -> bool:
    """
    Seeds planner_arcs and planner_blocks into an open SQLite transaction.
    Respects character limit constraints:
      - planner_arcs: name <= 24, description <= 80
      - planner_blocks: label <= 50, lane in (0, 1, 2)
    Accepts a variant_id so sub-architecture label/curve adjustments carry
    through into the seeded planner data.
    """
    if framework_id not in FRAMEWORKS:
        return False

    fw = resolve_framework(framework_id, variant_id)

    if clear_existing:
        cursor.execute("DELETE FROM planner_blocks WHERE chapter_id IS NULL OR chapter_id = ''")
        cursor.execute("DELETE FROM planner_arcs")

    # Insert arcs
    for arc in fw["arcs"]:
        arc_id = str(uuid.uuid4())
        name = arc["name"][:24]
        desc = arc["description"][:80]
        cursor.execute("""
            INSERT INTO planner_arcs (id, layer, name, description, color, start_pct, end_pct, sort_order)
            VALUES (?, 'surface', ?, ?, ?, ?, ?, ?)
        """, (arc_id, name, desc, arc["color"], arc["start_pct"], arc["end_pct"], arc["sort_order"]))

    # Insert blocks
    for idx, blk in enumerate(fw["blocks"]):
        block_id = str(uuid.uuid4())
        label = blk["label"][:50]
        lane = blk.get("lane", 0)
        cursor.execute("""
            INSERT INTO planner_blocks (id, layer, block_type, label, pct, lane, sort_order)
            VALUES (?, 'surface', ?, ?, ?, ?, ?)
        """, (block_id, blk["block_type"], label, blk["pct"], lane, idx))

    return True


def scaffold_chapters_for_framework(
    cursor: sqlite3.Cursor,
    project_dir: str,
    framework_id: str,
    total_words: int = 60000,
    avg_chapter_words: int = 3500
) -> List[str]:
    """
    Creates starter chapter records in the database and empty Markdown files on disk
    corresponding to each beat of the chosen framework. Also updates planner_blocks
    with the generated chapter_id!
    """
    if framework_id not in FRAMEWORKS or framework_id == "custom":
        # Default single blank chapter
        return _create_single_default_chapter(cursor, project_dir, avg_chapter_words)

    fw = FRAMEWORKS[framework_id]
    blocks = fw.get("blocks", [])
    if not blocks:
        return _create_single_default_chapter(cursor, project_dir, avg_chapter_words)

    md_dir = os.path.join(project_dir, "md")
    os.makedirs(md_dir, exist_ok=True)

    created_ids = []
    # Calculate word target per chapter approximately
    per_chapter_target = max(1000, int(total_words / max(1, len(blocks))))

    for ch_num, blk in enumerate(blocks, start=1):
        ch_id = str(uuid.uuid4())
        title = blk["label"]
        # Clean safe slug
        slug = "".join(c if c.isalnum() else "_" for c in title.lower())
        slug = "_".join(filter(None, slug.split("_")))[:30]
        filename = f"ch_{ch_num:03d}_{slug}.md"
        filepath = os.path.join(md_dir, filename)

        # Write starter markdown file with beat title header
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"# Chapter {ch_num}: {title}\n\n")

        cursor.execute("""
            INSERT INTO chapters (
                id, chapter_number, title, status, md_filename,
                word_count, target_word_count, synopsis
            ) VALUES (?, ?, ?, 'planned', ?, 0, ?, ?)
        """, (
            ch_id,
            ch_num,
            title,
            filename,
            per_chapter_target,
            f"Beat: {title} ({blk['pct']}%)"
        ))

        # Link planner block with matching label/pct to this chapter
        cursor.execute("""
            UPDATE planner_blocks
            SET chapter_id = ?, chapter_status = 'planned'
            WHERE label = ? AND abs(pct - ?) < 0.1
        """, (ch_id, title[:50], blk["pct"]))

        created_ids.append(ch_id)

    return created_ids


def _create_single_default_chapter(cursor: sqlite3.Cursor, project_dir: str, target_words: int) -> List[str]:
    """Creates a single default clean Chapter 1."""
    md_dir = os.path.join(project_dir, "md")
    os.makedirs(md_dir, exist_ok=True)

    ch_id = str(uuid.uuid4())
    filename = "ch_001_chapter_one.md"
    filepath = os.path.join(md_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("# Chapter 1\n\n")

    cursor.execute("""
        INSERT INTO chapters (
            id, chapter_number, title, status, md_filename,
            word_count, target_word_count, synopsis
        ) VALUES (?, 1, 'Chapter 1', 'planned', ?, 0, ?, '')
    """, (ch_id, filename, target_words))

    return [ch_id]

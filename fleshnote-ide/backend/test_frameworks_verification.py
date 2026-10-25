"""
Verification tests for framework_presets.py
Tests schema constraints, recommendation scoring, and chapter scaffolding.
"""

import os
import tempfile
import sqlite3
from framework_presets import (
    FRAMEWORKS,
    get_all_frameworks,
    calculate_recommendations,
    seed_framework_in_db,
    scaffold_chapters_for_framework
)
from db_setup import generate_project_db


def test_constraints():
    print("Testing framework constraints...")
    for fw_id, fw in FRAMEWORKS.items():
        print(f"  Checking {fw_id}...")
        assert "name" in fw and len(fw["name"]) > 0
        assert "tagline" in fw
        assert "curve_points" in fw
        assert "craft_markers" in fw

        # Check arcs
        for arc in fw.get("arcs", []):
            assert len(arc["name"]) <= 24, f"Arc name '{arc['name']}' exceeds 24 chars in {fw_id}"
            assert len(arc["description"]) <= 80, f"Arc desc '{arc['description']}' exceeds 80 chars in {fw_id}"
            assert 0 <= arc["start_pct"] < arc["end_pct"] <= 100, f"Invalid arc range in {fw_id}: {arc}"

        # Check blocks
        for blk in fw.get("blocks", []):
            assert len(blk["label"]) <= 50, f"Block label '{blk['label']}' exceeds 50 chars in {fw_id}"
            assert 0 <= blk["pct"] <= 100, f"Invalid block pct in {fw_id}: {blk}"
            assert blk.get("lane", 0) in (0, 1, 2), f"Invalid lane in {fw_id}: {blk}"

        # Check craft markers
        for cm in fw.get("craft_markers", []):
            assert 0 <= cm["pct"] <= 100
            assert "rune" in cm and len(cm["rune"]) > 0
            assert "title" in cm
            assert "concept" in cm
            assert "craft_notes" in cm
    print("All framework constraints passed!")


def test_recommendations():
    print("Testing recommendation engine...")
    recs_fantasy = calculate_recommendations("fantasy", "epic_journey", "quest")
    assert len(recs_fantasy) == 3
    assert recs_fantasy[0]["framework_id"] == "heros_journey"
    print(f"  Fantasy/Quest Top match: {recs_fantasy[0]['name']} ({recs_fantasy[0]['match_score']}%)")

    recs_thriller = calculate_recommendations("thriller", "commercial_thrill", "monster")
    assert len(recs_thriller) == 3
    assert recs_thriller[0]["framework_id"] == "save_the_cat"
    print(f"  Thriller Top match: {recs_thriller[0]['name']} ({recs_thriller[0]['match_score']}%)")

    recs_romance = calculate_recommendations("romance", "emotional_romance", "comedy")
    assert len(recs_romance) == 3
    assert recs_romance[0]["framework_id"] == "romancing_the_beat"
    print(f"  Romance Top match: {recs_romance[0]['name']} ({recs_romance[0]['match_score']}%)")

    recs_horror = calculate_recommendations("horror", "tragic_descent", "tragedy")
    assert len(recs_horror) == 3
    assert recs_horror[0]["framework_id"] == "five_act"
    print(f"  Horror Top match: {recs_horror[0]['name']} ({recs_horror[0]['match_score']}%)")

    print("Recommendation engine passed!")


def test_seeding_and_scaffolding():
    print("Testing DB seeding and scaffolding...")
    with tempfile.TemporaryDirectory() as tmpdir:
        answers = {
            "project_name": "Test Odyssey",
            "author_name": "Tester",
            "genre": "fantasy",
            "narrative_framework": "heros_journey",
            "scaffold_chapters": True,
            "default_chapter_target": 3500
        }
        db_path = generate_project_db(tmpdir, answers)
        assert os.path.exists(db_path)

        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM planner_arcs")
        arc_count = cur.fetchone()[0]
        assert arc_count == 3, f"Expected 3 arcs, got {arc_count}"

        cur.execute("SELECT COUNT(*) FROM planner_blocks")
        blk_count = cur.fetchone()[0]
        assert blk_count == 12, f"Expected 12 blocks, got {blk_count}"

        cur.execute("SELECT COUNT(*) FROM chapters")
        ch_count = cur.fetchone()[0]
        assert ch_count == 12, f"Expected 12 chapters scaffolded, got {ch_count}"

        cur.execute("SELECT title, chapter_id FROM planner_blocks JOIN chapters ON planner_blocks.chapter_id = chapters.id")
        linked_rows = cur.fetchall()
        assert len(linked_rows) == 12, f"Expected 12 linked blocks to chapters, got {len(linked_rows)}"
        print(f"  Successfully seeded and linked {len(linked_rows)} chapters and blocks!")

        conn.close()
    print("Seeding and scaffolding passed!")


if __name__ == "__main__":
    test_constraints()
    test_recommendations()
    test_seeding_and_scaffolding()
    print("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<")

import os
import sys
import tempfile
import sqlite3
import shutil

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_setup import generate_project_db, apply_migrations
from routes.groups import (
    create_group, update_group, get_group_members,
    add_group_member, update_group_member, remove_group_member,
    get_character_memberships,
    GroupCreate, GroupUpdate, GroupMembersRequest,
    GroupMemberAdd, GroupMemberUpdate, GroupMemberRemove,
    CharacterMembershipsRequest
)

def run_tests():
    temp_dir = tempfile.mkdtemp(prefix="fleshnote_group_test_")
    db_path = os.path.join(temp_dir, "fleshnote.db")
    print(f"[*] Testing in temp dir: {temp_dir}")

    try:
        # Step 1: Generate fresh DB
        print("[1] Generating fresh project database...")
        generate_project_db(temp_dir, {
            "book_title": "Faction Test Chronicle",
            "author_name": "Test Author",
            "narrative_framework": "custom"
        })
        assert os.path.exists(db_path), "Database file was not created"

        # Step 2: Create sample characters & locations
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("INSERT INTO characters (id, name, bio) VALUES ('char-1', 'Lord Vane', 'Ruthless commander')")
        c.execute("INSERT INTO characters (id, name, bio) VALUES ('char-2', 'Lyra Crow', 'Infiltrator')")
        c.execute("INSERT INTO locations (id, name, description) VALUES ('loc-citadel', 'Obsidian Citadel', 'Faction HQ')")
        conn.commit()
        conn.close()

        # Step 3: Create Parent Group
        print("[2] Creating Parent Group (The Obsidian Order)...")
        parent_res = create_group(GroupCreate(
            project_path=temp_dir,
            name="The Obsidian Order",
            description="Ancient guild of shadow operatives",
            philosophy="Power through silence and precision",
            internal_rules="Never reveal the High Seat. Betrayal is punishable by exile.",
            headquarters_location_id="loc-citadel",
            faction_color="#991b1b"
        ))
        assert "group" in parent_res, f"Parent group creation failed: {parent_res}"
        parent_id = parent_res["group"]["id"]
        print(f"    Created parent group with ID: {parent_id}")

        # Step 4: Create Child Subgroup
        print("[3] Creating Child Subgroup (The Shadow Vanguard)...")
        child_res = create_group(GroupCreate(
            project_path=temp_dir,
            name="Shadow Vanguard",
            description="The forward strike detachment of the Order",
            parent_group_id=parent_id,
            philosophy="Strike first, question never",
            internal_rules="Obey the Grandmaster",
            faction_color="#ea580c"
        ))
        assert "group" in child_res, f"Child group creation failed: {child_res}"
        child_id = child_res["group"]["id"]
        print(f"    Created child group with ID: {child_id}, parent: {child_res['group']['parent_group_id']}")

        # Step 5: Add Members with Roles and World Dates
        print("[4] Adding members to The Obsidian Order...")
        add_res1 = add_group_member(GroupMemberAdd(
            project_path=temp_dir,
            group_id=parent_id,
            character_id="char-1",
            role_title="Grandmaster",
            rank_order=10,
            joined_date="1020-01-15",
            standing="loyal",
            notes="Founding member",
            create_history_entry=True
        ))
        assert add_res1.get("status") == "ok", f"Failed to add char-1: {add_res1}"
        m1_id = add_res1["membership_id"]

        add_res2 = add_group_member(GroupMemberAdd(
            project_path=temp_dir,
            group_id=parent_id,
            character_id="char-2",
            role_title="Apprentice Scout",
            rank_order=1,
            joined_date="1024-06-01",
            standing="questioned",
            notes="Recruited from the slums",
            create_history_entry=True
        ))
        assert add_res2.get("status") == "ok", f"Failed to add char-2: {add_res2}"
        m2_id = add_res2["membership_id"]

        # Step 6: Test Roster Queries (Author Mode)
        print("[5] Querying roster in author mode...")
        roster_author = get_group_members(GroupMembersRequest(
            project_path=temp_dir,
            group_id=parent_id,
            view_mode="author"
        ))
        members = roster_author["members"]
        assert len(members) == 2, f"Expected 2 members, got {len(members)}"
        names = [m["character_name"] for m in members]
        assert "Lord Vane" in names and "Lyra Crow" in names
        print(f"    Roster correctly returned {len(members)} members: {names}")

        # Step 7: Test Time-Aware Roster Queries (World Time Mode)
        print("[6] Querying time-aware roster at date 1022-01-01 (before Lyra joined)...")
        roster_early = get_group_members(GroupMembersRequest(
            project_path=temp_dir,
            group_id=parent_id,
            view_mode="world_time",
            current_world_time="1022-01-01"
        ))
        early_active = [m for m in roster_early["members"] if m["temporal_status"] == "active"]
        assert len(early_active) == 1 and early_active[0]["character_name"] == "Lord Vane", (
            f"Expected only Lord Vane active at 1022-01-01, got: {[m['character_name'] for m in early_active]}"
        )
        print("    Time-aware filtering successfully identified Lord Vane as active and Lyra Crow as future member.")

        # Step 8: Update Membership (Departure / Left Date)
        print("[7] Updating Lyra's membership with left date (1026-03-10)...")
        update_res = update_group_member(GroupMemberUpdate(
            project_path=temp_dir,
            membership_id=m2_id,
            left_date="1026-03-10",
            departure_reason="Defected to the rebellion",
            standing="exiled",
            create_history_entry=True
        ))
        assert update_res.get("status") == "ok", f"Failed to update membership: {update_res}"

        # Test Time-Aware Roster after departure
        roster_late = get_group_members(GroupMembersRequest(
            project_path=temp_dir,
            group_id=parent_id,
            view_mode="world_time",
            current_world_time="1027-01-01"
        ))
        late_active = [m for m in roster_late["members"] if m["temporal_status"] == "active"]
        assert len(late_active) == 1 and late_active[0]["character_name"] == "Lord Vane", (
            f"Expected only Lord Vane active at 1027-01-01, got: {[m['character_name'] for m in late_active]}"
        )
        print("    Time-aware filtering successfully marked Lyra Crow as departed after 1026-03-10.")

        # Step 9: Character Memberships Lookup
        print("[8] Querying memberships for Lord Vane...")
        vane_memberships = get_character_memberships(CharacterMembershipsRequest(
            project_path=temp_dir,
            character_id="char-1"
        ))
        assert "memberships" in vane_memberships, f"Character memberships failed: {vane_memberships}"
        assert len(vane_memberships["memberships"]) == 1
        assert vane_memberships["memberships"][0]["group_name"] == "The Obsidian Order"
        assert vane_memberships["memberships"][0]["role_title"] == "Grandmaster"
        print("    Character memberships lookup successful.")

        # Step 10: Soft-delete membership
        print("[9] Testing soft delete of membership...")
        del_res = remove_group_member(GroupMemberRemove(
            project_path=temp_dir,
            membership_id=m1_id
        ))
        assert del_res.get("status") == "ok", f"Failed to remove membership: {del_res}"

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT deleted FROM group_memberships WHERE id = ?", (m1_id,))
        row = c.fetchone()
        assert row and row[0] == 1, "deleted flag was not set to 1"

        # Check sync log
        c.execute("SELECT table_name, column_name, value FROM change_log WHERE row_id = ? AND column_name = 'deleted'", (m1_id,))
        sync_row = c.fetchone()
        assert sync_row and sync_row[0] == "group_memberships" and sync_row[2] == "1", (
            f"Sync log missing or incorrect: {sync_row}"
        )
        conn.close()
        print("    Soft delete and tombstone logged to change_log successfully.")

        # Step 11: Migration Engine Test
        print("[10] Testing legacy database migration...")
        mig_dir = tempfile.mkdtemp(prefix="fleshnote_legacy_test_")
        mig_db = os.path.join(mig_dir, "fleshnote.db")
        conn_legacy = sqlite3.connect(mig_db)
        cur_legacy = conn_legacy.cursor()
        # Create a pre-2.0 schema without group_memberships and older columns
        cur_legacy.execute("CREATE TABLE chapters (id TEXT PRIMARY KEY, title TEXT)")
        cur_legacy.execute("CREATE TABLE locations (id TEXT PRIMARY KEY, name TEXT)")
        cur_legacy.execute("CREATE TABLE groups (id TEXT PRIMARY KEY, name TEXT, aliases TEXT, group_type TEXT, description TEXT, surface_agenda TEXT, true_agenda TEXT, notes TEXT, created_at TEXT, updated_at TEXT)")
        cur_legacy.execute("CREATE TABLE characters (id TEXT PRIMARY KEY, name TEXT, group_id TEXT)")
        cur_legacy.execute("INSERT INTO groups (id, name) VALUES ('leg-grp-1', 'Old Clan')")
        cur_legacy.execute("INSERT INTO characters (id, name, group_id) VALUES ('leg-char-1', 'Old Warrior', 'leg-grp-1')")
        conn_legacy.commit()
        conn_legacy.close()

        # Run migration engine
        apply_migrations(mig_db)

        # Check migrated structure
        conn_mig = sqlite3.connect(mig_db)
        cur_mig = conn_mig.cursor()
        # Verify table exists
        cur_mig.execute("SELECT count(*) FROM group_memberships WHERE group_id = 'leg-grp-1' AND character_id = 'leg-char-1'")
        count = cur_mig.fetchone()[0]
        assert count == 1, f"Legacy membership was not migrated to group_memberships! Count: {count}"

        # Verify new group columns exist
        cur_mig.execute("PRAGMA table_info(groups)")
        col_names = [col[1] for col in cur_mig.fetchall()]
        assert "philosophy" in col_names, "philosophy column missing in migrated groups"
        assert "faction_color" in col_names, "faction_color column missing in migrated groups"
        assert "parent_group_id" in col_names, "parent_group_id column missing in migrated groups"
        conn_mig.close()
        shutil.rmtree(mig_dir, ignore_errors=True)
        print("    Legacy migration test passed! Characters with group_id were migrated seamlessly.")

        print("\n==========================================")
        print(" ALL FACTION & GROUP BACKEND TESTS PASSED!")
        print("==========================================")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    run_tests()

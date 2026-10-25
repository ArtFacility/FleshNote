"""Sketchboards: the batch endpoint (validation, all-or-nothing, undo revival),
reading rows written by older builds into the current shape, live entity
names, board deletion, and syncing the new columns into an older schema."""
import asyncio
import contextlib
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest
import uuid

os.environ.setdefault("FLESHNOTE_DEVICE_ID", "test-device-boards")

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import HTTPException

import db_setup
import sync_core
from routes import boards, sync


def run(coro):
    return asyncio.run(coro)


def new_id():
    return str(uuid.uuid4())


class BoardsBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fn_boards_")
        self.project = os.path.join(self.tmp, "proj")
        os.makedirs(self.project)
        db_setup.generate_project_db(self.project, {
            "project_name": "Boards", "author_name": "Writer",
            "genre": "fantasy", "project_id": "boards-proj-1",
        })
        self.board = run(boards.create_board(boards.BoardCreate(project_path=self.project, name="Magic")))["board"]

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    @contextlib.contextmanager
    def db(self):
        conn = sqlite3.connect(os.path.join(self.project, "fleshnote.db"))
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def batch(self, *ops, board_id=None):
        return run(boards.board_batch(boards.BoardBatch(
            project_path=self.project, board_id=board_id or self.board["id"],
            ops=[boards.BoardOp(**op) for op in ops])))

    def load(self):
        return run(boards.load_board(boards.BoardLoad(project_path=self.project, board_id=self.board["id"])))

    def put_node(self, node_id, **fields):
        return {"op": "put_node", "id": node_id, "fields": fields}

    def put_edge(self, edge_id, **fields):
        return {"op": "put_edge", "id": edge_id, "fields": fields}


class TestBatch(BoardsBase):
    def test_create_and_load_round_trip(self):
        a, b, e = new_id(), new_id(), new_id()
        self.batch(
            self.put_node(a, name="Ember", shape="diamond", color_token="red", pos_x=10, pos_y=20),
            self.put_node(b, name="Ash", shape="ellipse", pos_x=300, pos_y=20),
            self.put_edge(e, item_start_id=a, item_end_id=b, routing="elbow",
                          waypoints=[[150, 80], [150, 40]], from_side="right", to_side="left",
                          start_marker="dot", end_marker="none", title="Fuels", color_token="amber"),
        )
        data = self.load()
        nodes = {n["id"]: n for n in data["items"]}
        self.assertEqual(nodes[a]["shape"], "diamond")
        self.assertEqual(nodes[a]["color_token"], "red")
        self.assertEqual(nodes[b]["color_token"], "neutral")
        edge = data["connections"][0]
        self.assertEqual(edge["routing"], "elbow")
        self.assertEqual(edge["waypoints"], [[150.0, 80.0], [150.0, 40.0]])
        self.assertEqual((edge["from_side"], edge["to_side"]), ("right", "left"))
        self.assertEqual((edge["start_marker"], edge["end_marker"]), ("dot", "none"))

        # Older builds read the original columns: they stay in step.
        with self.db() as conn:
            node = conn.execute("SELECT color, item_type FROM board_items WHERE id = ?", (a,)).fetchone()
            conn_row = conn.execute("SELECT conn_color, directed, curve_offset FROM item_connections "
                                    "WHERE id = ?", (e,)).fetchone()
            logged = {r[0] for r in conn.execute(
                "SELECT column_name FROM change_log WHERE row_id = ?", (e,))}
        self.assertEqual(tuple(node), ("#c45c5c", "standalone"))
        self.assertEqual(tuple(conn_row), ("#d4a052", 0, 0.0))
        self.assertTrue({"waypoints", "routing", "from_side", "end_marker"} <= logged)

    def test_update_logs_only_changed_fields(self):
        a = new_id()
        self.batch(self.put_node(a, name="Ember"))
        with self.db() as conn:
            before = conn.execute("SELECT COUNT(*) FROM change_log WHERE row_id = ?", (a,)).fetchone()[0]
        self.batch(self.put_node(a, name="Ember", pos_x=50))
        with self.db() as conn:
            cols = [r[0] for r in conn.execute(
                "SELECT column_name FROM change_log WHERE row_id = ? ORDER BY rowid", (a,))][before:]
        self.assertEqual(cols, ["pos_x"])

    def test_invalid_op_rolls_back_whole_batch(self):
        a = new_id()
        with self.assertRaises(HTTPException) as ctx:
            self.batch(self.put_node(a, name="Kept?"), self.put_node(new_id(), shape="blob"))
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(self.load()["items"], [])

    def test_rejects_bad_values(self):
        a, b = new_id(), new_id()
        self.batch(self.put_node(a), self.put_node(b))
        bad = [
            self.put_node(a, color_token="#ff0000"),
            self.put_node(a, unknown_field=1),
            self.put_node(a, entity_id="abc"),                       # type missing
            self.put_node("../../etc", name="x"),
            self.put_edge(new_id(), item_start_id=a, item_end_id=a),
            self.put_edge(new_id(), item_start_id=a),
            self.put_edge(new_id(), item_start_id=a, item_end_id=b, waypoints=[[1, "x"]]),
            self.put_edge(new_id(), item_start_id=a, item_end_id=b, waypoints=[[0, 0]] * 65),
            self.put_edge(new_id(), item_start_id=a, item_end_id=b, routing="zigzag"),
        ]
        for op in bad:
            with self.subTest(op=op), self.assertRaises(HTTPException):
                self.batch(op)

    def test_edges_cannot_reach_another_board(self):
        other = run(boards.create_board(boards.BoardCreate(project_path=self.project, name="Tech")))["board"]
        a, foreign = new_id(), new_id()
        self.batch(self.put_node(a))
        self.batch(self.put_node(foreign), board_id=other["id"])
        with self.assertRaises(HTTPException):
            self.batch(self.put_edge(new_id(), item_start_id=a, item_end_id=foreign))
        with self.assertRaises(HTTPException):
            self.batch(self.put_node(foreign, name="moved"))

    def test_delete_node_takes_its_edges_and_undo_revives(self):
        a, b, e = new_id(), new_id(), new_id()
        self.batch(self.put_node(a), self.put_node(b), self.put_edge(e, item_start_id=a, item_end_id=b))
        self.batch({"op": "del_node", "id": a})
        data = self.load()
        self.assertEqual([n["id"] for n in data["items"]], [b])
        self.assertEqual(data["connections"], [])
        # Undo puts both rows back with their previous fields.
        self.batch(self.put_node(a, name="Back"), self.put_edge(e, item_start_id=a, item_end_id=b))
        data = self.load()
        self.assertEqual({n["id"] for n in data["items"]}, {a, b})
        self.assertEqual([c["id"] for c in data["connections"]], [e])

    def test_delete_board_cascades_to_legend(self):
        with self.db() as conn:
            conn.execute("INSERT INTO board_edge_types (id, board_id, name) VALUES ('t1', ?, 'Fuels')",
                         (self.board["id"],))
        a = new_id()
        self.batch(self.put_node(a))
        run(boards.delete_board(boards.BoardDelete(project_path=self.project, board_id=self.board["id"])))
        with self.db() as conn:
            self.assertEqual(conn.execute("SELECT deleted FROM board_edge_types WHERE id = 't1'").fetchone()[0], 1)
            self.assertEqual(conn.execute("SELECT deleted FROM board_items WHERE id = ?", (a,)).fetchone()[0], 1)


class TestLegend(BoardsBase):
    def put_type(self, type_id, **fields):
        return {"op": "put_type", "id": type_id, "fields": fields}

    def put_kind(self, kind_id, **fields):
        return {"op": "put_kind", "id": kind_id, "fields": fields}

    def two_nodes(self):
        a, b = new_id(), new_id()
        self.batch(self.put_node(a), self.put_node(b))
        return a, b

    def test_types_and_kinds_round_trip(self):
        t, k = new_id(), new_id()
        a, b = new_id(), new_id()
        e = new_id()
        self.batch(
            self.put_type(t, name="  Fuels ", color_token="red", conn_type="dashed", end_marker="dot"),
            self.put_kind(k, name="Source", shape="diamond", color_token="amber"),
            self.put_node(a, kind_id=k, shape="diamond", color_token="amber"),
            self.put_node(b),
            self.put_edge(e, item_start_id=a, item_end_id=b, type_id=t, color_token="red"),
        )
        data = self.load()
        self.assertEqual(data["types"], [{"id": t, "name": "Fuels", "color_token": "red", "conn_type": "dashed",
                                          "start_marker": "none", "end_marker": "dot", "sort_order": 0}])
        self.assertEqual(data["kinds"][0]["shape"], "diamond")
        self.assertEqual(next(n for n in data["items"] if n["id"] == a)["kind_id"], k)
        self.assertEqual(data["connections"][0]["type_id"], t)

    def test_legend_validation(self):
        t = new_id()
        bad = [
            self.put_type(t, name="   "),
            self.put_type(t, color_token="red"),  # a new entry needs a name
            self.put_type(t, name="x", color_token="pink"),
            self.put_type(t, name="x", end_marker="star"),
            self.put_type(t, name="x" * 81),
            self.put_type(t, name="x", shape="card"),
            self.put_kind(t, name="x", shape="blob"),
        ]
        for op in bad:
            with self.subTest(op=op), self.assertRaises(HTTPException):
                self.batch(op)
        self.assertEqual(self.load()["types"], [])

    def test_type_and_kind_must_be_live_on_this_board(self):
        other = run(boards.create_board(boards.BoardCreate(project_path=self.project, name="Other")))["board"]
        foreign_type, foreign_kind = new_id(), new_id()
        self.batch(self.put_type(foreign_type, name="Fuels"), self.put_kind(foreign_kind, name="Source"),
                   board_id=other["id"])
        a, b = self.two_nodes()
        with self.assertRaises(HTTPException):
            self.batch(self.put_edge(new_id(), item_start_id=a, item_end_id=b, type_id=foreign_type))
        with self.assertRaises(HTTPException):
            self.batch(self.put_node(a, kind_id=foreign_kind))
        t = new_id()
        self.batch(self.put_type(t, name="Fuels"), {"op": "del_type", "id": t, "fields": {}})
        with self.assertRaises(HTTPException):
            self.batch(self.put_edge(new_id(), item_start_id=a, item_end_id=b, type_id=t))

    def test_delete_type_and_undo(self):
        """The client un-types the edges and deletes the type in one batch; undo
        revives the type first and re-types the edges after."""
        t = new_id()
        a, b = self.two_nodes()
        e = new_id()
        self.batch(self.put_type(t, name="Fuels", color_token="red"),
                   self.put_edge(e, item_start_id=a, item_end_id=b, type_id=t, color_token="red"))
        self.batch(self.put_edge(e, type_id=None), {"op": "del_type", "id": t, "fields": {}})
        data = self.load()
        self.assertEqual((data["types"], data["connections"][0]["type_id"]), ([], None))
        # The edge keeps the look it had.
        self.assertEqual(data["connections"][0]["color_token"], "red")
        self.batch(self.put_type(t, name="Fuels"), self.put_edge(e, type_id=t))
        data = self.load()
        self.assertEqual(([x["id"] for x in data["types"]], data["connections"][0]["type_id"]), ([t], t))

    def test_type_deleted_elsewhere_reads_as_untyped(self):
        t, k = new_id(), new_id()
        a, b = new_id(), new_id()
        e = new_id()
        self.batch(self.put_type(t, name="Fuels"), self.put_kind(k, name="Source"),
                   self.put_node(a, kind_id=k), self.put_node(b),
                   self.put_edge(e, item_start_id=a, item_end_id=b, type_id=t))
        # As if a merge brought in only the deletes.
        with self.db() as conn:
            conn.execute("UPDATE board_edge_types SET deleted = 1 WHERE id = ?", (t,))
            conn.execute("UPDATE board_node_kinds SET deleted = 1 WHERE id = ?", (k,))
        data = self.load()
        self.assertIsNone(data["connections"][0]["type_id"])
        self.assertIsNone(next(n for n in data["items"] if n["id"] == a)["kind_id"])

    def test_legacy_rows_are_untyped(self):
        with self.db() as conn:
            for nid, x in (("n1", 0), ("n2", 300)):
                conn.execute("INSERT INTO board_items (id, board_id, name, pos_x) VALUES (?, ?, ?, ?)",
                             (nid, self.board["id"], nid, x))
            conn.execute("INSERT INTO item_connections (id, board_id, item_start_id, item_end_id) "
                         "VALUES ('c1', ?, 'n1', 'n2')", (self.board["id"],))
        data = self.load()
        self.assertIsNone(data["connections"][0]["type_id"])
        self.assertTrue(all(n["kind_id"] is None for n in data["items"]))


class TestTime(BoardsBase):
    def test_first_mention_and_appears_auto(self):
        with self.db() as conn:
            conn.execute("DELETE FROM chapters")
            for cid, num in (("ch-a", 1), ("ch-b", 2), ("ch-c", 3)):
                conn.execute("INSERT INTO chapters (id, chapter_number, title) VALUES (?, ?, ?)", (cid, num, cid))
            conn.execute("INSERT INTO characters (id, name) VALUES ('char-1', 'Sophia')")
            conn.execute("INSERT INTO lore_entities (id, name, category) VALUES ('lore-1', 'Rite', 'magic')")
            conn.execute("INSERT INTO characters (id, name) VALUES ('char-2', 'Unmet')")
            for etype, eid, cid in (("character", "char-1", "ch-c"), ("character", "char-1", "ch-b"),
                                    ("item", "lore-1", "ch-c")):
                conn.execute("INSERT INTO entity_appearances (entity_type, entity_id, chapter_id) VALUES (?, ?, ?)",
                             (etype, eid, cid))
        a, b, c, d = new_id(), new_id(), new_id(), new_id()
        self.batch(self.put_node(a, entity_type="character", entity_id="char-1", appears_auto=True),
                   self.put_node(b, entity_type="lore", entity_id="lore-1"),
                   self.put_node(c, entity_type="character", entity_id="char-2", appears_auto=True),
                   self.put_node(d, appears_chapter_id="ch-a", ends_world_time="17 Frostmere, 314"))
        nodes = {n["id"]: n for n in self.load()["items"]}
        self.assertEqual((nodes[a]["first_chapter_id"], nodes[a]["appears_auto"]), ("ch-b", True))
        self.assertEqual((nodes[b]["first_chapter_id"], nodes[b]["appears_auto"]), ("ch-c", False))
        self.assertEqual(nodes[c]["first_chapter_id"], None)
        self.assertEqual((nodes[d]["appears_chapter_id"], nodes[d]["ends_world_time"]), ("ch-a", "17 Frostmere, 314"))
        # The derived chapter is never written or logged.
        with self.db() as conn:
            cols = {r[1] for r in conn.execute("PRAGMA table_info(board_items)")}
            logged = conn.execute("SELECT COUNT(*) FROM change_log WHERE column_name = 'first_chapter_id'").fetchone()[0]
        self.assertNotIn("first_chapter_id", cols)
        self.assertEqual(logged, 0)
        with self.assertRaises(HTTPException):
            self.batch(self.put_node(a, appears_auto=1))


class TestBoardsForEntity(BoardsBase):
    def test_lists_boards_and_nodes_of_an_entity(self):
        other = run(boards.create_board(boards.BoardCreate(project_path=self.project, name="Other")))["board"]
        gone = run(boards.create_board(boards.BoardCreate(project_path=self.project, name="Gone")))["board"]
        a, b, c, d, e = (new_id() for _ in range(5))
        self.batch(self.put_node(a, entity_type="character", entity_id="char-1"),
                   self.put_node(b, entity_type="character", entity_id="char-1"),
                   self.put_node(c, entity_type="location", entity_id="char-1"))
        self.batch(self.put_node(d, entity_type="character", entity_id="char-1"), board_id=other["id"])
        self.batch(self.put_node(e, entity_type="character", entity_id="char-1"), board_id=gone["id"])
        self.batch({"op": "del_node", "id": b, "fields": {}})
        run(boards.delete_board(boards.BoardDelete(project_path=self.project, board_id=gone["id"])))
        res = run(boards.boards_for_entity(boards.BoardsForEntity(
            project_path=self.project, entity_type="character", entity_id="char-1")))["boards"]
        self.assertEqual([(r["name"], r["node_ids"]) for r in res], [("Magic", [a]), ("Other", [d])])
        # Lore stored under an older build's category name still counts as lore.
        with self.db() as conn:
            conn.execute("INSERT INTO board_items (id, board_id, name, entity_type, entity_id) "
                         "VALUES ('n-old', ?, 'Compass', 'item', 'lore-9')", (self.board["id"],))
        res = run(boards.boards_for_entity(boards.BoardsForEntity(
            project_path=self.project, entity_type="lore", entity_id="lore-9")))["boards"]
        self.assertEqual(res[0]["node_ids"], ["n-old"])


def latest_at(history, chapter_number=None):
    """The rule the board's client uses (sketchboard/generated.js): the last
    row, in the order given, that has no chapter or is at or before it."""
    valid = [r for r in history if chapter_number is None or r["chapter_number"] is None
             or r["chapter_number"] <= chapter_number]
    return valid[-1] if valid else None


class TestGeneratedBoards(BoardsBase):
    def setUp(self):
        super().setUp()
        with self.db() as conn:
            conn.execute("DELETE FROM chapters")
            for cid, num in (("ch-1", 1), ("ch-2", 2), ("ch-3", 3)):
                conn.execute("INSERT INTO chapters (id, chapter_number, title) VALUES (?, ?, ?)", (cid, num, cid))
            for cid, name in (("A", "Ash"), ("B", "Bryn"), ("C", "Cole"), ("D", "Gone")):
                conn.execute("INSERT INTO characters (id, name) VALUES (?, ?)", (cid, name))
            conn.execute("UPDATE characters SET deleted = 1 WHERE id = 'D'")
            rows = [
                ("r1", "A", "B", "friendship", None, None, 1),
                ("r2", "A", "B", "hate", "ch-2", 10, 1),
                ("r3", "B", "A", "love", "ch-1", 5, 0),     # mutual: counts for A→B too
                ("r4", "C", "A", "trust", "ch-3", 1, 1),
                ("r5", "A", "D", "spite", "ch-1", 1, 1),    # a deleted character drops out
            ]
            for rid, a, b, kind, ch, wo, one in rows:
                conn.execute("INSERT INTO character_relationships (id, character_id, target_character_id, "
                             "rel_type, chapter_id, word_offset, is_one_sided) VALUES (?, ?, ?, ?, ?, ?, ?)",
                             (rid, a, b, kind, ch, wo, one))

    def generated(self, board_type):
        board = run(boards.create_board(boards.BoardCreate(project_path=self.project, name="Gen",
                                                           board_type=board_type)))["board"]
        return run(boards.generated_board(boards.GeneratedBoard(project_path=self.project, board_id=board["id"])))

    def test_relationship_histories_match_the_tracker(self):
        from routes import relationships
        data = self.generated("gen_relationships")
        self.assertEqual([e["name"] for e in data["entities"]], ["Ash", "Bryn", "Cole"])
        pairs = {(p["from"], p["to"]): p["history"] for p in data["pairs"]}
        self.assertEqual([r["id"] for r in pairs[("A", "B")]], ["r1", "r3", "r2"])
        self.assertEqual([r["id"] for r in pairs[("B", "A")]], ["r3"])
        self.assertNotIn(("A", "D"), pairs)
        for chapter in (1, 2):
            tracker = relationships.get_relationships_for_character(relationships.RelationshipsForCharacter(
                project_path=self.project, character_id="A", filter_mode="narrative", current_chapter=chapter))
            state = {r["target_character_id"]: r["current_state"]["id"] for r in tracker["relationships"]
                     if r["current_state"]}
            with self.subTest(chapter=chapter):
                self.assertEqual(state["B"], latest_at(pairs[("A", "B")], chapter)["id"])

    def test_factions(self):
        with self.db() as conn:
            conn.execute("INSERT INTO groups (id, name) VALUES ('G1', 'Order')")
            conn.execute("INSERT INTO groups (id, name, parent_group_id) VALUES ('G2', 'Cell', 'G1')")
            conn.execute("INSERT INTO group_memberships (id, group_id, character_id, role_title, joined_date, left_date) "
                         "VALUES ('m1', 'G1', 'A', 'Captain', '1 March, 1200', '1 June, 1200')")
            conn.execute("INSERT INTO group_memberships (id, group_id, character_id) VALUES ('m2', 'G2', 'B')")
        data = self.generated("gen_factions")
        self.assertEqual([(e["type"], e["name"]) for e in data["entities"]],
                         [("group", "Cell"), ("group", "Order"), ("character", "Ash"), ("character", "Bryn")])
        links = {l["id"]: l for l in data["links"]}
        self.assertEqual(links["m1"]["role_title"], "Captain")
        self.assertLess(links["m1"]["joined_day"], links["m1"]["left_day"])
        self.assertIsNone(links["m2"]["joined_day"])
        self.assertEqual(data["parents"], [{"from": "G2", "to": "G1"}])

    def test_only_generated_boards(self):
        with self.assertRaises(HTTPException):
            run(boards.generated_board(boards.GeneratedBoard(project_path=self.project, board_id=self.board["id"])))



class TestReadingOlderRows(BoardsBase):
    def insert_legacy(self, table, **row):
        row.setdefault("board_id", self.board["id"])
        with self.db() as conn:
            conn.execute(f"INSERT INTO {table} ({', '.join(row)}) VALUES ({', '.join('?' * len(row))})",
                         list(row.values()))

    def test_old_node_and_connection_columns(self):
        self.insert_legacy("board_items", id="n1", name="Capital", item_type="location", entity_type="location",
                           entity_id="loc-x", color="#ff6b4a", pos_x=0, pos_y=0, size_x=100, size_y=100)
        self.insert_legacy("board_items", id="n2", name="Idea", item_type="concept", color="#3b82f6",
                           pos_x=300, pos_y=0, size_x=100, size_y=100)
        self.insert_legacy("item_connections", id="c1", item_start_id="n1", item_end_id="n2",
                           conn_color="#ef4444", directed=0, curve_offset=40)
        data = self.load()
        nodes = {n["id"]: n for n in data["items"]}
        self.assertEqual((nodes["n1"]["shape"], nodes["n1"]["color_token"]), ("card", "green"))
        self.assertEqual((nodes["n2"]["shape"], nodes["n2"]["color_token"]), ("hex", "blue"))
        edge = data["connections"][0]
        self.assertEqual(edge["routing"], "curved")
        self.assertEqual(edge["end_marker"], "none")
        self.assertEqual(edge["color_token"], "red")
        # Centres (50,50) and (350,50): normal points down, the curve passes
        # half the old offset off the midpoint.
        self.assertEqual(edge["waypoints"], [[200.0, 70.0]])

    def test_parallel_old_connections_keep_fanning_apart(self):
        for nid, x in (("n1", 0), ("n2", 300)):
            self.insert_legacy("board_items", id=nid, name=nid, pos_x=x, pos_y=0, size_x=100, size_y=100)
        self.insert_legacy("item_connections", id="c1", item_start_id="n1", item_end_id="n2")
        self.insert_legacy("item_connections", id="c2", item_start_id="n2", item_end_id="n1")
        edges = {c["id"]: c for c in self.load()["connections"]}
        self.assertEqual(edges["c1"]["waypoints"], [[200.0, 39.0]])
        self.assertEqual(edges["c2"]["waypoints"], [[200.0, 61.0]])

    def test_malformed_values_from_a_merge_read_safely(self):
        self.insert_legacy("board_items", id="n1", name="a", item_type="standalone", shape="blob", props="{not json",
                           size_x=float("inf"))
        self.insert_legacy("board_items", id="n2", name="b")
        self.insert_legacy("item_connections", id="c1", item_start_id="n1", item_end_id="n2",
                           waypoints='[[1, 2], "x", [3]]', routing="zigzag", label_t=7)
        self.insert_legacy("item_connections", id="c2", item_start_id="n1", item_end_id="gone")
        data = self.load()
        node = next(n for n in data["items"] if n["id"] == "n1")
        self.assertEqual((node["shape"], node["props"], node["size_x"]), ("card", [], 160.0))
        self.assertEqual([c["id"] for c in data["connections"]], ["c1"])
        edge = data["connections"][0]
        self.assertEqual((edge["waypoints"], edge["routing"], edge["label_t"]), ([[1.0, 2.0]], "straight", 1.0))

    def test_hex_to_token(self):
        cases = {"#888888": "neutral", "#ffffff": "neutral", "#22c55e": "green", "#8b5cf6": "purple",
                 "#f97316": "amber", "#f43f5e": "red", "#06b6d4": "blue", "nonsense": "neutral"}
        for hex_color, token in cases.items():
            with self.subTest(hex_color=hex_color):
                self.assertEqual(boards.token_from_hex(hex_color), token)
        self.assertEqual(boards.token_from_hex("#4a9eff", "character"), "amber")
        self.assertEqual(boards.token_from_hex("#a855f7", "lore"), "blue")


class TestLiveEntities(BoardsBase):
    def test_bound_node_shows_the_live_name(self):
        with self.db() as conn:
            conn.execute("INSERT INTO characters (id, name) VALUES ('char-1', 'Sophia')")
            conn.execute("INSERT INTO lore_entities (id, name, category) VALUES ('lore-1', 'Ember Rite', 'magic')")
        a, b = new_id(), new_id()
        self.batch(self.put_node(a, name="Sophia", entity_type="character", entity_id="char-1"),
                   self.put_node(b, name="Rite", entity_type="lore", entity_id="lore-1"))
        with self.db() as conn:
            conn.execute("UPDATE characters SET name = 'Sofia' WHERE id = 'char-1'")
            conn.execute("UPDATE lore_entities SET deleted = 1 WHERE id = 'lore-1'")
        nodes = {n["id"]: n for n in self.load()["items"]}
        self.assertEqual((nodes[a]["entity_name"], nodes[a]["entity_missing"]), ("Sofia", False))
        self.assertEqual((nodes[b]["entity_name"], nodes[b]["entity_missing"]), (None, True))
        self.assertEqual(nodes[b]["name"], "Rite")

    def test_old_lore_type_names_are_lore(self):
        with self.db() as conn:
            conn.execute("INSERT INTO lore_entities (id, name, category) VALUES ('lore-2', 'Compass', 'item')")
            conn.execute("INSERT INTO board_items (id, board_id, name, entity_type, entity_id) "
                         "VALUES ('n1', ?, 'Compass', 'item', 'lore-2')", (self.board["id"],))
        node = self.load()["items"][0]
        self.assertEqual((node["entity_type"], node["entity_name"]), ("lore", "Compass"))


class TestSyncIntoOlderSchema(unittest.TestCase):
    """A device whose database predates the new board columns must still take
    them in on merge, not skip them while its version vector moves on."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="fn_boards_sync_")
        self.a = os.path.join(self.tmp, "a")
        self.b = os.path.join(self.tmp, "b")
        for p in (self.a, self.b):
            os.makedirs(p)
            db_setup.generate_project_db(p, {"project_name": "S", "genre": "fantasy", "project_id": "sync-boards"})
            with open(os.path.join(p, "fleshnote_project.json"), "w", encoding="utf-8") as f:
                json.dump({"project_id": "sync-boards", "schema_version": 2}, f)
        self._device = sync_core.DEVICE_ID

    def tearDown(self):
        sync_core.DEVICE_ID = self._device
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_new_columns_merge_into_older_schema(self):
        conn = sqlite3.connect(os.path.join(self.a, "fleshnote.db"))
        for col in ("waypoints", "routing", "end_marker"):
            conn.execute(f"ALTER TABLE item_connections DROP COLUMN {col}")
        conn.execute("ALTER TABLE board_items DROP COLUMN shape")
        conn.commit()
        conn.close()

        sync_core.DEVICE_ID = "device-b"
        board = run(boards.create_board(boards.BoardCreate(project_path=self.b, name="Magic")))["board"]
        n1, n2, e = new_id(), new_id(), new_id()
        run(boards.board_batch(boards.BoardBatch(project_path=self.b, board_id=board["id"], ops=[
            boards.BoardOp(op="put_node", id=n1, fields={"shape": "diamond"}),
            boards.BoardOp(op="put_node", id=n2, fields={}),
            boards.BoardOp(op="put_edge", id=e, fields={"item_start_id": n1, "item_end_id": n2,
                                                        "routing": "elbow", "waypoints": [[5, 6]]}),
        ])))

        sync_core.DEVICE_ID = "device-a"
        res = sync.sync_apply(sync.SyncApplyRequest(local_path=self.a, remote_path=self.b, resolutions={}))
        self.assertEqual(res["status"], "ok")
        conn = sqlite3.connect(os.path.join(self.a, "fleshnote.db"))
        edge = conn.execute("SELECT routing, waypoints FROM item_connections WHERE id = ?", (e,)).fetchone()
        shape = conn.execute("SELECT shape FROM board_items WHERE id = ?", (n1,)).fetchone()
        conn.close()
        self.assertEqual(edge, ("elbow", "[[5.0, 6.0]]"))
        self.assertEqual(shape, ("diamond",))

    def test_legend_syncs(self):
        sync_core.DEVICE_ID = "device-b"
        board = run(boards.create_board(boards.BoardCreate(project_path=self.b, name="Magic")))["board"]
        t, n1, n2, e = new_id(), new_id(), new_id(), new_id()
        run(boards.board_batch(boards.BoardBatch(project_path=self.b, board_id=board["id"], ops=[
            boards.BoardOp(op="put_type", id=t, fields={"name": "Fuels", "color_token": "red"}),
            boards.BoardOp(op="put_node", id=n1, fields={}),
            boards.BoardOp(op="put_node", id=n2, fields={}),
            boards.BoardOp(op="put_edge", id=e, fields={"item_start_id": n1, "item_end_id": n2, "type_id": t}),
        ])))

        sync_core.DEVICE_ID = "device-a"
        res = sync.sync_apply(sync.SyncApplyRequest(local_path=self.a, remote_path=self.b, resolutions={}))
        self.assertEqual(res["status"], "ok")
        data = run(boards.load_board(boards.BoardLoad(project_path=self.a, board_id=board["id"])))
        self.assertEqual([(x["name"], x["color_token"]) for x in data["types"]], [("Fuels", "red")])
        self.assertEqual(data["connections"][0]["type_id"], t)


if __name__ == "__main__":
    unittest.main()

"""Device-filter test: two devices' sessions in one DB -> summary.devices, heatmap + ops filters."""
import os
import sys
import shutil
import tempfile
import sqlite3
import datetime
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from db_setup import generate_project_db

project = os.path.join(tempfile.gettempdir(), "fn_device_test")
if os.path.exists(project):
    shutil.rmtree(project)
os.makedirs(project)

generate_project_db(project, {"project_name": "Dev", "genre": "fantasy"})

db_path = os.path.join(project, "fleshnote.db")
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("UPDATE chapters SET title='T' WHERE chapter_number=1")
conn.commit()

from routes import pentimento as pent
from routes import chapter_history as chh

ch = cur.execute("SELECT id FROM chapters WHERE chapter_number=1").fetchone()[0]
for device, text in (("desktop-aaaa", "Desktop words here."), ("mobile-bbbb", "Mobile words here.")):
    sid = str(uuid.uuid4())
    ts = datetime.datetime.now().isoformat()
    cur.execute("INSERT INTO pentimento_sessions (id, chapter_id, device_id, session_num, start_time) VALUES (?,?,?,?,?)",
                (sid, ch, device, 1, ts))
    conn.commit()
    pent.flush(pent.FlushRequest(project_path=project, session_id=sid, chapter_id=ch, ops=[
        {"timestamp": ts, "op_type": "insert", "para_index": 0, "char_offset": 0,
         "length": len(text), "text_content": text, "duration_ms": 1000},
    ]))
    pent.session_end(pent.SessionEnd(project_path=project, session_id=sid))
conn.commit()

# 1. summary must report both devices + current
s = pent.summary(pent.ProjectScoped(project_path=project))
devs = s["devices"]
assert set(devs.keys()) == {"desktop-aaaa", "mobile-bbbb"}, f"devices wrong: {devs}"
assert s["current_device"], "current_device missing"
print("summary devices:", {k: v["sessions"] for k, v in devs.items()})

# 2. heatmap filtered by device only includes that device's words
hm_a = pent.heatmap(pent.ChapterDeviceScoped(project_path=project, chapter_id=ch, device_id="desktop-aaaa"))
assert any(p["inserted"] == 19 for p in hm_a["paragraphs"]), hm_a["paragraphs"]
assert not any(p["inserted"] == 18 for p in hm_a["paragraphs"]), "mobile content leaked into desktop filter"

hm_all = pent.heatmap(pent.ChapterDeviceScoped(project_path=project, chapter_id=ch))
# both devices typed into paragraph 0 → aggregated (19 + 18) in one paragraph
assert hm_all["session_count"] == 2
assert any(p["inserted"] == 37 for p in hm_all["paragraphs"])

# unknown device -> empty
hm_none = pent.heatmap(pent.ChapterDeviceScoped(project_path=project, chapter_id=ch, device_id="nope"))
assert hm_none["paragraphs"] == [] and hm_none["session_count"] == 0

# 3. ops filtered by device
ops_a = pent.get_ops(pent.ChapterDeviceScoped(project_path=project, chapter_id=ch, device_id="mobile-bbbb"))
assert all(o["text_content"] == "Mobile words here." for o in ops_a["ops"]), ops_a["ops"]

ops_all = pent.get_ops(pent.ChapterDeviceScoped(project_path=project, chapter_id=ch))
assert len(ops_all["ops"]) == 2

# 4. history list carries device_id (snapshots dedupe on identical prose_hash,
#    so at least the desktop session's snapshot must be tagged)
lst = chh.history_list(chh.ChapterScoped(project_path=project, chapter_id=ch))
assert lst["snapshots"], "no snapshots"
assert all(sn["device_id"] in {"desktop-aaaa", "mobile-bbbb", None} for sn in lst["snapshots"])
assert any(sn["device_id"] == "desktop-aaaa" for sn in lst["snapshots"])

print("DEVICE_FILTER_TEST_OK")

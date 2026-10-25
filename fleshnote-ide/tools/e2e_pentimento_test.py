"""End-to-end: fake project -> pentimento endpoints -> local Go TSA -> CLI verifier."""
import os
import sys
import time
import shutil
import tempfile
import datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_setup import generate_project_db  # noqa: E402

TSA = "http://127.0.0.1:8091"
project = os.path.join(tempfile.gettempdir(), "fn_e2e_project")
if os.path.exists(project):
    shutil.rmtree(project)
os.makedirs(project, exist_ok=True)

db_path = os.path.join(project, "fleshnote.db")
from db_setup import generate_project_db
answers = {"project_name": "E2E", "author": "tester", "genre": "fantasy",
           "language": "en", "ui_language": "en", "story_language": "en"}
db = generate_project_db(project, answers)

import sqlite3
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("UPDATE chapters SET title='Test Chapter', status='draft' WHERE chapter_number=1")
cur.execute("INSERT INTO project_config (config_key, config_value, config_type) VALUES ('pentimento_verification', 'true', 'toggle')")
cur.execute("INSERT INTO project_config (config_key, config_value, config_type) VALUES ('pentimento_tsa_url', ?, 'string')", (TSA,))
cur.execute("INSERT INTO project_config (config_key, config_value, config_type) VALUES ('pentimento_external_tsa', 'false', 'string')")
conn.commit()
conn.close()

from routes import pentimento as pent  # noqa: E402

# simulate a writing session with a couple of ops
st = pent.session_start(pent.SessionStart(project_path=project, chapter_id="ch-e2e-1"))
sid = st["session_id"]
ops = [
    {"timestamp": datetime.datetime.now().isoformat(), "op_type": "insert", "para_index": 0,
     "char_offset": 0, "length": 5, "text_content": "Hello", "duration_ms": 1500},
    {"timestamp": datetime.datetime.now().isoformat(), "op_type": "pause", "para_index": 0,
     "char_offset": 0, "length": 0, "text_content": None, "duration_ms": 3000},
    {"timestamp": datetime.datetime.now().isoformat(), "op_type": "insert", "para_index": 0,
     "char_offset": 5, "length": 7, "text_content": " world!", "duration_ms": 900},
]
pent.flush(pent.FlushRequest(project_path=project, session_id=sid, chapter_id="ch-e2e-1", ops=ops))
res = pent.session_end(pent.SessionEnd(project_path=project, session_id=sid))
print("session sealed:", res["session_hash"][:16], "receipt:", res["receipt_id"])

# wait for the background anchoring thread
for _ in range(40):
    rec = pent.receipts(pent.ProjectScoped(project_path=project))
    if rec["by_status"].get("anchored", 0) > 0:
        break
    time.sleep(0.5)
print("receipts:", rec["total"], "by_status:", rec["by_status"])

# run the CLI verifier as a subprocess (exact user-facing flow)
import subprocess
verifier = os.path.join(os.path.dirname(os.path.abspath(__file__)), "verify_pentimento.py")
proc = subprocess.run([sys.executable, verifier, project, "--tsa-url", TSA, "--verbose"],
                      capture_output=True, text=True)
print(proc.stdout)
if proc.stderr:
    print("stderr:", proc.stderr)
print("verifier exit code:", proc.returncode)

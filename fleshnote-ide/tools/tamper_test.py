"""Tamper test: rewrite an op in the DB, verifier must FAIL the recomputed hash."""
import os
import sys
import shutil
import tempfile
import sqlite3
import subprocess
import datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

TSA = "http://127.0.0.1:8091"
project = os.path.join(tempfile.gettempdir(), "fn_e2e_tamper")
if os.path.exists(project):
    shutil.rmtree(project)
os.makedirs(project)

from db_setup import generate_project_db
generate_project_db(project, {"project_name": "Tamper", "genre": "fantasy"})

db_path = os.path.join(project, "fleshnote.db")
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("UPDATE chapters SET title='T', status='draft' WHERE chapter_number=1")
cur.execute("INSERT INTO project_config (config_key, config_value, config_type) VALUES ('pentimento_verification', 'true', 'toggle')")
cur.execute("INSERT INTO project_config (config_key, config_value, config_type) VALUES ('pentimento_tsa_url', ?, 'string')", (TSA,))
cur.execute("INSERT INTO project_config (config_key, config_value, config_type) VALUES ('pentimento_external_tsa', 'false', 'string')")
conn.commit()
conn.close()

from routes import pentimento as pent
conn = sqlite3.connect(db_path)
ch = conn.execute("SELECT id FROM chapters WHERE chapter_number=1").fetchone()[0]
conn.close()
st = pent.session_start(pent.SessionStart(project_path=project, chapter_id=ch))
sid = st["session_id"]
ops = [{"timestamp": datetime.datetime.now().isoformat(), "op_type": "insert", "para_index": 0,
        "char_offset": 0, "length": 9, "text_content": "Innocent!", "duration_ms": 800}]
pent.flush(pent.FlushRequest(project_path=project, session_id=sid, chapter_id=ch, ops=ops))
pent.session_end(pent.SessionEnd(project_path=project, session_id=sid))

import time
for _ in range(40):
    rec = pent.receipts(pent.ProjectScoped(project_path=project))
    if rec["by_status"].get("anchored", 0) > 0:
        break
    time.sleep(0.5)
assert rec["by_status"].get("anchored", 0) > 0, "anchor never happened"

# TAMPER: rewrite the op text in the DB (the forger's move)
conn = sqlite3.connect(db_path)
conn.execute("UPDATE pentimento_ops SET text_content='Forged!!' WHERE text_content='Innocent!'")
conn.commit()
conn.close()

import subprocess
verifier = os.path.join(os.path.dirname(os.path.abspath(__file__)), "verify_pentimento.py")
proc = subprocess.run([sys.executable, verifier, project, "--tsa-url", TSA, "--verbose"],
                      capture_output=True, text=True)
print(proc.stdout)
print("verifier exit code:", proc.returncode, "(expect 1 = FAIL)")

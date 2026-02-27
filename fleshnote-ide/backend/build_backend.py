import os
import shutil
import subprocess
import sys

def build():
    print("--- FleshNote Backend Build Started ---")
    
    # 1. Clean previous builds
    folders_to_clean = ['build', 'dist']
    for folder in folders_to_clean:
        if os.path.exists(folder):
            print(f"Cleaning {folder}...")
            shutil.rmtree(folder)
            
    # 2. Run PyInstaller
    print("Running PyInstaller...")
    try:
        subprocess.check_call([
            sys.executable, "-m", "PyInstaller", "backend.spec", "--noconfirm"
        ])
    except subprocess.CalledProcessError as e:
        print(f"PyInstaller failed: {e}")
        sys.exit(1)
        
    # 3. Verify output
    backend_exe = os.path.join("dist", "backend", "backend.exe" if sys.platform == "win32" else "backend")
    if os.path.exists(backend_exe):
        print(f"SUCCESS: Backend bundled at {os.path.abspath(backend_exe)}")
    else:
        print("ERROR: Backend executable not found in dist/backend/")
        sys.exit(1)

if __name__ == "__main__":
    build()

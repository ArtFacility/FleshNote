import os
import shutil
import subprocess
import sys

def ensure_nltk_data():
    """Download WordNet + OMW data for bundling (English synonyms always available offline)."""
    nltk_dir = os.path.join(os.path.dirname(__file__), "nltk_data")
    wordnet_ok = (
        os.path.exists(os.path.join(nltk_dir, "corpora", "wordnet.zip"))
        or os.path.isdir(os.path.join(nltk_dir, "corpora", "wordnet"))
    )
    omw_ok = (
        os.path.exists(os.path.join(nltk_dir, "corpora", "omw-1.4.zip"))
        or os.path.isdir(os.path.join(nltk_dir, "corpora", "omw-1.4"))
    )
    if wordnet_ok and omw_ok:
        print("NLTK WordNet data already present — skipping download.")
        return

    print("Downloading NLTK WordNet data for bundling...")
    import nltk
    os.makedirs(nltk_dir, exist_ok=True)
    nltk.download("wordnet", download_dir=nltk_dir, quiet=False)
    nltk.download("omw-1.4", download_dir=nltk_dir, quiet=False)
    print("NLTK WordNet data ready.")

def build():
    print("--- FleshNote Backend Build Started ---")

    # 0. Ensure NLTK WordNet data is available for bundling
    ensure_nltk_data()

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

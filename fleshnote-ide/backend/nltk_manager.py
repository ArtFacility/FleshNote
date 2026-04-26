"""
FleshNote — NLTK Data Manager
Handles on-demand download of WordNet and other NLTK data to {AppData}/FleshNote/Models/nltk_data/
Mirrors the nlp_manager.py pattern for spaCy models.
English WordNet is also bundled with the installer (next to the frozen exe) for offline use.
"""
import os
import sys
import nltk

# Global cache flags for data availability
_wordnet_ready = False
_cmudict_ready = False


def _get_bundled_nltk_path() -> str | None:
    """Return the bundled NLTK data path (PyInstaller frozen builds), or None."""
    if getattr(sys, 'frozen', False):
        return os.path.join(os.path.dirname(sys.executable), 'nltk_data')
    return None


def get_nltk_data_dir() -> str:
    """Return the persistent OS-level directory for NLTK data."""
    if sys.platform == "win32":
        base = os.getenv("APPDATA") or os.path.expanduser("~\\AppData\\Roaming")
        return os.path.join(base, "FleshNote", "Models", "nltk_data")
    elif sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/FleshNote/Models/nltk_data")
    else:
        return os.path.expanduser("~/.config/FleshNote/Models/nltk_data")


def _ensure_nltk_path():
    """Add bundled + user data dirs to NLTK's search path. Returns user data dir."""
    # Bundled path (read-only, ships with installer)
    bundled = _get_bundled_nltk_path()
    if bundled and bundled not in nltk.data.path:
        nltk.data.path.insert(0, bundled)

    # User data dir (writable, for additional downloads)
    data_dir = get_nltk_data_dir()
    os.makedirs(data_dir, exist_ok=True)
    if data_dir not in nltk.data.path:
        nltk.data.path.insert(0, data_dir)
    return data_dir


def _wordnet_data_present(data_dir: str) -> bool:
    """Check if WordNet zip/dir exists on disk (faster than nltk.data.find for custom dirs)."""
    corpora = os.path.join(data_dir, "corpora")
    return (
        os.path.exists(os.path.join(corpora, "wordnet.zip"))
        or os.path.isdir(os.path.join(corpora, "wordnet"))
    )


def check_wordnet_exists() -> bool:
    """Non-downloading check for WordNet and multilingual data availability."""
    _ensure_nltk_path()
    data_dir = get_nltk_data_dir()
    bundled = _get_bundled_nltk_path()
    
    # Check bundled
    if bundled and _wordnet_data_present(bundled):
        return True
    
    # Check user data
    return _wordnet_data_present(data_dir)


def _hun_data_present(data_dir: str) -> bool:
    """Check if Hungarian data is merged into omw-1.4."""
    hun_tab = os.path.join(data_dir, "corpora", "omw-1.4", "hun", "wn-data-hun.tab")
    return os.path.exists(hun_tab)


def ensure_wordnet_available() -> bool:
    """Download WordNet + OMW + Extended OMW (for Hungarian) if not present."""
    global _wordnet_ready
    if _wordnet_ready:
        return True

    data_dir = _ensure_nltk_path()
    corpora_dir = os.path.join(data_dir, "corpora")

    # If WordNet is already here, check for Hungarian specifically
    # but only if we are in a non-frozen environment or user-writable area
    wordnet_ready = False
    bundled = _get_bundled_nltk_path()
    if bundled and _wordnet_data_present(bundled):
        wordnet_ready = True
    elif _wordnet_data_present(data_dir):
        wordnet_ready = True

    if wordnet_ready and _hun_data_present(data_dir):
        _wordnet_ready = True
        return True

    print("DOWNLOAD_START: wordnet", flush=True)
    print("DOWNLOAD_PROGRESS: 10", flush=True)

    try:
        # Standard downloads
        nltk.download("wordnet", download_dir=data_dir, quiet=True)
        print("DOWNLOAD_PROGRESS: 30", flush=True)
        nltk.download("omw-1.4", download_dir=data_dir, quiet=True)
        print("DOWNLOAD_PROGRESS: 50", flush=True)
        
        # Extended OMW for Hungarian
        nltk.download("extended_omw", download_dir=data_dir, quiet=True)
        print("DOWNLOAD_PROGRESS: 70", flush=True)

        # Merge Hungarian into omw-1.4
        import zipfile
        import shutil

        # 1. Unzip omw-1.4
        omw_zip = os.path.join(corpora_dir, "omw-1.4.zip")
        omw_dir = os.path.join(corpora_dir, "omw-1.4")
        if os.path.exists(omw_zip) and not os.path.exists(omw_dir):
            with zipfile.ZipFile(omw_zip, 'r') as z:
                z.extractall(corpora_dir)
        
        # 2. Unzip extended_omw
        ext_zip = os.path.join(corpora_dir, "extended_omw.zip")
        ext_dir = os.path.join(corpora_dir, "extended_omw")
        if os.path.exists(ext_zip) and not os.path.exists(ext_dir):
            with zipfile.ZipFile(ext_zip, 'r') as z:
                z.extractall(corpora_dir)

        # 3. Copy Hungarian files
        hun_src = os.path.join(ext_dir, "wikt", "wn-wikt-hun.tab")
        hun_dst_dir = os.path.join(omw_dir, "hun")
        hun_dst = os.path.join(hun_dst_dir, "wn-data-hun.tab")
        
        if os.path.exists(hun_src):
            os.makedirs(hun_dst_dir, exist_ok=True)
            shutil.copy(hun_src, hun_dst)
            print("DOWNLOAD_LOG: Hungarian WordNet data merged.", flush=True)

        print("DOWNLOAD_PROGRESS: 100", flush=True)
        print("DOWNLOAD_COMPLETE", flush=True)
        return True
    except Exception as e:
        print(f"DOWNLOAD_LOG: Failed to setup WordNet: {e}", flush=True)
        return False


def _cmudict_data_present(data_dir: str) -> bool:
    """Check if cmudict is present on disk."""
    corpora = os.path.join(data_dir, "corpora")
    return (
        os.path.exists(os.path.join(corpora, "cmudict.zip"))
        or os.path.isdir(os.path.join(corpora, "cmudict"))
    )

def ensure_cmudict_available() -> bool:
    """Download cmudict for phonetic processing if not present."""
    global _cmudict_ready
    if _cmudict_ready:
        return True

    data_dir = _ensure_nltk_path()
    
    # Check bundled
    bundled = _get_bundled_nltk_path()
    if bundled and _cmudict_data_present(bundled):
        return True
        
    # Check user data
    if _cmudict_data_present(data_dir):
        _cmudict_ready = True
        return True
        
    print("DOWNLOAD_START: cmudict", flush=True)
    print("DOWNLOAD_PROGRESS: 10", flush=True)
    
    try:
        nltk.download("cmudict", download_dir=data_dir, quiet=True)
        print("DOWNLOAD_PROGRESS: 100", flush=True)
        print("DOWNLOAD_COMPLETE", flush=True)
        _cmudict_ready = True
        return True
    except Exception as e:
        print(f"DOWNLOAD_LOG: Failed to setup cmudict: {e}", flush=True)
        return False


def get_synonyms(word: str, lang: str = "eng") -> list:
    """
    Get synonyms grouped by synset meaning from WordNet.
    If lang != "eng" and no results found, automatically retries with English.
    Returns list of dicts: [{ definition: str, pos: str, synonyms: [str] }]
    """
    ensure_wordnet_available()
    from nltk.corpus import wordnet

    word_clean = word.strip().lower()
    results = _lookup_synsets(wordnet, word_clean, lang)

    # Auto-fallback to English if non-English yielded nothing
    if not results and lang != "eng":
        results = _lookup_synsets(wordnet, word_clean, "eng")

    return results


def _lookup_synsets(wordnet, word: str, lang: str) -> list:
    """Query WordNet for a word in a specific language and return grouped synonyms."""
    try:
        synsets = wordnet.synsets(word, lang=lang)
    except Exception:
        # Language not available in OMW — fall back silently
        return []

    results = []
    seen_words = set()
    seen_words.add(word.lower())

    for ss in synsets:
        try:
            if lang == "eng":
                lemma_names = [
                    lemma.name().replace("_", " ")
                    for lemma in ss.lemmas()
                ]
            else:
                lemma_names = [
                    name.replace("_", " ")
                    for name in ss.lemma_names(lang)
                ]
        except Exception:
            continue

        # Filter out the original word and already-seen words
        unique = []
        for w in lemma_names:
            if w.lower() not in seen_words:
                seen_words.add(w.lower())
                unique.append(w)

        if unique:
            results.append({
                "definition": ss.definition(),
                "pos": ss.pos(),
                "synonyms": unique,
            })

    return results

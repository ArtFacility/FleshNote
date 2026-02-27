import os
import sys
import subprocess
import tempfile
import tarfile
import zipfile
import shutil
from urllib.request import urlretrieve, urlopen
from urllib.error import URLError
import spacy
from spacy_config import SPACY_MODELS


def is_frozen() -> bool:
    """Returns True if running inside a PyInstaller bundle."""
    return getattr(sys, '_MEIPASS', None) is not None


def get_models_dir() -> str:
    """Return the persistent OS-level directory for downloaded models."""
    if sys.platform == "win32":
        base = os.getenv("APPDATA") or os.path.expanduser("~\\AppData\\Roaming")
        return os.path.join(base, "FleshNote", "Models")
    elif sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/FleshNote/Models")
    else:
        return os.path.expanduser("~/.config/FleshNote/Models")


def check_model_exists(lang_code: str) -> bool:
    """Returns True if the required NLP module is downloaded and available."""
    model_name = SPACY_MODELS.get(lang_code)
    if not model_name:
        return False

    models_dir = get_models_dir()
    if models_dir not in sys.path:
        sys.path.insert(0, models_dir)

    try:
        if lang_code == "hu" and model_name == "huspacy":
            import huspacy
            from spacy.util import is_package
            return is_package("hu_core_news_lg")
        else:
            from spacy.util import is_package
            return is_package(model_name)
    except Exception:
        return False


def _resolve_download_url(lang_code: str, model_name: str) -> tuple[str, str]:
    """
    Resolve the download URL and archive type for a model.
    Returns (url, archive_type) where archive_type is 'whl' or 'tar.gz'.
    """
    if lang_code == "hu" and model_name == "huspacy":
        url = "https://huggingface.co/huspacy/hu_core_news_lg/resolve/v3.8.0/hu_core_news_lg-any-py3-none-any.whl"
        return url, "whl"
    else:
        from spacy.cli.download import get_compatibility, get_version
        compat = get_compatibility()
        version = get_version(model_name, compat)
        url = f"https://github.com/explosion/spacy-models/releases/download/{model_name}-{version}/{model_name}-{version}.tar.gz"
        return url, "tar.gz"


def _download_progress_hook(block_num, block_size, total_size):
    """Progress hook for urlretrieve — emits DOWNLOAD_PROGRESS signals."""
    if total_size > 0:
        downloaded = block_num * block_size
        pct = min(int((downloaded / total_size) * 80), 80)  # Cap at 80%, save 80-100 for extraction
        # Only emit at meaningful intervals to avoid spamming stdout
        if pct % 10 == 0 and pct > 0:
            print(f"DOWNLOAD_PROGRESS: {pct}", flush=True)


def _download_frozen(url: str, archive_type: str, models_dir: str):
    """
    Download and extract a model without pip (for PyInstaller-frozen builds).
    Since sys.executable points to backend.exe, we can't use 'pip install'.
    Instead: download archive via urllib -> extract to models_dir.
    """
    tmp_dir = tempfile.mkdtemp(prefix="fleshnote_model_")

    try:
        # Download the archive
        ext = ".whl" if archive_type == "whl" else ".tar.gz"
        archive_path = os.path.join(tmp_dir, f"model{ext}")

        print(f"DOWNLOAD_LOG: Downloading from {url}", flush=True)
        print("DOWNLOAD_PROGRESS: 5", flush=True)

        urlretrieve(url, archive_path, reporthook=_download_progress_hook)

        print("DOWNLOAD_PROGRESS: 80", flush=True)
        print("DOWNLOAD_LOG: Extracting model...", flush=True)

        # Extract the archive
        extract_dir = os.path.join(tmp_dir, "extracted")
        os.makedirs(extract_dir, exist_ok=True)

        if archive_type == "whl":
            # .whl files are just zip archives
            with zipfile.ZipFile(archive_path, 'r') as zf:
                zf.extractall(extract_dir)
        else:
            # .tar.gz for spaCy official models
            with tarfile.open(archive_path, 'r:gz') as tf:
                tf.extractall(extract_dir)

        print("DOWNLOAD_PROGRESS: 90", flush=True)

        # Move the extracted package directories into models_dir
        # SpaCy .tar.gz structure: model-version/model_name/...
        # .whl structure: package_name/... and package_name-version.dist-info/...
        os.makedirs(models_dir, exist_ok=True)

        for item in os.listdir(extract_dir):
            src = os.path.join(extract_dir, item)
            dst = os.path.join(models_dir, item)

            if os.path.isdir(src):
                # For tar.gz spaCy models, the top-level dir is model-version
                # which contains the actual package dir inside
                inner_items = os.listdir(src)
                has_setup = any(f in inner_items for f in ['setup.py', 'setup.cfg', 'pyproject.toml', 'meta.json'])
                has_package = any(os.path.isdir(os.path.join(src, i)) and not i.startswith('.') and not i.endswith('.dist-info') and not i.endswith('.egg-info') for i in inner_items)

                if has_setup and has_package:
                    # This is a source distribution wrapper — copy the inner package dirs
                    for inner in inner_items:
                        inner_src = os.path.join(src, inner)
                        inner_dst = os.path.join(models_dir, inner)
                        if os.path.isdir(inner_src) and not inner.startswith('.'):
                            if os.path.exists(inner_dst):
                                shutil.rmtree(inner_dst)
                            shutil.copytree(inner_src, inner_dst)
                else:
                    # Direct package directory (whl extract) — copy as-is
                    if os.path.exists(dst):
                        shutil.rmtree(dst)
                    shutil.copytree(src, dst)

    finally:
        # Clean up temp directory
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _download_with_pip(url: str, models_dir: str):
    """
    Download a model using pip subprocess (for development / unfrozen builds).
    sys.executable is a real Python interpreter here, so pip works normally.
    """
    cmd = [
        sys.executable,
        "-m", "pip", "install",
        url,
        "--target", models_dir,
        "--no-deps"
    ]

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    for line in process.stdout:
        line_text = line.strip()
        if line_text:
            print(f"DOWNLOAD_LOG: {line_text}", flush=True)

            if "Downloading" in line_text:
                print("DOWNLOAD_PROGRESS: 40", flush=True)
            elif "Installing collected packages:" in line_text or "Successfully installed" in line_text:
                print("DOWNLOAD_PROGRESS: 80", flush=True)

    process.wait()

    if process.returncode != 0:
        raise RuntimeError(f"pip install failed with return code {process.returncode}")


def get_nlp(lang_code: str):
    """
    Get the NLP pipeline for the requested language.
    Downloads the model to an external directory if missing.
    Falls back to spacy.blank if no model exists or download fails.
    """
    model_name = SPACY_MODELS.get(lang_code)

    # Fallback to blank tokenization if language has no configured model
    if not model_name:
        print(f"No full pipeline configured for '{lang_code}', falling back to spacy.blank", flush=True)
        try:
            return spacy.blank(lang_code)
        except Exception:
            return spacy.blank("en")

    models_dir = get_models_dir()
    os.makedirs(models_dir, exist_ok=True)

    # Adding models_dir to sys.path allows modules (like huspacy) to be found
    if models_dir not in sys.path:
        sys.path.insert(0, models_dir)

    def load_model():
        if lang_code == "hu" and model_name == "huspacy":
            import huspacy
            return huspacy.load()
        else:
            return spacy.load(model_name)

    if check_model_exists(lang_code):
        return load_model()
    else:
        # Model not found, trigger download
        print(f"DOWNLOAD_START: {model_name}", flush=True)

        try:
            url, archive_type = _resolve_download_url(lang_code, model_name)

            if is_frozen():
                # Production: download + extract directly (pip not available)
                _download_frozen(url, archive_type, models_dir)
            else:
                # Development: use pip install --target (normal Python interpreter)
                install_target = url
                if lang_code == "hu" and model_name == "huspacy":
                    install_target = f"hu_core_news_lg @ {url}"
                _download_with_pip(install_target, models_dir)

            print("DOWNLOAD_PROGRESS: 100", flush=True)
            print("DOWNLOAD_COMPLETE", flush=True)

            # Now try loading after successful installation
            return load_model()

        except Exception as e:
            print(f"Error during model {model_name} download: {e}", flush=True)
            return spacy.blank(lang_code)

# Replaces the NLTK hook that comes with PyInstaller (pyinstaller-hooks-contrib), which copies
# every NLTK data folder found on the build machine (e.g. %APPDATA%\nltk_data, ~190 MB on the
# author's) into the frozen backend. FleshNote bundles only the WordNet zips backend.spec lists;
# everything else nltk_manager.py downloads on demand.
from PyInstaller.utils.hooks import collect_data_files

datas = collect_data_files("nltk", False)
hiddenimports = ["nltk.chunk.named_entity"]

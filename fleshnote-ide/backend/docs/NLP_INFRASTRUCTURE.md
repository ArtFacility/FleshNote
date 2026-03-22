# NLP Infrastructure

FleshNote uses advanced Natural Language Processing (NLP) locally on the user's machine to power the **Janitor** (readability and grammar auditing), **Synonyms**, and **Spellcheck**. To avoid shipping a massively bloated executable (which would easily exceed 1GB+ if all language models were bundled), FleshNote dynamically procures necessary data packages at runtime and caches them in the OS profile (`AppData` or `~/.config`).

---

## 1. SpaCy Management (`nlp_manager.py`)

SpaCy powers the POS-tagging, dependency parsing, and Named Entity Recognition (NER). It is required for the Janitor's passive voice detection and the Manuscript Import NER tool.

### Model Resolution Workflow
When a project loads, the frontend queries if the required language model (e.g., `en_core_web_sm` for English, or `huspacy` for Hungarian) is available via `window.api.checkNlpModel()`. If missing, an asynchronous download begins.

1. **URL Resolution**: Translates the language code into a direct GitHub release tarball or HuggingFace wheel URL (for instance, the `huspacy` wrapper dynamically fetches the `hu_core_news_lg` `.whl`).
2. **Execution Context Branching**:
   - **Development (Unfrozen)**: Triggers an isolated `pip install --target` subprocess.
   - **Production (PyInstaller Frozen)**: Since `pip` isn't accessible, it natively downloads the archive via `urllib`, extracts the `.tar.gz` or `.whl` payload in a generic temp folder, and manually builds the package structure inside the destination models folder.
3. **Progress Telemetry**: As chunks are downloaded, Python flushes `DOWNLOAD_PROGRESS` strings to stdout, which the Electron IPC captures to render a progress bar in the UI.

---

## 2. NLTK Management (`nltk_manager.py`)

NLTK and its WordNet corpus power the generic Synonyms engine and localized dictionary lookups.

### Corpus Resolution Workflow
Similar to spaCy, `nltk_manager.py` checks both the bundled PyInstaller runtime folder (which ships with a minimal English WordNet by default) and the persistent `AppData` folder.

1. **Multilingual Fetching**: If the user desires non-English synonyms, the manager downloads the Open Multilingual WordNet (`omw-1.4`).
2. **Extended Fallbacks**: For languages like Hungarian that aren't native to `omw-1.4`, the manager downloads the `extended_omw` package, parses the zip file, and seamlessly merges the `.tab` dictionary files into the primary `omw` directory structure so NLTK can read it natively.
3. **Graceful Degradation**: If an exotic language request yields no synsets, `get_synonyms()` silently falls back to querying the English corpus to prevent empty UI loops.

# -*- mode: python ; coding: utf-8 -*-
import sys
import os

block_cipher = None

# Collect all routes and export renderers as hidden imports to ensure they are bundled
hidden_imports = [
    'routes.chapters',
    'routes.characters',
    'routes.locations',
    'routes.entities',
    'routes.imports',
    'routes.groups',
    'routes.knowledge',
    'routes.secrets',
    'routes.calendar',
    'routes.quick_notes',
    'routes.annotations',
    'routes.settings',
    'routes.export',
    'routes.cover',
    'routes.sync',
    'routes.remote_sync',
    'remote_sync_session',
    # multipart form parsing — needed for remote-sync file uploads, imported lazily by starlette
    'multipart',
    'multipart.multipart',
    'python_multipart',
    'export.render_txt',
    'export.render_md',
    'export.render_html',
    'export.render_docx',
    'export.render_pdf',
    'export.render_epub',
    'export.strip',
    'export.typography',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'export.document',
    # Hyphenation for print exports (dictionaries are collected below)
    'pyphen',
    # NLTK synonyms
    'routes.synonyms',
    'nltk_manager',
    'nltk',
    'nltk.corpus',
    'nltk.corpus.reader',
    'nltk.corpus.reader.wordnet',
    # Spell check
    'routes.spellcheck',
    'phunspell',
    'spylls',
    'spylls.spellcheck',
    'spylls.spellcheck.dictionary',
]

datas = [
    # Crimson Pro, embedded in HTML and PDF exports
    ('export/templates/fonts', 'export/templates/fonts'),
    # Bundled NLTK WordNet data — English synonyms available offline
    ('nltk_data', 'nltk_data'),
    # Name generator datasets (presets and real name lists)
    ('tools/name_gen/data', 'tools/name_gen/data'),
    # Janitor word library (lexicon_engine.py raises at import if missing)
    ('lexicons', 'lexicons'),
    ('stopwords.json', '.'),
    # .flnote folder icon (desktop.ini IconResource needs an .ico)
    ('../resources/icons/fleshnote.ico', 'icons'),
    ('../resources/icons/fleshnote-project-256.png', 'icons'),
]

from PyInstaller.utils.hooks import collect_submodules, collect_data_files

hidden_imports.extend(collect_submodules('numpy'))

# Bundle phunspell Hunspell dictionaries (.dic/.aff files)
datas += collect_data_files('phunspell')
datas += collect_data_files('pyphen')
hidden_imports.extend(collect_submodules('spacy'))
hidden_imports.extend(collect_submodules('thinc'))

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # SpaCy language models — must NOT be bundled; downloaded to AppData at runtime
        'en_core_web_sm', 'en_core_web_md', 'en_core_web_lg', 'en_core_web_trf',
        'pl_core_news_sm', 'pl_core_news_md', 'pl_core_news_lg',
        'hu_core_news_lg', 'hu_core_news_md',
        # Dev-only packages that don't belong in the bundle
        'pytest', 'setuptools', 'pip',
        'tkinter', '_tkinter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend'
)

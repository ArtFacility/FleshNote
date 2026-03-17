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
    # reportlab barcode submodules — dynamically imported, PyInstaller can't trace them
    'reportlab.graphics.barcode.code128',
    'reportlab.graphics.barcode.code39',
    'reportlab.graphics.barcode.code93',
    'reportlab.graphics.barcode.common',
    'reportlab.graphics.barcode.eanbc',
    'reportlab.graphics.barcode.qr',
    'reportlab.graphics.barcode.widgets',
    'reportlab.graphics.barcode.dmtx',
    'reportlab.graphics.barcode.ecc200datamatrix',
    'reportlab.graphics.barcode.fourstate',
    'reportlab.graphics.barcode.lto',
    'reportlab.graphics.barcode.usps',
    'reportlab.graphics.barcode.usps4s',
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
    ('export/templates/manuscript.css', 'export/templates'),
    # Bundled NLTK WordNet data — English synonyms available offline
    ('nltk_data', 'nltk_data'),
]

from PyInstaller.utils.hooks import collect_submodules, collect_data_files

hidden_imports.extend(collect_submodules('numpy'))

# Bundle phunspell Hunspell dictionaries (.dic/.aff files)
datas += collect_data_files('phunspell')
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

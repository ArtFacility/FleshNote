#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "============================================"
echo "  FleshNote IDE — Full Build"
echo "============================================"
echo ""

# ── Detect platform ──
if [ $# -ge 1 ]; then
    TARGET="$1"
else
    case "$(uname -s)" in
        Linux*)  TARGET="linux" ;;
        Darwin*) TARGET="mac" ;;
        MINGW*|MSYS*|CYGWIN*) TARGET="win" ;;
        *)
            echo "ERROR: Could not detect platform. Pass 'linux', 'mac', or 'win' as argument."
            exit 1
            ;;
    esac
    echo "Auto-detected platform: $TARGET"
fi

# Validate target
case "$TARGET" in
    linux|mac|win) ;;
    *)
        echo "ERROR: Unknown target '$TARGET'. Use: linux, mac, or win"
        exit 1
        ;;
esac

# ── Step 1: Build Python backend with PyInstaller ──
echo "[1/3] Building Python backend..."
echo ""

cd backend

if [ ! -d ".venv" ]; then
    echo "ERROR: Python venv not found at backend/.venv"
    echo "Run: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements_build.txt"
    exit 1
fi

source .venv/bin/activate
python build_backend.py

cd ..

echo ""
echo "   Backend built successfully."
echo ""

# ── Step 2: Build Electron frontend ──
echo "[2/3] Building Electron frontend (typecheck + vite)..."
echo ""

npm run build

echo ""
echo "   Frontend built successfully."
echo ""

# ── Step 3: Package with electron-builder ──
echo "[3/3] Packaging $TARGET installer..."
echo ""

npx electron-builder --"$TARGET"

echo ""
echo "============================================"
echo "  BUILD COMPLETE"
echo "  Check dist/ for the installer."
echo "============================================"
echo ""

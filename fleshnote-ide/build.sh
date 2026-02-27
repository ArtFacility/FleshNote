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

# ── Relaunch in a terminal on Linux if not attached to one ──
if [ "$TARGET" = "linux" ] && [ -z "${IN_TERMINAL:-}" ] && [ ! -t 1 ] && [ -n "${DISPLAY:-}" ]; then
    export IN_TERMINAL=1
    SCRIPT_PATH=$(readlink -f "$0")
    
    echo "Relaunching in a terminal window..."
    for term in gnome-terminal konsole xfce4-terminal x-terminal-emulator xterm; do
        if command -v "$term" >/dev/null 2>&1; then
            case "$term" in
                gnome-terminal)
                    exec "$term" -- bash -c '"$0" "$@"; echo; read -rp "Press Enter to exit..."' "$SCRIPT_PATH" "$@"
                    ;;
                xfce4-terminal)
                    exec "$term" -x bash -c '"$0" "$@"; echo; read -rp "Press Enter to exit..."' "$SCRIPT_PATH" "$@"
                    ;;
                *)
                    exec "$term" -e bash -c '"$0" "$@"; echo; read -rp "Press Enter to exit..."' "$SCRIPT_PATH" "$@"
                    ;;
            esac
        fi
    done
    echo "Warning: No terminal emulator found. Continuing in current environment."
fi


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

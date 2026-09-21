#!/usr/bin/env bash
# install_flnote_linux.sh — per-user icon registration for FleshNote .flnote
# artifacts on Linux (freedesktop spec).
#
#   1. hicolor icon set under ~/.local/share/icons/hicolor/<size>/mimetypes/
#      named application-x-fleshnote.png — the exported single-file .flnote
#      (a real ZIP file) gets the document icon in Nautilus/Dolphin/etc.
#   2. MIME registration (application/x-fleshnote, subclass of zip, *.flnote).
#
# Project FOLDERS are handled separately by the backend (folder_icon.py sets
# metadata::custom-icon-uri via gio on creation — directories don't have MIME
# types in freedesktop, so this file only covers the file case).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ICON_SRC="$(cd "$HERE/../icons" && pwd)"

DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
MIME_ICONS="$DATA/icons/hicolor"
MIME_PKG="$DATA/mime/packages"

mkdir -p "$MIME_ICONS" "$MIME_PKG"

for s in 16 24 32 48 64 128 256; do
  dir="$DATA/icons/hicolor/${s}x${s}/mimetypes"
  mkdir -p "$dir"
  cp "$ICON_SRC/fleshnote-project-$s.png" "$dir/application-x-fleshnote.png"
done

cat > "$MIME_PKG/x-fleshnote.xml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-fleshnote">
    <comment>FleshNote Project</comment>
    <comment xml:lang="hu">FleshNote projekt</comment>
    <sub-class-of type="application/zip"/>
    <glob pattern="*.flnote"/>
  </mime-type>
</mime-info>
XML

command -v update-mime-database >/dev/null && update-mime-database "$DATA/mime" || true
if [ -x "$(command -v gtk-update-icon-cache)" ]; then
  gtk-update-icon-cache -f "$DATA/icons/hicolor" >/dev/null 2>&1 || true
fi

echo "FLNOTE MIME + ICONS INSTALLED (per-user)"
echo "  icons:  $DATA/icons/hicolor/*/mimetypes/application-x-fleshnote.png"
echo "  mime:   $MIME_PKG/x-fleshnote.xml"

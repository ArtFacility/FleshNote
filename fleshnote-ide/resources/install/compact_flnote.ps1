# compact_flnote.ps1 — NTFS-compress a project folder (transparent, reversible;
# files stay directly usable). One-off space saver for big projects.
#
# Usage: powershell -ExecutionPolicy Bypass -File compact_flnote.ps1 "C:\path\MyNovel.flnote"
#    or: ... -Undo "C:\path\MyNovel.flnote"
# (No admin needed — compression is per-file metadata owned by the user.)
param(
  [Parameter(Mandatory = $true, Position = 0)] [string]$ProjectPath,
  [switch]$Undo
)
$ErrorActionPreference = 'Stop'
$full = [System.IO.Path]::GetFullPath($ProjectPath)
if (-not (Test-Path $full)) { Write-Error "project not found: $full"; exit 1 }

$mode = if ($Undo) { '/u' } else { '/c' }
# /exe:lzx squeezes harder but makes files unreadable by other OSes — plain
# compression keeps everything portable.
& compact $mode "/s:$full" "/i" "/q"
Write-Output ("{0}: {1}" -f $full, $(if ($Undo) { 'uncompressed' } else { 'compressed (NTFS, transparent)' }))

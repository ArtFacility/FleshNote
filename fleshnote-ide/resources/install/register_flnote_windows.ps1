# register_flnote_windows.ps1 — per-user (no admin) Explorer registration for
# .flnote FleshNote projects: ProgID with the document icon + "Open with
# FleshNote" double-click action.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File register_flnote_windows.ps1            # install
#   powershell -ExecutionPolicy Bypass -File register_flnote_windows.ps1 -Remove    # uninstall
#
# Run once per machine; re-run after moving the IDE folder.

param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$icoPath = Join-Path $PSScriptRoot (Join-Path '..' (Join-Path 'icons' 'fleshnote.ico'))
$icoPath = [System.IO.Path]::GetFullPath($icoPath)

# Where the IDE lives — prefer an installed exe, fall back to the dev launcher.
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$appCandidates = @(
  (Join-Path $root 'dist\win-unpacked\fleshnote-ide.exe'),
  (Join-Path $root 'dist\FleshNote.exe'),
  (Join-Path $root 'out\win-unpacked\FleshNote.exe')
)
$appPath = $appCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $appPath) { $appPath = 'fleshnote-ide' }  # open with explorer fallback

$progId = 'FleshNote.Project'
$classes = 'HKCU:\Software\Classes'

if ($Remove) {
  Remove-Item "$classes\.flnote" -Recurse -ErrorAction SilentlyContinue
  Remove-Item "$classes\$progId" -Recurse -ErrorAction SilentlyContinue
  Write-Output 'FLNOTE REGISTRATION REMOVED'
  exit 0
}

if (-not (Test-Path $icoPath)) {
  Write-Error "icon not found: $icoPath"
  exit 1
}

New-Item -Path "$classes\.flnote" -Force | Out-Null
Set-ItemProperty "$classes\.flnote" -Name '(default)' -Value $progId

New-Item -Path "$classes\$progId" -Force | Out-Null
Set-ItemProperty "$classes\$progId" -Name '(default)' -Value 'FleshNote Project'
Set-ItemProperty "$classes\$progId" -Name 'FriendlyTypeName' -Value 'FleshNote Project'
New-Item -Path "$classes\$progId\DefaultIcon" -Force | Out-Null
Set-ItemProperty "$classes\$progId\DefaultIcon" -Name '(default)' -Value "$icoPath,0"
New-Item -Path "$classes\$progId\shell\open\command" -Force | Out-Null
Set-ItemProperty "$classes\$progId\shell\open\command" -Name '(default)' -Value "`"$appPath`" `"%1`""

Write-Output "FLNOTE PROJECT TYPE REGISTERED (HKCU, per-user)"
Write-Output "  icon:   $icoPath"
Write-Output "  open:   $appPath"

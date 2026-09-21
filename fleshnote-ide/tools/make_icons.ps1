# Generates the FleshNote project icon set from the master artwork:
#   resources\icons\fleshnote.ico        (multi-size ICO, PNG frames)
#   resources\icons\fleshnote-project-<size>.png  (16..256, for Linux hicolor)
Add-Type -AssemblyName System.Drawing

$src = "C:\Gamedev\FleshNote\fileicon.png"
$outDir = Join-Path $PSScriptRoot (Join-Path '..' 'resources' 'icons')
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$sizes = 16, 24, 32, 48, 64, 128, 256
$pngs = @{}

$master = [System.Drawing.Image]::FromFile($src)
try {
  foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    # fit-with-padding: 96% of the square, centered (document shape is 0.82:1)
    $drawW = [int]([Math]::Round($s * 0.96 * ($master.Width / $master.Height)))
    $drawH = [int]([Math]::Round($s * 0.96))
    $x = [int]([Math]::Floor(($s - $drawW) / 2))
    $y = [int]([Math]::Floor(($s - $drawH) / 2))
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $destRect = New-Object System.Drawing.Rectangle($x, $y, $drawW, $drawH)
    $g.DrawImage($master, $destRect, 0, 0, $master.Width, $master.Height,
      [System.Drawing.GraphicsUnit]::Pixel, $attr)
    $g.Dispose()

    $pngPath = Join-Path $outDir ("fleshnote-project-{0}.png" -f $s)
    $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs[$s] = [System.IO.File]::ReadAllBytes($pngPath)
    $bmp.Dispose()
    Write-Output ("png: {0} ({1} bytes)" -f $pngPath, $pngs[$s].Length)
  }
} finally { $master.Dispose() }

# ── assemble the multi-size ICO (PNG frames, Vista+) ─────────────────────────
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0)               # reserved
$bw.Write([UInt16]1)               # type: icon
$bw.Write([UInt16]$sizes.Count)    # frame count

# directory entries first (offsets after the header block)
$offset = 6 + 16 * $sizes.Count
$entries = @()
foreach ($s in $sizes) {
  $data = $pngs[$s]
  $entries += ,@($s, $data.Length, $offset)
  $offset += $data.Length
}
foreach ($e in $entries) {
  $bw.Write([Byte]($e[0] % 256))   # width (0 means 256)
  $bw.Write([Byte]($e[0] % 256))   # height
  $bw.Write([Byte]0)               # palette
  $bw.Write([Byte]0)               # reserved
  $bw.Write([UInt16]1)             # planes
  $bw.Write([UInt16]32)            # bpp
  $bw.Write([UInt32]$e[1])         # bytes in resource
  $bw.Write([UInt32]$e[2])         # image offset
}
foreach ($s in $sizes) { $bw.Write($pngs[$s]) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $outDir "fleshnote.ico"), $ms.ToArray())
$bw.Close()
Write-Output ("ico: {0} bytes" -f (Get-Item (Join-Path $outDir "fleshnote.ico")).Length)
Write-Output "ICON SET DONE"

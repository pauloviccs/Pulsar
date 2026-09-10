Add-Type -AssemblyName System.Drawing

$dir = "src-tauri\icons\taskbar"
if (!(Test-Path $dir)) { 
    New-Item -ItemType Directory -Path $dir -Force | Out-Null 
}

function New-TaskbarIcon($name, [ScriptBlock]$draw) {
    $bmp = New-Object System.Drawing.Bitmap 24, 24
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(240, 240, 240))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(240, 240, 240), 2)
    & $draw $g $brush $pen
    $pen.Dispose()
    $brush.Dispose()
    $g.Dispose()
    $target = Join-Path $dir "$name.png"
    $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# 1. Play
New-TaskbarIcon "play" {
    param($g, $brush, $pen)
    $pts = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(8, 5),
        [System.Drawing.PointF]::new(18, 12),
        [System.Drawing.PointF]::new(8, 19)
    )
    $g.FillPolygon($brush, $pts)
}

# 2. Pause
New-TaskbarIcon "pause" {
    param($g, $brush, $pen)
    $g.FillRectangle($brush, 6, 5, 4, 14)
    $g.FillRectangle($brush, 14, 5, 4, 14)
}

# 3. Prev
New-TaskbarIcon "prev" {
    param($g, $brush, $pen)
    $g.FillRectangle($brush, 5, 5, 2, 14)
    $pts = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(19, 5),
        [System.Drawing.PointF]::new(8, 12),
        [System.Drawing.PointF]::new(19, 19)
    )
    $g.FillPolygon($brush, $pts)
}

# 4. Next
New-TaskbarIcon "next" {
    param($g, $brush, $pen)
    $pts = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(5, 5),
        [System.Drawing.PointF]::new(16, 12),
        [System.Drawing.PointF]::new(5, 19)
    )
    $g.FillPolygon($brush, $pts)
    $g.FillRectangle($brush, 17, 5, 2, 14)
}

# 5. Favorite Off (Checkmark sutil)
New-TaskbarIcon "favorite_off" {
    param($g, $brush, $pen)
    $pts = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(5, 12),
        [System.Drawing.PointF]::new(9, 16),
        [System.Drawing.PointF]::new(19, 7)
    )
    $g.DrawLines($pen, $pts)
}

# 6. Favorite On (Checkmark verde)
New-TaskbarIcon "favorite_on" {
    param($g, $brush, $pen)
    $greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 197, 94))
    $blackPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(15, 15, 15), 2)
    $g.FillEllipse($greenBrush, 2, 2, 20, 20)
    $pts = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(6, 12),
        [System.Drawing.PointF]::new(10, 16),
        [System.Drawing.PointF]::new(18, 8)
    )
    $g.DrawLines($blackPen, $pts)
    $greenBrush.Dispose()
    $blackPen.Dispose()
}

Write-Host "Icons generated successfully in $dir"

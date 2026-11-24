$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $ProjectRoot 'frontend'
$Destination = Join-Path $ProjectRoot 'public'
if (-not (Test-Path (Join-Path $Source 'index.html'))) { throw 'frontend/index.html not found.' }
if (Test-Path $Destination) { Remove-Item $Destination -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
foreach ($item in @('index.html','manifest.json','sw.js','css','js','pages','icons')) {
    $from = Join-Path $Source $item
    $to = Join-Path $Destination $item
    if (Test-Path $from) {
        if ((Get-Item $from).PSIsContainer) { Copy-Item $from $to -Recurse -Force }
        else { Copy-Item $from $to -Force }
    }
}
Write-Host 'Vercel public assets synced from frontend.' -ForegroundColor Green

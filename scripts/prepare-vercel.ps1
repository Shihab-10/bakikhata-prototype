$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Write-Host "`n=== BakiKhata Vercel Preflight ===" -ForegroundColor Cyan

$required = @(
    'index.py',
    'requirements.txt',
    'vercel.json',
    '.python-version',
    'backend\app\main.py',
    'backend\app\database.py',
    'frontend\index.html'
)
foreach ($rel in $required) {
    if (-not (Test-Path (Join-Path $ProjectRoot $rel))) {
        throw "Required deployment file missing: $rel"
    }
}

# Sync public CDN assets from the canonical frontend folder.
& (Join-Path $PSScriptRoot 'sync-vercel-public.ps1')

$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) { throw 'Python was not found.' }

Write-Host "`nPython syntax check..." -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
    python -m compileall -q backend index.py
    if ($LASTEXITCODE -ne 0) { throw 'Python compilation failed.' }

    if (Test-Path (Join-Path $ProjectRoot '.venv\Scripts\python.exe')) {
        Write-Host "Running backend tests..." -ForegroundColor Cyan
        Push-Location (Join-Path $ProjectRoot 'backend')
        try {
            & (Join-Path $ProjectRoot '.venv\Scripts\python.exe') -m pytest -q
            if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
        } finally {
            Pop-Location
        }
    } else {
        Write-Host "Local .venv not found; backend tests skipped. Run .\scripts\setup.ps1 first." -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

Write-Host "`nVercel deployment files are ready." -ForegroundColor Green
Write-Host "Next: npx vercel@latest login"
Write-Host "Then: npx vercel@latest"
Write-Host "Important: the live app requires PostgreSQL and JWT_SECRET environment variables before it can serve requests."

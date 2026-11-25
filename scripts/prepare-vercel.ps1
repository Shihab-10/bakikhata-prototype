$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Write-Host "`n=== BakiKhata Local-Only Vercel Preflight ===" -ForegroundColor Cyan

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

& (Join-Path $PSScriptRoot 'sync-vercel-public.ps1')

$Python = Get-Command python -ErrorAction SilentlyContinue
if ($Python) {
    Write-Host "`nPython syntax check..." -ForegroundColor Cyan
    Push-Location $ProjectRoot
    try {
        python -m compileall -q backend index.py
        if ($LASTEXITCODE -ne 0) { throw 'Python compilation failed.' }

        $VenvPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
        if (Test-Path $VenvPython) {
            Write-Host "Running backend tests..." -ForegroundColor Cyan
            Push-Location (Join-Path $ProjectRoot 'backend')
            try {
                & $VenvPython -m pytest -q
                if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
            } finally {
                Pop-Location
            }
        } else {
            Write-Host "Local .venv not found; backend tests skipped. Frontend local auth does not require Python packages at runtime." -ForegroundColor Yellow
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Python not found; Python checks skipped. Vercel will build the backend in its environment." -ForegroundColor Yellow
}

Write-Host "`nLocal-only deployment files are ready." -ForegroundColor Green
Write-Host "No Neon, Supabase, Firebase, PostgreSQL, or JWT secret is required for Local Account Mode."
Write-Host "Deploy from this project root with: npx vercel@latest --prod"
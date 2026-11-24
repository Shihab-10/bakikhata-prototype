$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $Python)) { throw 'Python environment not found. Run .\scripts\setup.ps1 first.' }

Write-Host 'BakiKhata production demo seeding' -ForegroundColor Cyan
Write-Host 'Paste the Neon pooled PostgreSQL connection string. It will not be saved to a file.' -ForegroundColor Yellow
$DatabaseUrl = Read-Host 'PostgreSQL connection string'
if ($DatabaseUrl -notmatch '^postgres(ql)?://') {
    throw 'Connection string must start with postgres:// or postgresql://'
}
$env:DATABASE_URL = $DatabaseUrl
$env:APP_ENV = 'production'
Push-Location (Join-Path $ProjectRoot 'backend')
try {
    & $Python -m app.seed_demo
    if ($LASTEXITCODE -ne 0) { throw 'Demo seeding failed.' }
} finally {
    Pop-Location
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:APP_ENV -ErrorAction SilentlyContinue
}
Write-Host 'Production demo data seed command completed.' -ForegroundColor Green

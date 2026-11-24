$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $VenvPython)) {
    Write-Host 'Virtual environment not found. Run .\scripts\setup.ps1 first.' -ForegroundColor Yellow
    exit 1
}
$BackendDir = Join-Path $ProjectRoot 'backend'
Set-Location $BackendDir
Write-Host 'Starting Baki Khata API + mobile-first web app...' -ForegroundColor Cyan
Write-Host 'Open: http://127.0.0.1:8000' -ForegroundColor Green
Write-Host 'API docs: http://127.0.0.1:8000/docs' -ForegroundColor Green
& $VenvPython -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

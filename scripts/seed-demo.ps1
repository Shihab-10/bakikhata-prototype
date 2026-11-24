$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $VenvPython)) { throw 'Run .\scripts\setup.ps1 first.' }
Set-Location (Join-Path $ProjectRoot 'backend')
& $VenvPython -m app.seed_demo

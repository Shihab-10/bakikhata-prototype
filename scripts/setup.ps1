$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot 'backend'
$VenvDir = Join-Path $ProjectRoot '.venv'
$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) { throw 'Python was not found. Install Python 3.11+ and retry.' }

Write-Host '=== Baki Khata Full-stack setup ===' -ForegroundColor Cyan
python --version
if (-not (Test-Path (Join-Path $VenvDir 'Scripts\python.exe'))) {
    Write-Host 'Creating Python virtual environment...'
    python -m venv $VenvDir
}
$VenvPython = Join-Path $VenvDir 'Scripts\python.exe'
Write-Host 'Installing backend dependencies...'
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install -r (Join-Path $BackendDir 'requirements.txt')

$EnvFile = Join-Path $BackendDir '.env'
if (-not (Test-Path $EnvFile)) {
    Copy-Item (Join-Path $BackendDir '.env.example') $EnvFile
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 48
    $rng.GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    $rng.Dispose()
    $content = Get-Content $EnvFile -Raw
    $content = $content -replace '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$secret"
    Set-Content -Path $EnvFile -Value $content -Encoding ASCII
    Write-Host 'Created backend/.env with a generated local JWT secret.' -ForegroundColor Green
}
$ExistingGoogleSetting = Select-String -Path $EnvFile -Pattern '^GOOGLE_CLIENT_ID=' -Quiet
if (-not $ExistingGoogleSetting) {
    Add-Content -Path $EnvFile -Value "`r`n# Google Identity Services Web Client ID`r`nGOOGLE_CLIENT_ID=" -Encoding ASCII
}

$FirebaseEnvKeys = @(
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_APP_ID'
)
foreach ($Key in $FirebaseEnvKeys) {
    if (-not (Select-String -Path $EnvFile -Pattern ("^" + [regex]::Escape($Key) + "=") -Quiet)) {
        Add-Content -Path $EnvFile -Value "`r`n$Key=" -Encoding ASCII
    }
}

New-Item -ItemType Directory -Force -Path (Join-Path $BackendDir 'data') | Out-Null
Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host 'Next: .\scripts\seed-demo.ps1 (optional), then .\scripts\start.ps1'

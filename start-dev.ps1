$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$WebRoot = Join-Path $ProjectRoot "web"

Write-Host "Starting Go System Monitor..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot'; go run ."

if (-not (Test-Path (Join-Path $WebRoot "node_modules"))) {
    Write-Host "Installing frontend dependencies for the first run..." -ForegroundColor Yellow
    Set-Location $WebRoot
    npm install
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$WebRoot'; npm run dev"

Write-Host "Backend:  http://localhost:8080" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green

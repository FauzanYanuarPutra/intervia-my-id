# ==============================================================================
# RESET & RUN - Stop all, optional clean, rebuild and start
# ==============================================================================
# Usage:
#   .\reset-and-run.ps1              # down, then up --build (recommended)
#   .\reset-and-run.ps1 -Clean       # + prune volumes (full reset)
#   .\reset-and-run.ps1 -NoBuild    # up only, no rebuild
# ==============================================================================

param(
    [switch]$Clean,    # prune volumes and optional images
    [switch]$NoBuild   # skip rebuild, just up
)

$ErrorActionPreference = "Stop"
$envFile = ".env.development"
if (-not (Test-Path $envFile)) {
    $envFile = ".env"
}
if (-not (Test-Path $envFile)) {
    Write-Host "Missing $envFile. Copy from .env.example and fill." -ForegroundColor Red
    exit 1
}

Write-Host "`n=== RESET & RUN ===" -ForegroundColor Cyan
Write-Host "Env file: $envFile`n" -ForegroundColor Gray

# 1. Stop and remove containers
Write-Host "Stopping and removing containers..." -ForegroundColor Yellow
docker compose --env-file $envFile down --remove-orphans
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Clean) {
    Write-Host "Cleaning volumes (full reset)..." -ForegroundColor Yellow
    docker compose --env-file $envFile down -v --remove-orphans
    docker volume prune -f | Out-Null
}

# 2. Build and start
if ($NoBuild) {
    Write-Host "Starting services (no rebuild)..." -ForegroundColor Yellow
    docker compose --env-file $envFile up -d
} else {
    Write-Host "Building and starting all services..." -ForegroundColor Yellow
    docker compose --env-file $envFile up -d --build
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild/start failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n=== Waiting for services to be ready (30s) ===" -ForegroundColor Cyan
Start-Sleep -Seconds 30

# 3. Quick health check
Write-Host "`nQuick health check:" -ForegroundColor Cyan
$checks = @(
    @{ Name = "Identity"; Url = "http://localhost:8080/health"; Container = "laju_identity_service" }
    @{ Name = "Marketplace"; Url = "http://localhost:8082/health"; Container = "laju_marketplace_service" }
    @{ Name = "Frontend (www)"; Url = "http://localhost:3000"; Container = "lajukan-www" }
)
foreach ($c in $checks) {
    try {
        $r = Invoke-WebRequest -Uri $c.Url -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200 -or $r.StatusCode -eq 304) {
            Write-Host "  OK $($c.Name)" -ForegroundColor Green
        } else {
            Write-Host "  ?? $($c.Name) (HTTP $($r.StatusCode))" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  -- $($c.Name) (not ready or not exposed)" -ForegroundColor Gray
    }
}

Write-Host "`nDone. Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "Logs: docker compose -f docker-compose.yml --env-file $envFile logs -f" -ForegroundColor Gray
Write-Host ""

# ======================================================
# 🚀 Optimized Docker Build Script for Windows
# ======================================================
# Usage: .\build-optimized.ps1 [service_name]
# Example: .\build-optimized.ps1 www

param(
    [string]$Service = "",
    [switch]$Clean = $false,
    [switch]$Parallel = $false,
    [switch]$Help = $false
)

# Colors
$RED = "Red"
$GREEN = "Green"
$YELLOW = "Yellow"
$CYAN = "Cyan"

function Show-Help {
    Write-Host ""
    Write-Host "🚀 Docker Build Optimization Script" -ForegroundColor $CYAN
    Write-Host "====================================" -ForegroundColor $CYAN
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor $GREEN
    Write-Host "  .\build-optimized.ps1 [options] [service]"
    Write-Host ""
    Write-Host "Options:" -ForegroundColor $GREEN
    Write-Host "  -Service <name>   Build specific service (e.g., www, cms, crm)"
    Write-Host "  -Clean            Clean all caches before build"
    Write-Host "  -Parallel         Build all services in parallel"
    Write-Host "  -Help             Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor $YELLOW
    Write-Host "  .\build-optimized.ps1 -Service www"
    Write-Host "  .\build-optimized.ps1 -Clean"
    Write-Host "  .\build-optimized.ps1 -Parallel"
    Write-Host ""
    exit 0
}

if ($Help) {
    Show-Help
}

Write-Host ""
Write-Host "🚀 Starting Optimized Docker Build..." -ForegroundColor $CYAN
Write-Host "====================================" -ForegroundColor $CYAN
Write-Host ""

# ======================================================
# 1. Enable Docker BuildKit
# ======================================================
Write-Host "✅ Enabling Docker BuildKit..." -ForegroundColor $GREEN
$env:DOCKER_BUILDKIT = "1"
$env:COMPOSE_DOCKER_CLI_BUILD = "1"
$env:BUILDKIT_PROGRESS = "plain"

# ======================================================
# 2. Clean Cache (Optional)
# ======================================================
if ($Clean) {
    Write-Host ""
    Write-Host "🧹 Cleaning Docker cache..." -ForegroundColor $YELLOW
    docker builder prune -af
    docker compose down -v
    Write-Host "✅ Cache cleaned!" -ForegroundColor $GREEN
}

# ======================================================
# 3. Check .env.development
# ======================================================
if (-not (Test-Path ".env.development")) {
    Write-Host ""
    Write-Host "❌ Error: .env.development not found!" -ForegroundColor $RED
    Write-Host "Please create .env.development file first." -ForegroundColor $RED
    Write-Host ""
    exit 1
}

# ======================================================
# 4. Build
# ======================================================
Write-Host ""
Write-Host "🔨 Building Docker images..." -ForegroundColor $CYAN
$StartTime = Get-Date

try {
    if ($Parallel) {
        Write-Host "Building all services in parallel..." -ForegroundColor $YELLOW
        docker compose --env-file .env.development build --parallel
    } elseif ($Service) {
        Write-Host "Building service: $Service" -ForegroundColor $YELLOW
        docker compose --env-file .env.development build $Service
    } else {
        Write-Host "Building all services..." -ForegroundColor $YELLOW
        docker compose --env-file .env.development build
    }
    
    $EndTime = Get-Date
    $Duration = $EndTime - $StartTime
    
    Write-Host ""
    Write-Host "✅ Build completed!" -ForegroundColor $GREEN
    Write-Host "⏱️  Duration: $($Duration.Minutes)m $($Duration.Seconds)s" -ForegroundColor $GREEN
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor $RED
    Write-Host $_.Exception.Message -ForegroundColor $RED
    Write-Host ""
    exit 1
}

# ======================================================
# 5. Start Containers
# ======================================================
Write-Host "🚀 Starting containers..." -ForegroundColor $CYAN

if ($Service) {
    docker compose --env-file .env.development up -d $Service
} else {
    docker compose --env-file .env.development up -d
}

# ======================================================
# 6. Show Status
# ======================================================
Write-Host ""
Write-Host "📊 Container Status:" -ForegroundColor $CYAN
Write-Host "===================" -ForegroundColor $CYAN
docker compose --env-file .env.development ps

Write-Host ""
Write-Host "✅ Done! Your services are running." -ForegroundColor $GREEN
Write-Host ""
Write-Host "📝 Tips:" -ForegroundColor $YELLOW
Write-Host "  - View logs: docker compose logs -f $Service"
Write-Host "  - Stop all: docker compose down"
Write-Host "  - Restart: docker compose restart $Service"
Write-Host ""

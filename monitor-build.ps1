# ======================================================
# 📊 Docker Build Monitor Script
# ======================================================
# Usage: .\monitor-build.ps1
# Purpose: Monitor Docker build progress in real-time

param(
    [int]$RefreshSeconds = 5
)

$CYAN = "Cyan"
$GREEN = "Green"
$YELLOW = "Yellow"
$RED = "Red"

function Show-Header {
    Clear-Host
    Write-Host ""
    Write-Host "📊 Docker Build Monitor" -ForegroundColor $CYAN
    Write-Host "======================" -ForegroundColor $CYAN
    Write-Host ""
    Write-Host "Refresh interval: $RefreshSeconds seconds" -ForegroundColor $YELLOW
    Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor $YELLOW
    Write-Host ""
}

function Get-BuildStatus {
    Write-Host "🔍 Checking build status..." -ForegroundColor $GREEN
    Write-Host ""
    
    # Check Docker processes
    Write-Host "Docker Processes:" -ForegroundColor $CYAN
    Write-Host "----------------" -ForegroundColor $CYAN
    
    try {
        $processes = docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | Select-String -Pattern "www|Building"
        
        if ($processes) {
            $processes | ForEach-Object { Write-Host $_ -ForegroundColor $GREEN }
        } else {
            Write-Host "No www containers found" -ForegroundColor $YELLOW
        }
    } catch {
        Write-Host "Error checking containers: $_" -ForegroundColor $RED
    }
    
    Write-Host ""
    
    # Check Docker stats
    Write-Host "Docker Resource Usage:" -ForegroundColor $CYAN
    Write-Host "---------------------" -ForegroundColor $CYAN
    
    try {
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | Select-Object -First 5
    } catch {
        Write-Host "No active containers" -ForegroundColor $YELLOW
    }
    
    Write-Host ""
    
    # Check build cache
    Write-Host "BuildKit Cache Info:" -ForegroundColor $CYAN
    Write-Host "-------------------" -ForegroundColor $CYAN
    
    try {
        docker buildx du | Select-Object -First 10
    } catch {
        Write-Host "BuildKit cache info not available" -ForegroundColor $YELLOW
    }
    
    Write-Host ""
    Write-Host "💡 Tips:" -ForegroundColor $YELLOW
    Write-Host "  - If CPU is active → Build is progressing" -ForegroundColor $GREEN
    Write-Host "  - If NetIO is increasing → Downloading packages" -ForegroundColor $GREEN
    Write-Host "  - First build takes 40-60 min (downloading 480MB packages)" -ForegroundColor $YELLOW
    Write-Host "  - Read WHY_BUILD_SLOW.md for details" -ForegroundColor $YELLOW
    Write-Host ""
}

# Main loop
while ($true) {
    Show-Header
    Get-BuildStatus
    
    Write-Host "Next refresh in $RefreshSeconds seconds..." -ForegroundColor $CYAN
    Write-Host ""
    
    Start-Sleep -Seconds $RefreshSeconds
}

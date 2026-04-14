# ======================================================
# 🌐 NPM Registry Speed Test
# ======================================================
# Purpose: Check download speed from npm registry

$GREEN = "Green"
$YELLOW = "Yellow"
$RED = "Red"
$CYAN = "Cyan"

Write-Host ""
Write-Host "🌐 NPM Registry Speed Test" -ForegroundColor $CYAN
Write-Host "============================" -ForegroundColor $CYAN
Write-Host ""

# Test 1: Ping npm registry
Write-Host "1. Testing connection to registry.npmjs.org..." -ForegroundColor $YELLOW
try {
    $ping = Test-NetConnection -ComputerName registry.npmjs.org -Port 443 -WarningAction SilentlyContinue
    
    if ($ping.TcpTestSucceeded) {
        Write-Host "   ✅ Connected successfully!" -ForegroundColor $GREEN
        Write-Host "   Latency: $($ping.PingReplyDetails.RoundtripTime) ms" -ForegroundColor $GREEN
        
        if ($ping.PingReplyDetails.RoundtripTime -lt 100) {
            Write-Host "   🚀 Latency is GOOD (< 100ms)" -ForegroundColor $GREEN
        } elseif ($ping.PingReplyDetails.RoundtripTime -lt 300) {
            Write-Host "   ⚠️  Latency is MODERATE (100-300ms)" -ForegroundColor $YELLOW
        } else {
            Write-Host "   ❌ Latency is SLOW (> 300ms)" -ForegroundColor $RED
            Write-Host "   This will make npm downloads very slow!" -ForegroundColor $RED
        }
    } else {
        Write-Host "   ❌ Connection failed!" -ForegroundColor $RED
    }
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor $RED
}

Write-Host ""

# Test 2: Download speed test (small package)
Write-Host "2. Testing download speed (downloading lodash ~500KB)..." -ForegroundColor $YELLOW
try {
    $tempFile = [System.IO.Path]::GetTempFileName()
    $url = "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz"
    
    $startTime = Get-Date
    Invoke-WebRequest -Uri $url -OutFile $tempFile -UseBasicParsing | Out-Null
    $endTime = Get-Date
    
    $duration = ($endTime - $startTime).TotalSeconds
    $fileSize = (Get-Item $tempFile).Length / 1KB
    $speed = $fileSize / $duration
    
    Write-Host "   Downloaded: $([math]::Round($fileSize, 2)) KB in $([math]::Round($duration, 2)) seconds" -ForegroundColor $GREEN
    Write-Host "   Speed: $([math]::Round($speed, 2)) KB/s ($([math]::Round($speed / 1024, 2)) MB/s)" -ForegroundColor $GREEN
    
    # Estimate time to download all packages (480MB)
    $totalSizeMB = 480
    $estimatedTimeMin = ($totalSizeMB * 1024) / $speed / 60
    
    Write-Host ""
    Write-Host "   📊 Estimated time to download ALL packages (480MB):" -ForegroundColor $CYAN
    Write-Host "   ~$([math]::Round($estimatedTimeMin, 1)) minutes" -ForegroundColor $YELLOW
    
    if ($estimatedTimeMin -lt 10) {
        Write-Host "   🚀 Your internet is FAST!" -ForegroundColor $GREEN
    } elseif ($estimatedTimeMin -lt 30) {
        Write-Host "   ⚠️  Your internet is MODERATE" -ForegroundColor $YELLOW
    } else {
        Write-Host "   ❌ Your internet is SLOW - Consider:" -ForegroundColor $RED
        Write-Host "      - Using a faster network" -ForegroundColor $RED
        Write-Host "      - Installing node_modules locally first" -ForegroundColor $RED
        Write-Host "      - Using npm registry mirror" -ForegroundColor $RED
    }
    
    Remove-Item $tempFile -Force
    
} catch {
    Write-Host "   ❌ Error: $_" -ForegroundColor $RED
}

Write-Host ""

# Test 3: Alternative registries
Write-Host "3. Alternative NPM Registries:" -ForegroundColor $YELLOW
Write-Host ""

$registries = @(
    @{ Name = "Official (US)"; URL = "registry.npmjs.org" },
    @{ Name = "Cloudflare"; URL = "registry.npmjs.cf" },
    @{ Name = "npmmirror (China)"; URL = "registry.npmmirror.com" }
)

foreach ($registry in $registries) {
    try {
        $ping = Test-NetConnection -ComputerName $registry.URL -Port 443 -WarningAction SilentlyContinue -InformationLevel Quiet
        if ($ping.TcpTestSucceeded) {
            Write-Host "   ✅ $($registry.Name): $($registry.URL) - Reachable" -ForegroundColor $GREEN
        } else {
            Write-Host "   ❌ $($registry.Name): $($registry.URL) - Not reachable" -ForegroundColor $RED
        }
    } catch {
        Write-Host "   ❌ $($registry.Name): $($registry.URL) - Error" -ForegroundColor $RED
    }
}

Write-Host ""
Write-Host "💡 Tips to Speed Up npm Install:" -ForegroundColor $CYAN
Write-Host "===================================" -ForegroundColor $CYAN
Write-Host "1. Use faster network (if possible)" -ForegroundColor $GREEN
Write-Host "2. Install node_modules locally first, then build Docker" -ForegroundColor $GREEN
Write-Host "3. Use npm registry mirror (add to Dockerfile):" -ForegroundColor $GREEN
Write-Host "   RUN npm config set registry https://registry.npmmirror.com" -ForegroundColor $YELLOW
Write-Host "4. Use pnpm instead of npm (faster)" -ForegroundColor $GREEN
Write-Host ""
Write-Host "📚 Read WHY_BUILD_SLOW.md for detailed explanation" -ForegroundColor $CYAN
Write-Host ""

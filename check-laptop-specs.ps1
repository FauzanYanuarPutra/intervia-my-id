# Script untuk cek spesifikasi laptop detail
# Fokus: RAM, CPU, Storage untuk kebutuhan Docker development

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LAPTOP SPECIFICATION CHECKER" -ForegroundColor Cyan
Write-Host "  Untuk Project Development" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. System Info
Write-Host "=== SYSTEM INFORMATION ===" -ForegroundColor Yellow
$computerSystem = Get-WmiObject Win32_ComputerSystem
Write-Host "Manufacturer: $($computerSystem.Manufacturer)" -ForegroundColor Green
Write-Host "Model: $($computerSystem.Model)" -ForegroundColor Green
Write-Host "System Type: $($computerSystem.SystemType)" -ForegroundColor Green
Write-Host ""

# 2. CPU Info
Write-Host "=== PROCESSOR ===" -ForegroundColor Yellow
$processor = Get-WmiObject Win32_Processor
Write-Host "Processor: $($processor.Name)" -ForegroundColor Green
Write-Host "Cores: $($processor.NumberOfCores)" -ForegroundColor Green
Write-Host "Logical Processors: $($processor.NumberOfLogicalProcessors)" -ForegroundColor Green
Write-Host "Base Speed: $($processor.MaxClockSpeed) MHz" -ForegroundColor Green
Write-Host ""

# 3. RAM Info (Detail)
Write-Host "=== MEMORY (RAM) ===" -ForegroundColor Yellow
$totalRAM = [math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
Write-Host "Total RAM: $totalRAM GB" -ForegroundColor Green

$ramModules = Get-WmiObject Win32_PhysicalMemory
Write-Host ""
Write-Host "RAM Modules:" -ForegroundColor Cyan
$slotNumber = 1
foreach ($module in $ramModules) {
    $sizeGB = [math]::Round($module.Capacity / 1GB, 2)
    $speed = $module.Speed
    $formFactor = switch ($module.FormFactor) {
        8 { "DIMM" }
        12 { "SODIMM" }
        default { "Unknown ($($module.FormFactor))" }
    }
    $memoryType = switch ($module.SMBIOSMemoryType) {
        24 { "DDR3" }
        26 { "DDR4" }
        34 { "DDR5" }
        default { "Unknown ($($module.SMBIOSMemoryType))" }
    }
    
    Write-Host "  Slot ${slotNumber}:" -ForegroundColor White
    Write-Host "    Size: $sizeGB GB" -ForegroundColor Gray
    Write-Host "    Speed: $speed MHz" -ForegroundColor Gray
    Write-Host "    Type: $memoryType" -ForegroundColor Gray
    Write-Host "    Form Factor: $formFactor" -ForegroundColor Gray
    Write-Host "    Manufacturer: $($module.Manufacturer)" -ForegroundColor Gray
    $slotNumber++
}

# Cek slot kosong
$totalSlots = (Get-WmiObject Win32_PhysicalMemoryArray).MemoryDevices
$usedSlots = $ramModules.Count
$freeSlots = $totalSlots - $usedSlots
Write-Host ""
Write-Host "Memory Slots:" -ForegroundColor Cyan
Write-Host "  Total Slots: $totalSlots" -ForegroundColor White
Write-Host "  Used Slots: $usedSlots" -ForegroundColor White
Write-Host "  Free Slots: $freeSlots" -ForegroundColor $(if ($freeSlots -gt 0) { "Green" } else { "Red" })
Write-Host ""

# 4. Storage Info
Write-Host "=== STORAGE ===" -ForegroundColor Yellow
$disks = Get-WmiObject Win32_DiskDrive
foreach ($disk in $disks) {
    $sizeGB = [math]::Round($disk.Size / 1GB, 2)
    $model = $disk.Model
    $interface = $disk.InterfaceType
    $mediaType = $disk.MediaType
    
    Write-Host "Drive: $model" -ForegroundColor Green
    Write-Host "  Size: $sizeGB GB" -ForegroundColor Gray
    Write-Host "  Interface: $interface" -ForegroundColor Gray
    Write-Host "  Media Type: $mediaType" -ForegroundColor Gray
    
    # Cek apakah SSD atau HDD
    if ($mediaType -like "*SSD*" -or $model -like "*SSD*" -or $interface -like "*NVMe*") {
        Write-Host "  Type: SSD" -ForegroundColor Green
    } elseif ($mediaType -like "*HDD*" -or $model -like "*HDD*") {
        Write-Host "  Type: HDD" -ForegroundColor Yellow
    } else {
        Write-Host "  Type: Unknown" -ForegroundColor Gray
    }
    Write-Host ""
}

# Cek partisi dan space
Write-Host "Disk Partitions:" -ForegroundColor Cyan
$partitions = Get-WmiObject Win32_LogicalDisk
foreach ($partition in $partitions) {
    if ($partition.DriveType -eq 3) { # Fixed disk
        $sizeGB = [math]::Round($partition.Size / 1GB, 2)
        $freeGB = [math]::Round($partition.FreeSpace / 1GB, 2)
        $usedGB = $sizeGB - $freeGB
        $percentFree = [math]::Round(($freeGB / $sizeGB) * 100, 1)
        
        Write-Host "  $($partition.DeviceID):" -ForegroundColor White
        Write-Host "    Total: $sizeGB GB" -ForegroundColor Gray
        Write-Host "    Used: $usedGB GB" -ForegroundColor Gray
        Write-Host "    Free: $freeGB GB ($percentFree%)" -ForegroundColor $(if ($percentFree -lt 20) { "Red" } elseif ($percentFree -lt 40) { "Yellow" } else { "Green" })
    }
}
Write-Host ""

# 5. Docker Check
Write-Host "=== DOCKER STATUS ===" -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker: Installed" -ForegroundColor Green
        Write-Host "  Version: $dockerVersion" -ForegroundColor Gray
        
        # Cek Docker Desktop resources jika ada
        try {
            $dockerInfo = docker info 2>&1 | Select-String "Total Memory"
            if ($dockerInfo) {
                Write-Host "  $dockerInfo" -ForegroundColor Gray
            }
        } catch {
            Write-Host "  (Docker info not available)" -ForegroundColor Gray
        }
    } else {
        Write-Host "Docker: Not installed or not running" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Docker: Not installed" -ForegroundColor Red
}
Write-Host ""

# 6. Recommendations
Write-Host "=== RECOMMENDATIONS ===" -ForegroundColor Yellow
Write-Host ""

# RAM recommendations
if ($totalRAM -lt 8) {
    Write-Host "⚠️  RAM: CRITICAL - Kurang dari 8GB" -ForegroundColor Red
    Write-Host "   Rekomendasi: Upgrade ke minimal 16GB" -ForegroundColor Yellow
    Write-Host "   Budget: ~800rb-1,5jt" -ForegroundColor Gray
} elseif ($totalRAM -lt 16) {
    Write-Host "⚠️  RAM: WARNING - Kurang dari 16GB untuk Docker development" -ForegroundColor Yellow
    Write-Host "   Rekomendasi: Upgrade ke 16GB untuk performa optimal" -ForegroundColor Yellow
    Write-Host "   Budget: ~800rb-1jt" -ForegroundColor Gray
} else {
    Write-Host "✅ RAM: OK - $totalRAM GB cukup untuk development" -ForegroundColor Green
}

Write-Host ""

# Storage recommendations
$hasSSD = $false
$hasHDD = $false
foreach ($disk in $disks) {
    if ($disk.MediaType -like "*SSD*" -or $disk.Model -like "*SSD*" -or $disk.InterfaceType -like "*NVMe*") {
        $hasSSD = $true
    }
    if ($disk.MediaType -like "*HDD*" -or ($disk.MediaType -notlike "*SSD*" -and $disk.InterfaceType -eq "IDE" -or $disk.InterfaceType -eq "SATA")) {
        $hasHDD = $true
    }
}

if (-not $hasSSD -and $hasHDD) {
    Write-Host "⚠️  STORAGE: CRITICAL - Masih pakai HDD" -ForegroundColor Red
    Write-Host "   Rekomendasi: Upgrade ke SSD NVMe 512GB-1TB" -ForegroundColor Yellow
    Write-Host "   Budget: ~600rb-1,5jt" -ForegroundColor Gray
    Write-Host "   Impact: Docker build akan 10x lebih cepat!" -ForegroundColor Cyan
} elseif ($hasSSD) {
    $ssdSize = ($disks | Where-Object { $_.MediaType -like "*SSD*" -or $_.Model -like "*SSD*" -or $_.InterfaceType -like "*NVMe*" } | Measure-Object -Property Size -Sum).Sum / 1GB
    if ($ssdSize -lt 256) {
        Write-Host "⚠️  STORAGE: WARNING - SSD kurang dari 256GB" -ForegroundColor Yellow
        Write-Host "   Rekomendasi: Tambah SSD eksternal atau upgrade ke 512GB+" -ForegroundColor Yellow
    } else {
        Write-Host "✅ STORAGE: OK - SSD terdeteksi" -ForegroundColor Green
    }
}

Write-Host ""

# CPU recommendations
$cores = $processor.NumberOfCores
if ($cores -lt 4) {
    Write-Host "⚠️  CPU: WARNING - Kurang dari 4 cores" -ForegroundColor Yellow
    Write-Host "   Docker akan lambat, tapi masih bisa jalan" -ForegroundColor Gray
} else {
    Write-Host "✅ CPU: OK - $cores cores cukup untuk development" -ForegroundColor Green
}

Write-Host ""

# Summary
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "Laptop: $($computerSystem.Manufacturer) $($computerSystem.Model)" -ForegroundColor White
Write-Host "CPU: $($processor.Name) ($cores cores)" -ForegroundColor White
Write-Host "RAM: $totalRAM GB" -ForegroundColor White
Write-Host "Storage: " -NoNewline -ForegroundColor White
if ($hasSSD) {
    Write-Host "SSD detected" -ForegroundColor Green
} elseif ($hasHDD) {
    Write-Host "HDD detected" -ForegroundColor Yellow
} else {
    Write-Host "Unknown" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Selesai! Cek rekomendasi di atas." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

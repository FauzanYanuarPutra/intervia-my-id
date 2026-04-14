# Script untuk cek eGPU support di laptop
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  eGPU SUPPORT CHECKER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cek USB-C / Thunderbolt ports
Write-Host "=== USB-C / THUNDERBOLT PORTS ===" -ForegroundColor Yellow

try {
    # Cek USB-C ports
    $usbPorts = Get-WmiObject Win32_USBController | Where-Object { $_.Description -like "*USB*" }
    $usbC = Get-PnpDevice | Where-Object { $_.FriendlyName -like "*USB-C*" -or $_.FriendlyName -like "*Thunderbolt*" }
    
    if ($usbC) {
        Write-Host "USB-C / Thunderbolt devices found:" -ForegroundColor Green
        foreach ($device in $usbC) {
            Write-Host "  - $($device.FriendlyName)" -ForegroundColor White
            Write-Host "    Status: $($device.Status)" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  No USB-C / Thunderbolt devices detected" -ForegroundColor Yellow
        Write-Host "   (Mungkin tidak terdeteksi atau tidak ada)" -ForegroundColor Gray
    }
    
    # Cek PCIe slots (untuk eGPU internal - tidak relevan untuk laptop)
    Write-Host ""
    Write-Host "Note: Laptop biasanya tidak punya PCIe slot untuk GPU internal" -ForegroundColor Gray
    Write-Host "      eGPU harus via Thunderbolt 3/4 atau USB-C dengan DisplayPort" -ForegroundColor Gray
    
} catch {
    Write-Host "Error checking ports: $_" -ForegroundColor Red
}

Write-Host ""

# 2. Cek GPU saat ini
Write-Host "=== CURRENT GPU ===" -ForegroundColor Yellow
$gpus = Get-WmiObject Win32_VideoController
foreach ($gpu in $gpus) {
    if ($gpu.Name -notlike "*Remote*" -and $gpu.Name -notlike "*Basic*") {
        Write-Host "GPU: $($gpu.Name)" -ForegroundColor Green
        Write-Host "  VRAM: $([math]::Round($gpu.AdapterRAM / 1GB, 2)) GB" -ForegroundColor Gray
        Write-Host "  Driver Version: $($gpu.DriverVersion)" -ForegroundColor Gray
    }
}

Write-Host ""

# 3. Rekomendasi berdasarkan model laptop
Write-Host "=== eGPU COMPATIBILITY ===" -ForegroundColor Yellow
Write-Host "Laptop Model: Acer Aspire A515-45" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT CHECK:" -ForegroundColor Yellow
Write-Host "1. Cek fisik laptop Anda:" -ForegroundColor Cyan
Write-Host "   - Apakah ada port USB-C dengan logo Thunderbolt (⚡)?" -ForegroundColor White
Write-Host "   - Atau USB-C biasa (tanpa logo Thunderbolt)?" -ForegroundColor White
Write-Host ""
Write-Host "2. eGPU Requirements:" -ForegroundColor Cyan
Write-Host "   ✅ Thunderbolt 3/4: FULL eGPU support" -ForegroundColor Green
Write-Host "   ⚠️  USB-C dengan DisplayPort: Limited support (tidak semua eGPU)" -ForegroundColor Yellow
Write-Host "   ❌ USB-C biasa: TIDAK support eGPU" -ForegroundColor Red
Write-Host ""

# 4. Project GPU requirements
Write-Host "=== PROJECT GPU REQUIREMENTS ===" -ForegroundColor Yellow
Write-Host "AI Services di project Anda:" -ForegroundColor Cyan
Write-Host "  - OCR Service: USE_GPU=0 (CPU mode, tidak butuh GPU)" -ForegroundColor Green
Write-Host "  - Liveness Service: CPU mode (MediaPipe bisa pakai GPU tapi optional)" -ForegroundColor Green
Write-Host "  - vLLM Engine: BUTUH GPU untuk inference cepat (optional untuk development)" -ForegroundColor Yellow
Write-Host "  - CompreFace: Bisa pakai GPU tapi tidak wajib" -ForegroundColor Green
Write-Host ""
Write-Host "Kesimpulan:" -ForegroundColor Cyan
Write-Host "  ✅ Development: TIDAK butuh GPU (semua jalan di CPU)" -ForegroundColor Green
Write-Host "  ⚠️  Production/Testing AI: Bisa benefit dari GPU untuk vLLM" -ForegroundColor Yellow
Write-Host ""

# 5. Cost-Benefit Analysis
Write-Host "=== COST-BENEFIT ANALYSIS ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "eGPU Setup Cost:" -ForegroundColor Cyan
Write-Host "  - eGPU Enclosure: ~2-5 juta (Razer Core, Sonnet, dll)" -ForegroundColor White
Write-Host "  - GPU (RTX 3060/4060): ~4-8 juta" -ForegroundColor White
Write-Host "  - Total: ~6-13 juta" -ForegroundColor Yellow
Write-Host ""
Write-Host "Alternatif Lebih Murah:" -ForegroundColor Cyan
Write-Host "  ✅ Pakai CPU untuk development (gratis)" -ForegroundColor Green
Write-Host "  ✅ Pakai cloud GPU untuk testing (AWS/GCP: ~$0.5-1/jam)" -ForegroundColor Green
Write-Host "  ✅ Pakai Google Colab gratis untuk testing AI" -ForegroundColor Green
Write-Host "  ✅ Upgrade RAM ke 16GB lebih penting (hanya ~400rb-600rb)" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RECOMMENDATION:" -ForegroundColor Yellow
Write-Host "  ❌ eGPU TIDAK WORTH IT untuk development" -ForegroundColor Red
Write-Host "  ✅ Fokus upgrade RAM dulu (lebih penting)" -ForegroundColor Green
Write-Host "  ✅ Pakai cloud GPU jika butuh test AI inference" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

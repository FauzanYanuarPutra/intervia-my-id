# JALAN CEPAT - Tanpa build Docker yang lama
# Jalankan: .\JALAN_CEPAT.ps1
# Atau copy-paste per blok ke PowerShell

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "`n=== 1. Infra (postgres, redis, rabbitmq, mailhog, minio) - no build ===" -ForegroundColor Cyan
docker compose --env-file .env.development up -d postgres_db redis_cache rabbitmq mailhog minio
if ($LASTEXITCODE -ne 0) { exit 1 }
Start-Sleep -Seconds 5

Write-Host "`n=== 2. Backend: identity_service + marketplace_service ===" -ForegroundColor Cyan
Write-Host "    (Kalau belum pernah build: sekali ini bisa 10-15 menit. Besok cukup 'up -d' saja.)" -ForegroundColor Yellow
docker compose --env-file .env.development up -d identity_service marketplace_service
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n=== 3. Cek container ===" -ForegroundColor Cyan
docker compose --env-file .env.development ps

Write-Host "`n=== SELESAI ===" -ForegroundColor Green
Write-Host "Backend jalan. Sekarang buka terminal BARU dan jalankan:" -ForegroundColor White
Write-Host "  cd frontend\www" -ForegroundColor Yellow
Write-Host "  npm install   (sekali saja)" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor Yellow
Write-Host "Lalu buka: http://localhost:3000 (atau 3001 kalau 3000 sibuk)" -ForegroundColor Cyan
Write-Host ""

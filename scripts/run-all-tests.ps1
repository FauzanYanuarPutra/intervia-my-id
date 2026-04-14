# Run unit tests for all custom services (from docker-compose).
# Usage: .\scripts\run-all-tests.ps1
# Requires: Rust (cargo), Node (npx). Elixir (mix) optional for chat_service.

$ErrorActionPreference = "Continue"
# Repo root: script is in scripts/, so parent of PSScriptRoot
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "backend\rust_apps"))) { $root = (Get-Location).Path }
$failed = @()
$passed = @()

# --- Rust services (identity, marketplace, ai) ---
Push-Location (Join-Path $root "backend\rust_apps")
try {
    Write-Host "`n[Rust] Running cargo test --workspace..." -ForegroundColor Cyan
    cargo test --workspace 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        $failed += "rust_apps"
        Write-Host $out
    } else {
        $passed += "rust_apps (identity_service, marketplace_service, ai_service)"
        Write-Host "Rust tests OK." -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# --- Chat service (Elixir) ---
$chatPath = Join-Path $root "backend\chat_service"
if (Get-Command mix -ErrorAction SilentlyContinue) {
    Push-Location $chatPath
    try {
        Write-Host "`n[Elixir] Running mix test..." -ForegroundColor Cyan
        mix test 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) {
            $failed += "chat_service"
        } else {
            $passed += "chat_service"
            Write-Host "Chat service tests OK." -ForegroundColor Green
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "`n[Elixir] mix not found; skipping chat_service tests." -ForegroundColor Yellow
}

# --- Frontend www (Vitest) ---
$wwwPath = Join-Path $root "frontend\www"
Push-Location $wwwPath
try {
    Write-Host "`n[Frontend] Running vitest..." -ForegroundColor Cyan
    npx vitest run 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        $failed += "frontend/www"
    } else {
        $passed += "frontend/www"
        Write-Host "Frontend www tests OK." -ForegroundColor Green
    }
} finally {
    Pop-Location
}

# --- Summary ---
Write-Host "`n========== Summary ==========" -ForegroundColor Cyan
foreach ($p in $passed) { Write-Host "  PASS: $p" -ForegroundColor Green }
foreach ($f in $failed) { Write-Host "  FAIL: $f" -ForegroundColor Red }
if ($failed.Count -gt 0) {
    Write-Host "`nSome tests failed." -ForegroundColor Red
    exit 1
}
Write-Host "`nAll tests passed." -ForegroundColor Green
exit 0

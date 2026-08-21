param(
    [string]$ProjectRoot = "D:\intervia-my-id"
)

$ErrorActionPreference = "Stop"
$PackageRoot = $PSScriptRoot
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ProjectRoot ".backup\ai-service-$stamp"

$relativeFiles = @(
    "services\ai_service\Cargo.toml",
    "services\ai_service\Dockerfile",
    "services\ai_service\docker-entrypoint.sh",
    "services\ai_service\.dockerignore",
    "services\ai_service\src\main.rs",
    "docker-compose.dev.yml",
    "up-super-fast.ps1",
    "verify-ai-service.ps1"
)

New-Item -ItemType Directory -Path $backupRoot -Force *> $null

foreach ($relative in $relativeFiles) {
    $source = Join-Path $PackageRoot $relative
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Package file missing: $relative"
    }

    $destination = Join-Path $ProjectRoot $relative
    if (Test-Path -LiteralPath $destination) {
        $backup = Join-Path $backupRoot $relative
        New-Item -ItemType Directory -Path (Split-Path $backup -Parent) -Force *> $null
        Copy-Item -LiteralPath $destination -Destination $backup -Force
    }

    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force *> $null
    Copy-Item -LiteralPath $source -Destination $destination -Force
    Write-Host "Installed: $relative" -ForegroundColor Green
}

Write-Host ""
Write-Host "Backup: $backupRoot" -ForegroundColor Cyan
Write-Host "AI files installed. Merge .env.ai.development.example into .env.development, then run:" -ForegroundColor Cyan
Write-Host "  cd $ProjectRoot" -ForegroundColor White
Write-Host "  .\verify-ai-service.ps1 -PullModel -TestInference" -ForegroundColor White

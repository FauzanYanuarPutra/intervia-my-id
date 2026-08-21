param(
    [string]$ProjectRoot = "D:\intervia-my-id",
    [string]$EnvFile = ".env.development",
    [switch]$StartAfterInstall
)

$ErrorActionPreference = "Stop"

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force *> $null
    }
}

function Get-EnvKeys {
    param([Parameter(Mandatory = $true)][string]$Path)

    $keys = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $keys
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*#') { continue }
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
            $keys[$matches[1]] = $true
        }
    }
    return $keys
}

function Merge-EnvMissingOnly {
    param(
        [Parameter(Mandatory = $true)][string]$TargetPath,
        [Parameter(Mandatory = $true)][string]$TemplatePath
    )

    if (-not (Test-Path -LiteralPath $TemplatePath)) {
        throw "Env merge template not found: $TemplatePath"
    }

    if (-not (Test-Path -LiteralPath $TargetPath)) {
        New-Item -ItemType File -Path $TargetPath -Force *> $null
    }

    $keys = Get-EnvKeys -Path $TargetPath
    $missingLines = @()

    foreach ($line in Get-Content -LiteralPath $TemplatePath) {
        if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
            continue
        }

        $key = $matches[1]
        if ($keys.ContainsKey($key)) {
            continue
        }

        $missingLines += $line
        $keys[$key] = $true
    }

    if ($missingLines.Count -eq 0) {
        Write-Host "Env merge: no missing keys. Existing env values were left untouched." -ForegroundColor DarkGray
        return
    }

    Add-Content -LiteralPath $TargetPath -Value ""
    Add-Content -LiteralPath $TargetPath -Value "# Added by Lajukan final AI installer $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    foreach ($line in $missingLines) {
        Add-Content -LiteralPath $TargetPath -Value $line
    }

    Write-Host "Env merge: appended $($missingLines.Count) missing key(s); no existing value was changed." -ForegroundColor Green
}

$packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "Project root not found: $ProjectRoot"
}

Set-Location $ProjectRoot

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $ProjectRoot ".backup\final-ai-stack-$stamp"
Ensure-Directory -Path $backupRoot

$relativeFiles = @(
    "frontend\www\src\lib\personal-ai\runtime.ts",
    "frontend\www\src\lib\personal-ai\store.ts",
    "frontend\www\src\lib\personal-ai\browserCache.ts",
    "frontend\www\src\lib\personal-ai\builder.ts",
    "frontend\www\src\lib\personal-ai\domainKnowledge.ts",
    "frontend\www\src\lib\personal-ai\runtime.test.ts",
    "frontend\www\src\lib\personal-ai\store.test.ts",
    "frontend\www\src\lib\personal-ai\browserCache.test.ts",
    "frontend\www\src\lib\personal-ai\builder.test.ts",
    "frontend\www\src\lib\personal-ai\domainKnowledge.test.ts",
    "frontend\www\src\app\api\ai\personal\chat\route.ts",
    "frontend\www\src\app\api\ai\chat\route.ts",
    "frontend\www\src\app\api\ai\business-plan\route.ts",
    "services\ai_service\Cargo.toml",
    "services\ai_service\Dockerfile",
    "services\ai_service\docker-entrypoint.sh",
    "services\ai_service\.dockerignore",
    "services\ai_service\src\main.rs",
    "services\ocr_service\main.py",
    "services\ocr_service\Dockerfile",
    "services\ocr_service\requirements.txt",
    "services\ocr_service\.dockerignore",
    "services\liveness_service\main.py",
    "services\liveness_service\liveness_model.py",
    "services\liveness_service\Dockerfile",
    "services\liveness_service\requirements.txt",
    "services\liveness_service\.dockerignore",
    "docker-compose.dev.yml",
    "up-super-fast.ps1"
)

Write-Host "Creating source/config backup before install..." -ForegroundColor Cyan

foreach ($relative in $relativeFiles) {
    $target = Join-Path $ProjectRoot $relative
    if (-not (Test-Path -LiteralPath $target)) {
        continue
    }

    $backup = Join-Path $backupRoot $relative
    Ensure-Directory -Path (Split-Path -Parent $backup)
    Copy-Item -LiteralPath $target -Destination $backup -Force
}

$envTarget = Join-Path $ProjectRoot $EnvFile
if (Test-Path -LiteralPath $envTarget) {
    $envBackup = Join-Path $backupRoot $EnvFile
    Ensure-Directory -Path (Split-Path -Parent $envBackup)
    Copy-Item -LiteralPath $envTarget -Destination $envBackup -Force
}

Write-Host "Backup created: $backupRoot" -ForegroundColor Green

foreach ($relative in $relativeFiles) {
    $source = Join-Path $packageRoot $relative
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Package source missing: $relative"
    }

    $target = Join-Path $ProjectRoot $relative
    Ensure-Directory -Path (Split-Path -Parent $target)
    Copy-Item -LiteralPath $source -Destination $target -Force
}

# Copy model/readme resource files without deleting existing models.
$resourceCopies = @(
    @{
        source = "services\liveness_service\resources\anti_spoof_models\README.md"
        target = "services\liveness_service\resources\anti_spoof_models\README.md"
    }
)
foreach ($copy in $resourceCopies) {
    $source = Join-Path $packageRoot $copy.source
    if (-not (Test-Path -LiteralPath $source)) { continue }
    $target = Join-Path $ProjectRoot $copy.target
    Ensure-Directory -Path (Split-Path -Parent $target)
    Copy-Item -LiteralPath $source -Destination $target -Force
}

$envTemplate = Join-Path $packageRoot "env\env.additive.merge-only.example"
Merge-EnvMissingOnly -TargetPath $envTarget -TemplatePath $envTemplate

# Validate Compose now, but do not delete/recreate data.
Write-Host "Validating development Compose..." -ForegroundColor Cyan
& docker compose -f docker-compose.dev.yml --env-file $EnvFile config --quiet
if ($LASTEXITCODE -ne 0) {
    throw "docker compose config validation failed. Existing backup is at: $backupRoot"
}
Write-Host "Compose validation passed." -ForegroundColor Green

Write-Host ""
Write-Host "Install complete." -ForegroundColor Green
Write-Host "Existing env values: preserved." -ForegroundColor Green
Write-Host "Docker named volumes: untouched." -ForegroundColor Green
Write-Host "Backup: $backupRoot" -ForegroundColor DarkGray

if ($StartAfterInstall) {
    Write-Host "Starting Lajukan through the one-command startup..." -ForegroundColor Cyan
    & (Join-Path $ProjectRoot "up-super-fast.ps1")
    if ($LASTEXITCODE -ne 0) {
        throw "up-super-fast.ps1 returned a non-zero exit code."
    }
}
else {
    Write-Host "Daily command: .\up-super-fast.ps1" -ForegroundColor Cyan
}

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ============================================================
# LAJUKAN - FINISH FRONTEND RESTRUCTURE
# Compatible with:
# - Windows PowerShell 5.1
# - PowerShell 7+
# ============================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "../..")).Path

Set-Location $RepoRoot

Write-Host ""
Write-Host "============================================"
Write-Host " LAJUKAN FRONTEND RESTRUCTURE FIX"
Write-Host "============================================"
Write-Host "Repository: $RepoRoot"
Write-Host ""

# ------------------------------------------------------------
# UTF-8 WITHOUT BOM
# ------------------------------------------------------------
#
# Windows PowerShell 5.1 tidak mengenal:
#
#   Set-Content -Encoding utf8NoBOM
#
# Karena itu kita menggunakan .NET langsung agar hasil file:
# - UTF-8
# - tanpa BOM
# - kompatibel PowerShell 5.1 dan PowerShell 7+
#
$Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding($false)


# ------------------------------------------------------------
# HELPER: Replace exact text inside a file
# ------------------------------------------------------------
function Replace-InFile {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path,

        [Parameter(Mandatory = $true)]
        [hashtable] $Replacements
    )

    $FullPath = Join-Path $RepoRoot $Path

    if (-not (Test-Path -LiteralPath $FullPath)) {
        Write-Warning "File tidak ditemukan: $Path"
        return
    }

    $Original = [System.IO.File]::ReadAllText($FullPath)
    $Updated = $Original

    foreach ($OldValue in $Replacements.Keys) {
        $NewValue = $Replacements[$OldValue]

        if ($Updated.Contains($OldValue)) {
            $Updated = $Updated.Replace($OldValue, $NewValue)

            Write-Host "  REPLACE:"
            Write-Host "    $OldValue"
            Write-Host "  ->"
            Write-Host "    $NewValue"
            Write-Host ""
        }
    }

    if ($Updated -eq $Original) {
        Write-Host "[SKIP] Tidak ada perubahan: $Path"
        return
    }

    [System.IO.File]::WriteAllText(
        $FullPath,
        $Updated,
        $Utf8NoBomEncoding
    )

    Write-Host "[FIXED] $Path"
    Write-Host ""
}


# ------------------------------------------------------------
# HELPER: Check whether Git repository contains stale reference
# ------------------------------------------------------------
function Find-GitPattern {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Pattern
    )

    $Output = @(
        git grep -n -F -- "$Pattern" 2>$null
    )

    $GitExitCode = $LASTEXITCODE

    if ($GitExitCode -eq 0 -and $Output.Count -gt 0) {
        return $Output
    }

    return @()
}


# ============================================================
# 1. FIX DOCKER COMPOSE FRONTEND DOCKERFILE PATHS
# ============================================================

Write-Host "============================================"
Write-Host " 1. Docker Compose frontend paths"
Write-Host "============================================"
Write-Host ""

$ComposeReplacements = @{
    "dockerfile: www/Dockerfile"   = "dockerfile: apps/www/Dockerfile"
    "dockerfile: usaha/Dockerfile" = "dockerfile: apps/usaha/Dockerfile"
    "dockerfile: cms/Dockerfile"   = "dockerfile: apps/cms/Dockerfile"
    "dockerfile: crm/Dockerfile"   = "dockerfile: apps/crm/Dockerfile"
}

Replace-InFile `
    -Path "docker-compose.yml" `
    -Replacements $ComposeReplacements

Replace-InFile `
    -Path "docker-compose.dev.yml" `
    -Replacements $ComposeReplacements


# ============================================================
# 2. FIX FAST STARTUP SCRIPT REFERENCES
# ============================================================

Write-Host "============================================"
Write-Host " 2. Fast startup script paths"
Write-Host "============================================"
Write-Host ""

$FastScriptReplacements = @{
    "frontend/apps/shared"        = "frontend/packages"
    "frontend/apps/.dockerignore" = "frontend/.dockerignore"
    "frontend/shared"             = "frontend/packages"
}

Replace-InFile `
    -Path "up-super-fast.ps1" `
    -Replacements $FastScriptReplacements

Replace-InFile `
    -Path "up-super-fast-dev.ps1" `
    -Replacements $FastScriptReplacements


# ============================================================
# 3. FIX DEV LIVE SCRIPT IF OLD PATHS STILL EXIST
# ============================================================

Write-Host "============================================"
Write-Host " 3. dev-live.sh paths"
Write-Host "============================================"
Write-Host ""

$DevLiveReplacements = @{
    "frontend/www"   = "frontend/apps/www"
    "frontend/usaha" = "frontend/apps/usaha"
    "frontend/cms"   = "frontend/apps/cms"
    "frontend/crm"   = "frontend/apps/crm"
}

Replace-InFile `
    -Path "dev-live.sh" `
    -Replacements $DevLiveReplacements


# ============================================================
# 4. VERIFY REQUIRED FRONTEND DIRECTORIES
# ============================================================

Write-Host "============================================"
Write-Host " 4. Verify frontend structure"
Write-Host "============================================"
Write-Host ""

$RequiredPaths = @(
    "frontend/apps/www",
    "frontend/apps/usaha",
    "frontend/apps/cms",
    "frontend/apps/crm",
    "frontend/apps/mobile",
    "frontend/packages",
    "frontend/.dockerignore"
)

$MissingRequiredPaths = @()

foreach ($RelativePath in $RequiredPaths) {
    $FullPath = Join-Path $RepoRoot $RelativePath

    if (Test-Path -LiteralPath $FullPath) {
        Write-Host "[OK] $RelativePath"
    }
    else {
        Write-Host "[MISSING] $RelativePath"
        $MissingRequiredPaths += $RelativePath
    }
}

Write-Host ""

if ($MissingRequiredPaths.Count -gt 0) {
    Write-Host "ERROR: Struktur frontend belum lengkap."
    Write-Host ""

    foreach ($MissingPath in $MissingRequiredPaths) {
        Write-Host "  X $MissingPath"
    }

    Write-Host ""
    exit 1
}


# ============================================================
# 5. VERIFY PACKAGE.JSON LOCAL PACKAGE PATHS
# ============================================================

Write-Host "============================================"
Write-Host " 5. Verify lajukan-ui package references"
Write-Host "============================================"
Write-Host ""

$PackageJsonFiles = @(
    "frontend/apps/www/package.json",
    "frontend/apps/cms/package.json",
    "frontend/apps/crm/package.json"
)

$InvalidPackageReference = $false

foreach ($RelativePath in $PackageJsonFiles) {
    $FullPath = Join-Path $RepoRoot $RelativePath

    if (-not (Test-Path -LiteralPath $FullPath)) {
        Write-Warning "Package file tidak ditemukan: $RelativePath"
        $InvalidPackageReference = $true
        continue
    }

    $Content = [System.IO.File]::ReadAllText($FullPath)

    if ($Content.Contains('"file:../shared"')) {
        Write-Host "[INVALID] $RelativePath masih memakai file:../shared"
        $InvalidPackageReference = $true
    }
    elseif ($Content.Contains('"file:../../packages"')) {
        Write-Host "[OK] $RelativePath -> frontend/packages"
    }
    else {
        Write-Host "[REVIEW] $RelativePath tidak memiliki reference yang dikenal."
    }
}

Write-Host ""

if ($InvalidPackageReference) {
    Write-Host "ERROR:"
    Write-Host "Masih ada package.json yang menunjuk ke ../shared."
    Write-Host ""
    Write-Host "Target yang benar:"
    Write-Host '  "lajukan-ui": "file:../../packages"'
    Write-Host ""
    exit 1
}


# ============================================================
# 6. CHECK STALE PATHS
# ============================================================

Write-Host "============================================"
Write-Host " 6. Check stale frontend references"
Write-Host "============================================"
Write-Host ""

$StalePatterns = @(
    "frontend/apps/shared",
    "frontend/apps/.dockerignore",
    "frontend/shared",
    "file:../shared",
    "dockerfile: www/Dockerfile",
    "dockerfile: usaha/Dockerfile",
    "dockerfile: cms/Dockerfile",
    "dockerfile: crm/Dockerfile"
)

$HasStalePath = $false

foreach ($Pattern in $StalePatterns) {
    $Matches = @(Find-GitPattern -Pattern $Pattern)

    if ($Matches.Count -gt 0) {
        $HasStalePath = $true

        Write-Host "[FOUND] Reference lama:"
        Write-Host "  $Pattern"
        Write-Host ""

        foreach ($Match in $Matches) {
            Write-Host "  $Match"
        }

        Write-Host ""
    }
    else {
        Write-Host "[OK] Tidak ditemukan: $Pattern"
    }
}

Write-Host ""


# ============================================================
# 7. CHECK GIT-TRACKED IGNORED FILES
# ============================================================

Write-Host "============================================"
Write-Host " 7. Check tracked ignored files"
Write-Host "============================================"
Write-Host ""

$IgnoredTrackedFiles = @(
    git ls-files -ci --exclude-standard
)

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: gagal menjalankan git ls-files."
    exit 1
}

if ($IgnoredTrackedFiles.Count -eq 0) {
    Write-Host "[OK] Tidak ada ignored file yang masih tracked Git."
}
else {
    Write-Host "[WARNING]"
    Write-Host "File berikut sudah di-.gitignore tetapi masih tracked Git:"
    Write-Host ""

    foreach ($TrackedFile in $IgnoredTrackedFiles) {
        Write-Host "  $TrackedFile"
    }

    Write-Host ""
    Write-Host "Ini belum otomatis dihapus dari Git."
    Write-Host "Nanti jalankan perintah untrack yang sudah diberikan."
}

Write-Host ""


# ============================================================
# FINAL RESULT
# ============================================================

Write-Host "============================================"
Write-Host " RESULT"
Write-Host "============================================"
Write-Host ""

if ($HasStalePath) {
    Write-Host "FAIL"
    Write-Host ""
    Write-Host "Masih ada reference lama."
    Write-Host "Lihat bagian [FOUND] di atas."
    Write-Host ""
    exit 1
}

Write-Host "PASS"
Write-Host ""
Write-Host "Frontend restructure paths sudah konsisten."
Write-Host ""
Write-Host "Langkah berikutnya:"
Write-Host "  1. Regenerate package-lock.json"
Write-Host "  2. Untrack ignored files"
Write-Host "  3. Jalankan repository hygiene checker"
Write-Host "  4. Build frontend packages/apps"
Write-Host ""
exit 0
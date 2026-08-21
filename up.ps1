[CmdletBinding()]
param(
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development",

    [string[]]$Profile = @(),
    [string[]]$Services = @(),

    [switch]$Build,
    [switch]$Pull,
    [switch]$Down,
    [switch]$Fresh
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $RepoRoot

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI tidak ditemukan. Install/start Docker Desktop atau Docker Engine terlebih dahulu."
    }

    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose v2 ('docker compose') tidak tersedia."
    }

    switch ($Environment) {
        "development" {
            $EnvFile = ".env.development"
            $Overlay = "docker-compose.dev.yml"
        }
        "staging" {
            $EnvFile = ".env.staging"
            $Overlay = "docker-compose.staging.yml"
        }
        "production" {
            $EnvFile = ".env.production"
            $Overlay = "docker-compose.prod.yml"
        }
    }

    if (-not (Test-Path $EnvFile)) {
        $Example = "$EnvFile.example"
        if (Test-Path $Example) {
            throw "File $EnvFile belum ada. Copy $Example menjadi $EnvFile lalu isi nilainya."
        }
        throw "File environment $EnvFile tidak ditemukan."
    }

    $ComposeArgs = @(
        "compose",
        "--env-file", $EnvFile,
        "-f", "docker-compose.yml",
        "-f", $Overlay
    )

    foreach ($Item in $Profile) {
        foreach ($Name in ($Item -split ',')) {
            $Trimmed = $Name.Trim()
            if ($Trimmed) {
                $ComposeArgs += @("--profile", $Trimmed)
            }
        }
    }

    if ($Fresh) {
        Write-Host "Recreating containers for $Environment (volumes are preserved)..." -ForegroundColor Yellow
        & docker @ComposeArgs down --remove-orphans
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    if ($Down) {
        & docker @ComposeArgs down --remove-orphans
        exit $LASTEXITCODE
    }

    if ($Pull) {
        & docker @ComposeArgs pull
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    if ($Build) {
        $BuildArgs = @("build")
        if ($Services.Count -gt 0) {
            $BuildArgs += $Services
        }
        & docker @ComposeArgs @BuildArgs
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    $UpArgs = @("up", "-d", "--remove-orphans")
    if ($Services.Count -gt 0) {
        $UpArgs += $Services
    }

    & docker @ComposeArgs @UpArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    & docker @ComposeArgs ps
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}

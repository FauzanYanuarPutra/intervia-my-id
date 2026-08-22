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

    # Backward compatibility for existing local installations. Before the
    # repository-foundation refactor the canonical launcher accepted `.env`
    # when `.env.development` was absent. Keeping this fallback prevents a
    # harmless launcher refactor from breaking an otherwise valid local stack.
    if (-not (Test-Path -LiteralPath $EnvFile)) {
        if ($Environment -eq "development" -and (Test-Path -LiteralPath ".env")) {
            Write-Warning ".env.development tidak ditemukan; menggunakan .env untuk kompatibilitas development lama."
            $EnvFile = ".env"
        }
        else {
            $Example = "$EnvFile.example"
            if (Test-Path -LiteralPath $Example) {
                throw "File $EnvFile belum ada. Copy $Example menjadi $EnvFile lalu isi nilainya."
            }
            throw "File environment $EnvFile tidak ditemukan."
        }
    }

    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $PythonCommand) {
        throw "Python 3 tidak ditemukan. Runtime contract validator memerlukan Python 3."
    }

    # Resolve both COMPOSE_PROFILES from the env file and explicit -Profile
    # arguments through one shared contract. Development automatically enables
    # the tunnel when a token is configured, preventing a healthy local stack
    # from silently publishing a dead Cloudflare Tunnel (Error 1033).
    $ProfileResolverArgs = @(
        "scripts/config/launcher_profiles.py",
        "--env-file", $EnvFile,
        "--environment", $Environment
    )
    foreach ($Item in $Profile) {
        $ProfileResolverArgs += @("--profile", $Item)
    }
    $ResolvedProfileOutput = & $PythonCommand.Source @ProfileResolverArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Gagal menentukan Docker Compose profiles."
    }
    $RequestedProfiles = @(
        $ResolvedProfileOutput |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ }
    )

    $ComposeArgs = @(
        "compose",
        "--env-file", $EnvFile,
        "-f", "docker-compose.yml",
        "-f", $Overlay
    )

    foreach ($RequestedProfile in $RequestedProfiles) {
        $ComposeArgs += @("--profile", $RequestedProfile)
    }

    # Validate the merged Compose model before changing container state. This
    # catches missing variables, invalid overrides and broken service contracts
    # early instead of partially starting the stack.
    & docker @ComposeArgs config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Konfigurasi Docker Compose tidak valid. Perbaiki error di atas sebelum stack dijalankan."
    }

    # Development KYC is self-provisioning: the anti-spoof ONNX files are
    # pinned by commit and SHA-256 in the provisioner. Staging/production remain
    # explicit and fail closed so deployment never downloads security models.
    $KycRequested = $RequestedProfiles -contains "kyc"
    if ($Environment -eq "development" -and $KycRequested -and -not $Down) {
        Write-Host "Verifying local KYC liveness models..." -ForegroundColor Cyan
        & $PythonCommand.Source "scripts/config/provision_kyc_models.py" "--env-file" $EnvFile
        if ($LASTEXITCODE -ne 0) {
            throw "Gagal menyiapkan model KYC liveness. Tidak ada container yang diubah."
        }
    }

    $ComposeModel = & docker @ComposeArgs config --format json
    if ($LASTEXITCODE -ne 0) {
        throw "Gagal membuat model Docker Compose untuk validasi runtime."
    }
    $ValidatorArgs = @(
        "scripts/config/runtime_contract.py",
        "--model", "-",
        "--env-file", $EnvFile,
        "--environment", $Environment
    )
    foreach ($RequestedProfile in $RequestedProfiles) {
        $ValidatorArgs += @("--profile", $RequestedProfile)
    }
    $ComposeModel | & $PythonCommand.Source @ValidatorArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Kontrak konfigurasi runtime tidak valid. Tidak ada container yang diubah."
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

    $UpArgs = @("up", "-d", "--remove-orphans", "--wait", "--wait-timeout", "180")
    if ($Services.Count -gt 0) {
        $UpArgs += $Services
    }

    & docker @ComposeArgs @UpArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $TunnelRequested = $RequestedProfiles -contains "tunnel"
    $TunnelSelected = $Services.Count -eq 0 -or $Services -contains "cloudflared"
    if ($TunnelRequested -and $TunnelSelected) {
        Write-Host "Waiting for Cloudflare Tunnel edge registration..." -ForegroundColor Cyan
        $TunnelReady = $false
        $Deadline = (Get-Date).AddSeconds(60)
        while ((Get-Date) -lt $Deadline) {
            $TunnelLogs = & docker @ComposeArgs logs --no-color --since 2m cloudflared 2>&1
            if ($TunnelLogs -match "Registered tunnel connection") {
                $TunnelReady = $true
                break
            }
            Start-Sleep -Seconds 2
        }
        if (-not $TunnelReady) {
            & docker @ComposeArgs ps cloudflared
            throw "Cloudflare Tunnel belum mendaftarkan koneksi edge dalam 60 detik. Periksa token baru, DNS tunnel, dan log cloudflared."
        }
        Write-Host "Cloudflare Tunnel registered with the edge." -ForegroundColor Green
    }

    & docker @ComposeArgs ps
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}

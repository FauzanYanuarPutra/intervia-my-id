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

    & docker @ComposeArgs config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Konfigurasi Docker Compose tidak valid. Perbaiki error di atas sebelum stack dijalankan."
    }

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

    # Caddyfile is bind-mounted. `docker compose up` does not reload an already
    # running Caddy process when only the mounted file content changes. Always
    # validate and activate the current edge config after startup so forwarded
    # scheme/host fixes cannot remain stale and cause HTTPS redirect loops.
    $EdgeRequested =
        ($RequestedProfiles -contains "edge") -or
        ($RequestedProfiles -contains "tunnel")
    $CaddySelected = $Services.Count -eq 0 -or $Services -contains "caddy"
    if ($EdgeRequested -and $CaddySelected) {
        Write-Host "Validating and reloading Caddy edge configuration..." -ForegroundColor Cyan

        & docker @ComposeArgs exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
        if ($LASTEXITCODE -ne 0) {
            & docker @ComposeArgs logs --no-color --tail 80 caddy
            throw "Konfigurasi Caddy tidak valid. Edge configuration tidak direload."
        }

        & docker @ComposeArgs exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
        if ($LASTEXITCODE -ne 0) {
            & docker @ComposeArgs logs --no-color --tail 80 caddy
            throw "Caddy gagal memuat konfigurasi edge terbaru."
        }

        Write-Host "Caddy edge configuration is active." -ForegroundColor Green
    }

    $TunnelRequested = $RequestedProfiles -contains "tunnel"
    $TunnelSelected = $Services.Count -eq 0 -or $Services -contains "cloudflared"
    if ($TunnelRequested -and $TunnelSelected) {
        Write-Host "Checking Cloudflare Tunnel edge readiness..." -ForegroundColor Cyan
        $TunnelReady = $false
        $Deadline = (Get-Date).AddSeconds(60)

        while ((Get-Date) -lt $Deadline) {
            & $PythonCommand.Source "scripts/config/tunnel_readiness.py" "--env-file" $EnvFile
            if ($LASTEXITCODE -eq 0) {
                $TunnelReady = $true
                break
            }

            # Staging/production may keep the metrics port private. In that
            # case, an existing registration log is a compatibility fallback.
            $TunnelLogs = & docker @ComposeArgs logs --no-color cloudflared 2>&1
            if ($TunnelLogs -match "Registered tunnel connection") {
                $TunnelReady = $true
                Write-Host "Cloudflare Tunnel registration found in connector history (metrics endpoint not reachable from host)." -ForegroundColor Yellow
                break
            }

            Start-Sleep -Seconds 2
        }

        if (-not $TunnelReady) {
            & docker @ComposeArgs ps cloudflared
            & docker @ComposeArgs logs --no-color --tail 80 cloudflared
            throw "Cloudflare Tunnel tidak memiliki koneksi edge aktif dalam 60 detik. Periksa token, jaringan outbound, dan konfigurasi tunnel."
        }
        Write-Host "Cloudflare Tunnel is connected to the edge." -ForegroundColor Green
    }

    & docker @ComposeArgs ps
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}

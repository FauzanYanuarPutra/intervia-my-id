[CmdletBinding()]
param(
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development",

    [string[]]$Profile = @(),
    [string[]]$Services = @(),

    [switch]$Build,
    [switch]$Pull,
    [switch]$Down,
    [switch]$Fresh,

    # Compose defaults to unlimited engine-call concurrency (-1). Lajukan has
    # enough Rust/Next.js services that an unlimited build fan-out can overload
    # Docker Desktop before BuildKit gets a chance to recover. Keep it
    # configurable while defaulting to a stable local-development value.
    [ValidateRange(1, 32)]
    [int]$ParallelLimit = 4
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $RepoRoot

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI tidak ditemukan. Install/start Docker Desktop atau Docker Engine terlebih dahulu."
    }

    $DockerDesktopCliAvailable = $false
    $DockerDesktopCommand = Get-Command "docker" -ErrorAction SilentlyContinue
    if ($DockerDesktopCommand) {
        & docker desktop status *> $null
        $DockerDesktopCliAvailable = ($LASTEXITCODE -eq 0)
    }

    # Compose config validation does not guarantee that the Docker daemon is
    # healthy. Probe the actual Engine API before resolving/building the stack.
    # This catches Docker Desktop Linux-engine failures such as HTTP 500 on
    # /_ping before a 22-image build is started.
    $EngineReady = $false
    $EngineProbeOutput = @()
    for ($Attempt = 1; $Attempt -le 6; $Attempt++) {
        $EngineProbeOutput = @(& docker info --format "{{json .ServerVersion}}" 2>&1)
        if ($LASTEXITCODE -eq 0) {
            $EngineReady = $true
            break
        }

        if ($Attempt -lt 6) {
            Start-Sleep -Seconds 3
        }
    }

    if (-not $EngineReady) {
        $EngineDetails = ($EngineProbeOutput -join " ").Trim()
        $DesktopStatus = ""
        if ($DockerDesktopCliAvailable) {
            $DesktopStatus = (& docker desktop status --format json 2>&1 | Out-String).Trim()
        }

        $RecoveryHint = @(
            "Docker Engine tidak sehat/tidak merespons.",
            "Status probe: $EngineDetails",
            "Docker Desktop status: $DesktopStatus",
            "",
            "Perbaikan yang aman:",
            "  1. docker desktop start",
            "  2. docker info",
            "  3. Jalankan lagi .\up.ps1 ... -Build",
            "",
            "Jika Docker Desktop terlihat Running tetapi docker info tetap HTTP 500:",
            "  docker desktop restart",
            "  docker info",
            "",
            "Jangan gunakan 'docker compose down -v' untuk masalah ini; volume database tidak perlu dihapus."
        ) -join [Environment]::NewLine

        throw $RecoveryHint
    }

    # Bound Compose's concurrent engine calls. This is intentionally set at
    # the script level so every build/up/pull/config invocation uses the same
    # stable concurrency budget without changing repository Compose semantics.
    $env:COMPOSE_PARALLEL_LIMIT = $ParallelLimit.ToString()

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

    $UpArgs = @("up", "-d", "--remove-orphans", "--wait", "--wait-timeout", "420")
    if ($Build) {
        # A freshly built image must never keep running behind a stale container
        # health state. Volumes remain preserved; only service containers are recreated.
        $UpArgs += "--force-recreate"
    }
    if ($Services.Count -gt 0) {
        $UpArgs += $Services
    }

    & docker @ComposeArgs @UpArgs
    if ($LASTEXITCODE -ne 0) {
        $UpExitCode = $LASTEXITCODE
        Write-Warning "Runtime gagal menjadi healthy. Menampilkan status dan log core service untuk diagnosis."
        & docker @ComposeArgs ps -a
        & docker @ComposeArgs logs --no-color --tail 120 marketplace_service chat_service identity_service community_service
        exit $UpExitCode
    }

    $LocalAiRequested = $RequestedProfiles -contains "local-ai"
    $OllamaSelected = $Services.Count -eq 0 -or $Services -contains "ollama"
    if ($Environment -eq "development" -and $LocalAiRequested -and $OllamaSelected) {
        Write-Host "Verifying configured Ollama model..." -ForegroundColor Cyan
        & $PythonCommand.Source "scripts/config/provision_ollama_models.py" "--env-file" $EnvFile
        if ($LASTEXITCODE -ne 0) {
            throw "Model Ollama gagal disiapkan. Periksa koneksi registry model dan kapasitas disk."
        }
    }

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
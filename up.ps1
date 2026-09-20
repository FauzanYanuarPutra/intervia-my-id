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

    [switch]$NoDockerEngineRepair,

    # Compose defaults to unlimited engine-call concurrency (-1). Lajukan has
    # enough Rust/Next.js services that an unlimited build fan-out can overload
    # Docker Desktop before BuildKit gets a chance to recover. Keep it
    # configurable while defaulting to a stable local-development value.
    [ValidateRange(1, 32)]
    [int]$ParallelLimit = 2
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($Down -and ($Build -or $Pull -or $Fresh)) {
    throw "Parameter -Down tidak dapat digabung dengan -Build, -Pull, atau -Fresh. Jalankan aksi tersebut secara terpisah."
}

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PreviousComposeParallelLimit = $env:COMPOSE_PARALLEL_LIMIT
Push-Location $RepoRoot

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI tidak ditemukan. Install/start Docker Desktop atau Docker Engine terlebih dahulu."
    }

    function Invoke-DockerNative {
        param(
            [Parameter(Mandatory = $true)]
            [string[]]$Arguments
        )

        # PowerShell 7.4+ can turn a non-zero native exit code into an
        # ErrorRecord when $PSNativeCommandUseErrorActionPreference is enabled.
        # The launcher intentionally needs the exit code/output as data so a
        # broken Docker daemon can be diagnosed instead of terminating here.
        $PreviousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            $Output = @(& docker @Arguments 2>&1)
            [pscustomobject]@{
                ExitCode = $LASTEXITCODE
                Output = $Output
            }
        }
        finally {
            $ErrorActionPreference = $PreviousErrorActionPreference
        }
    }

    $DockerRecoveryState = [pscustomobject]@{
        Attempted = $false
        Succeeded = $false
        Reason = "not-run"
    }
    $DockerDesktopCliAvailable = $false
    $DockerDesktopCommand = Get-Command "docker" -ErrorAction SilentlyContinue
    $DesktopStatusProbe = $null
    $DesktopVersionProbe = $null
    if ($DockerDesktopCommand) {
        # `status` can return non-zero when Desktop/Engine is broken, so use
        # `version` as the capability probe and keep status for diagnostics.
        $DesktopVersionProbe = Invoke-DockerNative -Arguments @("desktop", "version", "--short")
        $DesktopStatusProbe = Invoke-DockerNative -Arguments @("desktop", "status", "--format", "json")
        $DockerDesktopCliAvailable =
            ($DesktopVersionProbe.ExitCode -eq 0) -or
            ($DesktopStatusProbe.ExitCode -eq 0)
    }

    function Test-DockerEngineFailure {
        param(
            [Parameter(Mandatory = $true)]
            [string]$OutputText
        )

        return (
            $OutputText -match "(?i)dockerDesktopLinuxEngine" -or
            $OutputText -match "(?i)/_ping" -or
            $OutputText -match "(?i)API route and version" -or
            $OutputText -match "(?i)Cannot connect to the Docker daemon" -or
            $OutputText -match "(?i)is the docker daemon running" -or
            $OutputText -match "(?i)error during connect" -or
            $OutputText -match "(?i)error response from daemon"
        )
    }

    function Invoke-DockerEngineRecovery {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Reason
        )

        if ($NoDockerEngineRepair) {
            $DockerRecoveryState.Reason = "disabled"
            return $false
        }

        if ($DockerRecoveryState.Attempted) {
            return $false
        }

        if (-not $DockerDesktopCliAvailable) {
            $DockerRecoveryState.Reason = "docker-desktop-cli-unavailable"
            return $false
        }

        $DockerRecoveryState.Attempted = $true
        $DockerRecoveryState.Reason = $Reason
        Write-Warning "Docker Engine gagal pada saat $Reason. Mencoba satu kali recovery Docker Desktop..."

        $RestartProbe = Invoke-DockerNative -Arguments @("desktop", "restart", "--timeout", "120")
        if ($RestartProbe.ExitCode -ne 0) {
            $RestartDetails = ($RestartProbe.Output -join " ").Trim()
            Write-Warning "docker desktop restart gagal: $RestartDetails"
            Write-Warning "Mencoba docker desktop start sebagai fallback..."

            $StartProbe = Invoke-DockerNative -Arguments @("desktop", "start", "--timeout", "120")
            if ($StartProbe.ExitCode -ne 0) {
                $StartDetails = ($StartProbe.Output -join " ").Trim()
                Write-Warning "docker desktop start juga gagal: $StartDetails"
                $DockerRecoveryState.Reason = "restart-and-start-failed"
                return $false
            }
        }
        for ($RecoveryAttempt = 1; $RecoveryAttempt -le 24; $RecoveryAttempt++) {
            Start-Sleep -Seconds 5
            $RecoveryProbe = Invoke-DockerNative -Arguments @("info", "--format", "{{json .ServerVersion}}")
            if ($RecoveryProbe.ExitCode -eq 0) {
                $DockerRecoveryState.Succeeded = $true
                $DockerRecoveryState.Reason = "recovered"
                Write-Host "Docker Engine kembali sehat setelah recovery." -ForegroundColor Green
                return $true
            }
        }

        $DockerRecoveryState.Reason = "engine-still-unhealthy"
        Write-Warning "Docker Desktop sudah direstart/start tetapi Docker Engine belum kembali sehat."
        return $false
    }

    # Compose config validation does not guarantee that the Docker daemon is
    # healthy. Probe the actual Engine API before resolving/building the stack.
    # This catches Docker Desktop Linux-engine failures such as HTTP 500 on
    # /_ping before a 22-image build is started.
    $EngineReady = $false
    $EngineProbeOutput = @()
    $EngineExitCode = 1
    for ($Attempt = 1; $Attempt -le 6; $Attempt++) {
        $EngineProbe = Invoke-DockerNative -Arguments @("info", "--format", "{{json .ServerVersion}}")
        $EngineProbeOutput = @($EngineProbe.Output)
        $EngineExitCode = $EngineProbe.ExitCode
        if ($EngineExitCode -eq 0) {
            $EngineReady = $true
            break
        }

        if ($Attempt -lt 6) {
            Start-Sleep -Seconds 3
        }
    }

    if (-not $EngineReady) {
        $EngineReady = Invoke-DockerEngineRecovery -Reason "initial Docker Engine preflight"
    }

    if (-not $EngineReady) {
        $EngineDetails = ($EngineProbeOutput -join " ").Trim()
        $DesktopStatus = ""
        if ($DesktopStatusProbe) {
            $DesktopStatus = ($DesktopStatusProbe.Output -join " ").Trim()
        }

        $RecoveryHint = @(
            "Docker Engine tidak sehat/tidak merespons.",
            "Status probe: $EngineDetails",
            "Docker Desktop status: $DesktopStatus",
            "Docker Desktop CLI: $($DockerRecoveryState.Reason)",
            "",
            $(if ($DockerRecoveryState.Attempted) {
                if ($DockerRecoveryState.Succeeded) {
                    "Recovery otomatis berhasil memulihkan Docker Engine."
                }
                else {
                    "Recovery otomatis sudah dicoba tetapi Engine belum pulih."
                }
            }
            elseif ($NoDockerEngineRepair) {
                "Recovery otomatis dinonaktifkan oleh -NoDockerEngineRepair."
            }
            else {
                "Recovery otomatis tidak dijalankan karena Docker Desktop CLI tidak terdeteksi."
            }),
            "Perbaikan manual:",
            "  1. docker desktop version",
            "  2. docker desktop status",
            "  3. docker desktop restart",
            "  4. docker info",
            "  5. Jalankan lagi .\up.ps1 ... -Build",
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
    if ($Environment -eq "development" -and $KycRequested -and -not $Down.IsPresent) {
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
    $ValidatorPreviousErrorActionPreference = $ErrorActionPreference
    $ValidatorOutput = @()
    $ValidatorExitCode = 1
    try {
        $ErrorActionPreference = "Continue"
        $ValidatorOutput = @(
            $ComposeModel | & $PythonCommand.Source @ValidatorArgs 2>&1
        )
        $ValidatorExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $ValidatorPreviousErrorActionPreference
    }

    $ValidatorOutput | ForEach-Object { Write-Output $_ }
    if ($ValidatorExitCode -ne 0) {
        throw "Kontrak konfigurasi runtime tidak valid. Tidak ada container yang diubah."
    }
    Write-Host "Runtime configuration contract passed; continuing launcher lifecycle..." -ForegroundColor Green
    Write-Host "Launcher actions: Build=$($Build.IsPresent) Pull=$($Pull.IsPresent) Fresh=$($Fresh.IsPresent) Down=$($Down.IsPresent) Services=$($Services -join ",")" -ForegroundColor DarkCyan

    if ($Fresh.IsPresent) {
        Write-Host "Recreating containers for $Environment (volumes are preserved)..." -ForegroundColor Yellow
        & docker @ComposeArgs down --remove-orphans
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    if ($Down.IsPresent) {
        & docker @ComposeArgs down --remove-orphans
        exit $LASTEXITCODE
    }

    if ($Pull.IsPresent) {
        & docker @ComposeArgs pull
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    if ($Build.IsPresent) {
        $BuildArgs = @("build")
        if ($Services.Count -gt 0) {
            $BuildArgs += $Services
        }

        $BuildPreviousErrorActionPreference = $ErrorActionPreference
        $BuildOutput = @()
        $BuildCapturedOutput = @()
        $BuildExitCode = 1
        try {
            # Compose progress is streamed while we also retain enough output to
            # distinguish an application build failure from a dead Docker daemon.
            $ErrorActionPreference = "Continue"
            $BuildOutput = @(& docker @ComposeArgs @BuildArgs 2>&1 | Tee-Object -Variable BuildCapturedOutput)
            $BuildExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $BuildPreviousErrorActionPreference
        }

        $BuildOutputText = ($BuildOutput + @($BuildCapturedOutput) | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        $DockerEngineFailure =
            $BuildExitCode -ne 0 -and (Test-DockerEngineFailure -OutputText $BuildOutputText)

        if ($BuildExitCode -ne 0 -and $DockerEngineFailure) {
            $OriginalParallelLimit = $env:COMPOSE_PARALLEL_LIMIT
            if (Invoke-DockerEngineRecovery -Reason "Compose build") {
                Write-Warning "Mengulangi Compose build dengan paralelisme 1 untuk mengurangi beban Docker Desktop..."
                $env:COMPOSE_PARALLEL_LIMIT = "1"
                $RetryPreviousErrorActionPreference = $ErrorActionPreference
                try {
                    $ErrorActionPreference = "Continue"
                    & docker @ComposeArgs @BuildArgs
                    $BuildExitCode = $LASTEXITCODE
                }
                finally {
                    $ErrorActionPreference = $RetryPreviousErrorActionPreference
                    $env:COMPOSE_PARALLEL_LIMIT = $OriginalParallelLimit
                }
            }
        }

        if ($BuildExitCode -ne 0) {
            exit $BuildExitCode
        }
    }

    $UpArgs = @("up", "-d", "--remove-orphans", "--wait", "--wait-timeout", "420")
    if ($Build.IsPresent) {
        # A freshly built image must never keep running behind a stale container
        # health state. Volumes remain preserved; only service containers are recreated.
        $UpArgs += "--force-recreate"
    }
    if ($Services.Count -gt 0) {
        $UpArgs += $Services
    }

    $UpPreviousErrorActionPreference = $ErrorActionPreference
    $UpOutput = @()
    $UpCapturedOutput = @()
    $UpExitCode = 1
    try {
        $ErrorActionPreference = "Continue"
        $UpOutput = @(& docker @ComposeArgs @UpArgs 2>&1 | Tee-Object -Variable UpCapturedOutput)
        $UpExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $UpPreviousErrorActionPreference
    }

    $UpOutputText = ($UpOutput + @($UpCapturedOutput) | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    $DockerEngineFailure =
        $UpExitCode -ne 0 -and (Test-DockerEngineFailure -OutputText $UpOutputText)

    if ($UpExitCode -ne 0 -and $DockerEngineFailure) {
        if (Invoke-DockerEngineRecovery -Reason "Compose up") {
            Write-Warning "Mengulangi Compose up dengan paralelisme 1 setelah recovery Docker Engine..."
            $OriginalParallelLimit = $env:COMPOSE_PARALLEL_LIMIT
            $env:COMPOSE_PARALLEL_LIMIT = "1"
            $RetryPreviousErrorActionPreference = $ErrorActionPreference
            try {
                $ErrorActionPreference = "Continue"
                & docker @ComposeArgs @UpArgs
                $UpExitCode = $LASTEXITCODE
            }
            finally {
                $ErrorActionPreference = $RetryPreviousErrorActionPreference
                $env:COMPOSE_PARALLEL_LIMIT = $OriginalParallelLimit
            }
        }
    }

    if ($UpExitCode -ne 0) {
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
    if ($null -eq $PreviousComposeParallelLimit) {
        Remove-Item Env:COMPOSE_PARALLEL_LIMIT -ErrorAction SilentlyContinue
    }
    else {
        $env:COMPOSE_PARALLEL_LIMIT = $PreviousComposeParallelLimit
    }
    Pop-Location
}
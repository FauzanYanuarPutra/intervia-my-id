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
    [int]$ParallelLimit = 4
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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

    $DockerDesktopCliAvailable = $false
    $DockerDesktopCommand = Get-Command "docker" -ErrorAction SilentlyContinue
    $DesktopStatusProbe = $null
    if ($DockerDesktopCommand) {
        $DesktopStatusProbe = Invoke-DockerNative -Arguments @("desktop", "status", "--format", "json")
        $DockerDesktopCliAvailable = ($DesktopStatusProbe.ExitCode -eq 0)
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

    if (-not $EngineReady -and -not $NoDockerEngineRepair -and $DockerDesktopCliAvailable) {
        Write-Warning "Docker Engine belum sehat. Mencoba satu kali recovery Docker Desktop..."
        $RestartProbe = Invoke-DockerNative -Arguments @("desktop", "restart", "--timeout", "120")
        if ($RestartProbe.ExitCode -eq 0) {
            for ($Attempt = 1; $Attempt -le 12; $Attempt++) {
                Start-Sleep -Seconds 5
                $EngineProbe = Invoke-DockerNative -Arguments @("info", "--format", "{{json .ServerVersion}}")
                $EngineProbeOutput = @($EngineProbe.Output)
                $EngineExitCode = $EngineProbe.ExitCode
                if ($EngineExitCode -eq 0) {
                    $EngineReady = $true
                    break
                }
            }
        }
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
            "",
            "Recovery otomatis sudah dicoba satu kali.",
            "Perbaikan manual:",
            "  1. docker desktop status",
            "  2. docker desktop restart",
            "  3. docker info",
            "  4. Jalankan lagi .\up.ps1 ... -Build",
            "",
            "Gunakan -NoDockerEngineRepair bila restart otomatis tidak diinginkan.",
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
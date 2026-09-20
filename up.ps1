[CmdletBinding()]
param(
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development",

    [string[]]$Profile = @(),
    [string[]]$Services = @(),

    # Compatibility aliases: some Windows shells/users type "-Buildclear"
    # as a single rebuild flag. It means the same thing as "-Build" and
    # does not delete containers or database volumes.
    [Alias("Buildclear")]
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
# Docker Compose writes normal progress/status to native stderr. PowerShell 7.4+ can
# promote native non-zero exits through this preference, which would turn redirected
# Compose progress into NativeCommandError under ErrorActionPreference=Stop. Keep
# native command exit codes under explicit launcher control instead.
Set-Variable -Name PSNativeCommandUseErrorActionPreference -Value $false -Scope Local
Set-StrictMode -Version Latest

if ($Down -and ($Build -or $Pull -or $Fresh)) {
    throw "Parameter -Down tidak dapat digabung dengan -Build, -Pull, atau -Fresh. Jalankan aksi tersebut secara terpisah."
}

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PreviousComposeParallelLimit = $env:COMPOSE_PARALLEL_LIMIT
$PreviousComposeBake = $env:COMPOSE_BAKE
$PreviousComposeProgress = $env:COMPOSE_PROGRESS
$PreviousComposeStatusStdout = $env:COMPOSE_STATUS_STDOUT
$PreviousComposeAnsi = $env:COMPOSE_ANSI
Push-Location $RepoRoot

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI tidak ditemukan. Install/start Docker Desktop atau Docker Engine terlebih dahulu."
    }

    # Docker Compose can delegate multi-service builds to Buildx Bake. Bake
    # intentionally runs targets concurrently, which is exactly what causes
    # Docker Desktop's Linux engine to become unstable on this 22-image stack.
    # Keep the launcher on the regular Compose builder and plain progress output.
    $env:COMPOSE_BAKE = "false"
    $env:COMPOSE_PROGRESS = "plain"
    $env:COMPOSE_STATUS_STDOUT = "false"
    $env:COMPOSE_ANSI = "never"

    function Invoke-DockerNative {
        param(
            [Parameter(Mandatory = $true)]
            [string[]]$Arguments
        )

        # Docker Compose intentionally writes its normal BuildKit progress to
        # native stderr. Merging stderr with stdout (2>&1) makes PowerShell
        # render ordinary Compose progress as NativeCommandError records.
        # Capture the two streams separately, then return plain strings so the
        # launcher can decide whether a failure is real from the exit code.
        $StderrPath = [System.IO.Path]::GetTempFileName()
        try {
            $PreviousErrorActionPreference = $ErrorActionPreference
            $Stdout = @()
            $ExitCode = 1
            try {
                $ErrorActionPreference = "Continue"
                $Stdout = @(& docker @Arguments 1> $StderrPath)
                $ExitCode = $LASTEXITCODE
            }
            finally {
                $ErrorActionPreference = $PreviousErrorActionPreference
            }

            $Stderr = @()
            if (Test-Path -LiteralPath $StderrPath) {
                $RawStderr = Get-Content -Raw -LiteralPath $StderrPath
                if (-not [string]::IsNullOrEmpty($RawStderr)) {
                    $Stderr = @($RawStderr -split "\r?\n" | Where-Object { $_ -ne "" })
                }
            }

            [pscustomobject]@{
                ExitCode = $ExitCode
                Output = @($Stdout) + @($Stderr)
                Stdout = @($Stdout)
                Stderr = @($Stderr)
            }
        }
        finally {
            Remove-Item -LiteralPath $StderrPath -Force -ErrorAction SilentlyContinue
        }
    }

    function Get-DockerComposeConfigJson {
        param(
            [Parameter(Mandatory = $true)]
            [string[]]$ComposeArguments
        )

        # Compose's config JSON must remain pure stdout. Invoke-DockerNative
        # intentionally merges stderr into stdout for normal diagnostics, so use
        # a dedicated stderr file here and parse stdout directly.
        $StderrPath = [System.IO.Path]::GetTempFileName()
        try {
            $PreviousErrorActionPreference = $ErrorActionPreference
            $Stdout = @()
            $ExitCode = 1
            try {
                $ErrorActionPreference = "Continue"
                $Stdout = @(& docker @ComposeArguments config --format json 2> $StderrPath)
                $ExitCode = $LASTEXITCODE
            }
            finally {
                $ErrorActionPreference = $PreviousErrorActionPreference
            }

            $Stderr = ""
            if (Test-Path -LiteralPath $StderrPath) {
                $Stderr = Get-Content -Raw -LiteralPath $StderrPath
            }

            [pscustomobject]@{
                ExitCode = $ExitCode
                Json = ($Stdout -join [Environment]::NewLine)
                Error = $Stderr
                Output = @($Stdout) + @($Stderr)
            }
        }
        finally {
            Remove-Item -LiteralPath $StderrPath -Force -ErrorAction SilentlyContinue
        }
    }

    $DockerRecoveryState = [pscustomobject]@{
        Attempted = $false
        AttemptCount = 0
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

    function Test-DockerResourceFailure {
        param(
            [Parameter(Mandatory = $true)]
            [string]$OutputText
        )

        return (
            $OutputText -match "(?i)out of memory" -or
            $OutputText -match "(?i)cannot allocate memory" -or
            $OutputText -match "(?i)no space left on device" -or
            $OutputText -match "(?i)signal: killed" -or
            $OutputText -match "(?i)process .* killed" -or
            $OutputText -match "(?i)ENOSPC"
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

        if ($DockerRecoveryState.AttemptCount -ge 4) {
            return $false
        }

        if (-not $DockerDesktopCliAvailable) {
            $DockerRecoveryState.Reason = "docker-desktop-cli-unavailable"
            return $false
        }

        $DockerRecoveryState.Attempted = $true
        $DockerRecoveryState.AttemptCount++
        $DockerRecoveryState.Reason = $Reason
        Write-Warning "Docker Engine gagal pada saat $Reason. Mencoba bounded recovery Docker Desktop (attempt $($DockerRecoveryState.AttemptCount)/4)..."

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

    $ComposeVersionProbe = Invoke-DockerNative -Arguments @("compose", "version")
    if ($ComposeVersionProbe.ExitCode -ne 0) {
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

    $ComposeModelProbe = Get-DockerComposeConfigJson -ComposeArguments $ComposeArgs
    if ($ComposeModelProbe.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($ComposeModelProbe.Json)) {
        $ComposeModelError = ($ComposeModelProbe.Error -join " ").Trim()
        if ($ComposeModelError.Length -gt 2000) {
            $ComposeModelError = $ComposeModelError.Substring(0, 2000)
        }
        throw "Gagal membuat model Docker Compose untuk validasi runtime. $ComposeModelError"
    }
    $ComposeModel = $ComposeModelProbe.Json
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
        $BuildTargets = @()
        if ($Services.Count -gt 0) {
            $BuildTargets = @($Services)
        }
        else {
            # Resolve only services that define build sections. Building one
            # service per Compose invocation avoids opening the entire BuildKit
            # graph against Docker Desktop at once.
            $ServiceProbe = Get-DockerComposeConfigJson -ComposeArguments $ComposeArgs
            if ($ServiceProbe.ExitCode -ne 0) {
                $ServiceProbeText = ($ServiceProbe.Output -join [Environment]::NewLine)
                if (Test-DockerEngineFailure -OutputText $ServiceProbeText) {
                    if (-not (Invoke-DockerEngineRecovery -Reason "resolve build services")) {
                        throw "Docker Engine tidak sehat saat menentukan service build."
                    }
                    $ServiceProbe = Get-DockerComposeConfigJson -ComposeArguments $ComposeArgs
                }
            }
            if ($ServiceProbe.ExitCode -ne 0) {
                throw "Docker Compose gagal membaca daftar service build sebelum build dimulai."
            }
            try {
                if ([string]::IsNullOrWhiteSpace($ServiceProbe.Json)) {
                    $Diagnostic = ($ServiceProbe.Error -join " ").Trim()
                    throw "Compose menghasilkan JSON kosong. $Diagnostic"
                }

                # Do not parse the merged Compose JSON with ConvertFrom-Json here.
                # Large Compose models are not reliably handled across the
                # PowerShell/JSON runtime versions used by Windows developers.
                # Python already owns the repository's JSON contract validation,
                # so use the same runtime to extract build-capable services.
                $BuildTargetOutput = @(
                    $ServiceProbe.Json |
                        & $PythonCommand.Source "scripts/config/compose_build_targets.py" 2>&1
                )
                $BuildTargetExitCode = $LASTEXITCODE
                if ($BuildTargetExitCode -ne 0) {
                    $Diagnostic = (($BuildTargetOutput | ForEach-Object { "$_" }) -join " ").Trim()
                    if ($Diagnostic.Length -gt 1500) {
                        $Diagnostic = $Diagnostic.Substring(0, 1500)
                    }
                    throw "Python gagal menentukan service build (exit $BuildTargetExitCode). $Diagnostic"
                }

                $BuildTargets = @(
                    $BuildTargetOutput |
                        ForEach-Object { "$_".Trim() } |
                        Where-Object { $_ }
                )
            }
            catch {
                $Diagnostic = ($ServiceProbe.Error -join " ").Trim()
                if ($Diagnostic.Length -gt 1000) {
                    $Diagnostic = $Diagnostic.Substring(0, 1000)
                }
                throw "Konfigurasi Compose tidak dapat menentukan service build secara deterministik. $($_.Exception.Message) $Diagnostic"
            }
        }

        if ($BuildTargets.Count -eq 0) {
            Write-Host "Tidak ada service build yang dipilih; melewati tahap image build." -ForegroundColor Yellow
        }
        else {
            Write-Host "Building Docker images in adaptive batches (Bake disabled, cache-friendly)..." -ForegroundColor Cyan
            $BuildOriginalParallelLimit = $env:COMPOSE_PARALLEL_LIMIT

            # Do not force every service through a separate Compose invocation.
            # That is stable but unnecessarily slow when Docker/BuildKit already
            # has warm cache layers. Build a bounded batch in one invocation so
            # independent services can progress concurrently, while keeping a
            # deterministic upper bound on Docker Engine pressure.
            $AdaptiveLimit = $ParallelLimit
            try {
                $HostCpu = [Environment]::ProcessorCount
                $HostRamGb = 0
                try {
                    $ComputerSystem = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
                    $HostRamGb = [math]::Floor([double]$ComputerSystem.TotalPhysicalMemory / 1GB)
                }
                catch {
                    $HostRamGb = 0
                }

                if ($ParallelLimit -eq 1) {
                    $AdaptiveLimit = 1
                }
                elseif ($HostRamGb -gt 0 -and $HostRamGb -le 8) {
                    $AdaptiveLimit = 1
                }
                elseif ($HostRamGb -gt 0 -and $HostRamGb -le 16) {
                    $AdaptiveLimit = [math]::Min($ParallelLimit, 2)
                }
                elseif ($HostCpu -le 4) {
                    $AdaptiveLimit = [math]::Min($ParallelLimit, 2)
                }
                else {
                    $AdaptiveLimit = [math]::Min($ParallelLimit, 4)
                }

                $env:COMPOSE_PARALLEL_LIMIT = $AdaptiveLimit.ToString()
                Write-Host "Adaptive build parallelism: $AdaptiveLimit (host CPU=$HostCpu, RAM=$HostRamGb GB, requested=$ParallelLimit)" -ForegroundColor DarkGray

                for ($BatchStart = 0; $BatchStart -lt $BuildTargets.Count; $BatchStart += $AdaptiveLimit) {
                    $Batch = @(
                        $BuildTargets |
                            Select-Object -Skip $BatchStart -First $AdaptiveLimit
                    )
                    $BatchLabel = $Batch -join ", "
                    Write-Host "Building batch [$BatchLabel]..." -ForegroundColor Cyan

                    $PreBuildProbe = Invoke-DockerNative -Arguments @("info", "--format", "{{json .ServerVersion}}")
                    if ($PreBuildProbe.ExitCode -ne 0) {
                        if (-not (Invoke-DockerEngineRecovery -Reason "pre-build batch [$BatchLabel]")) {
                            $Details = ($PreBuildProbe.Output -join " ").Trim()
                            throw "Docker Engine tidak sehat sebelum build batch [$BatchLabel]: $Details"
                        }
                    }

                    $BatchBuildArgs = @("build") + $Batch
                    $BatchBuildProbe = Invoke-DockerNative -Arguments (@($ComposeArgs) + $BatchBuildArgs)
                    $BatchBuildOutput = @($BatchBuildProbe.Output)
                    $BatchBuildOutput | ForEach-Object { Write-Output $_ }

                    if ($BatchBuildProbe.ExitCode -eq 0) {
                        Write-Host "Build batch completed: $BatchLabel" -ForegroundColor Green
                        continue
                    }

                    $BatchBuildText = ($BatchBuildOutput -join [Environment]::NewLine)
                    $EngineFailure = Test-DockerEngineFailure -OutputText $BatchBuildText
                    $PostBuildProbe = Invoke-DockerNative -Arguments @("info", "--format", "{{json .ServerVersion}}")
                    if ($PostBuildProbe.ExitCode -ne 0) {
                        $EngineFailure = $true
                    }

                    if ($EngineFailure) {
                        Write-Warning "Parallel build batch [$BatchLabel] hit a Docker Engine failure. Recovering and retrying this batch sequentially..."
                        if (-not (Invoke-DockerEngineRecovery -Reason "parallel build batch [$BatchLabel]")) {
                            throw "Docker Engine gagal saat build batch [$BatchLabel] dan recovery tidak berhasil."
                        }

                        # Recovery fallback is intentionally sequential. It isolates
                        # the failing service and prevents a second concurrent storm.
                        $env:COMPOSE_PARALLEL_LIMIT = "1"
                        foreach ($ServiceName in $Batch) {
                            $ServiceBuildSucceeded = $false
                            for ($ServiceAttempt = 1; $ServiceAttempt -le 3; $ServiceAttempt++) {
                                Write-Host "Retrying service [$ServiceName] (attempt $ServiceAttempt/3)..." -ForegroundColor Yellow
                                $ServiceBuildProbe = Invoke-DockerNative -Arguments (@($ComposeArgs) + @("build", $ServiceName))
                                $ServiceBuildProbe.Output | ForEach-Object { Write-Output $_ }

                                if ($ServiceBuildProbe.ExitCode -eq 0) {
                                    $ServiceBuildSucceeded = $true
                                    Write-Host "Service [$ServiceName] image build completed." -ForegroundColor Green
                                    break
                                }

                                $ServiceBuildText = ($ServiceBuildProbe.Output -join [Environment]::NewLine)
                                $RetryEngineFailure = Test-DockerEngineFailure -OutputText $ServiceBuildText
                                $RetryProbe = Invoke-DockerNative -Arguments @("info", "--format", "{{json .ServerVersion}}")
                                if ($RetryProbe.ExitCode -ne 0) {
                                    $RetryEngineFailure = $true
                                }

                                if ($RetryEngineFailure -and $ServiceAttempt -lt 3) {
                                    if (Invoke-DockerEngineRecovery -Reason "retry build service $ServiceName") {
                                        continue
                                    }
                                }

                                throw "Docker Compose build gagal pada service '$ServiceName' (exit code $($ServiceBuildProbe.ExitCode)). Periksa error build di atas."
                            }

                            if (-not $ServiceBuildSucceeded) {
                                throw "Service '$ServiceName' tidak berhasil dibangun setelah recovery attempts."
                            }
                        }

                        $env:COMPOSE_PARALLEL_LIMIT = $AdaptiveLimit.ToString()
                    }
                    elseif (Test-DockerResourceFailure -OutputText $BatchBuildText -and $AdaptiveLimit -gt 1) {
                        # Resource exhaustion is different from a broken Dockerfile.
                        # Do not restart Desktop; reduce concurrency and retry only
                        # the same batch. This keeps the fast path fast while giving
                        # smaller machines a deterministic safety valve.
                        $ReducedLimit = [math]::Max(1, [math]::Floor($AdaptiveLimit / 2))
                        Write-Warning "Build batch [$BatchLabel] terlihat kehabisan resource. Menurunkan paralelisme $AdaptiveLimit -> $ReducedLimit dan mengulang batch..."
                        $AdaptiveLimit = $ReducedLimit
                        $env:COMPOSE_PARALLEL_LIMIT = $AdaptiveLimit.ToString()

                        $RetryBatchArgs = @("build") + $Batch
                        $RetryBatchProbe = Invoke-DockerNative -Arguments (@($ComposeArgs) + $RetryBatchArgs)
                        $RetryBatchProbe.Output | ForEach-Object { Write-Output $_ }

                        if ($RetryBatchProbe.ExitCode -ne 0) {
                            $RetryText = ($RetryBatchProbe.Output -join [Environment]::NewLine)
                            if (Test-DockerResourceFailure -OutputText $RetryText -and $AdaptiveLimit -gt 1) {
                                $AdaptiveLimit = 1
                                $env:COMPOSE_PARALLEL_LIMIT = "1"
                                Write-Warning "Resource masih penuh; retry terakhir batch [$BatchLabel] dengan paralelisme 1..."
                                $FinalRetryProbe = Invoke-DockerNative -Arguments (@($ComposeArgs) + $RetryBatchArgs)
                                $FinalRetryProbe.Output | ForEach-Object { Write-Output $_ }
                                if ($FinalRetryProbe.ExitCode -ne 0) {
                                    throw "Docker Compose build gagal pada batch [$BatchLabel] setelah fallback resource-safe ke paralelisme 1."
                                }
                            }
                            else {
                                throw "Docker Compose build gagal pada batch [$BatchLabel] setelah penurunan paralelisme. Periksa error build di atas."
                            }
                        }
                        else {
                            Write-Host "Build batch completed after resource-safe fallback: $BatchLabel" -ForegroundColor Green
                        }
                    }
                    else {
                        # A normal application/Dockerfile/package error should not
                        # trigger a Docker Desktop restart or hide the real failure.
                        throw "Docker Compose build gagal pada batch [$BatchLabel] (exit code $($BatchBuildProbe.ExitCode)). Periksa error build di atas."
                    }
                }
            }
            finally {
                $env:COMPOSE_PARALLEL_LIMIT = $BuildOriginalParallelLimit
            }

            Write-Host "Docker image build completed successfully for $($BuildTargets.Count) services." -ForegroundColor Green
        }
    }

    $UpArgs = @("up", "-d", "--remove-orphans", "--wait", "--wait-timeout", "420")
    if ($Build.IsPresent) {
        # A freshly built image must never keep running behind a stale container
        # health state. Volumes remain preserved; only service containers are recreated.
        $UpArgs += "--force-recreate"
        $UpArgs += "--no-build"
    }
    if ($Services.Count -gt 0) {
        $UpArgs += $Services
    }

    Write-Host "Starting Docker Compose services..." -ForegroundColor Cyan
    $UpPreviousErrorActionPreference = $ErrorActionPreference
    $UpExitCode = 1
    try {
        $ErrorActionPreference = "Continue"
        & docker @ComposeArgs @UpArgs
        $UpExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $UpPreviousErrorActionPreference
    }

    if ($UpExitCode -ne 0) {
        $UpProbe = Invoke-DockerNative -Arguments @("info", "--format", "{{json .ServerVersion}}")
        $DockerEngineFailure = $UpProbe.ExitCode -ne 0

        if ($DockerEngineFailure) {
            $OriginalParallelLimit = $env:COMPOSE_PARALLEL_LIMIT
            if (Invoke-DockerEngineRecovery -Reason "Compose up") {
                Write-Warning "Mengulangi Compose up dengan paralelisme 1 setelah Docker Engine recovery..."
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
    }

    if ($UpExitCode -ne 0) {
        Write-Warning "Docker Compose startup gagal (exit code $UpExitCode). Menampilkan status dan log core service."
        & docker @ComposeArgs ps -a
        & docker @ComposeArgs logs --no-color --tail 120 domain_db_bootstrap domain_db marketplace_service chat_service identity_service community_service
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
    if ($null -eq $PreviousComposeBake) {
        Remove-Item Env:COMPOSE_BAKE -ErrorAction SilentlyContinue
    }
    else {
        $env:COMPOSE_BAKE = $PreviousComposeBake
    }
    if ($null -eq $PreviousComposeProgress) {
        Remove-Item Env:COMPOSE_PROGRESS -ErrorAction SilentlyContinue
    }
    else {
        $env:COMPOSE_PROGRESS = $PreviousComposeProgress
    }
    if ($null -eq $PreviousComposeStatusStdout) {
        Remove-Item Env:COMPOSE_STATUS_STDOUT -ErrorAction SilentlyContinue
    }
    else {
        $env:COMPOSE_STATUS_STDOUT = $PreviousComposeStatusStdout
    }
    if ($null -eq $PreviousComposeAnsi) {
        Remove-Item Env:COMPOSE_ANSI -ErrorAction SilentlyContinue
    }
    else {
        $env:COMPOSE_ANSI = $PreviousComposeAnsi
    }
    if ($null -eq $PreviousComposeParallelLimit) {
        Remove-Item Env:COMPOSE_PARALLEL_LIMIT -ErrorAction SilentlyContinue
    }
    else {
        $env:COMPOSE_PARALLEL_LIMIT = $PreviousComposeParallelLimit
    }
    Pop-Location
}
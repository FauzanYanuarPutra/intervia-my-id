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

    function Get-DockerComposeConfigJson {
        param(
            [Parameter(Mandatory = $true)]
            [string[]]$ComposeArguments
        )

        # Keep structured Compose JSON completely separate from status/progress
        # streams. Compose supports --output for config specifically so JSON is
        # written to a file instead of being mixed with diagnostic output.
        $TempPath = [System.IO.Path]::GetTempFileName()
        try {
            $ConfigProbe = Invoke-DockerNative -Arguments (@($ComposeArguments) + @("config", "--format", "json", "--output", $TempPath))
            $JsonText = ""
            if (Test-Path -LiteralPath $TempPath) {
                $JsonText = Get-Content -Raw -LiteralPath $TempPath
            }
            [pscustomobject]@{
                ExitCode = $ConfigProbe.ExitCode
                Output = @($ConfigProbe.Output)
                Json = $JsonText
            }
        }
        finally {
            Remove-Item -LiteralPath $TempPath -Force -ErrorAction SilentlyContinue
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
    if ($ComposeModelProbe.ExitCode -ne 0) {
        $ComposeModelError = ($ComposeModelProbe.Output -join [Environment]::NewLine).Trim()
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
                $ResolvedCompose = $ServiceProbe.Json | ConvertFrom-Json
                $BuildTargets = @(
                    $ResolvedCompose.services.psobject.Properties |
                        Where-Object { $null -ne $_.Value.build } |
                        ForEach-Object { $_.Name }
                )
            }
            catch {
                throw "Konfigurasi Compose tidak dapat diparse untuk menentukan service build."
            }
        }

        if ($BuildTargets.Count -eq 0) {
            Write-Host "Tidak ada service build yang dipilih; melewati tahap image build." -ForegroundColor Yellow
        }
        else {
            Write-Host "Building Docker images service-by-service (Bake disabled, deterministic mode)..." -ForegroundColor Cyan
            $BuildOriginalParallelLimit = $env:COMPOSE_PARALLEL_LIMIT
            $env:COMPOSE_PARALLEL_LIMIT = "1"
            Write-Host "Compose build parallelism: 1" -ForegroundColor DarkGray

            try {
                foreach ($ServiceName in $BuildTargets) {
                    $ServiceBuilt = $false
                    for ($ServiceAttempt = 1; $ServiceAttempt -le 3; $ServiceAttempt++) {
                        $PreBuildProbe = Invoke-DockerNative -Arguments @("info", "--format", "{{json .ServerVersion}}")
                        if ($PreBuildProbe.ExitCode -ne 0) {
                            if (-not (Invoke-DockerEngineRecovery -Reason "pre-build $ServiceName")) {
                                $Details = ($PreBuildProbe.Output -join " ").Trim()
                                throw "Docker Engine tidak sehat sebelum build service '$ServiceName': $Details"
                            }
                        }

                        Write-Host "Building service [$ServiceName] (attempt $ServiceAttempt/3)..." -ForegroundColor Cyan
                        $ServiceBuildArgs = @("build", $ServiceName)
                        $ServiceBuildProbe = Invoke-DockerNative -Arguments (@($ComposeArgs) + $ServiceBuildArgs)
                        $ServiceBuildOutput = @($ServiceBuildProbe.Output)
                        $ServiceBuildExitCode = $ServiceBuildProbe.ExitCode
                        $ServiceBuildOutput | ForEach-Object { Write-Output $_ }

                        if ($ServiceBuildExitCode -eq 0) {
                            $ServiceBuilt = $true
                            Write-Host "Service [$ServiceName] image build completed." -ForegroundColor Green
                            break
                        }

                        $ServiceBuildText = ($ServiceBuildOutput -join [Environment]::NewLine)
                        $EngineFailure = Test-DockerEngineFailure -OutputText $ServiceBuildText
                        $PostBuildProbe = Invoke-DockerNative -Arguments @("info", "--format", "{{json .ServerVersion}}")
                        if ($PostBuildProbe.ExitCode -ne 0) {
                            $EngineFailure = $true
                        }

                        if ($EngineFailure -and $ServiceAttempt -lt 3) {
                            if (Invoke-DockerEngineRecovery -Reason "build service $ServiceName") {
                                Write-Warning "Docker Engine dipulihkan; mengulang build service [$ServiceName]..."
                                continue
                            }
                        }

                        throw "Docker Compose build gagal pada service '$ServiceName' (exit code $ServiceBuildExitCode). Periksa error build di atas."
                    }

                    if (-not $ServiceBuilt) {
                        throw "Service '$ServiceName' tidak berhasil dibangun setelah recovery attempts."
                    }
                }
            }
            finally {
                $env:COMPOSE_PARALLEL_LIMIT = $BuildOriginalParallelLimit
            }

            Write-Host "Docker image build completed successfully for $($BuildTargets.Count) services." -ForegroundColor Green
        }
    }

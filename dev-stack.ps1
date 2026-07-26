param(
    [ValidateSet("up", "fresh", "nuke")]
    [string]$Action = "up",
    [string]$EnvFile = ".env.development",
    [switch]$BuildAll,
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$StorageEnvScript = Join-Path $PSScriptRoot "scripts\use-d-drive-env.ps1"
if (Test-Path -LiteralPath $StorageEnvScript) {
    . $StorageEnvScript -Quiet
}

$runner = Join-Path $PSScriptRoot "up-super-fast.ps1"
$stateFile = Join-Path $PSScriptRoot ".docker-build-state.json"

if (-not (Test-Path $runner)) {
    throw "Script not found: $runner"
}

if (-not (Test-Path $EnvFile)) {
    if ($EnvFile -eq ".env.development" -and (Test-Path ".env")) {
        $EnvFile = ".env"
    } else {
        throw "Env file not found: $EnvFile"
    }
}

function Invoke-Docker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    & docker @Args
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

function Invoke-ProjectCompose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ComposeArgs
    )

    Invoke-Docker -Args (@("compose", "--env-file", $EnvFile) + $ComposeArgs) -FailureMessage "Compose command failed: $($ComposeArgs -join ' ')"
}

switch ($Action) {
    "fresh" {
        Write-Host "Cleaning dev containers and unused Docker build cache..." -ForegroundColor Yellow
        Invoke-ProjectCompose -ComposeArgs @("down", "--remove-orphans")
        Invoke-Docker -Args @("builder", "prune", "-af") -FailureMessage "Failed to prune Docker build cache."
        Invoke-Docker -Args @("image", "prune", "-f") -FailureMessage "Failed to prune dangling Docker images."
    }
    "nuke" {
        Write-Host "Removing dev containers, project volumes, and unused Docker cache..." -ForegroundColor Yellow
        Invoke-ProjectCompose -ComposeArgs @("down", "-v", "--remove-orphans")
        if (Test-Path $stateFile) {
            Remove-Item -LiteralPath $stateFile -Force
        }
        Invoke-Docker -Args @("builder", "prune", "-af") -FailureMessage "Failed to prune Docker build cache."
        Invoke-Docker -Args @("image", "prune", "-f") -FailureMessage "Failed to prune dangling Docker images."
    }
}

$runArgs = @{
    Mode    = "dev"
    EnvFile = $EnvFile
}

if ($BuildAll) {
    $runArgs.BuildAll = $true
}

if ($NoBuild) {
    $runArgs.NoBuild = $true
}

& $runner @runArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

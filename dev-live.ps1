param(
    [ValidateSet("www", "usaha", "cms", "crm")]
    [string]$App = "www",
    [string]$EnvFile = ".env.development",
    [switch]$NoInstall,
    [switch]$FullStack
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$runner = Join-Path $PSScriptRoot "up-super-fast.ps1"
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

function Test-ComposeV2 {
    try {
        & docker compose version *> $null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Invoke-ComposeQuiet {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    if (Test-ComposeV2) {
        & docker compose --env-file $EnvFile @Args *> $null
    } else {
        & docker-compose --env-file $EnvFile @Args *> $null
    }
}

function Import-EnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
            continue
        }

        $separator = $trimmed.IndexOf("=")
        if ($separator -le 0) {
            continue
        }

        $name = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1)

        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

$coreServices = @(
    "postgres_db",
    "redis_cache",
    "rabbitmq",
    "meilisearch",
    "identity_service",
    "marketplace_service",
    "community_service",
    "mailhog"
)

if ($FullStack) {
    $coreServices += @("scylla_db", "scylla_keyspace_setup", "chat_service")
}

Write-Host "Starting core containers for live dev..." -ForegroundColor Cyan
& $runner -Mode dev -EnvFile $EnvFile -NoBuild -Services $coreServices
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Invoke-ComposeQuiet -Args @("rm", "-sf", $App)

Import-EnvFile -Path $EnvFile

$appPath = switch ($App) {
    "www" { Join-Path $PSScriptRoot "frontend\\www" }
    "usaha" { Join-Path $PSScriptRoot "frontend\\usaha" }
    "cms" { Join-Path $PSScriptRoot "frontend\\cms" }
    "crm" { Join-Path $PSScriptRoot "frontend\\crm" }
}

$port = switch ($App) {
    "www" { "3000" }
    "usaha" { "3003" }
    "cms" { "3001" }
    "crm" { "3002" }
}

$env:NODE_ENV = "development"
$env:PORT = $port
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:NEXT_PUBLIC_APP_URL = "http://localhost:$port"
$env:NEXT_PUBLIC_API_URL = if ($env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL } else { "http://localhost:8080" }
$env:INTERNAL_API_URL = if ($env:INTERNAL_API_URL) { $env:INTERNAL_API_URL } else { "http://localhost:8080" }

if ($App -eq "www") {
    $env:NEXT_PUBLIC_MARKETPLACE_URL = if ($env:NEXT_PUBLIC_MARKETPLACE_URL) { $env:NEXT_PUBLIC_MARKETPLACE_URL } else { "http://localhost:8081" }
    $env:INTERNAL_MARKETPLACE_URL = if ($env:INTERNAL_MARKETPLACE_URL) { $env:INTERNAL_MARKETPLACE_URL } else { "http://localhost:8081" }
    $env:MARKETPLACE_URL = if ($env:MARKETPLACE_URL) { $env:MARKETPLACE_URL } else { "http://localhost:8081" }
    $env:INTERNAL_CHAT_URL = if ($env:INTERNAL_CHAT_URL) { $env:INTERNAL_CHAT_URL } else { "http://localhost:4000" }
}

if ($App -eq "usaha") {
    $env:NEXT_PUBLIC_WWW_URL = if ($env:NEXT_PUBLIC_WWW_URL) { $env:NEXT_PUBLIC_WWW_URL } else { "http://localhost:3000" }
    $env:NEXT_PUBLIC_USAHA_URL = if ($env:NEXT_PUBLIC_USAHA_URL) { $env:NEXT_PUBLIC_USAHA_URL } else { "http://localhost:3003" }
}

if ($App -eq "crm") {
    $env:NEXT_PUBLIC_MARKETPLACE_URL = if ($env:NEXT_PUBLIC_MARKETPLACE_URL) { $env:NEXT_PUBLIC_MARKETPLACE_URL } else { "http://localhost:8081" }
    $env:INTERNAL_CHAT_URL = if ($env:INTERNAL_CHAT_URL) { $env:INTERNAL_CHAT_URL } else { "http://localhost:4000" }
}

if (-not $NoInstall -and -not (Test-Path (Join-Path $appPath "node_modules"))) {
    Write-Host "Installing npm dependencies for $App..." -ForegroundColor Cyan
    Push-Location $appPath
    try {
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed in $appPath"
        }
    } finally {
        Pop-Location
    }
}

Write-Host "Starting $App live dev server on http://localhost:$port" -ForegroundColor Green
if ($FullStack) {
    Write-Host "Full stack mode enabled, including chat/scylla containers." -ForegroundColor DarkGray
}

Push-Location $appPath
try {
    npm run dev
    exit $LASTEXITCODE
} finally {
    Pop-Location
}

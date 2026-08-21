param(
    [ValidateSet("dev", "prod")]
    [string]$Mode = "dev",
    [string]$EnvFile = ".env.development",
    [switch]$BuildAll,
    [switch]$NoBuild,
    [switch]$PullLatest,
    [switch]$SkipCleanup,
    [switch]$WithAi,
    [switch]$NoAi,
    [switch]$PullAiModels,
    [switch]$SkipAiModels,
    [switch]$SkipAiWarmup,
    [switch]$AiTextOnly,
    [switch]$SkipBackup,
    [int]$BackupIntervalHours = 1,
    [int]$BackupRetentionDays = 7,
    [switch]$NoTunnel,
    [switch]$NoEdge,
    [string]$AiBusinessModel = "qwen3:4b",
    [string]$AiVisionModel = "qwen3-vl:2b",
    [string[]]$Services
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$ScriptVersion = "2026.08.21-one-command-safe-3.0.0"
Write-Host "Lajukan up-super-fast $ScriptVersion" -ForegroundColor DarkGray
Write-Host "Safety mode: automatic backup + no named-volume deletion." -ForegroundColor DarkGray

# Compose source-of-truth:
# - development: lightweight standalone compose optimized for local work
# - production : base compose + production override
$DevComposeFile = "docker-compose.dev.yml"
$ProdComposeBaseFile = "docker-compose.yml"
$ProdComposeOverrideFile = "docker-compose.prod.yml"

$script:ComposeFileArgs = if ($Mode -eq "prod") {
    @("-f", $ProdComposeBaseFile, "-f", $ProdComposeOverrideFile)
}
else {
    @("-f", $DevComposeFile)
}

if ($Mode -eq "dev" -and -not (Test-Path -LiteralPath $DevComposeFile)) {
    throw "Development Compose file not found: $DevComposeFile"
}

# Resolve the env source before profile/backup logic. Keep the later guard as a
# second safety check.
if (-not (Test-Path -LiteralPath $EnvFile)) {
    if ($EnvFile -eq ".env.development" -and (Test-Path -LiteralPath ".env")) {
        $EnvFile = ".env"
    }
    else {
        throw "Env file not found: $EnvFile"
    }
}

$StorageEnvScript = Join-Path $PSScriptRoot "scripts\use-d-drive-env.ps1"
if (Test-Path -LiteralPath $StorageEnvScript) {
    . $StorageEnvScript -Quiet
}

if (-not $PSBoundParameters.ContainsKey('SkipCleanup')) {
    $SkipCleanup = $true
}

$RuntimeDir = Join-Path $PSScriptRoot ".runtime"
$StartupStateFile = Join-Path $RuntimeDir "stack-startup.json"

# Local recovery checkpoints. Workspace cleanup never touches this directory.
$BackupRoot = Join-Path $PSScriptRoot ".backups\up-super-fast"
$BackupLatestFile = Join-Path $BackupRoot "latest-success.json"
$script:LastBackupPath = ""

function Get-EnvFileValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*#') {
            continue
        }
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
            if ($matches[1] -ne $Name) {
                continue
            }
            $value = $matches[2].Trim()
            if (
                ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))
            ) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            return $value
        }
    }

    return $null
}

function Test-TruthyEnvValue {
    param([AllowNull()][string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }
    return $Value.Trim() -match '^(1|true|yes|on|enabled)$'
}

function Write-StartupState {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Active,
        [Parameter(Mandatory = $true)]
        [string]$Status,
        [Parameter(Mandatory = $true)]
        [string]$Phase,
        [string]$Message = "",
        [string[]]$ServiceNames = @()
    )

    if (-not (Test-Path $RuntimeDir)) {
        New-Item -ItemType Directory -Path $RuntimeDir -Force *> $null
    }

    $now = (Get-Date).ToString("o")
    $startedAt = $now
    if (Test-Path $StartupStateFile) {
        try {
            $existing = Get-Content $StartupStateFile -Raw | ConvertFrom-Json
            if ($existing.startedAt) {
                $startedAt = [string]$existing.startedAt
            }
        }
        catch {
            $startedAt = $now
        }
    }

    $state = @{
        active    = $Active
        status    = $Status
        phase     = $Phase
        message   = $Message
        script    = "up-super-fast.ps1"
        mode      = $Mode
        services  = @($ServiceNames)
        startedAt = $startedAt
        updatedAt = $now
    }

    $state | ConvertTo-Json -Depth 5 | Set-Content -Path $StartupStateFile -Encoding UTF8
}

trap {
    Write-StartupState -Active $false -Status "failed" -Phase "failed" -Message "$($_.Exception.Message)" -ServiceNames $selectedServices
    break
}

Write-StartupState -Active $true -Status "starting" -Phase "initializing" -Message "Preparing Docker startup." -ServiceNames $Services

$env:DOCKER_BUILDKIT = "1"
$env:COMPOSE_DOCKER_CLI_BUILD = "1"
$env:COMPOSE_PARALLEL_LIMIT = "6"
$env:BUILDKIT_PROGRESS = "plain"

$aiEnabled = $false
if ($Mode -eq "dev" -and -not $NoAi) {
    $aiEnabled = $true
}
if ($WithAi) {
    $aiEnabled = $true
}
if ($NoAi) {
    $aiEnabled = $false
}

$shouldPullAiModels = $aiEnabled -and -not $SkipAiModels
if ($PullAiModels) {
    $shouldPullAiModels = $true
}

# Compose profiles are rebuilt from stable config on every invocation.
# We intentionally do not inherit $env:COMPOSE_PROFILES from the previous run,
# because this script itself sets that process-level variable.
$profiles = @()

$profileSetting = Get-EnvFileValue -Path $EnvFile -Name "COMPOSE_PROFILES"
if ([string]::IsNullOrWhiteSpace($profileSetting)) {
    $profileSetting = $env:LAJUKAN_COMPOSE_PROFILES
}
if (-not [string]::IsNullOrWhiteSpace($profileSetting)) {
    $profiles += @(
        $profileSetting -split "," |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne "" }
    )
}

if ($aiEnabled -and $profiles -notcontains "ai") {
    $profiles += "ai"
}

# Cloudflare/Caddy are optional conveniences in local development.
# A configured tunnel token auto-enables them, but their readiness is never
# allowed to make the local core stack fail.
$cloudflareTunnelToken = $env:CLOUDFLARE_TUNNEL_TOKEN
if ([string]::IsNullOrWhiteSpace($cloudflareTunnelToken)) {
    $cloudflareTunnelToken = Get-EnvFileValue -Path $EnvFile -Name "CLOUDFLARE_TUNNEL_TOKEN"
}

if (-not $NoTunnel -and -not [string]::IsNullOrWhiteSpace($cloudflareTunnelToken)) {
    if ($profiles -notcontains "tunnel") {
        $profiles += "tunnel"
    }
}
if ($NoTunnel) {
    $profiles = @($profiles | Where-Object { $_ -ne "tunnel" })
}

if (-not $NoEdge -and $profiles -contains "tunnel" -and $profiles -notcontains "edge") {
    $profiles += "edge"
}
if ($NoEdge) {
    $profiles = @($profiles | Where-Object { $_ -ne "edge" })
}

$profiles = @($profiles | Select-Object -Unique)
$env:COMPOSE_PROFILES = ($profiles -join ",")

if ($profiles.Count -gt 0) {
    Write-Host "Compose profiles: $($profiles -join ', ')" -ForegroundColor DarkGray
}
else {
    Write-Host "Compose profiles: core only" -ForegroundColor DarkGray
}

$imageAiAssistSetting = $env:IMAGE_AI_ASSIST_ENABLED
if ([string]::IsNullOrWhiteSpace($imageAiAssistSetting)) {
    $imageAiAssistSetting = Get-EnvFileValue -Path $EnvFile -Name "IMAGE_AI_ASSIST_ENABLED"
}
if ([string]::IsNullOrWhiteSpace($imageAiAssistSetting)) {
    $imageAiAssistSetting = Get-EnvFileValue -Path $EnvFile -Name "NEXT_PUBLIC_IMAGE_AI_ASSIST_ENABLED"
}
$imageAiAssistEnabled = Test-TruthyEnvValue -Value $imageAiAssistSetting
if (-not $imageAiAssistEnabled -and -not $PSBoundParameters.ContainsKey('AiTextOnly')) {
    $AiTextOnly = $true
}
if (-not $imageAiAssistEnabled) {
    $env:IMAGE_AI_ASSIST_ENABLED = "false"
    $env:NEXT_PUBLIC_IMAGE_AI_ASSIST_ENABLED = "false"
}

$skipAiWarmupSetting = $env:SKIP_AI_WARMUP
if ([string]::IsNullOrWhiteSpace($skipAiWarmupSetting)) {
    $skipAiWarmupSetting = Get-EnvFileValue -Path $EnvFile -Name "SKIP_AI_WARMUP"
}
if (
    (Test-TruthyEnvValue -Value $skipAiWarmupSetting) -and
    -not $PSBoundParameters.ContainsKey('SkipAiWarmup')
) {
    $SkipAiWarmup = $true
}

if ($aiEnabled) {
    # Lajukan AI architecture:
    # www/other apps -> ai_service -> Ollama (OpenAI-compatible /v1)
    # Keep Ollama env vars for model lifecycle tooling, but do not make
    # frontend services bypass the Rust AI gateway by default.
    $env:USE_OLLAMA = "false"
    $env:INTERNAL_AI_URL = "http://ai_service:8080"

    $env:OLLAMA_URL = "http://ollama:11434"
    $env:OLLAMA_MODEL = $AiBusinessModel
    $env:OLLAMA_BUSINESS_MODEL = $AiBusinessModel

    $env:VLLM_URL = "http://ollama:11434/v1"
    $env:VLLM_MODEL = $AiBusinessModel
    $env:VLLM_STRUCTURED_MODEL = $AiBusinessModel
    $env:VLLM_KYC_MODEL = $AiBusinessModel
    $env:VLLM_VISION_MODEL = $AiVisionModel
    if ([string]::IsNullOrWhiteSpace($env:VLLM_REASONING_EFFORT)) {
        $env:VLLM_REASONING_EFFORT = "none"
    }

    if ([string]::IsNullOrWhiteSpace($env:AI_MAX_CONCURRENT)) {
        $env:AI_MAX_CONCURRENT = "1"
    }
    if ([string]::IsNullOrWhiteSpace($env:AI_MAX_OUTPUT_TOKENS)) {
        $env:AI_MAX_OUTPUT_TOKENS = "800"
    }
    if ([string]::IsNullOrWhiteSpace($env:OLLAMA_CONTEXT_LENGTH)) {
        $env:OLLAMA_CONTEXT_LENGTH = "4096"
    }
    if ([string]::IsNullOrWhiteSpace($env:OLLAMA_KEEP_ALIVE)) {
        $env:OLLAMA_KEEP_ALIVE = "5m"
    }
    if ([string]::IsNullOrWhiteSpace($env:OLLAMA_NUM_PARALLEL)) {
        $env:OLLAMA_NUM_PARALLEL = "1"
    }
    if ([string]::IsNullOrWhiteSpace($env:OLLAMA_MAX_LOADED_MODELS)) {
        $env:OLLAMA_MAX_LOADED_MODELS = "1"
    }
    if (-not $AiTextOnly) {
        $env:OLLAMA_VISION_MODEL = $AiVisionModel
        if ([string]::IsNullOrWhiteSpace($env:PERSONAL_AI_OLLAMA_VISION_MODELS)) {
            $env:PERSONAL_AI_OLLAMA_VISION_MODELS = "$AiVisionModel,qwen3-vl:4b"
        }
    }

    Write-Host "Local AI gateway enabled. ai_service -> Ollama. Business model: $AiBusinessModel" -ForegroundColor Cyan
    if ($shouldPullAiModels) {
        Write-Host "AI model check/pull is enabled. Existing models will be reused." -ForegroundColor Cyan
    }
    if (-not $AiTextOnly) {
        Write-Host "Vision model configured for photo assist: $AiVisionModel" -ForegroundColor Cyan
    }
    if (-not $SkipAiWarmup) {
        Write-Host "AI warmup enabled. Ollama keep-alive: $env:OLLAMA_KEEP_ALIVE" -ForegroundColor Cyan
    }
    else {
        Write-Host "AI warmup skipped. First AI request may be slower." -ForegroundColor Yellow
    }
    if ($AiTextOnly) {
        Write-Host "AI text-only mode enabled. Vision model pull/config is skipped." -ForegroundColor Yellow
    }
}

$composeV2Available = $false
$composeLegacyV1 = $false
try {
    & docker compose version *> $null
    if ($LASTEXITCODE -eq 0) {
        $composeV2Available = $true
    }
}
catch {
    $composeV2Available = $false
}

if (-not $composeV2Available) {
    try {
        $dockerComposeVersion = (& docker-compose version 2>$null | Out-String)
        if ($LASTEXITCODE -eq 0 -and $dockerComposeVersion -match '(^|\s)(docker-compose\s+)?version\s+1\.') {
            $composeLegacyV1 = $true
        }
    }
    catch {
        $composeLegacyV1 = $false
    }
}

if ($composeLegacyV1) {
    Write-Host "Legacy docker-compose v1 detected. Wrapper mode will avoid known recreate bugs where possible." -ForegroundColor Yellow
}

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $effectiveArgs = @($script:ComposeFileArgs) + @($Args)

    if ($composeV2Available) {
        & docker compose @effectiveArgs
    }
    else {
        & docker-compose @effectiveArgs
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Compose command failed: $($effectiveArgs -join ' ')"
    }
}

function Invoke-ComposeQuietExitCode {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $effectiveArgs = @($script:ComposeFileArgs) + @($Args)

    $previousErrorActionPreference = $ErrorActionPreference
    $nativePreference = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $previousNativePreference = $null

    try {
        $ErrorActionPreference = "Continue"
        if ($nativePreference) {
            $previousNativePreference = $PSNativeCommandUseErrorActionPreference
            $PSNativeCommandUseErrorActionPreference = $false
        }

        if ($composeV2Available) {
            & docker compose @effectiveArgs 1>$null 2>$null
        }
        else {
            & docker-compose @effectiveArgs 1>$null 2>$null
        }
        return $LASTEXITCODE
    }
    finally {
        if ($nativePreference) {
            $PSNativeCommandUseErrorActionPreference = $previousNativePreference
        }
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Invoke-ComposeUpResilient {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [int]$Attempts = 2,
        [int]$RetryDelaySeconds = 12
    )

    $lastMessage = ""
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            Invoke-Compose -Args $Args
            return
        }
        catch {
            $lastMessage = $_.Exception.Message
            if ($attempt -ge $Attempts) {
                throw
            }

            Write-Host "Compose start attempt $attempt/$Attempts has not settled yet. Waiting ${RetryDelaySeconds}s and retrying without deleting volumes..." -ForegroundColor Yellow
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }

    throw $lastMessage
}

function Ensure-MinIOBucket {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EnvFilePath
    )

    $bucketName = $env:MINIO_BUCKET
    if ([string]::IsNullOrWhiteSpace($bucketName)) {
        $bucketName = Get-EnvFileValue -Path $EnvFilePath -Name "MINIO_BUCKET"
    }
    if ([string]::IsNullOrWhiteSpace($bucketName)) {
        $bucketName = "laju-chat"
    }
    $bucketName = $bucketName.Trim()
    if (
        $bucketName.Length -lt 3 -or
        $bucketName.Length -gt 63 -or
        $bucketName -notmatch '^[a-z0-9][a-z0-9.-]*[a-z0-9]$'
    ) {
        throw "MINIO_BUCKET is invalid."
    }

    Write-Host "Ensuring MinIO bucket '$bucketName' exists..." -ForegroundColor Cyan
    $ready = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        $exitCode = Invoke-ComposeQuietExitCode -Args @(
            "--env-file", $EnvFilePath,
            "exec", "-T", "minio", "sh", "-lc",
            'mc alias set local http://localhost:9002 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1 && mc ready local >/dev/null 2>&1'
        )
        if ($exitCode -eq 0) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        throw "MinIO did not become ready for bucket initialization."
    }

    Invoke-Compose @(
        "--env-file", $EnvFilePath,
        "exec", "-T",
        "-e", "MINIO_TARGET_BUCKET=$bucketName",
        "minio", "sh", "-lc",
        'mc alias set local http://localhost:9002 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc mb --ignore-existing "local/$MINIO_TARGET_BUCKET" >/dev/null && mc stat "local/$MINIO_TARGET_BUCKET" >/dev/null'
    )
}

function Ensure-OllamaServiceRunning {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EnvFilePath
    )

    Write-Host "Ensuring Ollama service is running..." -ForegroundColor Cyan
    Invoke-Compose @("--env-file", $EnvFilePath, "up", "-d", "--no-build", "ollama")
}

function Wait-OllamaReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EnvFilePath
    )

    for ($attempt = 1; $attempt -le 20; $attempt++) {
        $exitCode = Invoke-ComposeQuietExitCode -Args @("--env-file", $EnvFilePath, "exec", "-T", "ollama", "ollama", "list")
        if ($exitCode -eq 0) {
            return
        }
        Start-Sleep -Seconds 2
    }

    throw "Ollama did not become ready in time."
}

function Pull-OllamaModel {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EnvFilePath,
        [Parameter(Mandatory = $true)]
        [string]$ModelName
    )

    if ([string]::IsNullOrWhiteSpace($ModelName)) {
        return
    }

    $showExitCode = Invoke-ComposeQuietExitCode -Args @("--env-file", $EnvFilePath, "exec", "-T", "ollama", "ollama", "show", $ModelName)
    if ($showExitCode -eq 0) {
        Write-Host "Ollama model already available: $ModelName" -ForegroundColor DarkGray
        return
    }

    Write-Host "Ensuring Ollama model is available: $ModelName" -ForegroundColor Cyan
    Invoke-Compose @("--env-file", $EnvFilePath, "exec", "-T", "ollama", "ollama", "pull", $ModelName)
}

function Warm-OllamaModel {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EnvFilePath,
        [Parameter(Mandatory = $true)]
        [string]$ModelName
    )

    if ([string]::IsNullOrWhiteSpace($ModelName)) {
        return
    }
    if ($ModelName -notmatch '^[A-Za-z0-9._:/-]+$') {
        Write-Host "Skipping Ollama warmup for invalid model name: $ModelName" -ForegroundColor Yellow
        return
    }

    Write-Host "Warming Ollama model: $ModelName (max 30s)" -ForegroundColor Cyan
    $warmupCommand = "timeout 30s ollama run '$ModelName' 'Jawab hanya OK.' >/dev/null 2>&1"
    $exitCode = Invoke-ComposeQuietExitCode -Args @(
        "--env-file", $EnvFilePath,
        "exec", "-T", "ollama",
        "sh", "-lc",
        $warmupCommand
    )
    if ($exitCode -eq 0) {
        Write-Host "Ollama model warmed: $ModelName" -ForegroundColor DarkGray
        return
    }

    Write-Host "Could not warm Ollama model: $ModelName. The first AI request may take longer." -ForegroundColor Yellow
}

function Configure-BuildBackend {
    $buildkitRequested = if ([string]::IsNullOrWhiteSpace($env:DOCKER_BUILDKIT)) { "1" } else { $env:DOCKER_BUILDKIT }
    $composeCliRequested = if ([string]::IsNullOrWhiteSpace($env:COMPOSE_DOCKER_CLI_BUILD)) { "1" } else { $env:COMPOSE_DOCKER_CLI_BUILD }

    if ($buildkitRequested -ne "1" -or $composeCliRequested -ne "1") {
        if ([string]::IsNullOrWhiteSpace($env:DOCKER_BUILDKIT)) { $env:DOCKER_BUILDKIT = "0" }
        if ([string]::IsNullOrWhiteSpace($env:COMPOSE_DOCKER_CLI_BUILD)) { $env:COMPOSE_DOCKER_CLI_BUILD = "0" }
        return
    }

    & docker buildx version *> $null
    if ($LASTEXITCODE -eq 0) {
        $env:DOCKER_BUILDKIT = "1"
        $env:COMPOSE_DOCKER_CLI_BUILD = "1"
        return
    }

    $env:DOCKER_BUILDKIT = "0"
    $env:COMPOSE_DOCKER_CLI_BUILD = "0"
    Write-Host "Docker BuildKit requested but docker buildx is unavailable. Falling back to the legacy builder." -ForegroundColor Yellow
}

Configure-BuildBackend

function Resolve-WorkspacePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $candidate = if ([System.IO.Path]::IsPathRooted($Path)) {
        $Path
    }
    else {
        Join-Path $PSScriptRoot $Path
    }

    return [System.IO.Path]::GetFullPath($candidate)
}

function Test-IsWorkspaceChildPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $root = ([System.IO.Path]::GetFullPath($PSScriptRoot)).TrimEnd('\', '/')
    $fullPath = ([System.IO.Path]::GetFullPath($Path)).TrimEnd('\', '/')
    $comparison = [System.StringComparison]::OrdinalIgnoreCase

    return $fullPath.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, $comparison)
}

function Remove-WorkspaceJunkItem {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $fullPath = Resolve-WorkspacePath -Path $Path
    if (-not (Test-IsWorkspaceChildPath -Path $fullPath)) {
        throw "Refusing to clean path outside workspace: $fullPath"
    }

    if (-not (Test-Path -LiteralPath $fullPath)) {
        return $false
    }

    Remove-Item -LiteralPath $fullPath -Recurse -Force -ErrorAction Stop
    return $true
}

function Invoke-FastWorkspaceCleanup {
    $removedCount = 0

    $directoryTargets = @(
        ".codex-chrome-home-scroll",
        ".codex-chrome-home-scroll-2",
        ".codex-tmp",
        "frontend/www/.next",
        "frontend/www/.turbo",
        "frontend/www/out",
        "frontend/www/coverage",
        "frontend/www/playwright-report",
        "frontend/www/test-results",
        "frontend/www/.parcel-cache",
        "frontend/www/.vite",
        "frontend/cms/.next",
        "frontend/cms/.turbo",
        "frontend/cms/out",
        "frontend/cms/coverage",
        "frontend/cms/playwright-report",
        "frontend/cms/test-results",
        "frontend/crm/.next",
        "frontend/crm/.turbo",
        "frontend/crm/out",
        "frontend/crm/coverage",
        "frontend/crm/playwright-report",
        "frontend/crm/test-results",
        "frontend/usaha/.next",
        "frontend/usaha/.turbo",
        "frontend/usaha/out",
        "frontend/usaha/coverage",
        "frontend/usaha/playwright-report",
        "frontend/usaha/test-results"
    )

    foreach ($target in $directoryTargets) {
        try {
            if (Remove-WorkspaceJunkItem -Path $target) {
                $removedCount++
            }
        }
        catch {
            Write-Host "Skip cleanup target '$target': $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    $patternTargets = @(
        @{ Base = "."; Patterns = @(".codex-*.log", "tmp-*.png", "npm-debug.log*", "yarn-debug.log*", "yarn-error.log*", "pnpm-debug.log*") },
        @{ Base = "frontend/www"; Patterns = @("*.tsbuildinfo", ".eslintcache", ".stylelintcache", "npm-debug.log*", "yarn-debug.log*", "yarn-error.log*", "pnpm-debug.log*") },
        @{ Base = "frontend/cms"; Patterns = @("*.tsbuildinfo", ".eslintcache", ".stylelintcache", "npm-debug.log*", "yarn-debug.log*", "yarn-error.log*", "pnpm-debug.log*") },
        @{ Base = "frontend/crm"; Patterns = @("*.tsbuildinfo", ".eslintcache", ".stylelintcache", "npm-debug.log*", "yarn-debug.log*", "yarn-error.log*", "pnpm-debug.log*") },
        @{ Base = "frontend/usaha"; Patterns = @("*.tsbuildinfo", ".eslintcache", ".stylelintcache", "npm-debug.log*", "yarn-debug.log*", "yarn-error.log*", "pnpm-debug.log*") }
    )

    foreach ($target in $patternTargets) {
        $basePath = Resolve-WorkspacePath -Path $target.Base
        if (-not (Test-IsWorkspaceChildPath -Path $basePath) -and (([System.IO.Path]::GetFullPath($basePath)).TrimEnd('\', '/') -ne ([System.IO.Path]::GetFullPath($PSScriptRoot)).TrimEnd('\', '/'))) {
            throw "Refusing to scan cleanup path outside workspace: $basePath"
        }
        if (-not (Test-Path -LiteralPath $basePath)) {
            continue
        }

        foreach ($pattern in $target.Patterns) {
            $items = @(Get-ChildItem -LiteralPath $basePath -Force -File -Filter $pattern -ErrorAction SilentlyContinue)
            foreach ($item in $items) {
                try {
                    if (Remove-WorkspaceJunkItem -Path $item.FullName) {
                        $removedCount++
                    }
                }
                catch {
                    Write-Host "Skip cleanup file '$($item.FullName)': $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        }
    }

    if ($removedCount -gt 0) {
        Write-Host "Fast workspace cleanup removed $removedCount junk item(s)."
    }
    else {
        Write-Host "Fast workspace cleanup: nothing to remove."
    }
}

if (-not $SkipCleanup) {
    Write-StartupState -Active $true -Status "starting" -Phase "cleaning_workspace" -Message "Removing local temporary build artifacts." -ServiceNames $Services
    Invoke-FastWorkspaceCleanup
}

function Get-LatestWriteTicks {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Paths
    )

    $ignoreDirNames = @(
        ".git", "node_modules", ".next", ".turbo", "dist", "target",
        ".cache", ".gradle", "playwright-report", "coverage", "test-results"
    )

    $latest = [int64]0

    foreach ($relativePath in $Paths) {
        $fullPath = Join-Path $PSScriptRoot $relativePath
        if (-not (Test-Path $fullPath)) {
            continue
        }

        $item = Get-Item $fullPath
        if (-not $item.PSIsContainer) {
            if ($item.LastWriteTimeUtc.Ticks -gt $latest) {
                $latest = $item.LastWriteTimeUtc.Ticks
            }
            continue
        }

        $stack = New-Object 'System.Collections.Generic.Stack[System.IO.DirectoryInfo]'
        $stack.Push([System.IO.DirectoryInfo]$item.FullName)

        while ($stack.Count -gt 0) {
            $dir = $stack.Pop()

            foreach ($file in $dir.GetFiles()) {
                if ($file.LastWriteTimeUtc.Ticks -gt $latest) {
                    $latest = $file.LastWriteTimeUtc.Ticks
                }
            }

            foreach ($subDir in $dir.GetDirectories()) {
                if ($ignoreDirNames -contains $subDir.Name) {
                    continue
                }
                $stack.Push($subDir)
            }
        }
    }

    return $latest
}

function Get-ServiceInputSignature {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Paths
    )

    return (($Paths | ForEach-Object { "$_".Trim().Replace('\', '/') } | Sort-Object) -join '|')
}

function Test-ServiceInputPaths {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServiceName,
        [Parameter(Mandatory = $true)]
        [string[]]$Paths
    )

    $existingCount = 0
    foreach ($relativePath in $Paths) {
        $fullPath = Join-Path $PSScriptRoot $relativePath
        if (Test-Path -LiteralPath $fullPath) {
            $existingCount++
        }
        else {
            Write-Host "Watcher path missing for ${ServiceName}: ${relativePath}" -ForegroundColor Yellow
        }
    }

    if ($existingCount -eq 0) {
        throw "No watcher paths exist for service '$ServiceName'. Refusing to treat it as up to date."
    }
}

function Test-LocalImage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImageName
    )
    try {
        $output = & docker image inspect $ImageName 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $true
        }

        Write-Host "Local image check failed for ${ImageName}; treating it as missing so it can be rebuilt." -ForegroundColor Yellow
        return $false
    }
    catch {
        Write-Host "Local image check threw for ${ImageName}; treating it as missing so it can be rebuilt." -ForegroundColor Yellow
        return $false
    }
}

function Get-ComposeServiceContainerIds {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [Parameter(Mandatory = $true)]
        [string[]]$Services
    )

    $ids = New-Object 'System.Collections.Generic.List[string]'
    foreach ($service in $Services) {
        if ([string]::IsNullOrWhiteSpace($service)) {
            continue
        }

        $serviceIds = & docker ps -aq --filter "label=com.docker.compose.project=$ProjectName" --filter "label=com.docker.compose.service=$service"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to inspect Docker containers for service '$service'."
        }

        foreach ($id in $serviceIds) {
            $trimmed = "$id".Trim()
            if ($trimmed -ne "") {
                $ids.Add($trimmed)
            }
        }
    }

    return @($ids | Select-Object -Unique)
}


function Invoke-DockerQuietExitCode {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $nativePreference = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $previousNativePreference = $null

    try {
        $ErrorActionPreference = "Continue"
        if ($nativePreference) {
            $previousNativePreference = $PSNativeCommandUseErrorActionPreference
            $PSNativeCommandUseErrorActionPreference = $false
        }

        & docker @Args *> $null
        return $LASTEXITCODE
    }
    finally {
        if ($nativePreference) {
            $PSNativeCommandUseErrorActionPreference = $previousNativePreference
        }
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Get-FirstComposeContainerId {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [Parameter(Mandatory = $true)]
        [string]$ServiceName
    )

    $ids = @(Get-ComposeServiceContainerIds -ProjectName $ProjectName -Services @($ServiceName))
    if ($ids.Count -eq 0) {
        return $null
    }
    return [string]$ids[0]
}

function Ensure-ExistingContainerRunningForBackup {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,
        [int]$TimeoutSeconds = 45
    )

    $state = (& docker inspect --format '{{.State.Status}}' $ContainerId 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        return $false
    }

    if ($state -ne "running") {
        if ((Invoke-DockerQuietExitCode -Args @("start", $ContainerId)) -ne 0) {
            return $false
        }
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $state = (& docker inspect --format '{{.State.Status}}' $ContainerId 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and $state -eq "running") {
            return $true
        }
        if ($state -in @("dead", "exited")) {
            return $false
        }
        Start-Sleep -Seconds 2
    }

    return $false
}

function Copy-ContainerFileForBackup {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,
        [Parameter(Mandatory = $true)]
        [string]$ContainerPath,
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath
    )

    $parent = Split-Path -Parent $DestinationPath
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force *> $null
    }

    $copyCode = Invoke-DockerQuietExitCode -Args @(
        "cp",
        "${ContainerId}:${ContainerPath}",
        $DestinationPath
    )
    return ($copyCode -eq 0 -and (Test-Path -LiteralPath $DestinationPath))
}

function Backup-PostgresContainer {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath
    )

    if (-not (Ensure-ExistingContainerRunningForBackup -ContainerId $ContainerId)) {
        return $false
    }

    $tempPath = "/tmp/lajukan-auto-backup.dump"
    $command = 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 && pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/lajukan-auto-backup.dump'
    $exitCode = Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "sh", "-lc", $command
    )
    if ($exitCode -ne 0) {
        return $false
    }

    $copied = Copy-ContainerFileForBackup `
        -ContainerId $ContainerId `
        -ContainerPath $tempPath `
        -DestinationPath $DestinationPath

    Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "rm", "-f", $tempPath
    ) *> $null

    return $copied
}

function Backup-ScyllaContainer {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,
        [Parameter(Mandatory = $true)]
        [string]$SnapshotTag
    )

    if (-not (Ensure-ExistingContainerRunningForBackup -ContainerId $ContainerId -TimeoutSeconds 60)) {
        return $false
    }

    if ((Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "nodetool", "status"
    )) -ne 0) {
        return $false
    }

    if ((Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "nodetool", "snapshot", "-t", $SnapshotTag
    )) -ne 0) {
        return $false
    }

    $tempArchive = "/tmp/lajukan-scylla-snapshot.tar.gz"
    $listFile = "/tmp/lajukan-scylla-snapshot-paths.txt"
    $archiveCommand = "set -e; find /var/lib/scylla/data -type d -path '*/snapshots/$SnapshotTag' -print > '$listFile'; test -s '$listFile'; tar -czf '$tempArchive' -T '$listFile'"

    $archiveCode = Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "sh", "-lc", $archiveCommand
    )

    $copied = $false
    if ($archiveCode -eq 0) {
        $copied = Copy-ContainerFileForBackup `
            -ContainerId $ContainerId `
            -ContainerPath $tempArchive `
            -DestinationPath $DestinationPath
    }

    # Keep the live volume clean after the host copy is complete.
    Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "nodetool", "clearsnapshot", "-t", $SnapshotTag
    ) *> $null
    Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "rm", "-f", $tempArchive, $listFile
    ) *> $null

    return $copied
}

function Backup-DirectoryFromContainer {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,
        [Parameter(Mandatory = $true)]
        [string]$SourceDirectory,
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,
        [string]$TempArchive = "/tmp/lajukan-directory-backup.tar.gz"
    )

    if (-not (Ensure-ExistingContainerRunningForBackup -ContainerId $ContainerId)) {
        return $false
    }

    $archiveCommand = "set -e; test -d '$SourceDirectory'; tar -czf '$TempArchive' -C '$SourceDirectory' ."
    if ((Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "sh", "-lc", $archiveCommand
    )) -ne 0) {
        return $false
    }

    $copied = Copy-ContainerFileForBackup `
        -ContainerId $ContainerId `
        -ContainerPath $TempArchive `
        -DestinationPath $DestinationPath

    Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "rm", "-f", $TempArchive
    ) *> $null

    return $copied
}

function Backup-MinIoBucket {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerId,
        [Parameter(Mandatory = $true)]
        [string]$BucketName,
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath
    )

    if (-not (Ensure-ExistingContainerRunningForBackup -ContainerId $ContainerId)) {
        return $false
    }

    if ($BucketName -notmatch '^[a-z0-9][a-z0-9.-]*[a-z0-9]$') {
        return $false
    }

    $tempDir = "/tmp/lajukan-minio-backup"
    $tempArchive = "/tmp/lajukan-minio-backup.tar.gz"

    # MINIO_ROOT_USER/PASSWORD already live inside the MinIO container.
    $command = "set -e; rm -rf '$tempDir' '$tempArchive'; mkdir -p '$tempDir'; mc alias set local http://localhost:9002 `"`$MINIO_ROOT_USER`" `"`$MINIO_ROOT_PASSWORD`" >/dev/null; if mc stat 'local/$BucketName' >/dev/null 2>&1; then mc mirror --overwrite 'local/$BucketName' '$tempDir' >/dev/null; fi; tar -czf '$tempArchive' -C '$tempDir' ."

    if ((Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "sh", "-lc", $command
    )) -ne 0) {
        return $false
    }

    $copied = Copy-ContainerFileForBackup `
        -ContainerId $ContainerId `
        -ContainerPath $tempArchive `
        -DestinationPath $DestinationPath

    Invoke-DockerQuietExitCode -Args @(
        "exec", $ContainerId, "rm", "-rf", $tempDir, $tempArchive
    ) *> $null

    return $copied
}

function Remove-ExpiredAutomaticBackups {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [int]$RetentionDays = 7
    )

    if ($RetentionDays -lt 1 -or -not (Test-Path -LiteralPath $Root)) {
        return
    }

    $cutoff = (Get-Date).AddDays(-1 * $RetentionDays)
    foreach ($directory in @(
        Get-ChildItem -LiteralPath $Root -Directory -ErrorAction SilentlyContinue
    )) {
        if ($directory.LastWriteTime -ge $cutoff) {
            continue
        }

        try {
            Remove-Item -LiteralPath $directory.FullName -Recurse -Force -ErrorAction Stop
        }
        catch {
            Write-Host "Could not remove expired backup '$($directory.Name)': $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

function Test-RecentSuccessfulBackup {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LatestFile,
        [int]$IntervalHours
    )

    if ($IntervalHours -le 0 -or -not (Test-Path -LiteralPath $LatestFile)) {
        return $false
    }

    try {
        $latest = Get-Content -LiteralPath $LatestFile -Raw | ConvertFrom-Json
        $createdAt = [DateTimeOffset]::Parse([string]$latest.created_at)
        return (([DateTimeOffset]::Now - $createdAt).TotalHours -lt $IntervalHours)
    }
    catch {
        return $false
    }
}

function Invoke-AutomaticBackup {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [Parameter(Mandatory = $true)]
        [string]$EnvFilePath
    )

    if ($SkipBackup) {
        Write-Host "Automatic data backup skipped by -SkipBackup." -ForegroundColor Yellow
        return
    }

    if ($BackupRetentionDays -lt 1) {
        $BackupRetentionDays = 7
    }
    if ($BackupIntervalHours -lt 0) {
        $BackupIntervalHours = 1
    }

    if (-not (Test-Path -LiteralPath $BackupRoot)) {
        New-Item -ItemType Directory -Path $BackupRoot -Force *> $null
    }

    Remove-ExpiredAutomaticBackups `
        -Root $BackupRoot `
        -RetentionDays $BackupRetentionDays

    if (Test-RecentSuccessfulBackup `
        -LatestFile $BackupLatestFile `
        -IntervalHours $BackupIntervalHours
    ) {
        try {
            $latest = Get-Content -LiteralPath $BackupLatestFile -Raw | ConvertFrom-Json
            $script:LastBackupPath = [string]$latest.path
            Write-Host "Recent automatic recovery checkpoint reused: $($script:LastBackupPath)" -ForegroundColor DarkGray
        }
        catch {
        }
        return
    }

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupDir = Join-Path $BackupRoot $stamp
    New-Item -ItemType Directory -Path $backupDir -Force *> $null

    Write-Host "Creating automatic recovery checkpoint before Docker reconciliation..." -ForegroundColor Cyan

    # Recovery config is copied locally. Treat this directory as sensitive
    # because the env file may contain local development secrets.
    foreach ($configPath in @(
        $EnvFilePath,
        "docker-compose.dev.yml",
        "docker-compose.yml",
        "docker-compose.prod.yml",
        "up-super-fast.ps1",
        ".docker-build-state.json"
    )) {
        if (Test-Path -LiteralPath $configPath) {
            Copy-Item -LiteralPath $configPath -Destination $backupDir -Force
        }
    }

    $items = New-Object 'System.Collections.Generic.List[object]'
    $failedNames = New-Object 'System.Collections.Generic.List[string]'

    $postgresTargets = @(
        @{ service = "identity_db"; file = "identity_db.dump" },
        @{ service = "community_db"; file = "community_db.dump" },
        @{ service = "marketplace_db"; file = "marketplace_db.dump" }
    )

    foreach ($target in $postgresTargets) {
        $containerId = Get-FirstComposeContainerId `
            -ProjectName $ProjectName `
            -ServiceName $target.service

        if ([string]::IsNullOrWhiteSpace($containerId)) {
            $items.Add([pscustomobject]@{
                name = $target.service
                status = "skipped"
                file = ""
                note = "container_not_created"
            })
            continue
        }

        $destination = Join-Path $backupDir $target.file
        $ok = Backup-PostgresContainer `
            -ContainerId $containerId `
            -DestinationPath $destination

        $items.Add([pscustomobject]@{
            name = $target.service
            status = if ($ok) { "ok" } else { "failed" }
            file = if ($ok) { $target.file } else { "" }
            note = if ($ok) { "" } else { "logical_dump_failed" }
        })
        if (-not $ok) {
            $failedNames.Add($target.service)
        }
    }

    $scyllaId = Get-FirstComposeContainerId `
        -ProjectName $ProjectName `
        -ServiceName "scylla_db"

    if (-not [string]::IsNullOrWhiteSpace($scyllaId)) {
        $snapshotTag = "lajukan_$($stamp.Replace('-', '_'))"
        $fileName = "scylla-snapshot.tar.gz"
        $ok = Backup-ScyllaContainer `
            -ContainerId $scyllaId `
            -DestinationPath (Join-Path $backupDir $fileName) `
            -SnapshotTag $snapshotTag

        $items.Add([pscustomobject]@{
            name = "scylla_db"
            status = if ($ok) { "ok" } else { "failed" }
            file = if ($ok) { $fileName } else { "" }
            note = if ($ok) { "" } else { "snapshot_backup_failed" }
        })
        if (-not $ok) {
            $failedNames.Add("scylla_db")
        }
    }

    $communityId = Get-FirstComposeContainerId `
        -ProjectName $ProjectName `
        -ServiceName "community_service"

    if (-not [string]::IsNullOrWhiteSpace($communityId)) {
        $fileName = "community-uploads.tar.gz"
        $ok = Backup-DirectoryFromContainer `
            -ContainerId $communityId `
            -SourceDirectory "/app/uploads/forum" `
            -DestinationPath (Join-Path $backupDir $fileName)

        $items.Add([pscustomobject]@{
            name = "community_uploads"
            status = if ($ok) { "ok" } else { "failed" }
            file = if ($ok) { $fileName } else { "" }
            note = if ($ok) { "" } else { "media_archive_failed" }
        })
        if (-not $ok) {
            $failedNames.Add("community_uploads")
        }
    }

    $minioId = Get-FirstComposeContainerId `
        -ProjectName $ProjectName `
        -ServiceName "minio"

    if (-not [string]::IsNullOrWhiteSpace($minioId)) {
        $bucketName = $env:MINIO_BUCKET
        if ([string]::IsNullOrWhiteSpace($bucketName)) {
            $bucketName = Get-EnvFileValue -Path $EnvFilePath -Name "MINIO_BUCKET"
        }
        if ([string]::IsNullOrWhiteSpace($bucketName)) {
            $bucketName = "laju-chat"
        }

        $fileName = "minio-$bucketName.tar.gz"
        $ok = Backup-MinIoBucket `
            -ContainerId $minioId `
            -BucketName $bucketName `
            -DestinationPath (Join-Path $backupDir $fileName)

        $items.Add([pscustomobject]@{
            name = "minio"
            status = if ($ok) { "ok" } else { "failed" }
            file = if ($ok) { $fileName } else { "" }
            note = if ($ok) { "" } else { "bucket_backup_failed" }
        })
        if (-not $ok) {
            $failedNames.Add("minio")
        }
    }

    $manifest = [ordered]@{
        created_at = (Get-Date).ToString("o")
        project = $ProjectName
        script_version = $ScriptVersion
        compose_files = @($script:ComposeFileArgs)
        backup_path = $backupDir
        result = if ($failedNames.Count -eq 0) { "success" } else { "partial" }
        failures = @($failedNames)
        items = @($items)
        restore_note = "Automatic local recovery checkpoint. This script never deletes Docker named volumes."
    }

    $manifestPath = Join-Path $backupDir "manifest.json"
    $manifest |
        ConvertTo-Json -Depth 7 |
        Set-Content -LiteralPath $manifestPath -Encoding UTF8

    $script:LastBackupPath = $backupDir

    if ($failedNames.Count -eq 0) {
        [ordered]@{
            created_at = $manifest.created_at
            path = $backupDir
            manifest = $manifestPath
        } |
            ConvertTo-Json -Depth 4 |
            Set-Content -LiteralPath $BackupLatestFile -Encoding UTF8

        Write-Host "Automatic recovery checkpoint ready: $backupDir" -ForegroundColor Green
    }
    else {
        Write-Host "Automatic backup completed with warning(s): $($failedNames -join ', ')." -ForegroundColor Yellow
        Write-Host "Startup continues safely; named data volumes are preserved and never removed by this script." -ForegroundColor Yellow
    }
}

function Remove-LegacyComposeContainers {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [Parameter(Mandatory = $true)]
        [string[]]$Services
    )

    if (-not $composeLegacyV1) {
        return
    }

    $containerIds = Get-ComposeServiceContainerIds -ProjectName $ProjectName -Services $Services
    if ($containerIds.Count -eq 0) {
        return
    }

    Write-Host "Legacy docker-compose v1 detected. Removing stale containers before recreate: $($Services -join ', ')" -ForegroundColor Yellow
    & docker rm -f @containerIds *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to remove stale service containers before recreate."
    }
}

function Invoke-DockerPullWithRetry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImageName
    )

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        Write-Host "Pulling base image: $ImageName (attempt $attempt/3)"
        & docker pull $ImageName
        if ($LASTEXITCODE -eq 0) {
            return
        }

        if ($attempt -lt 3) {
            Start-Sleep -Seconds (3 * $attempt)
        }
    }

    throw "Failed to pull base image: $ImageName"
}

function Warm-BaseImagesForServices {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ServiceNames
    )

    $seenImages = @{}
    $imagesToPull = New-Object 'System.Collections.Generic.List[string]'

    foreach ($serviceName in $ServiceNames) {
        if (-not $serviceBaseImages.ContainsKey($serviceName)) {
            continue
        }

        foreach ($imageName in $serviceBaseImages[$serviceName]) {
            if ([string]::IsNullOrWhiteSpace($imageName)) {
                continue
            }
            if ($seenImages.ContainsKey($imageName)) {
                continue
            }

            $seenImages[$imageName] = $true
            if (-not (Test-LocalImage -ImageName $imageName)) {
                $imagesToPull.Add($imageName)
            }
        }
    }

    if ($imagesToPull.Count -eq 0) {
        return
    }

    Write-Host "Warming missing base images before build..."
    foreach ($imageName in $imagesToPull) {
        Invoke-DockerPullWithRetry -ImageName $imageName
    }
}

function Get-ProjectContainerIds {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [switch]$RunningOnly
    )

    $args = @("ps")
    if (-not $RunningOnly) {
        $args += "-a"
    }
    $args += @("-q", "--filter", "label=com.docker.compose.project=$ProjectName")

    $ids = & docker @args
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to query docker containers for project '$ProjectName'"
    }

    return @($ids | ForEach-Object { "$_".Trim() } | Where-Object { $_ -ne "" })
}

function Start-ContainerIdsFast {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [Parameter(Mandatory = $true)]
        [string[]]$ContainerIds
    )

    $uniqueIds = @($ContainerIds | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)
    if ($uniqueIds.Count -eq 0) {
        return $false
    }

    $runningProjectContainerIds = Get-ProjectContainerIds -ProjectName $ProjectName -RunningOnly
    $runningLookup = @{}
    foreach ($runningId in $runningProjectContainerIds) {
        $runningLookup[$runningId] = $true
    }

    $toStartIds = @($uniqueIds | Where-Object { -not $runningLookup.ContainsKey($_) })
    if ($toStartIds.Count -gt 0) {
        & docker start @toStartIds *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to start one or more stopped containers."
        }
        Write-Host "Started $($toStartIds.Count) existing container(s) without Compose recreate."
    }
    else {
        Write-Host "Requested containers already running. Skip start/recreate."
    }

    return $true
}

function Start-ComposeServicesFast {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [Parameter(Mandatory = $true)]
        [string[]]$Services
    )

    $containerIds = New-Object 'System.Collections.Generic.List[string]'
    $missingServices = New-Object 'System.Collections.Generic.List[string]'

    foreach ($serviceName in $Services) {
        if ([string]::IsNullOrWhiteSpace($serviceName)) {
            continue
        }

        $serviceContainerIds = Get-ComposeServiceContainerIds -ProjectName $ProjectName -Services @($serviceName)
        if ($serviceContainerIds.Count -eq 0) {
            $missingServices.Add($serviceName)
            continue
        }

        foreach ($id in $serviceContainerIds) {
            $containerIds.Add($id)
        }
    }

    if ($missingServices.Count -gt 0) {
        Write-Host "Missing containers for service(s): $($missingServices -join ', '). Falling back to Compose up."
        return $false
    }

    return Start-ContainerIdsFast -ProjectName $ProjectName -ContainerIds @($containerIds)
}

function Wait-ComposeServicesReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectName,
        [Parameter(Mandatory = $true)]
        [string[]]$Services,
        [string[]]$OptionalServices = @(),
        [int]$CloudflareMetricsPort = 20241,
        [int]$TimeoutSeconds = 180
    )

    $oneShotServices = @{
        scylla_keyspace_setup = $true
    }

    $optionalLookup = @{}
    foreach ($optionalService in $OptionalServices) {
        if (-not [string]::IsNullOrWhiteSpace($optionalService)) {
            $optionalLookup[$optionalService] = $true
        }
    }
    $optionalWarningsShown = @{}

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    Write-Host "Verifying requested container readiness..."

    while ((Get-Date) -lt $deadline) {
        $pending = New-Object 'System.Collections.Generic.List[string]'
        $terminalFailures = New-Object 'System.Collections.Generic.List[string]'

        foreach ($serviceName in $Services) {
            $containerIds = Get-ComposeServiceContainerIds -ProjectName $ProjectName -Services @($serviceName)
            if ($containerIds.Count -eq 0) {
                $pending.Add("${serviceName}: container not created")
                continue
            }

            foreach ($containerId in $containerIds) {
                $stateLine = (& docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|{{.State.ExitCode}}|{{.RestartCount}}' $containerId).Trim()
                if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($stateLine)) {
                    $pending.Add("${serviceName}: inspect unavailable")
                    continue
                }

                $stateParts = @($stateLine -split '\|', 4)
                $containerState = if ($stateParts.Count -gt 0) { $stateParts[0] } else { "" }
                $healthState = if ($stateParts.Count -gt 1) { $stateParts[1] } else { "" }
                $exitCode = if ($stateParts.Count -gt 2) { $stateParts[2] } else { "" }
                $restartCount = if ($stateParts.Count -gt 3) { [int]$stateParts[3] } else { 0 }

                if ($oneShotServices.ContainsKey($serviceName)) {
                    if ($containerState -eq "exited" -and $exitCode -eq "0") {
                        continue
                    }
                    if ($containerState -in @("exited", "dead")) {
                        $terminalFailures.Add("${serviceName}: state=$containerState exit=$exitCode")
                    }
                    else {
                        $pending.Add("${serviceName}: state=$containerState")
                    }
                    continue
                }

                $isOptional = $optionalLookup.ContainsKey($serviceName)

                if ($containerState -eq "running" -and $healthState -in @("", "healthy")) {
                    # Cloudflare edge connectivity is external to the local stack.
                    # A running container is enough for local startup.
                    continue
                }

                if ($isOptional) {
                    $warningKey = "${serviceName}|${containerState}|${healthState}|${exitCode}"
                    if (-not $optionalWarningsShown.ContainsKey($warningKey)) {
                        $optionalWarningsShown[$warningKey] = $true
                        Write-Host "Optional service '$serviceName' is not ready (state=$containerState health=$healthState exit=$exitCode). Core startup will continue." -ForegroundColor Yellow
                    }
                    continue
                }

                if ($containerState -in @("exited", "dead")) {
                    $terminalFailures.Add("${serviceName}: state=$containerState exit=$exitCode")
                }
                elseif ($containerState -eq "restarting" -and $restartCount -ge 3) {
                    $terminalFailures.Add("${serviceName}: restart loop count=$restartCount")
                }
                else {
                    $pending.Add("${serviceName}: state=$containerState health=$healthState")
                }
            }
        }

        if ($terminalFailures.Count -gt 0) {
            throw "Requested service failed: $($terminalFailures -join '; ')"
        }
        if ($pending.Count -eq 0) {
            Write-Host "All requested containers are running/healthy; one-shot setup completed successfully." -ForegroundColor Green
            return
        }

        Start-Sleep -Seconds 3
    }

    throw "Timed out waiting for requested services: $($pending -join '; ')"
}

function Save-StateFile {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$State,
        [Parameter(Mandatory = $true)]
        [string]$StateFilePath
    )

    $stateOut = @{
        updated_at = (Get-Date).ToString("o")
        services   = @{}
    }

    foreach ($serviceName in $State.services.Keys) {
        $stateOut.services[$serviceName] = @{
            input_ticks = [int64]$State.services[$serviceName].input_ticks
            input_paths = [string]$State.services[$serviceName].input_paths
            built_at    = [string]$State.services[$serviceName].built_at
        }
    }

    $stateOut | ConvertTo-Json -Depth 6 | Set-Content $StateFilePath
}

$stateFile = Join-Path $PSScriptRoot ".docker-build-state.json"
$state = @{
    services = @{}
}

if (Test-Path $stateFile) {
    try {
        $raw = Get-Content $stateFile -Raw | ConvertFrom-Json
        if ($raw.services) {
            foreach ($prop in $raw.services.PSObject.Properties) {
                $state.services[$prop.Name] = @{
                    input_ticks = [int64]$prop.Value.input_ticks
                    input_paths = [string]$prop.Value.input_paths
                    built_at    = [string]$prop.Value.built_at
                }
            }
        }
    }
    catch {
        $state = @{
            services = @{}
        }
    }
}

$serviceInputs = @{
    identity_service    = @("services/identity_service")
    marketplace_service = @("services/marketplace_service")
    community_service   = @("services/community_service")
    ai_service          = @("services/ai_service")
    chat_service        = @("services/chat_service")
    ocr_service         = @("services/ocr_service")
    liveness_service    = @("services/liveness_service")
    www                 = @("frontend/www", "frontend/shared", "frontend/.dockerignore")
    usaha               = @("frontend/usaha", "frontend/shared", "frontend/.dockerignore")
    cms                 = @("frontend/cms", "frontend/shared", "frontend/.dockerignore")
    crm                 = @("frontend/crm", "frontend/shared", "frontend/.dockerignore")
}

$composeProjectName = if ($env:COMPOSE_PROJECT_NAME) {
    $env:COMPOSE_PROJECT_NAME
}
else {
    Split-Path -Leaf $PSScriptRoot
}

$serviceImages = @{
    identity_service    = "$composeProjectName-identity_service"
    marketplace_service = "$composeProjectName-marketplace_service"
    community_service   = "$composeProjectName-community_service"
    ai_service          = "$composeProjectName-ai_service"
    chat_service        = "$composeProjectName-chat_service"
    ocr_service         = "$composeProjectName-ocr_service"
    liveness_service    = "$composeProjectName-liveness_service"
    www                 = "$composeProjectName-www"
    usaha               = "$composeProjectName-usaha"
    cms                 = "$composeProjectName-cms"
    crm                 = "$composeProjectName-crm"
}

$serviceBaseImages = @{
    identity_service    = @("rustlang/rust:nightly-bookworm", "debian:bookworm-slim")
    marketplace_service = @("rustlang/rust:nightly-bookworm", "debian:bookworm-slim")
    community_service   = @("rustlang/rust:nightly-bookworm", "debian:bookworm-slim")
    ai_service          = @("rust:1-bookworm", "debian:bookworm-slim")
    chat_service        = @("docker/dockerfile:1.7", "elixir:1.15-slim", "erlang:26-slim")
    ocr_service         = @("python:3.10-slim-bookworm")
    liveness_service    = @("python:3.11-slim-bookworm")
    www                 = @("docker/dockerfile:1.7", "node:20-bullseye-slim")
    usaha               = @("docker/dockerfile:1.7", "node:20-bullseye-slim")
    cms                 = @("docker/dockerfile:1.7", "node:20-bullseye-slim")
    crm                 = @("docker/dockerfile:1.7", "node:20-bullseye-slim")
}

$defaultDevServices = @(
    "identity_db",
    "community_db",
    "marketplace_db",
    "redis_cache",
    "rabbitmq",
    "meilisearch",
    "minio",
    "scylla_db",
    "scylla_keyspace_setup",
    "identity_service",
    "marketplace_service",
    "community_service",
    "chat_service",
    "www",
    "mailhog"
)

if ($profiles -contains "backoffice") {
    $defaultDevServices += @("usaha", "cms", "crm")
}
if ($profiles -contains "tools") {
    $defaultDevServices += @("pgadmin", "dbgate")
}
if ($profiles -contains "kyc") {
    $defaultDevServices += @("ocr_service", "liveness_service")
}
if ($profiles -contains "rag") {
    $defaultDevServices += @("qdrant")
}
if ($profiles -contains "edge") {
    $defaultDevServices += @("caddy")
}
if ($profiles -contains "tunnel") {
    $defaultDevServices += @("cloudflare_tunnel")
}
if ($profiles -contains "mailserver") {
    $defaultDevServices += @("mailserver")
}
$defaultDevServices = @($defaultDevServices | Select-Object -Unique)


if ($Mode -eq "prod") {
    if ($PullLatest) {
        Write-Host "Pulling latest production images..."
        Invoke-Compose @("pull")
    }

    Write-Host "Starting production services without build..."
    Invoke-Compose @("up", "-d", "--no-build", "--no-recreate", "--remove-orphans")
    Invoke-Compose @("ps")
    Write-StartupState -Active $false -Status "ready" -Phase "ready" -Message "Production services are ready." -ServiceNames $Services
    exit 0
}

if (-not (Test-Path $EnvFile)) {
    if ($EnvFile -eq ".env.development" -and (Test-Path ".env")) {
        $EnvFile = ".env"
    }
    else {
        throw "Env file not found: $EnvFile"
    }
}

if ($Mode -eq "dev" -and $aiEnabled) {
    $requiredAiFiles = @(
        "services/ai_service/Cargo.toml",
        "services/ai_service/Dockerfile",
        "services/ai_service/docker-entrypoint.sh",
        "services/ai_service/src/main.rs"
    )
    $missingAiFiles = @(
        $requiredAiFiles | Where-Object { -not (Test-Path -LiteralPath $_) }
    )
    if ($missingAiFiles.Count -gt 0) {
        throw "AI service is enabled but required file(s) are missing: $($missingAiFiles -join ', ')"
    }
}

Write-Host "Compose: $($script:ComposeFileArgs -join ' ')" -ForegroundColor DarkGray
if ($Mode -eq "dev" -and $aiEnabled) {
    Write-Host "AI source: services/ai_service" -ForegroundColor DarkGray
}

$availableServices = @{}
try {
    $configArgs = @($script:ComposeFileArgs) + @("--env-file", $EnvFile, "config", "--services")
    if ($composeV2Available) {
        $configuredServices = & docker compose @configArgs
    }
    else {
        $configuredServices = & docker-compose @configArgs
    }
    if ($LASTEXITCODE -eq 0) {
        foreach ($service in $configuredServices) {
            $serviceName = "$service".Trim()
            if ($serviceName -ne "") {
                $availableServices[$serviceName] = $true
            }
        }
    }
}
catch {
    $availableServices = @{}
}

if ($Mode -eq "dev" -and $aiEnabled -and $availableServices.Count -gt 0) {
    foreach ($requiredAiService in @("ai_service", "ollama")) {
        if (-not $availableServices.ContainsKey($requiredAiService)) {
            throw "AI is enabled but Compose service '$requiredAiService' is not available in $DevComposeFile. Check profiles and the service definition."
        }
    }
    Write-Host "AI Compose services detected: ai_service, ollama" -ForegroundColor DarkGray
}

$requestedServices = @()
if ($Services) {
    $requestedServices = @(
        $Services |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { "$_" -split "," } |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne "" } |
        Select-Object -Unique
    )
}

if ($requestedServices.Count -gt 0 -and $availableServices.Count -gt 0) {
    $invalidServices = @($requestedServices | Where-Object { -not $availableServices.ContainsKey($_) })
    if ($invalidServices.Count -gt 0) {
        throw "Unknown or unsupported services requested: $($invalidServices -join ', ')"
    }
}

$selectedServices = if ($requestedServices.Count -gt 0) {
    $requestedServices
}
else {
    $defaultDevServices
}

if ($aiEnabled) {
    foreach ($aiServiceName in @("ai_service", "ollama")) {
        if ($selectedServices -notcontains $aiServiceName) {
            $selectedServices = @($aiServiceName) + @($selectedServices)
        }
    }
}
else {
    $selectedServices = @($selectedServices | Where-Object { $_ -notin @("ai_service", "ollama") })
}

Write-StartupState -Active $true -Status "starting" -Phase "checking_images" -Message "Checking images and service inputs." -ServiceNames $selectedServices

$startupServices = @($selectedServices | Where-Object {
        $availableServices.Count -eq 0 -or $availableServices.ContainsKey($_)
    })

$startupServiceLookup = @{}
foreach ($serviceName in $startupServices) {
    $startupServiceLookup[$serviceName] = $true
}

# Protect authoritative local data before image rebuild/recreate/reconciliation.
# A successful checkpoint newer than BackupIntervalHours is reused.
Write-StartupState `
    -Active $true `
    -Status "starting" `
    -Phase "backing_up" `
    -Message "Creating or reusing automatic recovery checkpoint." `
    -ServiceNames $startupServices

Invoke-AutomaticBackup `
    -ProjectName $composeProjectName `
    -EnvFilePath $EnvFile

$currentTicksByService = @{}
$inputSignatureByService = @{}
$imageExistsByService = @{}
foreach ($serviceName in $serviceInputs.Keys) {
    if ($availableServices.Count -gt 0 -and -not $availableServices.ContainsKey($serviceName)) {
        continue
    }
    if ($requestedServices.Count -gt 0 -and -not $startupServiceLookup.ContainsKey($serviceName)) {
        continue
    }
    Test-ServiceInputPaths -ServiceName $serviceName -Paths $serviceInputs[$serviceName]
    $currentTicksByService[$serviceName] = Get-LatestWriteTicks -Paths $serviceInputs[$serviceName]
    $inputSignatureByService[$serviceName] = Get-ServiceInputSignature -Paths $serviceInputs[$serviceName]
    $imageExistsByService[$serviceName] = Test-LocalImage -ImageName $serviceImages[$serviceName]
}

$servicesToBuild = @()

if (-not $NoBuild) {
    foreach ($serviceName in $serviceInputs.Keys) {
        if ($availableServices.Count -gt 0 -and -not $availableServices.ContainsKey($serviceName)) {
            continue
        }
        if ($requestedServices.Count -gt 0 -and -not $startupServiceLookup.ContainsKey($serviceName)) {
            continue
        }
        $imageExists = [bool]$imageExistsByService[$serviceName]
        $previousTicks = [int64]0
        $previousSignature = ""
        $currentSignature = [string]$inputSignatureByService[$serviceName]

        if ($state.services.ContainsKey($serviceName)) {
            $previousTicks = [int64]$state.services[$serviceName].input_ticks
            if ($state.services[$serviceName].ContainsKey('input_paths')) {
                $previousSignature = [string]$state.services[$serviceName].input_paths
            }
        }
        elseif ($imageExists -and -not $BuildAll) {
            # Bootstrap state dari image lokal yang sudah ada agar run pertama
            # tidak memaksa rebuild semua service.
            $previousTicks = [int64]$currentTicksByService[$serviceName]
            $previousSignature = $currentSignature
            $state.services[$serviceName] = @{
                input_ticks = [int64]$previousTicks
                input_paths = $currentSignature
                built_at    = "bootstrap-existing-image"
            }
        }

        $legacyComposeSignatures = @(
            $(Get-ServiceInputSignature -Paths (
                @($serviceInputs[$serviceName]) + @("docker-compose.yml")
            ))
            $(Get-ServiceInputSignature -Paths (
                @($serviceInputs[$serviceName]) + @("docker-compose.dev.yml")
            ))
        )
        if (
            $imageExists -and
            ($legacyComposeSignatures -contains $previousSignature)
        ) {
            # The watcher used to include the whole Compose file, which made
            # any infrastructure-only edit rebuild every application image.
            # Migrate that watcher definition without hiding a newer source
            # mtime, which is still checked below.
            $previousSignature = $currentSignature
            $state.services[$serviceName].input_paths = $currentSignature
        }

        $watcherChanged = $previousSignature -eq "" -or $previousSignature -ne $currentSignature
        $needsBuild = $BuildAll -or (-not $imageExists) -or $watcherChanged -or ($currentTicksByService[$serviceName] -gt $previousTicks)
        if ($needsBuild) {
            if ($watcherChanged) {
                Write-Host "Watcher inputs changed for ${serviceName}; rebuilding image." -ForegroundColor Cyan
            }
            $servicesToBuild += $serviceName
        }
    }
}

if ($servicesToBuild.Count -gt 0) {
    Write-StartupState -Active $true -Status "building" -Phase "building" -Message "Building changed services." -ServiceNames $servicesToBuild
    Warm-BaseImagesForServices -ServiceNames $servicesToBuild

    $buildOrder = @(
        @("identity_service", "marketplace_service", "community_service", "ai_service"),
        @("chat_service"),
        @("ocr_service", "liveness_service"),
        @("www", "usaha", "cms", "crm")
    )

    foreach ($group in $buildOrder) {
        $groupToBuild = @($group | Where-Object { $servicesToBuild -contains $_ })
        if ($groupToBuild.Count -eq 0) {
            continue
        }
        Write-Host "Building services: $($groupToBuild -join ', ')"
        Invoke-Compose (@("--env-file", $EnvFile, "build") + $groupToBuild)
    }

    foreach ($serviceName in $servicesToBuild) {
        $state.services[$serviceName] = @{
            input_ticks = [int64]$currentTicksByService[$serviceName]
            input_paths = [string]$inputSignatureByService[$serviceName]
            built_at    = (Get-Date).ToString("o")
        }
    }

    Save-StateFile -State $state -StateFilePath $stateFile
}
else {
    Write-Host "No image rebuild needed. Reusing existing local images."

    foreach ($serviceName in $serviceInputs.Keys) {
        if (-not $state.services.ContainsKey($serviceName) -and [bool]$imageExistsByService[$serviceName]) {
            $state.services[$serviceName] = @{
                input_ticks = [int64]$currentTicksByService[$serviceName]
                input_paths = [string]$inputSignatureByService[$serviceName]
                built_at    = "bootstrap-no-build"
            }
        }
    }
    Save-StateFile -State $state -StateFilePath $stateFile
}

Write-Host "Starting services..."
Write-StartupState -Active $true -Status "starting_services" -Phase "starting_services" -Message "Starting Docker services." -ServiceNames $startupServices
if ($servicesToBuild.Count -gt 0) {
    Remove-LegacyComposeContainers -ProjectName $composeProjectName -Services $servicesToBuild
}

# Compose reconciliation is intentionally retained even on the fast path.
# It applies changed ports, commands, environment, profiles, and health
# configuration without rebuilding images whose source did not change.
if ($startupServices.Count -gt 0) {
    Invoke-ComposeUpResilient -Args (
        @("--env-file", $EnvFile, "up", "-d", "--no-build", "--remove-orphans") +
        $startupServices
    )
}
else {
    Invoke-ComposeUpResilient -Args @(
        "--env-file", $EnvFile,
        "up", "-d", "--no-build", "--remove-orphans"
    )
}

if ($startupServices -contains "minio") {
    Write-StartupState -Active $true -Status "starting_services" -Phase "initializing_storage" -Message "Ensuring MinIO storage bucket exists." -ServiceNames $startupServices
    Ensure-MinIOBucket -EnvFilePath $EnvFile
}

$cloudflareMetricsPort = 20241
# Cloudflare edge connectivity is deliberately not a local-stack readiness gate.
# The value is kept only for backwards-compatible function parameters.


if ($aiEnabled) {
    if ($shouldPullAiModels) {
        Write-StartupState -Active $true -Status "starting_services" -Phase "pulling_ai_models" -Message "Preparing local Ollama models." -ServiceNames $startupServices
        Ensure-OllamaServiceRunning -EnvFilePath $EnvFile
        Wait-OllamaReady -EnvFilePath $EnvFile
        Pull-OllamaModel -EnvFilePath $EnvFile -ModelName $AiBusinessModel
        if (-not $AiTextOnly -and $AiVisionModel -ne $AiBusinessModel) {
            Pull-OllamaModel -EnvFilePath $EnvFile -ModelName $AiVisionModel
        }
    }
    else {
        Ensure-OllamaServiceRunning -EnvFilePath $EnvFile
        Write-Host "Local AI service is running. Model pull skipped by -SkipAiModels." -ForegroundColor Yellow
    }

    if (-not $SkipAiWarmup) {
        Write-StartupState -Active $true -Status "starting_services" -Phase "warming_ai_model" -Message "Warming local AI model." -ServiceNames $startupServices
        Wait-OllamaReady -EnvFilePath $EnvFile
        if ($AiTextOnly) {
            Warm-OllamaModel -EnvFilePath $EnvFile -ModelName $AiBusinessModel
        }
        else {
            Warm-OllamaModel -EnvFilePath $EnvFile -ModelName $AiVisionModel
        }
    }
}
$optionalReadinessServices = @(
    "cloudflare_tunnel",
    "caddy",
    "mailhog",
    "pgadmin",
    "dbgate",
    "qdrant"
)

# Explicit -Services means the caller intentionally wants that service checked strictly.
if ($requestedServices.Count -gt 0) {
    $optionalReadinessServices = @(
        $optionalReadinessServices |
        Where-Object { $requestedServices -notcontains $_ }
    )
}

Wait-ComposeServicesReady `
    -ProjectName $composeProjectName `
    -Services $startupServices `
    -OptionalServices $optionalReadinessServices `
    -CloudflareMetricsPort $cloudflareMetricsPort

Invoke-Compose @("--env-file", $EnvFile, "ps")

if (-not [string]::IsNullOrWhiteSpace($script:LastBackupPath)) {
    Write-Host "Recovery checkpoint: $script:LastBackupPath" -ForegroundColor DarkGray
}
Write-Host "Lajukan local stack is ready. Daily command: .\up-super-fast.ps1" -ForegroundColor Green

Write-StartupState `
    -Active $false `
    -Status "ready" `
    -Phase "ready" `
    -Message "All core requested services are ready." `
    -ServiceNames $startupServices

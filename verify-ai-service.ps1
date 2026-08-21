param(
    [string]$EnvFile = ".env.development",
    [string]$ComposeFile = "docker-compose.dev.yml",
    [switch]$NoBuild,
    [switch]$PullModel,
    [switch]$TestInference
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Fail([string]$Message) {
    throw "[AI VERIFY] $Message"
}

function Pass([string]$Message) {
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Info([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

$required = @(
    $ComposeFile,
    $EnvFile,
    "services/ai_service/Cargo.toml",
    "services/ai_service/Dockerfile",
    "services/ai_service/docker-entrypoint.sh",
    "services/ai_service/src/main.rs"
)

$missing = @($required | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missing.Count -gt 0) {
    Fail "Missing required file(s): $($missing -join ', ')"
}
Pass "Required files exist."

$main = Get-Content "services/ai_service/src/main.rs" -Raw
$dockerfile = Get-Content "services/ai_service/Dockerfile" -Raw
$cargo = Get-Content "services/ai_service/Cargo.toml" -Raw
$entrypoint = Get-Content "services/ai_service/docker-entrypoint.sh" -Raw
$upScript = if (Test-Path "up-super-fast.ps1") { Get-Content "up-super-fast.ps1" -Raw } else { "" }

$staleChecks = @(
    @{ Label = "community binary"; Pattern = "target/release/community_service" },
    @{ Label = "community database env"; Pattern = "COMMUNITY_DATABASE_URL" },
    @{ Label = "old exposed port"; Pattern = "EXPOSE 8082" },
    @{ Label = "SQLx migration"; Pattern = "sqlx migrate" },
    @{ Label = "old StatusCode compile bug"; Pattern = "status == StatusCode::BAD_REQUEST" },
    @{ Label = "old read_f64 compile bug"; Pattern = ".and_then(read_f64_value)" }
)

foreach ($check in $staleChecks) {
    if ($main.Contains($check.Pattern) -or $dockerfile.Contains($check.Pattern) -or $entrypoint.Contains($check.Pattern)) {
        Fail "Stale $($check.Label) detected: $($check.Pattern)"
    }
}
Pass "No known stale Community/compile-error patterns found."

if ($cargo -notmatch 'name\s*=\s*"ai_service"') { Fail "Cargo package name is not ai_service." }
if ($cargo -notmatch 'version\s*=\s*"2\.0\.1"') { Fail "Cargo version is not 2.0.1." }
if ($main -notmatch 'SERVICE_VERSION:\s*&str\s*=\s*"2\.0\.1"') { Fail "main.rs service version is not 2.0.1." }
if ($dockerfile -notmatch 'target/release/ai_service') { Fail "Dockerfile does not copy ai_service binary." }
if ($dockerfile -notmatch 'EXPOSE\s+8080') { Fail "Dockerfile does not expose 8080." }
Pass "Cargo/main/Docker runtime identity is synchronized at 2.0.1."

if ($upScript) {
    if ($upScript -notmatch 'services/ai_service') { Fail "up-super-fast.ps1 is not watching services/ai_service." }
    if ($upScript -notmatch 'docker-compose\.dev\.yml') { Fail "up-super-fast.ps1 is not using docker-compose.dev.yml." }
    Pass "up-super-fast.ps1 watches ai_service and uses the dev compose."
}

Info "Validating Docker Compose model..."
& docker compose -f $ComposeFile --profile ai --env-file $EnvFile config --quiet
if ($LASTEXITCODE -ne 0) { Fail "docker compose config failed." }

$services = @(& docker compose -f $ComposeFile --profile ai --env-file $EnvFile config --services)
if ($LASTEXITCODE -ne 0) { Fail "Could not list Compose services." }
foreach ($requiredService in @("ai_service", "ollama")) {
    if ($services -notcontains $requiredService) { Fail "Compose does not expose service '$requiredService' with profile ai." }
}
Pass "Compose exposes ai_service and ollama."

if (-not $NoBuild) {
    Info "Building ai_service with the real Rust compiler inside Docker..."
    & docker compose -f $ComposeFile --profile ai --env-file $EnvFile build ai_service
    if ($LASTEXITCODE -ne 0) { Fail "ai_service Docker build failed." }
    Pass "ai_service compiled successfully."
}

Info "Starting Ollama + ai_service..."
& docker compose -f $ComposeFile --profile ai --env-file $EnvFile up -d --no-build ollama ai_service
if ($LASTEXITCODE -ne 0) { Fail "Could not start ollama/ai_service." }

$deadline = (Get-Date).AddSeconds(120)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8084/health" -TimeoutSec 3
        if ($health.status -eq "ok") { $healthy = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}
if (-not $healthy) {
    & docker compose -f $ComposeFile --profile ai --env-file $EnvFile logs --tail=120 ai_service
    Fail "ai_service did not become healthy on http://127.0.0.1:8084/health"
}
Pass "AI gateway /health is OK."

try {
    $cap = Invoke-RestMethod -Uri "http://127.0.0.1:8084/v1/capabilities" -TimeoutSec 5
    if (-not $cap.service) { Fail "Capabilities response is malformed." }
    Pass "AI gateway capabilities endpoint is OK."
} catch {
    Fail "Capabilities endpoint failed: $($_.Exception.Message)"
}

if ($PullModel) {
    Info "Ensuring qwen3:4b is available in Ollama..."
    & docker compose -f $ComposeFile --profile ai --env-file $EnvFile exec -T ollama ollama pull qwen3:4b
    if ($LASTEXITCODE -ne 0) { Fail "Could not pull qwen3:4b." }
    Pass "qwen3:4b is available."
}

if ($TestInference) {
    $modelOk = $true
    & docker compose -f $ComposeFile --profile ai --env-file $EnvFile exec -T ollama ollama show qwen3:4b *> $null
    if ($LASTEXITCODE -ne 0) { $modelOk = $false }
    if (-not $modelOk) {
        Fail "qwen3:4b is not installed. Re-run with -PullModel -TestInference."
    }

    Info "Testing one real /v1/chat inference..."
    $body = @{
        message = "/no_think`nJawab hanya: OK"
        locale = "id"
        max_tokens = 32
    } | ConvertTo-Json -Depth 5

    $response = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:8084/v1/chat" `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 180

    if ($response.status -ne "success") { Fail "Inference did not return success." }
    Pass "Real AI inference succeeded."
}

Write-Host ""
Write-Host "AI SERVICE VALIDATION PASSED" -ForegroundColor Green
Write-Host "Next normal command: .\up-super-fast.ps1" -ForegroundColor Green

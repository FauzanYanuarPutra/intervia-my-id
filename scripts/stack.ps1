param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("local", "staging", "prod")]
  [string]$Environment,

  [Parameter(Mandatory = $true)]
  [ValidateSet("up", "down", "restart", "logs", "ps", "build", "pull", "push")]
  [string]$Action,

  [string]$Tag = "latest",
  [switch]$Build,
  [switch]$Detached = $true
)

$ErrorActionPreference = "Stop"

function Get-ComposeFiles {
  param([string]$EnvName)
  $files = @("docker-compose.yml")
  if ($EnvName -eq "local") {
    $files += "docker-compose.dev.yml"
  }
  if ($EnvName -eq "staging") {
    $files += "docker-compose.staging.yml"
  }
  if ($EnvName -eq "prod") {
    $files += "docker-compose.prod.yml"
  }
  return $files
}

function Get-EnvFile {
  param([string]$EnvName)
  if ($EnvName -eq "local") { return ".env.development" }
  if ($EnvName -eq "staging") { return ".env.staging" }
  return ".env.production"
}

function Get-Services {
  param([string]$EnvName)

  if ($EnvName -eq "local") {
    return @(
      "postgres_db", "redis_cache", "rabbitmq", "meilisearch",
      "identity_service", "marketplace_service",
      "www", "cms", "crm", "mailhog"
    )
  }

  if ($EnvName -eq "staging") {
    return @(
      "postgres_db", "redis_cache", "rabbitmq", "meilisearch",
      "scylla_db", "scylla_keyspace_setup",
      "identity_service", "marketplace_service", "chat_service",
      "ocr_service", "liveness_service", "vllm_engine", "ai_service",
      "qdrant", "minio", "www", "cms", "crm", "caddy"
    )
  }

  return @(
    "postgres_db", "redis_cache", "rabbitmq", "meilisearch",
    "scylla_db", "scylla_keyspace_setup",
    "identity_service", "marketplace_service", "chat_service",
    "ocr_service", "liveness_service", "vllm_engine", "ai_service",
    "compreface-db-init", "compreface-admin", "compreface-api", "compreface-core",
    "qdrant", "minio", "www", "cms", "crm", "caddy", "cloudflare_tunnel"
  )
}

function Run-Compose {
  param(
    [string[]]$ComposeFiles,
    [string]$EnvFile,
    [string[]]$ComposeArgs
  )

  $args = @("compose", "--env-file", $EnvFile)
  foreach ($f in $ComposeFiles) {
    $args += @("-f", $f)
  }
  $args += $ComposeArgs

  Write-Host ">> docker $($args -join ' ')" -ForegroundColor Cyan
  & docker @args
}

$composeFiles = Get-ComposeFiles -EnvName $Environment
$envFile = Get-EnvFile -EnvName $Environment
$services = Get-Services -EnvName $Environment

if (-not (Test-Path $envFile)) {
  throw "Env file '$envFile' tidak ditemukan. Buat dulu dari .env.example"
}

if ($Action -eq "up") {
  $composeArgs = @("up")
  if ($Detached) { $composeArgs += "-d" }
  if ($Build) { $composeArgs += "--build" }
  $composeArgs += $services
  Run-Compose -ComposeFiles $composeFiles -EnvFile $envFile -ComposeArgs $composeArgs
  exit 0
}

if ($Action -eq "down") {
  Run-Compose -ComposeFiles $composeFiles -EnvFile $envFile -ComposeArgs @("down", "--remove-orphans")
  exit 0
}

if ($Action -eq "restart") {
  Run-Compose -ComposeFiles $composeFiles -EnvFile $envFile -ComposeArgs @("restart")
  exit 0
}

if ($Action -eq "logs") {
  Run-Compose -ComposeFiles $composeFiles -EnvFile $envFile -ComposeArgs @("logs", "-f", "--tail", "200")
  exit 0
}

if ($Action -eq "ps") {
  Run-Compose -ComposeFiles $composeFiles -EnvFile $envFile -ComposeArgs @("ps")
  exit 0
}

if ($Action -eq "build") {
  Run-Compose -ComposeFiles $composeFiles -EnvFile $envFile -ComposeArgs @("build")
  exit 0
}

if ($Action -eq "pull") {
  Run-Compose -ComposeFiles $composeFiles -EnvFile $envFile -ComposeArgs @("pull")
  exit 0
}

if ($Action -eq "push") {
  if ([string]::IsNullOrWhiteSpace($env:DOCKERHUB_NAMESPACE)) {
    throw "Set DOCKERHUB_NAMESPACE dulu. Contoh: `$env:DOCKERHUB_NAMESPACE='username'"
  }
  $env:IMAGE_TAG = $Tag
  Run-Compose -ComposeFiles $composeFiles -EnvFile $envFile -ComposeArgs @("build", "identity_service", "marketplace_service", "ai_service", "chat_service", "ocr_service", "liveness_service", "www", "cms", "crm")
  Run-Compose -ComposeFiles $composeFiles -EnvFile $envFile -ComposeArgs @("push", "identity_service", "marketplace_service", "ai_service", "chat_service", "ocr_service", "liveness_service", "www", "cms", "crm")
  exit 0
}

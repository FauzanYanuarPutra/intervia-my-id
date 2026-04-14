param(
    [ValidateSet("dev", "prod")]
    [string]$Mode = "dev",
    [string]$EnvFile = ".env.development",
    [switch]$BuildAll,
    [switch]$NoBuild,
    [switch]$PullLatest,
    [string[]]$Services
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$env:DOCKER_BUILDKIT = "1"
$env:COMPOSE_DOCKER_CLI_BUILD = "1"
$env:COMPOSE_PARALLEL_LIMIT = "3"
$env:BUILDKIT_PROGRESS = "plain"

$composeV2Available = $false
$composeLegacyV1 = $false
try {
    & docker compose version *> $null
    if ($LASTEXITCODE -eq 0) {
        $composeV2Available = $true
    }
} catch {
    $composeV2Available = $false
}

if (-not $composeV2Available) {
    try {
        $dockerComposeVersion = (& docker-compose version 2>$null | Out-String)
        if ($LASTEXITCODE -eq 0 -and $dockerComposeVersion -match '(^|\s)(docker-compose\s+)?version\s+1\.') {
            $composeLegacyV1 = $true
        }
    } catch {
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
    if ($composeV2Available) {
        & docker compose @Args
    } else {
        & docker-compose @Args
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Compose command failed: $($Args -join ' ')"
    }
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

function Test-LocalImage {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ImageName
    )
    & docker image inspect $ImageName *> $null
    return ($LASTEXITCODE -eq 0)
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
                    built_at    = [string]$prop.Value.built_at
                }
            }
        }
    } catch {
        $state = @{
            services = @{}
        }
    }
}

$serviceInputs = @{
    identity_service    = @("backend/rust_apps", "docker-compose.yml")
    marketplace_service = @("backend/rust_apps", "docker-compose.yml")
    ai_service          = @("backend/rust_apps", "docker-compose.yml")
    chat_service        = @("backend/chat_service", "docker-compose.yml")
    ocr_service         = @("ai/ocr_paddle", "docker-compose.yml")
    liveness_service    = @("ai/liveness", "docker-compose.yml")
    www                 = @("frontend/www", "frontend/shared", "frontend/.dockerignore", "docker-compose.yml")
    cms                 = @("frontend/cms", "frontend/shared", "frontend/.dockerignore", "docker-compose.yml")
    crm                 = @("frontend/crm", "frontend/shared", "frontend/.dockerignore", "docker-compose.yml")
}

$composeProjectName = if ($env:COMPOSE_PROJECT_NAME) {
    $env:COMPOSE_PROJECT_NAME
} else {
    Split-Path -Leaf $PSScriptRoot
}

$serviceImages = @{
    identity_service    = "$composeProjectName-identity_service"
    marketplace_service = "$composeProjectName-marketplace_service"
    ai_service          = "$composeProjectName-ai_service"
    chat_service        = "$composeProjectName-chat_service"
    ocr_service         = "$composeProjectName-ocr_service"
    liveness_service    = "$composeProjectName-liveness_service"
    www                 = "$composeProjectName-www"
    cms                 = "$composeProjectName-cms"
    crm                 = "$composeProjectName-crm"
}

$serviceBaseImages = @{
    identity_service    = @("rustlang/rust:nightly-bookworm", "debian:bookworm-slim")
    marketplace_service = @("rustlang/rust:nightly-bookworm", "debian:bookworm-slim")
    ai_service          = @("rustlang/rust:nightly-bookworm", "debian:bookworm-slim")
    chat_service        = @("docker/dockerfile:1.7", "elixir:1.15-slim", "erlang:26-slim")
    ocr_service         = @("python:3.9-slim")
    liveness_service    = @("python:3.11-slim")
    www                 = @("docker/dockerfile:1.7", "node:20-bullseye-slim")
    cms                 = @("docker/dockerfile:1.7", "node:20-bullseye-slim")
    crm                 = @("docker/dockerfile:1.7", "node:20-bullseye-slim")
}

$defaultDevServices = @(
    "postgres_db",
    "redis_cache",
    "rabbitmq",
    "meilisearch",
    "identity_service",
    "marketplace_service",
    "www",
    "cms",
    "crm",
    "mailhog"
)

if ($Mode -eq "prod") {
    $prodArgs = @("-f", "docker-compose.yml", "-f", "docker-compose.prod.yml")

    if ($PullLatest) {
        Write-Host "Pulling latest production images..."
        Invoke-Compose ($prodArgs + @("pull"))
    }

    Write-Host "Starting production services without build..."
    Invoke-Compose ($prodArgs + @("up", "-d", "--no-build", "--no-recreate", "--remove-orphans"))
    Invoke-Compose ($prodArgs + @("ps"))
    exit 0
}

if (-not (Test-Path $EnvFile)) {
    throw "Env file not found: $EnvFile"
}

$availableServices = @{}
try {
    if ($composeV2Available) {
        $configuredServices = & docker compose --env-file $EnvFile config --services
    } else {
        $configuredServices = & docker-compose --env-file $EnvFile config --services
    }
    if ($LASTEXITCODE -eq 0) {
        foreach ($service in $configuredServices) {
            $serviceName = "$service".Trim()
            if ($serviceName -ne "") {
                $availableServices[$serviceName] = $true
            }
        }
    }
} catch {
    $availableServices = @{}
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
} else {
    $defaultDevServices
}

$startupServices = @($selectedServices | Where-Object {
    $availableServices.Count -eq 0 -or $availableServices.ContainsKey($_)
})

$startupServiceLookup = @{}
foreach ($serviceName in $startupServices) {
    $startupServiceLookup[$serviceName] = $true
}

$currentTicksByService = @{}
$imageExistsByService = @{}
foreach ($serviceName in $serviceInputs.Keys) {
    if ($availableServices.Count -gt 0 -and -not $availableServices.ContainsKey($serviceName)) {
        continue
    }
    if ($requestedServices.Count -gt 0 -and -not $startupServiceLookup.ContainsKey($serviceName)) {
        continue
    }
    $currentTicksByService[$serviceName] = Get-LatestWriteTicks -Paths $serviceInputs[$serviceName]
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

        if ($state.services.ContainsKey($serviceName)) {
            $previousTicks = [int64]$state.services[$serviceName].input_ticks
        } elseif ($imageExists -and -not $BuildAll) {
            # Bootstrap state dari image lokal yang sudah ada agar run pertama
            # tidak memaksa rebuild semua service.
            $previousTicks = [int64]$currentTicksByService[$serviceName]
            $state.services[$serviceName] = @{
                input_ticks = [int64]$previousTicks
                built_at    = "bootstrap-existing-image"
            }
        }

        $needsBuild = $BuildAll -or (-not $imageExists) -or ($currentTicksByService[$serviceName] -gt $previousTicks)
        if ($needsBuild) {
            $servicesToBuild += $serviceName
        }
    }
}

if ($servicesToBuild.Count -gt 0) {
    Warm-BaseImagesForServices -ServiceNames $servicesToBuild

    $buildOrder = @(
        @("identity_service", "marketplace_service", "ai_service"),
        @("chat_service"),
        @("ocr_service", "liveness_service"),
        @("www", "cms", "crm")
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
            built_at    = (Get-Date).ToString("o")
        }
    }

    Save-StateFile -State $state -StateFilePath $stateFile
} else {
    Write-Host "No image rebuild needed. Reusing existing local images."

    foreach ($serviceName in $serviceInputs.Keys) {
        if (-not $state.services.ContainsKey($serviceName) -and [bool]$imageExistsByService[$serviceName]) {
            $state.services[$serviceName] = @{
                input_ticks = [int64]$currentTicksByService[$serviceName]
                built_at    = "bootstrap-no-build"
            }
        }
    }
    Save-StateFile -State $state -StateFilePath $stateFile
}

Write-Host "Starting services..."
if ($servicesToBuild.Count -gt 0) {
    Remove-LegacyComposeContainers -ProjectName $composeProjectName -Services $servicesToBuild
    Invoke-Compose (@("--env-file", $EnvFile, "up", "-d", "--no-build") + $servicesToBuild)
    try {
        if ($startupServices.Count -gt 0) {
            Invoke-Compose (@("--env-file", $EnvFile, "start") + $startupServices)
        } else {
            Invoke-Compose @("--env-file", $EnvFile, "start")
        }
    } catch {
        if ($startupServices.Count -gt 0) {
            Invoke-Compose (@("--env-file", $EnvFile, "up", "-d", "--no-build", "--no-recreate") + $startupServices)
        } else {
            Invoke-Compose @("--env-file", $EnvFile, "up", "-d", "--no-build", "--no-recreate")
        }
    }
} else {
    if ($startupServices.Count -gt 0) {
        try {
            Invoke-Compose (@("--env-file", $EnvFile, "start") + $startupServices)
        } catch {
            Invoke-Compose (@("--env-file", $EnvFile, "up", "-d", "--no-build", "--no-recreate") + $startupServices)
        }
    } else {
        # Fastest path: gunakan docker native start agar tidak menunggu dependency
        # health checks dari compose setiap kali.
        $allProjectContainerIds = Get-ProjectContainerIds -ProjectName $composeProjectName
        if ($allProjectContainerIds.Count -gt 0) {
            $runningProjectContainerIds = Get-ProjectContainerIds -ProjectName $composeProjectName -RunningOnly
            $runningLookup = @{}
            foreach ($runningId in $runningProjectContainerIds) {
                $runningLookup[$runningId] = $true
            }

            $toStartIds = @($allProjectContainerIds | Where-Object { -not $runningLookup.ContainsKey($_) })
            if ($toStartIds.Count -gt 0) {
                & docker start @toStartIds *> $null
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed to start one or more stopped containers."
                }
            } else {
                Write-Host "All containers already running. Skip start/recreate."
            }
        } else {
            # Jika belum pernah ada container untuk project ini, baru lakukan up.
            Invoke-Compose @("--env-file", $EnvFile, "up", "-d", "--no-build", "--no-recreate")
        }
    }
}
Invoke-Compose @("--env-file", $EnvFile, "ps")

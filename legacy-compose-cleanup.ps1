param(
    [string]$ProjectName,
    [switch]$All,
    [string[]]$Services
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectName)) {
    if ($env:COMPOSE_PROJECT_NAME) {
        $ProjectName = $env:COMPOSE_PROJECT_NAME
    } else {
        $ProjectName = Split-Path -Leaf $PSScriptRoot
    }
}

$selectedServices = @()
if ($Services) {
    $selectedServices = @(
        $Services |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { "$_" -split "," } |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -ne "" } |
        Select-Object -Unique
    )
}

if (-not $All -and $selectedServices.Count -eq 0) {
    throw "Specify -Services <name[,name]> or use -All."
}

$containerIds = New-Object 'System.Collections.Generic.List[string]'

if ($All) {
    $projectContainerIds = & docker ps -aq --filter "label=com.docker.compose.project=$ProjectName"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to query project containers."
    }

    foreach ($id in $projectContainerIds) {
        $trimmed = "$id".Trim()
        if ($trimmed -ne "") {
            $containerIds.Add($trimmed)
        }
    }
} else {
    foreach ($service in $selectedServices) {
        $serviceContainerIds = & docker ps -aq --filter "label=com.docker.compose.project=$ProjectName" --filter "label=com.docker.compose.service=$service"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to query containers for service '$service'."
        }

        foreach ($id in $serviceContainerIds) {
            $trimmed = "$id".Trim()
            if ($trimmed -ne "") {
                $containerIds.Add($trimmed)
            }
        }
    }
}

$uniqueIds = @($containerIds | Select-Object -Unique)
if ($uniqueIds.Count -eq 0) {
    Write-Host "No matching containers found for project '$ProjectName'."
    exit 0
}

if ($All) {
    Write-Host "Removing stale Compose containers for project '$ProjectName'..." -ForegroundColor Yellow
} else {
    Write-Host "Removing stale Compose containers for project '$ProjectName' and services: $($selectedServices -join ', ')" -ForegroundColor Yellow
}

& docker rm -f @uniqueIds
if ($LASTEXITCODE -ne 0) {
    throw "Failed to remove one or more containers."
}

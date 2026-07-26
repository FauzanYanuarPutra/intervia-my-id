[CmdletBinding()]
param(
    [switch]$PersistUser,
    [switch]$Quiet,
    [switch]$IncludeRustupHome
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$CacheRoot = Join-Path $RepoRoot ".cache"
$TempRoot = Join-Path $RepoRoot ".tmp"

$PathMap = [ordered]@{
    Temp                 = Join-Path $TempRoot "user-temp"
    NpmCache             = Join-Path $CacheRoot "npm"
    YarnCache            = Join-Path $CacheRoot "yarn"
    PnpmHome             = Join-Path $CacheRoot "pnpm-home"
    PnpmStore            = Join-Path $CacheRoot "pnpm-store"
    CorepackHome         = Join-Path $CacheRoot "corepack"
    PlaywrightBrowsers   = Join-Path $CacheRoot "ms-playwright"
    PipCache             = Join-Path $CacheRoot "pip"
    CargoHome            = Join-Path $CacheRoot "cargo"
    CargoTarget          = Join-Path $CacheRoot "cargo-target"
    RustupHome           = Join-Path $CacheRoot "rustup-home"
    MixHome              = Join-Path $CacheRoot "mix-home"
    HexHome              = Join-Path $CacheRoot "hex-home"
    RebarCache           = Join-Path $CacheRoot "rebar-cache"
    GoCache              = Join-Path $CacheRoot "go-build"
    GoModCache           = Join-Path $CacheRoot "go-mod"
    PythonPycache        = Join-Path $CacheRoot "python-pycache"
    EslintCache          = Join-Path $CacheRoot "eslint\.eslintcache"
}

foreach ($path in $PathMap.Values) {
    $directory = if ([IO.Path]::GetExtension($path)) {
        Split-Path -Parent $path
    } else {
        $path
    }
    if ($directory -and -not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }
}

$ProcessEnv = [ordered]@{
    TEMP                     = $PathMap.Temp
    TMP                      = $PathMap.Temp
    TMPDIR                   = $PathMap.Temp
    NPM_CONFIG_CACHE         = $PathMap.NpmCache
    YARN_CACHE_FOLDER        = $PathMap.YarnCache
    PNPM_HOME                = $PathMap.PnpmHome
    PNPM_STORE_DIR           = $PathMap.PnpmStore
    NPM_CONFIG_STORE_DIR     = $PathMap.PnpmStore
    COREPACK_HOME            = $PathMap.CorepackHome
    PLAYWRIGHT_BROWSERS_PATH = $PathMap.PlaywrightBrowsers
    PIP_CACHE_DIR            = $PathMap.PipCache
    CARGO_HOME               = $PathMap.CargoHome
    CARGO_TARGET_DIR         = $PathMap.CargoTarget
    MIX_HOME                 = $PathMap.MixHome
    HEX_HOME                 = $PathMap.HexHome
    REBAR_CACHE_DIR          = $PathMap.RebarCache
    GOCACHE                  = $PathMap.GoCache
    GOMODCACHE               = $PathMap.GoModCache
    PYTHONPYCACHEPREFIX      = $PathMap.PythonPycache
    ESLINT_CACHE_LOCATION    = $PathMap.EslintCache
    NEXT_TELEMETRY_DISABLED  = "1"
}

if ($IncludeRustupHome) {
    $ProcessEnv.RUSTUP_HOME = $PathMap.RustupHome
}

foreach ($entry in $ProcessEnv.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, "Process")
}

if ($PersistUser) {
    $UserEnvKeys = @(
        "TEMP",
        "TMP",
        "TMPDIR",
        "NPM_CONFIG_CACHE",
        "YARN_CACHE_FOLDER",
        "PNPM_HOME",
        "PNPM_STORE_DIR",
        "NPM_CONFIG_STORE_DIR",
        "COREPACK_HOME",
        "PLAYWRIGHT_BROWSERS_PATH",
        "PIP_CACHE_DIR",
        "CARGO_HOME",
        "CARGO_TARGET_DIR",
        "MIX_HOME",
        "HEX_HOME",
        "REBAR_CACHE_DIR",
        "GOCACHE",
        "GOMODCACHE",
        "PYTHONPYCACHEPREFIX",
        "ESLINT_CACHE_LOCATION",
        "NEXT_TELEMETRY_DISABLED"
    )
    if ($IncludeRustupHome) {
        $UserEnvKeys += "RUSTUP_HOME"
    }
    $UserEnvironmentKey = "HKCU:\Environment"
    if (-not (Test-Path -LiteralPath $UserEnvironmentKey)) {
        New-Item -Path $UserEnvironmentKey -Force | Out-Null
    }
    foreach ($key in $UserEnvKeys) {
        New-ItemProperty `
            -Path $UserEnvironmentKey `
            -Name $key `
            -Value ([string]$ProcessEnv[$key]) `
            -PropertyType String `
            -Force | Out-Null
    }
}

if (-not $Quiet) {
    Write-Host "Lajukan storage env is using D: repo paths:" -ForegroundColor Green
    Write-Host "  TEMP/TMP: $($PathMap.Temp)"
    Write-Host "  npm:      $($PathMap.NpmCache)"
    Write-Host "  pip:      $($PathMap.PipCache)"
    Write-Host "  cargo:    $($PathMap.CargoHome)"
    Write-Host "  target:   $($PathMap.CargoTarget)"
    Write-Host "  browser:  $($PathMap.PlaywrightBrowsers)"
    if ($PersistUser) {
        Write-Host "Persisted for new user terminals. Reopen terminal to inherit it." -ForegroundColor Yellow
    }
    if (-not $IncludeRustupHome) {
        Write-Host "Rustup toolchains are not moved. Use -IncludeRustupHome only after migrating/reinstalling Rust toolchains to D." -ForegroundColor DarkYellow
    }
}

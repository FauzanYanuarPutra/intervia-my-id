param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Executable,
    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = "Stop"

$EnvScript = Join-Path $PSScriptRoot "use-d-drive-env.ps1"
if (-not (Test-Path -LiteralPath $EnvScript)) {
    throw "Storage env script not found: $EnvScript"
}

. $EnvScript -Quiet

& $Executable @Arguments
exit $LASTEXITCODE

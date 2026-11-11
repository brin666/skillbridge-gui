param(
    [string]$DataDir = 'D:/SkillBridgeData/codex-local',
    [int]$ApiPort = 17322,
    [int]$GuiPort = 5174,
    [switch]$Refresh,
    [ValidateSet('codex', 'claude', 'hermes', 'pi', 'all')]
    [string[]]$Harness = @('codex'),
    [string]$Project = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (!$Project) { $Project = $projectRoot }
$profilePath = [System.IO.Path]::GetFullPath($DataDir)
$pythonExe = (Get-Command python -ErrorAction Stop).Source
$nodeExe = (Get-Command node -ErrorAction Stop).Source

function Test-ProfileService([string]$BaseUrl) {
    try {
        $state = Invoke-RestMethod "$BaseUrl/api/v1/status" -TimeoutSec 3
        return [System.IO.Path]::GetFullPath($state.dataHome) -eq $profilePath
    } catch { return $false }
}

# Preserve existing services: validate both ports before creating any new process.
$apiListener = Get-NetTCPConnection -LocalPort $ApiPort -State Listen -ErrorAction SilentlyContinue
$guiListener = Get-NetTCPConnection -LocalPort $GuiPort -State Listen -ErrorAction SilentlyContinue
if ($apiListener -and !(Test-ProfileService "http://127.0.0.1:$ApiPort")) {
    throw "Port $ApiPort belongs to another service or profile. No process was stopped."
}
if ($guiListener -and !(Test-ProfileService "http://127.0.0.1:$GuiPort")) {
    throw "Port $GuiPort belongs to another service or profile. No process was stopped."
}
if ($Refresh) {
    & $pythonExe (Join-Path $projectRoot 'scripts/harness_inventory.py') --data-dir $profilePath --project $Project --harness @Harness
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 2) { throw 'Inventory failed. See the error above.' }
    if ($LASTEXITCODE -eq 2) { Write-Warning 'Some resources were not registered. See harness-inventory.json in the profile.' }
}
$logDir = Join-Path $profilePath 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
if (!$apiListener) {
    Start-Process -FilePath $pythonExe -ArgumentList @('backend/main.py', 'workspace', '--data-dir', ('"{0}"' -f $profilePath), 'serve', '--port', $ApiPort) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'api.stdout.log') -RedirectStandardError (Join-Path $logDir 'api.stderr.log') | Out-Null
}
if (!$guiListener) {
    $priorTarget = $env:SKILLBRIDGE_API_TARGET
    try {
        $env:SKILLBRIDGE_API_TARGET = "http://127.0.0.1:$ApiPort"
        Start-Process -FilePath $nodeExe -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', $GuiPort, '--strictPort') -WorkingDirectory (Join-Path $projectRoot 'ui') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'gui.stdout.log') -RedirectStandardError (Join-Path $logDir 'gui.stderr.log') | Out-Null
    } finally { $env:SKILLBRIDGE_API_TARGET = $priorTarget }
}
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (Test-ProfileService "http://127.0.0.1:$GuiPort") {
        Write-Output "SkillBridge: http://127.0.0.1:$GuiPort/"
        Write-Output "Profile: $profilePath"
        exit 0
    }
    Start-Sleep -Milliseconds 500
}
throw "GUI did not become ready. Check logs in $logDir; no existing process was stopped."

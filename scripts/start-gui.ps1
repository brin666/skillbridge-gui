param(
    [string]$DataDir = $(if ($env:SKILLBRIDGE_HOME) { $env:SKILLBRIDGE_HOME } else { Join-Path $HOME '.skillbridge' }),
    [int]$ApiPort = 17323,
    [int]$GuiPort = 5175,
    [ValidateSet('codex', 'claude', 'hermes', 'pi', 'all')]
    [string[]]$Harness = @('all'),
    [string]$Project = '',
    [switch]$Refresh
)
# Keep the original launcher and its port/profile guards as the single startup path.
& (Join-Path $PSScriptRoot 'start-codex.ps1') -DataDir $DataDir -ApiPort $ApiPort -GuiPort $GuiPort -Harness $Harness -Project $Project -Refresh:$Refresh
exit $LASTEXITCODE

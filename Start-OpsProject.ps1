<#
.SYNOPSIS
    Starts the OPS Project stack (db, backend, frontend) via Docker Desktop.

.PARAMETER RegisterTask
    Install this script as a Windows Scheduled Task that runs at every login.

.EXAMPLE
    # First time setup - register the scheduled task:
    .\Start-OpsProject.ps1 -RegisterTask

    # Manual start:
    .\Start-OpsProject.ps1
#>
param(
    [switch]$RegisterTask
)

$ProjectDir     = $PSScriptRoot
$LogFile        = Join-Path $ProjectDir "docker-startup.log"
$MaxWaitSeconds = 60

if ($RegisterTask) {
    $scriptPath = $MyInvocation.MyCommand.Path
    $action  = New-ScheduledTaskAction -Execute "powershell.exe" `
                   -Argument "-WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
                    -StartWhenAvailable -MultipleInstances IgnoreNew
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName "OpsProject-DockerStart" `
        -Action $action -Trigger $trigger -Settings $settings `
        -Principal $principal `
        -Description "Starts OPS Project Docker containers at login" `
        -Force | Out-Null
    Write-Host "Scheduled Task 'OpsProject-DockerStart' registered - runs at every login." -ForegroundColor Green
    Write-Host "To remove: Unregister-ScheduledTask -TaskName 'OpsProject-DockerStart' -Confirm:`$false"
    exit 0
}

function Log {
    param([string]$Message, [string]$Color = "White")
    $ts   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $Message"
    Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
    Write-Host $line -ForegroundColor $Color
}

Log "==================================================" "Cyan"
Log "  OPS Project Docker Startup" "Cyan"
Log "==================================================" "Cyan"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Log "ERROR: Docker CLI was not found. Install Docker Desktop and try again." "Red"
    exit 1
}

Log "-> Starting Docker containers..." "Yellow"
Push-Location $ProjectDir
docker compose up -d 2>&1 | ForEach-Object { Log "   $_" }
$composeResult = $LASTEXITCODE
Pop-Location

if ($composeResult -ne 0) {
    Log "ERROR: docker compose failed. Check $LogFile" "Red"
    exit 1
}
Log "Containers started." "Green"

Log "-> Waiting for services to be ready..." "Yellow"
Start-Sleep 6

$services = @(
    @{ Name = "Frontend"; Url = "http://localhost:3000" },
    @{ Name = "Backend";  Url = "http://localhost:8000" },
    @{ Name = "API Docs"; Url = "http://localhost:8000/docs" }
)
foreach ($svc in $services) {
    $ok = $false
    for ($i = 0; $i -lt 12; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $svc.Url -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -lt 500) { $ok = $true; break }
        } catch {}
        Start-Sleep 2
    }
    if ($ok) {
        Log "[OK] $($svc.Name) -> $($svc.Url)" "Green"
    } else {
        Log "[??] $($svc.Name) not yet responding -> $($svc.Url)" "DarkYellow"
    }
}

Log "==================================================" "Cyan"
Log "  Frontend : http://localhost:3000" "Cyan"
Log "  Backend  : http://localhost:8000" "Cyan"
Log "  API Docs : http://localhost:8000/docs" "Cyan"
Log "==================================================" "Cyan"

# Adhiparasakthi Hospitals - Database Backup & Restore Utility (PowerShell)
param (
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet("backup", "restore", "check")]
    [string]$Action,

    [Parameter(Position = 1)]
    [string]$Path,

    [switch]$Force,

    [string]$MongoUri
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BackupDir = Join-Path $RootDir "backups"
$EnvFile = Join-Path $RootDir "server\.env"

if (-not $MongoUri) {
    if ($env:MONGO_URI) {
        $MongoUri = $env:MONGO_URI
    } elseif (Test-Path $EnvFile) {
        Get-Content $EnvFile | ForEach-Object {
            if ($_ -match '^MONGO_URI=(.*)$') {
                $MongoUri = $matches[1].Trim()
            }
        }
    }
}
if (-not $MongoUri) {
    $MongoUri = "mongodb://localhost:27017/incident_db"
}

$SafeUri = $MongoUri -replace 'mongodb(\+srv)?://([^:]+):([^@]+)@', 'mongodb$1://$2:****@'

function Show-Header {
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host "  Adhiparasakthi Hospitals - Database Utility" -ForegroundColor Cyan
    Write-Host "  Target: $SafeUri" -ForegroundColor Gray
    Write-Host "==================================================================" -ForegroundColor Cyan
}

function Test-MongoTools {
    $dump = Get-Command mongodump -ErrorAction SilentlyContinue
    $restore = Get-Command mongorestore -ErrorAction SilentlyContinue
    $missing = $false

    if ($dump) {
        Write-Host "[OK] 'mongodump' is available" -ForegroundColor Green
    } else {
        Write-Host "[WARN] 'mongodump' command not found in PATH." -ForegroundColor Yellow
        $missing = $true
    }

    if ($restore) {
        Write-Host "[OK] 'mongorestore' is available" -ForegroundColor Green
    } else {
        Write-Host "[WARN] 'mongorestore' command not found in PATH." -ForegroundColor Yellow
        $missing = $true
    }

    if ($missing) {
        Write-Host "`nTo install MongoDB Database Tools on Windows:" -ForegroundColor Cyan
        Write-Host "  Run: choco install mongodb-database-tools" -ForegroundColor White
        Write-Host "  Or download MSI installer from https://www.mongodb.com/try/download/database-tools" -ForegroundColor White
        return $false
    }
    return $true
}

function Invoke-DbBackup {
    param ([string]$TargetDir)
    Show-Header
    if (-not (Test-MongoTools)) { exit 1 }

    if (-not $TargetDir) { $TargetDir = $BackupDir }
    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $archiveName = "incident_db_backup_$timestamp.gz"
    $archivePath = Join-Path $TargetDir $archiveName

    Write-Host "`nInitiating database backup..." -ForegroundColor Cyan
    Write-Host "Destination: $archivePath" -ForegroundColor Gray

    & mongodump --uri="$MongoUri" --archive="$archivePath" --gzip
    if ($LASTEXITCODE -ne 0) {
        Write-Host "mongodump failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    $fileItem = Get-Item $archivePath
    $bytes = $fileItem.Length
    $sizeMb = [math]::Round($bytes / 1048576, 2)
    Write-Host "`nBackup successfully created!" -ForegroundColor Green
    Write-Host "File: $archivePath - $sizeMb MB" -ForegroundColor White
    Write-Host "To restore: .\scripts\backup_restore.ps1 -Action restore -Path '$archivePath'" -ForegroundColor Gray
}

function Invoke-DbRestore {
    param ([string]$SourcePath, [bool]$IsForced)
    Show-Header
    if (-not (Test-MongoTools)) { exit 1 }

    if (-not $SourcePath) {
        Write-Host "Error: -Path argument required." -ForegroundColor Red
        exit 1
    }

    if (-not (Test-Path $SourcePath)) {
        Write-Host "Error: Backup file or directory does not exist: $SourcePath" -ForegroundColor Red
        exit 1
    }

    Write-Host "`nWARNING: Restoring will overwrite existing collections in:" -ForegroundColor Yellow
    Write-Host "Target: $SafeUri" -ForegroundColor White

    if (-not $IsForced) {
        $confirm = Read-Host "Are you sure you want to proceed with database restore? [y/N]"
        if ($confirm -ne 'y' -and $confirm -ne 'Y') {
            Write-Host "Operation cancelled by user." -ForegroundColor Gray
            exit 0
        }
    }

    Write-Host "`nRestoring database..." -ForegroundColor Cyan
    if (Test-Path $SourcePath -PathType Leaf) {
        & mongorestore --uri="$MongoUri" --archive="$SourcePath" --gzip --drop
    } else {
        & mongorestore --uri="$MongoUri" "$SourcePath" --drop
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "mongorestore failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "`nDatabase restore completed successfully!" -ForegroundColor Green
}

switch ($Action) {
    "backup"  { Invoke-DbBackup -TargetDir $Path }
    "restore" { Invoke-DbRestore -SourcePath $Path -IsForced $Force.IsPresent }
    "check"   { Show-Header; Test-MongoTools | Out-Null }
}

# build.ps1 — Clean build script for Next.js
# Usage: .\scripts\build.ps1
param([switch]$SkipClean)

$ErrorActionPreference = 'Continue'
Set-Location "$PSScriptRoot\.."

if (-not $SkipClean) {
    Write-Host "`n[1/3] Cleaning .next cache..." -ForegroundColor Cyan
    if (Test-Path .next) {
        Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "[2/3] Building Next.js..." -ForegroundColor Cyan
$env:NODE_OPTIONS = "--max-old-space-size=4096"

# Use & to invoke directly — avoids Start-Process batch prompt issues
& npx next build
$code = $LASTEXITCODE

if ($code -eq 0) {
    Write-Host "`n[3/3] BUILD OK" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[3/3] BUILD FAILED (exit code: $code)" -ForegroundColor Red
    exit 1
}

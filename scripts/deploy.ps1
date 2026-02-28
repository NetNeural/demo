<#
.SYNOPSIS
    NetNeural stage-gated deploy script.
    Progressively deploys through dev -> staging -> prod with validation gates.

.DESCRIPTION
    Stage-gated deployment flow:
      1. Build verification (local)
      2. Commit & push to STAGING repo
      3. Cherry-pick to DEV  -> GitHub Actions deploys -> user validates on demo.netneural.ai
      4. Cherry-pick to STAGING -> GitHub Actions deploys -> user validates on demo-stage.netneural.ai
      5. Cherry-pick to PROD -> GitHub Actions deploys -> user validates on sentinel.netneural.ai

    At each gate the script pauses, opens the site URL, and asks you to confirm
    before promoting to the next environment. You can abort at any gate.

.PARAMETER Message
    Commit message. If omitted, you'll be prompted interactively.

.PARAMETER Target
    Deploy target: "dev" (dev only), "staging" (dev+staging), "prod" (dev+staging+prod), or "all" (same as prod).
    Default: "all" (full promotion through all 3 environments).

.PARAMETER EdgeFunctions
    Also deploy edge functions to each Supabase project as you promote.

.PARAMETER SkipBuild
    Skip the local build verification (use when you've already built).

.PARAMETER NoGate
    Skip validation prompts - deploy straight through without pausing.

.PARAMETER DryRun
    Show what would happen without actually executing.

.EXAMPLE
    .\scripts\deploy.ps1 -m "fix: button label"
    .\scripts\deploy.ps1 -m "feat: new feature" -Target dev
    .\scripts\deploy.ps1 -m "hotfix: critical" -EdgeFunctions
    .\scripts\deploy.ps1 -Target all -SkipBuild -NoGate
#>

param(
    [Alias("m")]
    [string]$Message,

    [ValidateSet("dev", "staging", "prod", "all")]
    [string]$Target = "all",

    [Alias("e")]
    [switch]$EdgeFunctions,

    [switch]$SkipBuild,

    [switch]$NoGate,

    [switch]$DryRun
)

# --- Configuration -----------------------------------------------------------
$STAGING_DIR  = "C:\Demo-Stage\MonoRepo-Staging"
$DEV_DIR      = "C:\Demo-Stage\demo"
$PROD_DIR     = "C:\Demo-Stage\MonoRepo-prod"
$DEV_DIR_NAME = "development"

$ENV_URLS = @{
    dev     = "https://demo.netneural.ai"
    staging = "https://demo-stage.netneural.ai"
    prod    = "https://sentinel.netneural.ai"
}

# Supabase project refs
$SUPABASE_REF_DEV     = "tsomafkalaoarnuwgdyu"
$SUPABASE_REF_STAGING = "atgbmxicqikmapfqouco"
$SUPABASE_REF_PROD    = "bldojxpockljyivldxwf"

# Build env vars (dummy values for local static build verification)
$BUILD_ENV = @{
    NEXT_PUBLIC_SUPABASE_URL      = "https://${SUPABASE_REF_DEV}.supabase.co"
    NEXT_PUBLIC_SUPABASE_ANON_KEY = "build-verification-only"
}

# Determine which environments to deploy based on Target
$envOrder = @("dev", "staging", "prod")
$targetIndex = switch ($Target) {
    "dev"     { 0 }
    "staging" { 1 }
    "prod"    { 2 }
    "all"     { 2 }
}
$deployEnvs = $envOrder[0..$targetIndex]

# --- Helpers ------------------------------------------------------------------
function Write-Step  { param([string]$Msg) Write-Host "`n>> $Msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Msg) Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "  [WARN] $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "  [FAIL] $Msg" -ForegroundColor Red }
function Write-Info  { param([string]$Msg) Write-Host "  $Msg" -ForegroundColor Gray }

function Write-Gate {
    param([string]$EnvName, [string]$Url, [string]$NextEnv)
    Write-Host ""
    Write-Host "  =============================================" -ForegroundColor Yellow
    Write-Host "  GATE: $EnvName deployed" -ForegroundColor Yellow
    Write-Host "  =============================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Test at: " -NoNewline -ForegroundColor White
    Write-Host "$Url" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Validate the deployment, then:" -ForegroundColor Gray
    Write-Host "    Y = Promote to $NextEnv" -ForegroundColor Green
    Write-Host "    N = Stop here (already deployed to $EnvName)" -ForegroundColor Yellow
    Write-Host ""
}

function Abort {
    param([string]$Msg)
    Write-Err $Msg
    Pop-Location -ErrorAction SilentlyContinue
    exit 1
}

function Run {
    param([string]$Cmd, [string]$Label)
    if ($DryRun) {
        Write-Info "[dry-run] $Cmd"
        return "DRY-RUN"
    }
    if ($Label) { Write-Info $Label }
    $output = Invoke-Expression $Cmd 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Command failed: $Cmd"
        $output | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
        Abort "Aborting deploy."
    }
    return $output
}

function Deploy-EdgeFunctions {
    param([string]$EnvName, [string]$Ref)
    if (-not $EdgeFunctions) { return }

    Write-Info "Deploying edge functions to $EnvName ($Ref)..."
    if (-not $DryRun) {
        Push-Location "$STAGING_DIR\$DEV_DIR_NAME"
        $efOutput = npx supabase functions deploy --project-ref $Ref --no-verify-jwt 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "Edge function deploy to $EnvName had issues:"
            $efOutput | Select-Object -Last 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
        } else {
            Write-Ok "Edge functions deployed to $EnvName"
        }
        Pop-Location
    } else {
        Write-Info "[dry-run] npx supabase functions deploy --project-ref $Ref --no-verify-jwt"
    }
}

function Wait-ForGate {
    param([string]$EnvName, [string]$Url, [string]$NextEnv)

    if ($NoGate -or $DryRun) { return $true }

    # Open the site in the default browser
    Start-Process $Url

    Write-Gate $EnvName $Url $NextEnv

    do {
        $response = Read-Host "  Promote to $NextEnv? (Y/N)"
        $response = $response.Trim().ToUpper()
    } while ($response -notin @("Y", "N", "YES", "NO"))

    if ($response -in @("N", "NO")) {
        Write-Warn "Stopped at $EnvName. Deployment complete up to this point."
        return $false
    }
    Write-Ok "Gate passed - promoting to $NextEnv"
    return $true
}

# --- Banner -------------------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host "  NetNeural Stage-Gated Deploy" -ForegroundColor White
Write-Host "  Pipeline: $($deployEnvs -join ' -> ')" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor DarkCyan

# --- Pre-flight checks -------------------------------------------------------
Write-Step "Pre-flight checks"

# Verify staging repo
if (-not (Test-Path "$STAGING_DIR\$DEV_DIR_NAME\package.json")) {
    Abort "Staging repo not found at $STAGING_DIR"
}
Write-Ok "Staging repo found"

# Verify we're on staging branch
Push-Location $STAGING_DIR
$currentBranch = git rev-parse --abbrev-ref HEAD 2>$null
if ($currentBranch -ne "staging") {
    Pop-Location
    Abort "Not on staging branch (on '$currentBranch'). Switch to staging first."
}
Write-Ok "On staging branch"

# Check for uncommitted changes
$status = git status --porcelain
$hasChanges = $status -and $status.Length -gt 0

if (-not $hasChanges) {
    $unpushed = git log "origin/staging..staging" --oneline 2>$null
    if (-not $unpushed) {
        Pop-Location
        Abort "Nothing to deploy - no uncommitted changes and no unpushed commits."
    }
    Write-Ok "Found unpushed commits to deploy"
    $needsCommit = $false
} else {
    $changedFiles = ($status | Measure-Object).Count
    Write-Ok "$changedFiles file(s) with uncommitted changes"
    $needsCommit = $true
}

# Verify target repos exist
if ("dev" -in $deployEnvs) {
    if (-not (Test-Path "$DEV_DIR\.git")) { Pop-Location; Abort "Dev repo not found at $DEV_DIR" }
    Write-Ok "Dev repo found"
}
if ("prod" -in $deployEnvs) {
    if (-not (Test-Path "$PROD_DIR\.git")) { Pop-Location; Abort "Prod repo not found at $PROD_DIR" }
    Write-Ok "Prod repo found"
}

Pop-Location

# --- Get commit message -------------------------------------------------------
if ($needsCommit) {
    if (-not $Message) {
        Write-Host ""
        $Message = Read-Host "  Commit message"
        if (-not $Message) { Abort "Commit message is required." }
    }
    Write-Ok "Message: $Message"
}

# --- Build verification -------------------------------------------------------
if (-not $SkipBuild) {
    Write-Step "Build verification"

    Push-Location "$STAGING_DIR\$DEV_DIR_NAME"

    foreach ($key in $BUILD_ENV.Keys) {
        Set-Item -Path "env:$key" -Value $BUILD_ENV[$key]
    }

    Write-Info "Running: npx next build"
    $buildStart = Get-Date
    $buildOutput = npx next build 2>&1
    $buildExitCode = $LASTEXITCODE
    $buildDuration = [math]::Round(((Get-Date) - $buildStart).TotalSeconds, 1)

    foreach ($key in $BUILD_ENV.Keys) {
        Remove-Item -Path "env:$key" -ErrorAction SilentlyContinue
    }

    Pop-Location

    if ($buildExitCode -ne 0) {
        Write-Err "Build failed!"
        $buildOutput | Select-Object -Last 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
        Abort "Fix build errors before deploying."
    }

    $compiled = $buildOutput | Where-Object { $_ -match "Compiled successfully" } | Select-Object -First 1
    if ($compiled) { Write-Ok ($compiled -replace '^\s+', '') }
    Write-Ok "Build passed (${buildDuration}s)"
} else {
    Write-Step "Build verification -- SKIPPED"
    Write-Warn "Skipping build (--SkipBuild). Make sure you've verified locally."
}

# --- Commit & push to staging repo (source of truth) -------------------------
Write-Step "Commit to staging repo (source of truth)"

Push-Location $STAGING_DIR

if ($needsCommit) {
    Run "git add -A" "Staging files..."
    Run "git commit -m '$($Message -replace "'","''")'" "Committing..."
}

$commitHash = (git rev-parse --short HEAD) 2>$null
$commitHashFull = (git rev-parse HEAD) 2>$null
Write-Ok "Commit: $commitHash"

Run "git push origin staging" "Pushing to staging repo..."
Write-Ok "Pushed to staging repo"

Pop-Location

$results = [ordered]@{}
$stopped = $false

# ==============================================================================
# STAGE 1: DEV
# ==============================================================================
if ("dev" -in $deployEnvs -and -not $stopped) {
    Write-Step "STAGE 1/$(($deployEnvs).Count): Deploy to DEV"

    Push-Location $DEV_DIR

    Run "git fetch staging" "Fetching from staging..."

    if ($DryRun) {
        Write-Info "[dry-run] git checkout staging/staging -- development/"
        Write-Info "[dry-run] git commit (sync from staging $commitHash)"
        $devHash = "DRY-RUN"
    } else {
        # Copy development/ directory from staging — no conflicts possible
        git checkout staging/staging -- development/ 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Failed to checkout development/ from staging!"
            Pop-Location
            Abort "Checkout from staging failed."
        }
        git add -A 2>&1 | Out-Null
        git diff --cached --quiet 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            git commit -m "$($Message -replace "'","''") (sync from staging $commitHash)" 2>&1 | Out-Null
        } else {
            Write-Info "No changes to sync (dev already matches staging)"
        }
        $devHash = (git rev-parse --short HEAD) 2>$null
    }
    Write-Ok "Commit: $devHash"

    Run "git push origin main" "Pushing to dev..."
    Write-Ok "Deployed to DEV -> demo.netneural.ai"

    Pop-Location
    $results.dev = $devHash

    # Deploy edge functions to dev
    Deploy-EdgeFunctions "DEV" $SUPABASE_REF_DEV

    # --- GATE: Dev -> Staging -------------------------------------------------
    if ("staging" -in $deployEnvs) {
        $proceed = Wait-ForGate "DEV" $ENV_URLS.dev "STAGING"
        if (-not $proceed) { $stopped = $true }
    }
}

# ==============================================================================
# STAGE 2: STAGING
# ==============================================================================
if ("staging" -in $deployEnvs -and -not $stopped) {
    Write-Step "STAGE 2/$(($deployEnvs).Count): Deploy to STAGING"

    # Staging repo already has the commit pushed. GitHub Actions will build it.
    # The commit was pushed in the "Commit to staging repo" step above.
    Write-Ok "Commit: $commitHash (already pushed to staging repo)"
    Write-Ok "GitHub Actions will deploy -> demo-stage.netneural.ai"

    $results.staging = $commitHash

    # Deploy edge functions to staging
    Deploy-EdgeFunctions "STAGING" $SUPABASE_REF_STAGING

    # --- GATE: Staging -> Prod ------------------------------------------------
    if ("prod" -in $deployEnvs) {
        $proceed = Wait-ForGate "STAGING" $ENV_URLS.staging "PROD"
        if (-not $proceed) { $stopped = $true }
    }
}

# ==============================================================================
# STAGE 3: PROD
# ==============================================================================
if ("prod" -in $deployEnvs -and -not $stopped) {
    Write-Step "STAGE 3/$(($deployEnvs).Count): Deploy to PROD"

    Push-Location $PROD_DIR

    Run "git fetch staging" "Fetching from staging..."

    if ($DryRun) {
        Write-Info "[dry-run] git checkout staging/staging -- development/"
        Write-Info "[dry-run] git commit (sync from staging $commitHash)"
        $prodHash = "DRY-RUN"
    } else {
        # Copy development/ directory from staging — no conflicts possible
        git checkout staging/staging -- development/ 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Failed to checkout development/ from staging!"
            Pop-Location
            Abort "Checkout from staging failed."
        }
        git add -A 2>&1 | Out-Null
        git diff --cached --quiet 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            git commit -m "$($Message -replace "'","''") (sync from staging $commitHash)" 2>&1 | Out-Null
        } else {
            Write-Info "No changes to sync (prod already matches staging)"
        }
        $prodHash = (git rev-parse --short HEAD) 2>$null
    }
    Write-Ok "Commit: $prodHash"

    Run "git push origin main" "Pushing to prod..."
    Write-Ok "Deployed to PROD -> sentinel.netneural.ai"

    Pop-Location
    $results.prod = $prodHash

    # Deploy edge functions to prod
    Deploy-EdgeFunctions "PROD" $SUPABASE_REF_PROD

    # --- Final validation (prod) ----------------------------------------------
    if (-not $NoGate -and -not $DryRun) {
        Start-Process $ENV_URLS.prod
        Write-Host ""
        Write-Host "  =============================================" -ForegroundColor Green
        Write-Host "  PROD deployed - verify at sentinel.netneural.ai" -ForegroundColor Green
        Write-Host "  =============================================" -ForegroundColor Green
        Write-Host ""
    }
}

# --- Summary ------------------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host "  Deploy Complete" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor DarkCyan
Write-Host ""

if ($results.dev)     { Write-Host "  Dev      : $($results.dev)  -> demo.netneural.ai" -ForegroundColor White }
if ($results.staging) { Write-Host "  Staging  : $($results.staging)  -> demo-stage.netneural.ai" -ForegroundColor White }
if ($results.prod)    { Write-Host "  Prod     : $($results.prod)  -> sentinel.netneural.ai" -ForegroundColor White }
if ($EdgeFunctions)   { Write-Host "  Edge Fn  : deployed" -ForegroundColor White }

$stoppedEarly = $stopped
if ($stoppedEarly) {
    $lastEnv = if ($results.staging) { "STAGING" } elseif ($results.dev) { "DEV" } else { "none" }
    Write-Warn "Stopped at $lastEnv gate. Run again with -Target to continue."
}

Write-Host ""
if (-not $DryRun) {
    Write-Host "  GitHub Actions will build & deploy each environment with its own env vars." -ForegroundColor Gray
    Write-Host "  Monitor: https://github.com/NetNeural/MonoRepo-Staging/actions" -ForegroundColor Gray
}
Write-Host ""

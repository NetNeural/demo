# NetNeural Deployment Script (PowerShell)
# This script deploys both Supabase backend and GitHub Pages frontend

param(
    [switch]$SkipTests,
    [switch]$Force
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if we're in the right directory
if (-not (Test-Path "development\package.json")) {
    Write-Error "Please run this script from the project root directory"
    exit 1
}

# Change to development directory
Set-Location "development"

Write-Status "Starting NetNeural deployment process..."

# Check for required tools
Write-Status "Checking required tools..."

try {
    $nodeVersion = node --version
    Write-Success "Node.js found: $nodeVersion"
} catch {
    Write-Error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
}

try {
    $npmVersion = npm --version
    Write-Success "npm found: $npmVersion"
} catch {
    Write-Error "npm is not installed. Please install npm and try again."
    exit 1
}

try {
    $supabaseVersion = supabase --version
    Write-Success "Supabase CLI found: $supabaseVersion"
} catch {
    Write-Error "Supabase CLI is not installed. Please install it with: npm install -g supabase"
    exit 1
}

# Check environment variables
Write-Status "Checking environment variables..."

$requiredVars = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_ACCESS_TOKEN"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    if (-not (Get-Variable -Name $var -ErrorAction SilentlyContinue)) {
        if (-not [Environment]::GetEnvironmentVariable($var)) {
            $missingVars += $var
        }
    }
}

if ($missingVars.Count -gt 0) {
    Write-Error "Missing required environment variables:"
    foreach ($var in $missingVars) {
        Write-Host "  - $var" -ForegroundColor Red
    }
    Write-Warning "Please set these variables in your .env file or environment"
    exit 1
}

Write-Success "Environment variables configured"

# Install dependencies
Write-Status "Installing dependencies..."
npm ci
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install dependencies"
    exit 1
}
Write-Success "Dependencies installed"

# Run tests (unless skipped)
if (-not $SkipTests) {
    Write-Status "Running tests and linting..."
    npm run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Linting failed"
        exit 1
    }
    
    npm run test
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Tests failed"
        exit 1
    }
    Write-Success "Tests and linting passed"
} else {
    Write-Warning "Skipping tests and linting"
}

# Deploy Supabase
Write-Status "Deploying to Supabase..."

# Check if already linked
if (-not (Test-Path "supabase\.temp\project-ref")) {
    Write-Warning "Project not linked to Supabase. Attempting to link..."
    $projectRef = [Environment]::GetEnvironmentVariable("SUPABASE_PROJECT_REF")
    if ($projectRef) {
        supabase link --project-ref $projectRef
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to link Supabase project"
            exit 1
        }
    } else {
        Write-Error "SUPABASE_PROJECT_REF not set. Please set it or run 'supabase link' manually."
        exit 1
    }
}

# Push database migrations
Write-Status "Pushing database migrations..."
supabase db push
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push database migrations"
    exit 1
}

# Generate types
Write-Status "Generating TypeScript types..."
supabase gen types typescript --linked | Out-File -FilePath "packages\types\src\supabase.ts" -Encoding UTF8
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate TypeScript types"
    exit 1
}

Write-Success "Supabase deployment completed"

# Build for production
Write-Status "Building web application for production..."
$env:NODE_ENV = "production"
Set-Location "apps\web"

# Create production environment file
$envContent = @"
NEXT_PUBLIC_SUPABASE_URL=$([Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"))
NEXT_PUBLIC_SUPABASE_ANON_KEY=$([Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
"@

$envContent | Out-File -FilePath ".env.production" -Encoding UTF8

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build web application"
    exit 1
}
Write-Success "Web application built successfully"

# Check if build output exists
if (-not (Test-Path "out")) {
    Write-Error "Build output directory 'out' not found. Static export may have failed."
    exit 1
}

Write-Success "Static export completed. Files are ready in apps\web\out\"

# Return to development directory
Set-Location ".."

Write-Success "Deployment process completed successfully!"
Write-Status "Next steps:"
Write-Host "  1. Commit and push your changes to trigger GitHub Actions"
Write-Host "  2. Or manually deploy the 'apps\web\out' directory to your web server"
Write-Host "  3. Monitor the deployment in your GitHub repository's Actions tab"

# Display deployment URLs
Write-Host ""
Write-Status "Your application will be available at:"
try {
    $gitUrl = git config --get remote.origin.url
    $repoPath = $gitUrl -replace ".*github\.com[:/]", "" -replace "\.git$", ""
    $username = $repoPath.Split('/')[0]
    Write-Host "  📊 Dashboard: https://$username.github.io/SoftwareMono/"
} catch {
    Write-Host "  📊 Dashboard: https://[your-username].github.io/SoftwareMono/"
}
Write-Host "  🗄️  Database: $([Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"))"

Write-Success "🚀 Deployment script completed successfully!"

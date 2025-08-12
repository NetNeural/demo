#!/bin/bash

# NetNeural Deployment Script
# This script deploys both Supabase backend and GitHub Pages frontend

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "development/package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Change to development directory
cd development

print_status "Starting NetNeural deployment process..."

# Check for required tools
print_status "Checking required tools..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI is not installed. Please install it with: npm install -g supabase"
    exit 1
fi

print_success "All required tools are available"

# Check environment variables
print_status "Checking environment variables..."

required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_ACCESS_TOKEN"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    print_warning "Please set these variables in your .env file or environment"
    exit 1
fi

print_success "Environment variables configured"

# Install dependencies
print_status "Installing dependencies..."
npm ci
print_success "Dependencies installed"

# Run tests
print_status "Running tests and linting..."
npm run lint
npm run test
print_success "Tests and linting passed"

# Deploy Supabase
print_status "Deploying to Supabase..."

# Check if already linked
if [ ! -f "supabase/.temp/project-ref" ]; then
    print_warning "Project not linked to Supabase. Attempting to link..."
    if [ -n "$SUPABASE_PROJECT_REF" ]; then
        supabase link --project-ref "$SUPABASE_PROJECT_REF"
    else
        print_error "SUPABASE_PROJECT_REF not set. Please set it or run 'supabase link' manually."
        exit 1
    fi
fi

# Push database migrations
print_status "Pushing database migrations..."
supabase db push

# Generate types
print_status "Generating TypeScript types..."
supabase gen types typescript --linked > packages/types/src/supabase.ts

print_success "Supabase deployment completed"

# Build for production
print_status "Building web application for production..."
export NODE_ENV=production
cd apps/web

# Create production environment file
cat > .env.production << EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
EOF

npm run build
print_success "Web application built successfully"

# Check if build output exists
if [ ! -d "out" ]; then
    print_error "Build output directory 'out' not found. Static export may have failed."
    exit 1
fi

print_success "Static export completed. Files are ready in apps/web/out/"

# Return to development directory
cd ..

print_success "Deployment process completed successfully!"
print_status "Next steps:"
echo "  1. Commit and push your changes to trigger GitHub Actions"
echo "  2. Or manually deploy the 'apps/web/out' directory to your web server"
echo "  3. Monitor the deployment at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]//g' | sed 's/.git$//')/actions"

# Display deployment URLs
echo ""
print_status "Your application will be available at:"
echo "  📊 Dashboard: https://$(git config --get remote.origin.url | sed 's/.*github.com[:/]//g' | sed 's/.git$//' | cut -d'/' -f1).github.io/SoftwareMono/"
echo "  🗄️  Database: ${NEXT_PUBLIC_SUPABASE_URL}"

print_success "🚀 Deployment script completed successfully!"

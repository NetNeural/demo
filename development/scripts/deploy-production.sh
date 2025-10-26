#!/bin/bash

# =============================================================================
# NetNeural IoT Platform - Production Deployment Script
# =============================================================================
# This script deploys the application to production Supabase and GitHub Pages
#
# Prerequisites:
# - Supabase CLI installed (npm install -g supabase)
# - Logged in to Supabase (supabase login)
# - GitHub CLI installed (optional, for setting secrets)
# - Node.js 20+ installed
#
# Usage:
#   ./deploy-production.sh [options]
#
# Options:
#   --skip-backup       Skip database backup
#   --skip-functions    Skip edge functions deployment
#   --skip-db           Skip database migrations
#   --dry-run           Show what would be done without doing it
#   --help              Show this help message
#
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_REF="bldojxpockljyivldxwf"
PROJECT_URL="https://bldojxpockljyivldxwf.supabase.co"
GITHUB_REPO="NetNeural/MonoRepo"
GITHUB_PAGES_URL="https://netneural.github.io/MonoRepo"

# Default options
SKIP_BACKUP=false
SKIP_FUNCTIONS=false
SKIP_DB=false
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --skip-functions)
      SKIP_FUNCTIONS=true
      shift
      ;;
    --skip-db)
      SKIP_DB=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      grep "^#" "$0" | grep -v "#!/bin/bash" | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

run_command() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY RUN]${NC} Would run: $1"
    else
        eval "$1"
    fi
}

# Banner
echo "==================================================================="
echo "  NetNeural IoT Platform - Production Deployment"
echo "==================================================================="
echo ""
echo "Production Supabase: $PROJECT_REF"
echo "Target URL: $GITHUB_PAGES_URL"
echo "Dry Run: $DRY_RUN"
echo ""
echo "==================================================================="
echo ""

# Step 1: Pre-flight checks
log_info "Step 1: Pre-flight checks..."

# Check if in correct directory
if [ ! -f "package.json" ]; then
    log_error "Not in development directory. Please cd to development/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    log_error "Node.js 20+ required. Current: $(node -v)"
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    log_error "Supabase CLI not found. Install with: npm install -g supabase"
    exit 1
fi

# Check if logged in to Supabase
if ! supabase projects list &> /dev/null; then
    log_error "Not logged in to Supabase. Run: supabase login"
    exit 1
fi

log_success "Pre-flight checks passed"

# Step 2: Link to production project
log_info "Step 2: Linking to production Supabase project..."
run_command "supabase link --project-ref $PROJECT_REF"
log_success "Linked to production project"

# Step 3: Backup database (unless skipped)
if [ "$SKIP_BACKUP" = false ]; then
    log_info "Step 3: Creating database backup..."
    BACKUP_DIR="backups"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    run_command "mkdir -p $BACKUP_DIR"
    run_command "supabase db dump --project-ref $PROJECT_REF -f $BACKUP_DIR/production_backup_$TIMESTAMP.sql"
    
    log_success "Backup created: $BACKUP_DIR/production_backup_$TIMESTAMP.sql"
else
    log_warning "Skipping database backup (--skip-backup)"
fi

# Step 4: Run database migrations (unless skipped)
if [ "$SKIP_DB" = false ]; then
    log_info "Step 4: Running database migrations..."
    
    # Show diff first
    log_info "Checking migration diff..."
    run_command "supabase db diff --linked"
    
    if [ "$DRY_RUN" = false ]; then
        read -p "Continue with migrations? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warning "Skipping migrations"
        else
            run_command "supabase db push --linked"
            log_success "Migrations applied successfully"
        fi
    fi
else
    log_warning "Skipping database migrations (--skip-db)"
fi

# Step 5: Deploy edge functions (unless skipped)
if [ "$SKIP_FUNCTIONS" = false ]; then
    log_info "Step 5: Deploying edge functions..."
    
    FUNCTIONS=(
        "alerts"
        "create-super-admin"
        "create-user"
        "dashboard-stats"
        "devices"
        "device-sync"
        "integrations"
        "members"
        "organizations"
    )
    
    for func in "${FUNCTIONS[@]}"; do
        log_info "Deploying function: $func"
        run_command "supabase functions deploy $func --project-ref $PROJECT_REF --no-verify-jwt"
    done
    
    log_success "All edge functions deployed"
    
    # Set edge function secrets
    log_info "Setting edge function secrets..."
    log_warning "⚠️  Make sure you have the correct values in .env.production"
    
    if [ "$DRY_RUN" = false ]; then
        read -p "Set edge function secrets now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Read from .env.production
            if [ -f ".env.production" ]; then
                source .env.production
                run_command "supabase secrets set SUPABASE_URL=$PROJECT_URL --project-ref $PROJECT_REF"
                run_command "supabase secrets set SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY --project-ref $PROJECT_REF"
                run_command "supabase secrets set SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY --project-ref $PROJECT_REF"
                log_success "Secrets set successfully"
            else
                log_warning ".env.production not found. Skipping secrets setup"
            fi
        fi
    fi
else
    log_warning "Skipping edge functions deployment (--skip-functions)"
fi

# Step 6: Build application
log_info "Step 6: Building application for GitHub Pages..."

# Set environment variables for build
export NODE_ENV=production
export BUILD_MODE=static
export NEXT_PUBLIC_SUPABASE_URL=$PROJECT_URL
# Load other variables from .env.production if it exists
if [ -f ".env.production" ]; then
    source .env.production
fi

run_command "npm run build"
log_success "Build completed successfully"

# Step 7: Test build locally (optional)
log_info "Step 7: Testing build locally..."
if [ "$DRY_RUN" = false ]; then
    read -p "Test build locally before deploying? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Starting local server on http://localhost:3001/MonoRepo/"
        log_info "Press Ctrl+C to stop when done testing"
        npx serve out -p 3001 &
        SERVER_PID=$!
        sleep 2
        open http://localhost:3001/MonoRepo/ 2>/dev/null || xdg-open http://localhost:3001/MonoRepo/ 2>/dev/null || echo "Open http://localhost:3001/MonoRepo/ in your browser"
        read -p "Press Enter when done testing..."
        kill $SERVER_PID
    fi
fi

# Step 8: Commit and push to GitHub
log_info "Step 8: Preparing GitHub deployment..."

if [ "$DRY_RUN" = false ]; then
    # Check git status
    if [ -n "$(git status --porcelain)" ]; then
        log_warning "You have uncommitted changes"
        git status --short
        read -p "Commit and push these changes? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add -A
            read -p "Enter commit message: " COMMIT_MSG
            git commit -m "${COMMIT_MSG:-feat: production deployment}"
            
            # Determine current branch
            CURRENT_BRANCH=$(git branch --show-current)
            log_info "Current branch: $CURRENT_BRANCH"
            
            # Push to current branch
            git push origin $CURRENT_BRANCH
            log_success "Changes pushed to $CURRENT_BRANCH"
            
            # Offer to merge to main
            if [ "$CURRENT_BRANCH" != "main" ]; then
                read -p "Merge to main and deploy? (y/n) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    git checkout main
                    git merge $CURRENT_BRANCH --no-ff
                    git push origin main
                    git checkout $CURRENT_BRANCH
                    log_success "Merged to main and pushed"
                else
                    log_warning "Skipping merge to main. Deploy manually when ready."
                fi
            fi
        fi
    else
        log_info "No changes to commit"
    fi
fi

# Step 9: Final checks and instructions
echo ""
echo "==================================================================="
echo "  Deployment Complete!"
echo "==================================================================="
echo ""
log_success "Production Supabase configured: $PROJECT_URL"
log_success "Edge functions deployed"
log_success "Application built for GitHub Pages"
echo ""
log_info "Next steps:"
echo "  1. Wait for GitHub Actions to complete"
echo "  2. Visit: $GITHUB_PAGES_URL"
echo "  3. Test all functionality"
echo "  4. Monitor Supabase logs"
echo ""
log_info "Useful links:"
echo "  - GitHub Actions: https://github.com/$GITHUB_REPO/actions"
echo "  - Supabase Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF"
echo "  - Production App: $GITHUB_PAGES_URL"
echo ""
log_warning "Remember to:"
echo "  - Configure GitHub Secrets (if not already done)"
echo "  - Test all features in production"
echo "  - Monitor for errors"
echo ""
echo "==================================================================="

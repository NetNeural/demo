#!/bin/bash

# NetNeural IoT Platform - Development Setup Script
echo "🚀 Starting NetNeural IoT Platform Development Environment"

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

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm"
        exit 1
    fi
    
    # Check Node version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Install npm dependencies
install_dependencies() {
    print_status "Installing npm dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Check if Supabase CLI is available
check_supabase() {
    if command -v supabase &> /dev/null; then
        print_success "Supabase CLI is available"
        return 0
    else
        print_warning "Supabase CLI not found. Installing locally..."
        npm install -g supabase@latest
        if [ $? -eq 0 ]; then
            print_success "Supabase CLI installed successfully"
        else
            print_warning "Failed to install Supabase CLI globally. You can install it manually later."
        fi
    fi
}

# Setup environment file
setup_env() {
    if [ ! -f ".env.local" ]; then
        print_status "Creating .env.local file..."
        cp .env.example .env.local 2>/dev/null || {
            print_warning ".env.example not found, using default values"
        }
        print_success "Environment file created"
    else
        print_status ".env.local already exists"
    fi
}

# Start Supabase local development
start_supabase() {
    print_status "Starting Supabase local development environment..."
    
    if command -v supabase &> /dev/null; then
        supabase start
        if [ $? -eq 0 ]; then
            print_success "Supabase started successfully"
            print_status "Running database migrations..."
            supabase db reset
            print_success "Database initialized with seed data"
        else
            print_warning "Failed to start Supabase. You can start it manually with 'supabase start'"
        fi
    else
        print_warning "Supabase CLI not available. Skipping local database setup."
        print_status "You can set up Supabase manually later by:"
        echo "  1. Installing Supabase CLI: npm install -g supabase"
        echo "  2. Running: supabase start"
        echo "  3. Running: supabase db reset"
    fi
}

# Main execution
main() {
    echo
    print_status "NetNeural IoT Platform Development Setup"
    echo "========================================="
    echo
    
    check_dependencies
    echo
    
    install_dependencies
    echo
    
    check_supabase
    echo
    
    setup_env
    echo
    
    start_supabase
    echo
    
    print_success "Setup completed! 🎉"
    echo
    print_status "Next steps:"
    echo "  1. Start the development server: npm run dev"
    echo "  2. Open http://localhost:3000 in your browser"
    echo "  3. Create a super admin account to get started"
    echo
    print_status "Useful commands:"
    echo "  - npm run dev          # Start development server"
    echo "  - npm run build        # Build for production"
    echo "  - npm run test         # Run tests"
    echo "  - supabase status      # Check Supabase status"
    echo "  - supabase stop        # Stop Supabase"
    echo
}

# Run main function
main
#!/bin/bash
# Setup script for local development database
# This script sets up the database AND auth users in the correct order

set -e

echo "🚀 Setting up development database..."
echo ""

# Step 1: Reset database (this wipes auth.users too!)
echo "📦 Step 1: Resetting database schema and seed data..."
npm run supabase:reset

echo ""
echo "✅ Database reset complete!"
echo ""

# Step 2: Create auth users (must happen AFTER reset)
echo "👥 Step 2: Creating test auth users..."
npm run setup:users

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 You can now start the development servers:"
echo "   Terminal 1: npm run supabase:functions:serve"
echo "   Terminal 2: npm run dev"
echo ""
echo "🔐 Login at http://localhost:3000/auth/login with:"
echo "   Super Admin: superadmin@netneural.ai / SuperSecure123!"
echo "   Org Owner:   admin@netneural.ai / password123"
echo ""

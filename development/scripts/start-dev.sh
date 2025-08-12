#!/bin/bash

# NetNeural Local Development Setup
echo "🚀 Starting NetNeural Local Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
fi

echo "🔄 Starting Supabase local development..."
cd supabase
supabase start

echo "📱 Starting all applications..."

# Start API in background
echo "🔧 Starting API server..."
cd ../apps/api
npm run dev &
API_PID=$!

# Start Web app in background  
echo "💻 Starting Web application..."
cd ../web
npm run dev &
WEB_PID=$!

echo "✅ All services started!"
echo ""
echo "📊 Service URLs:"
echo "   Web App: http://localhost:3000"
echo "   API: http://localhost:3001"
echo "   Supabase Studio: http://localhost:54323"
echo "   Supabase API: http://localhost:54321"
echo ""
echo "🛑 To stop all services, run: npm run dev:stop"

# Wait for user input to stop
read -p "Press [Enter] to stop all services..."

echo "🛑 Stopping services..."
kill $API_PID $WEB_PID
cd ../../supabase
supabase stop

echo "✅ All services stopped!"

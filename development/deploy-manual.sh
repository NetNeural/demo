#!/bin/bash
# Simple Manual Deployment Script for IoT Dashboard

echo "🚀 Starting IoT Dashboard Manual Deployment..."

# Navigate to the web app directory
cd "$(dirname "$0")/apps/web" || exit 1

echo "📦 Installing dependencies..."
npm install

echo "🔧 Building production application..."
npm run build

echo "✅ Build complete! Files are ready in: apps/web/out/"
echo ""
echo "📋 Next Steps:"
echo "1. The built files are in: $(pwd)/out/"
echo "2. You can upload these files to any static hosting service"
echo "3. For GitHub Pages:"
echo "   - Create a 'gh-pages' branch"
echo "   - Copy contents of 'out/' folder to the root of that branch"
echo "   - Enable GitHub Pages in repository settings"
echo ""
echo "🌐 Your dashboard will be live at: https://netneural.github.io/MonoRepo/"
echo ""
echo "🎉 Deployment files ready!"

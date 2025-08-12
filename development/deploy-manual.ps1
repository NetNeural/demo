# PowerShell Manual Deployment Script for IoT Dashboard

Write-Host "🚀 Starting IoT Dashboard Manual Deployment..." -ForegroundColor Green

# Navigate to the web app directory  
$webDir = Join-Path $PSScriptRoot "apps\web"
Set-Location $webDir

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "🔧 Building production application..." -ForegroundColor Yellow
npm run build

Write-Host "✅ Build complete! Files are ready in: apps\web\out\" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. The built files are in: $webDir\out\" -ForegroundColor White
Write-Host "2. You can upload these files to any static hosting service" -ForegroundColor White
Write-Host "3. For GitHub Pages:" -ForegroundColor White
Write-Host "   - Create a 'gh-pages' branch" -ForegroundColor White
Write-Host "   - Copy contents of 'out\' folder to the root of that branch" -ForegroundColor White
Write-Host "   - Enable GitHub Pages in repository settings" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Your dashboard will be live at: https://netneural.github.io/MonoRepo/" -ForegroundColor Blue
Write-Host ""
Write-Host "🎉 Deployment files ready!" -ForegroundColor Green

@echo off
echo =====================================================
echo NetNeural Docker CLI Setup (Remote Only)
echo =====================================================
echo.

echo Installing Docker CLI via Chocolatey...
echo (This will NOT install Docker Desktop)
echo.

REM Check if Chocolatey is installed
choco --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Chocolatey not found. Installing Chocolatey first...
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
)

echo Installing Docker CLI only...
choco install docker-cli -y

echo.
echo Setting environment variable for remote Docker server...
setx DOCKER_HOST "tcp://192.168.1.45:2376"

echo.
echo =====================================================
echo Setup Complete!
echo =====================================================
echo.
echo 1. Restart your terminal
echo 2. Test connection: docker version
echo 3. Deploy platform: npm run deploy:remote
echo.
echo Your Docker CLI is now configured for remote server only.
echo No local Docker daemon will run.
echo.
pause

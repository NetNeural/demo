@echo off
echo ===============================================
echo NetNeural Docker SSH Tunnel Connection
echo ===============================================
echo.
echo This will create an SSH tunnel to your Docker server
echo and keep it running in the background.
echo.
echo Make sure you have SSH access to 192.168.1.45
echo.
set /p username="root"
echo.
echo Starting SSH tunnel...
echo Connection will be: localhost:2376 -> 192.168.1.45:2376
echo.
echo Press Ctrl+C to stop the tunnel
echo.
ssh -L 2376:localhost:2376 %username%@192.168.1.45
echo.
echo SSH tunnel closed.
pause

@echo off
echo ===================================================
echo   NEPHROMIND - STARTUP SCRIPT
echo ===================================================
echo.
echo [1/3] Stopping any running containers...
docker-compose down
echo.
echo [2/3] Building and starting services...
echo       (This will open the log stream. Press Ctrl+C to stop)
echo.
docker-compose up --build
pause

@echo off
echo ===================================================
echo   Building DesignInk Metadata Generator .exe
echo ===================================================
cd /d "%~dp0desktop-app"
echo Installing desktop dependencies...
call npm install
echo Building Windows executable...
call npm run dist
echo ===================================================
echo Build completed! Executable is saved in:
echo %~dp0desktop-app\dist
echo ===================================================
pause

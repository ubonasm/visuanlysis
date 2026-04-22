@echo off
cd /d "%~dp0"

echo ========================================
echo   Classroom Video Analysis System
echo ========================================
echo.

echo Installing packages...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Starting dev server...
echo   Open http://localhost:3000
echo   Press Ctrl+C to stop
echo ========================================
echo.

call npx next dev

pause

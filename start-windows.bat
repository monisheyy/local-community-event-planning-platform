@echo off
rem One-click launcher for Windows: installs everything the first time, then runs the app.
cd /d "%~dp0"
title Gather - Local Community Event Planning Platform

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed. Install Node.js 22 LTS or newer from https://nodejs.org
  echo  then double-click this file again.
  start https://nodejs.org/en/download
  pause
  exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 22 (
  echo.
  echo  Node.js 22 or newer is required. You have:
  node -v
  echo  Update it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist "backend\node_modules\express" goto setup
if not exist "frontend\node_modules\vite" goto setup
goto run

:setup
echo.
echo  First run: installing packages and creating the demo database (takes 1-2 minutes)...
echo.
call npm run setup
if errorlevel 1 (
  echo.
  echo  Setup failed - see the messages above.
  pause
  exit /b 1
)

:run
echo.
echo  Starting the app. It will open at http://localhost:4000
echo  Keep this window open while you use the app. Close it to stop the server.
echo.
start "" cmd /c "timeout /t 10 /nobreak >nul & start http://localhost:4000"
call npm start
pause

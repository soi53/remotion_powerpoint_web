@echo off
chcp 65001 >nul
title KR-ACADEMY MOVIE MAKER

echo.
echo  ============================================================
echo   KR-ACADEMY MOVIE MAKER  v1.0
echo   PPT to Lecture Video (AI-Powered)
echo  ============================================================
echo.

:: -- 1. Check Node.js --
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo         Please install from https://nodejs.org then retry.
    pause
    exit /b 1
)

:: -- 2. Create .env if missing --
if not exist "remotion_powerpoint\.env" (
    echo [SETUP] Creating .env file...
    (
        echo ELEVENLABS_API_KEY=PUT_YOUR_ELEVENLABS_KEY_HERE
        echo OPENAI_API_KEY=PUT_YOUR_OPENAI_KEY_HERE
        echo # Remove the # below to enable paid plan speed boost:
        echo # ELEVENLABS_PLAN=paid
    ) > "remotion_powerpoint\.env"
    echo.
    echo  ** remotion_powerpoint\.env has been created.
    echo  ** Open the file and replace the placeholder values
    echo  ** with your actual API keys, then run start.bat again.
    echo.
    start notepad "remotion_powerpoint\.env"
    pause
    exit /b 0
)

:: -- 3. Check if API keys are still placeholders --
findstr /c:"PUT_YOUR_ELEVENLABS_KEY_HERE" "remotion_powerpoint\.env" >nul
if %errorlevel% equ 0 (
    echo [WARNING] API keys not set yet.
    echo           Open remotion_powerpoint\.env and enter your real API keys.
    echo.
    start notepad "remotion_powerpoint\.env"
    pause
    exit /b 0
)

:: -- 4. Verify web/.env.local exists and is not empty --
if not exist "web\.env.local" (
    echo REMOTION_ROOT=../remotion_powerpoint> "web\.env.local.tmp"
    move /y "web\.env.local.tmp" "web\.env.local" >nul
)
for %%I in ("web\.env.local") do if %%~zI lss 10 (
    echo REMOTION_ROOT=../remotion_powerpoint> "web\.env.local.tmp"
    move /y "web\.env.local.tmp" "web\.env.local" >nul
)

:: -- 5. Install dependencies (only when node_modules is missing) --
echo [1/3] Checking dependencies...

if not exist "remotion_powerpoint\node_modules" (
    echo       Installing remotion_powerpoint packages [first run only]...
    cd remotion_powerpoint
    call npm install
    cd ..
)

if not exist "web\node_modules" (
    echo       Installing web packages [first run only]...
    cd web
    call npm install
    cd ..
)

echo [2/3] Starting server...
echo.

:: -- 6. Start web server --
start "KR-ACADEMY Web Server" cmd /k "cd /d %~dp0web && npm run dev"

:: Wait 3 seconds then open browser
timeout /t 3 /nobreak >nul

echo [3/3] Opening browser...
start http://localhost:3000

echo.
echo  Done! Access the app at: http://localhost:3000
echo  To stop the server, close the "KR-ACADEMY Web Server" window.
echo.
pause

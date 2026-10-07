@echo off
setlocal
cd /d "%~dp0frontend"

echo == Installing pinned direct dependencies ==
call npm install
if errorlevel 1 exit /b 1

echo == Running model/data/source tests ==
call npm test
if errorlevel 1 exit /b 1

echo == Verifying production build ==
call npm run build
if errorlevel 1 exit /b 1

echo == Starting OUREA development server ==
call npm run dev
endlocal

@echo off
setlocal
cd /d "%~dp0"

cd frontend
echo == Node tests ==
call npm test
if errorlevel 1 exit /b 1

if exist "node_modules\.bin\vite.cmd" (
  echo == Vite production build ==
  call npm run build
  if errorlevel 1 exit /b 1
) else (
  echo == Vite production build SKIPPED ==
)

cd ..
echo == Python syntax ==
python -m compileall -q scripts
if errorlevel 1 exit /b 1

echo == Python unit tests ==
python -m unittest discover -s tests -p "test_*.py" -v
if errorlevel 1 exit /b 1

echo == CORNARE input validation ==
python scripts\climaterisk\validate_inputs.py
if errorlevel 1 exit /b 1

echo == Reproducibility manifest ==
python scripts\make_manifest.py
if errorlevel 1 exit /b 1

echo Ourea QA completed.
endlocal

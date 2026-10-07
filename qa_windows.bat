@echo off
setlocal
cd /d "%~dp0"

cd frontend
echo == Node model/service/domain tests ==
node --test tests/*.test.js
if errorlevel 1 exit /b 1

echo == Frontend data validation ==
node tests\dataValidation.mjs
if errorlevel 1 exit /b 1

echo == Frontend source/DRY validation ==
node tests\sourceValidation.mjs
if errorlevel 1 exit /b 1

echo == Decision-readiness API tests ==
cd ..\services\decision-readiness
if exist package.json (
  call npm install
  if errorlevel 1 exit /b 1
  call npm test
  if errorlevel 1 exit /b 1
)
cd ..\..\frontend

if exist "node_modules\.bin\vite.cmd" (
  echo == Vite production build ==
  call npm run build
  if errorlevel 1 exit /b 1
) else (
  echo == Vite production build SKIPPED ==
  echo Install dependencies with npm install, then rerun QA.
)

cd ..
echo == Python syntax ==
python -m compileall -q scripts
if errorlevel 1 exit /b 1

echo == Python unit tests ==
python -m unittest discover -s tests -p "test_*.py" -v
if errorlevel 1 exit /b 1
python -m unittest discover -s scripts -p "test_*.py" -v
if errorlevel 1 exit /b 1

echo == Browser checkpoints ==
node frontend\scripts\generateCheckpoint.mjs >NUL
if errorlevel 1 exit /b 1

echo == Formal MILP + policy cross-checks ==
python scripts\optimizer_milp.py >NUL
if errorlevel 1 exit /b 1

echo == Full geospatial/model/checkpoint validation ==
python scripts\validate_project.py
if errorlevel 1 exit /b 1

echo == Decision-brief PDF inspection ==
python scripts\inspect_brief_pdfs.py
if errorlevel 1 exit /b 1

echo == Reproducibility manifest ==
python scripts\make_manifest.py
if errorlevel 1 exit /b 1

echo Ourea QA completed.
endlocal

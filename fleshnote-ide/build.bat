@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================
echo   FleshNote IDE - Full Build (Windows)
echo ============================================
echo.

:: Step 1: Build Python backend with PyInstaller
echo [1/3] Building Python backend...
echo.

pushd backend

:: FleshNote standardizes on backend\.venv. Clean up stale dot-less variants
:: (e.g. created by other tooling) so there is exactly one environment.
if exist "venv" (
    echo Removing stale backend\venv - FleshNote uses backend\.venv
    rmdir /s /q venv
)

if not exist ".venv\Scripts\activate.bat" (
    echo Python venv not found - creating backend\.venv ...
    python -m venv .venv
    if !ERRORLEVEL! neq 0 (
        echo ERROR: Failed to create venv. Is Python 3.13 on PATH?
        popd
        exit /b 1
    )
)

call .venv\Scripts\activate.bat

:: Sync the environment to the pinned versions on every build
:: (fast no-op when already satisfied; protects against silent drift).
python -m pip install -r requirements_build.txt
if !ERRORLEVEL! neq 0 (
    echo.
    echo ERROR: pip install failed!
    popd
    exit /b 1
)
REM huspacy packaging cap conflicts with pyinstaller - see requirements_build.txt
python -m pip install --no-deps huspacy==0.12.1

python build_backend.py
if !ERRORLEVEL! neq 0 (
    echo.
    echo ERROR: Backend build failed!
    popd
    exit /b 1
)
popd

echo.
echo    Backend built successfully.
echo.

:: Step 2: Build Electron frontend
echo [2/3] Building Electron frontend (typecheck + vite)...
echo.

call npm run build
if !ERRORLEVEL! neq 0 (
    echo.
    echo ERROR: Frontend build failed!
    exit /b 1
)

echo.
echo    Frontend built successfully.
echo.

:: Step 3: Package with electron-builder
echo [3/3] Packaging Windows installer...
echo.

call npx electron-builder --win
if !ERRORLEVEL! neq 0 (
    echo.
    echo ERROR: Packaging failed!
    exit /b 1
)

echo.
echo ============================================
echo   BUILD COMPLETE
echo   Check dist\ for the installer.
echo ============================================
echo.

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
if not exist ".venv\Scripts\activate.bat" (
    echo ERROR: Python venv not found at backend\.venv
    echo Run: cd backend ^&^& python -m venv .venv ^&^& .venv\Scripts\activate ^&^& pip install -r requirements_build.txt
    exit /b 1
)

call .venv\Scripts\activate.bat
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

@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0preparar_ocr.ps1"
if errorlevel 1 (
  echo.
  echo La preparacion no se completo. Revisa el error de arriba.
  pause
  exit /b 1
)
echo.
echo Presiona una tecla para cerrar esta ventana.
pause >nul

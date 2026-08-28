@echo off
REM ---------------------------------------------------------------
REM  Gatti CRM - go back to the version that was running before the
REM  last update.bat. Use if something broke right after updating.
REM ---------------------------------------------------------------
setlocal
cd /d "%~dp0.."
title Gatti CRM - roll back

echo.
echo  === Roll back to the previous version ===
echo.
git log --oneline -5
echo.
echo  This returns the app code to the previous version and restarts.
echo  Your leads, calls and WhatsApp links are NOT touched.
echo.
set /p OK="Type YES to continue: "
if /i not "%OK%"=="YES" (
  echo  Cancelled. Nothing changed.
  pause
  exit /b 0
)

git reset --hard HEAD~1
if errorlevel 1 goto fail
docker compose build web worker
if errorlevel 1 goto fail
docker compose up -d
if errorlevel 1 goto fail

echo.
echo  === Rolled back. ===
echo  Note: a database change from the failed update is NOT undone.
echo  If the app still misbehaves, restore the newest file in \backups.
echo.
pause
exit /b 0

:fail
echo.
echo  Rollback failed. Send this window to Shivanku.
pause
exit /b 1

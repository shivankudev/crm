@echo off
REM ---------------------------------------------------------------
REM  Run this ONCE, as Administrator (right-click - Run as
REM  administrator). It tells Windows to check for CRM updates a
REM  couple of minutes after you sign in each morning.
REM
REM  Deliberately at sign-in and not during the day: an update
REM  restarts the CRM for about a minute, and first thing in the
REM  morning is the one time nobody is mid-call.
REM ---------------------------------------------------------------
setlocal
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   This needs to run as Administrator.
  echo   Close this, right-click register-auto-update.bat, and pick
  echo   "Run as administrator".
  echo.
  pause
  exit /b 1
)

schtasks /create /f /tn "Gatti CRM auto-update" ^
  /tr "\"%~dp0auto-update.bat\"" ^
  /sc onlogon /delay 0002:00 /rl highest

if errorlevel 1 (
  echo.
  echo   Could not register the task. Send this window to Shivanku.
  pause
  exit /b 1
)

echo.
echo   Done. The CRM will check for updates about two minutes after
echo   each sign-in, and update itself only if something new was
echo   published. Nothing happens when there is nothing new.
echo.
echo   To see what it did:      type logs\auto-update.log
echo   To stop it doing this:   schtasks /delete /tn "Gatti CRM auto-update" /f
echo.
pause

@echo off
REM ---------------------------------------------------------------
REM  Gatti CRM - pull the latest changes and restart.
REM  Double-click this. Safe to run while telecallers are working;
REM  the CRM is unreachable for roughly a minute near the end.
REM ---------------------------------------------------------------
setlocal
cd /d "%~dp0.."
title Gatti CRM - update

echo.
echo  === Gatti CRM update ===
echo.

echo  [1/5] Backing up the database first...
if not exist backups mkdir backups
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DT=%%I
set STAMP=%DT:~0,8%-%DT:~8,6%
docker compose exec -T postgres sh -c "pg_dump -U $POSTGRES_USER -Fc $POSTGRES_DB" > "backups\before-update-%STAMP%.dump"
if errorlevel 1 (
  echo.
  echo  Could not back up. Is Docker running? Nothing has been changed.
  goto fail
)
echo        saved to backups\before-update-%STAMP%.dump

echo  [2/5] Downloading the new version...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo  Download failed. This usually means files here were edited by hand.
  echo  Nothing has been changed. Send this whole window to Shivanku.
  goto fail
)


REM Record which commit this build came from, so anyone on the network can
REM ask the CRM its version (http://<this-pc>:3000/version.txt) instead of
REM remoting in to run git log. Written after the pull and before the build
REM so it lands in the Docker context. Gitignored, so it never dirties the
REM tree and never blocks the next --ff-only pull.
git rev-parse --short HEAD > public\version.txt
echo  [3/5] Building...
docker compose build web worker migrate seed
if errorlevel 1 goto buildfail

echo  [4/5] Updating the database...
docker compose run --rm migrate
if errorlevel 1 goto buildfail

echo  [5/5] Restarting...
docker compose up -d
if errorlevel 1 goto buildfail

echo.
echo  === Done. The CRM is back up. ===
echo  If anything looks wrong, run rollback.bat in this same folder.
echo.
pause
exit /b 0

:buildfail
echo.
echo  Update failed partway. The old version is still installed.
echo  Run rollback.bat to be certain, then send this window to Shivanku.
:fail
echo.
pause
exit /b 1

@echo off
REM ---------------------------------------------------------------
REM  Gatti CRM - unattended update.
REM
REM  Registered by register-auto-update.bat to run shortly after
REM  sign-in, so each morning the PC picks up whatever was pushed
REM  overnight. Does nothing at all when there is nothing new, so it
REM  is safe to run often.
REM
REM  Everything it does is written to logs\auto-update.log.
REM ---------------------------------------------------------------
setlocal
cd /d "%~dp0.."
if not exist logs mkdir logs
set LOG=logs\auto-update.log

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set DT=%%I
set STAMP=%DT:~0,4%-%DT:~4,2%-%DT:~6,2% %DT:~8,2%:%DT:~10,2%:%DT:~12,2%

echo. >> "%LOG%"
echo [%STAMP%] checking for updates >> "%LOG%"

REM Docker may still be starting up right after sign-in. Wait for it
REM rather than failing the whole run.
set /a TRIES=0
:waitdocker
docker info >nul 2>&1 && goto dockerok
set /a TRIES+=1
if %TRIES% GEQ 30 (
  echo [%STAMP%] Docker never came up - skipping this run, nothing changed >> "%LOG%"
  exit /b 0
)
timeout /t 10 /nobreak >nul
goto waitdocker
:dockerok

git fetch origin main >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%STAMP%] could not reach GitHub - skipping, nothing changed >> "%LOG%"
  exit /b 0
)

REM Nothing new? Then do not touch a working system.
for /f %%A in ('git rev-parse HEAD') do set LOCAL=%%A
for /f %%B in ('git rev-parse origin/main') do set REMOTE=%%B
if "%LOCAL%"=="%REMOTE%" (
  echo [%STAMP%] already up to date - no action >> "%LOG%"
  exit /b 0
)

echo [%STAMP%] new version found, updating >> "%LOG%"

if not exist backups mkdir backups
docker compose exec -T postgres sh -c "pg_dump -U $POSTGRES_USER -Fc $POSTGRES_DB" > "backups\auto-%DT:~0,8%-%DT:~8,6%.dump" 2>>"%LOG%"
if errorlevel 1 (
  echo [%STAMP%] BACKUP FAILED - refusing to update, old version still running >> "%LOG%"
  exit /b 1
)

git pull --ff-only >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%STAMP%] PULL FAILED - files here were edited by hand, old version still running >> "%LOG%"
  exit /b 1
)


REM Record which commit this build came from, so anyone on the network can
REM ask the CRM its version (http://<this-pc>:3000/version.txt) instead of
REM remoting in to run git log. Written after the pull and before the build
REM so it lands in the Docker context. Gitignored, so it never dirties the
REM tree and never blocks the next --ff-only pull.
git rev-parse --short HEAD > public\version.txt
docker compose build web worker migrate seed >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%STAMP%] BUILD FAILED - old version still running, run rollback.bat if the site misbehaves >> "%LOG%"
  exit /b 1
)

docker compose run --rm migrate >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%STAMP%] MIGRATION FAILED - old version still running >> "%LOG%"
  exit /b 1
)

docker compose up -d >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%STAMP%] RESTART FAILED >> "%LOG%"
  exit /b 1
)

echo [%STAMP%] updated successfully to %REMOTE:~0,7% >> "%LOG%"
exit /b 0

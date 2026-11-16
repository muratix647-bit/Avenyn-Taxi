@echo off
setlocal
cd /d "%~dp0"
echo Avenyn Taxi - forarapp 1.5.0
echo Installerar projektets beroenden och oppnar Android Studio.
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js med npm maste vara installerat pa datorn.
  echo Installera fran https://nodejs.org/ och kor denna fil igen.
  pause
  exit /b 1
)
call npm.cmd ci
if errorlevel 1 goto failed
call npx.cmd cap sync android
if errorlevel 1 goto failed
if exist "%ProgramFiles%\Android\Android Studio3\bin\studio64.exe" set "CAPACITOR_ANDROID_STUDIO_PATH=%ProgramFiles%\Android\Android Studio3\bin\studio64.exe"
call npx.cmd cap open android
if errorlevel 1 goto failed
echo Projektet ar oppnat. Se TAP-TO-PAY.md for release och telefonkontroll.
pause
exit /b 0
:failed
echo Steget misslyckades. Spara feltexten ovan for felsokning.
pause
exit /b 1

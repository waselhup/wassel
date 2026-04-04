@echo off
setlocal EnableDelayedExpansion

set OUTFILE=C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel\commit_result.txt
echo Starting... > "%OUTFILE%"

:: Find git
set GIT=
if exist "C:\Program Files\Git\cmd\git.exe" set GIT="C:\Program Files\Git\cmd\git.exe"
if exist "C:\Program Files\Git\bin\git.exe" set GIT="C:\Program Files\Git\bin\git.exe"
if exist "C:\Program Files (x86)\Git\cmd\git.exe" set GIT="C:\Program Files (x86)\Git\cmd\git.exe"

for /f "delims=" %%i in ('where git 2^>nul') do if "!GIT!"=="" set GIT="%%i"

echo Git path: %GIT% >> "%OUTFILE%"

if "%GIT%"=="" (
    echo ERROR: Git not found >> "%OUTFILE%"
    goto :done
)

:: Delete lock file
del /f /q "C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel\.git\index.lock" 2>nul
echo Lock delete attempted >> "%OUTFILE%"

:: Change to project directory
cd /d "C:\Users\WIN11-24H2GPT\Desktop\New folder\wassel"

:: Stage files
%GIT% add client/src/pages/Campaigns.tsx client/src/pages/CampaignWizard.tsx client/src/pages/CampaignDetail.tsx "client/public/locales/ar/translation.json" "client/public/locales/en/translation.json" >> "%OUTFILE%" 2>&1
echo Git add exit: %ERRORLEVEL% >> "%OUTFILE%"

:: Commit
%GIT% commit -m "fix: campaign system overhaul - smooth Waalaxy-like flow" >> "%OUTFILE%" 2>&1
echo Git commit exit: %ERRORLEVEL% >> "%OUTFILE%"

:: Push
%GIT% push origin master >> "%OUTFILE%" 2>&1
echo Git push exit: %ERRORLEVEL% >> "%OUTFILE%"

:done
echo FINISHED >> "%OUTFILE%"

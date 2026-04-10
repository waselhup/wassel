@echo off
powershell -NoProfile -Command "$ErrorActionPreference='Continue'; $r = Invoke-WebRequest -UseBasicParsing -Uri 'https://wassel-alpha.vercel.app/api/health' -Method GET; Write-Host ('STATUS: ' + $r.StatusCode); Write-Host ('BODY: ' + $r.Content)" > verify.log 2>&1
powershell -NoProfile -Command "$ErrorActionPreference='Continue'; $r = Invoke-WebRequest -UseBasicParsing -Uri 'https://wassel-alpha.vercel.app/' -Method GET; Write-Host ('ROOT STATUS: ' + $r.StatusCode); Write-Host ('ROOT LEN: ' + $r.Content.Length)" >> verify.log 2>&1

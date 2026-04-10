$ErrorActionPreference = 'Continue'
try {
  $r = Invoke-WebRequest -UseBasicParsing -Uri 'https://wassel-alpha.vercel.app/api/health' -Method GET -TimeoutSec 20
  Write-Host ('HEALTH STATUS: ' + $r.StatusCode)
  Write-Host ('HEALTH BODY: ' + $r.Content)
} catch {
  Write-Host ('HEALTH ERR: ' + $_.Exception.Message)
  if ($_.Exception.Response) { Write-Host ('HEALTH HTTP: ' + [int]$_.Exception.Response.StatusCode) }
}
try {
  $r2 = Invoke-WebRequest -UseBasicParsing -Uri 'https://wassel-alpha.vercel.app/' -Method GET -TimeoutSec 20
  Write-Host ('ROOT STATUS: ' + $r2.StatusCode)
  Write-Host ('ROOT LEN: ' + $r2.Content.Length)
} catch {
  Write-Host ('ROOT ERR: ' + $_.Exception.Message)
  if ($_.Exception.Response) { Write-Host ('ROOT HTTP: ' + [int]$_.Exception.Response.StatusCode) }
}

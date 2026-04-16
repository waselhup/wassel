Start-Sleep -Seconds 75
try {
  $r = Invoke-RestMethod 'https://wassel-alpha.vercel.app/api/health'
  Write-Host ('health: ' + $r.status + ' v=' + $r.version + ' ts=' + $r.timestamp)
} catch {
  Write-Host ('health error: ' + $_.Exception.Message)
}

try {
  $resp = Invoke-WebRequest 'https://wassel-alpha.vercel.app/api/trpc/admin.systemStatus' -UseBasicParsing -ErrorAction Stop
  Write-Host ('systemStatus: HTTP ' + $resp.StatusCode)
} catch {
  $code = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 'ERR' }
  Write-Host ('systemStatus: HTTP ' + $code + ' (401=correct unauth, 404=not wired)')
}

try {
  $body = '{"0":{"json":{"linkedinUrl":"https://www.linkedin.com/in/hassan-almodhi"}}}'
  $resp = Invoke-WebRequest -Uri 'https://wassel-alpha.vercel.app/api/trpc/linkedin.analyzeDeep?batch=1' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing -ErrorAction Stop
  Write-Host ('analyzeDeep: HTTP ' + $resp.StatusCode)
} catch {
  $code = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { 'ERR' }
  Write-Host ('analyzeDeep (unauth): HTTP ' + $code + ' (401=correct)')
}

try {
    $r = Invoke-WebRequest -Uri "https://wassel.vercel.app/" -UseBasicParsing -ErrorAction Stop
    Write-Host "Site: $($r.StatusCode)"
} catch {
    Write-Host "Site Error: $($_.Exception.Message)"
}
try {
    $r = Invoke-WebRequest -Uri "https://wassel.vercel.app/api/trpc" -UseBasicParsing -ErrorAction Stop
    Write-Host "API: $($r.StatusCode)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "API: $code"
}

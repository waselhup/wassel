$tests = @(
    "https://wassel.vercel.app/",
    "https://wassel.vercel.app/api/test",
    "https://wassel.vercel.app/api/health"
)
foreach ($url in $tests) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
        Write-Host "$url => $($r.StatusCode) | $($r.Content.Substring(0, [Math]::Min(100, $r.Content.Length)))"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "$url => $code"
    }
}

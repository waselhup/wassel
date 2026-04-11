$urls = @(
    "https://wassel.vercel.app/api/trpc/health.check",
    "https://wassel.vercel.app/api/index.js",
    "https://wassel.vercel.app/api/test"
)
foreach ($url in $urls) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
        Write-Host "$url => $($r.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $body = ""
        try { 
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd().Substring(0, [Math]::Min(200, $reader.ReadToEnd().Length))
        } catch {}
        Write-Host "$url => $code $body"
    }
}

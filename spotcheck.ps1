$urls = @(
  'https://wassel-alpha.vercel.app/',
  'https://wassel-alpha.vercel.app/login',
  'https://wassel-alpha.vercel.app/dashboard',
  'https://wassel-alpha.vercel.app/campaigns',
  'https://wassel-alpha.vercel.app/leads',
  'https://wassel-alpha.vercel.app/api/health'
)
foreach ($u in $urls) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $u -Method GET -TimeoutSec 15
    Write-Host ($u + '  -> ' + $r.StatusCode + '  (' + $r.Content.Length + ' bytes)')
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR' }
    Write-Host ($u + '  -> ' + $code + '  ' + $_.Exception.Message)
  }
}

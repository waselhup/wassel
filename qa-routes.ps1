$urls = @(
  '/','/login','/signup','/app','/app/setup','/app/linkedin','/app/cv',
  '/app/campaigns','/app/tokens','/app/profile','/admin','/api/health','/api/trpc/health'
)
$base = 'https://wassel-alpha.vercel.app'
$out = @()
foreach ($u in $urls) {
  $full = $base + $u
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $full -Method GET -TimeoutSec 15 -MaximumRedirection 5
    $hasRoot = if ($r.Content -match 'id="root"') { 'SPA' } else { 'API' }
    $out += ($u + ' -> ' + $r.StatusCode + ' ' + $r.Content.Length + 'B ' + $hasRoot)
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'ERR' }
    $out += ($u + ' -> ' + $code)
  }
}
$out | Out-File -FilePath C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\qa-result.log -Encoding utf8
Write-Host 'DONE'

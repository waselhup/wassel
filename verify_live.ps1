$html = (Invoke-WebRequest -Uri 'https://wassel-alpha.vercel.app' -UseBasicParsing).Content
if ($html -match 'assets/(index-[^"]+\.js)') {
  $jsFile = $matches[1]
  Write-Host "Bundle file: $jsFile"
  $js = (Invoke-WebRequest -Uri "https://wassel-alpha.vercel.app/$jsFile" -UseBasicParsing).Content
  Write-Host "Has anon key JWT: $($js.Contains('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'))"
  Write-Host "Has WASSEL v2.1: $($js.Contains('WASSEL v2.1'))"
  Write-Host "Has max(100): $($js -match 'max.*100')"
  Write-Host "Has Supabase log: $($js.Contains('Client initialized'))"
}

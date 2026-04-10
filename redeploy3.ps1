$ErrorActionPreference = 'Continue'
$log = 'C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\redeploy3.log'
"=== START $(Get-Date -Format o) ===" | Out-File $log -Encoding utf8
Set-Location 'C:\Users\WIN11-24H2GPT\Desktop\wassel-v2'
"PWD: $(Get-Location)" | Out-File $log -Append -Encoding utf8
"PATH: $env:PATH" | Out-File $log -Append -Encoding utf8
try {
  $pnpm = (Get-Command pnpm -ErrorAction SilentlyContinue).Source
  "pnpm: $pnpm" | Out-File $log -Append -Encoding utf8
} catch { "pnpm error: $_" | Out-File $log -Append -Encoding utf8 }
try {
  $npx = (Get-Command npx -ErrorAction SilentlyContinue).Source
  "npx: $npx" | Out-File $log -Append -Encoding utf8
} catch { "npx error: $_" | Out-File $log -Append -Encoding utf8 }
"=== BUILD ===" | Out-File $log -Append -Encoding utf8
& pnpm run build *>&1 | Out-File $log -Append -Encoding utf8
"=== BUILD EXIT $LASTEXITCODE ===" | Out-File $log -Append -Encoding utf8
"=== DEPLOY ===" | Out-File $log -Append -Encoding utf8
& npx vercel deploy --prod --yes *>&1 | Out-File $log -Append -Encoding utf8
"=== DEPLOY EXIT $LASTEXITCODE ===" | Out-File $log -Append -Encoding utf8
"=== END $(Get-Date -Format o) ===" | Out-File $log -Append -Encoding utf8

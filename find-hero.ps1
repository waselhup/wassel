$out = "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\find-hero.txt"
"Searching for WASSEL_USER_MANUAL.pptx..." | Out-File $out
Get-ChildItem -Path "C:\Users\WIN11-24H2GPT" -Filter "WASSEL_USER_MANUAL.pptx" -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName | Out-File $out -Append
"---" | Out-File $out -Append
"Desktop contents:" | Out-File $out -Append
Get-ChildItem -Path "C:\Users\WIN11-24H2GPT\Desktop" -Directory | Select-Object -ExpandProperty Name | Out-File $out -Append
"---" | Out-File $out -Append
if (Test-Path "C:\Users\WIN11-24H2GPT\Desktop\HERO SKILL") { "FOUND HERO SKILL on Desktop" | Out-File $out -Append }
if (Test-Path "C:\Users\WIN11-24H2GPT\Documents\HERO SKILL") { "FOUND HERO SKILL in Documents" | Out-File $out -Append }

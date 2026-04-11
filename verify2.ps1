$js = (Invoke-WebRequest -Uri 'https://wassel-alpha.vercel.app/assets/index-DO_JOh3G.js' -UseBasicParsing).Content
Write-Host "Has supabase.co: $($js.Contains('supabase.co'))"
Write-Host "Has eyJhbGci: $($js.Contains('eyJhbGci'))"
Write-Host "Has role anon: $($js.Contains('role:anon'))"
Write-Host "Has createClient: $($js.Contains('createClient'))"
Write-Host "Has hiqotmimlgsrsnovtopd: $($js.Contains('hiqotmimlgsrsnovtopd'))"
Write-Host "Bundle size: $($js.Length) chars"

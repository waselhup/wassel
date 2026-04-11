$token = (Get-Content C:\Users\WIN11-24H2GPT\Desktop\wassel-v2\.vercel\project.json | ConvertFrom-Json)
$projectId = $token.projectId
Write-Host "Project: $projectId"

# Get latest deployments
$headers = @{ "Authorization" = "Bearer $env:VERCEL_TOKEN" }
# Try without auth first - just check if the site responds with any useful headers
$r = Invoke-WebRequest -Uri "https://wassel.vercel.app/" -UseBasicParsing
Write-Host "x-vercel-id: $($r.Headers['x-vercel-id'])"
Write-Host "x-vercel-cache: $($r.Headers['x-vercel-cache'])"

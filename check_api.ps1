try {
  $body = @{
    "0" = @{
      json = @{
        profileUrl = "www.linkedin.com/in/test"
        campaignName = "test"
        targetCompanies = @("Aramco")
        targetIndustries = @("Tech")
        recipientCount = 50
        language = "en"
      }
    }
  } | ConvertTo-Json -Depth 10 -Compress
  
  $r = Invoke-WebRequest -Uri 'https://wassel-alpha.vercel.app/api/trpc/campaign.create?batch=1' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing -ErrorAction SilentlyContinue
  Write-Host "Status: $($r.StatusCode)"
  Write-Host $r.Content
} catch {
  Write-Host "Error: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $err = $sr.ReadToEnd()
    Write-Host "Body: $err"
    if ($err -match "maximum..:.20") { Write-Host "MAX IS STILL 20 - OLD API" }
    if ($err -match "maximum..:.100") { Write-Host "MAX IS 100 - NEW API DEPLOYED" }
    if ($err -match "UNAUTHORIZED") { Write-Host "AUTH REQUIRED - cant test limit here" }
  }
}

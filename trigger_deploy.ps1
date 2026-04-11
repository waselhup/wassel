$response = Invoke-WebRequest -Uri "https://api.vercel.com/v1/integrations/deploy/prj_msTtD1ckLs0lyMtFrtPBhhfRPdUz/SOtte4zfuh" -Method Post -UseBasicParsing
Write-Host "Status: $($response.StatusCode)"
Write-Host "Body: $($response.Content)"

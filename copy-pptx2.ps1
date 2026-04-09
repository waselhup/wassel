$dest = "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
$file = "WASSEL_USER_MANUAL.pptx"
# Search all drives and AppData
$results = @()
$results += Get-ChildItem -Path "C:\Users\WIN11-24H2GPT\AppData" -Filter $file -Recurse -ErrorAction SilentlyContinue -Force
$results += Get-ChildItem -Path "D:\" -Filter $file -Recurse -ErrorAction SilentlyContinue -Force
$results += Get-ChildItem -Path "E:\" -Filter $file -Recurse -ErrorAction SilentlyContinue -Force
$results += Get-ChildItem -Path "C:\" -Filter $file -Recurse -ErrorAction SilentlyContinue -Force
$count = ($results | Measure-Object).Count
$results | Select-Object -ExpandProperty FullName | Out-File "$dest\pptx-locations.txt" -Encoding UTF8
"Found: $count" | Out-File "$dest\pptx-locations.txt" -Append
if ($results.Count -gt 0) {
  Copy-Item -Path $results[0].FullName -Destination "$dest\WASSEL_USER_MANUAL.pptx" -Force
  $admin = Get-ChildItem -Path (Split-Path $results[0].FullName) -Filter "WASSEL_ADMIN_MANUAL.pptx" -ErrorAction SilentlyContinue
  if ($admin) { Copy-Item -Path $admin.FullName -Destination "$dest\WASSEL_ADMIN_MANUAL.pptx" -Force }
}

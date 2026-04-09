$dest = "C:\Users\WIN11-24H2GPT\Desktop\wassel-v2"
$files = @("WASSEL_USER_MANUAL.pptx", "WASSEL_ADMIN_MANUAL.pptx")
$searchRoots = @(
  "C:\Users\WIN11-24H2GPT",
  "C:\Users\WIN11-24H2GPT\Desktop",
  "C:\Users\WIN11-24H2GPT\Documents",
  "C:\Users\WIN11-24H2GPT\OneDrive\Desktop",
  "C:\Users\WIN11-24H2GPT\OneDrive\Documents"
)
foreach ($file in $files) {
  foreach ($root in $searchRoots) {
    if (Test-Path $root) {
      $found = Get-ChildItem -Path $root -Filter $file -Recurse -ErrorAction SilentlyContinue -Force | Select-Object -First 1
      if ($found) {
        Copy-Item -Path $found.FullName -Destination (Join-Path $dest $file) -Force
        break
      }
    }
  }
}

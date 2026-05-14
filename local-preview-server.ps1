param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootFull = [System.IO.Path]::GetFullPath($Root)
$Prefix = "http://localhost:$Port/"

function Get-MimeType([string]$Path) {
  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  switch ($extension) {
    ".html" { "text/html; charset=utf-8"; break }
    ".css"  { "text/css; charset=utf-8"; break }
    ".js"   { "application/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".svg"  { "image/svg+xml"; break }
    ".jpg"  { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".png"  { "image/png"; break }
    ".gif"  { "image/gif"; break }
    ".webp" { "image/webp"; break }
    ".avif" { "image/avif"; break }
    ".ico"  { "image/x-icon"; break }
    default  { "application/octet-stream" }
  }
}

function Send-Text($Response, [string]$Text, [int]$StatusCode = 200, [string]$ContentType = "text/html; charset=utf-8") {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  $Response.StatusCode = $StatusCode
  $Response.ContentType = $ContentType
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Response.OutputStream.Close()
}

function Send-File($Response, [string]$Path) {
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  $Response.StatusCode = 200
  $Response.ContentType = Get-MimeType $Path
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $Response.OutputStream.Close()
}

function Send-DirectoryListing($Response, [string]$DirectoryPath, [string]$RequestPath) {
  $items = Get-ChildItem -LiteralPath $DirectoryPath | Sort-Object Name
  $links = New-Object System.Collections.Generic.List[string]

  foreach ($item in $items) {
    $name = $item.Name
    $escapedName = [System.Net.WebUtility]::HtmlEncode($name)
    $urlName = [System.Uri]::EscapeDataString($name)
    if ($item.PSIsContainer) { $urlName = "$urlName/" }
    $links.Add("<li><a href=`"$urlName`">$escapedName</a></li>")
  }

  $escapedPath = [System.Net.WebUtility]::HtmlEncode($RequestPath)
  $html = @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Directory listing for $escapedPath</title>
</head>
<body>
  <h1>Directory listing for $escapedPath</h1>
  <ul>
    $($links -join "`n    ")
  </ul>
</body>
</html>
"@
  Send-Text $Response $html 200 "text/html; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Could not start the local preview server on $Prefix" -ForegroundColor Red
  Write-Host "Another app may already be using port $Port. Close it, or edit start-local-preview.bat and change 8000 to another number like 8080."
  throw
}

Write-Host "Local portfolio preview is running:" -ForegroundColor Green
Write-Host $Prefix
Write-Host "Serving files from: $RootFull"
Write-Host "Press Ctrl+C to stop."

try {
  Start-Process $Prefix | Out-Null
} catch {
  # Browser auto-open is optional. The address is printed above.
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    try {
      $rawPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
      if ($rawPath -eq "/") { $rawPath = "/index.html" }

      $relativePath = $rawPath.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
      $targetPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($RootFull, $relativePath))

      if (-not $targetPath.StartsWith($RootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text $response "Forbidden" 403 "text/plain; charset=utf-8"
        continue
      }

      if ([System.IO.Directory]::Exists($targetPath)) {
        Send-DirectoryListing $response $targetPath $rawPath
      } elseif ([System.IO.File]::Exists($targetPath)) {
        Send-File $response $targetPath
      } else {
        Send-Text $response "Not found" 404 "text/plain; charset=utf-8"
      }
    } catch {
      Send-Text $response "Server error: $($_.Exception.Message)" 500 "text/plain; charset=utf-8"
    }
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}

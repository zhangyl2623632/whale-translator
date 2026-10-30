param(
  [string]$Version = ""
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$store = $PSScriptRoot
$repo = Split-Path -Parent $store
$extension = Join-Path $repo 'extension'
$dist = Join-Path $store 'dist'
$manifestPath = Join-Path $extension 'manifest.json'
$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $Version) { $Version = $manifest.version }
if ($Version -ne $manifest.version) {
  throw "Version argument '$Version' does not match manifest version '$($manifest.version)'."
}

$required = @(
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'translate-core.js',
  'popup.html',
  'popup.css',
  'icons/16.png',
  'icons/32.png',
  'icons/48.png',
  'icons/128.png'
)
foreach ($relative in $required) {
  if (-not (Test-Path (Join-Path $extension $relative))) {
    throw "Missing required extension file: $relative"
  }
}

$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("whale-store-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $stage | Out-Null
New-Item -ItemType Directory -Force -Path $dist | Out-Null
try {
  foreach ($relative in $required) {
    $source = Join-Path $extension $relative
    $target = Join-Path $stage $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
  }

  $zip = Join-Path $dist "whale-translator-$Version.zip"
  if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
  $zipStream = [System.IO.File]::Open($zip, [System.IO.FileMode]::CreateNew)
  try {
    $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
    try {
      foreach ($relative in $required) {
        $entryName = $relative.Replace('\', '/')
        $source = Join-Path $extension $relative
        $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        try {
          $fileStream = [System.IO.File]::OpenRead($source)
          try { $fileStream.CopyTo($entryStream) } finally { $fileStream.Dispose() }
        } finally {
          $entryStream.Dispose()
        }
      }
    } finally {
      $archive.Dispose()
    }
  } finally {
    $zipStream.Dispose()
  }

  $archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
  try {
    $names = $archive.Entries | ForEach-Object { $_.FullName }
    foreach ($relative in $required) {
      if ($names -notcontains $relative) { throw "ZIP is missing $relative" }
    }
    $size = (Get-Item $zip).Length
    Write-Output "Built: $zip"
    Write-Output "Version: $Version"
    Write-Output "Files: $($names.Count)"
    Write-Output "Size: $size bytes"
    $names | Sort-Object | ForEach-Object { Write-Output "  $_" }
  } finally {
    $archive.Dispose()
  }
} finally {
  Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
}

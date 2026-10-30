$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'bin\WhaleDesktop.exe'
if (-not (Test-Path $source)) { throw "Build first: .\desktop\build.ps1" }
$targetDir = Join-Path $env:LOCALAPPDATA 'WhaleDesktop'
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
$target = Join-Path $targetDir 'WhaleDesktop.exe'
Copy-Item -LiteralPath $source -Destination $target -Force
Start-Process -FilePath $target
Write-Output "Started: $target"
Write-Output "Tray icon: 鲸译 · 划词翻译"
Write-Output "Log: $env:TEMP\whale-desktop.log"

$ErrorActionPreference = 'Stop'
$desktop = $PSScriptRoot
$source = Join-Path $desktop 'bin\WhaleDesktop.exe'
if (-not (Test-Path $source)) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $desktop 'build.ps1')
}
if (-not (Test-Path $source)) { throw 'WhaleDesktop.exe was not built.' }

$targetDir = Join-Path $env:LOCALAPPDATA 'WhaleDesktop'
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
$target = Join-Path $targetDir 'WhaleDesktop.exe'
Copy-Item -LiteralPath $source -Destination $target -Force

$shell = New-Object -ComObject WScript.Shell
$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$startShortcut = Join-Path $startMenu 'Whale Translator.lnk'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Whale Translator.lnk'

foreach ($shortcutPath in @($startShortcut, $desktopShortcut)) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $target
    $shortcut.WorkingDirectory = $targetDir
    $shortcut.IconLocation = $target
    $shortcut.Description = 'Whale Translator'
    $shortcut.Save()
}

Write-Output "Installed: $target"
Write-Output "Start Menu: $startShortcut"
Write-Output "Desktop: $desktopShortcut"
Write-Output "Run from the tray icon; translate with mouse drag or Ctrl+Alt+W."

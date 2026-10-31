$ErrorActionPreference = 'SilentlyContinue'
Stop-Process -Name WhaleDesktop -Force
$shell = New-Object -ComObject WScript.Shell
$targetDir = Join-Path $env:LOCALAPPDATA 'WhaleDesktop'
$startShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Whale Translator.lnk'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Whale Translator.lnk'
Remove-Item -LiteralPath $startShortcut -Force
Remove-Item -LiteralPath $desktopShortcut -Force
Remove-Item -LiteralPath $targetDir -Recurse -Force
Write-Output 'Uninstalled Whale Desktop.'

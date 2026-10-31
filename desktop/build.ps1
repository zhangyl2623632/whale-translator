$ErrorActionPreference = 'Stop'
$desktop = $PSScriptRoot
$root = Split-Path -Parent $desktop
$cscDir = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319'
$gac = 'C:\Windows\Microsoft.NET\assembly\GAC_MSIL'
$csc = Join-Path $cscDir 'csc.exe'
if (-not (Test-Path $csc)) { throw "csc.exe not found at $csc" }

function GacPath([string]$name, [string]$token) {
    $dir = Join-Path $gac $name
    $file = Get-ChildItem $dir -Recurse -Filter "$name.dll" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match $token } |
        Select-Object -First 1
    if (-not $file) { throw "Could not resolve $name from GAC" }
    return $file.FullName
}

$refs = @(
    (Join-Path $cscDir 'System.dll'),
    (Join-Path $cscDir 'System.Core.dll'),
    (Join-Path $cscDir 'System.Drawing.dll'),
    (Join-Path $cscDir 'System.Windows.Forms.dll'),
    (Join-Path $cscDir 'System.Web.Extensions.dll'),
    (Join-Path $cscDir 'System.Web.dll'),
    (Join-Path $cscDir 'System.Xml.dll'),
    (GacPath 'System.Net.Http' 'b03f5f7f11d50a3a'),
    (GacPath 'UIAutomationClient' '31bf3856ad364e35'),
    (GacPath 'UIAutomationTypes' '31bf3856ad364e35'),
    (GacPath 'WindowsBase' '31bf3856ad364e35')
)

$outDir = Join-Path $desktop 'bin'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir 'WhaleDesktop.exe'
$source = Join-Path $desktop 'WhaleDesktop.cs'
$assemblyInfo = Join-Path $desktop 'AssemblyInfo.cs'
$icon = Join-Path $desktop 'whale.ico'

$arguments = @(
    '/nologo',
    '/target:winexe',
    '/platform:anycpu',
    '/optimize+',
    ('/out:' + $out),
    ('/win32icon:' + $icon)
)
foreach ($ref in $refs) { $arguments += ('/r:' + $ref) }
$arguments += $source
$arguments += $assemblyInfo

& $csc @arguments
if ($LASTEXITCODE -ne 0) { throw "csc failed with exit code $LASTEXITCODE" }
Write-Output "Built: $out"
Get-Item $out | Select-Object Length

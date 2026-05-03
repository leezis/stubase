param(
  [string]$InstallDirectory = "$env:LOCALAPPDATA\DsyStubase\HwpAutomation"
)

$ErrorActionPreference = "Stop"

$moduleName = "FilePathCheckerModuleExample"
$downloadUrl = "https://github.com/hancom-io/devcenter-archive/raw/main/hwp-automation/%EB%B3%B4%EC%95%88%EB%AA%A8%EB%93%88(Automation).zip"
$zipPath = Join-Path $InstallDirectory "hwp-security-module.zip"
$dllPath = Join-Path $InstallDirectory "$moduleName.dll"

New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null

Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
Expand-Archive -LiteralPath $zipPath -DestinationPath $InstallDirectory -Force

$foundDll = Get-ChildItem -LiteralPath $InstallDirectory -Recurse -Filter "$moduleName.dll" |
  Select-Object -First 1

if (-not $foundDll) {
  throw "The Hancom security module DLL was not found after extraction."
}

if ($foundDll.FullName -ne $dllPath) {
  Copy-Item -LiteralPath $foundDll.FullName -Destination $dllPath -Force
}

$registryPaths = @(
  "HKCU:\Software\HNC\HwpAutomation\Modules",
  "HKCU:\Software\Hnc\HwpAutomation\Modules"
)

foreach ($registryPath in $registryPaths) {
  New-Item -Path $registryPath -Force | Out-Null
  New-ItemProperty `
    -Path $registryPath `
    -Name $moduleName `
    -Value $dllPath `
    -PropertyType String `
    -Force |
    Out-Null
}

$hwp = $null

try {
  $hwp = New-Object -ComObject HWPFrame.HwpObject
  $registered = $hwp.RegisterModule("FilePathCheckDLL", $moduleName)

  [pscustomobject]@{
    ModuleName = $moduleName
    DllPath = $dllPath
    RegisterModule = $registered
  }
} finally {
  if ($hwp -ne $null) {
    try { $hwp.Quit() | Out-Null } catch {}
  }
}

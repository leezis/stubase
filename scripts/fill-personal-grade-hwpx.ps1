param(
  [Parameter(Mandatory = $true)]
  [string]$TemplatePath,

  [Parameter(Mandatory = $true)]
  [string]$PayloadPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"

function Set-HwpFindReplaceOption {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp,

    [Parameter(Mandatory = $true)]
    [string]$FindString,

    [AllowEmptyString()]
    [string]$ReplaceString
  )

  $Hwp.HAction.GetDefault("AllReplace", $Hwp.HParameterSet.HFindReplace.HSet) | Out-Null

  $option = $Hwp.HParameterSet.HFindReplace
  $option.FindString = $FindString
  $option.ReplaceString = $ReplaceString
  $option.IgnoreMessage = 1
  $option.ReplaceMode = 1

  try { $option.Direction = $Hwp.FindDir("AllDoc") } catch {}
  try { $option.FindType = 1 } catch {}
  try { $option.UseWildCards = 0 } catch {}
  try { $option.MatchCase = 0 } catch {}
  try { $option.WholeWordOnly = 0 } catch {}
}

if (-not (Test-Path -LiteralPath $TemplatePath)) {
  throw "Template file was not found: $TemplatePath"
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$payload = Get-Content -LiteralPath $PayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
$hwp = $null

try {
  $hwp = New-Object -ComObject HWPFrame.HwpObject

  try { $hwp.XHwpWindows.Item(0).Visible = $false } catch {}
  try { $hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule") | Out-Null } catch {}

  $opened = $hwp.Open($TemplatePath, "HWPX", "forceopen:true")
  if (-not $opened) {
    throw "Hancom HWP could not open the template."
  }

  foreach ($property in $payload.placeholders.PSObject.Properties) {
    $findString = "{{" + $property.Name + "}}"
    $replaceString = ""
    if ($null -ne $property.Value) {
      $replaceString = [string]$property.Value
    }

    Set-HwpFindReplaceOption -Hwp $hwp -FindString $findString -ReplaceString $replaceString
    $hwp.HAction.Execute("AllReplace", $hwp.HParameterSet.HFindReplace.HSet) | Out-Null
  }

  $saved = $hwp.SaveAs($OutputPath, "HWPX", "download:true")
  if (-not $saved -or -not (Test-Path -LiteralPath $OutputPath)) {
    throw "Hancom HWP could not save the output file."
  }
} finally {
  if ($hwp -ne $null) {
    try { $hwp.Clear(3) | Out-Null } catch {}
    try { $hwp.Quit() | Out-Null } catch {}
  }
}

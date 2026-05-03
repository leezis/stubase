$ErrorActionPreference = "Stop"

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-WorkerResponse {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Payload
  )

  [Console]::Out.WriteLine(($Payload | ConvertTo-Json -Compress -Depth 8))
  [Console]::Out.Flush()
}

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

function Set-HwpRepeatFindOption {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp,

    [Parameter(Mandatory = $true)]
    [string]$FindString
  )

  $Hwp.HAction.GetDefault("RepeatFind", $Hwp.HParameterSet.HFindReplace.HSet) | Out-Null

  $option = $Hwp.HParameterSet.HFindReplace
  $option.FindString = $FindString
  $option.IgnoreMessage = 1
  $option.ReplaceMode = 0

  try { $option.Direction = $Hwp.FindDir("Forward") } catch {}
  try { $option.FindType = 1 } catch {}
  try { $option.UseWildCards = 0 } catch {}
  try { $option.MatchCase = 0 } catch {}
  try { $option.WholeWordOnly = 0 } catch {}
}

function Set-HwpSelectedTextHeight {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp,

    [Parameter(Mandatory = $true)]
    [int]$Height,

    [bool]$Bold = $false
  )

  $Hwp.HAction.GetDefault("CharShape", $Hwp.HParameterSet.HCharShape.HSet) | Out-Null
  $charShape = $Hwp.HParameterSet.HCharShape

  try { $charShape.Height = $Height } catch {}
  if ($Bold) {
    try { $charShape.Bold = 1 } catch {}
  }
  $Hwp.HAction.Execute("CharShape", $Hwp.HParameterSet.HCharShape.HSet) | Out-Null
}

function Set-HwpSecondNameTextHeight {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp,

    [AllowEmptyString()]
    [string]$NameText,

    [Parameter(Mandatory = $true)]
    [int]$Height
  )

  if ([string]::IsNullOrWhiteSpace($NameText)) {
    return
  }

  try { $Hwp.Run("MoveDocBegin") | Out-Null } catch {}

  for ($index = 0; $index -lt 2; $index++) {
    Set-HwpRepeatFindOption -Hwp $Hwp -FindString $NameText
    $found = $Hwp.HAction.Execute("RepeatFind", $Hwp.HParameterSet.HFindReplace.HSet)

    if (-not $found) {
      return
    }
  }

  Set-HwpSelectedTextHeight -Hwp $Hwp -Height $Height -Bold $true
  try { $Hwp.Run("Cancel") | Out-Null } catch {}
}

function Set-HwpExactTextHeight {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp,

    [Parameter(Mandatory = $true)]
    [string]$Text,

    [Parameter(Mandatory = $true)]
    [int]$Height,

    [bool]$Bold = $false
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return
  }

  try { $Hwp.Run("MoveDocBegin") | Out-Null } catch {}

  Set-HwpRepeatFindOption -Hwp $Hwp -FindString $Text
  $found = $Hwp.HAction.Execute("RepeatFind", $Hwp.HParameterSet.HFindReplace.HSet)

  if (-not $found) {
    return
  }

  Set-HwpSelectedTextHeight -Hwp $Hwp -Height $Height -Bold $Bold
  try { $Hwp.Run("Cancel") | Out-Null } catch {}
}

function Set-HwpVolunteerAwardNoteTextHeight {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp
  )

  Set-HwpExactTextHeight -Hwp $Hwp -Text "가산점 : 봉사상 수상" -Height 1000 -Bold $true
  Set-HwpExactTextHeight -Hwp $Hwp -Text "봉사상 수상" -Height 1000 -Bold $true
  Set-HwpExactTextHeight -Hwp $Hwp -Text "(학년별 상위 4%까지)" -Height 1000 -Bold $true
}

function New-HwpObject {
  $hwp = New-Object -ComObject HWPFrame.HwpObject

  try { $hwp.XHwpWindows.Item(0).Visible = $false } catch {}

  foreach ($moduleName in @("AutomationModule", "FilePathCheckerModuleExample", "FilePathCheckerModule")) {
    try {
      if ($hwp.RegisterModule("FilePathCheckDLL", $moduleName)) {
        [Console]::Error.WriteLine("Registered HWP file path module: $moduleName")
        break
      }
    } catch {}
  }

  return $hwp
}

function Invoke-HwpJob {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp,

    [Parameter(Mandatory = $true)]
    [string]$TemplatePath,

    [Parameter(Mandatory = $true)]
    [string]$PayloadPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
  )

  if (-not (Test-Path -LiteralPath $TemplatePath)) {
    throw "Template file was not found: $TemplatePath"
  }

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  $payload = Get-Content -LiteralPath $PayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $opened = $Hwp.Open($TemplatePath, "HWPX", "forceopen:true")
  if (-not $opened) {
    throw "Hancom HWP could not open the template."
  }

  foreach ($property in $payload.placeholders.PSObject.Properties) {
    $findString = "{{" + $property.Name + "}}"
    $replaceString = ""
    if ($null -ne $property.Value) {
      $replaceString = [string]$property.Value
    }

    Set-HwpFindReplaceOption -Hwp $Hwp -FindString $findString -ReplaceString $replaceString
    $Hwp.HAction.Execute("AllReplace", $Hwp.HParameterSet.HFindReplace.HSet) | Out-Null
  }

  Set-HwpSecondNameTextHeight -Hwp $Hwp -NameText $payload.nameText -Height 1500
  Set-HwpVolunteerAwardNoteTextHeight -Hwp $Hwp

  $saved = $Hwp.SaveAs($OutputPath, "HWPX", "download:true")
  if (-not $saved -or -not (Test-Path -LiteralPath $OutputPath)) {
    throw "Hancom HWP could not save the output file."
  }

  try { $Hwp.Clear(3) | Out-Null } catch {}
}

function Invoke-HwpResaveJob {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp,

    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
  )

  if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "Source file was not found: $SourcePath"
  }

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  $opened = $Hwp.Open($SourcePath, "HWPX", "forceopen:true")
  if (-not $opened) {
    throw "Hancom HWP could not open the source file."
  }

  $saved = $Hwp.SaveAs($OutputPath, "HWPX", "download:true")
  if (-not $saved -or -not (Test-Path -LiteralPath $OutputPath)) {
    throw "Hancom HWP could not save the output file."
  }

  try { $Hwp.Clear(3) | Out-Null } catch {}
}

function Invoke-HwpReplacePlaceholders {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp,

    [Parameter(Mandatory = $true)]
    $Placeholders
  )

  foreach ($property in $Placeholders.PSObject.Properties) {
    $findString = "{{" + $property.Name + "}}"
    $replaceString = ""
    if ($null -ne $property.Value) {
      $replaceString = [string]$property.Value
    }

    Set-HwpFindReplaceOption -Hwp $Hwp -FindString $findString -ReplaceString $replaceString
    $Hwp.HAction.Execute("AllReplace", $Hwp.HParameterSet.HFindReplace.HSet) | Out-Null
  }
}

function Invoke-HwpCombinedJob {
  param(
    [Parameter(Mandatory = $true)]
    $Hwp,

    [Parameter(Mandatory = $true)]
    [string]$TemplatePath,

    [Parameter(Mandatory = $true)]
    [string]$PayloadPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
  )

  if (-not (Test-Path -LiteralPath $TemplatePath)) {
    throw "Template file was not found: $TemplatePath"
  }

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  $payload = Get-Content -LiteralPath $PayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $records = @($payload.records)

  if ($records.Count -eq 0) {
    throw "No records were provided for the combined HWPX file."
  }

  $workDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("personal-grade-combine-" + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $workDirectory | Out-Null
  $tempFiles = New-Object System.Collections.Generic.List[string]

  try {
    for ($index = 0; $index -lt $records.Count; $index++) {
      $tempPath = Join-Path $workDirectory ("record-" + $index + ".hwpx")
      $opened = $Hwp.Open($TemplatePath, "HWPX", "forceopen:true")
      if (-not $opened) {
        throw "Hancom HWP could not open the template."
      }

      Invoke-HwpReplacePlaceholders -Hwp $Hwp -Placeholders $records[$index].placeholders
      Set-HwpSecondNameTextHeight -Hwp $Hwp -NameText $records[$index].nameText -Height 1500
      Set-HwpVolunteerAwardNoteTextHeight -Hwp $Hwp

      $saved = $Hwp.SaveAs($tempPath, "HWPX", "download:true")
      if (-not $saved -or -not (Test-Path -LiteralPath $tempPath)) {
        throw "Hancom HWP could not save a temporary HWPX file."
      }

      $tempFiles.Add($tempPath) | Out-Null
      try { $Hwp.Clear(3) | Out-Null } catch {}
    }

    $openedCombined = $Hwp.Open($tempFiles[0], "HWPX", "forceopen:true")
    if (-not $openedCombined) {
      throw "Hancom HWP could not open the first temporary HWPX file."
    }

    for ($index = 1; $index -lt $tempFiles.Count; $index++) {
      try { $Hwp.Run("MoveDocEnd") | Out-Null } catch {}
      try { $Hwp.Run("BreakPage") | Out-Null } catch {}
      $Hwp.Insert($tempFiles[$index], "HWPX", "") | Out-Null
    }

    $combinedSaved = $Hwp.SaveAs($OutputPath, "HWPX", "download:true")
    if (-not $combinedSaved -or -not (Test-Path -LiteralPath $OutputPath)) {
      throw "Hancom HWP could not save the combined output file."
    }

    try { $Hwp.Clear(3) | Out-Null } catch {}
  } finally {
    try { $Hwp.Clear(3) | Out-Null } catch {}
    if (Test-Path -LiteralPath $workDirectory) {
      Remove-Item -LiteralPath $workDirectory -Recurse -Force
    }
  }
}

$hwp = $null

try {
  $hwp = New-HwpObject

  while ($true) {
    $line = [Console]::In.ReadLine()

    if ($null -eq $line -or $line -eq "__quit__") {
      break
    }

    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $job = $line | ConvertFrom-Json

    try {
      if ($job.mode -eq "combine") {
        Invoke-HwpCombinedJob `
          -Hwp $hwp `
          -TemplatePath $job.templatePath `
          -PayloadPath $job.payloadPath `
          -OutputPath $job.outputPath
      } elseif ($job.mode -eq "resave") {
        Invoke-HwpResaveJob `
          -Hwp $hwp `
          -SourcePath $job.sourcePath `
          -OutputPath $job.outputPath
      } else {
        Invoke-HwpJob `
          -Hwp $hwp `
          -TemplatePath $job.templatePath `
          -PayloadPath $job.payloadPath `
          -OutputPath $job.outputPath
      }

      Write-WorkerResponse @{ id = $job.id; ok = $true }
    } catch {
      try { $hwp.Clear(3) | Out-Null } catch {}
      Write-WorkerResponse @{
        id = $job.id
        ok = $false
        error = $_.Exception.Message
      }
    }
  }
} finally {
  if ($hwp -ne $null) {
    try { $hwp.Quit() | Out-Null } catch {}
  }
}

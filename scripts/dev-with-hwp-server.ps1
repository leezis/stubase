param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ViteArgs
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$serverScript = Join-Path $repoRoot "scripts\personal-grade-hwp-server.mjs"
$viteCommand = Join-Path $repoRoot "node_modules\.bin\vite.cmd"

if ($ViteArgs.Count -eq 0) {
  $ViteArgs = @("--host", "127.0.0.1", "--port", "5174")
}

$serverProcess = Start-Process `
  -FilePath "node.exe" `
  -ArgumentList "`"$serverScript`"" `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -PassThru

try {
  & $viteCommand @ViteArgs
} finally {
  if ($serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}

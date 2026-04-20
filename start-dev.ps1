$nodeDir = 'C:\Program Files\nodejs'
$nodeExe = Join-Path $nodeDir 'node.exe'
$npmCli = Join-Path $nodeDir 'node_modules\npm\bin\npm-cli.js'

if (-not (Test-Path -LiteralPath $nodeExe)) {
  throw "Node.js executable not found at $nodeExe"
}

if (-not (Test-Path -LiteralPath $npmCli)) {
  throw "npm CLI not found at $npmCli"
}

$env:Path = "$nodeDir;$env:Path"

& $nodeExe $npmCli run dev -- --host --port 5174

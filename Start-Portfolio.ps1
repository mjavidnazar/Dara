$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicPort = 4173
$appUrl = "http://127.0.0.1:$publicPort"

function Test-DaraPort {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $task = $client.ConnectAsync("127.0.0.1", $publicPort)
        if (-not $task.Wait(250)) {
            $client.Dispose()
            return $false
        }
        $connected = $client.Connected
        $client.Dispose()
        return $connected
    } catch {
        return $false
    }
}

if (-not (Test-DaraPort)) {
    $runtimeFolder = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
    $runtimeNode = Join-Path $runtimeFolder "node.exe"
    if (Test-Path $runtimeNode) {
        $nodeExecutable = $runtimeNode
    } else {
        $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $systemNode) {
            Add-Type -AssemblyName PresentationFramework
            [System.Windows.MessageBox]::Show(
                "A local runtime was not found. Please install Node.js and try again.",
                "Dara",
                "OK",
                "Error"
            ) | Out-Null
            exit 1
        }
        $nodeExecutable = $systemNode.Source
    }

    Start-Process -FilePath $nodeExecutable -ArgumentList "local-server.cjs" -WorkingDirectory $appRoot -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 300
        if (Test-DaraPort) { break }
    }
}

Start-Process $appUrl

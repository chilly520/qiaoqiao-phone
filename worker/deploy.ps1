# Chilly Phone Push Server one-click deploy
# Usage: .\deploy.ps1

$ErrorActionPreference = "Continue"
$WorkerDir = $PSScriptRoot
Set-Location $WorkerDir

# Fix PS5 output encoding for CJK
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Step {
    param([string]$Msg, [string]$Color = "Yellow")
    Write-Host ""
    Write-Host "[$Msg]" -ForegroundColor $Color
}

function Write-Ok {
    param([string]$Msg)
    Write-Host "  OK: $Msg" -ForegroundColor Green
}

function Write-Skip {
    param([string]$Msg)
    Write-Host "  Skip: $Msg" -ForegroundColor Gray
}

function Write-Fail {
    param([string]$Msg)
    Write-Host "  FAIL: $Msg" -ForegroundColor Red
}

# Helper: run external command, capture stdout+stderr, return clean output + exit code
function Invoke-External {
    param([string]$Cmd, [string[]]$Args = @())
    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $p = Start-Process -FilePath $Cmd -ArgumentList $Args -NoNewWindow -Wait `
            -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
        $stdout = Get-Content $stdoutFile -Raw -Encoding UTF8
        $stderr = Get-Content $stderrFile -Raw -Encoding UTF8
        return @{ ExitCode = $p.ExitCode; StdOut = $stdout; StdErr = $stderr; Combined = $stdout + "`n" + $stderr }
    } finally {
        Remove-Item $stdoutFile, $stderrFile -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Chilly Phone Push Server One-Click Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# ---------- 1. Install deps ----------
Write-Step "1/6 Install dependencies"
if (-not (Test-Path "node_modules")) {
    $r = Invoke-External "npm" @("install")
    if ($r.ExitCode -ne 0) {
        Write-Host $r.Combined
        throw "npm install failed"
    }
    Write-Ok "npm install done"
} else {
    Write-Skip "node_modules already exists"
}

# ---------- 2. Cloudflare login ----------
Write-Step "2/6 Check Cloudflare login"
$r = Invoke-External "npx" @("wrangler", "whoami")
$loggedIn = ($r.ExitCode -eq 0) -and ($r.StdOut -match "@")
if ($loggedIn) {
    Write-Ok "Already logged in: $($r.StdOut.Trim() -split "`n" | Select-Object -First 1)"
} else {
    Write-Host "  Not logged in, opening browser for auth..." -ForegroundColor Yellow
    $login = Invoke-External "npx" @("wrangler", "login")
    if ($login.ExitCode -ne 0) {
        Write-Host $login.Combined
        throw "wrangler login failed"
    }
    Write-Ok "Login successful"
}

# ---------- 3. Create KV namespaces ----------
Write-Step "3/6 Create KV namespaces"

function Get-Or-Create-KV {
    param([string]$Name)
    $list = Invoke-External "npx" @("wrangler", "kv:namespace", "list")
    if ($list.ExitCode -ne 0) {
        throw "wrangler kv:namespace list failed: $($list.Combined)"
    }
    # Output JSON: [{"id":"...","title":"Name"}]
    $pattern = '"id"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"' + [regex]::Escape($Name) + '"'
    $match = [regex]::Match($list.StdOut, $pattern)
    if ($match.Success) {
        Write-Ok "Reuse existing $Name : $($match.Groups[1].Value)"
        return $match.Groups[1].Value
    } else {
        Write-Host "  Creating $Name ..." -ForegroundColor Yellow
        $create = Invoke-External "npx" @("wrangler", "kv:namespace", "create", $Name)
        if ($create.ExitCode -ne 0) {
            throw "Failed to create $Name : $($create.Combined)"
        }
        $idMatch = [regex]::Match($create.StdOut, 'id\s*=\s*"([^"]+)"')
        if (-not $idMatch.Success) {
            throw "Cannot parse id from: $($create.StdOut)"
        }
        return $idMatch.Groups[1].Value
    }
}

$subId = Get-Or-Create-KV "SUBSCRIPTIONS"
$schId = Get-Or-Create-KV "SCHEDULED"

# ---------- 4. Update wrangler.toml ----------
Write-Step "4/6 Update wrangler.toml"

$toml = Get-Content "wrangler.toml" -Raw -Encoding UTF8
$toml = $toml -replace '(binding\s*=\s*"SUBSCRIPTIONS"[\s\S]*?id\s*=\s*")REPLACE_WITH_ACTUAL_ID(")', ('$1' + $subId + '$2')
$toml = $toml -replace '(binding\s*=\s*"SUBSCRIPTIONS"[\s\S]*?preview_id\s*=\s*")REPLACE_WITH_PREVIEW_ID(")', ('$1' + $subId + '$2')
$toml = $toml -replace '(binding\s*=\s*"SCHEDULED"[\s\S]*?id\s*=\s*")REPLACE_WITH_ACTUAL_ID(")', ('$1' + $schId + '$2')
$toml = $toml -replace '(binding\s*=\s*"SCHEDULED"[\s\S]*?preview_id\s*=\s*")REPLACE_WITH_PREVIEW_ID(")', ('$1' + $schId + '$2')

[System.IO.File]::WriteAllText("wrangler.toml", $toml, [System.Text.UTF8Encoding]::new($false))
Write-Ok "wrangler.toml updated"

# ---------- 5. Generate VAPID keys + set secrets ----------
Write-Step "5/6 Generate VAPID keys + write secrets"

$wpNode = Join-Path $WorkerDir "node_modules\web-push"
if (-not (Test-Path $wpNode)) {
    Write-Fail "web-push not installed, run: npm install web-push"
    exit 1
}

# Generate via inline node script (uses web-push library)
$genScript = @"
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
process.stdout.write(JSON.stringify({ publicKey: keys.publicKey, privateKey: keys.privateKey }));
"@
$genFile = [System.IO.Path]::GetTempFileName() + ".js"
[System.IO.File]::WriteAllText($genFile, $genScript, [System.Text.UTF8Encoding]::new($false))
try {
    $genResult = Invoke-External "node" @($genFile)
    if ($genResult.ExitCode -ne 0) {
        throw "VAPID generation failed: $($genResult.Combined)"
    }
    $keys = $genResult.StdOut.Trim() | ConvertFrom-Json
    $publicKey = $keys.publicKey
    $privateKey = $keys.privateKey
} finally {
    Remove-Item $genFile -ErrorAction SilentlyContinue
}

if (-not $publicKey -or -not $privateKey) {
    throw "Failed to parse VAPID keys"
}
Write-Host "  Public key: $publicKey" -ForegroundColor Gray

function Set-Wrangler-Secret {
    param([string]$Name, [string]$Value)
    $tmpFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmpFile, $Value, [System.Text.UTF8Encoding]::new($false))
    try {
        $p = Start-Process -FilePath "npx" -ArgumentList @("wrangler", "secret", "put", $Name) `
            -NoNewWindow -Wait -PassThru -RedirectStandardInput $tmpFile `
            -RedirectStandardOutput ([System.IO.Path]::GetTempFileName()) `
            -RedirectStandardError ([System.IO.Path]::GetTempFileName())
        if ($p.ExitCode -ne 0) {
            throw "Failed to set $Name"
        }
        Write-Ok "Secret $Name set"
    } finally {
        Remove-Item $tmpFile -ErrorAction SilentlyContinue
    }
}

Set-Wrangler-Secret "VAPID_PUBLIC_KEY" $publicKey
Set-Wrangler-Secret "VAPID_PRIVATE_KEY" $privateKey
Set-Wrangler-Secret "VAPID_SUBJECT" "mailto:admin@chilly-phone.local"

# ---------- 6. Deploy ----------
Write-Step "6/6 Deploy to Cloudflare Workers"
$deploy = Invoke-External "npx" @("wrangler", "deploy")
Write-Host $deploy.StdOut
if ($deploy.ExitCode -ne 0) {
    Write-Host $deploy.StdErr
    throw "Deploy failed"
}

# Extract deployed URL
$urlMatch = [regex]::Match($deploy.StdOut, 'https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev')
if ($urlMatch.Success) {
    $workerUrl = $urlMatch.Value
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Deploy succeeded!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Worker URL: $workerUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Test health: curl $workerUrl/health" -ForegroundColor Gray
    Write-Host "  2. Create .env.production in project root:" -ForegroundColor Gray
    Write-Host "     VITE_PUSH_SERVER_URL=$workerUrl" -ForegroundColor Cyan
    Write-Host "  3. Run: npm run build" -ForegroundColor Gray
    Write-Host "  4. Open Chilly Phone -> Settings -> Push Notifications" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "Deploy finished, but could not auto-extract URL. Check output above." -ForegroundColor Yellow
}

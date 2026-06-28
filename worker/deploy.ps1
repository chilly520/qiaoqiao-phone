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

function Write-Warn {
    param([string]$Msg)
    Write-Host "  WARN: $Msg" -ForegroundColor DarkYellow
}

# Helper: run external command, capture stdout+stderr, return clean output + exit code
# Note: must wrap with cmd.exe because npx/npm/etc are .cmd batch files on Windows;
# Start-Process can't run them directly without shell handling.
function Invoke-External {
    param([string]$Cmd, [string[]]$CmdArgs = @())
    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        # Build command line: quote args with spaces, join with spaces
        $quoted = @()
        foreach ($a in $CmdArgs) {
            if ($a -match '\s|"') {
                $quoted += '"' + ($a -replace '"', '\"') + '"'
            } else {
                $quoted += $a
            }
        }
        $cmdLine = $Cmd + ' ' + ($quoted -join ' ')

        $p = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $cmdLine) `
            -NoNewWindow -Wait -PassThru `
            -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile

        $stdout = ""
        $stderr = ""
        if (Test-Path $stdoutFile) { $stdout = Get-Content $stdoutFile -Raw -Encoding UTF8 }
        if (Test-Path $stderrFile) { $stderr = Get-Content $stderrFile -Raw -Encoding UTF8 }
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
    if ($list.ExitCode -ne 0 -and [string]::IsNullOrWhiteSpace($list.StdOut)) {
        throw "wrangler kv:namespace list failed: $($list.Combined)"
    }

    # Debug: print first 500 chars so we can see actual format if it fails
    $debugPreview = if ($list.StdOut.Length -gt 500) { $list.StdOut.Substring(0, 500) } else { $list.StdOut }

    # Extract just the JSON portion (between first [ and matching ])
    # Wrangler 3 prints telemetry/warning text before the actual JSON array
    $jsonStart = $list.StdOut.IndexOf('[')
    $jsonEnd = $list.StdOut.LastIndexOf(']')
    $jsonText = $null
    if ($jsonStart -ge 0 -and $jsonEnd -gt $jsonStart) {
        $jsonText = $list.StdOut.Substring($jsonStart, $jsonEnd - $jsonStart + 1)
    }
    # Normalize single quotes to double quotes for wrangler v3
    if ($jsonText) { $jsonText = $jsonText -replace "'", '"' }

    # Try to find existing namespace with this name.
    $existing = $null

    if ($jsonText) {
        try {
            $parsed = $jsonText | ConvertFrom-Json -ErrorAction Stop
            $items = @($parsed)
            foreach ($item in $items) {
                $t = $item.title
                if ($t -eq $Name -or $t -like "*-$Name" -or $t -eq "chilly-phone-push-$Name") {
                    $existing = $item.id
                    break
                }
            }
        } catch {
            Write-Warn "ConvertFrom-Json failed. Preview of output:"
            Write-Host $debugPreview -ForegroundColor DarkYellow
        }
    }

    # Approach 2: regex fallback
    if (-not $existing) {
        $patterns = @(
            '"id"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"([^"]+)"',
            '"title"\s*:\s*"([^"]+)"\s*,\s*"id"\s*:\s*"([^"]+)"'
        )
        foreach ($p in $patterns) {
            $matches = [regex]::Matches($jsonText, $p)
            foreach ($m in $matches) {
                if ($m.Groups.Count -ge 3) {
                    $id = $m.Groups[1].Value
                    $title = $m.Groups[2].Value
                    if ($title -eq $Name -or $title -like "*-$Name") {
                        $existing = $id
                        break
                    }
                }
            }
            if ($existing) { break }
        }
    }

    if ($existing) {
        Write-Ok "Reuse existing $Name : $existing"
        return $existing
    }

    # Not found - try to create
    Write-Host "  Could not find $Name in list. Raw output:" -ForegroundColor Yellow
    Write-Host $list.StdOut -ForegroundColor DarkYellow
    Write-Host "  Creating $Name ..." -ForegroundColor Yellow
    $create = Invoke-External "npx" @("wrangler", "kv:namespace", "create", $Name)
    if ($create.ExitCode -ne 0) {
        if ($create.Combined -match "already exists") {
            throw "Cannot locate $Name but it already exists. Report list output above to dev."
        }
        throw "Failed to create $Name : $($create.Combined)"
    }
    $idMatch = [regex]::Match($create.StdOut, 'id\s*=\s*"([^"]+)"')
    if (-not $idMatch.Success) {
        throw "Cannot parse id from: $($create.StdOut)"
    }
    return $idMatch.Groups[1].Value
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

# Ensure compatibility_flags = ["nodejs_compat"] is present (web-push needs Node builtins)
if ($toml -notmatch 'compatibility_flags') {
    # Insert after compatibility_date line
    $toml = $toml -replace '(compatibility_date\s*=\s*"[^"]+")', ('$1' + "`ncompatibility_flags = [""nodejs_compat""]")
    Write-Ok "Added compatibility_flags = [nodejs_compat]"
} elseif ($toml -notmatch 'nodejs_compat') {
    # Has compatibility_flags but missing nodejs_compat - add it
    $toml = $toml -replace 'compatibility_flags\s*=\s*\[([^\]]*)\]', 'compatibility_flags = [$1, "nodejs_compat"]'
    Write-Ok "Appended nodejs_compat to compatibility_flags"
} else {
    Write-Skip "compatibility_flags already includes nodejs_compat"
}

[System.IO.File]::WriteAllText("wrangler.toml", $toml, [System.Text.UTF8Encoding]::new($false))
Write-Ok "wrangler.toml updated"

# ---------- 5. Generate VAPID keys + set secrets ----------
Write-Step "5/6 Generate VAPID keys + write secrets"

# Use web-push CLI to generate VAPID keys
$keyGen = Invoke-External "npx" @("web-push", "generate-vapid-keys")
if ($keyGen.ExitCode -ne 0) {
    Write-Host $keyGen.Combined
    throw "VAPID key generation failed"
}

# Output format:
#   ===============================
#   Public Key:
#   <base64url>
#   Private Key:
#   <base64url>
#   ===============================
$pubMatch = [regex]::Match($keyGen.StdOut, '(?im)^\s*Public\s*Key:\s*$')
$privMatch = [regex]::Match($keyGen.StdOut, '(?im)^\s*Private\s*Key:\s*$')
if (-not $pubMatch.Success -or -not $privMatch.Success) {
    throw "Cannot find Public/Private Key markers in: $($keyGen.StdOut)"
}

# Take the line right after each marker
$lines = $keyGen.StdOut -split "`n"
$publicKey = $null
$privateKey = $null
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '^\s*Public\s*Key:\s*$') {
        $publicKey = $lines[$i + 1].Trim()
    }
    if ($lines[$i] -match '^\s*Private\s*Key:\s*$') {
        $privateKey = $lines[$i + 1].Trim()
    }
}

if (-not $publicKey -or -not $privateKey) {
    throw "Failed to extract VAPID keys from: $($keyGen.StdOut)"
}
Write-Host "  Public key: $publicKey" -ForegroundColor Gray

function Set-Wrangler-Secret {
    param([string]$Name, [string]$Value)
    $tmpFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tmpFile, $Value, [System.Text.UTF8Encoding]::new($false))
    try {
        $p = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "npx wrangler secret put $Name < `"$tmpFile`"") `
            -NoNewWindow -Wait -PassThru `
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

# Chilly Phone Push Server 一键部署脚本
# 用法: .\deploy.ps1

$ErrorActionPreference = "Stop"
$WorkerDir = $PSScriptRoot
Set-Location $WorkerDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Chilly Phone Push Server 一键部署" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------- 1. 安装依赖 ----------
Write-Host "[1/6] 安装依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }
} else {
    Write-Host "  跳过 (node_modules 已存在)" -ForegroundColor Gray
}

# ---------- 2. 登录 Cloudflare ----------
Write-Host ""
Write-Host "[2/6] 检查 Cloudflare 登录状态..." -ForegroundColor Yellow
$whoami = npx wrangler whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  未登录,即将打开浏览器授权..." -ForegroundColor Yellow
    npx wrangler login
    if ($LASTEXITCODE -ne 0) { throw "登录失败" }
} else {
    Write-Host "  已登录" -ForegroundColor Green
}

# ---------- 3. 创建 KV 命名空间 ----------
Write-Host ""
Write-Host "[3/6] 创建 KV 命名空间..." -ForegroundColor Yellow

function Get-Or-Create-KV {
    param([string]$Name)
    $list = npx wrangler kv:namespace list 2>&1 | Out-String
    # 输出格式: { "id": "xxx", "title": "Name" }
    $pattern = '"id"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"' + [regex]::Escape($Name) + '"'
    $match = [regex]::Match($list, $pattern)
    if ($match.Success) {
        Write-Host "  复用已存在的 $Name : $($match.Groups[1].Value)" -ForegroundColor Green
        return $match.Groups[1].Value
    } else {
        Write-Host "  创建 $Name ..." -ForegroundColor Yellow
        $out = npx wrangler kv:namespace create $Name 2>&1 | Out-String
        $idMatch = [regex]::Match($out, 'id\s*=\s*"([^"]+)"')
        if (-not $idMatch.Success) {
            throw "无法从 wrangler 输出解析 id: $out"
        }
        return $idMatch.Groups[1].Value
    }
}

$subId = Get-Or-Create-KV "SUBSCRIPTIONS"
$schId = Get-Or-Create-KV "SCHEDULED"

# ---------- 4. 更新 wrangler.toml ----------
Write-Host ""
Write-Host "[4/6] 更新 wrangler.toml..." -ForegroundColor Yellow

$toml = Get-Content "wrangler.toml" -Raw
# 只替换第一对 SUBSCRIPTIONS 的占位符
$toml = $toml -replace '(binding\s*=\s*"SUBSCRIPTIONS"[\s\S]*?id\s*=\s*")REPLACE_WITH_ACTUAL_ID(")', ('$1' + $subId + '$2')
$toml = $toml -replace '(binding\s*=\s*"SUBSCRIPTIONS"[\s\S]*?preview_id\s*=\s*")REPLACE_WITH_PREVIEW_ID(")', ('$1' + $subId + '$2')
$toml = $toml -replace '(binding\s*=\s*"SCHEDULED"[\s\S]*?id\s*=\s*")REPLACE_WITH_ACTUAL_ID(")', ('$1' + $schId + '$2')
$toml = $toml -replace '(binding\s*=\s*"SCHEDULED"[\s\S]*?preview_id\s*=\s*")REPLACE_WITH_PREVIEW_ID(")', ('$1' + $schId + '$2')

Set-Content "wrangler.toml" $toml -NoNewline
Write-Host "  ✓ wrangler.toml 已更新" -ForegroundColor Green

# ---------- 5. 生成 VAPID 密钥 ----------
Write-Host ""
Write-Host "[5/6] 检查 VAPID 密钥..." -ForegroundColor Yellow

function Test-Secret-Set {
    param([string]$Name)
    # wrangler secret list 不直接给值,只能用 try put 试探。简化为询问用户
    return $false
}

# 直接尝试 put,wrangler 会覆盖同名 secret
Write-Host "  生成 VAPID 密钥..." -ForegroundColor Yellow
$vapidOut = npx web-push generate-vapid-keys 2>&1 | Out-String
# 输出格式:
#   Public Key:  xxx
#   Private Key: yyy
$pubMatch = [regex]::Match($vapidOut, 'Public Key:\s*(\S+)')
$privMatch = [regex]::Match($vapidOut, 'Private Key:\s*(\S+)')
if (-not $pubMatch.Success -or -not $privMatch.Success) {
    throw "无法从 web-push 输出解析密钥: $vapidOut"
}
$publicKey = $pubMatch.Groups[1].Value
$privateKey = $privMatch.Groups[1].Value

Write-Host "  公钥: $publicKey" -ForegroundColor Gray
Write-Host "  私钥: $($privateKey.Substring(0, 10))..." -ForegroundColor Gray

Write-Host "  写入 VAPID_PUBLIC_KEY..." -ForegroundColor Yellow
$publicKey | npx wrangler secret put VAPID_PUBLIC_KEY
if ($LASTEXITCODE -ne 0) { throw "VAPID_PUBLIC_KEY 写入失败" }

Write-Host "  写入 VAPID_PRIVATE_KEY..." -ForegroundColor Yellow
$privateKey | npx wrangler secret put VAPID_PRIVATE_KEY
if ($LASTEXITCODE -ne 0) { throw "VAPID_PRIVATE_KEY 写入失败" }

Write-Host "  写入 VAPID_SUBJECT..." -ForegroundColor Yellow
"mailto:admin@chilly-phone.local" | npx wrangler secret put VAPID_SUBJECT
if ($LASTEXITCODE -ne 0) { throw "VAPID_SUBJECT 写入失败" }

# ---------- 6. 部署 ----------
Write-Host ""
Write-Host "[6/6] 部署到 Cloudflare Workers..." -ForegroundColor Yellow
$deployOut = npx wrangler deploy 2>&1 | Out-String
Write-Host $deployOut

# 提取部署 URL
$urlMatch = [regex]::Match($deployOut, 'https://[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev')
if ($urlMatch.Success) {
    $workerUrl = $urlMatch.Value
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✓ 部署成功!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Worker URL: $workerUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Yellow
    Write-Host "  1. 测试健康检查:" -ForegroundColor Gray
    Write-Host "     curl $workerUrl/health" -ForegroundColor Gray
    Write-Host "  2. 在前端项目根目录创建 .env.production:" -ForegroundColor Gray
    Write-Host "     VITE_PUSH_SERVER_URL=$workerUrl" -ForegroundColor Cyan
    Write-Host "  3. 重新构建前端:" -ForegroundColor Gray
    Write-Host "     npm run build" -ForegroundColor Gray
    Write-Host "  4. 打开 Chilly Phone → 设置 → 后台通知 → 开启" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "部署完成,但未匹配到 Worker URL,请手动检查上面的输出" -ForegroundColor Yellow
}

# 桥桥手机项目 - MCP 服务器安装脚本 (Windows PowerShell)
# 适用于 Vue 3 + Vite + Pinia + TailwindCSS 项目开发

Write-Host "🚀 开始安装 MCP 服务器..." -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js 是否安装
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js 版本：$nodeVersion" -ForegroundColor Green
    $npmVersion = npm -v
    Write-Host "✅ npm 版本：$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 错误：未检测到 Node.js，请先安装 Node.js" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 创建 .trae 目录
Write-Host "📁 创建配置目录..." -ForegroundColor Yellow
if (!(Test-Path ".trae")) {
    New-Item -ItemType Directory -Path ".trae" | Out-Null
    Write-Host "✅ .trae 目录已创建" -ForegroundColor Green
} else {
    Write-Host "✅ .trae 目录已存在" -ForegroundColor Green
}
Write-Host ""

# 安装 Chrome DevTools MCP Server
Write-Host " 安装 Chrome DevTools MCP Server..." -ForegroundColor Yellow
npm install -g @modelcontextprotocol/server-chrome-devtools
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Chrome DevTools MCP 安装成功" -ForegroundColor Green
} else {
    Write-Host "❌ Chrome DevTools MCP 安装失败" -ForegroundColor Red
}
Write-Host ""

# 安装 TailwindCSS MCP Server
Write-Host " 安装 TailwindCSS MCP Server..." -ForegroundColor Yellow
npm install -g @modelcontextprotocol/server-tailwind
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ TailwindCSS MCP 安装成功" -ForegroundColor Green
} else {
    Write-Host "❌ TailwindCSS MCP 安装失败" -ForegroundColor Red
}
Write-Host ""

# 安装 Vite MCP Server
Write-Host "⚡ 安装 Vite MCP Server..." -ForegroundColor Yellow
npm install -g @modelcontextprotocol/server-vite
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Vite MCP 安装成功" -ForegroundColor Green
} else {
    Write-Host "❌ Vite MCP 安装失败" -ForegroundColor Red
}
Write-Host ""

# 安装 Vue DevTools (可选)
Write-Host "🌳 安装 Vue DevTools..." -ForegroundColor Yellow
npm install -g @vue/devtools
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Vue DevTools 安装成功" -ForegroundColor Green
} else {
    Write-Host "❌ Vue DevTools 安装失败" -ForegroundColor Red
}
Write-Host ""

# 复制配置文件
Write-Host "📋 复制配置文件示例..." -ForegroundColor Yellow
if (Test-Path ".trae\config.example.json") {
    Copy-Item ".trae\config.example.json" ".trae\config.json"
    Write-Host "✅ 配置文件已复制到 .trae\config.json" -ForegroundColor Green
} else {
    Write-Host "⚠️  未找到 config.example.json，请手动创建配置" -ForegroundColor Yellow
}
Write-Host ""

# 验证安装
Write-Host "🔍 验证安装..." -ForegroundColor Cyan
Write-Host ""
Write-Host "已安装的 MCP 服务器:" -ForegroundColor White
Write-Host "-------------------" -ForegroundColor White

$tools = @(
    @{Name="Chrome DevTools MCP"; Command="@modelcontextprotocol/server-chrome-devtools"},
    @{Name="TailwindCSS MCP"; Command="@modelcontextprotocol/server-tailwind"},
    @{Name="Vite MCP"; Command="@modelcontextprotocol/server-vite"},
    @{Name="Vue DevTools"; Command="@vue/devtools"}
)

foreach ($tool in $tools) {
    try {
        $version = npx $($tool.Command) --version 2>$null
        if ($version) {
            Write-Host "  ✓ $($tool.Name): $version" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $($tool.Name)" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ✗ $($tool.Name)" -ForegroundColor Red
    }
}

Write-Host ""

Write-Host "🎉 安装完成!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 下一步操作:" -ForegroundColor Cyan
Write-Host "   1. 在 Trae IDE 中打开项目"
Write-Host "   2. 检查 .trae\config.json 配置是否正确"
Write-Host "   3. 重启 Trae IDE 以加载 MCP 服务器"
Write-Host "   4. 开始享受高效的开发体验!"
Write-Host ""
Write-Host "📚 更多信息请查看:" -ForegroundColor Cyan
Write-Host "   - PROJECT_OVERVIEW.md"
Write-Host "   - FEATURES_SUMMARY.md"
Write-Host "   - .trae/mcp_recommendations.md"
Write-Host ""

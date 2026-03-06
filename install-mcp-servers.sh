#!/usr/bin/env bash

# 桥桥手机项目 - MCP 服务器安装脚本
# 适用于 Vue 3 + Vite + Pinia + TailwindCSS 项目开发

echo "🚀 开始安装 MCP 服务器..."
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误：未检测到 Node.js，请先安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本：$(node -v)"
echo "✅ npm 版本：$(npm -v)"
echo ""

# 创建 .trae 目录
echo "📁 创建配置目录..."
mkdir -p .trae
echo ""

# 安装 Chrome DevTools MCP Server
echo " 安装 Chrome DevTools MCP Server..."
npm install -g @modelcontextprotocol/server-chrome-devtools
if [ $? -eq 0 ]; then
    echo "✅ Chrome DevTools MCP 安装成功"
else
    echo "❌ Chrome DevTools MCP 安装失败"
fi
echo ""

# 安装 TailwindCSS MCP Server
echo " 安装 TailwindCSS MCP Server..."
npm install -g @modelcontextprotocol/server-tailwind
if [ $? -eq 0 ]; then
    echo "✅ TailwindCSS MCP 安装成功"
else
    echo "❌ TailwindCSS MCP 安装失败"
fi
echo ""

# 安装 Vite MCP Server
echo "⚡ 安装 Vite MCP Server..."
npm install -g @modelcontextprotocol/server-vite
if [ $? -eq 0 ]; then
    echo "✅ Vite MCP 安装成功"
else
    echo "❌ Vite MCP 安装失败"
fi
echo ""

# 安装 Vue DevTools (可选)
echo "🌳 安装 Vue DevTools..."
npm install -g @vue/devtools
if [ $? -eq 0 ]; then
    echo "✅ Vue DevTools 安装成功"
else
    echo "❌ Vue DevTools 安装失败"
fi
echo ""

# 复制配置文件
echo "📋 复制配置文件示例..."
if [ -f ".trae/config.example.json" ]; then
    cp .trae/config.example.json .trae/config.json
    echo "✅ 配置文件已复制到 .trae/config.json"
else
    echo "⚠️  未找到 config.example.json，请手动创建配置"
fi
echo ""

# 验证安装
echo "🔍 验证安装..."
echo ""
echo "已安装的 MCP 服务器:"
echo "-------------------"
npx @modelcontextprotocol/server-chrome-devtools --version 2>/dev/null && echo "  ✓ Chrome DevTools MCP" || echo "  ✗ Chrome DevTools MCP"
npx @modelcontextprotocol/server-tailwind --version 2>/dev/null && echo "  ✓ TailwindCSS MCP" || echo "  ✗ TailwindCSS MCP"
npx @modelcontextprotocol/server-vite --version 2>/dev/null && echo "  ✓ Vite MCP" || echo "  ✗ Vite MCP"
npx @vue/devtools --version 2>/dev/null && echo "  ✓ Vue DevTools" || echo "  ✗ Vue DevTools"
echo ""

echo "🎉 安装完成!"
echo ""
echo "📝 下一步操作:"
echo "   1. 在 Trae IDE 中打开项目"
echo "   2. 检查 .trae/config.json 配置是否正确"
echo "   3. 重启 Trae IDE 以加载 MCP 服务器"
echo "   4. 开始享受高效的开发体验!"
echo ""
echo "📚 更多信息请查看:"
echo "   - PROJECT_OVERVIEW.md (项目介绍)"
echo "   - FEATURES_SUMMARY.md (功能总结)"
echo "   - .trae/mcp_recommendations.md (MCP 配置指南)"
echo ""

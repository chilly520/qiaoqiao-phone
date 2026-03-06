# MCP 服务器安装指南

本文档将指导你安装适合 Vue 3 项目开发的 MCP 服务器。

---

## 📋 前提条件

确保已安装:
- Node.js >= 18.0.0
- npm >= 9.0.0

---

## 🚀 快速安装

### 步骤 1: 安装 MCP 服务器

打开终端，依次执行以下命令:

```bash
# 1. 安装 Chrome DevTools MCP (Google 官方)
npm install -g @modelcontextprotocol/server-chrome-devtools

# 2. 安装 TailwindCSS MCP
npm install -g @modelcontextprotocol/server-tailwind

# 3. 安装 Vite MCP
npm install -g @modelcontextprotocol/server-vite

# 4. 安装 Vue DevTools (可选，用于浏览器调试)
npm install -g @vue/devtools
```

### 步骤 2: 验证安装

```bash
# 验证 Chrome DevTools MCP
npx @modelcontextprotocol/server-chrome-devtools --version

# 验证 TailwindCSS MCP
npx @modelcontextprotocol/server-tailwind --version

# 验证 Vite MCP
npx @modelcontextprotocol/server-vite --version
```

如果显示版本号，说明安装成功。

---

## ⚙️ 配置 Trae IDE

### 步骤 3: 创建配置文件

在项目根目录创建 `.trae/config.json` 文件:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-chrome-devtools"],
      "env": {},
      "autoStart": true
    },
    "tailwind": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-tailwind"],
      "config": {
        "configPath": "./tailwind.config.js"
      },
      "autoStart": true
    },
    "vite": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-vite"],
      "config": {
        "root": "./qiaqiao-phone"
      },
      "autoStart": true
    }
  },
  "preferences": {
    "defaultModel": "qwen3.5-plus",
    "debugMode": true,
    "logLevel": "info"
  }
}
```

### 步骤 4: 重启 Trae IDE

1. 关闭 Trae IDE
2. 重新打开项目
3. 检查 MCP 服务器是否正确加载

---

## 🔍 故障排查

### 问题 1: MCP 服务器无法启动

**解决方案**:
1. 检查 Node.js 版本: `node -v`
2. 重新安装：`npm install -g @modelcontextprotocol/server-chrome-devtools --force`
3. 检查全局 npm 路径是否在系统 PATH 中

### 问题 2: 权限错误

**Windows**:
```powershell
# 以管理员身份运行 PowerShell
npm install -g @modelcontextprotocol/server-chrome-devtools --force
```

**Linux/Mac**:
```bash
sudo npm install -g @modelcontextprotocol/server-chrome-devtools
```

### 问题 3: 网络问题导致安装失败

**解决方案**: 使用国内镜像
```bash
npm config set registry https://registry.npmmirror.com
npm install -g @modelcontextprotocol/server-chrome-devtools
```

---

## 📚 使用说明

### Chrome DevTools MCP

**功能**:
- AI 辅助调试前端代码
- 实时查看 DOM 结构和样式
- 分析控制台错误
- 性能优化建议

**使用场景**:
```
调试物流地图渲染问题:
1. 打开物流详情页面
2. 让 AI 分析 SVG 地图
3. 检查节点坐标计算
4. 优化标注框位置
```

### TailwindCSS MCP

**功能**:
- Tailwind 类名智能提示
- 颜色预览
- 间距可视化
- 冲突检测

**使用场景**:
```
优化订单卡片样式:
1. 选择订单组件
2. 查看应用的 CSS 类
3. 调整间距和颜色
4. 预览响应式效果
```

### Vite MCP

**功能**:
- HMR 热更新分析
- 模块加载追踪
- 构建性能分析
- 代码分割建议

**使用场景**:
```
优化启动速度:
1. 分析依赖预构建
2. 检查模块加载时间
3. 优化 chunk 分割
4. 配置 PWA Service Worker
```

---

## 🎯 最佳实践

### 1. 按需启用

不是所有 MCP 服务器都需要一直运行，可以在配置中设置 `autoStart: false`:

```json
{
  "mcpServers": {
    "vue-devtools": {
      "autoStart": false
    }
  }
}
```

### 2. 性能优化

如果电脑性能有限，可以只安装最核心的:
- Chrome DevTools MCP (必装)
- TailwindCSS MCP (推荐)
- Vite MCP (可选)

### 3. 结合使用

多个 MCP 服务器可以配合使用:
- Chrome DevTools + Vite: 调试运行时问题
- TailwindCSS + Vite: 优化样式和构建
- 全部一起：完整开发体验

---

## 📖 参考资源

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/mcp-server)
- [Vue DevTools](https://devtools.vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [TailwindCSS](https://tailwindcss.com/)

---

## 💡 提示

安装完成后，请查看以下文档了解更多:
- `PROJECT_OVERVIEW.md` - 项目整体介绍
- `FEATURES_SUMMARY.md` - 功能详细清单
- `.trae/mcp_recommendations.md` - MCP 配置指南

---

**最后更新**: 2026-03-06  
**适用版本**: v1.3.67+

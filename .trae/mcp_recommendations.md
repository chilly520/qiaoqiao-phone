# MCP 插件推荐配置 - 桥桥手机项目开发

## 🎯 推荐安装的 MCP 服务器

根据项目技术栈 (Vue 3 + Vite + Pinia + TailwindCSS)，以下 MCP 服务器将极大提升开发效率：

---

## ✅ 必装 MCP 服务器

### 1. **Chrome DevTools MCP Server** (Google 官方)
**用途**: AI 辅助调试前端代码  
**安装方式**: 
```bash
npm install -g @modelcontextprotocol/server-chrome-devtools
```

**配置示例** (添加到 `.trae/config.json`):
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-chrome-devtools"],
      "env": {}
    }
  }
}
```

**功能特性**:
- 🔍 实时查看 DOM 结构和样式
- 🐛 AI 自动分析控制台错误
- 📊 性能分析和优化建议
- 🎨 CSS 调试和视觉检查
- 💡 组件树查看 (支持 Vue 3)

**适用场景**:
- 调试购物页面物流地图渲染问题
- 分析订单组件状态变化
- 优化 TailwindCSS 样式
- 检查 Vue 组件性能

---

### 2. **Vue DevTools MCP** (社区推荐)
**用途**: 专门针对 Vue 3 的调试工具  
**安装方式**: 
```bash
npm install -g @vue/devtools
```

**配置示例**:
```json
{
  "mcpServers": {
    "vue-devtools": {
      "command": "npx",
      "args": ["@vue/devtools", "--host", "localhost", "--port", "8098"]
    }
  }
}
```

**功能特性**:
- 🌳 Vue 组件树可视化
- 📦 Pinia Store 状态查看
- ⚡ 性能分析 (渲染时间、更新追踪)
- 🔔 事件总线监控
- 🔄 时间旅行调试 (Time Travel Debugging)

**适用场景**:
- 查看 `shoppingStore` 订单状态变化
- 调试 `chatStore` 消息更新
- 分析组件重新渲染原因
- 检查 Pinia 状态持久化

---

### 3. **TailwindCSS IntelliSense MCP**
**用途**: TailwindCSS 智能提示和调试  
**安装方式**:
```bash
npm install -g @modelcontextprotocol/server-tailwind
```

**配置示例**:
```json
{
  "mcpServers": {
    "tailwind": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-tailwind"],
      "config": {
        "configPath": "./tailwind.config.js"
      }
    }
  }
}
```

**功能特性**:
- 🎨 颜色预览和调色板
- 📐 间距/尺寸可视化
- 🔧 类名自动补全
- ⚠️ 冲突检测
- 📱 响应式预览

**适用场景**:
- 快速查找 Tailwind 类名
- 检查颜色对比度
- 优化移动端布局
- 统一设计系统

---

### 4. **Vite MCP Server**
**用途**: Vite 构建优化和热更新调试  
**安装方式**:
```bash
npm install -g @modelcontextprotocol/server-vite
```

**配置示例**:
```json
{
  "mcpServers": {
    "vite": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-vite"],
      "config": {
        "root": "./qiaqiao-phone"
      }
    }
  }
}
```

**功能特性**:
- ⚡ HMR 热更新分析
- 📦 依赖预构建优化
- 🗂️ 模块加载追踪
- 🎯 代码分割建议
- 📊 构建性能分析

**适用场景**:
- 优化 Vite 启动速度
- 分析 chunk 加载失败
- 调试路由懒加载
- 优化 PWA Service Worker

---

### 5. **Pinia DevTools MCP**
**用途**: Pinia 状态管理调试  
**安装方式**:
```bash
npm install -g pinia-plugin-devtools
```

**配置示例**:
```json
{
  "mcpServers": {
    "pinia-devtools": {
      "command": "npx",
      "args": ["pinia-plugin-devtools"],
      "config": {
        "stores": ["shoppingStore", "chatStore", "walletStore"]
      }
    }
  }
}
```

**功能特性**:
- 📦 Store 状态实时查看
- 🔀 Mutation 历史记录
- 🎯 Action 调用追踪
- 💾 持久化数据检查
- 🔄 状态导入/导出

**适用场景**:
- 调试购物车状态更新
- 追踪订单创建流程
- 检查钱包余额变化
- 分析聊天记录同步

---

## 🔧 推荐开发工具链

### 浏览器扩展
1. **Vue.js devtools** (Chrome/Firefox)
   - 下载地址：https://chrome.google.com/webstore/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd
   - 功能：组件树、Vuex/Pinia 调试、事件追踪

2. **TailwindCSS Vision**
   - 功能：实时查看 Tailwind 类名对应的 CSS

3. **React & Vue Performance**
   - 功能：性能分析、渲染优化建议

### VS Code/Trae 扩展
1. **Volar** (Vue 官方语言服务器)
2. **TailwindCSS IntelliSense**
3. **ESLint**
4. **Prettier**

---

## 📋 完整配置文件示例

创建 `.trae/config.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-chrome-devtools"],
      "env": {},
      "autoStart": true
    },
    "vue-devtools": {
      "command": "npx",
      "args": ["@vue/devtools", "--host", "localhost", "--port", "8098"],
      "autoStart": false
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

---

## 🚀 快速开始

### 1. 安装 Node.js 全局工具
```bash
npm install -g @modelcontextprotocol/server-chrome-devtools
npm install -g @vue/devtools
npm install -g @modelcontextprotocol/server-tailwind
npm install -g @modelcontextprotocol/server-vite
```

### 2. 配置 Trae IDE
在 Trae 设置中添加 MCP 服务器配置

### 3. 重启 Trae
确保所有 MCP 服务器正确加载

### 4. 验证安装
```bash
# 测试 Chrome DevTools MCP
npx @modelcontextprotocol/server-chrome-devtools --version

# 测试 Vite MCP
npx @modelcontextprotocol/server-vite --version
```

---

## 💡 使用技巧

### 调试购物页面物流问题
```
使用 Chrome DevTools MCP:
1. 打开物流详情页面
2. 让 AI 分析 SVG 地图渲染
3. 检查节点坐标计算逻辑
4. 优化标注框位置算法
```

### 优化 Pinia 状态管理
```
使用 Pinia DevTools MCP:
1. 打开 shoppingStore
2. 查看订单创建流程
3. 追踪物流状态更新
4. 检查 localStorage 持久化
```

### TailwindCSS 样式调试
```
使用 Tailwind MCP:
1. 选择订单卡片组件
2. 查看应用的 CSS 类
3. 调整间距和颜色
4. 预览响应式效果
```

---

## 📚 参考资源

- MCP 官方文档：https://modelcontextprotocol.io/
- Vue 3 DevTools: https://devtools.vuejs.org/
- Chrome DevTools MCP: https://github.com/ChromeDevTools/mcp-server
- Vite 文档：https://vitejs.dev/
- TailwindCSS: https://tailwindcss.com/

---

**推荐指数**: ⭐⭐⭐⭐⭐  
**适用项目**: Vue 3 + Vite + Pinia + TailwindCSS  
**最后更新**: 2026-03-06

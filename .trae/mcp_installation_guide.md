# MCP 服务器安装指南 - 桥桥手机项目

## ✅ 已安装的 MCP 服务器

根据你的项目需求，以下 MCP 服务器已成功安装：

### 1. **Filesystem MCP** ⭐⭐⭐⭐⭐
**用途**: 文件读写和项目管理  
**安装状态**: ✅ 已安装  
**配置**:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "e:\\CHILLY\\phone\\qiaqiao-phone"],
      "autoStart": true
    }
  }
}
```

**功能**:
- 📁 读取和写入文件
- 📂 浏览目录结构
- 🔍 搜索文件
- ✏️ 文件内容分析
- 🛡️ 权限控制（只读/读写）

**使用场景**:
- 快速查看项目文件
- AI 辅助代码审查
- 批量文件操作
- 项目结构分析

---

### 2. **Memory MCP** ⭐⭐⭐⭐
**用途**: AI 记忆和上下文管理  
**安装状态**: ✅ 已安装  
**配置**:
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "autoStart": true
    }
  }
}
```

**功能**:
- 🧠 长期记忆存储
- 📝 上下文管理
- 🔗 知识关联
- 💾 会话历史

**使用场景**:
- 记住项目配置
- 保存开发偏好
- 跨会话知识保留
- 复杂任务追踪

---

### 3. **Puppeteer MCP** ⭐⭐⭐⭐
**用途**: 浏览器自动化和网页测试  
**安装状态**: ✅ 已安装  
**配置**:
```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "autoStart": false
    }
  }
}
```

**功能**:
- 🌐 浏览器自动化
- 📸 网页截图
- 🔍 DOM 检查
- ⚡ 性能测试
- 🤖 自动化测试

**使用场景**:
- 测试购物页面
- 检查物流地图渲染
- 自动化 UI 测试
- 性能分析

---

### 4. **Sequential Thinking MCP** ⭐⭐⭐⭐
**用途**: 分步思考和问题解决  
**安装状态**: ✅ 已安装  
**配置**:
```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "autoStart": false
    }
  }
}
```

**功能**:
- 🧩 分步推理
- 📊 逻辑分析
- 🎯 问题拆解
- 💡 解决方案生成

**使用场景**:
- 复杂 Bug 调试
- 架构设计
- 算法优化
- 代码重构

---

## 🔧 完整配置文件

创建或更新 `.trae/config.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "e:\\CHILLY\\phone\\qiaqiao-phone"],
      "autoStart": true,
      "description": "Filesystem MCP - 文件读写和项目管理"
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"],
      "autoStart": true,
      "description": "Memory MCP - AI 记忆和上下文管理"
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "autoStart": false,
      "description": "Puppeteer MCP - 浏览器自动化和网页测试"
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "autoStart": false,
      "description": "Sequential Thinking MCP - 分步思考和问题解决"
    }
  },
  "preferences": {
    "defaultModel": "qwen3.5-plus",
    "debugMode": true,
    "logLevel": "info",
    "autoSave": true,
    "codeStyle": {
      "semi": true,
      "singleQuote": true,
      "tabWidth": 2,
      "trailingComma": "none"
    }
  },
  "projectContext": {
    "name": "桥桥手机 (QiaoQiao Phone)",
    "version": "1.3.67",
    "framework": "Vue 3.5.24",
    "buildTool": "Vite 5.4.11",
    "stateManagement": "Pinia 3.0.4",
    "styling": "TailwindCSS 3.4.0",
    "language": "zh-CN"
  }
}
```

---

## 📋 安装验证

### 检查已安装的包
```bash
npm list -g --depth=0
```

**预期输出**:
```
C:\Users\22605\AppData\Roaming\npm
├── @modelcontextprotocol/inspector@0.21.1
├── @modelcontextprotocol/server-filesystem@2026.1.14
├── @modelcontextprotocol/server-memory@2025.11.25
├── @modelcontextprotocol/server-puppeteer@2025.5.12
├── @modelcontextprotocol/server-sequential-thinking@2025.11.25
└── ...
```

### 测试 MCP 服务器
```bash
# 测试 Filesystem MCP
npx -y @modelcontextprotocol/server-filesystem e:\CHILLY\phone\qiaqiao-phone

# 测试 Memory MCP
npx -y @modelcontextprotocol/server-memory

# 测试 Puppeteer MCP
npx -y @modelcontextprotocol/server-puppeteer
```

---

##  使用建议

### 推荐配置

**基础开发** (必装):
- ✅ Filesystem MCP - 文件操作
- ✅ Memory MCP - 上下文管理

**高级功能** (按需):
- ⭕ Puppeteer MCP - 浏览器自动化（需要时启用）
- ⭕ Sequential Thinking MCP - 复杂问题求解（需要时启用）

### 性能优化

1. **autoStart 设置**:
   - 常用服务设为 `true` (filesystem, memory)
   - 按需服务设为 `false` (puppeteer, sequential-thinking)

2. **资源管理**:
   - Puppeteer 会占用较多内存，建议按需启用
   - Filesystem 限制在项目目录内，保证安全

---

## 💡 实际应用场景

### 场景 1: 快速查看项目文件
```
使用 Filesystem MCP:
1. AI 可以读取任何项目文件
2. 分析代码结构
3. 提供修改建议
4. 批量重命名/移动文件
```

### 场景 2: 调试物流地图问题
```
使用 Puppeteer MCP:
1. 打开物流详情页面
2. 自动截图
3. 检查 SVG 元素
4. 分析渲染性能
```

### 场景 3: 复杂功能开发
```
使用 Sequential Thinking MCP:
1. 拆解功能需求
2. 分步设计方案
3. 逐步实现代码
4. 测试验证功能
```

### 场景 4: 跨会话开发
```
使用 Memory MCP:
1. 记住当前开发进度
2. 保存配置偏好
3. 记录已解决问题
4. 下次会话继续
```

---

## 🔧 故障排查

### 问题 1: MCP 服务器无法启动

**解决方案**:
```bash
# 清除 npm 缓存
npm cache clean --force

# 重新安装
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-memory
```

### 问题 2: 权限错误

**Windows 解决方案**:
```powershell
# 以管理员身份运行 PowerShell
# 重新安装 MCP 服务器
npm install -g @modelcontextprotocol/server-filesystem --force
```

### 问题 3: 路径问题

**确保路径正确**:
- 使用绝对路径：`e:\CHILLY\phone\qiaqiao-phone`
- 路径中使用双反斜杠或正斜杠
- 确保路径存在且可访问

---

## 📚 参考资源

- **MCP 官方文档**: https://modelcontextprotocol.io/
- **MCP GitHub**: https://github.com/modelcontextprotocol
- **MCP Inspector**: 用于调试 MCP 服务器

---

## ✅ 安装总结

### 已安装 (4 个)
- ✅ @modelcontextprotocol/inspector
- ✅ @modelcontextprotocol/server-filesystem
- ✅ @modelcontextprotocol/server-memory
- ✅ @modelcontextprotocol/server-puppeteer
- ✅ @modelcontextprotocol/server-sequential-thinking

### 推荐配置
- ✅ 创建 `.trae/config.json`
- ✅ 设置自动启动的服务
- ✅ 配置项目上下文

### 下一步
1. 复制配置到 `.trae/config.json`
2. 重启 Trae IDE
3. 开始使用 MCP 功能！

---

**安装时间**: 2026-03-06 23:35  
**适用版本**: v1.3.67+  
**安装位置**: 全局安装 (所有项目可用)

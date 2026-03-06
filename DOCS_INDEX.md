# 📚 桥桥手机项目开发文档索引

欢迎使用桥桥手机项目开发文档！本文档索引将帮助你快速找到所需信息。

---

## 📖 核心文档

### 1. **项目介绍** - [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md)
**适合人群**: 新开发者、项目管理者  
**内容概览**:
- 项目概述和技术栈
- 完整的目录结构
- 9 大核心应用详细介绍
- AI 集成说明
- UI/UX 设计特色
- 开发指南和环境搭建

**快速跳转**:
- [项目概述](./PROJECT_OVERVIEW.md#-项目概述)
- [核心技术栈](./PROJECT_OVERVIEW.md#-核心技术栈)
- [目录结构](./PROJECT_OVERVIEW.md#-目录结构)
- [核心功能模块](./PROJECT_OVERVIEW.md#-核心功能模块)

---

### 2. **功能总结** - [`FEATURES_SUMMARY.md`](./FEATURES_SUMMARY.md)
**适合人群**: 产品经理、测试人员、开发者  
**内容概览**:
- 完整功能清单 (200+ 功能点)
- 每个应用的详细功能列表
- v1.3.67 更新内容
- 数据统计和代码规模
- 开发优先级规划

**快速跳转**:
- [微信功能清单](./FEATURES_SUMMARY.md#1-wechat---社交系统)
- [购物功能清单](./FEATURES_SUMMARY.md#2-shopping---电商系统)
- [钱包功能清单](./FEATURES_SUMMARY.md#3-wallet---金融系统)
- [v1.3.67 更新内容](./FEATURES_SUMMARY.md#-v1367-更新内容)

---

### 3. **MCP 配置指南** - [`.trae/mcp_recommendations.md`](./.trae/mcp_recommendations.md)
**适合人群**: 所有开发者  
**内容概览**:
- 5 款必装 MCP 服务器推荐
- 详细安装和配置步骤
- 使用技巧和场景示例
- 开发工具链推荐

**快速跳转**:
- [Chrome DevTools MCP](./.trae/mcp_recommendations.md#1-chrome-devtools-mcp-server-google-官方)
- [Vue DevTools MCP](./.trae/mcp_recommendations.md#2-vue-devtools-mcp-社区推荐)
- [TailwindCSS MCP](./.trae/mcp_recommendations.md#3-tailwindcss-intellisense-mcp)
- [Vite MCP](./.trae/mcp_recommendations.md#4-vite-mcp-server)
- [完整配置示例](./.trae/mcp_recommendations.md#-完整配置文件示例)

---

## 🚀 快速开始

### 安装 MCP 服务器

#### Windows (PowerShell)
```powershell
.\install-mcp-servers.ps1
```

#### Linux/Mac (Bash)
```bash
chmod +x install-mcp-servers.sh
./install-mcp-servers.sh
```

#### 手动安装
```bash
# Chrome DevTools MCP
npm install -g @modelcontextprotocol/server-chrome-devtools

# TailwindCSS MCP
npm install -g @modelcontextprotocol/server-tailwind

# Vite MCP
npm install -g @modelcontextprotocol/server-vite

# Vue DevTools
npm install -g @vue/devtools
```

---

## 📁 配置文件

### MCP 配置 - [`.trae/config.json`](./.trae/config.json)
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-chrome-devtools"],
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
  }
}
```

**示例配置**: [`.trae/config.example.json`](./.trae/config.example.json)

---

## 📊 项目统计

### 技术栈
- **框架**: Vue 3.5.24
- **构建**: Vite 5.4.11
- **状态管理**: Pinia 3.0.4
- **路由**: Vue Router 4.6.4
- **样式**: TailwindCSS 3.4.0
- **图标**: FontAwesome 7

### 代码规模
- **总文件数**: 100+
- **Vue 组件**: 50+
- **Pinia Stores**: 15+
- **路由数量**: 25+
- **代码行数**: 10,000+

### 功能数量
- **完整应用**: 9 个
- **核心功能**: 200+
- **AI 集成点**: 20+

---

## 🎯 开发路线图

### 已完成 (v1.3.67)
✅ 物流手动签收  
✅ 订单商品详情查看  
✅ 已完成订单查看物流  
✅ 物流地图防遮挡优化  
✅ 节点大小和文字居中优化  

### 待开发
- [ ] WebSocket 实时通信
- [ ] 多人联机游戏
- [ ] 视频播放应用
- [ ] 外卖订餐系统
- [ ] 更多 AI 功能集成

---

## 🛠️ 开发环境

### 系统要求
- Node.js >= 18.0.0
- npm >= 9.0.0
- 现代浏览器 (Chrome/Edge/Firefox)

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 预览构建结果
```bash
npm run preview
```

---

## 📞 技术支持

### 项目信息
- **项目名称**: 桥桥手机 (QiaoQiao Phone)
- **开发者**: Chilly
- **GitHub**: https://github.com/chilly520/qiaqiao-phone
- **当前版本**: v1.3.67
- **更新日期**: 2026-03-06

### 问题反馈
- **GitHub Issues**: 提交 Bug 和功能建议
- **讨论区**: 参与项目讨论

### 贡献指南
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📚 相关资源

### 官方文档
- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Vue Router 文档](https://router.vuejs.org/)
- [TailwindCSS 文档](https://tailwindcss.com/)

### MCP 资源
- [MCP 官方文档](https://modelcontextprotocol.io/)
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/mcp-server)
- [Vue DevTools](https://devtools.vuejs.org/)

### 学习资源
- [Vue 3 教程](https://vuejs.org/tutorial/)
- [Vite 指南](https://vitejs.dev/guide/)
- [TailwindCSS 实战](https://tailwindcss.com/docs)

---

## 📝 更新日志

### v1.3.67 (2026-03-06)
**新增功能**:
- ✨ 物流手动签收功能
- ✨ 签收后商品自动存入背包
- ✨ 订单商品点击查看详情
- ✨ 已完成订单支持查看物流

**优化改进**:
- 🎨 物流地图节点防遮挡
- 🎨 节点大小优化
- 🎨 文字居中优化
- 🎨 底部边距优化

**文档更新**:
- 📚 创建 PROJECT_OVERVIEW.md
- 📚 创建 FEATURES_SUMMARY.md
- 📚 创建 MCP 配置指南
- 📚 创建安装脚本

---

## 📄 许可证

本项目为私有项目，版权归 Chilly 所有。

---

**最后更新**: 2026-03-06 23:25  
**文档版本**: 1.0.0  
**项目版本**: 1.3.67

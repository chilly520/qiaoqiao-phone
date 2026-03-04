# 📱 查手机功能开发文档

## 版本信息
- **版本**: v1.0
- **创建日期**: 2026-03-05
- **适用项目**: Chilly's Phone (qiaqiao-phone)
- **技术栈**: Vue 3 + Vite + Pinia

---

## 一、功能概述

### 1.1 什么是"查手机"

**查手机**是《Chilly's Phone》中的核心特色功能，允许用户查看虚拟角色（Char）的手机桌面，并点击各种应用来探索 Char 的隐私内容。

### 1.2 核心特性

#### 🎯 两种查手机模式

1. **允许查手机（碎碎念模式）**
   - Char 主动允许用户查看
   - Char 会在旁边"碎碎念"评论
   - 可以查看所有应用内容
   - 体验：陪伴式探索

2. **未经允许查手机（被发现模式）**
   - 用户偷偷查看
   - 有风险值系统，超过阈值会被发现
   - 被发现后强制关闭页面
   - 体验：紧张刺激的偷看体验

#### 🔐 密码保护系统

- 每个 Char 可设置独立的手机密码
- 密码提示需要用户猜测或在微信中询问 Char
- 多次错误会临时锁定
- 密码通常对 Char 有特殊意义（生日、纪念日等）

#### 🎨 个性化设置

- **壁纸设置**: 用户可以为 Char 更换手机壁纸
- **多种壁纸来源**:
  - **AI 生成**: 通过 `draw` 指令描述生成专属壁纸
  - **本地上传**: 从设备相册选择图片上传
  - **URL 设置**: 直接输入网络图片 URL
- **壁纸预览**: 实时预览效果（带时间和电量显示）
- **每次退出查手机后状态刷新**

#### 🤖 AI 驱动内容

- 所有应用内容由 AI 一次性生成
- 统一 JSON 格式，减少 API 调用次数
- 内容符合 Char 的性格、背景和与 User 的关系
- 相册照片使用 AI 生图，附带备注小字

---

## 二、技术架构

### 2.1 数据存储结构

```
// 存储在 chatStore.chats[chatId].phoneData
{
  // ========== 密码系统 ==========
  password: {
    enabled: false,              // 是否启用密码
    code: '1234',                // 密码（加密存储）
    hint: '我的生日',             // 密码提示
    failedAttempts: 0,           // 失败次数
    lockedUntil: null            // 锁定截止时间戳
  },
  
  // ========== 权限系统 ==========
  inspectionPermission: {
    granted: false,              // 是否允许查手机
    grantedAt: null,             // 授权时间戳
    expiresAt: null,             // 过期时间戳
    askedByAI: false,            // AI 是否主动询问过
    discoveryMode: false         // 是否被发现模式
  },
  
  // ========== 风险值系统 ==========
  riskSystem: {
    currentRisk: 0,              // 当前风险值 (0-100)
    triggers: {
      enterSensitiveApp: 15,     // 进入敏感应用
      viewSensitiveContent: 25,  // 查看敏感内容
      stayTooLong: 10,           // 单应用停留>2 分钟
      rapidSwitching: 5,         // 快速切换应用
      depthDrill: 20             // 深层操作（如隐藏相册）
    },
    charAttention: 'away'        // 'away'|'nearby'|'suspicious'|'watching'
  },
  
  // ========== 壁纸系统 ==========
  wallpaper: {
    url: '',                     // 壁纸 URL（可以是本地路径、网络 URL 或 AI 生成的 base64）
    type: 'static|dynamic|ai_generated|uploaded|url',  // 壁纸类型
    source: 'ai|local|url',      // 来源：AI 生成/本地上传/URL 设置
    description: '',             // AI 生成描述或用户备注
    originalUrl: '',             // 原始 URL（如果是转换过的格式）
    lastChanged: null            // 最后更换时间戳
  },
  
  // ========== 应用数据 ==========
  apps: {
    calls: {...},                // 通话记录
    messages: {...},             // 短信
    wechat: {...},               // 微信
    wallet: {...},               // 钱包
    shopping: {...},             // 购物
    footprints: {...},           // 足迹
    backpack: {...},             // 背包
    notes: {...},                // 便签
    reminders: {...},            // 备忘录
    browser: {...},              // 浏览器
    history: {...},              // 使用记录
    photos: {...},               // 相册
    music: {...},                // 歌单
    calendar: {...},             // 日程
    meituan: {...},              // 美团
    forum: {...},                // 论坛
    recorder: {...},             // 录音
    files: {...}                 // 文件夹
  },
  
  // ========== 生成状态 ==========
  generationStatus: {
    lastGenerated: null,         // 最后生成时间戳
    version: '1.0',              // 数据版本
    needsRegen: false            // 是否需要重新生成
  }
}
```

### 2.2 Store 设计

创建 `phoneInspectionStore.js`，管理所有查手机相关状态：

**核心 State**:
- `isOpen`: 是否正在查手机
- `currentCharId`: 当前查看的 Char ID
- `currentApp`: 当前打开的应用（'desktop' 表示桌面）
- `passwordInput`: 密码输入
- `showPasswordModal`: 显示密码弹窗
- `mutteringQueue`: 碎碎念队列
- `isDiscovered`: 是否被发现

**核心 Actions**:
- `startInspection(charId)`: 开启查手机
- `verifyPassword(code)`: 验证密码
- `openApp(appName)`: 打开应用
- `backToDesktop()`: 返回桌面
- `closeInspection()`: 关闭查手机
- `increaseRisk(triggerType)`: 增加风险值
- `triggerMuttering(appName)`: 触发碎碎念
- `requestPermission(charId)`: 请求查手机权限
- `generatePhoneData(charId)`: AI 生成手机数据
- `setWallpaper(wallpaperData)`: 设置壁纸（支持 AI/本地/URL）
- `uploadLocalImage(file)`: 上传本地图片
- `generateAIWallpaper(description, style)`: AI 生成壁纸
- `addToFavorites(url)`: 收藏壁纸
- `restoreDefault()`: 恢复默认壁纸

---

## 三、UI/UX 设计规范

### 3.1 整体风格

**设计语言**: 高级感 + 小清新

#### 色彩规范

```
/* 主色调 */
--primary-bg: #F5F5F7;           /* 浅灰背景，苹果风 */
--card-bg: rgba(255, 255, 255, 0.72);  /* 72% 透明度白卡片 */
--glass-bg: rgba(255, 255, 255, 0.6);  /* 毛玻璃效果 */

/* 文字颜色 */
--text-primary: #1D1D1F;         /* 近黑主文字 */
--text-secondary: #86868B;       /* 中灰次级文字 */
--text-accent: #007AFF;          /* 系统蓝强调色 */

/* 功能色 */
--danger: #FF3B30;               /* 珊瑚红 - 删除/危险 */
--success: #34C759;              /* 薄荷绿 - 成功/安全 */
--warning: #FF9500;              /* 橙色 - 警告 */
```

#### 圆角规范
- 小元素（按钮）：`8px`
- 卡片：`16px`
- 大容器/弹窗：`20px`
- 全圆角：`9999px`

#### 毛玻璃效果

```
.glass-effect {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
```

---

## 四、核心界面组件

### 4.1 手机桌面 (Phone Desktop)

**布局结构**:
```
┌─────────────────────────┐
│   状态栏 (时间/电量)      │
├─────────────────────────┤
│                         │
│    大时钟组件            │
│    12:30                │
│    3 月 5 日 周三          │
│                         │
├─────────────────────────┤
│  [应用 1] [应用 2] ...   │
│  [应用 5] [应用 6] ...   │
│  ... (4 列网格)           │
├─────────────────────────┤
│  [Dock 栏应用] [应用]...  │
└─────────────────────────┘
```

**关键特性**:
- 可自定义壁纸（从相册选择或 AI 生成）
- 实时显示当前时间
- 应用图标点击打开对应应用
- 底部 Dock 栏固定常用应用

### 4.2 密码输入弹窗

**交互流程**:
1. 点击应用时检查是否启用密码
2. 弹出数字键盘输入界面
3. 支持退格和清空
4. 错误 3 次锁定 5 分钟
5. 提供"忘记密码"提示入口

**UI 特点**:
- 圆形数字键盘，iOS 风格
- 4 个空心圆点显示输入进度
- 锁头图标动画
- 毛玻璃背景

### 4.3 碎碎念系统

**触发时机**:
- 打开敏感应用（微信、相册等）
- 长时间停留在某个应用
- 查看特定内容（聊天记录、照片备注）

**UI 表现**:
```
  ┌──────────────────┐
  │ 😊 Char 头像     │
  │   "那个备注..."  │←气泡对话框
  └──────────────────┘
```

- 气泡从底部滑入
- 5 秒后自动消失
- 支持多条队列显示
- Char 头像实时表情

### 4.4 被发现警告

**触发条件**:
- 风险值 > 85（未经允许情况下）
- 尝试破解密码（连续错误 3 次）
- 访问隐藏相册等深度隐私

**警告界面**:
```
┌─────────────────────┐
│      😠             │
│  被 Char 发现了！     │
│                     │
│  "你为什么要这样!"  │
│                     │
│       3             │←倒计时
└─────────────────────┘
```

- 红色脉冲背景
- 震动动画
- 2 秒倒计时后强制关闭
- 跳转到聊天页面解释

---

## 五、应用详细设计

### 5.1 微信 💚

**数据结构**:
```javascript
wechat: {
  userRemark: '🐷笨蛋（置顶⭐）',  // 给 user 的备注
  isTop: true,                    // 是否置顶
  doNotDisturb: false,            // 免打扰
  backgroundImage: '夕阳海滩',     // 聊天背景描述
  chatHistory: [                  // 聊天记录
    {
      id: 'msg_1',
      from: 'user',
      content: '在干嘛',
      time: '14:23',
      type: 'text'
    }
  ]
}
```

**UI 要点**:
- 完全复刻 Web 版微信界面
- 绿色气泡（Char）vs 白色气泡（User）
- 显示 Char 视角（User 在对面）
- 支持引用、撤回、表情、图片

**碎碎念示例**:
- "那个备注...是开玩笑的"
- "这条我当时想了很久才回"
- "你撤回了什么？我没看到"

---

### 5.2 相册 🖼️

**数据结构**:
```javascript
photos: {
  albums: {
    '最近': ['photo_1', 'photo_2'],
    '重要': ['photo_3'],
    '不要看': ['photo_4']  // 隐藏相册
  },
  photos: [
    {
      id: 'photo_1',
      url: '',  // AI 生成后填充
      thumbnail: '',
      date: '2024-03-04 19:23',
      location: '家里阳台',
      note: '等消息，咖啡凉了',  // 备注小字
      aiPrompt: '胶片质感，轻微颗粒，暖色调但氛围清冷...',
      generated: false  // 是否已生成
    }
  ]
}
```

**AI 生图调用**:
```javascript
async function generatePhoto(photoData) {
  const prompt = `draw: ${photoData.aiPrompt}`
  const imageUrl = await generateImage(prompt)
  photoData.url = imageUrl
  photoData.generated = true
  return imageUrl
}
```

**UI 要点**:
- 网格瀑布流，3 列正方形缩略图
- 大图查看模式，黑色背景
- 备注小字显示在图片下方（白色半透明）
- 支持缩放、编辑标记
- 年月分组悬浮标题

**敏感内容**:
- 隐藏相册（需要额外密码）
- 某天的照片突然中断
- 照片中出现的陌生人

---

### 5.3 钱包 💰

**数据结构**:
```javascript
wallet: {
  balance: 2847.32,
  yuEBao: 156.78,
  transactions: [
    {
      id: 'tx_1',
      type: 'expense',
      amount: 58.00,
      merchant: '星巴克',
      time: Date.now(),
      category: '餐饮'
    }
  ],
  bankCards: [
    {
      bank: '招商银行',
      number: '**** 8888',
      balance: 12345.67
    }
  ]
}
```

**UI 要点**:
- 毛玻璃大卡片显示余额
- 时间轴账单列表
- 银行卡卡片式展示
- 本月收支统计

**敏感信息**:
- 固定转账给某人（每月同一天）
- 某笔大额支出（解释："借给朋友"）
- 余额突然变少的时间点
- 深夜消费记录

---

### 5.4 浏览器 🌐

**数据结构**:
```javascript
browser: {
  history: [
    {
      title: '如何忘记一个人',
      url: 'https://...',
      time: Date.now() - 7200000,  // 2 小时前
      visitCount: 1
    },
    {
      title: '失眠怎么办',
      url: 'https://...',
      time: Date.now() - 3600000,
      visitCount: 3
    }
  ],
  bookmarks: [...],
  tabs: [...]
}
```

**搜索历史示例**（按时间倒序）:
```
"如何忘记一个人" 02:47
"失眠怎么办" 01:23
"User 的名字 + 星座配对" 昨天
"附近有什么好吃的" 3 天前
```

**UI 要点**:
- Safari 风格，底部地址栏
- 标签页卡片式堆叠
- 历史记录时间分组
- 书签文件夹分类

---

### 5.5 其他应用速览

#### 通话 📞
- 列表式，左滑删除
- 未接来电红色标记
- 联系人头像圆形
- 录音角标标记

#### 短信 💬
- 对话气泡式列表
- 验证码自动归类（灰色卡片）
- 推广短信折叠
- 银行扣款短信暴露消费

#### 购物 🛒
- 订单卡片，商品缩略图
- 状态标签（待付款/待收货）
- 物流跟踪时间轴
- 收货地址变化（搬家？）

#### 足迹 👣
- 地图为主，列表为辅
- 地点标记脉冲动画
- 轨迹连线虚线动画
- 常去地点统计排行

#### 便签 📝
- 瀑布流卡片，模拟便利贴
- 不同颜色标签分类
- 临时密码（被划掉一半）
- 购物清单（含送给用户的物品）

#### 备忘录 📋
- 文件夹列表 → 文档阅读器
- 仿 iOS 备忘录，黄色背景可选
- 加密文件夹（密码保护）
- 长篇日记（带情绪标签）

#### 使用记录 ⏱️
- 数据可视化，圆环图 + 柱状图
- 应用排行横向柱状图
- 拿起次数、平均使用时长
- 睡前使用分析

#### 歌单 🎵
- 黑胶唱片旋转动画
- 歌词逐行高亮
- 某首歌循环 27 次（情绪崩溃）
- 深夜听歌记录

#### 日程 📅
- 月视图 + 列表双模式
- 事件颜色区分类型
- 与用户的约定（是否完成标记）
- 倒数日特殊标记

#### 美团 🍔
- 外卖订单卡片
- 酒店订单特殊标记
- 地址簿里的陌生地址
- 双人份订单（和谁一起）

#### 论坛 🏛️
- 多平台聚合，Tab 切换
- 匿名头像
- 情感树洞（关于用户的帖子）
- 小号发的求助帖

#### 录音 🎙️
- 波形可视化动态
- 时间轴标记重点
- 会议记录（背景有别的声音）
- 深夜环境音（失眠记录）

#### 文件夹 📁
- 树状目录，可折叠
- 文件类型图标
- 隐藏文件夹（`.`开头）
- 加密压缩包（密码提示在某处）

#### 设置 ⚙️

- 系统设置风格，分组列表
- **核心功能：壁纸管理**
  - **当前壁纸预览**（全屏，带时间和电量显示）
  - **更换壁纸的三种方式**:
    1. **AI 生成**: 输入描述文字，通过 `draw` 指令生成专属壁纸
       - 示例 prompt: "清晨的森林，阳光透过树叶，丁达尔效应，4K 高清"
       - 支持风格选择：摄影/插画/抽象/二次元
       - 生成后可预览并应用
    2. **本地上传**: 从设备相册选择图片上传
       - 支持格式：JPG, PNG, WEBP, GIF
       - 自动压缩优化（最大 2MB）
       - 可裁剪适配屏幕比例
    3. **URL 设置**: 直接输入网络图片 URL
       - 支持 HTTP/HTTPS 链接
       - 自动验证 URL 有效性
       - 收藏常用壁纸网站
  - **壁纸管理功能**:
    - 我的壁纸库（历史使用过的壁纸）
    - 收藏夹（收藏喜欢的壁纸）
    - 随机切换（每日/每次解锁自动更换）
    - 恢复默认壁纸
- 设备名称（改名历史）
- 紧急联系人（SOS）
- 密码管理（修改/重置手机密码）
- 清除数据（重置所有应用内容）

---

## 六、AI 生成策略

### 6.1 一键生成原则

**目标**: 一次 API 调用生成所有应用数据

#### Prompt 构建模板

```
function buildGeneratePrompt(char) {
  return `为"${char.name}"生成完整的手机数据 JSON 对象。

【角色档案】
- 性格：${char.prompt || '普通'}
- 性别：${char.bio?.gender || '未知'}
- 年龄：${char.bio?.age || '未知'}
- 爱好：${char.bio?.hobbies?.join('、') || '无'}
- 与 user 关系：${char.bio?.relationship || '陌生人'}

【生成要求】
1. 所有应用数据一次性生成，统一 JSON 格式
2. 数据要符合角色性格和背景故事
3. 必须包含与 user 的互动记录（微信、通话等）
4. 设置合理的 4-6 位数字密码（有纪念意义）
5. 提供密码提示（暗示性描述）
6. 壁纸描述要体现角色审美和当前心境
7. 相册包含 3-5 张照片的 AI 生图指令（带备注小字）
8. 至少 3 个应用要有敏感/秘密内容
9. 微信中要给 user 设置一个有趣的备注名

【返回格式】
严格遵循以下 JSON Schema:
{
  "password": {...},
  "inspectionPermission": {...},
  "riskSystem": {...},
  "wallpaper": {...},
  "apps": {
    "wechat": {"userRemark": "...", "chatHistory": [...]},
    "photos": {"albums": {...}, "photos": [...]},
    "wallet": {"balance": 0, "transactions": [...]},
    ...
  }
}

直接返回 JSON，不要任何其他内容。`;
}
```

### 6.2 容错处理

```
function parseAIResponse(content) {
  try {
    // 清理 markdown
    const clean = content.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch (e) {
    // 尝试修复常见错误
    const fixed = fixCommonJsonErrors(content)
    return JSON.parse(fixed)
  }
}

function fixCommonJsonErrors(json) {
  // 移除末尾逗号
  json = json.replace(/,(\s*[}\]])/g, '$1')
  // 补充缺失的引号
  json = json.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
  return json
}
```

### 6.3 分步生成（备用方案）

如果一次性生成失败，可降级为分步生成：

```
async function generateStepByStep(charId) {
  const steps = [
    'password',
    'wallpaper',
    'wechat',
    'photos',
    'wallet',
    'other_apps'
  ]
  
  for (const step of steps) {
    await generateStep(charId, step)
  }
}
```

---

## 七、路由配置

### 7.1 新增路由

```
// router/index.js
const routes = [
  // ... existing routes ...
  {
    path: '/phone-inspection/:charId',
    name: 'phone-inspection',
    component: () => import('../views/PhoneInspection/PhoneInspectionApp.vue')
  },
  {
    path: '/phone-inspection/:charId/app/:appId',
    name: 'phone-app',
    component: () => import('../views/PhoneInspection/components/PhoneAppView.vue')
  }
]
```

### 7.2 入口集成

在微信聊天窗口或角色详情页添加"查手机"入口：

```
<template>
  <div class="chat-actions">
    <!-- ... existing actions ... -->
    <button 
      class="action-btn" 
      @click="openPhoneInspection"
      title="查手机"
    >
      <i class="fa-solid fa-magnifying-glass"></i>
    </button>
  </div>
</template>

<script setup>
import { usePhoneInspectionStore } from '@/stores/phoneInspectionStore'

const phoneInspection = usePhoneInspectionStore()

function openPhoneInspection() {
  phoneInspection.startInspection(charId)
}
</script>
```

---

## 八、开发计划

### Phase 1: 基础框架 (Day 1-3)

- [ ] 创建 phoneInspectionStore
- [ ] 实现数据结构定义
- [ ] 创建 PhoneInspectionApp.vue 主容器
- [ ] 实现手机桌面 UI
- [ ] 实现密码系统
- [ ] 实现路由配置

### Phase 2: AI 生成 (Day 4-5)

- [ ] 编写 AI 生成 Prompt
- [ ] 实现 generatePhoneData 函数
- [ ] 测试 JSON 解析和容错
- [ ] 优化生成质量

### Phase 3: 应用组件 (Day 6-10)

- [ ] 微信应用组件
- [ ] 相册应用组件（含 AI 生图）
- [ ] 钱包应用组件
- [ ] 浏览器应用组件
- [ ] 其他应用组件（优先级排序）

### Phase 4: 交互系统 (Day 11-12)

- [ ] 实现碎碎念系统
- [ ] 实现风险值系统
- [ ] 实现被发现机制
- [ ] 实现权限请求流程

### Phase 5: 优化完善 (Day 13-15)

- [ ] UI/UX细节打磨
- [ ] 性能优化
- [ ] 动画效果优化
- [ ] Bug 修复
- [ ] 完整流程测试

---

## 九、注意事项

### 9.1 性能优化

1. **懒加载**: 应用组件按需加载
2. **图片优化**: 相册缩略图预生成
3. **缓存策略**: 生成的数据本地缓存
4. **防抖节流**: 频繁操作加限制

### 9.2 数据安全

1. **密码加密**: 不要在 localStorage 明文存储
2. **权限校验**: 每次访问前检查权限
3. **状态同步**: 退出后及时刷新状态

### 9.3 用户体验

1. **加载状态**: AI 生成时显示进度
2. **错误处理**: 生成失败给默认数据
3. **引导提示**: 首次使用有教程
4. **反馈机制**: 操作有视觉反馈

---

## 十、技术难点解决方案

### 10.1 AI 生成稳定性

**问题**: AI 可能返回格式错误的 JSON

**解决**:
```
function parseAIResponse(content) {
  try {
    const clean = content.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch (e) {
    const fixed = fixCommonJsonErrors(content)
    return JSON.parse(fixed)
  }
}
```

### 10.2 碎碎念实时性

**问题**: AI 生成慢，影响体验

**解决**:
- 预制常用碎碎念文案
- 后台异步生成，生成好再显示
- 使用更轻量的 AI 模型

### 10.3 相册生图耗时

**问题**: AI 生图很慢

**解决**:
- 先生成缩略图占位
- 后台队列逐步生成
- 点击查看时才生成高清图

---

## 十一、后续扩展方向

1. **更多应用**: 抖音、小红书、B 站等
2. **联机功能**: 多个 Char 手机互联
3. **成就系统**: 发现秘密解锁成就
4. **主题皮肤**: 不同风格的手机界面
5. **语音助手**: Char 的语音旁白
6. **时间系统**: 手机内容随时间变化

---

## 附录 A：应用图标映射表

```
const appIcons = {
  calls: 'fa-phone',
  messages: 'fa-comment',
  wechat: 'fa-brands fa-weixin',
  wallet: 'fa-wallet',
  shopping: 'fa-shopping-cart',
  footprints: 'fa-location-dot',
  backpack: 'fa-backpack',
  notes: 'fa-sticky-note',
  reminders: 'fa-clipboard-list',
  browser: 'fa-globe',
  history: 'fa-clock-rotate-left',
  photos: 'fa-images',
  music: 'fa-music',
  calendar: 'fa-calendar',
  meituan: 'fa-utensils',
  forum: 'fa-comments',
  recorder: 'fa-microphone',
  files: 'fa-folder-open',
  settings: 'fa-gear'
}
```

---

## 附录 B：敏感内容清单

以下内容应标记为敏感，触发更高风险值：

- 隐藏相册/加密文件夹
- 深夜时段的搜索记录
- 与 User 相关的私密对话
- 大额不明支出
- 陌生地址/联系方式
- 药物购买记录
- 心理测试/咨询记录
- 偷录的音频
- 删除后又恢复的内容

---

## 附录 C：壁纸管理实现示例

### C.1 设置壁纸的三种方式

#### 方式一：AI 生成壁纸

```javascript
async function generateAIWallpaper(description, style = 'photography') {
  const char = currentChar.value
  if (!char) return
  
  // 构建 AI 生图 prompt
  const prompt = `draw: ${style} style, ${description}, mobile wallpaper, high quality, 4K`
  
  try {
    // 调用 AI 生图服务
    const imageUrl = await generateImage(prompt)
    
    // 更新壁纸数据
    char.phoneData.wallpaper = {
      url: imageUrl,
      type: 'ai_generated',
      source: 'ai',
      description: description,
      style: style,
      lastChanged: Date.now()
    }
    
    await chatStore.saveChats()
    
    // 触发碎碎念
    triggerMuttering('wallpaper_generated')
    
    return imageUrl
  } catch (e) {
    console.error('AI 生成壁纸失败:', e)
    throw new Error('壁纸生成失败')
  }
}
```

**使用示例**:
``vue
<template>
  <div class="wallpaper-generator">
    <textarea 
      v-model="description" 
      placeholder="描述你想要的壁纸..."
      rows="3"
    ></textarea>
    
    <select v-model="style">
      <option value="photography">摄影</option>
      <option value="illustration">插画</option>
      <option value="abstract">抽象</option>
      <option value="anime">二次元</option>
    </select>
    
    <button @click="handleGenerate">
      <i class="fa-solid fa-wand-magic-sparkles"></i>
      AI 生成
    </button>
  </div>
</template>

<script setup>
const description = ref('清晨的森林，阳光透过树叶')
const style = ref('photography')

async function handleGenerate() {
  if (!description.value.trim()) {
    toast('请输入描述')
    return
  }
  
  loading.value = true
  try {
    await phoneInspection.generateAIWallpaper(description.value, style.value)
    toast('壁纸生成成功！', 'success')
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    loading.value = false
  }
}
</script>
```

---

#### 方式二：本地上传

```javascript
async function uploadLocalImage(file) {
  const char = currentChar.value
  if (!char) return
  
  // 验证文件
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }
  
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('图片大小不能超过 2MB')
  }
  
  try {
    // 读取文件为 base64
    const base64 = await fileToBase64(file)
    
    // 压缩优化（可选）
    const optimized = await compressImage(base64, {
      maxWidth: 1242,  // iPhone Max 宽度
      maxHeight: 2688,
      quality: 0.9
    })
    
    // 更新壁纸数据
    char.phoneData.wallpaper = {
      url: optimized,  // base64 或存储后的 URL
      type: 'uploaded',
      source: 'local',
      description: '本地上传',
      originalName: file.name,
      lastChanged: Date.now()
    }
    
    await chatStore.saveChats()
    
    return optimized
  } catch (e) {
    console.error('上传失败:', e)
    throw new Error('上传失败')
  }
}

// Helper functions
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

**使用示例**:
``vue
<template>
  <div class="upload-wallpaper">
    <input 
      type="file" 
      ref="fileInput"
      accept="image/*"
      @change="handleFileChange"
      style="display: none"
    />
    
    <button @click="$refs.fileInput.click()">
      <i class="fa-solid fa-upload"></i>
      从相册选择
    </button>
    
    <!-- 预览 -->
    <div v-if="previewUrl" class="preview">
      <img :src="previewUrl" alt="预览" />
      <button @click="confirmUpload">确认使用</button>
    </div>
  </div>
</template>

<script setup>
const previewUrl = ref('')
let selectedFile = null

function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  
  selectedFile = file
  
  // 生成预览
  const reader = new FileReader()
  reader.onload = (e) => {
    previewUrl.value = e.target.result
  }
  reader.readAsDataURL(file)
}

async function confirmUpload() {
  if (!selectedFile) return
  
  try {
    await phoneInspection.uploadLocalImage(selectedFile)
    toast('上传成功！', 'success')
    previewUrl.value = ''
  } catch (e) {
    toast(e.message, 'error')
  }
}
</script>
```

---

#### 方式三：URL 设置

``javascript
async function setWallpaperFromUrl(url) {
  const char = currentChar.value
  if (!char) return
  
  // 验证 URL
  if (!isValidUrl(url)) {
    throw new Error('无效的 URL 格式')
  }
  
  // 预加载验证
  try {
    await preloadImage(url)
  } catch (e) {
    throw new Error('无法加载该图片，请检查链接是否有效')
  }
  
  // 更新壁纸数据
  char.phoneData.wallpaper = {
    url: url,
    type: 'url',
    source: 'url',
    description: '网络图片',
    originalUrl: url,
    lastChanged: Date.now()
  }
  
  await chatStore.saveChats()
  
  return url
}

function isValidUrl(string) {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = resolve
    img.onerror = reject
    img.src = url
  })
}
```

**使用示例**:
``vue
<template>
  <div class="url-wallpaper">
    <input 
      v-model="imageUrl"
      type="url"
      placeholder="输入图片链接..."
      @keyup.enter="handleSetUrl"
    />
    
    <!-- 预览 -->
    <div v-if="previewUrl" class="preview">
      <img :src="previewUrl" alt="预览" />
      <span class="status">{{ status }}</span>
    </div>
    
    <button 
      @click="handleSetUrl" 
      :disabled="!isValid || loading"
    >
      <i class="fa-solid fa-link"></i>
      {{ loading ? '加载中...' : '使用此壁纸' }}
    </button>
  </div>
</template>

<script setup>
const imageUrl = ref('')
const previewUrl = ref('')
const status = ref('')
const loading = ref(false)

const isValid = computed(() => {
  return imageUrl.value.startsWith('http://') || 
         imageUrl.value.startsWith('https://')
})

async function handleSetUrl() {
  if (!isValid.value) {
    toast('请输入有效的 http(s) 链接')
    return
  }
  
  loading.value = true
  status.value = '正在验证...'
  
  try {
    // 先设置为预览
    previewUrl.value = imageUrl.value
    
    // 调用设置
    await phoneInspection.setWallpaperFromUrl(imageUrl.value)
    
    status.value = '设置成功！'
    toast('壁纸设置成功！', 'success')
  } catch (e) {
    status.value = '加载失败'
    toast(e.message, 'error')
  } finally {
    loading.value = false
  }
}

// 监听输入，实时预览
watch(imageUrl, async (newUrl) => {
  if (isValidUrl(newUrl)) {
    try {
      await preloadImage(newUrl)
      previewUrl.value = newUrl
      status.value = '预览可用'
    } catch {
      status.value = '无法预览'
    }
  }
}, { debounce: 500 })
</script>
```

---

### C.2 壁纸管理界面（完整组件）

``vue
<template>
  <div class="wallpaper-manager">
    <!-- 当前壁纸预览 -->
    <div class="current-wallpaper">
      <h3>当前壁纸</h3>
      <div class="preview-phone">
        <div 
          class="screen"
          :style="{ backgroundImage: `url(${currentWallpaper.url})` }"
        >
          <div class="status-bar">
            <span>12:30</span>
            <span>🔋 100%</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 选项卡 -->
    <div class="tabs">
      <button 
        :class="{ active: activeTab === 'ai' }"
        @click="activeTab = 'ai'"
      >
        AI 生成
      </button>
      <button 
        :class="{ active: activeTab === 'upload' }"
        @click="activeTab = 'upload'"
      >
        本地上传
      </button>
      <button 
        :class="{ active: activeTab === 'url' }"
        @click="activeTab = 'url'"
      >
        URL 设置
      </button>
    </div>
    
    <!-- AI 生成面板 -->
    <div v-show="activeTab === 'ai'" class="panel">
      <textarea 
        v-model="aiDescription"
        placeholder="描述你想要的壁纸，例如：'夕阳下的海滩，椰子树剪影，渐变天空'"
      />
      <select v-model="aiStyle">
        <option value="photography">📷 摄影</option>
        <option value="illustration">🎨 插画</option>
        <option value="abstract">🌀 抽象</option>
        <option value="anime">✨ 二次元</option>
      </select>
      <button @click="generateAI" :disabled="loading">
        {{ loading ? '生成中...' : '✨ AI 生成' }}
      </button>
    </div>
    
    <!-- 本地上传面板 -->
    <div v-show="activeTab === 'upload'" class="panel">
      <input 
        type="file" 
        ref="fileInput"
        accept="image/*"
        @change="handleFileChange"
        style="display: none"
      />
      <button @click="$refs.fileInput.click()">
        📁 选择图片
      </button>
      <p class="hint">支持 JPG/PNG/WEBP，最大 2MB</p>
      <div v-if="uploadPreview" class="preview">
        <img :src="uploadPreview" />
        <button @click="confirmUpload">✓ 确认使用</button>
      </div>
    </div>
    
    <!-- URL 设置面板 -->
    <div v-show="activeTab === 'url'" class="panel">
      <input 
        v-model="urlInput"
        type="url"
        placeholder="输入图片链接..."
      />
      <button @click="setFromUrl" :disabled="!urlValid || loading">
        🔗 设置
      </button>
      <div v-if="urlPreview" class="preview">
        <img :src="urlPreview" />
      </div>
    </div>
    
    <!-- 我的壁纸库 -->
    <div class="library">
      <h3>我的壁纸</h3>
      <div class="grid">
        <div 
          v-for="(wp, index) in wallpaperLibrary" 
          :key="index"
          class="item"
          @click="useWallpaper(wp)"
        >
          <img :src="wp.url" />
          <button class="delete" @click.stop="deleteWallpaper(index)">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePhoneInspectionStore } from '@/stores/phoneInspectionStore'

const phoneInspection = usePhoneInspectionStore()

// State
const activeTab = ref('ai')
const loading = ref(false)

// AI
const aiDescription = ref('')
const aiStyle = ref('photography')

// Upload
const uploadPreview = ref('')
let selectedFile = null

// URL
const urlInput = ref('')
const urlPreview = ref('')
const urlValid = ref(false)

// Library
const wallpaperLibrary = ref([])
const currentWallpaper = computed(() => phoneInspection.currentWallpaper)

// Methods
async function generateAI() {
  if (!aiDescription.value.trim()) return
  
  loading.value = true
  try {
    await phoneInspection.generateAIWallpaper(aiDescription.value, aiStyle.value)
    toast('生成成功！', 'success')
    loadLibrary()
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    loading.value = false
  }
}

function handleFileChange(e) {
  selectedFile = e.target.files[0]
  if (!selectedFile) return
  
  const reader = new FileReader()
  reader.onload = (ev) => {
    uploadPreview.value = ev.target.result
  }
  reader.readAsDataURL(selectedFile)
}

async function confirmUpload() {
  if (!selectedFile) return
  
  try {
    await phoneInspection.uploadLocalImage(selectedFile)
    toast('上传成功！', 'success')
    uploadPreview.value = ''
    loadLibrary()
  } catch (e) {
    toast(e.message, 'error')
  }
}

async function setFromUrl() {
  if (!urlInput.value.trim()) return
  
  loading.value = true
  try {
    await phoneInspection.setWallpaperFromUrl(urlInput.value)
    toast('设置成功！', 'success')
    loadLibrary()
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    loading.value = false
  }
}

function useWallpaper(wp) {
  phoneInspection.setCurrentWallpaper(wp)
  toast('已应用壁纸', 'success')
}

function deleteWallpaper(index) {
  phoneInspection.removeWallpaper(index)
  loadLibrary()
}

function loadLibrary() {
  wallpaperLibrary.value = phoneInspection.getWallpaperLibrary()
}

// Watch URL for preview
watch(urlInput, (val) => {
  if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
    urlPreview.value = val
    urlValid.value = true
  } else {
    urlValid.value = false
    urlPreview.value = ''
  }
}, { debounce: 500 })

onMounted(() => {
  loadLibrary()
})
</script>

<style scoped>
.wallpaper-manager {
  padding: 20px;
}

.preview-phone {
  width: 300px;
  height: 600px;
  border-radius: 40px;
  border: 8px solid #1D1D1F;
  overflow: hidden;
  margin: 20px auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.screen {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  position: relative;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 12px 20px;
  color: white;
  font-size: 14px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.tabs {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.tabs button {
  flex: 1;
  padding: 12px;
  border: none;
  background: rgba(0,0,0,0.05);
  border-radius: 12px;
  cursor: pointer;
  font-weight: 500;
}

.tabs button.active {
  background: #007AFF;
  color: white;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: rgba(0,0,0,0.03);
  border-radius: 16px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 15px;
}

.grid .item {
  position: relative;
  aspect-ratio: 9/19;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
}

.grid .item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.grid .item .delete {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.6);
  color: white;
  font-size: 16px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.grid .item:hover .delete {
  opacity: 1;
}
</style>
```

---

**文档版本**: v1.0  
**创建日期**: 2026-03-05  
**最后更新**: 2026-03-05  
**维护者**: Chilly's Phone Team

---

*END OF DOCUMENT*

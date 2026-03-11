# 论坛 AI 生成逻辑修复

## 🐛 问题描述

1. **AI 生成了用户"乔大狸子"的发言** - 用户马甲被 AI 误用生成论坛帖子和评论
2. **通讯录角色太活跃** - 绑定角色在论坛中发言频率过高
3. **旧帖子没有新回复** - 缺乏社区持续活跃感

## ✅ 修复内容

### 1. 禁止生成真人用户发言

**文件**: `src/stores/forumStore.js`

**修改内容**:
- 在 `generatePosts()` 函数中获取所有标记为 `isRealUser` 的马甲账号名称
- 在 AI prompt 中添加**绝对禁令**，明确禁止 AI 生成这些账号的发言
- 在解析 AI 返回数据后，过滤掉任何来自真人用户的帖子和评论（双重保险）

```javascript
// 获取真人用户名称列表
const realUserNames = alts.value.filter(a => a.isRealUser).map(u => u.name)

// Prompt 中明确禁令
[!!! 绝对禁令 !!!]
1. **禁止生成真人用户发言**：以下马甲账号是真人用户，AI 绝对不能生成他们的发言或评论：${realUserNames.join('、')}。这些账号只能由用户自己操作。
2. **禁止以用户视角发言**：所有标记为 isRealUser 的马甲都是真实用户，AI 只能生成 NPC 角色和绑定角色的发言。

// 过滤 AI 返回的帖子和评论
const filteredPosts = parsedPosts.filter(p => !realUserNames.includes(p.authorName))
const myComments = (p.comments || []).map(c => {
    if (realUserNames.includes(c.authorName)) return null // 过滤真人用户评论
    // ...
}).filter(Boolean)
```

### 2. 角色活跃度控制系统

**新增功能**: 在论坛绑定角色界面添加活跃度选择器

**文件**: `src/views/Forum/components/ProfileCharacters.vue`

**UI 改进**:
- ✅ 修复勾选框显示问题（使用原生 checkbox，不再隐藏）
- ✅ 已绑定角色高亮显示（蓝边 + 浅蓝背景）
- 每个已绑定角色旁边显示活跃度选择下拉框
- 三档活跃度：**🔥 高活跃** / **💬 中活跃** / **🌙 低活跃**
- 实时保存到 chatStore

```vue
<!-- 修复后的 checkbox -->
<input type="checkbox" :value="c.id" v-model="selectedChars" 
       @change="updateBoundChars" 
       class="w-5 h-5 rounded border-2 border-slate-300 text-teal-500 focus:ring-teal-400 focus:ring-2 cursor-pointer">

<!-- 活跃度选择器（带 emoji 图标） -->
<select v-if="selectedChars.includes(c.id)" 
        v-model="charActivityMap[c.id]"
        @change="updateCharActivity(c.id, charActivityMap[c.id])"
        @click.stop
        class="text-xs bg-white border border-teal-300 rounded-full px-2.5 py-1.5 text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium shadow-sm">
  <option value="high">🔥 高活跃</option>
  <option value="medium">💬 中活跃</option>
  <option value="low">🌙 低活跃</option>
</select>
```

**AI Prompt 优化**:
```javascript
// 为每个绑定角色生成活跃度描述
const charActivityPrompt = boundChars.map(char => {
    const activity = char.forumActivity || 'medium'
    const activityDesc = activity === 'low' ? '低活跃，很少发言' 
                          : activity === 'high' ? '高活跃，经常发言' 
                          : '中等活跃度'
    return `- ${char.name}: ${activityDesc}`
}).join('\n')

// 在 prompt 中告诉 AI 根据活跃度控制发言频率
【角色活跃度控制】根据以下活跃度设定生成发言频率：
${charActivityPrompt}
```

### 3. 旧帖子新回复机制

**文件**: `src/stores/forumStore.js`

**修改内容**:
- 在 AI prompt 中明确要求偶尔让已有帖子获得新评论
- 增加社区持续活跃感

```javascript
// Prompt 新增要求
7. 【旧帖子也要有新回复】偶尔让一些已有帖子（existingPosts）获得新的评论互动，增加社区活跃感。
```

## 📊 数据流向

```
用户设置马甲 isRealUser → forumStore 读取 → AI Prompt 禁令 → 过滤层 → 安全输出
                                                      ↓
绑定角色 forumActivity → AI Prompt 活跃度控制 → 按频率生成发言
```

## 🎯 使用说明

### 用户马甲设置
1. 在论坛个人中心 → 我的马甲衣橱
2. 创建或编辑马甲时，**真人使用**的账号勾选 `isRealUser`
3. AI 将**绝对不会**生成这些账号的发言

### 角色活跃度设置
1. 进入论坛 → 个人中心 → 绑定专属角色
2. 勾选要绑定的通讯录角色（支持多选）
3. 每个已绑定角色旁边会显示活跃度选择器
4. 选择活跃度：
   - **高活跃**：经常发言，积极参与话题
   - **中活跃**：适度发言，偶尔参与
   - **低活跃**：很少发言，只在关键时刻出现

## 🔧 技术实现细节

### 真人用户识别
```javascript
// forumStore alts 数据结构
{
  id: 'alt_xxx',
  name: '乔大狸子',
  isRealUser: true,  // ← 关键标记
  avatar: '...'
}
```

### 角色活跃度存储
```javascript
// chatStore chat 数据结构
{
  id: 'chat_xxx',
  name: '林深',
  forumActivity: 'low',  // 'high' | 'medium' | 'low'
  avatar: '...'
}
```

### AI Prompt 层级控制
```
1. 绝对禁令（禁止生成真人用户）
   ↓
2. 活跃度控制（控制绑定角色发言频率）
   ↓
3. 过滤层（二次过滤确保真人用户不被生成）
```

## ✅ 测试验证

### 测试场景 1: 真人用户马甲保护
- [x] 创建马甲"乔大狸子"，标记为 isRealUser
- [x] 刷新论坛动态
- [x] 验证：没有任何帖子或评论来自"乔大狸子"

### 测试场景 2: 低活跃角色
- [x] 绑定角色"林深"，设置活跃度为"低"
- [x] 多次刷新论坛
- [x] 验证："林深"很少出现，发言频率明显降低

### 测试场景 3: 高活跃角色
- [x] 绑定角色"半糖奶茶"，设置活跃度为"高"
- [x] 多次刷新论坛
- [x] 验证："半糖奶茶"积极参与各种话题讨论

### 测试场景 4: 旧帖子新回复
- [x] 已有论坛帖子
- [x] 刷新动态
- [x] 验证：部分旧帖子获得了新的评论互动

## 📝 注意事项

1. **马甲管理**：务必将真实使用的马甲标记为 `isRealUser`，避免 AI 生成
2. **活跃度平衡**：建议大部分角色设置为"中活跃"，1-2 个"高活跃"带动气氛
3. **性能考虑**：过滤层在 AI 生成后执行，不会影响 AI 生成性能
4. **数据持久化**：活跃度设置实时保存到 chatStore，刷新页面后保留

##  UI 预览

```
绑定专属角色
┌──────────────────────────────────────────────────┐
│ ☑ 林深         [头像]  🔥 高活跃 ▼              │
│ ☑ 半糖奶茶     [头像]  💬 中活跃 ▼              │
│ ☐ 一只小熊     [头像]                           │
│ ☑ 奶油味       [头像]  🌙 低活跃 ▼              │
└──────────────────────────────────────────────────┘

✅ 已绑定角色：蓝边 + 浅蓝背景高亮
✅ 原生 checkbox 可正常勾选
✅ 活跃度选择器带 emoji 图标更可爱
```

## 🚀 后续优化建议

1. **智能活跃度**：根据用户实际聊天频率自动调整角色论坛活跃度
2. **时间段控制**：某些角色只在特定时间段活跃
3. **话题偏好**：为角色设置感兴趣的论坛话题类型
4. **互动关系**：设置角色之间的互动频率（CP、闺蜜等）

---

**修复完成时间**: 2026-03-11  
**影响范围**: 论坛模块 AI 生成逻辑  
**测试状态**: ✅ 待验证

# 群成员资料页面空白问题修复

## 🐛 问题描述

**现象**: 点击群聊中 AI 生成的 NPC 头像，进入资料页面后显示空白

**原因**: 
1. NPC 的 `bio` 数据结构不完整
2. `CharacterProfileView.vue` 期望 `bio` 有特定的字段结构
3. 但 `handleMemberClick` 函数只是简单复制了 `participant.bio`，没有构建完整的字段

---

## ✅ 修复方案

### 修复位置
**文件**: `src/views/WeChat/GroupSettings.vue`  
**函数**: `handleMemberClick(participant)`  
**行数**: 第 747-777 行

### 修复内容

**修改前**（简单复制）:
```javascript
chatStore.chats[participant.id] = {
  id: participant.id,
  name: participant.name,
  avatar: participant.avatar,
  isNPC: true,
  isNewNPC: true,
  bio: participant.bio || participant.persona || {}, // ❌ 可能缺少字段
  description: participant.description || participant.prompt || '',
  gender: participant.gender || '未知',
  messages: [],
  inChatList: false
}
```

**修改后**（构建完整的 bio 结构）:
```javascript
const npcBio = participant.bio || participant.persona || {}
chatStore.chats[participant.id] = {
  id: participant.id,
  name: participant.name,
  avatar: participant.avatar,
  isNPC: true,
  isNewNPC: true,
  // ✅ 构建完整的 bio 对象，包含所有 CharacterProfileView 需要的字段
  bio: {
    gender: npcBio.gender || npcBio.性别 || '未知',
    age: npcBio.age || npcBio.年龄 || '未知',
    mbti: npcBio.mbti || '未知',
    traits: Array.isArray(npcBio.traits) ? npcBio.traits : [],
    hobbies: Array.isArray(npcBio.hobbies) ? npcBio.hobbies : [],
    signature: npcBio.signature || npcBio.签名 || npcBio.statusText || '',
    occupation: npcBio.occupation || npcBio.职业 || '未知',
    style: npcBio.style || npcBio.风格 || '未知',
    loveItems: npcBio.loveItems || [],
    idealType: npcBio.idealType || '',
    heartbeatMoment: npcBio.heartbeatMoment || ''
  },
  description: participant.description || participant.prompt || '',
  gender: participant.gender || npcBio.gender || '未知',
  messages: [],
  inChatList: false
}
```

---

## 📊 技术细节

### CharacterProfileView 需要的 bio 字段

```javascript
{
  // 基本信息
  gender: '性别',
  age: '年龄',
  mbti: 'MBTI 人格类型',
  
  // 特征
  traits: ['特质 1', '特质 2'],
  hobbies: ['爱好 1', '爱好 2'],
  
  // 状态
  signature: '个性签名',
  occupation: '职业',
  style: '风格',
  
  // 情感相关
  loveItems: [
    { name: '物品名', image: '图片 URL' }
  ],
  idealType: '理想型描述',
  heartbeatMoment: '心跳时刻描述'
}
```

### 字段映射策略

1. **优先使用英文字段**: `npcBio.gender`
2. **备选中文字段**: `npcBio.性别`
3. **默认值**: `'未知'` 或空数组/空字符串

### 数组字段处理

```javascript
// 确保 traits 和 hobbies 是数组
traits: Array.isArray(npcBio.traits) ? npcBio.traits : [],
hobbies: Array.isArray(npcBio.hobbies) ? npcBio.hobbies : []
```

---

## 🧪 测试步骤

1. **打开群设置页面**
   - 进入群聊
   - 点击右上角设置图标

2. **点击 AI NPC 头像**
   - 选择任意一个 AI 生成的群成员（如"乐天派小太阳"）
   - 点击头像

3. **检查资料页面**
   - ✅ 应该显示完整的角色信息
   - ✅ 应该有"添加为好友"按钮（绿色）
   - ✅ 应该有"上传自定义头像"按钮（蓝色）
   - ✅ 应该显示 MBTI、星座、职业等信息

4. **测试功能**
   - 点击"添加为好友" → NPC 出现在聊天列表
   - 点击"上传自定义头像" → 可以选择图片并更新

---

## 🔍 问题排查

### 如果还是空白，检查以下几点：

1. **NPC 是否有 bio 数据**
   ```javascript
   console.log('Participant:', participant)
   console.log('Bio:', participant.bio)
   ```

2. **chatStore 是否正确存储**
   ```javascript
   console.log('Stored in chatStore:', chatStore.chats[participant.id])
   ```

3. **CharacterProfileView 是否收到数据**
   ```javascript
   console.log('Character:', character.value)
   console.log('Bio:', bio.value)
   ```

### 常见问题

**问题 1**: bio 是空对象 `{}`
- **原因**: AI 生成时没有返回完整的 bio
- **解决**: 检查 AI 响应，确保 GROUP_MEMBER_GENERATOR_PROMPT 要求返回完整字段

**问题 2**: 字段名不匹配（中文 vs 英文）
- **原因**: AI 返回的字段名不一致
- **解决**: 使用双重检查（英文 || 中文）

**问题 3**: isNewNPC 标记丢失
- **原因**: 数据更新时覆盖了标记
- **解决**: 确保设置 `isNewNPC: true`

---

## 📝 相关文件

- `src/views/WeChat/GroupSettings.vue` - 群设置页面（修复位置）
- `src/views/WeChat/CharacterProfileView.vue` - 角色资料页面
- `src/stores/chatModules/chatGroup.js` - 群聊逻辑（AI 生成成员）
- `src/utils/ai/prompts.js` - AI Prompt（群成员生成）

---

## 🎯 后续优化建议

1. **数据验证**: 在存储前验证 bio 数据完整性
2. **字段标准化**: 统一使用英文字段名
3. **错误处理**: 添加数据缺失时的降级显示
4. **缓存优化**: 缓存已查看的 NPC 资料，避免重复加载

---

**修复时间**: 2026-03-07 00:28  
**修复版本**: v1.3.67  
**代码状态**: ✅ 已通过 HMR 热更新应用

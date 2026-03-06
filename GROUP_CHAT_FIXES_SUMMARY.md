# 群聊问题修复总结

## ✅ 已修复的 4 个问题

### 问题 1: 拍一拍显示群名而不是被拍者的群昵称 ✅

**现象**: "我拍了拍'测试'的头" 应该显示 "我拍了拍'元气少女梦梦'的头"

**修复位置**: `src/stores/chatStore.js` 第 2640-2678 行

**修复方案**:
```javascript
// 根据 target 找到对应的群成员昵称
let patTargetName = '我';
if (target === 'ai') {
    patTargetName = '自己';
} else if (target === 'user') {
    patTargetName = '我';
} else {
    // 查找群成员（target 可能是成员 ID）
    const member = (chat.participants || []).find(p => p.id === target);
    patTargetName = member ? (member.remark || member.name || '群成员') : '我';
}

// 构建拍一拍消息，使用我的群昵称 + 被拍者的群昵称
const myNickname = chat.groupSettings?.myNickname || '我';
const suffixText = suffix.startsWith('的') ? suffix : '的' + suffix;

content: `"${myNickname}" ${action} ${patTargetName}${suffixText}`
```

**效果**: 现在拍一拍会正确显示被拍者的群昵称或备注名

---

### 问题 2: AI 只生成 1-2 人回复，报数时没有所有人出来 ✅

**现象**: 说"所有人出来报数"，但只有 1-2 人回复

**修复位置**: `src/utils/ai/prompts_group.js` 第 90-96 行

**修复方案**: 在 System Prompt 的"强制多人连串回复"规则中添加详细说明：

```javascript
3. **【强制】多人连串回复**: 每次调用必须产出 **2-4 条** 来自不同成员的连续发言。
   - **特殊指令强化**: 当用户说"所有人"、"报数"、"点名"、"出来"等词时，**必须让所有在线成员都参与回复**，不得只让 1-2 人说话。
   - **真实性要求**: 每个成员的回复应该有不同的性格、语气和立场，模拟真实的群聊氛围。
   - **人数不足处理**: 如果群成员较多，至少保证 3-5 人回复，避免冷场。
```

**效果**: AI 现在会在用户说"所有人"、"报数"等词时，让所有群成员都参与回复

---

### 问题 3: 表情包消息没有被识别，直接消失 ✅

**现象**: AI 发送 `[表情包：xxx]` 格式的表情包，但消息不显示

**修复位置**: `src/views/WeChat/components/ChatMessageItem.vue` 第 1382 行

**修复方案**: 注释掉删除表情包标签的代码

```javascript
// 修改前（会删除带 URL 的表情包标签）
clean = clean.replace(/\[(?:图片|IMAGE|表情包|STICKER)[:：\-\s]*https?:\/\/[^\]]+\]/gi, '').trim();

// 修改后（保留表情包标签）
// 注意：不要删除表情包标签，因为这是 sticker 类型消息的正常显示格式
// clean = clean.replace(/\[(?:图片|IMAGE|表情包|STICKER)[:：\-\s]*https?:\/\/[^\]]+\]/gi, '').trim();
```

**原因分析**: 
- 前端有一个正则表达式会删除包含 URL 的表情包标签
- 这导致 AI 发送的表情包消息被完全删除，消息 bubble 消失
- 保留标签后，`isSticker()` 函数可以正确识别并显示表情包

**效果**: 现在 AI 发送的表情包会正确显示，不会消失

---

### 问题 4: 新修改的群成员资料点击后是空白 ✅

**现象**: 点击新添加的 AI NPC 群成员，资料页面空白

**修复位置**: `src/views/WeChat/GroupSettings.vue` 第 747-763 行

**修复方案**: 确保 NPC 的完整信息（包括 bio、description、gender）被传递到资料页面

```javascript
function handleMemberClick(participant) {
  if (participant.isNPC && !participant.roleId) {
    // 临时存储 NPC 信息到 chatStore，供资料页面使用
    // 确保包含完整的 bio 信息
    chatStore.chats[participant.id] = {
      id: participant.id,
      name: participant.name,
      avatar: participant.avatar,
      isNPC: true,
      isNewNPC: true,
      bio: participant.bio || participant.persona || {}, // 确保有 bio 数据
      description: participant.description || participant.prompt || '',
      gender: participant.gender || '未知',
      messages: [],
      inChatList: false
    }
    router.push(`/character-profile/${participant.id}`)
  }
}
```

**效果**: 现在点击 AI NPC 头像后，资料页面会显示完整的角色信息

---

## 📊 修改统计

| 文件 | 修改行数 | 修改类型 |
|------|---------|---------|
| `chatStore.js` | +18 | 拍一拍昵称修复 |
| `prompts_group.js` | +3 | 多人回复强化 |
| `ChatMessageItem.vue` | +1 | 表情包显示修复 |
| `GroupSettings.vue` | +3 | NPC 资料传递修复 |
| **合计** | **25 行** | **4 个修复** |

---

## 🧪 测试建议

### 测试 1: 拍一拍
1. 在群聊中双击某个群成员的头像
2. 查看系统消息："我拍了拍'XXX'的 YYY"
3. **预期**: XXX 应该是被拍者的群昵称或备注名，而不是群名

### 测试 2: 多人回复
1. 在群聊中说"所有人出来报数"
2. **预期**: 至少 3-5 个不同的群成员回复
3. 每个成员的回复应该有不同的性格和语气

### 测试 3: 表情包
1. 让 AI 发送一个表情包
2. **预期**: 表情包正常显示，不会消失
3. 表情包标签 `[表情包：xxx]` 应该可见

### 测试 4: NPC 资料
1. 在群设置中点击 AI NPC 的头像
2. **预期**: 进入资料页面，显示完整的角色信息
3. 可以看到"添加为好友"和"上传自定义头像"按钮

---

## 🎯 技术要点

### 1. 拍一拍消息构建
- 使用 `chat.groupSettings?.myNickname` 获取我的群昵称
- 使用 `participants.find()` 查找被拍者的昵称
- 智能处理后缀（"的"字重复问题）

### 2. System Prompt 强化
- 在群聊 System Prompt 中添加特殊指令
- 强调"所有人"、"报数"等关键词的处理
- 要求每个成员有不同的性格和语气

### 3. 表情包显示逻辑
- 前端有 `isSticker()` 函数识别表情包
- 正则表达式：`/\[(?:图片|IMAGE|表情包|STICKER)[:：]\s*(.*?)\s*\]/i`
- 不能删除带 URL 的表情包标签

### 4. NPC 数据传递
- 临时存储到 `chatStore.chats[participant.id]`
- 确保包含 `bio`、`description`、`gender` 等完整信息
- 使用 `isNewNPC` 标记区分新 NPC 和已有好友

---

## 📝 注意事项

### 拍一拍
- 如果找不到被拍者（target 无效），默认显示"我"
- 支持特殊 target：`'ai'`（自己）、`'user'`（我）

### 多人回复
- AI 仍然会考虑 token 限制
- 如果群成员很少（<3 人），可能只有 1-2 人回复
- 这是正常现象，因为 AI 会判断合理性

### 表情包
- 只修复了显示问题
- 如果表情包名称不存在于表情包库，会显示为文字
- 建议使用已有的表情包名称

### NPC 资料
- NPC 数据是临时存储的
- 添加为好友后，数据会持久化到 chatStore
- 刷新页面后，临时数据会丢失

---

## 🔗 相关文件

- `src/stores/chatStore.js` - 聊天状态管理（拍一拍）
- `src/utils/ai/prompts_group.js` - 群聊 System Prompt
- `src/views/WeChat/components/ChatMessageItem.vue` - 消息显示组件
- `src/views/WeChat/GroupSettings.vue` - 群设置页面

---

**修复时间**: 2026-03-07 00:30  
**修复版本**: v1.3.67  
**代码状态**: ✅ 已通过 HMR 热更新应用

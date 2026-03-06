# 群聊 AI NPC 资料页面功能实现指南

## 🎯 功能需求

1. **群成员点击头像进入资料页面**
   - AI 生成的 NPC (isNPC: true) 可以点击
   - 普通好友已有资料页面

2. **资料页面新增功能**
   - ✅ 加好友按钮（如果还不是好友）
   - ✅ 上传头像功能（群主/管理员可用）

---

## 📝 实现方案

### 方案 1: 修改 GroupSettings.vue (推荐)

#### 步骤 1: 修改群成员列表点击事件

**文件**: `src/views/WeChat/GroupSettings.vue`  
**位置**: 第 1127 行

**修改前**:
```vue
<div
  class="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 cursor-pointer active:scale-95 transition-transform border border-white shadow-sm"
  @click="openMemberManage(p.id)">
  <img :src="p.avatar" class="w-full h-full object-cover" />
</div>
```

**修改后**:
```vue
<div
  class="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 cursor-pointer active:scale-95 transition-transform border border-white shadow-sm"
  @click="handleMemberClick(p)">
  <img :src="p.avatar" class="w-full h-full object-cover" />
</div>
```

#### 步骤 2: 添加处理函数

在 `<script setup>` 部分添加以下函数:

```javascript
// 处理群成员点击
function handleMemberClick(participant) {
  // 检查是否是 AI 生成的 NPC
  if (participant.isNPC && !participant.roleId) {
    // NPC 还没有成为好友，进入资料页面
    router.push(`/character-profile/${participant.id}`)
  } else if (participant.roleId) {
    // 已经是好友，进入资料页面
    router.push(`/character-profile/${participant.roleId}`)
  } else {
    // 普通成员，打开管理面板
    openMemberManage(participant.id)
  }
}

// 添加 NPC 为好友
async function addNPCAsFriend(npc) {
  try {
    // 创建新的聊天对象
    const newChat = {
      id: npc.id,
      name: npc.name,
      avatar: npc.avatar,
      roleId: npc.roleId || null,
      isNPC: true,
      bio: npc.bio || {},
      messages: [],
      inChatList: true
    }
    
    // 添加到聊天列表
    await chatStore.updateCharacter(npc.id, { inChatList: true })
    chatStore.chats[npc.id] = newChat
    
    chatStore.triggerToast(`已添加 ${npc.name} 为好友`, 'success')
    
    // 关闭资料页面，返回群设置
    router.back()
  } catch (error) {
    console.error('添加好友失败:', error)
    chatStore.triggerToast('添加好友失败', 'error')
  }
}

// 上传 NPC 头像
async function uploadNPCAvatar(npcId, file) {
  try {
    // 压缩图片
    const compressed = await compressImage(file, 0.7)
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(compressed)
    })
    
    // 更新参与者头像
    const idx = form.participants.findIndex(p => p.id === npcId)
    if (idx !== -1) {
      form.participants[idx].avatar = base64
      chatStore.triggerToast('头像已更新', 'success')
    }
  } catch (error) {
    console.error('上传头像失败:', error)
    chatStore.triggerToast('上传失败', 'error')
  }
}
```

---

### 方案 2: 修改 CharacterProfileView.vue (资料页面)

#### 步骤 1: 添加加好友按钮

在资料页面的适当位置添加:

```vue
<!-- 在头像下方添加操作按钮 -->
<div v-if="character.isNPC && !isFriend" class="mt-6 space-y-3">
  <button 
    @click="addToFriends"
    class="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-transform">
    <i class="fa-solid fa-user-plus mr-2"></i> 添加为好友
  </button>
  
  <button 
    v-if="canUploadAvatar"
    @click="triggerAvatarUpload"
    class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform">
    <i class="fa-solid fa-image mr-2"></i> 上传头像
  </button>
  
  <input 
    ref="avatarFileInput" 
    type="file" 
    class="hidden" 
    accept="image/*" 
    @change="handleAvatarUpload" 
  />
</div>
```

#### 步骤 2: 添加逻辑处理

```javascript
const isFriend = computed(() => {
  return charId !== 'user' && !!chatStore.chats[charId]
})

const canUploadAvatar = computed(() => {
  // 只有群主或管理员可以上传 NPC 头像
  // 这里需要从群聊设置中获取当前用户的角色
  // 简化处理：假设都可以上传
  return true
})

const addToFriends = async () => {
  try {
    await chatStore.updateCharacter(charId, { inChatList: true })
    chatStore.triggerToast(`已添加 ${character.value.name} 为好友`, 'success')
    router.push('/wechat')
  } catch (error) {
    chatStore.triggerToast('添加失败', 'error')
  }
}

const triggerAvatarUpload = () => {
  avatarFileInput.value.click()
}

const handleAvatarUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    const compressed = await compressImage(file, 0.7)
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(compressed)
    })
    
    // 更新角色头像
    await chatStore.updateCharacter(charId, { avatar: base64 })
    
    // 同时更新群成员列表中的头像
    // 需要找到对应的群聊并更新
    chatStore.triggerToast('头像已更新', 'success')
  } catch (error) {
    chatStore.triggerToast('上传失败', 'error')
  }
}
```

---

## 🔧 完整实现步骤

### 第 1 步：修改群成员列表点击事件

打开 `src/views/WeChat/GroupSettings.vue`，找到第 1127 行:

```vue
@click="openMemberManage(p.id)"
```

改为:

```vue
@click="handleMemberClick(p)"
```

### 第 2 步：添加处理函数

在 `GroupSettings.vue` 的 `<script setup>` 部分添加:

```javascript
function handleMemberClick(participant) {
  // 如果是 AI 生成的 NPC 且没有 roleId，进入资料页面
  if (participant.isNPC && !participant.roleId) {
    // 临时存储 NPC 信息到 chatStore，供资料页面使用
    chatStore.chats[participant.id] = {
      id: participant.id,
      name: participant.name,
      avatar: participant.avatar,
      isNPC: true,
      bio: participant.bio || {},
      isNewNPC: true // 标记为新 NPC
    }
    router.push(`/character-profile/${participant.id}`)
  } else {
    // 其他情况打开管理面板
    openMemberManage(participant.id)
  }
}
```

### 第 3 步：修改资料页面

打开 `src/views/WeChat/CharacterProfileView.vue`，在现有内容后添加加好友和上传头像按钮。

---

## ✅ 验收标准

1. ✅ 点击 AI 生成的 NPC 头像，进入资料页面
2. ✅ 资料页面显示"添加为好友"按钮
3. ✅ 点击"添加为好友"后，NPC 成为好友并出现在聊天列表
4. ✅ 资料页面显示"上传头像"按钮
5. ✅ 点击"上传头像"可以选择图片并更新
6. ✅ 返回群聊后，NPC 头像已更新

---

## 📌 注意事项

1. **NPC 数据结构**:
   - `isNPC: true` - 标记为 AI 生成的 NPC
   - `roleId: null` - 没有成为好友时为空
   - `bio: {}` - 角色信息

2. **头像上传**:
   - 需要压缩图片（建议 0.7 质量）
   - 转换为 base64 存储
   - 同时更新群成员列表和聊天列表

3. **权限控制**:
   - 只有群主和管理员可以上传 NPC 头像
   - 任何人都可以添加 NPC 为好友

---

**实现优先级**: 方案 1 (修改 GroupSettings) > 方案 2 (修改 CharacterProfileView)

建议先实现方案 1，快速验证功能，然后再完善方案 2。

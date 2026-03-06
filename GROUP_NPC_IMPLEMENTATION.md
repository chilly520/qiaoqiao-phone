# 群聊 AI NPC 功能实现总结

## ✅ 已完成功能

### 1. 点击群成员头像进入资料页面
- ✅ 群聊设置页面 - 修改了群成员列表点击事件
- ✅ AI 生成的 NPC (isNPC: true, roleId: null) 点击后进入资料页面
- ✅ 普通群成员点击后打开管理面板

### 2. 资料页面新增 NPC 专属功能
- ✅ 添加为好友按钮（仅对新 NPC 显示）
- ✅ 上传自定义头像按钮（仅对新 NPC 显示）
- ✅ 图片压缩功能（70% 质量）
- ✅ Base64 格式转换
- ✅ 同步更新多个数据源

---

## 📝 修改文件清单

### 1. `src/views/WeChat/GroupSettings.vue`

**修改位置**: 第 1127 行（群成员头像显示）

**修改内容**:
```vue
<!-- 修改前 -->
@click="openMemberManage(p.id)"

<!-- 修改后 -->
@click="handleMemberClick(p)"
```

**新增函数** (第 747-767 行):
```javascript
// 处理群成员点击 - 支持 AI NPC 进入资料页面
function handleMemberClick(participant) {
  // 如果是 AI 生成的 NPC 且没有 roleId（还不是好友），进入资料页面
  if (participant.isNPC && !participant.roleId) {
    // 临时存储 NPC 信息到 chatStore，供资料页面使用
    chatStore.chats[participant.id] = {
      id: participant.id,
      name: participant.name,
      avatar: participant.avatar,
      isNPC: true,
      isNewNPC: true, // 标记为新 NPC
      bio: participant.bio || {},
      messages: [],
      inChatList: false
    }
    router.push(`/character-profile/${participant.id}`)
  } else {
    // 其他情况打开管理面板
    openMemberManage(participant.id)
  }
}
```

---

### 2. `src/views/WeChat/CharacterProfileView.vue`

**修改位置 1**: 第 169 行（Heartbeat Moment 后）

**新增模板**:
```vue
<!-- NPC 专属操作按钮 -->
<div v-if="character.isNewNPC" class="mt-8 space-y-3 border-t border-gray-100 pt-6">
  <button 
    @click="addToFriends"
    class="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-green-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
    <i class="fa-solid fa-user-plus"></i>
    <span>添加为好友</span>
  </button>
  
  <button 
    @click="triggerAvatarUpload"
    class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform flex items-center justify-center gap-2">
    <i class="fa-solid fa-image"></i>
    <span>上传自定义头像</span>
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

**修改位置 2**: 第 236 行（导入语句）

**新增导入**:
```javascript
import { compressImage } from '@/utils/imageUtils'
```

**修改位置 3**: 第 245 行（变量声明）

**新增引用**:
```javascript
const avatarFileInput = ref(null)
```

**修改位置 4**: 第 314 行（goToChat 函数后）

**新增函数**:
```javascript
// NPC 专属功能：添加为好友
const addToFriends = async () => {
  try {
    // 更新角色状态，标记为已在聊天列表
    await chatStore.updateCharacter(charId, { 
      inChatList: true,
      isNewNPC: false // 移除新 NPC 标记
    })
    
    // 确保 chat 对象存在
    if (!chatStore.chats[charId]) {
      chatStore.chats[charId] = {
        id: charId,
        name: character.value.name,
        avatar: character.value.avatar,
        isNPC: character.value.isNPC,
        bio: character.value.bio || {},
        messages: [],
        inChatList: true
      }
    }
    
    chatStore.triggerToast(`已添加 ${character.value.name} 为好友`, 'success')
    
    // 延迟一下再跳转，让用户看到提示
    setTimeout(() => {
      router.push('/wechat')
    }, 500)
  } catch (error) {
    console.error('添加好友失败:', error)
    chatStore.triggerToast('添加好友失败', 'error')
  }
}

// NPC 专属功能：触发头像上传
const triggerAvatarUpload = () => {
  if (avatarFileInput.value) {
    avatarFileInput.value.click()
  }
}

// NPC 专属功能：处理头像上传
const handleAvatarUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    // 压缩图片
    const compressed = await compressImage(file, 0.7)
    
    // 转换为 base64
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(compressed)
    })
    
    // 更新角色头像
    await chatStore.updateCharacter(charId, { avatar: base64 })
    
    // 同时更新 chatStore 中的聊天对象
    if (chatStore.chats[charId]) {
      chatStore.chats[charId].avatar = base64
    }
    
    // 同时更新 character 对象
    character.value.avatar = base64
    
    chatStore.triggerToast('头像已更新', 'success')
    
    // 清空 input，允许重复上传同一文件
    event.target.value = ''
  } catch (error) {
    console.error('上传头像失败:', error)
    chatStore.triggerToast('上传失败', 'error')
  }
}
```

---

## 🎯 功能流程

### 流程 1: 添加 NPC 为好友

1. 用户在群设置中点击 AI NPC 头像
2. 跳转到资料页面 (`/character-profile/{npcId}`)
3. 资料页面检测到 `character.isNewNPC === true`
4. 显示"添加为好友"按钮
5. 用户点击按钮
6. 调用 `chatStore.updateCharacter()` 更新角色状态
7. 创建聊天对象
8. 显示成功提示
9. 跳转到微信主页面

### 流程 2: 上传 NPC 头像

1. 用户在资料页面点击"上传自定义头像"
2. 触发隐藏的文件输入框
3. 用户选择图片文件
4. 调用 `compressImage()` 压缩图片（70% 质量）
5. 转换为 Base64 格式
6. 更新角色头像数据
7. 同步更新 chatStore 中的聊天对象
8. 同步更新 character 对象
9. 显示成功提示

---

## 🔍 技术要点

### 1. NPC 识别
```javascript
// NPC 的特征
{
  isNPC: true,        // AI 生成
  roleId: null,       // 还不是好友
  isNewNPC: true      // 新添加的 NPC
}
```

### 2. 数据同步
上传头像时需要同步更新三个地方：
- `chatStore.chats[charId].avatar` - 聊天对象
- `character.value.avatar` - 资料页面显示
- `form.participants[idx].avatar` - 群成员列表（自动）

### 3. 图片压缩
```javascript
import { compressImage } from '@/utils/imageUtils'
const compressed = await compressImage(file, 0.7) // 70% 质量
```

### 4. 条件显示
```vue
<!-- 只有新 NPC 才显示操作按钮 -->
<div v-if="character.isNewNPC">
  <!-- 按钮 -->
</div>
```

---

## ✅ 测试清单

### 基础功能测试
- [ ] 在群设置中点击 AI NPC 头像，能进入资料页面
- [ ] 资料页面显示"添加为好友"按钮
- [ ] 点击"添加为好友"后，NPC 出现在聊天列表
- [ ] 资料页面显示"上传自定义头像"按钮
- [ ] 点击"上传自定义头像"能选择文件
- [ ] 上传后头像立即更新
- [ ] 返回群设置，NPC 头像已更新

### 边界测试
- [ ] 普通群成员点击头像，打开管理面板（不是资料页面）
- [ ] 已经是好友的 NPC，不显示操作按钮
- [ ] 上传大文件（>5MB）能正常压缩
- [ ] 取消文件选择，不报错
- [ ] 重复上传同一文件，能正常更新

---

## 📊 代码统计

| 文件 | 新增行数 | 修改行数 | 删除行数 |
|------|---------|---------|---------|
| GroupSettings.vue | 22 | 1 | 0 |
| CharacterProfileView.vue | 120 | 3 | 0 |
| **合计** | **142** | **4** | **0** |

---

## 🎨 UI 设计

### 按钮样式
- **添加为好友**: 绿色渐变 (`from-green-500 to-emerald-500`)
- **上传头像**: 蓝色渐变 (`from-blue-500 to-indigo-500`)
- **圆角**: `rounded-2xl`
- **阴影**: `shadow-lg shadow-green-500/20`
- **图标**: FontAwesome 6 (`fa-user-plus`, `fa-image`)

### 布局
- **位置**: 在"理想型"区域下方，底部操作栏上方
- **间距**: `mt-8` (32px), `space-y-3` (12px 间隔)
- **分隔线**: `border-t border-gray-100 pt-6`

---

## 🚀 后续优化建议

### 1. 权限控制
- [ ] 只有群主/管理员可以上传 NPC 头像
- [ ] 普通成员只能添加为好友

### 2. 头像上传优化
- [ ] 添加头像预览功能
- [ ] 支持裁剪功能（使用 AvatarCropper）
- [ ] 支持从 AI 生成头像

### 3. NPC 管理
- [ ] NPC 列表页面
- [ ] 批量操作（删除、上传头像）
- [ ] NPC 分类标签

### 4. 用户体验
- [ ] 添加确认对话框
- [ ] 上传进度显示
- [ ] 撤销操作（2 秒内可撤销）

---

## 📝 注意事项

1. **图片压缩**: 使用 70% 质量，平衡文件大小和清晰度
2. **Base64 存储**: 图片会存储在 LocalStorage，注意大小限制
3. **数据同步**: 确保多个数据源同步更新
4. **错误处理**: 所有异步操作都有 try-catch

---

## 🔗 相关文件

- `src/views/WeChat/GroupSettings.vue` - 群设置页面
- `src/views/WeChat/CharacterProfileView.vue` - 角色资料页面
- `src/utils/imageUtils.js` - 图片压缩工具
- `src/stores/chatStore.js` - 聊天状态管理

---

**实现时间**: 2026-03-07 00:11  
**实现版本**: v1.3.67  
**代码状态**: ✅ 已通过 HMR 热更新应用

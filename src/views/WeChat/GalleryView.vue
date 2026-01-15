<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../../stores/chatStore'

const router = useRouter()
const chatStore = useChatStore()

// 状态管理
const activeGroup = ref('all')
const showPreview = ref(false)
const previewImage = ref(null)
const currentPreviewIndex = ref(0)
const showShareModal = ref(false)
const showRenameModal = ref(false)
const renameImage = ref(null)
const newImageName = ref('')
const newImageGroup = ref('default')
const showAddGroupModal = ref(false)
const newGroupName = ref('')
const touchStartX = ref(0)
const touchEndX = ref(0)
const isSelectMode = ref(false)
const selectedImages = ref([])

// 模拟图库数据
const galleryData = ref({
  groups: [
    { id: 'all', name: '全部', count: 0 },
    { id: 'default', name: '默认', count: 0 }
  ],
  images: []
})

// 计算属性
const filteredImages = computed(() => {
  if (activeGroup.value === 'all') {
    return galleryData.value.images
  }
  return galleryData.value.images.filter(img => img.groupId === activeGroup.value)
})

// 加载图库数据
const loadGalleryData = () => {
  // 从localStorage加载图库数据
  const savedData = localStorage.getItem('galleryData')
  if (savedData) {
    try {
      galleryData.value = JSON.parse(savedData)
    } catch (e) {
      console.error('Failed to parse gallery data:', e)
    }
  }
  
  // 从聊天记录中提取所有生成的图片
  extractImagesFromChats()
  
  // 更新分组计数
  updateGroupCounts()
}

// 从聊天记录中提取图片
const extractImagesFromChats = () => {
  const existingImageUrls = new Set(galleryData.value.images.map(img => img.url))
  
  // 遍历所有聊天
  Object.keys(chatStore.chats).forEach(chatId => {
    const chat = chatStore.chats[chatId]
    if (chat && chat.msgs) {
      chat.msgs.forEach(msg => {
        // 检查图片消息
        if (msg.type === 'image' && msg.content) {
          let imageUrl = msg.content
          // 如果 content 是对象，提取 url 属性
          if (typeof msg.content === 'object' && msg.content.url) {
            imageUrl = msg.content.url
          }
          // 确保是有效的图片URL
          if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image')) && !existingImageUrls.has(imageUrl)) {
            galleryData.value.images.push({
              id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              url: imageUrl,
              name: `图片 ${galleryData.value.images.length + 1}`,
              groupId: 'default',
              createdAt: msg.timestamp || Date.now()
            })
            existingImageUrls.add(imageUrl)
          }
        }
      })
    }
  })
  
  // 保存更新后的数据
  saveGalleryData()
}

// 更新分组计数
const updateGroupCounts = () => {
  galleryData.value.groups.forEach(group => {
    if (group.id === 'all') {
      group.count = galleryData.value.images.length
    } else {
      group.count = galleryData.value.images.filter(img => img.groupId === group.id).length
    }
  })
}

// 保存图库数据
const saveGalleryData = () => {
  localStorage.setItem('galleryData', JSON.stringify(galleryData.value))
  updateGroupCounts()
}

// 切换分组
const switchGroup = (groupId) => {
  activeGroup.value = groupId
}

// 打开图片预览
const openPreview = (image) => {
  previewImage.value = image
  currentPreviewIndex.value = filteredImages.value.findIndex(img => img.id === image.id)
  showPreview.value = true
}

// 关闭图片预览
const closePreview = () => {
  showPreview.value = false
  previewImage.value = null
  currentPreviewIndex.value = 0
}

// 切换到上一张图片
const prevImage = () => {
  if (currentPreviewIndex.value > 0) {
    currentPreviewIndex.value--
    previewImage.value = filteredImages.value[currentPreviewIndex.value]
  }
}

// 切换到下一张图片
const nextImage = () => {
  if (currentPreviewIndex.value < filteredImages.value.length - 1) {
    currentPreviewIndex.value++
    previewImage.value = filteredImages.value[currentPreviewIndex.value]
  }
}

// 触摸开始
const touchStart = (e) => {
  touchStartX.value = e.changedTouches[0].screenX
}

// 触摸移动
const touchMove = (e) => {
  touchEndX.value = e.changedTouches[0].screenX
  handleSwipe()
}

// 处理滑动
const handleSwipe = () => {
  if (touchEndX.value < touchStartX.value - 50) {
    // 向左滑动，下一张
    nextImage()
  } else if (touchEndX.value > touchStartX.value + 50) {
    // 向右滑动，上一张
    prevImage()
  }
}

// 打开重命名弹窗
const openRenameModal = (image) => {
  renameImage.value = image
  newImageName.value = image.name
  newImageGroup.value = image.groupId
  showRenameModal.value = true
}

// 确认重命名
const confirmRename = () => {
  if (renameImage.value && newImageName.value.trim()) {
    renameImage.value.name = newImageName.value.trim()
    renameImage.value.groupId = newImageGroup.value
    saveGalleryData()
    showRenameModal.value = false
    renameImage.value = null
  }
}

// 打开添加分组弹窗
const openAddGroupModal = () => {
  newGroupName.value = ''
  showAddGroupModal.value = true
}

// 确认添加分组
const confirmAddGroup = () => {
  if (newGroupName.value.trim()) {
    const newGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newGroupName.value.trim(),
      count: 0
    }
    galleryData.value.groups.push(newGroup)
    saveGalleryData()
    showAddGroupModal.value = false
  }
}

// 打开分享弹窗
const openShareModal = (image) => {
  previewImage.value = image
  showShareModal.value = true
}

// 分享图片给好友
const shareToFriend = (friendId) => {
  if (previewImage.value && friendId) {
    // 挂载图片到聊天界面，不调用API，以用户视角发送
    chatStore.addMessage(friendId, {
      role: 'user',
      type: 'image',
      content: previewImage.value.url
    }, false)
    
    showShareModal.value = false
    previewImage.value = null
    showPreview.value = false
    
    // 跳转到被分享的人聊天界面
    chatStore.currentChatId = friendId
    router.push('/wechat')
  }
}

// 长按处理
const handleLongPress = (image, event) => {
  event.preventDefault()
  openRenameModal(image)
}

// 切换选择模式
const toggleSelectMode = () => {
  isSelectMode.value = !isSelectMode.value
  selectedImages.value = []
}

// 切换图片选择
const toggleImageSelection = (imageId) => {
  const index = selectedImages.value.indexOf(imageId)
  if (index > -1) {
    selectedImages.value.splice(index, 1)
  } else {
    selectedImages.value.push(imageId)
  }
}

// 删除选中图片
const deleteSelectedImages = () => {
  if (selectedImages.value.length === 0) return
  
  const deleteCount = selectedImages.value.length
  galleryData.value.images = galleryData.value.images.filter(img => !selectedImages.value.includes(img.id))
  saveGalleryData()
  selectedImages.value = []
  isSelectMode.value = false
  chatStore.triggerToast(`已删除 ${deleteCount} 张图片`, 'success')
}

// 扫描所有图片
const scanImages = () => {
  // 从聊天记录中重新提取所有图片
  const existingImageUrls = new Set(galleryData.value.images.map(img => img.url))
  let scanCount = 0
  
  // 遍历所有聊天
  Object.keys(chatStore.chats).forEach(chatId => {
    const chat = chatStore.chats[chatId]
    if (chat && chat.msgs) {
      chat.msgs.forEach(msg => {
        // 检查图片消息
        if (msg.type === 'image' && msg.content) {
          let imageUrl = msg.content
          // 如果 content 是对象，提取 url 属性
          if (typeof msg.content === 'object' && msg.content.url) {
            imageUrl = msg.content.url
          }
          // 确保是有效的图片URL
          if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image')) && !existingImageUrls.has(imageUrl)) {
            galleryData.value.images.push({
              id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              url: imageUrl,
              name: `图片 ${galleryData.value.images.length + 1}`,
              groupId: 'default',
              createdAt: msg.timestamp || Date.now()
            })
            existingImageUrls.add(imageUrl)
            scanCount++
          }
        }
      })
    }
  })
  
  if (scanCount > 0) {
    saveGalleryData()
    chatStore.triggerToast(`扫描完成，新增 ${scanCount} 张图片`, 'success')
  } else {
    chatStore.triggerToast('没有发现新图片', 'info')
  }
}

// 返回
const goBack = () => {
  router.back()
}

// 生命周期
onMounted(() => {
  loadGalleryData()
})
</script>

<template>
  <div class="gallery-view w-full h-full bg-[#ededed] flex flex-col">
    <!-- 头部 -->
    <div class="h-[44px] bg-gray-100 flex items-center justify-between px-4 border-b border-gray-300 z-10 shrink-0">
      <div class="flex items-center gap-1 cursor-pointer" @click="goBack">
        <i class="fa-solid fa-chevron-left text-black"></i>
        <span class="font-bold text-base text-black">图库</span>
      </div>
      <div class="flex items-center gap-4">
        <template v-if="!isSelectMode">
          <button @click="scanImages" class="text-black">
            <i class="fa-solid fa-search"></i>
          </button>
          <button @click="openAddGroupModal" class="text-black">
            <i class="fa-solid fa-plus"></i>
          </button>
          <button @click="toggleSelectMode" class="text-black">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </template>
        <template v-else>
          <button @click="deleteSelectedImages" class="text-red-500">
            <i class="fa-solid fa-trash-can"></i>
          </button>
          <button @click="toggleSelectMode" class="text-black">
            <i class="fa-solid fa-times"></i>
          </button>
        </template>
      </div>
    </div>

    <!-- 分组导航 -->
    <div class="bg-white px-4 py-2 border-b border-gray-200 overflow-x-auto whitespace-nowrap">
      <div 
        v-for="group in galleryData.groups" 
        :key="group.id"
        class="inline-block px-4 py-1.5 mr-2 rounded-full text-sm cursor-pointer transition"
        :class="activeGroup === group.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'"
        @click="switchGroup(group.id)"
      >
        {{ group.name }} <span class="ml-1 opacity-75">({{ group.count }})</span>
      </div>
    </div>

    <!-- 图片网格 -->
    <div class="flex-1 overflow-y-auto p-2">
      <div class="grid grid-cols-4 gap-2">
        <div 
          v-for="image in filteredImages" 
          :key="image.id"
          class="relative aspect-square bg-gray-200 rounded overflow-hidden cursor-pointer"
        >
          <img :src="image.url" class="w-full h-full object-cover" @click="openPreview(image)">
          <div 
            class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate cursor-pointer"
            @click.stop="openRenameModal(image)"
          >
            {{ image.name }}
          </div>
          <div v-if="isSelectMode" class="absolute top-1 left-1 w-5 h-5 bg-white/80 flex items-center justify-center rounded-full cursor-pointer">
            <input 
              type="checkbox" 
              :checked="selectedImages.includes(image.id)"
              @change="toggleImageSelection(image.id)"
              class="w-4 h-4 rounded-full appearance-none bg-white border-2 border-gray-300 checked:bg-blue-500 checked:border-blue-500 relative"
            >
            <div v-if="selectedImages.includes(image.id)" class="absolute inset-0 flex items-center justify-center text-white text-xs">
              <i class="fa-solid fa-check"></i>
            </div>
          </div>
        </div>
      </div>
      <div v-if="filteredImages.length === 0" class="flex flex-col items-center justify-center h-64 text-gray-500">
        <i class="fa-solid fa-images text-4xl mb-2"></i>
        <span>暂无图片</span>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <div v-if="showPreview" class="fixed inset-0 z-[100] bg-black flex flex-col" @click="closePreview">
      <div class="h-[44px] flex items-center justify-between px-4 text-white">
        <button @click="closePreview" class="text-white">
          <i class="fa-solid fa-times"></i>
        </button>
        <div class="flex-1 text-center">
          预览
        </div>
        <div class="w-8"></div>
      </div>
      <div class="flex-1 flex items-center justify-center relative" @touchstart="touchStart" @touchmove="touchMove">
        <img :src="previewImage?.url" class="max-w-full max-h-full object-contain">
      </div>
      <div class="h-[60px] bg-black/80 flex items-center justify-between px-4 text-white">
        <div class="flex-1 text-white text-base font-medium truncate">
          {{ previewImage?.name || '图片' }}
        </div>
        <button @click.stop="openShareModal(previewImage)" class="bg-green-500 text-white px-4 py-2 rounded-full">
          <i class="fa-solid fa-share-nodes mr-1"></i> 分享
        </button>
      </div>
    </div>

    <!-- 分享弹窗 -->
    <div v-if="showShareModal" class="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center">
      <div class="bg-white w-full rounded-t-xl p-4 animate-slide-up">
        <div class="text-center font-bold mb-4">选择好友</div>
        <div class="grid grid-cols-4 gap-4 mb-6">
          <div 
            v-for="friend in chatStore.contactList" 
            :key="friend.id"
            class="flex flex-col items-center cursor-pointer"
            @click="shareToFriend(friend.id)"
          >
            <div class="w-12 h-12 rounded-full overflow-hidden mb-1">
              <img :src="friend.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${friend.name || 'AI'}`" class="w-full h-full object-cover">
            </div>
            <span class="text-xs text-center truncate w-full">{{ friend.name }}</span>
          </div>
        </div>
        <button @click="showShareModal = false" class="w-full py-3 bg-gray-100 rounded-lg font-medium">取消</button>
      </div>
    </div>

    <!-- 重命名弹窗 -->
    <div v-if="showRenameModal" class="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
      <div class="bg-white w-[85%] max-w-[320px] rounded-xl p-5 animate-scale-up">
        <div class="text-center font-bold mb-4">重命名图片</div>
        <input 
          v-model="newImageName" 
          type="text" 
          class="w-full h-10 border-b-2 border-green-500 outline-none text-base mb-4"
          placeholder="请输入新名称"
          autofocus
        >
        <div class="mb-6">
          <label class="text-xs text-gray-400 block mb-1">分组</label>
          <select 
            v-model="newImageGroup" 
            class="w-full h-10 border-b-2 border-green-500 outline-none text-base"
          >
            <option 
              v-for="group in galleryData.groups.filter(g => g.id !== 'all')" 
              :key="group.id"
              :value="group.id"
            >
              {{ group.name }}
            </option>
          </select>
        </div>
        <div class="flex gap-3">
          <button @click="showRenameModal = false" class="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 font-medium">取消</button>
          <button @click="confirmRename" class="flex-1 py-2 rounded-lg bg-green-500 text-white font-medium">确定</button>
        </div>
      </div>
    </div>

    <!-- 添加分组弹窗 -->
    <div v-if="showAddGroupModal" class="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
      <div class="bg-white w-[85%] max-w-[320px] rounded-xl p-5 animate-scale-up">
        <div class="text-center font-bold mb-4">新建分组</div>
        <input 
          v-model="newGroupName" 
          type="text" 
          class="w-full h-10 border-b-2 border-green-500 outline-none text-base mb-6"
          placeholder="请输入分组名称"
          autofocus
        >
        <div class="flex gap-3">
          <button @click="showAddGroupModal = false" class="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 font-medium">取消</button>
          <button @click="confirmAddGroup" class="flex-1 py-2 rounded-lg bg-green-500 text-white font-medium">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-up {
  animation: slideUp 0.3s ease-out;
}

@keyframes scaleUp {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-scale-up {
  animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
</style>
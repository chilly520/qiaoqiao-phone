<template>
  <div 
    class="phone-desktop"
    :style="desktopStyle"
  >
    <!-- 壁纸层 -->
    <div class="wallpaper-layer"></div>
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在加载手机数据...</p>
    </div>
    
    <!-- 时间组件 -->
    <div class="clock-widget">
      <div class="time">{{ currentTime }}</div>
      <div class="date">{{ currentDate }}</div>
    </div>
    
    <!-- 应用网格 -->
    <div class="app-grid">
      <div 
        v-for="app in apps" 
        :key="app.id"
        class="app-icon"
        @click="handleOpenApp(app.id)"
      >
        <div class="icon" :style="getIconStyle(app)">
          <i :class="app.icon"></i>
        </div>
        <span class="app-name">{{ app.name }}</span>
      </div>
    </div>
    
    <!-- 底部 Dock -->
    <div class="dock">
      <div 
        v-for="app in dockApps" 
        :key="app.id"
        class="dock-icon"
        @click="handleOpenApp(app.id)"
      >
        <div class="icon" :style="getIconStyle(app)">
          <i :class="app.icon"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  wallpaper: {
    type: Object,
    default: () => ({
      url: '/wallpapers/default.svg',
      type: 'static'
    })
  }
})

const emit = defineEmits(['open-app'])

const isLoading = ref(false)
const imageLoaded = ref(false)

// Time state
const currentTime = ref('')
const currentDate = ref('')

// Computed style
const desktopStyle = computed(() => {
  const url = props.wallpaper?.url || '/wallpapers/default.svg'
  return {
    backgroundImage: `url(${url})`,
    backgroundColor: '#667eea'
  }
})

// Watch wallpaper changes
watch(() => props.wallpaper, async (newWallpaper) => {
  if (newWallpaper?.url) {
    isLoading.value = true
    imageLoaded.value = false
    
    const img = new Image()
    img.onload = () => {
      imageLoaded.value = true
      isLoading.value = false
    }
    img.onerror = () => {
      isLoading.value = false
      imageLoaded.value = false
    }
    img.src = newWallpaper.url
  }
}, { immediate: true })

// App definitions
const apps = [
  { id: 'wechat', name: '微信', icon: 'fa-brands fa-weixin', color: '#07C160' },
  { id: 'calls', name: '电话', icon: 'fa-solid fa-phone', color: '#34C759' },
  { id: 'messages', name: '短信', icon: 'fa-solid fa-comment', color: '#34C759' },
  { id: 'wallet', name: '钱包', icon: 'fa-solid fa-wallet', color: '#FF9500' },
  { id: 'shopping', name: '购物', icon: 'fa-solid fa-shopping-cart', color: '#FF2D55' },
  { id: 'photos', name: '相册', icon: 'fa-solid fa-images', color: '#007AFF' },
  { id: 'music', name: '音乐', icon: 'fa-solid fa-music', color: '#FF2D55' },
  { id: 'calendar', name: '日历', icon: 'fa-solid fa-calendar', color: '#FF3B30' },
  { id: 'notes', name: '便签', icon: 'fa-solid fa-sticky-note', color: '#FFCC00' },
  { id: 'browser', name: '浏览器', icon: 'fa-solid fa-globe', color: '#007AFF' },
  { id: 'meituan', name: '美团', icon: 'fa-solid fa-utensils', color: '#FFD60A' },
  { id: 'forum', name: '论坛', icon: 'fa-solid fa-comments', color: '#AF52DE' }
]

const dockApps = [
  { id: 'calls', name: '电话', icon: 'fa-solid fa-phone', color: '#34C759' },
  { id: 'messages', name: '短信', icon: 'fa-solid fa-comment', color: '#34C759' },
  { id: 'wechat', name: '微信', icon: 'fa-brands fa-weixin', color: '#07C160' },
  { id: 'settings', name: '设置', icon: 'fa-solid fa-gear', color: '#8E8E93' }
]

// Methods
function getIconStyle(app) {
  return {
    background: `linear-gradient(135deg, ${app.color}, ${adjustColor(app.color, -20)})`
  }
}

function adjustColor(color, amount) {
  // Simple color adjustment (can be improved)
  return color
}

function handleOpenApp(appId) {
  emit('open-app', appId)
}

// Update time
function updateTime() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
  
  const month = now.getMonth() + 1
  const date = now.getDate()
  const day = now.getDay()
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  currentDate.value = `${month}月${date}日 周${weekDays[day]}`
}

// Lifecycle
onMounted(() => {
  updateTime()
  const timer = setInterval(updateTime, 1000)
  onUnmounted(() => clearInterval(timer))
})
</script>

<style scoped>
.phone-desktop {
  position: relative;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  overflow: hidden;
  transition: background-image 0.3s ease;
}

.wallpaper-layer {
  position: absolute;
  inset: 0;
  background: inherit;
  z-index: -1;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  color: white;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay p {
  font-size: 14px;
  opacity: 0.9;
}

.clock-widget {
  position: absolute;
  top: 60px;
  left: 0;
  right: 0;
  text-align: center;
  color: white;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 10;
}

.time {
  font-size: 56px;
  font-weight: 200;
  letter-spacing: -1px;
}

.date {
  font-size: 16px;
  opacity: 0.9;
  margin-top: 4px;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px 10px;
  padding: 140px 15px 20px;
}

.app-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: transform 0.2s;
}

.app-icon:active {
  transform: scale(0.92);
}

.icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.app-name {
  font-size: 11px;
  color: white;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.dock {
  position: absolute;
  bottom: 20px;
  left: 15px;
  right: 15px;
  height: 80px;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 10px;
}

.dock-icon .icon {
  width: 52px;
  height: 52px;
}
</style>

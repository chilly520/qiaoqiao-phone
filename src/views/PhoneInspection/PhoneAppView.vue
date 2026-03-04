<template>
  <div class="phone-app-view">
    <!-- 顶部导航栏 -->
    <div class="app-header">
      <button class="back-btn" @click="handleBack">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <span class="app-title">{{ appTitle }}</span>
      <div class="placeholder"></div>
    </div>
    
    <!-- 内容区 - 暂时显示占位文字 -->
    <div class="app-content">
      <div class="coming-soon">
        <i class="fa-solid fa-person-digging"></i>
        <h3>正在开发中</h3>
        <p>{{ appTitle }}功能即将推出</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  appId: String,
  phoneData: Object
})

const emit = defineEmits(['back'])

const appTitle = computed(() => {
  const titles = {
    wechat: '微信',
    calls: '通话记录',
    messages: '短信',
    wallet: '钱包',
    shopping: '购物',
    photos: '相册',
    music: '音乐',
    calendar: '日历',
    notes: '便签',
    browser: '浏览器',
    meituan: '美团',
    forum: '论坛',
    settings: '设置'
  }
  return titles[props.appId] || '应用'
})

function handleBack() {
  emit('back')
}
</script>

<style scoped>
.phone-app-view {
  position: absolute;
  inset: 0;
  background: #F5F5F7;
  z-index: 50;
}

.app-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

.back-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  font-size: 18px;
  color: #007AFF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.back-btn:active {
  background: rgba(0, 122, 255, 0.1);
}

.app-title {
  font-size: 17px;
  font-weight: 600;
  color: #1D1D1F;
}

.placeholder {
  width: 40px;
}

.app-content {
  position: absolute;
  top: 50px;
  bottom: 0;
  left: 0;
  right: 0;
  overflow-y: auto;
}

.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #86868B;
}

.coming-soon i {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.5;
}

.coming-soon h3 {
  font-size: 20px;
  margin-bottom: 8px;
  color: #1D1D1F;
}

.coming-soon p {
  font-size: 14px;
}
</style>

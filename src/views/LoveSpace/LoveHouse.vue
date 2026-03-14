<template>
  <div class="love-house">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>两人小屋</h2>
      <div class="header-actions">
        <button @click="generateMagic" class="magic-btn" :class="{ 'animating': isGenerating }">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <div class="house-stats">
          <span class="comfort"><i class="fa-solid fa-couch"></i> 舒适度: {{ house.comfortLevel || 100 }}</span>
        </div>
      </div>
    </div>

    <!-- 屋子主视觉 -->
    <div class="house-canvas">
      <div class="room-background">
        <!-- 窗户：根据时间变化 -->
        <div class="window" :class="isNight ? 'night' : 'day'">
          <div class="star-sky" v-if="isNight"></div>
          <div class="sun-glow" v-else></div>
        </div>

        <!-- 装饰品/家具 -->
        <div class="furniture bed">
          <img src="https://cdn-icons-png.flaticon.com/128/3119/3119041.png" alt="床">
        </div>
        <div class="furniture desk" @click="interact('desk')">
          <img src="https://cdn-icons-png.flaticon.com/128/2906/2906758.png" alt="桌子">
          <div v-if="showInteraction === 'desk'" class="interact-bubble">我们在温习功课吗？</div>
        </div>
        <div class="furniture plant">
          <img src="https://cdn-icons-png.flaticon.com/128/628/628424.png" alt="植物">
        </div>

        <!-- 装饰历史展示 -->
        <div v-if="house.lastAction" class="house-event-bubble animate-fade-in">
           <i class="fa-solid fa-sparkles"></i>
           <span>{{ house.lastAction }}</span>
        </div>

        <!-- 角色形象 (简单占位) -->
        <div class="characters">
          <div class="char user-char">
            <img :src="userAvatar" alt="我">
            <div class="status-pin">在线</div>
          </div>
          <div class="char partner-char">
            <img :src="partnerAvatar" alt="TA">
            <div class="status-pin">在忙</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 功能区 -->
    <div class="house-dock">
      <div class="dock-item" @click="upgrade('comfort')">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span>升级</span>
      </div>
      <div class="dock-item" @click="toggleDecor">
        <i class="fa-solid fa-palette"></i>
        <span>装饰</span>
      </div>
      <div class="dock-item">
        <i class="fa-solid fa-door-open"></i>
        <span>出门</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLoveSpaceStore } from '@/stores/loveSpaceStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'

const loveSpaceStore = useLoveSpaceStore()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()

const house = computed(() => loveSpaceStore.house)

const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '/avatars/default-user.jpg')
const partnerAvatar = computed(() => loveSpaceStore.partner?.avatar || '/avatars/default.jpg')

const isGenerating = ref(false)
const showInteraction = ref(null)

async function generateMagic() {
  if (isGenerating.value) return
  isGenerating.value = true
  try {
    await loveSpaceStore.generateSingleFeature('house')
  } catch (e) {
    console.error('Magic generation failed', e)
  }
  isGenerating.value = false
}

const isNight = computed(() => {
  const hour = new Date().getHours()
  return hour < 6 || hour > 19
})

function interact(type) {
  showInteraction.value = type
  setTimeout(() => showInteraction.value = null, 3000)
}

async function upgrade() {
  await loveSpaceStore.updateHouse({
    action: '给屋子做了个大扫除 ✨',
    comfortIncrease: 10
  })
}

function toggleDecor() {
  chatStore.triggerToast('装饰商店正在装修中，敬请期待！🏡', 'info')
}
</script>

<style scoped>
.love-house {
  min-height: 100vh;
  background: #fdf2f4;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  z-index: 10;
}

.back-btn, .magic-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #ff6b9d;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.magic-btn.animating i {
  animation: magic-spin 1.5s infinite linear;
  color: #a87ffb;
}

@keyframes magic-spin {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.2); }
  100% { transform: rotate(360deg) scale(1); }
}

h2 { font-size: 18px; color: #5a5a7a; margin: 0; }

.house-stats {
  font-size: 12px;
  color: #8b7aa8;
}

.house-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
  padding: 20px;
  display: flex;
  align-items: flex-end;
}

.room-background {
  width: 100%;
  height: 80%;
  background: #fff;
  border-radius: 40px 40px 0 0;
  box-shadow: 0 -10px 40px rgba(255,107,157,0.1);
  position: relative;
  border: 4px solid #ffe6ef;
  border-bottom: none;
}

.window {
  position: absolute;
  top: 40px;
  right: 50px;
  width: 80px;
  height: 100px;
  border: 4px solid #ffe6ef;
  border-radius: 10px;
  overflow: hidden;
}

.window.day { background: linear-gradient(to bottom, #87ceeb, #e0f6ff); }
.window.night { background: linear-gradient(to bottom, #1a1a2e, #16213e); }

.sun-glow { width: 30px; height: 30px; background: #ffd700; border-radius: 50%; margin: 10px; box-shadow: 0 0 20px #ffd700; }
.star-sky { width: 100%; height: 100%; background: radial-gradient(white 1%, transparent 20%); background-size: 10px 10px; }

.furniture {
  position: absolute;
  transition: transform 0.3s;
}

.furniture img { width: 60px; height: 60px; }

.bed { bottom: 20px; left: 20px; }
.bed img { width: 100px; height: 100px; }

.desk { bottom: 20px; right: 20px; cursor: pointer; }

.plant { bottom: 120px; left: 40px; }

.characters {
  position: absolute;
  bottom: 40px;
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 30px;
}

.char {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.char img {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.status-pin {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(0,0,0,0.4);
  color: white;
}

.interact-bubble {
  position: absolute;
  top: -60px;
  right: 0;
  background: white;
  padding: 10px 15px;
  border-radius: 20px;
  font-size: 12px;
  box-shadow: 0 10px 20px rgba(0,0,0,0.1);
  white-space: nowrap;
  animation: float 3s infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.house-dock {
  height: 80px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-bottom: 20px;
}

.dock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #ff6b9d;
  font-size: 11px;
}

.dock-item i { font-size: 20px; }

.house-event-bubble {
  position: absolute;
  top: 15%;
  left: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 10px 15px;
  border-radius: 15px;
  border: 1px solid #ffecf0;
  box-shadow: 0 4px 15px rgba(255, 107, 157, 0.15);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #5a5a7a;
  z-index: 5;
}

.house-event-bubble i {
  color: #ff6b9d;
}

.animate-fade-in { animation: fadeIn 0.5s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* 移动端适配 */
@media (max-width: 480px) {
  .love-house {
    padding: 0;
  }
  
  .header {
    padding: 12px 16px;
  }
  
  h2 {
    font-size: 16px;
  }
  
  .back-btn {
    font-size: 18px;
    padding: 8px;
  }
  
  .house-stats {
    font-size: 11px;
  }
  
  .house-canvas {
    padding: 12px;
  }
  
  .room-background {
    width: 100%;
  }
  
  .window {
    width: 120px;
    height: 120px;
  }
  
  .furniture img {
    width: 50px;
    height: 50px;
  }
  
  .furniture.bed {
    width: 100px;
    height: 80px;
  }
  
  .furniture.desk {
    width: 70px;
    height: 70px;
  }
  
  .furniture.plant {
    width: 50px;
    height: 60px;
  }
  
  .characters {
    gap: 15px;
  }
  
  .char img {
    width: 50px;
    height: 50px;
  }
  
  .status-pin {
    font-size: 9px;
    padding: 2px 6px;
  }
  
  .interact-bubble {
    top: -50px;
    font-size: 11px;
    padding: 8px 12px;
  }
  
  .house-event-bubble {
    top: 10%;
    left: 10px;
    font-size: 11px;
    padding: 8px 12px;
  }
  
  .house-dock {
    height: 70px;
    padding-bottom: 15px;
  }
  
  .dock-item i {
    font-size: 18px;
  }
  
  .dock-item span {
    font-size: 10px;
  }
}
</style>

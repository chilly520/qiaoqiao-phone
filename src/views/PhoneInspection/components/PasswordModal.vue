<template>
  <div class="password-modal">
    <div class="overlay" @click.self="handleClose"></div>
    
    <div class="modal-content">
      <div class="lock-icon">
        <i class="fa-solid fa-lock"></i>
      </div>
      
      <h3 class="title">{{ charName }}的手机已锁定</h3>
      <p class="hint">{{ passwordHint || '请输入密码' }}</p>
      
      <!-- 密码输入区 -->
      <div class="password-dots">
        <div 
          v-for="i in 4" 
          :key="i"
          class="dot"
          :class="{ filled: password.length >= i }"
        ></div>
      </div>
      
      <!-- 数字键盘 -->
      <div class="numpad">
        <div 
          v-for="num in 9" 
          :key="num"
          class="num-key"
          @click="inputNumber(num)"
        >
          {{ num }}
        </div>
        <div class="num-key"></div>
        <div class="num-key" @click="inputNumber(0)">0</div>
        <div class="num-key" @click="deleteNumber">
          <i class="fa-solid fa-delete-left"></i>
        </div>
      </div>
      
      <!-- 忘记密码 -->
      <button class="forgot-btn" @click="handleShowHint">
        忘记密码？
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  charName: String,
  passwordHint: String
})

const emit = defineEmits(['verify', 'close'])

const password = ref('')

// Methods
function inputNumber(num) {
  if (password.value.length < 4) {
    password.value += num
    
    // 自动验证
    if (password.value.length === 4) {
      setTimeout(() => {
        emit('verify', password.value)
      }, 300)
    }
  }
}

function deleteNumber() {
  password.value = password.value.slice(0, -1)
}

function handleShowHint() {
  if (props.passwordHint) {
    alert(`提示：${props.passwordHint}`)
  } else {
    alert('请联系角色本人获取密码提示')
  }
}

function handleClose() {
  emit('close')
}
</script>

<style scoped>
.password-modal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
}

.modal-content {
  position: relative;
  width: 320px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 28px;
  padding: 40px 30px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.lock-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: white;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.title {
  font-size: 22px;
  font-weight: 600;
  text-align: center;
  color: #1D1D1F;
  margin-bottom: 8px;
}

.hint {
  font-size: 14px;
  color: #86868B;
  text-align: center;
  margin-bottom: 30px;
}

.password-dots {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 40px;
}

.dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #C7C7CC;
  transition: all 0.2s;
}

.dot.filled {
  background: #1D1D1F;
  border-color: #1D1D1F;
}

.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.num-key {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 400;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.num-key:active {
  background: rgba(0, 0, 0, 0.1);
  transform: scale(0.95);
}

.forgot-btn {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: none;
  color: #007AFF;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 12px;
  transition: background 0.2s;
}

.forgot-btn:hover {
  background: rgba(0, 122, 255, 0.1);
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

<template>
  <div class="password-modal fixed inset-0 z-[200] flex flex-col items-center justify-center">
    <!-- Backdrop: Soft Kawaii Gradient -->
    <div class="absolute inset-0 bg-gradient-to-br from-[#FFF0F5] to-[#E6E6FA] opacity-95"></div>

    <!-- Floating Decorative Elements -->
    <div class="absolute top-20 left-10 text-pink-200 text-6xl opacity-40"><i class="fa-solid fa-cloud"></i></div>
    <div class="absolute bottom-20 right-10 text-purple-200 text-6xl opacity-40"><i class="fa-solid fa-star"></i></div>

    <!-- Cute Lock Icon -->
    <div class="relative z-10 mb-8 animate-bounce-soft">
      <div class="w-24 h-24 rounded-full bg-white flex items-center justify-center border-4 border-pink-200 shadow-lg">
        <i class="fa-solid fa-cat text-4xl text-pink-400"></i>
      </div>
      <div class="absolute -top-2 -right-2 bg-pink-400 text-white rounded-full p-2 border-4 border-white">
        <i class="fa-solid fa-lock text-xs"></i>
      </div>
    </div>

    <!-- Header -->
    <div class="relative z-10 text-center mb-10">
      <h2 class="text-2xl font-black text-[#8F5E6E] mb-2 tracking-wide">{{ charName }} 的手机</h2>
      <div class="bg-white/60 px-4 py-1 rounded-full inline-block border border-pink-100 shadow-sm">
        <p class="text-[#A66D7A] text-xs font-bold">{{ passwordHint || '请输入数字暗号' }}</p>
      </div>
    </div>

    <!-- Password Dots (Hearts!) -->
    <div class="relative z-10 flex gap-6 mb-16" :class="{ 'shake-animation': isError }">
      <div v-for="i in 4" :key="i" class="w-6 h-6 flex items-center justify-center transition-all duration-300">
        <i class="fa-solid fa-heart text-2xl"
          :class="currentCode.length >= i ? 'text-pink-400 scale-125' : 'text-pink-100'"></i>
      </div>
    </div>

    <!-- Kawaii Numpad -->
    <div class="relative z-10 grid grid-cols-3 gap-x-10 gap-y-6">
      <button v-for="n in 9" :key="n" class="kawaii-btn active:scale-95" @click="inputDigit(n)">
        <span class="num">{{ n }}</span>
      </button>
      <div class="w-16 h-16"></div>
      <button class="kawaii-btn active:scale-95" @click="inputDigit(0)">
        <span class="num">0</span>
      </button>
      <button class="kawaii-btn !bg-transparent !shadow-none !border-none text-pink-300 active:scale-90"
        @click="deleteDigit">
        <i class="fa-solid fa-delete-left text-2xl"></i>
      </button>
    </div>

    <!-- Footer -->
    <div class="relative z-10 mt-12">
      <button class="text-[#A66D7A] text-xs font-black uppercase tracking-widest opacity-60">
        <i class="fa-solid fa-phone mr-1"></i> 紧急呼叫
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  charName: String,
  passwordHint: String
})

const emit = defineEmits(['verify', 'close'])

const currentCode = ref('')
const isError = ref(false)

function inputDigit(digit) {
  if (currentCode.value.length < 4) {
    currentCode.value += digit
    if (currentCode.value.length === 4) {
      setTimeout(() => {
        emit('verify', currentCode.value)
        currentCode.value = ''
      }, 300)
    }
  }
}

function deleteDigit() {
  currentCode.value = currentCode.value.slice(0, -1)
}

function triggerError() {
  isError.value = true
  setTimeout(() => isError.value = false, 500)
}

defineExpose({ triggerError })
</script>

<style scoped>
.kawaii-btn {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: white;
  border: 3px solid #FFD1DC;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8F5E6E;
  font-size: 24px;
  font-weight: 900;
  box-shadow: 0 6px 0 #FFD1DC;
  transition: all 0.1s;
}

.kawaii-btn:active {
  transform: translateY(4px);
  box-shadow: 0 2px 0 #FFD1DC;
}

.shake-animation {
  animation: shake 0.5s cubic-bezier(.36, .07, .19, .97) both;
}

@keyframes shake {

  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }

  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }

  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }

  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}

@keyframes bounce-soft {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-10px);
  }
}

.password-modal {
  font-family: 'Outfit', sans-serif;
}
</style>

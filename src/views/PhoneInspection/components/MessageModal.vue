<template>
  <Transition name="fade">
    <div v-if="modelValue" class="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" @click="handleCancel">
      <div class="bg-white rounded-[40px] w-full max-w-xs overflow-hidden shadow-2xl animate-pop-in border-4 border-white" @click.stop>
        <!-- Header Decor -->
        <div class="h-24 bg-gradient-to-br from-[#FF72A1] to-[#FD70A1] flex items-center justify-center relative overflow-hidden">
             <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
             <i :class="iconMap[type] || 'fa-solid fa-bell'" class="text-4xl text-white drop-shadow-lg animate-bounce-soft"></i>
        </div>

        <div class="p-8 flex flex-col items-center">
             <h3 class="text-xl font-black text-gray-800 mb-3 text-center leading-tight">{{ title }}</h3>
             <p class="text-[14px] text-gray-400 text-center mb-8 leading-relaxed font-bold italic px-2">
                 {{ message }}
             </p>

             <div class="w-full flex gap-3">
                 <button v-if="type === 'confirm'" @click="handleCancel"
                    class="flex-1 py-4 bg-[#F5F5F7] text-gray-500 rounded-2xl font-black active:scale-95 transition-all text-xs border border-gray-100 shadow-inner-sm">
                    {{ cancelText }}
                 </button>
                 <button @click="handleConfirm"
                    :class="['flex-1 py-4 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all text-xs', 
                        type === 'error' ? 'bg-red-400 shadow-red-100' : 'bg-gradient-to-r from-[#FF72A1] to-[#FC6C9C] shadow-pink-100']">
                    {{ okText }}
                 </button>
             </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
const props = defineProps({
  modelValue: Boolean,
  type: {
    type: String,
    default: 'alert' // alert, confirm, success, error
  },
  title: {
    type: String,
    default: '系统提示'
  },
  message: String,
  okText: {
    type: String,
    default: '我知道了'
  },
  cancelText: {
    type: String,
    default: '取消'
  }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const iconMap = {
  alert: 'fa-solid fa-circle-exclamation',
  confirm: 'fa-sharp fa-solid fa-circle-question',
  success: 'fa-solid fa-heart-circle-check',
  error: 'fa-solid fa-triangle-exclamation'
}

function handleConfirm() {
  emit('confirm')
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.animate-pop-in {
  animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes pop-in {
  from { transform: scale(0.85); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.shadow-inner-sm {
    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
}
</style>

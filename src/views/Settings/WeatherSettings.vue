<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../../stores/settingsStore'
import { storeToRefs } from 'pinia'

const router = useRouter()
const store = useSettingsStore()
const { weather } = storeToRefs(store)

const goBack = () => {
    router.back()
}

// Local inputs for editing
const virtualLoc = ref(weather.value.virtualLocation || '')
const realLoc = ref(weather.value.realLocation || '')

const showToast = ref(false)
const toastMessage = ref('')
const showToastMsg = (msg) => {
    toastMessage.value = msg
    showToast.value = true
    setTimeout(() => { showToast.value = false }, 2000)
}

const saveWeather = () => {
    store.setWeatherConfig({
        virtualLocation: virtualLoc.value,
        realLocation: realLoc.value
    })
    showToastMsg('天气地点已更新')
}
</script>

<template>
  <div class="weather-settings w-full h-full bg-gray-50 flex flex-col">
    
    <!-- Header -->
    <div class="h-[56px] bg-white flex items-center justify-between px-4 border-b border-gray-100">
       <div class="flex items-center gap-3 cursor-pointer" @click="goBack">
           <i class="fa-solid fa-chevron-left text-lg"></i>
           <span class="font-bold text-xl">地点设置</span>
       </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
        
        <div class="glass-panel p-4 rounded-[20px] space-y-4">
             <h3 class="text-base font-bold text-gray-900 mb-3">地点设置</h3>
             
             <div>
                 <label class="block text-xs text-gray-500 mb-1">桌面显示的虚拟地点</label>
                 <input v-model="virtualLoc" type="text" placeholder="例如：哥谭市" class="setting-input w-full">
             </div>

             <div>
                 <label class="block text-xs text-gray-500 mb-1">映射的真实地点 (获取天气用)</label>
                 <input v-model="realLoc" type="text" placeholder="例如：New York" class="setting-input w-full">
                 <p class="text-[10px] text-gray-500 mt-1">* 请输入真实的城市英文名或拼音，以便准确获取天气</p>
             </div>

             <button @click="saveWeather" class="w-full bg-blue-500 text-white py-3 rounded-xl font-medium mt-4 shadow-sm hover:shadow-md transition active:scale-[0.98]">
                保存并更新天气
             </button>
        </div>

    </div>

    <!-- Toast -->
    <div 
        v-if="showToast"
        class="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg z-50"
    >
        {{ toastMessage }}
    </div>

  </div>
</template>

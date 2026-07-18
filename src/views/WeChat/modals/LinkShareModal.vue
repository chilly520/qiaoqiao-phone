<template>
  <div v-if="show" class="fixed inset-0 z-[200] flex items-center justify-center" @click.self="close">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

    <div class="relative bg-white rounded-2xl w-[340px] max-w-[90vw] shadow-2xl overflow-hidden">
      <!-- 头部 -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 class="text-base font-medium text-gray-800">分享链接</h3>
        <button @click="close" class="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- 输入区 -->
      <div class="p-4">
        <div class="flex gap-2">
          <input v-model="inputUrl" type="text" placeholder="粘贴抖音/小红书/网页链接"
            class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
            @keydown.enter="fetchPreview" @paste="onPaste" />
          <button @click="fetchPreview" :disabled="loading || !inputUrl.trim()"
            class="px-4 py-2 text-sm text-white bg-blue-500 rounded-lg disabled:opacity-40 hover:bg-blue-600 transition-colors">
            <i v-if="loading" class="fa-solid fa-spinner fa-spin"></i>
            <span v-else>解析</span>
          </button>
        </div>

        <!-- 支持平台提示 -->
        <div class="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
          <span><i class="fa-brands fa-tiktok"></i> 抖音</span>
          <span><i class="fa-solid fa-book"></i> 小红书</span>
          <span><i class="fa-solid fa-link"></i> 任意网页</span>
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
          {{ error }}
        </div>

        <!-- 预览卡片 -->
        <div v-if="previewData" class="mt-3">
          <p class="text-[11px] text-gray-400 mb-2">预览</p>
          <LinkShareCard :data="previewData" />
        </div>

        <!-- 发送按钮 -->
        <button v-if="previewData" @click="confirmSend"
          class="mt-4 w-full py-2.5 text-sm text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors font-medium">
          <i class="fa-solid fa-paper-plane mr-1"></i> 发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import LinkShareCard from '../../../components/LinkShareCard.vue'

const props = defineProps({
  show: Boolean
})
const emit = defineEmits(['close', 'send'])

const inputUrl = ref('')
const loading = ref(false)
const error = ref('')
const previewData = ref(null)

function close() {
  inputUrl.value = ''
  loading.value = false
  error.value = ''
  previewData.value = null
  emit('close')
}

function onPaste(e) {
  // 粘贴后自动解析
  const text = (e.clipboardData || window.clipboardData).getData('text')
  if (text && /^https?:\/\//i.test(text.trim())) {
    setTimeout(() => fetchPreview(), 50)
  }
}

async function fetchPreview() {
  const url = inputUrl.value.trim()
  if (!url) return

  loading.value = true
  error.value = ''
  previewData.value = null

  try {
    const resp = await fetch(`/v2/link/fetch?url=${encodeURIComponent(url)}`)
    const json = await resp.json()
    if (json.error) {
      error.value = '解析失败: ' + json.error
    } else if (json.data) {
      previewData.value = json.data
    } else {
      error.value = '未能解析该链接'
    }
  } catch (e) {
    error.value = '网络错误,请重试'
  } finally {
    loading.value = false
  }
}

function confirmSend() {
  if (!previewData.value) return
  emit('send', previewData.value)
  close()
}
</script>

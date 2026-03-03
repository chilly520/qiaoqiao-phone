<template>
    <div class="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="$emit('close')">
        <div class="bg-[#f2f2f2] w-full max-w-[360px] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-scale-up max-h-[85vh]"
            @click.stop>
            <!-- Header -->
            <div class="p-4 flex justify-between items-center bg-white">
                <button @click="$emit('close')" class="text-[#07c160] text-sm">取消</button>
                <h3 class="font-bold text-gray-900">发起投票</h3>
                <button @click="publish" :disabled="!isValid"
                    class="bg-[#07c160] text-white px-4 py-1 rounded-md text-sm disabled:opacity-50">发布</button>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-4">
                <!-- Title Input -->
                <div class="bg-white rounded-xl p-3 shadow-sm text-sm">
                    <input v-model="form.title" type="text" placeholder="填写投票标题"
                        class="w-full bg-transparent outline-none py-1 border-b border-gray-100 focus:border-[#07c160] transition-colors" />
                </div>

                <!-- Options List -->
                <div class="bg-white rounded-xl shadow-sm text-sm overflow-hidden">
                    <div v-for="(opt, idx) in form.options" :key="idx"
                        class="flex items-center gap-3 p-3 border-b border-gray-50 last:border-0">
                        <button v-if="form.options.length > 2" @click="removeOption(idx)" class="text-red-400">
                            <i class="fa-solid fa-circle-minus"></i>
                        </button>
                        <input v-model="form.options[idx]" type="text" :placeholder="'选项 ' + (idx + 1)"
                            class="flex-1 bg-transparent outline-none" />
                    </div>
                    <button @click="addOption"
                        class="w-full p-3 text-[#576b95] text-left hover:bg-gray-50 transition-colors">
                        <i class="fa-solid fa-plus mr-2"></i> 添加选项
                    </button>
                </div>

                <!-- Configs -->
                <div class="bg-white rounded-xl shadow-sm text-sm divide-y divide-gray-50">
                    <div class="flex justify-between items-center p-3">
                        <span class="text-gray-700">多选投票</span>
                        <button @click="form.isMultiple = !form.isMultiple"
                            class="w-10 h-6 rounded-full relative transition-colors duration-200"
                            :class="form.isMultiple ? 'bg-[#07c160]' : 'bg-gray-200'">
                            <div class="absolute top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200"
                                :class="form.isMultiple ? 'left-5' : 'left-1'"></div>
                        </button>
                    </div>
                    <div class="flex justify-between items-center p-3">
                        <div class="flex flex-col">
                            <span class="text-gray-700">截止日期</span>
                            <span class="text-[10px] text-gray-400">{{ deadlineText }}</span>
                        </div>
                        <select v-model="form.deadlineType"
                            class="bg-gray-100 rounded px-2 py-1 text-[11px] outline-none border-none">
                            <option value="none">永不截止</option>
                            <option value="30m">30分钟后</option>
                            <option value="1h">1小时后</option>
                            <option value="4h">4小时后</option>
                            <option value="12h">12小时后</option>
                            <option value="1d">1天后</option>
                            <option value="3d">3天后</option>
                        </select>
                    </div>
                    <div class="flex justify-between items-center p-3">
                        <div class="flex flex-col">
                            <span class="text-gray-700">匿名投票</span>
                            <span class="text-[10px] text-gray-400">设置后，除发起人外可见结果但不可见投票人</span>
                        </div>
                        <button @click="form.isAnonymous = !form.isAnonymous"
                            class="w-10 h-6 rounded-full relative transition-colors duration-200"
                            :class="form.isAnonymous ? 'bg-[#07c160]' : 'bg-gray-200'">
                            <div class="absolute top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-200"
                                :class="form.isAnonymous ? 'left-5' : 'left-1'"></div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '../../../stores/chatStore'
import { useSettingsStore } from '../../../stores/settingsStore'

const props = defineProps({
    chatId: { type: String, required: true }
})
const emit = defineEmits(['close'])

const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const form = ref({
    title: '',
    options: ['', ''],
    isMultiple: false,
    isAnonymous: false,
    deadlineType: 'none'
})

const deadlineText = computed(() => {
    if (form.value.deadlineType === 'none') return '投票将持续进行'
    const now = Date.now()
    let offset = 0
    switch (form.value.deadlineType) {
        case '30m': offset = 30 * 60 * 1000; break
        case '1h': offset = 60 * 60 * 1000; break
        case '4h': offset = 4 * 60 * 60 * 1000; break
        case '12h': offset = 12 * 60 * 60 * 1000; break
        case '1d': offset = 24 * 60 * 60 * 1000; break
        case '3d': offset = 3 * 24 * 60 * 60 * 1000; break
    }
    return '于 ' + new Date(now + offset).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' 截止'
})

const isValid = computed(() => {
    return form.value.title.trim() && form.value.options.filter(o => o.trim()).length >= 2
})

const addOption = () => {
    if (form.value.options.length < 10) {
        form.value.options.push('')
    }
}

const removeOption = (idx) => {
    form.value.options.splice(idx, 1)
}

const publish = () => {
    if (!isValid.value) return

    const creatorProfile = settingsStore.personalization?.userProfile || { name: '我' }

    let deadline = null
    if (form.value.deadlineType !== 'none') {
        let offset = 0
        switch (form.value.deadlineType) {
            case '30m': offset = 30 * 60 * 1000; break
            case '1h': offset = 60 * 60 * 1000; break
            case '4h': offset = 4 * 60 * 60 * 1000; break
            case '12h': offset = 12 * 60 * 60 * 1000; break
            case '1d': offset = 24 * 60 * 60 * 1000; break
            case '3d': offset = 3 * 24 * 60 * 60 * 1000; break
        }
        deadline = Date.now() + offset
    }

    chatStore.createVote(props.chatId, {
        title: form.value.title.trim(),
        options: form.value.options.filter(o => o.trim()),
        isMultiple: form.value.isMultiple,
        isAnonymous: form.value.isAnonymous,
        deadline,
        creatorId: 'user',
        creatorName: creatorProfile.name
    })

    emit('close')
}
</script>

<style scoped>
.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

.animate-scale-up {
    animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
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
</style>

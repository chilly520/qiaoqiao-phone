<template>
    <div class="email-app h-full bg-[#F0F4F8] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="email-header pt-16 pb-4 px-6 bg-gradient-to-r from-[#87CEEB] to-[#B0E0E6] sticky top-0 z-30 shadow-sm">
            <div class="flex items-center gap-4">
                <button @click="$emit('back')"
                    class="w-8 h-8 flex items-center justify-center rounded-full bg-white/30 active:scale-90 transition-transform backdrop-blur-sm">
                    <i class="fa-solid fa-chevron-left text-white"></i>
                </button>
                <span class="flex-1 font-black text-white text-lg tracking-wide drop-shadow-sm">邮件</span>
                <button class="w-8 h-8 flex items-center justify-center rounded-full bg-white/30 active:scale-90 transition-transform backdrop-blur-sm">
                    <i class="fa-solid fa-pen-to-square text-white text-sm"></i>
                </button>
            </div>
        </div>

        <!-- Content -->
        <div class="email-content flex-1 overflow-y-auto px-4 pb-20" v-if="!selectedMail">
            <!-- Search Bar -->
            <div class="mt-4 mb-5 bg-white/80 rounded-2xl p-3 flex items-center gap-3 shadow-sm border border-blue-100/50 backdrop-blur-sm">
                <i class="fa-solid fa-magnifying-glass text-blue-300 text-sm"></i>
                <span class="text-blue-300/70 text-sm font-bold">搜索邮件...</span>
            </div>

            <!-- Category Tabs -->
            <div class="flex gap-2 mb-5 overflow-x-auto pb-1 no-scrollbar">
                <span v-for="tab in categories" :key="tab.key"
                    class="px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap cursor-pointer transition-all active:scale-95"
                    :class="activeTab === tab.key ? 'bg-[#4682B4] text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100'"
                    @click="activeTab = tab.key">{{ tab.label }}</span>
            </div>

            <!-- Email List -->
            <div class="space-y-3">
                <div v-for="(mail, idx) in filteredMails" :key="idx"
                    class="bg-white rounded-2xl p-4 shadow-sm border border-blue-50/80 cursor-pointer active:scale-[0.98] transition-all animate-slide-in hover:shadow-md"
                    :class="{ 'border-l-4 border-l-[#4682B4]': !mail.read }"
                    @click="selectedMail = mail">
                    <div class="flex gap-3">
                        <!-- Avatar -->
                        <div class="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-sm shadow-sm"
                            :style="{ backgroundColor: mail.avatarColor || '#87CEEB' }">
                            {{ (mail.sender || '?')[0] }}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center mb-1">
                                <span class="font-black text-[15px] truncate pr-2"
                                    :class="mail.read ? 'text-gray-500' : 'text-gray-800'">{{ mail.sender }}</span>
                                <span class="text-[10px] font-bold text-gray-300 flex-shrink-0">{{ mail.time }}</span>
                            </div>
                            <h3 class="font-bold text-[13px] truncate mb-1"
                                :class="mail.read ? 'text-gray-400' : 'text-gray-700'">{{ mail.subject }}</h3>
                            <p class="text-[11px] text-gray-400 line-clamp-1 font-medium">{{ (mail.body || mail.preview || '').substring(0, 60) }}</p>
                        </div>
                        <!-- Unread Dot -->
                        <div v-if="!mail.read" class="w-2.5 h-2.5 bg-[#4682B4] rounded-full flex-shrink-0 mt-1.5 shadow-sm"></div>
                    </div>
                    <!-- Tags -->
                    <div v-if="mail.tags && mail.tags.length" class="flex gap-1.5 mt-3 pt-3 border-t border-gray-50">
                        <span v-for="tag in mail.tags" :key="tag"
                            class="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-[#4682B4]">{{ tag }}</span>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-if="filteredMails.length === 0" class="py-16 text-center">
                    <div class="w-20 h-20 mx-auto mb-4 bg-blue-50 rounded-3xl flex items-center justify-center">
                        <i class="fa-solid fa-envelope-open text-3xl text-blue-200"></i>
                    </div>
                    <p class="text-sm font-bold text-gray-300">这里空空如也~</p>
                    <p class="text-xs text-gray-200 mt-1">还没有收到邮件呢</p>
                </div>
            </div>
        </div>

        <!-- Mail Detail Overlay -->
        <Transition name="slide-up">
            <div v-if="selectedMail" class="fixed inset-0 z-[100] bg-[#F0F4F8] flex flex-col overflow-hidden">
                <!-- Detail Header -->
                <div class="pt-16 pb-4 px-5 bg-gradient-to-r from-[#87CEEB] to-[#B0E0E6] flex flex-col shadow-sm relative z-10">
                    <div class="flex items-center gap-3 mb-4">
                        <button @click="if (selectedMail) { selectedMail.read = true }; selectedMail = null"
                            class="w-8 h-8 flex items-center justify-center rounded-full bg-white/30 active:scale-90 transition-transform">
                            <i class="fa-solid fa-chevron-left text-white"></i>
                        </button>
                        <span class="flex-1 font-black text-white tracking-wide drop-shadow-sm">邮件详情</span>
                        <button class="w-8 h-8 flex items-center justify-center rounded-full bg-white/30 active:scale-90 transition-transform">
                            <i class="fa-solid fa-trash-can text-white text-sm"></i>
                        </button>
                    </div>
                    <!-- Sender Info -->
                    <div class="flex items-center gap-3 mt-1">
                        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md"
                            :style="{ backgroundColor: selectedMail.avatarColor || '#87CEEB' }">
                            {{ (selectedMail.sender || '?')[0] }}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-black text-white text-[15px] drop-shadow-sm">{{ selectedMail.sender }}</div>
                            <div class="text-[11px] text-white/70 font-bold">发送至: 我</div>
                        </div>
                        <span class="text-[10px] text-white/60 font-bold">{{ selectedMail.time }}</span>
                    </div>
                </div>

                <!-- Detail Body -->
                <div class="flex-1 overflow-y-auto p-5 pb-24">
                    <div class="bg-white rounded-2xl p-5 shadow-sm border border-blue-50/50">
                        <h2 class="font-black text-[17px] text-gray-800 mb-4 leading-relaxed">{{ selectedMail.subject }}</h2>
                        <div class="text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap font-medium">{{ selectedMail.body || selectedMail.content }}</div>
                    </div>

                    <!-- Attachments -->
                    <div v-if="selectedMail.attachments && selectedMail.attachments.length" class="mt-4">
                        <div class="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">附件</div>
                        <div v-for="(att, i) in selectedMail.attachments" :key="i"
                            class="bg-white rounded-xl p-3 flex items-center gap-3 mb-2 shadow-sm border border-gray-50">
                            <div class="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#4682B4]">
                                <i class="fa-solid fa-paperclip"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <span class="text-[13px] font-bold text-gray-700 truncate block">{{ att.name }}</span>
                                <span class="text-[10px] text-gray-300">{{ att.size }}</span>
                            </div>
                            <i class="fa-solid fa-download text-blue-300 text-sm"></i>
                        </div>
                    </div>
                </div>

                <!-- Reply Action Bar -->
                <div class="absolute bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-100">
                    <div class="flex gap-3">
                        <button class="flex-1 py-3 rounded-2xl bg-[#4682B4] text-white font-black text-sm active:scale-95 transition-transform shadow-sm">
                            <i class="fa-solid fa-reply mr-1"></i> 回复
                        </button>
                        <button class="flex-1 py-3 rounded-2xl bg-white text-[#4682B4] font-black text-sm border border-[#4682B4]/30 active:scale-95 transition-transform">
                            <i class="fa-solid fa-share mr-1"></i> 转发
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
    emailData: {
        type: Object,
        default: () => ({ mails: [] })
    }
})

defineEmits(['back'])

const activeTab = ref('all')
const selectedMail = ref(null)

const categories = [
    { key: 'all', label: '全部' },
    { key: 'unread', label: '未读' },
    { key: 'starred', label: '星标' },
    { key: 'promotions', label: '推广' }
]

const allMails = computed(() => {
    const data = props.emailData?.mails || []
    if (data.length > 0) return data
    return getDefaultMails()
})

const filteredMails = computed(() => {
    if (activeTab.value === 'all') return allMails.value
    if (activeTab.value === 'unread') return allMails.value.filter(m => !m.read)
    if (activeTab.value === 'starred') return allMails.value.filter(m => m.starred)
    if (activeTab.value === 'promotions') return allMails.value.filter(m => m.category === 'promotions')
    return allMails.value
})

function getDefaultMails() {
    return [
        {
            sender: '系统通知',
            subject: '欢迎使用邮箱服务',
            preview: '您的邮箱已成功激活，开始收发邮件吧~',
            content: '亲爱的用户，\n\n欢迎来到您的专属邮箱！这里可以接收来自各方的信件和通知。\n\n祝您使用愉快！',
            time: '09:41',
            read: true,
            starred: false,
            category: 'system',
            avatarColor: '#87CEEB',
            tags: ['系统']
        }
    ]
}
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none }

@keyframes slide-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}
.animate-slide-in { animation: slide-in 0.35s ease-out both; }
.animate-slide-in:nth-child(2) { animation-delay: 0.05s; }
.animate-slide-in:nth-child(3) { animation-delay: 0.1s; }
.animate-slide-in:nth-child(4) { animation-delay: 0.15s; }
.animate-slide-in:nth-child(5) { animation-delay: 0.2s; }

.slide-up-enter-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-leave-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-enter-from { transform: translateY(100%); opacity: 0; }
.slide-up-leave-to { transform: translateY(20%); opacity: 0; }

.line-clamp-1 {
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
}
</style>

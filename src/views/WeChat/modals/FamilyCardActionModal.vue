<template>
    <!-- Family Card Action Selection Modal -->
    <div v-if="visible" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-up">
            <h3 class="text-lg font-bold text-center mb-6">亲属卡</h3>

            <div class="space-y-4">
                <!-- Apply for Family Card -->
                <button @click="handleAction('apply')"
                    class="w-full bg-gradient-to-r from-[#ff9a9e] to-[#fecfef] text-white py-4 rounded-xl font-bold shadow-md hover:shadow-lg transition-all">
                    <div class="flex items-center justify-center gap-2">
                        <i class="fa-solid fa-hand-holding-heart"></i>
                        <span>申请亲属卡</span>
                    </div>
                </button>

                <!-- Send Family Card -->
                <button @click="handleAction('send')"
                    class="w-full bg-gradient-to-r from-[#4facfe] to-[#00f2fe] text-white py-4 rounded-xl font-bold shadow-md hover:shadow-lg transition-all">
                    <div class="flex items-center justify-center gap-2">
                        <i class="fa-solid fa-gift"></i>
                        <span>赠送亲属卡</span>
                    </div>
                </button>
            </div>

            <!-- Cancel Button -->
            <button @click="close"
                class="w-full mt-4 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                取消
            </button>
        </div>
    </div>
</template>
<script setup>
const props = defineProps({
    visible: Boolean
})

const emit = defineEmits(['update:visible', 'action'])

const close = () => {
    emit('update:visible', false)
}

const handleAction = (type) => {
    emit('action', type)
    close()
}
</script>

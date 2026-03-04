<template>
    <button @click="$emit('click')"
        class="flex flex-col items-center gap-1 p-2 relative transition-all active:scale-90">
        <span class="text-2xl transition-transform" :class="active ? 'scale-110' : 'opacity-60'">
            {{ icon }}
        </span>
        <span class="text-[10px] font-medium" :class="active ? 'text-orange-500' : 'text-gray-400'">
            {{ label }}
        </span>

        <!-- 徽章 -->
        <span v-if="badge > 0"
            class="absolute -top-0.5 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
            {{ badge > 99 ? '99+' : badge }}
        </span>

        <!-- 活跃指示器 -->
        <div v-if="active" class="absolute -bottom-1 w-1 h-1 bg-orange-500 rounded-full"></div>
    </button>
</template>

<script setup>
defineProps({
    icon: String,
    label: String,
    active: Boolean,
    badge: {
        type: Number,
        default: 0
    }
})

defineEmits(['click'])
</script>

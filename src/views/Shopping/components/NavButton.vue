<template>
    <button @click="$emit('click')"
        class="flex flex-col items-center gap-1.5 p-2.5 relative transition-all active:scale-90">
        <span class="text-2xl transition-all" :class="active ? 'scale-125 drop-shadow-sm' : 'opacity-50 grayscale'">
            {{ icon }}
        </span>
        <span class="text-[10px] font-bold" :class="active ? 'text-orange-600' : 'text-slate-400'">
            {{ label }}
        </span>

        <!-- 徽章 -->
        <span v-if="badge > 0"
            class="absolute -top-0.5 right-1 w-4 h-4 bg-gradient-to-br from-red-500 to-orange-500 text-white text-[9px] rounded-full flex items-center justify-center font-black shadow-sm">
            {{ badge > 99 ? '99+' : badge }}
        </span>

        <!-- 活跃指示器 -->
        <div v-if="active" class="absolute -bottom-1 w-1.5 h-1.5 bg-gradient-to-r from-orange-500 to-red-500 rounded-full shadow-sm"></div>
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

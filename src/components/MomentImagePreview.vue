<script setup>
import ImagePreview from './ImagePreview.vue'

const props = defineProps({
    show: Boolean,
    images: {
        type: Array,
        default: () => []
    },
    initialIndex: {
        type: Number,
        default: 0
    }
})

const emit = defineEmits(['close'])
</script>

<template>
    <ImagePreview 
        :show="show" 
        :images="images" 
        :initial-index="initialIndex"
        @close="emit('close')" 
    />
</template>

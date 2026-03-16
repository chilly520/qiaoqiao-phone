<template>
  <div class="safe-html-container w-full overflow-hidden rounded-xl border border-amber-100 shadow-sm bg-white" v-html="sanitizedContent"></div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
});

// Basic sanitation if needed, though we trust the AI output in this context
// We mostly want to ensure it's rendered as a block
const sanitizedContent = computed(() => {
  if (!props.content) return '';
  return props.content;
});
</script>

<style>
/* Scoped styles don't work well with v-html, so we use a container class */
.safe-html-container {
  max-width: 100%;
  position: relative;
}

/* Ensure images and tables don't break layout */
.safe-html-container img {
  max-width: 100%;
  height: auto;
}

.safe-html-container table {
  width: 100%;
  border-collapse: collapse;
}

/* Allow the AI to use its own styles if it provided them */
</style>

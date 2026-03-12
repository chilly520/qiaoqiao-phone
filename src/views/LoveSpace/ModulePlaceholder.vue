<template>
  <div class="module-placeholder">
    <div class="header">
      <button @click="$router.back()" class="back-btn">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
      <h2>{{ title }}</h2>
    </div>
    <div class="content">
      <div class="empty-state">
        <span class="icon">{{ icon }}</span>
        <h3>{{ title }}模块</h3>
        <p>正在甜蜜构建中，敬请期待...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '甜蜜模块' },
  icon: { type: String, default: '❤️' }
})
</script>

<style scoped>
.module-placeholder {
  min-height: 100vh;
  background: #fff5f7;
  display: flex;
  flex-direction: column;
}
.header {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  background: white;
}
.back-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #ff6b9d;
}
.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-state {
  text-align: center;
}
.icon {
  font-size: 64px;
  display: block;
  margin-bottom: 20px;
}
h3 {
  color: #ff6b9d;
  margin-bottom: 10px;
}
p {
  color: #8b7aa8;
}
</style>

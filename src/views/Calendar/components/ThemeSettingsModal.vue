<template>
  <div v-if="visible" class="theme-settings-modal" @click.self="$emit('close')">
    <div class="modal-content">
      <!-- 头部 -->
      <div class="modal-header">
        <h3>🎨 主题设置</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <!-- 主体内容 -->
      <div class="modal-body">
        <!-- 夜间模式切换 -->
        <div class="setting-group">
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">🌙 夜间模式</span>
              <span class="setting-desc">保护眼睛，适合夜间使用</span>
            </div>
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                :checked="calendarStore.themeSettings.isDarkMode"
                @change="toggleDarkMode"
              >
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 预设主题 -->
        <div class="setting-group">
          <h4 class="group-title">🎨 预设主题</h4>
          <div class="theme-grid">
            <div 
              v-for="theme in calendarStore.presetThemes" 
              :key="theme.id"
              class="theme-card"
              :class="{ active: calendarStore.themeSettings.currentTheme === theme.id }"
              @click="selectTheme(theme.id)"
            >
              <div class="theme-preview" :class="theme.colors.background">
                <div class="preview-header" :class="`bg-gradient-to-r ${theme.colors.primary}`"></div>
                <div class="preview-content">
                  <div class="preview-dot" :class="theme.colors.text"></div>
                  <div class="preview-line" :class="theme.colors.border"></div>
                </div>
              </div>
              <span class="theme-name">{{ theme.name }}</span>
              <div v-if="calendarStore.themeSettings.currentTheme === theme.id" class="theme-check">
                ✓
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCalendarStore } from '../../../stores/calendarStore'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['close'])

const calendarStore = useCalendarStore()

function selectTheme(themeId) {
  calendarStore.setTheme(themeId)
}

function toggleDarkMode() {
  calendarStore.toggleDarkMode()
}
</script>

<style scoped>
.theme-settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #f3f4f6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  color: #6b7280;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.modal-body {
  padding: 24px;
  max-height: 60vh;
  overflow-y: auto;
}

.setting-group {
  margin-bottom: 32px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
}

.setting-info {
  flex: 1;
}

.setting-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.setting-desc {
  display: block;
  font-size: 12px;
  color: #6b7280;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #d1d5db;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background: linear-gradient(to right, #8b5cf6, #ec4899);
}

input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

.group-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
}

.theme-card {
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.theme-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.1);
}

.theme-card.active {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.theme-preview {
  height: 80px;
  position: relative;
  border-radius: 8px 8px 0 0;
}

.preview-header {
  height: 24px;
  border-radius: 8px 8px 0 0;
}

.preview-content {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: currentColor;
}

.preview-line {
  height: 2px;
  background: currentColor;
  width: 80%;
  border-radius: 1px;
}

.theme-name {
  display: block;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  text-align: center;
  background: white;
}

.theme-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
  background: #10b981;
  border: none;
  cursor: pointer;
}
</style>

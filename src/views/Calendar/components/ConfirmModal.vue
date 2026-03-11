<template>
  <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-content" @click.stop>
      <h3>{{ title }}</h3>
      <p class="modal-message">{{ message }}</p>
      <div class="modal-actions">
        <button class="cancel-btn" @click="handleCancel">取消</button>
        <button class="confirm-btn" @click="handleConfirm">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = {
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '提示'
  },
  message: {
    type: String,
    default: ''
  }
}

const emit = defineEmits(['update:visible', 'confirm', 'cancel'])

function handleConfirm() {
  emit('update:visible', false)
  emit('confirm')
}

function handleCancel() {
  emit('update:visible', false)
  emit('cancel')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 24px;
  width: 100%;
  max-width: 320px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0 0 16px 0;
  text-align: center;
}

.modal-message {
  font-size: 15px;
  color: #5a5a7a;
  text-align: center;
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.cancel-btn {
  background: rgba(139, 122, 168, 0.1);
  color: #8b7aa8;
}

.cancel-btn:hover {
  background: rgba(139, 122, 168, 0.2);
}

.confirm-btn {
  background: linear-gradient(135deg, #ffb7c5, #c5c9ff);
  color: white;
}

.confirm-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 183, 197, 0.3);
}
</style>

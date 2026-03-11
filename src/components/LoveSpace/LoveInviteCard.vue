<template>
  <div class="love-invite-card">
    <div class="card-envelope">
      <div class="envelope-flap">💌</div>
      <div class="envelope-body">
        <div class="card-header">
          <div class="heart-icon">
            <i class="fa-solid fa-heart"></i>
          </div>
          <h3>情侣空间邀请</h3>
        </div>
        
        <div class="card-content">
          <p class="invite-message">
            {{ message }}
          </p>
          
          <div class="couple-preview">
            <div class="avatar-wrapper">
              <img :src="userAvatar" class="avatar" alt="用户">
            </div>
            <div class="heart-connector">
              <i class="fa-solid fa-heart"></i>
            </div>
            <div class="avatar-wrapper">
              <img :src="partnerAvatar" class="avatar" alt="角色">
            </div>
          </div>
          
          <div class="invite-info">
            <div class="info-item">
              <i class="fa-solid fa-calendar"></i>
              <span>开通日期：{{ startDate }}</span>
            </div>
            <div class="info-item">
              <i class="fa-solid fa-infinity"></i>
              <span>永久有效</span>
            </div>
          </div>
        </div>
        
        <div class="card-actions">
          <button class="btn-accept" @click="accept">
            <i class="fa-solid fa-heart"></i>
            <span>同意开通</span>
          </button>
          <button class="btn-decline" @click="decline" v-if="showDecline">
            <span>再想想</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  message: {
    type: String,
    default: '我想和你开通专属情侣空间，记录我们的甜蜜时光~'
  },
  userAvatar: {
    type: String,
    default: '/avatars/default-user.jpg'
  },
  partnerAvatar: {
    type: String,
    default: ''
  },
  startDate: {
    type: String,
    default: ''
  },
  showDecline: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['accept', 'decline'])

function accept() {
  emit('accept')
}

function decline() {
  emit('decline')
}
</script>

<style scoped>
.love-invite-card {
  width: 100%;
  margin: 12px 0;
}

.card-envelope {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(255, 107, 157, 0.2);
  border: 2px solid #ffe6eb;
}

.envelope-flap {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  padding: 20px;
  text-align: center;
  font-size: 40px;
  position: relative;
}

.envelope-flap::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid #ff6b9d;
}

.envelope-body {
  padding: 20px;
}

.card-header {
  text-align: center;
  margin-bottom: 20px;
}

.heart-icon {
  font-size: 32px;
  color: #ff6b9d;
  margin-bottom: 8px;
  animation: heartbeat 1.5s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.card-header h3 {
  font-size: 18px;
  color: #ff6b9d;
  margin: 0;
  font-weight: 600;
}

.card-content {
  margin-bottom: 20px;
}

.invite-message {
  font-size: 14px;
  color: #5a5a7a;
  line-height: 1.6;
  text-align: center;
  margin-bottom: 20px;
}

.couple-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.05), rgba(255, 183, 197, 0.05));
  border-radius: 12px;
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.heart-connector {
  font-size: 20px;
  color: #ff6b9d;
  animation: heartbeat 1.5s ease-in-out infinite;
}

.invite-info {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #8b7aa8;
  margin-bottom: 4px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.card-actions {
  display: flex;
  gap: 12px;
}

.btn-accept {
  flex: 1;
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.2s;
}

.btn-accept:hover {
  transform: scale(1.02);
}

.btn-decline {
  flex: 1;
  background: #f5f5f5;
  color: #666;
  border: none;
  border-radius: 12px;
  padding: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-decline:hover {
  transform: scale(1.02);
}
</style>

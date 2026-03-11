<template>
  <div class="love-contract-card">
    <div class="contract-scroll">
      <div class="scroll-header">
        <div class="scroll-knot">💕</div>
        <h3>💗 契约达成 💗</h3>
      </div>
      
      <div class="scroll-content">
        <div class="contract-title">
          <div class="title-decoration">✦</div>
          <span>情侣空间开通证书</span>
          <div class="title-decoration">✦</div>
        </div>
        
        <div class="contract-body">
          <div class="couple-avatars">
            <div class="avatar-wrapper">
              <img :src="userAvatar" class="avatar" alt="用户">
              <div class="avatar-label">{{ userName }}</div>
            </div>
            
            <div class="love-heart">
              <i class="fa-solid fa-heart"></i>
            </div>
            
            <div class="avatar-wrapper">
              <img :src="partnerAvatar" class="avatar" alt="角色">
              <div class="avatar-label">{{ partnerName }}</div>
            </div>
          </div>
          
          <div class="contract-text">
            <p>
              我们自愿开通情侣空间，<br>
              从此携手共度每一个甜蜜时光。<br>
              无论风雨，相互陪伴，<br>
              直到永远。
            </p>
          </div>
          
          <div class="contract-details">
            <div class="detail-row">
              <span class="label">开通日期：</span>
              <span class="value">{{ startDate }}</span>
            </div>
            <div class="detail-row">
              <span class="label">相恋天数：</span>
              <span class="value">{{ loveDays }} 天</span>
            </div>
            <div class="detail-row">
              <span class="label">空间编号：</span>
              <span class="value">{{ contractId }}</span>
            </div>
          </div>
        </div>
        
        <div class="contract-footer">
          <div class="seal">
            <div class="seal-text">💕<br>永久有效</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  userAvatar: {
    type: String,
    default: '/avatars/default-user.jpg'
  },
  userName: {
    type: String,
    default: '我'
  },
  partnerAvatar: {
    type: String,
    default: ''
  },
  partnerName: {
    type: String,
    default: 'TA'
  },
  startDate: {
    type: String,
    default: ''
  },
  loveDays: {
    type: Number,
    default: 0
  },
  contractId: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.love-contract-card {
  width: 100%;
  margin: 12px 0;
}

.contract-scroll {
  background: linear-gradient(135deg, #fff5f7 0%, #ffe6eb 100%);
  border-radius: 16px;
  overflow: hidden;
  border: 3px solid #ffb7c5;
  box-shadow: 0 4px 20px rgba(255, 107, 157, 0.3);
}

.scroll-header {
  background: linear-gradient(135deg, #ff6b9d, #ffb7c5);
  padding: 16px;
  text-align: center;
  position: relative;
}

.scroll-knot {
  font-size: 32px;
  margin-bottom: 4px;
}

.scroll-header h3 {
  font-size: 18px;
  color: white;
  margin: 0;
  font-weight: 600;
}

.scroll-content {
  padding: 24px;
}

.contract-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
  font-size: 16px;
  color: #ff6b9d;
  font-weight: 600;
}

.title-decoration {
  font-size: 20px;
  color: #ffb7c5;
}

.contract-body {
  margin-bottom: 24px;
}

.couple-avatars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
}

.avatar-wrapper {
  text-align: center;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 2px 12px rgba(255, 107, 157, 0.3);
}

.avatar-label {
  font-size: 12px;
  color: #5a5a7a;
  margin-top: 6px;
  font-weight: 500;
}

.love-heart {
  font-size: 32px;
  color: #ff6b9d;
  animation: heartbeat 1.5s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.contract-text {
  text-align: center;
  margin-bottom: 20px;
}

.contract-text p {
  font-size: 14px;
  color: #5a5a7a;
  line-height: 2;
  margin: 0;
}

.contract-details {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  padding: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 13px;
}

.detail-row:not(:last-child) {
  border-bottom: 1px dashed rgba(255, 107, 157, 0.3);
}

.detail-row .label {
  color: #8b7aa8;
  font-weight: 500;
}

.detail-row .value {
  color: #ff6b9d;
  font-weight: 600;
}

.contract-footer {
  text-align: center;
  padding-top: 16px;
  border-top: 2px dashed rgba(255, 107, 157, 0.3);
}

.seal {
  display: inline-block;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.2), rgba(255, 183, 197, 0.2));
  border: 3px solid #ffb7c5;
  animation: rotate 10s linear infinite;
}

.seal-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 12px;
  color: #ff6b9d;
  font-weight: 600;
  line-height: 1.4;
}

@keyframes rotate {
  to { transform: rotate(360deg); }
}
</style>

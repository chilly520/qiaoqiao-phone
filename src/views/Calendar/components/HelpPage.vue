<template>
  <div class="help-page">
    <!-- 头部导航 -->
    <div class="mobile-header">
      <button class="back-btn" @click="goBack">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>
      <h1 class="page-title">📖 使用帮助</h1>
      <div class="placeholder"></div>
    </div>

    <!-- 帮助内容 -->
    <div class="help-content">
      <div class="help-section">
        <div class="section-icon">📅</div>
        <h3>日历功能</h3>
        <ul>
          <li>点击日期查看详情和添加日程</li>
          <li>底部+按钮快速添加事件</li>
          <li>支持生理期、心情、睡眠记录</li>
          <li>左右滑动切换月份</li>
        </ul>
      </div>

      <div class="help-section">
        <div class="section-icon">📜</div>
        <h3>万年历</h3>
        <ul>
          <li>查询任意日期的农历信息</li>
          <li>查看八字、宜忌、时辰吉凶</li>
          <li>AI命理大师可详细解读</li>
          <li>支持1900-2100年日期查询</li>
        </ul>
      </div>

      <div class="help-section">
        <div class="section-icon">🌙</div>
        <h3>健康追踪</h3>
        <ul>
          <li>记录生理期周期，智能预测</li>
          <li>每日心情打卡，情绪管理</li>
          <li>睡眠记录与质量分析</li>
          <li>每日饮水打卡提醒</li>
        </ul>
      </div>

      <div class="help-section">
        <div class="section-icon">🤖</div>
        <h3>AI绑定</h3>
        <ul>
          <li>在"我的"页面绑定AI角色</li>
          <li>授权AI查看日程、生理期等</li>
          <li>AI会在对话中主动关心你</li>
          <li>命理大师AI可解读万年历</li>
        </ul>
      </div>

      <div class="help-section">
        <div class="section-icon">💡</div>
        <h3>小贴士</h3>
        <ul>
          <li>所有数据保存在本地，隐私安全</li>
          <li>可导出备份防止数据丢失</li>
          <li>万年历支持农历节气查询</li>
          <li>点击运势可查看详细解读</li>
        </ul>
      </div>

      <div class="help-section">
        <div class="section-icon">❓</div>
        <h3>常见问题</h3>
        <div class="faq-item">
          <strong>Q: 如何修改头像和昵称？</strong>
          <p>A: 在"我的"页面点击头像或昵称即可编辑。</p>
        </div>
        <div class="faq-item">
          <strong>Q: 数据会同步到云端吗？</strong>
          <p>A: 不会，所有数据仅保存在本地，请定期导出备份。</p>
        </div>
        <div class="faq-item">
          <strong>Q: 如何删除记录？</strong>
          <p>A: 长按或左滑相关记录项可删除。</p>
        </div>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="footer">
      <p>花间日历 v1.0.0</p>
      <p class="slogan">记录生活，珍藏时光</p>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goBack() {
  router.back()
}
</script>

<style scoped>
.help-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #fef9f6 0%, #fff5f7 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 头部导航 */
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 182, 193, 0.2);
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: #8b7aa8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0;
}

.placeholder {
  width: 40px;
}

/* 帮助内容 */
.help-content {
  padding: 16px;
}

.help-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(139, 122, 168, 0.08);
}

.section-icon {
  font-size: 28px;
  margin-bottom: 12px;
}

.help-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #5a5a7a;
  margin: 0 0 12px 0;
}

.help-section ul {
  margin: 0;
  padding-left: 20px;
  color: #8b7aa8;
}

.help-section li {
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 6px;
}

.help-section li:last-child {
  margin-bottom: 0;
}

/* FAQ样式 */
.faq-item {
  margin-bottom: 16px;
}

.faq-item:last-child {
  margin-bottom: 0;
}

.faq-item strong {
  display: block;
  font-size: 14px;
  color: #5a5a7a;
  margin-bottom: 6px;
}

.faq-item p {
  font-size: 13px;
  color: #8b7aa8;
  margin: 0;
  line-height: 1.6;
}

/* 底部 */
.footer {
  text-align: center;
  padding: 24px;
  color: #9a8fb8;
}

.footer p {
  margin: 0;
  font-size: 13px;
}

.footer .slogan {
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.8;
}
</style>

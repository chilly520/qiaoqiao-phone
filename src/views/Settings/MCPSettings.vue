<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'
import { useChatStore } from '@/stores/chatStore'
import { testMCPConnection, discoverMCPTools } from '@/utils/mcpService'

const router = useRouter()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()

const goBack = () => router.back()
const showAddForm = ref(false)
const editingServer = ref(null)
const testingId = ref(null)
const discoveringId = ref(null)
const toast = ref({ show: false, text: '', type: 'success' })

const formData = ref({
    name: '',
    url: '',
    transport: 'streamable'
})

function showToast(text, type = 'success') {
    toast.value = { show: true, text, type }
    setTimeout(() => { toast.value.show = false }, 2500)
}

function openAddForm() {
    formData.value = { name: '', url: '', transport: 'streamable' }
    editingServer.value = null
    showAddForm.value = true
}

function openEditForm(server) {
    formData.value = { ...server }
    editingServer.value = server.id
    showAddForm.value = true
}

function cancelForm() {
    showAddForm.value = false
    editingServer.value = null
}

function saveServer() {
    if (!formData.value.name.trim()) return showToast('请输入服务名称', 'error')
    if (!formData.value.url.trim()) return showToast('请输入服务地址', 'error')

    if (editingServer.value) {
        settingsStore.updateMCPServer(editingServer.value, { ...formData.value })
        showToast('MCP 服务已更新')
    } else {
        settingsStore.addMCPServer({ ...formData.value })
        showToast('MCP 服务已添加')
    }

    showAddForm.value = false
    editingServer.value = null
}

function deleteServer(id) {
    const server = settingsStore.mcpServers.find(s => s.id === id)
    const name = server?.name || 'MCP'
    chatStore.triggerConfirm('删除 MCP', `确定要删除「${name}」吗？`, () => {
        settingsStore.deleteMCPServer(id)
        showToast('MCP 服务已删除')
    })
}

function toggleServer(id) {
    settingsStore.toggleMCPServer(id)
}

async function testConnection(id) {
    testingId.value = id
    const result = await testMCPConnection(id)
    testingId.value = null
    showToast(result.success ? `连接成功！${result.toolCount} 个工具可用` : `连接失败: ${result.error}`, result.success ? 'success' : 'error')
}

async function discoverTools(id) {
    discoveringId.value = id
    const result = await discoverMCPTools(id)
    discoveringId.value = null
    showToast(result.error ? `获取失败: ${result.error}` : `获取到 ${result.tools?.length || 0} 个工具`, result.error ? 'error' : 'success')
}
</script>

<template>
    <div class="mcp-settings">
        <div class="mcp-header">
            <button class="back-btn" @click="goBack">←</button>
            <h2>MCP 服务管理</h2>
            <button class="add-btn" @click="openAddForm" v-if="!showAddForm">+ 添加</button>
        </div>

        <Transition name="slide">
            <div v-if="showAddForm" class="add-panel">
                <h3 class="panel-title">{{ editingServer ? '编辑 MCP' : '添加 MCP 服务' }}</h3>
                <div class="form-group">
                    <label>服务名称</label>
                    <input v-model="formData.name" placeholder="例如: Weather API" />
                </div>
                <div class="form-group">
                    <label>服务 URL</label>
                    <input v-model="formData.url" placeholder="http://localhost:3001" />
                </div>
                <div class="form-group">
                    <label>传输协议</label>
                    <select v-model="formData.transport">
                        <option value="streamable">Streamable HTTP</option>
                        <option value="sse">SSE</option>
                    </select>
                </div>
                <div class="form-buttons">
                    <button class="btn-cancel" @click="cancelForm">取消</button>
                    <button class="btn-save" @click="saveServer">
                        {{ editingServer ? '保存修改' : '添加服务' }}
                    </button>
                </div>
            </div>
        </Transition>

        <div class="server-list" v-if="settingsStore.mcpServers.length > 0">
            <div
                v-for="server in settingsStore.mcpServers"
                :key="server.id"
                class="server-card"
                :class="{ disabled: !server.enabled }"
            >
                <div class="server-top">
                    <div class="server-info">
                        <span class="server-name">{{ server.name }}</span>
                        <span class="server-url">{{ server.url }}</span>
                        <span class="server-transport">{{ server.transport }}</span>
                    </div>
                    <label class="toggle-switch">
                        <input
                            type="checkbox"
                            :checked="server.enabled"
                            @change="() => toggleServer(server.id)"
                        />
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="server-tools" v-if="server.tools && server.tools.length > 0">
                    <span class="tools-label">{{ server.tools.length }} 个工具:</span>
                    <span v-for="t in server.tools" :key="t.name" class="tool-tag">
                        {{ t.name }}<span v-if="t.description" class="tool-desc"> — {{ t.description.slice(0, 24) }}...</span>
                    </span>
                </div>
                <div class="server-tools empty" v-else>
                    <span class="tools-label">尚未获取工具列表</span>
                </div>

                <div class="server-actions">
                    <button
                        class="action-btn discover"
                        @click="discoverTools(server.id)"
                        :disabled="discoveringId === server.id"
                    >
                        {{ discoveringId === server.id ? '获取中...' : '获取工具' }}
                    </button>
                    <button
                        class="action-btn test"
                        @click="testConnection(server.id)"
                        :disabled="testingId === server.id"
                    >
                        {{ testingId === server.id ? '测试中...' : '测试连接' }}
                    </button>
                    <button class="action-btn edit" @click="openEditForm(server)">编辑</button>
                    <button class="action-btn del" @click="deleteServer(server.id)">删除</button>
                </div>
            </div>
        </div>

        <div class="empty-hint" v-else>
            <p>还没有配置 MCP 服务</p>
            <p class="sub-hint">MCP (Model Context Protocol) 可以让 AI 调用外部工具<br>例如查询天气、获取新闻、搜索数据等</p>
            <button class="add-first-btn" @click="openAddForm">+ 添加第一个 MCP</button>
        </div>

        <div class="tips-section">
            <h4>使用说明</h4>
            <ul>
                <li>MCP (Model Context Protocol) 是 AI 调用外部工具的协议</li>
                <li>添加的 MCP 服务工具会自动注入 AI 提示词</li>
                <li>AI 会通过 <code>[MCP:serverId:{"tool":"name","params":{}}]</code> 调用工具</li>
                <li>工具调用结果会自动反馈给 AI 继续对话</li>
                <li>示例 MCP 服务：天气查询、网页搜索、数据库查询等</li>
            </ul>
        </div>

        <Transition name="fade">
            <div v-if="toast.show" class="mcp-toast" :class="toast.type">
                {{ toast.text }}
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.mcp-settings {
    min-height: 100vh;
    background: var(--bg-primary, #f5f5f5);
    padding: 16px;
}

.mcp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0 16px;
    border-bottom: 1px solid var(--border-color, #e8e8e8);
    margin-bottom: 16px;
}

.mcp-header h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
    color: var(--text-primary, #333);
}

.back-btn {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    padding: 4px 8px;
    color: var(--text-secondary, #666);
}

.add-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 20px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
}

.add-btn:hover { opacity: 0.9; }

.add-panel {
    background: var(--card-bg, white);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.panel-title {
    font-size: 17px;
    font-weight: 600;
    margin: 0 0 16px;
    color: var(--text-primary, #333);
}

.form-group {
    margin-bottom: 14px;
}

.form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary, #666);
    margin-bottom: 6px;
}

.form-group input, .form-group select {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border-color, #ddd);
    border-radius: 10px;
    font-size: 14px;
    background: var(--input-bg, #fafafa);
    color: var(--text-primary, #333);
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.2s;
}

.form-group input:focus, .form-group select:focus {
    border-color: #667eea;
}

.form-buttons {
    display: flex;
    gap: 12px;
    margin-top: 18px;
}

.btn-cancel, .btn-save {
    flex: 1;
    padding: 11px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
}

.btn-cancel {
    background: var(--bg-secondary, #f0f0f0);
    color: var(--text-secondary, #666);
}

.btn-save {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.server-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.server-card {
    background: var(--card-bg, white);
    border-radius: 14px;
    padding: 16px;
    box-shadow: 0 1px 8px rgba(0,0,0,0.04);
    transition: opacity 0.2s;
}

.server-card.disabled { opacity: 0.55; }

.server-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 10px;
}

.server-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
}

.server-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #333);
}

.server-url {
    font-size: 12px;
    color: var(--text-tertiary, #999);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.server-transport {
    font-size: 11px;
    color: var(--accent, #667eea);
    font-weight: 500;
}

.toggle-switch {
    position: relative;
    width: 44px;
    height: 26px;
    flex-shrink: 0;
}

.toggle-switch input { display: none; }

.toggle-slider {
    position: absolute;
    inset: 0;
    background: #ddd;
    border-radius: 13px;
    cursor: pointer;
    transition: background 0.2s;
}

.toggle-slider::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.toggle-switch input:checked + .toggle-slider {
    background: #667eea;
}

.toggle-switch input:checked + .toggle-slider::after {
    transform: translateX(18px);
}

.server-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
    padding: 8px 10px;
    background: var(--bg-secondary, #f8f8f8);
    border-radius: 8px;
}

.server-tools.empty { background: none; padding: 4px 0; }

.tools-label {
    font-size: 12px;
    color: var(--text-tertiary, #999);
    width: 100%;
    margin-bottom: 2px;
}

.tool-tag {
    font-size: 12px;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--accent-alpha, rgba(102, 126, 234, 0.1));
    color: var(--accent, #667eea);
    margin: 2px;
}

.tool-desc {
    color: var(--text-tertiary, #999);
    font-size: 11px;
}

.server-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.action-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    font-weight: 500;
    transition: opacity 0.15s;
}

.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.action-btn.discover { background: #e8f0fe; color: #1a73e8; }
.action-btn.test { background: #e6f4ea; color: #1e8e3e; }
.action-btn.edit { background: #fff3e0; color: #e65100; }
.action-btn.del { background: #fce8e6; color: #d93025; }

.empty-hint {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary, #666);
}

.empty-hint p { margin: 0 0 6px; font-size: 15px; }
.sub-hint { font-size: 13px; line-height: 1.6; color: var(--text-tertiary, #999); }

.add-first-btn {
    margin-top: 20px;
    padding: 12px 32px;
    border: none;
    border-radius: 24px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
}

.tips-section {
    margin-top: 30px;
    padding: 20px;
    background: var(--card-bg, white);
    border-radius: 14px;
    box-shadow: 0 1px 8px rgba(0,0,0,0.04);
}

.tips-section h4 {
    margin: 0 0 12px;
    font-size: 15px;
    color: var(--text-primary, #333);
}

.tips-section ul {
    margin: 0;
    padding-left: 18px;
}

.tips-section li {
    font-size: 13px;
    line-height: 1.8;
    color: var(--text-secondary, #666);
}

.tips-section code {
    background: var(--bg-secondary, #f0f0f0);
    padding: 1px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
}

.mcp-toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 28px;
    border-radius: 12px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.mcp-toast.success { background: #52c41a; }
.mcp-toast.error { background: #ff4d4f; }

.slide-enter-active, .slide-leave-active {
    transition: all 0.25s ease;
}
.slide-enter-from, .slide-leave-to {
    opacity: 0;
    transform: translateY(-12px);
}

.fade-enter-active, .fade-leave-active {
    transition: opacity 0.25s;
}
.fade-enter-from, .fade-leave-to {
    opacity: 0;
}
</style>

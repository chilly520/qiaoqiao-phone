import { useSettingsStore } from '@/stores/settingsStore'

function getEnabledServers() {
    const store = useSettingsStore()
    return store.getEnabledMCPServers()
}

function escapeForPrompt(text) {
    return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function buildMCPPromptSection() {
    const servers = getEnabledServers()
    if (!servers.length) return ''

    const lines = ['', '【可用的 MCP 工具】']
    lines.push('你可以通过输出以下标签调用外部工具：')
    lines.push('[MCP:serverId:{"tool":"tool_name","params":{}}]')
    lines.push('')
    lines.push('当用户需要获取实时信息（天气、新闻等）或执行外部操作时，请使用 MCP 工具。')
    lines.push('')

    for (const server of servers) {
        lines.push(`--- ${server.name} (id: ${server.id}) ---`)
        lines.push(`URL: ${server.url}`)
        if (server.tools && server.tools.length > 0) {
            for (const tool of server.tools) {
                const desc = tool.description || ''
                const paramsDesc = tool.inputSchema?.properties
                    ? Object.entries(tool.inputSchema.properties)
                        .map(([k, v]) => `${k}: ${v.type || 'any'} ${v.description || ''}`)
                        .join(', ')
                    : ''
                lines.push(`  • ${tool.name}${desc ? ` — ${desc}` : ''}${paramsDesc ? ` (参数: ${paramsDesc})` : ''}`)
            }
        } else {
            lines.push('  工具列表尚未获取，请先使用默认工具名调用')
        }
        lines.push('')
    }

    return lines.join('\n')
}

export async function callMCPTool(serverId, toolName, params = {}) {
    const store = useSettingsStore()
    const server = store.mcpServers.find(s => s.id === serverId)
    if (!server) return { error: `MCP 服务不存在: ${serverId}` }
    if (!server.enabled) return { error: `MCP 服务未启用: ${server.name}` }

    const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
            name: toolName,
            arguments: params
        }
    }

    try {
        let response

        if (server.transport === 'stdio') {
            return { error: 'stdio 传输暂不支持（浏览器环境），请使用 sse 或 streamable' }
        }

        response = await fetch(server.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000)
        })

        if (!response.ok) {
            const text = await response.text()
            return { error: `MCP 请求失败 (${response.status}): ${text.slice(0, 200)}` }
        }

        const data = await response.json()

        if (data.error) {
            return { error: `MCP 调用错误: ${data.error.message || JSON.stringify(data.error)}` }
        }

        return { success: true, result: data.result }
    } catch (err) {
        return { error: `MCP 网络错误: ${err.message}` }
    }
}

export async function discoverMCPTools(serverId) {
    const store = useSettingsStore()
    const server = store.mcpServers.find(s => s.id === serverId)
    if (!server) return { error: 'MCP 服务不存在' }

    const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {}
    }

    try {
        if (server.transport === 'stdio') {
            return { error: 'stdio 传输暂不支持' }
        }

        const response = await fetch(server.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
        })

        if (!response.ok) {
            const text = await response.text()
            return { error: `请求失败 (${response.status}): ${text.slice(0, 200)}` }
        }

        const data = await response.json()

        if (data.error) {
            return { error: `错误: ${data.error.message || JSON.stringify(data.error)}` }
        }

        const tools = data.result?.tools || []
        store.updateMCPServer(serverId, { tools })
        return { success: true, tools }
    } catch (err) {
        return { error: `网络错误: ${err.message}` }
    }
}

export async function testMCPConnection(serverId) {
    const store = useSettingsStore()
    const server = store.mcpServers.find(s => s.id === serverId)
    if (!server) return { success: false, error: 'MCP 服务不存在' }

    const result = await discoverMCPTools(serverId)

    if (result.error) {
        return { success: false, error: result.error }
    }

    return { success: true, toolCount: result.tools?.length || 0 }
}

export function getAllMCPTools() {
    const servers = getEnabledServers()
    const tools = []
    for (const server of servers) {
        for (const tool of (server.tools || [])) {
            tools.push({ serverId: server.id, serverName: server.name, ...tool })
        }
    }
    return tools
}

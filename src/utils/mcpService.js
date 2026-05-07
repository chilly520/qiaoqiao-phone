import { useSettingsStore } from '@/stores/settingsStore'

const BUILTIN_PREFIX = '@builtin/'

// ===================== 内置工具定义 =====================
export const BUILTIN_SERVERS = [
    {
        id: '@builtin/calculator',
        name: '数学计算器',
        description: '执行数学运算，支持 + - * / 和三角函数、对数等',
        icon: '🔢',
        transport: 'builtin',
        tools: [{
            name: 'calc',
            description: '执行数学表达式计算',
            inputSchema: {
                type: 'object',
                properties: {
                    expression: { type: 'string', description: '数学表达式，如 "2+3*4" 或 "sin(0.5)+sqrt(9)"' }
                },
                required: ['expression']
            }
        }]
    },
    {
        id: '@builtin/datetime',
        name: '日期时间查询',
        description: '获取当前时间、日期、星期、时间戳等',
        icon: '📅',
        transport: 'builtin',
        tools: [{
            name: 'now',
            description: '获取当前日期时间信息',
            inputSchema: {
                type: 'object',
                properties: {
                    format: { type: 'string', description: '可选: "full"(完整) "date"(日期) "time"(时间) "weekday"(星期) "timestamp"(时间戳)' }
                }
            }
        }]
    },
    {
        id: '@builtin/random',
        name: '随机工具',
        description: '生成随机数、掷骰子、抽签、随机选择',
        icon: '🎲',
        transport: 'builtin',
        tools: [{
            name: 'rand',
            description: '生成随机数或随机选择',
            inputSchema: {
                type: 'object',
                properties: {
                    action: { type: 'string', description: '"number"(随机数) "dice"(掷骰子) "pick"(从列表选) "coin"(抛硬币)' },
                    min: { type: 'number', description: '最小值（number模式下）' },
                    max: { type: 'number', description: '最大值（number模式下）' },
                    options: { type: 'array', items: { type: 'string' }, description: '候选项列表（pick模式下）' }
                },
                required: ['action']
            }
        }]
    },
    {
        id: '@builtin/weather',
        name: '天气查询',
        description: '查询城市实时天气（免费API，无需密钥）',
        icon: '🌤️',
        transport: 'builtin',
        tools: [{
            name: 'query',
            description: '查询指定城市的当前天气',
            inputSchema: {
                type: 'object',
                properties: {
                    city: { type: 'string', description: '城市名称，如 "北京" "上海" "Tokyo"' }
                },
                required: ['city']
            }
        }]
    },
    {
        id: '@builtin/unit',
        name: '单位换算',
        description: '长度、重量、温度、货币等常用单位换算',
        icon: '📐',
        transport: 'builtin',
        tools: [{
            name: 'convert',
            description: '单位换算',
            inputSchema: {
                type: 'object',
                properties: {
                    value: { type: 'number', description: '要转换的数值' },
                    from: { type: 'string', description: '源单位，如 km, m, cm, kg, g, c, f, usd, cny, eur 等' },
                    to: { type: 'string', description: '目标单位' }
                },
                required: ['value', 'from', 'to']
            }
        }]
    },
    {
        id: '@builtin/encode',
        name: '编码转换',
        description: 'Base64编解码、URL编解码、MD5等',
        icon: '🔐',
        transport: 'builtin',
        tools: [{
            name: 'transform',
            description: '编码/解码转换',
            inputSchema: {
                type: 'object',
                properties: {
                    action: { type: 'string', description: '"base64_encode" "base64_decode" "url_encode" "url_decode"' },
                    text: { type: 'string', description: '要处理的内容' }
                },
                required: ['action', 'text']
            }
        }]
    }
]

function getBuiltinServer(id) {
    return BUILTIN_SERVERS.find(s => s.id === id)
}

export function getAllBuiltinServers() {
    return BUILTIN_SERVERS
}

export function isBuiltinServer(serverId) {
    return serverId && serverId.startsWith(BUILTIN_PREFIX)
}

function getEnabledBuiltinServers() {
    const store = useSettingsStore()
    return BUILTIN_SERVERS.filter(s => {
        const toggle = store.mcpBuiltinToggles[s.id]
        return toggle !== false // 默认开启
    })
}

function getEnabledExternalServers() {
    const store = useSettingsStore()
    return store.getEnabledMCPServers()
}

export function getEnabledServers() {
    return [...getEnabledBuiltinServers(), ...getEnabledExternalServers()]
}

// ===================== 内置工具执行 =====================

async function handleBuiltinCall(serverId, toolName, params) {
    const server = getBuiltinServer(serverId)
    if (!server) return { error: '内置工具不存在' }

    try {
        switch (serverId) {
            case '@builtin/calculator':
                return handleCalculator(params)
            case '@builtin/datetime':
                return handleDateTime(params)
            case '@builtin/random':
                return handleRandom(params)
            case '@builtin/weather':
                return await handleWeather(params)
            case '@builtin/unit':
                return handleUnit(params)
            case '@builtin/encode':
                return handleEncode(params)
            default:
                return { error: `未知内置工具: ${serverId}` }
        }
    } catch (err) {
        return { error: `内置工具执行错误: ${err.message}` }
    }
}

function handleCalculator(params) {
    const expr = String(params.expression || '').trim()
    if (!expr) return { error: '请提供数学表达式', result: null }

    const safeExpr = expr
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/pow/g, 'Math.pow')
        .replace(/log/g, 'Math.log')
        .replace(/abs/g, 'Math.abs')
        .replace(/PI/gi, 'Math.PI')
        .replace(/E(?![a-z])/gi, 'Math.E')
        .replace(/\^/g, '**')

    if (/[^0-9+\-*/().%\s,Math.sincotargplbfe]/.test(safeExpr.replace(/Math\.\w+/g, ''))) {
        return { error: '表达式包含不安全的字符，仅支持基本数学运算', result: null }
    }

    const result = Function(`"use strict"; return (${safeExpr})`)()
    return { success: true, result: { expression: expr, result } }
}

function handleDateTime(params) {
    const now = new Date()
    const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const format = params.format || 'full'

    const info = {
        iso: now.toISOString(),
        date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
        weekday: weeks[now.getDay()],
        timestamp: now.getTime(),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds()
    }

    const resultMap = {
        full: info,
        date: info.date,
        time: info.time,
        weekday: info.weekday,
        timestamp: info.timestamp
    }

    return { success: true, result: resultMap[format] || info }
}

function handleRandom(params) {
    const action = params.action || 'number'
    switch (action) {
        case 'number': {
            const min = params.min ?? 1
            const max = params.max ?? 100
            const num = Math.floor(Math.random() * (max - min + 1)) + min
            return { success: true, result: { action, min, max, value: num } }
        }
        case 'dice': {
            const sides = params.max || 6
            const count = params.count || 1
            const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
            return { success: true, result: { action, sides: `d${sides}`, rolls, total: rolls.reduce((a, b) => a + b, 0) } }
        }
        case 'coin': {
            const result = Math.random() < 0.5 ? '正面' : '反面'
            return { success: true, result: { action, result } }
        }
        case 'pick': {
            const options = params.options || []
            if (!options.length) return { error: '请提供候选项列表' }
            const picked = options[Math.floor(Math.random() * options.length)]
            return { success: true, result: { action, options, picked } }
        }
        default:
            return { error: `未知操作: ${action}` }
    }
}

async function handleWeather(params) {
    const city = String(params.city || '').trim()
    if (!city) return { error: '请输入城市名称' }

    try {
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`
        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
        if (!resp.ok) {
            return { error: `天气查询失败 (${resp.status})，请检查城市名称` }
        }
        const data = await resp.json()
        const current = data.current_condition?.[0]
        const today = data.weather?.[0]
        if (!current) return { error: `未找到「${city}」的天气数据` }

        return {
            success: true,
            result: {
                city,
                temperature: `${current.temp_C}°C`,
                feelsLike: `${current.FeelsLikeC}°C`,
                humidity: `${current.humidity}%`,
                weather: current.weatherDesc?.[0]?.value || '未知',
                wind: `${current.winddir16Point} ${current.windspeedKmph}km/h`,
                visibility: `${current.visibility}km`,
                maxTemp: today ? `${today.maxtempC}°C` : null,
                minTemp: today ? `${today.mintempC}°C` : null,
                source: 'wttr.in (免费天气)'
            }
        }
    } catch (err) {
        return { error: `天气查询网络错误: ${err.message}。请检查网络或尝试其他城市名（英文更稳定）` }
    }
}

function handleUnit(params) {
    const value = parseFloat(params.value)
    const from = String(params.from || '').toLowerCase().trim()
    const to = String(params.to || '').toLowerCase().trim()

    if (isNaN(value)) return { error: '请输入有效数值' }
    if (!from || !to) return { error: '请指定源单位和目标单位' }

    const rates = {
        length: {
            km: 1000, m: 1, cm: 0.01, mm: 0.001, mile: 1609.344, yard: 0.9144, foot: 0.3048, inch: 0.0254, 里: 500
        },
        weight: {
            kg: 1, g: 0.001, mg: 0.000001, t: 1000, lb: 0.453592, oz: 0.0283495, 斤: 0.5, 两: 0.05
        },
        temp: null,
        currency: { usd: 1, cny: 7.25, eur: 0.92, jpy: 155, gbp: 0.79, krw: 1360, hkd: 7.82 }
    }

    if (from === 'c' && to === 'f') return { success: true, result: { from: `${value}°C`, to: `${(value * 9 / 5 + 32).toFixed(1)}°F` } }
    if (from === 'f' && to === 'c') return { success: true, result: { from: `${value}°F`, to: `${((value - 32) * 5 / 9).toFixed(1)}°C` } }

    let found = false
    for (const [category, table] of Object.entries(rates)) {
        if (!table) continue
        if (table[from] !== undefined && table[to] !== undefined) {
            const inBase = value * table[from]
            const converted = inBase / table[to]
            return {
                success: true,
                result: { from: `${value} ${from}`, to: `${converted} ${to}`, category }
            }
        }
    }

    return { error: `暂不支持 ${from} → ${to} 的转换。支持: 长度(km/m/cm/mile/foot/inch)、重量(kg/g/t/lb/oz/斤)、温度(c↔f)` }
}

function handleEncode(params) {
    const action = String(params.action || '').trim()
    const text = String(params.text || '')

    if (!text) return { error: '请输入要处理的内容' }

    switch (action) {
        case 'base64_encode':
            return { success: true, result: { action, input: text.slice(0, 50) + (text.length > 50 ? '...' : ''), output: btoa(unescape(encodeURIComponent(text))) } }
        case 'base64_decode':
            try {
                return { success: true, result: { action, output: decodeURIComponent(escape(atob(text))) } }
            } catch {
                return { error: 'Base64 解码失败，请检查输入' }
            }
        case 'url_encode':
            return { success: true, result: { action, input: text, output: encodeURIComponent(text) } }
        case 'url_decode':
            try {
                return { success: true, result: { action, output: decodeURIComponent(text) } }
            } catch {
                return { error: 'URL 解码失败' }
            }
        default:
            return { error: '请指定操作: base64_encode / base64_decode / url_encode / url_decode' }
    }
}

// ===================== 统一调用入口 =====================

export async function callMCPTool(serverId, toolName, params = {}) {
    if (isBuiltinServer(serverId)) {
        return handleBuiltinCall(serverId, toolName, params)
    }

    const store = useSettingsStore()
    const server = store.mcpServers.find(s => s.id === serverId)
    if (!server) return { error: `MCP 服务不存在: ${serverId}` }
    if (!server.enabled) return { error: `MCP 服务未启用: ${server.name}` }

    const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: params }
    }

    try {
        if (server.transport === 'stdio') {
            return { error: 'stdio 传输暂不支持，请使用 sse 或 streamable' }
        }

        const response = await fetch(server.url, {
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
    if (isBuiltinServer(serverId)) {
        const server = getBuiltinServer(serverId)
        return { success: true, tools: server?.tools || [] }
    }

    const store = useSettingsStore()
    const server = store.mcpServers.find(s => s.id === serverId)
    if (!server) return { error: 'MCP 服务不存在' }

    const payload = { jsonrpc: '2.0', id: Date.now(), method: 'tools/list', params: {} }

    try {
        if (server.transport === 'stdio') return { error: 'stdio 传输暂不支持' }
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
        if (data.error) return { error: `错误: ${data.error.message || JSON.stringify(data.error)}` }
        const tools = data.result?.tools || []
        store.updateMCPServer(serverId, { tools })
        return { success: true, tools }
    } catch (err) {
        return { error: `网络错误: ${err.message}` }
    }
}

export async function testMCPConnection(serverId) {
    if (isBuiltinServer(serverId)) {
        const server = getBuiltinServer(serverId)
        return server
            ? { success: true, toolCount: server.tools?.length || 0 }
            : { success: false, error: '内置工具不存在' }
    }
    const result = await discoverMCPTools(serverId)
    return result.error
        ? { success: false, error: result.error }
        : { success: true, toolCount: result.tools?.length || 0 }
}

// ===================== AI Prompt 注入 =====================

export function buildMCPPromptSection() {
    const builtinServers = getEnabledBuiltinServers()
    const externalServers = getEnabledExternalServers()
    const allServers = [...builtinServers, ...externalServers]
    if (!allServers.length) return ''

    const lines = ['', '【可用的 MCP 工具（开箱即用，无需外部配置）】']
    lines.push('你可以通过输出以下标签调用工具：')
    lines.push('[MCP:serverId:{"tool":"tool_name","params":{...}}]')
    lines.push('')

    for (const server of allServers) {
        const isBuiltin = server.transport === 'builtin'
        const label = isBuiltin ? '📦 内置' : '🔗 外部'
        lines.push(`--- ${label} ${server.name} (id: ${server.id}) ---`)
        if (server.description) lines.push(`说明: ${server.description}`)

        const tools = server.tools || []
        for (const tool of tools) {
            const descParts = [tool.name]
            if (tool.description) descParts.push(`— ${tool.description}`)
            lines.push(`  • ${descParts.join(' ')}`)

            const props = tool.inputSchema?.properties
            if (props) {
                const paramDescs = Object.entries(props).map(([k, v]) => {
                    const required = tool.inputSchema?.required?.includes(k) ? '必填' : '可选'
                    return `    ${k} (${v.type || 'any'}, ${required}): ${v.description || ''}`
                })
                lines.push(...paramDescs)
            }
        }
        lines.push('')
    }

    lines.push('注意：')
    lines.push('- 内置工具无需网络配置，直接可用')
    lines.push('- 外部工具需先在「设置 → MCP 服务」中配置并测试连接')
    lines.push('- 工具调用结果会自动反馈给你，你可以基于结果继续回复用户')

    return lines.join('\n')
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

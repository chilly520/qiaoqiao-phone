import { useSettingsStore } from '@/stores/settingsStore'

const BUILTIN_PREFIX = '@builtin/'

// ===================== 内置 MCP 服务定义 =====================

const BUILTIN_SERVERS = [
    {
        id: '@builtin/web-search',
        name: '网页搜索',
        icon: '🔍',
        desc: '搜索互联网信息',
        tools: [
            {
                name: 'search',
                description: '在互联网上搜索信息，返回相关结果摘要和链接',
                parameters: {
                    query: { type: 'string', description: '搜索关键词', required: true },
                    max: { type: 'number', description: '最大结果数(1-10)，默认5' }
                }
            }
        ]
    },
    {
        id: '@builtin/web-fetch',
        name: '网页抓取',
        icon: '🌐',
        desc: '抓取任意网页内容',
        tools: [
            {
                name: 'fetch',
                description: '抓取指定URL的网页文本内容',
                parameters: {
                    url: { type: 'string', description: '要抓取的网页地址', required: true }
                }
            }
        ]
    },
    {
        id: '@builtin/translate',
        name: '翻译',
        icon: '🌍',
        desc: '多语言翻译',
        tools: [
            {
                name: 'translate',
                description: '将文本翻译为指定语言。from: 源语言代码(可选), to: 目标语言代码 如 zh/en/ja/ko/fr/de/es',
                parameters: {
                    text: { type: 'string', description: '要翻译的文本', required: true },
                    to: { type: 'string', description: '目标语言代码 如zh/en/ja/ko', required: true },
                    from: { type: 'string', description: '源语言代码(可选，自动检测)' }
                }
            }
        ]
    },
    {
        id: '@builtin/weather',
        name: '天气查询',
        icon: '🌤️',
        desc: '全球实时天气',
        tools: [
            {
                name: 'get_weather',
                description: '查询任意城市的实时天气（支持中文城市名）',
                parameters: {
                    city: { type: 'string', description: '城市名称，如"北京" "Tokyo" "London"', required: true }
                }
            }
        ]
    },
    {
        id: '@builtin/location',
        name: 'IP定位',
        icon: '📍',
        desc: 'IP归属地 / 城市定位',
        tools: [
            {
                name: 'locate',
                description: '根据IP地址或城市名查询地理位置信息',
                parameters: {
                    ip: { type: 'string', description: 'IP地址(可选，默认当前)，或城市名' }
                }
            }
        ]
    },
    {
        id: '@builtin/exchange',
        name: '汇率换算',
        icon: '💱',
        desc: '实时货币汇率',
        tools: [
            {
                name: 'convert',
                description: '查询实时汇率并换算金额',
                parameters: {
                    amount: { type: 'number', description: '金额', required: true },
                    from: { type: 'string', description: '源货币代码 如USD/CNY/EUR/JPY', required: true },
                    to: { type: 'string', description: '目标货币代码', required: true }
                }
            }
        ]
    },
    {
        id: '@builtin/news',
        name: '新闻头条',
        icon: '📰',
        desc: '实时新闻摘要',
        tools: [
            {
                name: 'headlines',
                description: '获取最新新闻头条',
                parameters: {
                    category: { type: 'string', description: '分类: general/technology/business/sports/entertainment/health/science' },
                    country: { type: 'string', description: '国家代码 如cn/us/jp/kr，默认cn' }
                }
            }
        ]
    },
    {
        id: '@builtin/calculator',
        name: '科学计算器',
        icon: '🔢',
        desc: '数学计算 / 科学运算',
        tools: [
            {
                name: 'calc',
                description: '执行数学表达式计算，支持 +-*/%**、三角函数/对数/开方等',
                parameters: {
                    expression: { type: 'string', description: '数学表达式，如"(100+50)*0.8"', required: true }
                }
            }
        ]
    },
    {
        id: '@builtin/datetime',
        name: '日期时间',
        icon: '📅',
        desc: '日期时间 / 时区转换',
        tools: [
            {
                name: 'query',
                description: '查询当前日期时间或进行时区转换',
                parameters: {
                    timezone: { type: 'string', description: '时区 如Asia/Shanghai America/New_York(可选)' },
                    action: { type: 'string', description: '操作: now/convert/weekday/timestamp' }
                }
            }
        ]
    },
    {
        id: '@builtin/dictionary',
        name: '英语词典',
        icon: '📖',
        desc: '英文单词查询',
        tools: [
            {
                name: 'lookup',
                description: '查询英文单词的定义、发音、例句',
                parameters: {
                    word: { type: 'string', description: '要查询的英文单词', required: true }
                }
            }
        ]
    },
    {
        id: '@builtin/qrcode',
        name: '二维码生成',
        icon: '📱',
        desc: '生成二维码图片',
        tools: [
            {
                name: 'generate',
                description: '生成二维码图片链接',
                parameters: {
                    data: { type: 'string', description: '要编码的内容(URL/文本)', required: true },
                    size: { type: 'number', description: '尺寸(像素)，默认200' }
                }
            }
        ]
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
    switch (serverId) {
        case '@builtin/web-search': return handleWebSearch(params)
        case '@builtin/web-fetch': return handleWebFetch(params)
        case '@builtin/translate': return handleTranslate(params)
        case '@builtin/weather': return handleWeather(params)
        case '@builtin/location': return handleLocation(params)
        case '@builtin/exchange': return handleExchange(params)
        case '@builtin/news': return handleNews(params)
        case '@builtin/calculator': return handleCalculator(params)
        case '@builtin/datetime': return handleDatetime(params)
        case '@builtin/dictionary': return handleDictionary(params)
        case '@builtin/qrcode': return handleQrcode(params)
        default: return { error: '未知内置工具' }
    }
}

const handleWebSearch = async (p) => {
    const q = String(p.query || '').trim()
    if (!q) return { error: '请输入搜索关键词' }
    const max = Math.min(parseInt(p.max) || 5, 10)
    try {
        const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`
        const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
        const html = await r.text()
        const results = []
        const linkRe = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
        const descRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi
        let m
        const links = []
        while ((m = linkRe.exec(html)) !== null && links.length < max * 2) {
            const href = m[1], title = m[2].replace(/<[^>]+>/g, '').trim()
            if ((href.startsWith('//') || href.startsWith('http')) && title && !title.includes('>')) {
                links.push({ href: href.startsWith('//') ? 'https:' + href : href, title })
            }
        }
        const descs = []
        while ((m = descRe.exec(html)) !== null && descs.length < max) {
            descs.push(m[1].replace(/<[^>]+>/g, '').trim())
        }
        for (let i = 0; i < Math.min(links.length, max); i++) {
            results.push({ title: links[i].title, url: links[i].href, snippet: descs[i] || '' })
        }
        return { success: true, query: q, results, source: 'DuckDuckGo Lite' }
    } catch (e) {
        return { error: `搜索失败: ${e.message}` }
    }
}

const handleWebFetch = async (p) => {
    const url = String(p.url || '').trim()
    if (!url) return { error: '请输入URL' }
    try {
        const finalUrl = url.startsWith('http') ? url : 'https://' + url
        const r = await fetch(finalUrl, { signal: AbortSignal.timeout(15000) })
        const text = await r.text()
        const stripped = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, '\n').trim().slice(0, 3000)
        return { success: true, url: finalUrl, text: stripped, length: stripped.length }
    } catch (e) {
        return { error: `抓取失败: ${e.message}` }
    }
}

const handleTranslate = async (p) => {
    const text = String(p.text || '').trim()
    const to = String(p.to || '').trim()
    if (!text || !to) return { error: '请输入文本和目标语言代码' }
    try {
        const langPair = (p.from ? p.from + '|' : '') + to
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`, { signal: AbortSignal.timeout(10000) })
        const d = await r.json()
        if (d.responseStatus === 200) return { success: true, original: text.slice(0, 200), translated: d.responseData.translatedText, from: p.from || 'auto', to }
        return { error: `翻译失败: ${d.responseStatus}` }
    } catch (e) {
        return { error: `翻译请求失败: ${e.message}` }
    }
}

const handleWeather = async (p) => {
    const city = String(p.city || '').trim()
    if (!city) return { error: '请输入城市名称' }
    try {
        const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
        if (!r.ok) return { error: `天气查询失败(${r.status})` }
        const d = await r.json()
        const cur = d.current_condition?.[0], today = d.weather?.[0]
        if (!cur) return { error: `未找到「${city}」的天气数据` }
        return {
            success: true,
            result: {
                city, temperature: `${cur.temp_C}°C`, feelsLike: `${cur.FeelsLikeC}°C`,
                humidity: `${cur.humidity}%`, weather: cur.weatherDesc?.[0]?.value || '未知',
                wind: `${cur.winddir16Point} ${cur.windspeedKmph}km/h`,
                maxTemp: today ? `${today.maxtempC}°C` : null, minTemp: today ? `${today.mintempC}°C` : null
            }
        }
    } catch (e) {
        return { error: `天气查询网络错误: ${e.message}` }
    }
}

const handleLocation = async (p) => {
    const ip = String(p.ip || '').trim()
    try {
        const r = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN&fields=country,city,regionName,lat,lon,timezone,isp,org`, { signal: AbortSignal.timeout(8000) })
        const d = await r.json()
        if (d.status === 'fail') return { error: `定位失败: ${d.message}` }
        return { success: true, result: { ip: d.query, country: d.country, region: d.regionName, city: d.city, lat: d.lat, lon: d.lon, timezone: d.timezone, isp: d.isp } }
    } catch (e) {
        return { error: `定位失败: ${e.message}` }
    }
}

const handleExchange = async (p) => {
    const amount = parseFloat(p.amount), from = String(p.from || '').toUpperCase().trim(), to = String(p.to || '').toUpperCase().trim()
    if (isNaN(amount) || !from || !to) return { error: '请输入金额和货币代码' }
    try {
        const r = await fetch(`https://open.er-api.com/v6/latest/${from}`, { signal: AbortSignal.timeout(10000) })
        const d = await r.json()
        if (d.result !== 'success') return { error: '汇率查询失败' }
        const rate = d.rates[to]
        if (!rate) return { error: `不支持的货币代码: ${to}` }
        return { success: true, result: { amount, from, to, rate, converted: +(amount * rate).toFixed(2), updated: d.time_last_update_utc } }
    } catch (e) {
        return { error: `汇率查询失败: ${e.message}` }
    }
}

const handleNews = async (p) => {
    const country = String(p.country || 'cn').toLowerCase().trim()
    const cat = String(p.category || 'general').toLowerCase().trim()
    try {
        const r = await fetch(`https://newsdata.io/api/1/news?apikey=pub_508120bcb16dd64ff929c2d8f5b6b556e6e44&country=${country}&language=zh&category=${cat}`, { signal: AbortSignal.timeout(10000) })
        const d = await r.json()
        const articles = (d.results || []).slice(0, 6).map(a => ({ title: a.title, source: a.source_id, url: a.link, published: a.pubDate }))
        return { success: true, category: cat, country, articles, count: articles.length }
    } catch (e) {
        return { error: `新闻获取失败，请稍后再试` }
    }
}

const handleCalculator = (p) => {
    let expr = String(p.expression || '').trim()
    if (!expr) return { error: '请输入数学表达式' }
    try {
        const safe = expr.replace(/\^/g, '**').replace(/÷/g, '/').replace(/×/g, '*').replace(/x/gi, '*').replace(/sin/gi, 'Math.sin').replace(/cos/gi, 'Math.cos').replace(/tan/gi, 'Math.tan').replace(/log10/gi, 'Math.log10').replace(/log2/gi, 'Math.log2').replace(/log(?![\d])/gi, 'Math.log').replace(/sqrt/gi, 'Math.sqrt').replace(/abs/gi, 'Math.abs').replace(/ceil/gi, 'Math.ceil').replace(/floor/gi, 'Math.floor').replace(/round/gi, 'Math.round').replace(/pow/gi, 'Math.pow').replace(/exp/gi, 'Math.exp').replace(/PI/gi, 'Math.PI')
        const fn = new Function('Math', `"use strict"; return (${safe})`)
        const result = fn(Math)
        return { success: true, result: { expression: expr, result: Number(result.toFixed(10)) } }
    } catch (e) {
        return { error: `计算错误: ${e.message}` }
    }
}

const handleDatetime = (p) => {
    try {
        const now = new Date(), pad = n => String(n).padStart(2, '0')
        return {
            success: true,
            result: {
                iso: now.toISOString(),
                date: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
                time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
                weekday: ['周日','周一','周二','周三','周四','周五','周六'][now.getDay()],
                timestamp: Math.floor(now.getTime() / 1000),
                year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate()
            }
        }
    } catch (e) {
        return { error: `时间查询错误: ${e.message}` }
    }
}

const handleDictionary = async (p) => {
    const word = String(p.word || '').trim()
    if (!word) return { error: '请输入英文单词' }
    try {
        const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(8000) })
        const d = await r.json()
        if (!Array.isArray(d) || !d.length) return { error: `未找到「${word}」的定义` }
        const entry = d[0]
        const phonetic = entry.phonetic || (entry.phonetics?.[0]?.text) || ''
        const meanings = entry.meanings?.slice(0, 3).map(m => ({
            partOfSpeech: m.partOfSpeech,
            definitions: m.definitions?.slice(0, 3).map(def => ({ definition: def.definition, example: def.example || '' }))
        }))
        return { success: true, result: { word, phonetic, meanings } }
    } catch (e) {
        return { error: `词典查询失败: ${e.message}` }
    }
}

const handleQrcode = (p) => {
    const data = String(p.data || '').trim()
    if (!data) return { error: '请输入要编码的内容' }
    const size = parseInt(p.size) || 200
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`
    return { success: true, result: { data: data.slice(0, 100), size, qrcode_url: url } }
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

export function buildMCPPromptSection(enabledServerIds = null) {
    const builtinServers = getEnabledBuiltinServers()
    const externalServers = getEnabledExternalServers()
    let allServers = [...builtinServers, ...externalServers]
    if (!allServers.length) return ''

    if (enabledServerIds !== null && Array.isArray(enabledServerIds) && enabledServerIds.length > 0) {
        allServers = allServers.filter(s => enabledServerIds.includes(s.id))
        if (!allServers.length) return ''
    }

    const lines = ['', '【可用的 MCP 工具（开箱即用，无需外部配置）】']
    lines.push('你可以通过输出以下标签调用工具：')
    lines.push('[MCP:serverId:{"tool":"tool_name","params":{...}}]')
    lines.push('')

    for (const server of allServers) {
        const builtin = isBuiltinServer(server.id)
        const label = builtin ? '📦 内置' : '🔗 外部'
        lines.push(`--- ${label} ${server.name} (id: ${server.id}) ---`)
        if (server.desc || server.description) lines.push(`说明: ${server.desc || server.description}`)

        const tools = server.tools || []
        for (const tool of tools) {
            const descParts = [tool.name]
            if (tool.description) descParts.push(`— ${tool.description}`)
            lines.push(`  • ${descParts.join(' ')}`)

            const params = tool.parameters
            if (params) {
                for (const [k, v] of Object.entries(params)) {
                    const required = v.required ? '必填' : '可选'
                    lines.push(`    ${k} (${v.type || 'any'}, ${required}): ${v.description || ''}`)
                }
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

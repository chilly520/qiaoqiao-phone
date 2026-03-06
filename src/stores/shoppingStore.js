import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useWalletStore } from './walletStore'
import { useSettingsStore } from './settingsStore'
import { useChatStore } from './chatStore'
import { useBackpackStore } from './backpackStore'
import { generateReply } from '../utils/aiService'

export const useShoppingStore = defineStore('shopping', () => {
    const walletStore = useWalletStore()
    const settingsStore = useSettingsStore()
    const chatStore = useChatStore()
    const backpackStore = useBackpackStore()

    // ============ State ============
    const products = ref([])
    const cart = ref([])
    const orders = ref([])
    const logistics = ref([])
    const chatMessages = ref({}) // 按店铺 ID 分组的消息 { shopId: [] }
    const activeShopId = ref('platform') // 当前对话的店铺

    // 用户扩容数据
    const addresses = ref([
        { id: 'addr_1', name: '乔乔', phone: '138****8888', region: '广东省 深圳市 宝安区', detail: 'xx街道xx大厦 888室', isDefault: true }
    ])
    const favorites = ref([]) // 商品 ID 列表
    const footprints = ref([]) // 最近浏览商品 ID 列表
    const coupons = ref([
        { id: 'cp_1', title: '新人全场通用券', amount: 50, minAmount: 500, status: 'active' },
        { id: 'cp_2', title: '数码分类特惠', amount: 30, minAmount: 200, status: 'active' }
    ])
    const subscribedShops = ref([]) // 订阅店铺列表 { name, icon, fans, products }
    const points = ref(1250)
    const reviews = ref({}) // { productId: [ { user, content, rating, images, time } ] }

    // ============ Logistics Data ============
    
    // 真实城市列表
    const realCities = [
        '北京', '上海', '广州', '深圳', '杭州', '南京', '武汉', '成都',
        '重庆', '西安', '苏州', '郑州', '长沙', '青岛', '宁波', '天津',
        '东莞', '佛山', '合肥', '福州', '昆明', '南昌', '贵阳', '南宁',
        '石家庄', '太原', '沈阳', '大连', '哈尔滨', '长春', '济南',
        '厦门', '温州', '无锡', '常州', '珠海', '中山', '惠州', '烟台'
    ]

    // 虚拟城市列表（现实中不存在）
    const fantasyCities = [
        '云梦泽', '青鸾城', '琉璃境', '紫霄城', '蓬莱岛',
        '苍穹城', '星辰海', '幻月城', '碧水湾', '青云镇',
        '落霞城', '飞雪城', '听雨镇', '望海城', '紫竹苑',
        '金鳞城', '玉兔镇', '银龙堡', '翡翠谷', '水晶宫',
        '火焰山', '寒冰潭', '雷霆谷', '光明顶', '黑暗森林',
        '迷雾沼泽', '翡翠森林', '黄金海岸', '白银峡谷', '钻石山峰',
        '桃花岛', '杏花村', '荷花淀', '梅花镇', '桂花苑',
        '兰花谷', '菊花台', '牡丹园', '水仙阁', '茉莉小镇'
    ]

    // 当前使用的城市列表（根据设置切换）
    const useFantasyCities = ref(false) // 是否使用虚拟城市

    // 获取当前城市列表
    const getCurrentCities = () => {
        return useFantasyCities.value ? fantasyCities : realCities
    }

    // 切换城市类型
    const toggleFantasyCities = () => {
        useFantasyCities.value = !useFantasyCities.value
        saveStore()
        return useFantasyCities.value
    }

    // 虚拟地点类型
    const locationTypes = {
        origin: ['华南仓', '华东仓', '华北仓', '西南仓', '华中仓', '东北仓'],
        sorting: ['分拣中心', '转运中心', '集散中心', '物流园'],
        delivery: ['配送站', '营业点', '服务部', '快递点'],
        landmark: ['机场', '高铁站', '港口', '高速路口']
    }

    // 生成随机地点名称
    const generateLocationName = (type, city) => {
        const types = locationTypes[type] || locationTypes.origin
        const randomType = types[Math.floor(Math.random() * types.length)]
        
        if (type === 'origin') {
            return `${city}${randomType}`
        } else if (type === 'sorting') {
            return `${city}${randomType}`
        } else if (type === 'delivery') {
            const districts = ['朝阳区', '海淀区', '天河区', '南山区', '浦东新区', '福田区']
            const district = districts[Math.floor(Math.random() * districts.length)]
            return `${city}${district}${randomType}`
        } else if (type === 'landmark') {
            return `${city}${randomType}`
        }
        return city
    }

    // 生成随机时间（过去某个时间点到未来）
    const generateRandomTime = (baseTime, offsetMinutes) => {
        const randomOffset = Math.floor(Math.random() * offsetMinutes * 2) - offsetMinutes
        return new Date(baseTime.getTime() + randomOffset * 60 * 1000)
    }

    // 生成物流描述
    const generateLogisticsDesc = (status, isHastened) => {
        const descriptions = {
            picked: [
                '快递员已上门揽收，包裹正在前往分拣中心',
                '您的包裹已揽收，我们将尽快为您安排运输',
                '包裹已成功揽收，开始物流之旅'
            ],
            shipping: [
                '包裹已装车，正在发往目的地',
                '您的包裹正在运输途中',
                '快件已发出，正在快速运输中'
            ],
            delivering: [
                '快递员正在派送您的包裹，请保持电话畅通',
                '您的包裹正在派送中，请注意接听电话',
                '快递员已出发，即将为您送达'
            ],
            delivered: [
                '您的包裹已签收，感谢使用顺丰速运',
                '包裹已成功送达，期待您的再次光临',
                '签收成功，感谢您的信任与支持'
            ]
        }
        
        const descs = descriptions[status] || descriptions.picked
        const baseDesc = descs[Math.floor(Math.random() * descs.length)]
        
        if (isHastened) {
            return `【极速达】${baseDesc}`
        }
        return baseDesc
    }

    const currentCategory = ref('all')
    const searchQuery = ref('')
    const loading = ref(false)
    const currentView = ref('home')

    // ============ Getters ============
    const categories = computed(() => [
        { id: 'all', name: '全部', icon: '🏠' },
        { id: 'digital', name: '数码', icon: '📱' },
        { id: 'clothing', name: '服饰', icon: '👕' },
        { id: 'food', name: '美食', icon: '🍔' },
        { id: 'home', name: '家居', icon: '🏡' },
        { id: 'beauty', name: '美妆', icon: '💄' },
        { id: 'luxury', name: '奢侈品', icon: '✨' }
    ])

    const currentUser = computed(() => {
        const profile = settingsStore.personalization?.userProfile || {}
        return {
            name: profile.name || '购物达人',
            avatar: profile.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
            balance: walletStore.balance
        }
    })

    const filteredProducts = computed(() => {
        let result = products.value
        if (currentCategory.value !== 'all') {
            result = result.filter(p => p.category === currentCategory.value)
        }
        if (searchQuery.value) {
            result = result.filter(p =>
                p.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                p.description.toLowerCase().includes(searchQuery.value.toLowerCase())
            )
        }
        return result
    })

    const cartCount = computed(() => cart.value.reduce((sum, item) => sum + item.quantity, 0))
    const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + (item.price * item.quantity), 0))
    const pendingOrders = computed(() => orders.value.filter(o => o.status !== 'completed'))

    // ============ AI Actions ============

    // 搜索或点击分类时触发 AI 生成商品
    const generateProductsAI = async (query, category = null) => {
        if (loading.value) return
        loading.value = true
        try {
            const count = Math.floor(Math.random() * 5) + 4 // 4-8 个
            const prompt = `你是一个有个性的电商后台。根据 搜索词:"${query || '热门'}" 和 分类:"${category || '推荐'}"，生成 ${count} 个深度模拟的商品 JSON 数组。
            要求：
            1. 字段：id, title, description, price, originalPrice, category, shop, shopPersonality(店铺性格), tags, rating, sales, imagePrompt(英文，用于生图)。
            2. 【关键】价格多样性：必须包含 specs 数组，如 specs: [{ name: "标准版", price: 100 }, { name: "旗舰版", price: 180 }]。不同规格的价格不能相同。
            3. 评价注入：为生成的【每一个】商品生成 3-5 条真实评价，放在 reviews 字段里。评价内容要有生活气息，别老是夸，要有点真实的槽点。
            4. imagePrompt 要求：详细描述商品的视觉特征，如材质、光影、构图等。
            5. 店铺性格：不同店铺的店主性格要分化，描述商品时也要体现。
            6. 严格返回 JSON 数组格式。`

            const messages = [{ role: 'user', content: prompt }]
            const char = { name: '商品系统', prompt: '你只输出符合要求的 JSON 数组。不要文字废话。' }

            const result = await generateReply(messages, char, null, { isSimpleTask: true })
            const cleanContent = result.content.replace(/```json|```/g, '').trim()
            const newProducts = JSON.parse(cleanContent)

            // 处理生成结果
            const processedItems = await Promise.all(newProducts.map(async p => {
                // 如果 AI 没给 ID，我们手动补一个
                if (!p.id) p.id = 'prod_' + Math.random().toString(36).slice(2, 9)

                // FIX: 使用 draw 指令调用自定义生图 API，而不是直接调用 generateImage
                // 通过在 chatStore 中注册 DRAW 指令处理器来实现
                if (p.imagePrompt) {
                    try {
                        // 创建一个临时的消息对象来触发 DRAW 指令
                        const drawInstruction = `[DRAW: ${p.imagePrompt}]`
                        // 直接调用 generateImage，但会通过 settingsStore.drawing 配置使用自定义 API
                        const { generateImage } = await import('../utils/aiService')
                        p.image = await generateImage(p.imagePrompt, { width: 600, height: 600 });
                        console.log(`[Shopping] Generated image for product ${p.id} using custom drawing API`)
                    } catch (err) {
                        console.error(`[Shopping] Image generation failed for ${p.id}:`, err)
                        p.image = `https://pollinations.ai/p/${encodeURIComponent(p.imagePrompt)}?width=600&height=600&seed=${Math.random()}`;
                    }
                }

                // 自动注入评价到全局 review store
                if (p.reviews) {
                    // 确保评价字段统一
                    const normalizedReviews = (Array.isArray(p.reviews) ? p.reviews : []).map(r => ({
                        user: r.user || r.用户 || '匿名用户',
                        content: r.content || r.text || r.评价 || '',
                        rating: r.rating || r.评分 || 5,
                        images: r.images || [],
                        time: r.time || '刚刚'
                    }))
                    reviews.value[p.id] = normalizedReviews
                    // 数据清理，不把 reviews 存在 products 里以免冗余
                    const { reviews: r, ...rest } = p
                    if (!products.value.find(existing => existing.id === rest.id)) {
                        products.value.unshift(rest)
                    }
                } else {
                    if (!products.value.find(existing => existing.id === p.id)) {
                        products.value.unshift(p)
                    }
                }
                return p;
            }))

            saveStore()
        } catch (e) {
            console.error('AI Product Generation Failed:', e)
            if (products.value.length === 0) generateSampleProducts()
        } finally {
            loading.value = false
        }
    }

    // 生成 AI 评价和晒图
    const generateReviewsAI = async (product, force = false) => {
        if (!force && reviews.value[product.id] && reviews.value[product.id].length > 0) {
            console.log('评价已存在，跳过生成')
            return
        }

        loading.value = true
        try {
            // 使用更强制的提示词
            const prompt = `你是一个电商评价生成器。为商品"${product.title}"生成 4-6 条真实评价。

【输出要求】
1. 必须且只能输出 JSON 数组，不要任何其他文字
2. 格式：[{"user":"昵称","content":"评价","rating":5,"imagePrompt":"英文描述","time":"刚刚"}]
3. 每个评价必须包含：user(中文昵称), content(评价内容), rating(1-5 数字)

【评价风格】
- 真实感爆棚，有生活气息
- 包括收货晒图、使用感受、槽点等
- 昵称要真实，如"小明同学"、"购物达人李"

现在直接输出 JSON 数组：`

            console.log('开始生成评价，商品:', product.title)
            const result = await generateReply(
                [{ role: 'user', content: prompt }], 
                { name: '评价助手', prompt: '专业生成电商评价' },
                null, 
                { isSimpleTask: true }
            )
            let cleanContent = result.content.trim()
            
            console.log('AI 原始返回:', cleanContent)
            
            // 提取 JSON 数组
            const jsonMatch = cleanContent.match(/\[[\s\S]*\]/)
            if (!jsonMatch) {
                console.error('No JSON array found in response:', cleanContent)
                throw new Error('AI 返回的不是 JSON 数组')
            }
            cleanContent = jsonMatch[0]
            
            console.log('提取的 JSON:', cleanContent)
            
            const parsed = JSON.parse(cleanContent)
            console.log('解析后的评价:', parsed)

            // 处理评价
            const processedReviews = parsed.map(r => {
                const review = {
                    user: r.user || '匿名用户',
                    content: r.content || '暂无评价内容',
                    rating: parseInt(r.rating) || 5,
                    time: r.time || '刚刚',
                    images: []
                }
                console.log('处理后的评价:', review)
                return review
            })

            if (force && reviews.value[product.id]) {
                reviews.value[product.id] = [...processedReviews, ...reviews.value[product.id].slice(0, 5)]
            } else {
                reviews.value[product.id] = processedReviews
            }
            saveStore()
            console.log('评价生成成功，总数:', reviews.value[product.id].length)
        } catch (e) {
            console.error('AI Review Generation Failed:', e)
            console.log('使用默认评价')
            // 生成默认评价
            reviews.value[product.id] = [
                { user: '购物达人', content: '质量很好，物流很快！', rating: 5, time: '刚刚', images: [] },
                { user: '小明同学', content: '包装很用心，产品也不错', rating: 5, time: '昨天', images: [] },
                { user: '爱购物的猫', content: '性价比很高，推荐购买', rating: 4, time: '3 天前', images: [] }
            ]
            console.log('默认评价:', reviews.value[product.id])
        } finally {
            loading.value = false
        }
    }

    // 发送用户消息 (仅存入列表)
    const sendMessage = (shopId, content) => {
        if (!chatMessages.value[shopId]) chatMessages.value[shopId] = []
        chatMessages.value[shopId].push({
            id: Date.now(),
            type: 'user',
            content,
            timestamp: new Date().toISOString(),
            sender: { name: currentUser.value.name, avatar: currentUser.value.avatar }
        })
        saveStore()
    }

    // AI 客服触发回复 - 进阶版：支持改价、发券、推销
    const triggerAIReply = async (shopName) => {
        if (loading.value) return
        const shopId = shopName
        const shopMsgs = chatMessages.value[shopId] || []
        if (shopMsgs.length === 0) return

        const shopProducts = products.value.filter(p => p.shop === shopName)
        const sampleProduct = shopProducts[0] || {}

        const char = {
            name: shopName,
            prompt: `你是 "${shopName}" 的官方客服。
            性格特征: ${sampleProduct.shopPersonality || '热情专业'}。
            你可以执行以下指令（在回复中以 [COMMAND:XXX] 格式体现）：
            1. 改价：[COMMAND:CHANGE_PRICE:金额] (仅针对最近一个订单或商品)
            2. 发券：[COMMAND:GIVE_COUPON:金额:门槛]
            3. 推荐：[COMMAND:RECOMMEND:商品ID]
            根据用户的语气决定你的态度，如果用户找茬，你可以回怼或阴阳怪气；如果用户诚心买，可以给优惠。`
        }

        loading.value = true
        try {
            const history = shopMsgs.slice(-15).map(m => ({
                role: m.type === 'user' ? 'user' : 'assistant',
                content: m.content
            }))

            const result = await generateReply(history, char, null, { isSimpleTask: true })
            let finalContent = result.content

            // 处理指令解析
            if (finalContent.includes('[COMMAND:CHANGE_PRICE:')) {
                const price = finalContent.match(/CHANGE_PRICE:(\d+)/)?.[1]
                if (price) finalContent += `\n\n(系统消息：客服已将价格修改为 ¥${price})`
            }
            if (finalContent.includes('[COMMAND:GIVE_COUPON:')) {
                const [_, amt, min] = finalContent.match(/GIVE_COUPON:(\d+):(\d+)/) || []
                if (amt) {
                    coupons.value.push({ id: `cp_${Date.now()}`, title: `${shopName}专享券`, amount: Number(amt), minAmount: Number(min), status: 'active' })
                    finalContent += `\n\n(系统消息：获得一张 ¥${amt} 优惠券)`
                }
            }

            chatMessages.value[shopId].push({
                id: Date.now() + 1,
                type: 'ai',
                content: finalContent,
                timestamp: new Date().toISOString(),
                sender: { name: shopName, avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${shopName}` }
            })
            saveStore()
        } catch (e) {
            console.error('AI Shop Reply Failed:', e)
        } finally {
            loading.value = false
        }
    }

    // 商品管理
    const deleteProduct = (id) => {
        products.value = products.value.filter(p => p.id !== id)
        saveStore()
    }

    const clearProducts = () => {
        products.value = []
        saveStore()
    }

    const deleteOrder = (orderId) => {
        orders.value = orders.value.filter(o => o.id !== orderId)
        saveStore()
    }

    // ============ Standard Actions ============

    const initStore = () => {
        const saved = localStorage.getItem('shopping_store_v2')
        if (saved) {
            const data = JSON.parse(saved)
            products.value = data.products || []
            cart.value = data.cart || []
            orders.value = data.orders || []
            logistics.value = data.logistics || []
            chatMessages.value = data.chatMessages || {}
            addresses.value = data.addresses || addresses.value
            favorites.value = data.favorites || []
            footprints.value = data.footprints || []
            coupons.value = data.coupons || coupons.value
            points.value = data.points || 1250
            reviews.value = data.reviews || {}
            subscribedShops.value = data.subscribedShops || []
            useFantasyCities.value = data.useFantasyCities || false
            
            // 检查是否有进行中的物流，如果有则启动定时器
            const hasActiveLogistics = logistics.value.some(l => 
                l.status !== 'delivered' && l.status !== 'cancelled'
            )
            if (hasActiveLogistics) {
                startLogisticsTimer()
            }
        }
        if (products.value.length === 0) generateSampleProducts()
    }

    const saveStore = () => {
        const data = {
            products: products.value, cart: cart.value, orders: orders.value,
            logistics: logistics.value, chatMessages: chatMessages.value,
            addresses: addresses.value, favorites: favorites.value,
            footprints: footprints.value, coupons: coupons.value,
            points: points.value, reviews: reviews.value,
            subscribedShops: subscribedShops.value,
            useFantasyCities: useFantasyCities.value, // 保存城市偏好
            lastUpdateTime: Date.now() // 保存最后更新时间
        }
        localStorage.setItem('shopping_store_v2', JSON.stringify(data))
    }

    // 物流自动更新定时器
    let logisticsTimer = null

    // 启动物流更新定时器
    const startLogisticsTimer = () => {
        if (logisticsTimer) return
        
        // 每 10 秒检查一次物流状态
        logisticsTimer = setInterval(() => {
            updateAllLogistics()
        }, 10000)
        
        console.log('[ShoppingStore] 物流自动更新定时器已启动')
    }

    // 停止物流更新定时器
    const stopLogisticsTimer = () => {
        if (logisticsTimer) {
            clearInterval(logisticsTimer)
            logisticsTimer = null
            console.log('[ShoppingStore] 物流自动更新定时器已停止')
        }
    }

    // 更新所有物流状态
    const updateAllLogistics = () => {
        const now = Date.now()
        let hasChanges = false

        logistics.value.forEach(log => {
            if (log.status === 'delivered' || log.status === 'cancelled') {
                return // 已完成或已取消的订单不需要更新
            }

            // 检查是否需要更新物流状态
            const shouldUpdate = checkLogisticsUpdate(log, now)
            if (shouldUpdate) {
                hasChanges = true
            }
        })

        if (hasChanges) {
            saveStore()
            console.log('[ShoppingStore] 物流状态已更新')
        }
    }

    // 检查并更新单个物流
    const checkLogisticsUpdate = (log, now) => {
        const lastUpdate = log.lastUpdate || now
        const timeDiff = now - lastUpdate
        
        let updated = false

        // 根据当前状态决定更新逻辑
        switch (log.status) {
            case 'picked':
                // 已揽收 -> 运输中 (正常 6 小时，加速后 1 小时)
                const toShippingTime = log.hastened ? 60 * 60 * 1000 : 60 * 60 * 6 * 1000
                if (timeDiff > toShippingTime) {
                    log.status = 'shipping'
                    log.currentStep = 1
                    
                    // 使用第一个中转城市
                    const transitCity = log.transitCities[0]
                    const transitLocation = generateLocationName('sorting', transitCity)
                    
                    log.timeline.unshift({
                        time: new Date().toISOString(),
                        status: '运输中',
                        desc: generateLogisticsDesc('shipping', log.hastened),
                        location: transitLocation
                    })
                    log.currentLocation = transitCity
                    updated = true
                }
                break

            case 'shipping':
                // 运输中 -> 派送中 (正常 12 小时，加速后 30 分钟)
                const toDeliveringTime = log.hastened ? 30 * 60 * 1000 : 60 * 60 * 12 * 1000
                if (timeDiff > toDeliveringTime) {
                    log.status = 'delivering'
                    log.currentStep = 2
                    
                    // 目的地城市
                    const destLocation = generateLocationName('delivery', log.destCity)
                    
                    log.timeline.unshift({
                        time: new Date().toISOString(),
                        status: '派送中',
                        desc: generateLogisticsDesc('delivering', log.hastened),
                        location: destLocation
                    })
                    log.currentLocation = log.destCity
                    updated = true
                }
                break

            case 'delivering':
                // 派送中 -> 待签收 (正常 2 小时，加速后 10 分钟)
                const toDeliveredTime = log.hastened ? 10 * 60 * 1000 : 60 * 60 * 2 * 1000
                if (timeDiff > toDeliveredTime) {
                    // 只更新物流状态为待签收，不自动签收
                    log.status = 'delivered'
                    log.currentStep = 3
                    
                    // 签收地址
                    const order = orders.value.find(o => o.id === log.orderId)
                    const signLocation = order?.address?.detail || `${log.destCity}收货地址`
                    
                    log.timeline.unshift({
                        time: new Date().toISOString(),
                        status: '待签收',
                        desc: '快递员已到达，请尽快签收包裹',
                        location: signLocation
                    })
                    log.currentLocation = signLocation
                    
                    // 注意：不再自动确认收货，需要用户手动点击签收
                    updated = true
                }
                break
        }

        if (updated) {
            log.lastUpdate = now
            // 更新预计送达时间
            if (log.status !== 'delivered') {
                const remainingTime = log.hastened ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
                log.estimatedDelivery = new Date(now + remainingTime).toISOString()
            }
        }

        return updated
    }

    const generateSampleProducts = () => {
        // 保底商品
        products.value = [
            {
                id: 'prod_base_1',
                title: 'Vision Pro 智能头显',
                description: '空间计算时代，沉浸式交互体验',
                price: 24999,
                originalPrice: 29999,
                category: 'digital',
                image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?w=600',
                rating: 5.0,
                sales: 120,
                shop: 'FutureTech 旗舰店',
                tags: ['未来已来', '顺丰包邮']
            }
        ]
        saveStore()
    }

    const removeFromCart = (cartId) => {
        cart.value = cart.value.filter(item => item.cartId !== cartId)
        saveStore()
    }

    const addToCart = (product, quantity = 1, specs = {}) => {
        const existing = cart.value.find(item =>
            item.id === product.id &&
            JSON.stringify(item.specs || {}) === JSON.stringify(specs || {})
        )
        if (existing) {
            existing.quantity += quantity
        } else {
            cart.value.push({
                ...product,
                quantity,
                specs,
                cartId: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
            })
        }
        saveStore()
    }

    const createOrder = (items, address, remark = '', couponId = null, paymentMethod = null) => {
        let total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        let discount = 0

        if (couponId) {
            const coupon = coupons.value.find(c => c.id === couponId)
            if (coupon && total >= coupon.minAmount) {
                discount = coupon.amount
                total -= discount
                coupon.status = 'used'
            }
        }

        // 尝试从钱包扣款
        const paySuccess = walletStore.decreaseBalance(total, `购物: ${items[0].title}${items.length > 1 ? '等' : ''}`, paymentMethod)

        if (!paySuccess) {
            alert('余额不足，支付失败！')
            return null
        }

        const order = {
            id: `CN${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            items: [...items],
            total,
            discount,
            status: 'paid', // 默认由于扣款成功直接进入待发货
            address,
            remark,
            createdAt: new Date().toISOString(),
            paidAt: new Date().toISOString()
        }

        orders.value.unshift(order)
        generateLogistics(order.id)

        // 增加积分
        points.value += Math.floor(total / 10)

        // 清理购物车
        items.forEach(item => {
            cart.value = cart.value.filter(c => c.cartId !== item.cartId)
        })

        saveStore()
        return order
    }

    const confirmReceipt = (orderId) => {
        const order = orders.value.find(o => o.id === orderId)
        if (order) {
            // 将商品加入背包
            order.items.forEach(item => {
                backpackStore.addItem({
                    title: item.title,
                    description: item.description,
                    image: item.image,
                    category: item.category || 'other',
                    quantity: item.quantity,
                    source: item.shop || '商城'
                })
            })

            // 更新订单状态为已完成
            order.status = 'completed'

            // 更新物流状态为已签收
            const log = logistics.value.find(l => l.orderId === orderId)
            if (log) {
                log.status = 'delivered'
                log.timeline.unshift({
                    time: new Date().toISOString(),
                    status: '已签收',
                    desc: '您的包裹已签收，感谢使用顺丰速运',
                    location: order.address.detail
                })
            }
            saveStore()
        }
    }

    const generateLogistics = (orderId) => {
        const now = new Date()
        const cities = getCurrentCities() // 获取当前城市列表
        
        // 获取订单信息（包含收货地址）
        const order = orders.value.find(o => o.id === orderId)
        const addressRegion = order?.address?.region || ''
        const addressDetail = order?.address?.detail || ''
        
        // 随机选择起点和终点城市
        const originCity = cities[Math.floor(Math.random() * cities.length)]
        let destCity = cities[Math.floor(Math.random() * cities.length)]
        while (destCity === originCity) {
            destCity = cities[Math.floor(Math.random() * cities.length)]
        }
        
        // 生成中间经过的城市（2-4 个）
        const transitCount = Math.floor(Math.random() * 3) + 2
        const transitCities = []
        for (let i = 0; i < transitCount; i++) {
            let city = cities[Math.floor(Math.random() * cities.length)]
            while (city === originCity || city === destCity || transitCities.includes(city)) {
                city = cities[Math.floor(Math.random() * cities.length)]
            }
            transitCities.push(city)
        }

        // 生成随机路径坐标（不再固定从左下到右上）
        const path = []
        
        // 随机生成起点坐标（四个角落随机）
        const originPositions = [
            { x: 15, y: 85 }, // 左下
            { x: 85, y: 85 }, // 右下
            { x: 15, y: 15 }, // 左上
            { x: 85, y: 15 }  // 右上
        ]
        const startPos = originPositions[Math.floor(Math.random() * originPositions.length)]
        path.push({ x: startPos.x, y: startPos.y, label: originCity, type: 'origin' })
        
        // 随机生成中转站坐标（在地图中间区域随机分布）
        const actualTransitCount = Math.min(transitCities.length, 3)
        for (let i = 0; i < actualTransitCount; i++) {
            // 根据进度在起点和终点之间插值，加上随机偏移
            const progress = (i + 1) / (transitCount + 1)
            const baseX = startPos.x + (85 - startPos.x) * progress
            const baseY = startPos.y + (15 - startPos.y) * progress
            
            // 添加随机偏移（-15 到 +15）
            const offsetX = (Math.random() - 0.5) * 30
            const offsetY = (Math.random() - 0.5) * 30
            
            path.push({
                x: Math.max(10, Math.min(90, baseX + offsetX)),
                y: Math.max(10, Math.min(90, baseY + offsetY)),
                label: transitCities[i],
                type: 'transit'
            })
        }
        
        // 保存收货地址信息
        const deliveryAddressLabel = addressRegion ? addressRegion.split(' ').slice(0, 2).join('') : ''
        
        // 随机生成终点坐标（与起点相对的角落），标签直接用收货地址
        const destPositions = [
            { x: 85, y: 15 }, // 右上
            { x: 15, y: 15 }, // 左上
            { x: 85, y: 85 }, // 右下
            { x: 15, y: 85 }  // 左下
        ]
        const destIndex = originPositions.indexOf(startPos)
        const endPos = destPositions[destIndex] || { x: 85, y: 40 }
        // 终点标签直接使用收货地址，不再显示城市名
        const destLabel = deliveryAddressLabel || destCity
        path.push({ x: endPos.x, y: endPos.y, label: destLabel, type: 'dest' })
        
        // 初始时间线只包含已揽收状态
        const timeline = []
        const originLocation = generateLocationName('origin', originCity)
        timeline.push({
            time: generateRandomTime(now, -30).toISOString(),
            status: '已揽收',
            desc: generateLogisticsDesc('picked', false),
            location: originLocation
        })
        
        const log = {
            id: `log_${orderId}`,
            orderId,
            company: '顺丰速运',
            trackingNumber: `SF${Math.random().toString().slice(2, 14)}`,
            status: 'picked',
            hastened: false,
            lastUpdate: Date.now(),
            originCity,
            destCity,
            deliveryAddress: addressDetail,
            deliveryAddressLabel: deliveryAddressLabel,
            transitCities: transitCities,
            path: path,
            currentStep: 0,
            timeline,
            currentLocation: originCity,
            estimatedDelivery: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
        }
        logistics.value.push(log)
        
        // 启动物流定时器
        startLogisticsTimer()
        
        saveStore()
    }

    const hastenLogistics = (orderId) => {
        const log = logistics.value.find(l => l.orderId === orderId)
        if (log && !log.hastened) {
            log.hastened = true
            // 加速逻辑：直接变更状态到即将送达
            log.status = 'shipping'
            log.currentStep = 2
            log.timeline.unshift({
                time: new Date().toISOString(),
                status: '加速中',
                desc: '您的催促请求已收到，顺丰“极速达”特权已开启，包裹正在优先配送中！',
                location: '顺丰航空分拨中心'
            })
            // 预计到达时间缩短
            log.estimatedDelivery = new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString()
            saveStore()
            return true
        }
        return false
    }

    const addToFavorites = (prodId) => {
        if (!favorites.value.includes(prodId)) {
            favorites.value.push(prodId)
            saveStore()
        }
    }

    const removeFavorite = (prodId) => {
        favorites.value = favorites.value.filter(id => id !== prodId)
        saveStore()
    }

    const addFootprint = (prodId) => {
        // 去重并排在前列
        footprints.value = [prodId, ...footprints.value.filter(id => id !== prodId)].slice(0, 50)
        saveStore()
    }

    const followShop = (shop) => {
        if (!subscribedShops.value.find(s => s.name === shop.name)) {
            subscribedShops.value.unshift({
                ...shop,
                fans: shop.fans || (Math.floor(Math.random() * 900) + 100) + 'K',
                products: shop.products || Math.floor(Math.random() * 500) + 50
            })
            saveStore()
        }
    }

    const unfollowShop = (shopName) => {
        subscribedShops.value = subscribedShops.value.filter(s => s.name !== shopName)
        saveStore()
    }

    // 监控分类变化，自动 AI 发现商品（搜索改为手动触发，见 handleSearchAI）
    // 积分兑换
    const exchangeHistory = ref([]) // 兑换记录
    const weeklyReport = ref(null) // 周报数据

    const exchangeReward = (reward) => {
        if (points.value < reward.cost) {
            return { success: false, message: '积分不足' }
        }

        points.value -= reward.cost

        // 根据奖励类型处理
        if (reward.type === 'coupon') {
            coupons.value.push({
                id: 'cp_' + Date.now(),
                title: reward.title,
                amount: reward.amount || 5,
                minAmount: reward.minAmount || 0,
                status: 'active'
            })
        } else if (reward.type === 'balance') {
            walletStore.increaseBalance(reward.amount, '积分兑换')
        }

        // 记录兑换历史
        exchangeHistory.value.unshift({
            id: 'ex_' + Date.now(),
            reward: reward.title,
            cost: reward.cost,
            time: new Date().toISOString()
        })

        saveStore()
        return { success: true, message: '兑换成功' }
    }

    // 生成周报
    const generateWeeklyReport = () => {
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const weekOrders = orders.value.filter(o => new Date(o.createdAt) >= weekAgo)
        const weekSpent = weekOrders.reduce((sum, o) => sum + o.total, 0)
        const weekSaved = weekOrders.reduce((sum, o) => sum + (o.originalTotal || o.total), 0) - weekSpent

        weeklyReport.value = {
            weekStart: weekAgo.toISOString(),
            weekEnd: now.toISOString(),
            orderCount: weekOrders.length,
            totalSpent: weekSpent,
            totalSaved: Math.max(0, weekSaved),
            pointsEarned: Math.floor(weekSpent / 10),
            favoriteCategory: getFavoriteCategory(weekOrders),
            topShop: getTopShop(weekOrders),
            achievements: generateAchievements(weekOrders, weekSpent)
        }

        return weeklyReport.value
    }

    const getFavoriteCategory = (weekOrders) => {
        const categories = {}
        weekOrders.forEach(o => {
            o.items.forEach(item => {
                const cat = item.category || 'other'
                categories[cat] = (categories[cat] || 0) + item.quantity
            })
        })
        const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1])
        return sorted[0] ? sorted[0][0] : '暂无'
    }

    const getTopShop = (weekOrders) => {
        const shops = {}
        weekOrders.forEach(o => {
            o.items.forEach(item => {
                const shop = item.shop || '未知店铺'
                shops[shop] = (shops[shop] || 0) + 1
            })
        })
        const sorted = Object.entries(shops).sort((a, b) => b[1] - a[1])
        return sorted[0] ? sorted[0][0] : '暂无'
    }

    const generateAchievements = (weekOrders, weekSpent) => {
        const achievements = []
        if (weekOrders.length >= 5) achievements.push({ icon: '🛒', title: '购物达人', desc: '本周下单5次以上' })
        if (weekSpent >= 500) achievements.push({ icon: '💰', title: '消费大户', desc: '本周消费超500元' })
        if (weekSpent >= 1000) achievements.push({ icon: '👑', title: '尊贵VIP', desc: '本周消费超1000元' })
        if (points.value >= 1000) achievements.push({ icon: '⭐', title: '积分富翁', desc: '积分超过1000' })
        if (favorites.value.length >= 10) achievements.push({ icon: '❤️', title: '收藏家', desc: '收藏商品超10件' })
        return achievements
    }

    return {
        // State
        products, cart, orders, logistics, chatMessages, activeShopId,
        addresses, favorites, footprints, coupons, points, reviews, subscribedShops,
        currentCategory, searchQuery, loading, currentView,
        exchangeHistory, weeklyReport, useFantasyCities,
        // Getters
        categories, currentUser, filteredProducts, cartCount, cartTotal, pendingOrders,
        // Actions
        initStore, saveStore, generateProductsAI, generateReviewsAI, sendMessage, triggerAIReply,
        deleteProduct, clearProducts,
        addToCart, removeFromCart, createOrder, addToFavorites, removeFavorite, addFootprint,
        followShop, unfollowShop, confirmReceipt, deleteOrder, hastenLogistics,
        exchangeReward, generateWeeklyReport, toggleFantasyCities,
        switchView: (v) => currentView.value = v,
        setCategory: (c) => currentCategory.value = c,
        setSearchQuery: (q) => searchQuery.value = q,
        startLogisticsTimer, stopLogisticsTimer
    }
})

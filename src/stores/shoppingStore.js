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
            const count = Math.floor(Math.random() * 5) + 4 // 4-8个
            const prompt = `你是一个有个性的电商后台。根据 搜索词:"${query || '热门'}" 和 分类:"${category || '推荐'}"，生成 ${count} 个深度模拟的商品 JSON 数组。
            要求：
            1. 字段：id, title, description, price, originalPrice, category, shop, shopPersonality(店铺性格), tags, rating, sales。
            2. 【关键】价格多样性：必须包含 specs 数组，如 specs: [{ name: "标准版", price: 100 }, { name: "旗舰版", price: 180 }]。不同规格的价格不能相同。
            3. 评价注入：为生成的【每一个】商品生成 3-5 条真实评价，放在 reviews 字段里。评价内容要有生活气息，别老是夸，要有点真实的槽点。
            4. 图片：image 请使用 https://pollinations.ai/p/[描述]?width=600&height=600&seed=[随机数]。
            5. 店铺性格：不同店铺的店主性格要分化，描述商品时也要体现。
            6. 严格返回 JSON 数组格式。`

            const messages = [{ role: 'user', content: prompt }]
            const char = { name: '商品系统', prompt: '你只输出符合要求的 JSON 数组。不要文字废话。' }

            const result = await generateReply(messages, char, null, { isSimpleTask: true })
            const cleanContent = result.content.replace(/```json|```/g, '').trim()
            const newProducts = JSON.parse(cleanContent)

            // 处理生成结果
            newProducts.forEach(p => {
                // 如果 AI 没给 ID，我们手动补一个
                if (!p.id) p.id = 'prod_' + Math.random().toString(36).slice(2, 9)

                // 自动注入评价到全局 review store
                if (p.reviews) {
                    reviews.value[p.id] = p.reviews
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
            })
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
        if (reviews.value[product.id] && !force) return

        loading.value = true
        try {
            const char = { name: '评价生成器', prompt: '你生成真实的电商评论。要求 JSON 数组：[{user, content, rating, images:[], time}]。' }
            const prompt = `请为这个商品 "${product.title}" ${force ? '【重新】' : ''}生成 4-6 条真实感爆棚的带图评价。
            场景要求：包括收货晒图、使用一周后的追评、吐槽包装差但产品好、或者某些奇怪的买家秀。
            图片链接: https://pollinations.ai/p/[物品细节]?width=400&height=400&seed=${Math.random()}。`

            const result = await generateReply([{ role: 'user', content: prompt }], char, null, { isSimpleTask: true })
            const cleanContent = result.content.replace(/```json|```/g, '').trim()
            const parsed = JSON.parse(cleanContent)

            if (force) {
                reviews.value[product.id] = [...parsed, ...(reviews.value[product.id] || []).slice(0, 5)]
            } else {
                reviews.value[product.id] = parsed
            }
            saveStore()
        } catch (e) {
            console.error('AI Review Generation Failed:', e)
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
            subscribedShops: subscribedShops.value
        }
        localStorage.setItem('shopping_store_v2', JSON.stringify(data))
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
            order.status = 'completed'

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
        const log = {
            id: `log_${orderId}`,
            orderId,
            company: '顺丰速运',
            trackingNumber: `SF${Math.random().toString().slice(2, 14)}`,
            status: 'picked',
            hastened: false,
            // 虚拟路径坐标 (用于地图渲染)
            path: [
                { x: 20, y: 80, label: '发货地' },
                { x: 40, y: 60, label: '中转站' },
                { x: 70, y: 40, label: '分拨中心' },
                { x: 90, y: 20, label: '收货地' }
            ],
            currentStep: 0,
            timeline: [
                { time: now.toISOString(), status: '已揽收', desc: '快递员已上门揽收', location: '深圳分拣中心' },
                { time: new Date(now.getTime() - 1000 * 60 * 30).toISOString(), status: '待揽收', desc: '商家已发货，等待快递员揽收', location: '华南仓' }
            ],
            currentLocation: '深圳',
            estimatedDelivery: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
        }
        logistics.value.push(log)
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

    // 监控分类/搜索变化，全自动 AI 发现商品
    watch([currentCategory, searchQuery], ([cat, q]) => {
        if (cat !== 'all' || q) {
            generateProductsAI(q, cat === 'all' ? null : cat)
        }
    })

    return {
        // State
        products, cart, orders, logistics, chatMessages, activeShopId,
        addresses, favorites, footprints, coupons, points, reviews, subscribedShops,
        currentCategory, searchQuery, loading, currentView,
        // Getters
        categories, currentUser, filteredProducts, cartCount, cartTotal, pendingOrders,
        // Actions
        initStore, saveStore, generateProductsAI, generateReviewsAI, sendMessage, triggerAIReply,
        deleteProduct, clearProducts,
        addToCart, removeFromCart, createOrder, addToFavorites, removeFavorite, addFootprint,
        followShop, unfollowShop, confirmReceipt, deleteOrder, hastenLogistics,
        switchView: (v) => currentView.value = v,
        setCategory: (c) => currentCategory.value = c,
        setSearchQuery: (q) => searchQuery.value = q
    }
})

import { useChatStore } from '../../stores/chatStore'
import { useWorldBookStore } from '../../stores/worldBookStore'

const NETIZEN_NAMES = [
    '吃瓜少女', '熬夜冠军', '纯爱战士', '没睡醒的猫', '冲浪达人', 
    '芋泥波波', '这里是XX', '某不知名网友', '热心市民', '小透明一只',
    '奶茶续命', '追剧狂魔', '社恐患者', '吃土少女', '深夜食堂',
    '元气满满', '咸鱼翻身', '佛系青年', '柠檬精本精', '人间清醒'
]

const NETIZEN_AVATARS = [
    '/avatars/小猫举爪.jpg', '/avatars/小猫吃芒果.jpg', '/avatars/小猫吃草莓.jpg',
    '/avatars/小猫喝茶.jpg', '/avatars/小猫坏笑.jpg', '/avatars/小猫开心.jpg',
    '/avatars/小猫星星眼.jpg', '/avatars/小猫困困.jpg'
]

export function getRandomNetizen() {
    return {
        name: NETIZEN_NAMES[Math.floor(Math.random() * NETIZEN_NAMES.length)],
        avatar: NETIZEN_AVATARS[Math.floor(Math.random() * NETIZEN_AVATARS.length)]
    }
}

export function WEIBO_COMMENT_PROMPT(postContent, postAuthor, context = {}) {
    const { trendingTopic, boundChars = [], worldBookContent = '' } = context
    
    let charContext = ''
    if (boundChars.length > 0) {
        charContext = `\n【绑定角色信息】以下角色可能在评论区出现：
${boundChars.map(c => `- ${c.name}: ${c.prompt || '无设定'}`).join('\n')}
这些角色可以用自己的身份评论，标记 "isChar": true。`
    }

    let worldBookContext = ''
    if (worldBookContent) {
        worldBookContext = `\n【世界书设定 - 必须遵守】
${worldBookContent}`
    }

    return `你是一个拟真的微博评论生成引擎。

【当前微博内容】
作者：${postAuthor}
正文：${postContent}
${trendingTopic ? `相关话题：#${trendingTopic}#` : ''}
${charContext}
${worldBookContext}

【生成规则】
1. 生成 3-5 条网友评论，风格各异（搞笑、羡慕、吃瓜、吐槽、支持等）
2. 评论要口语化，可以使用颜文字和emoji
3. 可以有楼中楼回复（replyTo字段）
4. 偶尔出现"神评"（特别搞笑或犀利的评论）
5. 如果有绑定角色，可以让角色偶尔出现互动
6. 每条评论一行，不要带序号

【输出格式 - 纯JSON数组】
[
  {
    "authorName": "网友昵称",
    "content": "评论内容",
    "likes": 随机数字,
    "isVip": true/false,
    "isChar": false,
    "replyTo": "被回复者昵称(可选)"
  }
]

请直接输出JSON数组，不要任何解释。`
}

export function WEIBO_POST_PROMPT(userProfile, context = {}) {
    const { trendingTopic, boundChars = [], worldBookContent = '', recentPosts = [] } = context
    
    let charContext = ''
    if (boundChars.length > 0) {
        charContext = `\n【绑定角色 - 可发微博】
${boundChars.map(c => `- ${c.name}: ${c.prompt || '无设定'}`).join('\n')}
这些角色可以发微博，标记 "authorId": "char_${c.id}"。`
    }

    let worldBookContext = ''
    if (worldBookContent) {
        worldBookContext = `\n【世界书设定 - 内容必须符合】
${worldBookContent}`
    }

    let recentContext = ''
    if (recentPosts.length > 0) {
        recentContext = `\n【近期微博动态】
${recentPosts.slice(0, 5).map(p => `- ${p.author}: ${p.content.substring(0, 50)}...`).join('\n')}`
    }

    return `你是一个拟真的微博内容生成引擎。

【用户信息】
昵称：${userProfile.name}
简介：${userProfile.bio}
认证：${userProfile.verified ? userProfile.verifyType : '无'}
VIP等级：${userProfile.vipLevel || 0}
${charContext}
${worldBookContext}
${recentContext}

${trendingTopic ? `【当前热门话题】#${trendingTopic}#` : ''}

【生成规则】
1. 生成 1-2 条微博，内容要真实自然
2. 可以是日常分享、心情吐槽、热点评论等
3. 适当使用emoji和话题标签
4. 如果有绑定角色，可以让角色发微博
5. 内容要符合世界书设定（如果有）
6. 可以包含图片描述 [draw: 描述]

【输出格式 - 纯JSON数组】
[
  {
    "id": "wb_时间戳",
    "author": "发布者昵称",
    "authorId": "me 或 char_xxx",
    "content": "微博正文",
    "images": ["图片url或[draw:描述]"],
    "stats": { "share": 数字, "comment": 数字, "like": 数字 },
    "isVip": true/false
  }
]

请直接输出JSON数组，不要任何解释。`
}

export function WEIBO_HOT_SEARCH_PROMPT(context = {}) {
    const { currentTrends = [], worldBookContent = '' } = context
    
    return `你是一个微博热搜生成引擎。

${worldBookContent ? `【世界书设定】\n${worldBookContent}` : ''}
【当前已有热搜】
${currentTrends.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}

【生成规则】
1. 生成 5 条新的热搜话题
2. 涵盖娱乐、社会、科技、生活等领域
3. 热度标签：爆/热/新/荐
4. 要有吸引点击的标题
5. 符合世界书设定（如果有）

【输出格式 - 纯JSON数组】
[
  {
    "rank": 排名数字,
    "title": "热搜标题",
    "tag": "爆/热/新/荐",
    "meta": "热度数字如 450万",
    "isTop": true/false
  }
]

请直接输出JSON数组，不要任何解释。`
}

export function WEIBO_DM_PROMPT(dmName, context = {}) {
    return `你是一个微博私信生成引擎。

【私信对象】${dmName}

【生成规则】
1. 生成 1-2 条私信消息
2. 内容自然，像是朋友间的问候或通知
3. 可以是系统通知、好友消息等

【输出格式 - 纯JSON数组】
[
  {
    "sender": "发送者名称",
    "content": "消息内容",
    "time": "时间描述",
    "isSystem": true/false
  }
]

请直接输出JSON数组，不要任何解释。`
}

export function WEIBO_DM_CHAT_REPLY_PROMPT(contactName, recentMessages, context = {}) {
    const { boundChars = [], worldBookContent = '' } = context
    const msgHistory = recentMessages.map(m => {
        const role = m.isMine ? 'Chilly(我)' : contactName
        return `- ${role}: ${m.content}`
    }).join('\n')

    let charContext = ''
    if (boundChars.length > 0) {
        charContext = `\n【当前绑定角色】\n${boundChars.map(c => `${c.name}：${c.prompt || '无描述'}`).join('\n')}`
    }

    return `你正在扮演微博用户「${contactName}」与 Chilly 进行私信对话。

${charContext}
${worldBookContent ? `\n【世界书设定】\n${worldBookContent}` : ''}

【最近聊天记录（最新的几条）】
${msgHistory || '(这是第一条消息，自然地打招呼或回应)'}

【回复规则】
1. 以「${contactName}」的身份回复，语气要符合角色设定
2. 回复要简短、自然、口语化（像微信聊天，不超过50字）
3. 可以适当使用 emoji 表达情绪
4. 根据上下文内容进行有意义的回应，不要泛泛而谈

【输出格式 - 纯JSON对象】
{
  "reply": "你的回复内容"
}

请直接输出JSON对象，不要任何解释。`
}

export function WEIBO_TOPIC_POST_PROMPT(topicTitle, context = {}) {
    const { boundChars = [], worldBookContent = '' } = context
    
    let charContext = ''
    if (boundChars.length > 0) {
        charContext = `\n【绑定角色】
${boundChars.map(c => `- ${c.name}`).join('\n')}`
    }

    return `你是一个微博话题讨论生成引擎。

【话题】#${topicTitle}#
${charContext}
${worldBookContent ? `\n【世界书设定】\n${worldBookContent}` : ''}

【生成规则】
1. 生成 2-3 条该话题下的微博
2. 内容要围绕话题展开
3. 观点可以不同（支持/反对/吃瓜）
4. 适当使用话题标签

【输出格式 - 纯JSON数组】
[
  {
    "author": "发布者",
    "content": "微博内容 #${topicTitle}#",
    "images": [],
    "stats": { "share": 数字, "comment": 数字, "like": 数字 }
  }
]

请直接输出JSON数组，不要任何解释。`
}

export function buildWeiboContext(weiboStore, chatStore, worldBookStore) {
    const context = {
        boundChars: [],
        worldBookContent: '',
        trendingTopic: '',
        recentPosts: []
    }

    if (weiboStore.settings.boundCharacters && weiboStore.settings.boundCharacters.length > 0) {
        context.boundChars = weiboStore.settings.boundCharacters.map(charId => {
            const char = chatStore.chats[charId]
            if (char) {
                return {
                    id: charId,
                    name: char.name,
                    prompt: char.prompt || char.description || ''
                }
            }
            return null
        }).filter(Boolean)
    }

    if (weiboStore.settings.boundWorldBooks && weiboStore.settings.boundWorldBooks.length > 0) {
        const books = worldBookStore.books || []
        const entries = books.flatMap(b => b.entries || [])
        const activeEntries = entries.filter(e => weiboStore.settings.boundWorldBooks.includes(e.id))
        if (activeEntries.length > 0) {
            context.worldBookContent = activeEntries.map(e => `[${e.name}]: ${e.content}`).join('\n')
        }
    }

    if (weiboStore.hotSearch && weiboStore.hotSearch.length > 0) {
        const randomHot = weiboStore.hotSearch[Math.floor(Math.random() * weiboStore.hotSearch.length)]
        context.trendingTopic = randomHot.title
    }

    context.recentPosts = weiboStore.posts.slice(0, 5)

    return context
}

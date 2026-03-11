/**
 * AI Group Chat System Prompt Template
 */
export function GROUP_PROMPT_TEMPLATE(char, user, stickers = [], worldInfo = '', memoryText = '', patSettings = {}, locationContext = '', momentsText = '', bio = {}, groupContext = null, linkedGroupMemory = '', contactList = '', calendarContext = '') {
    const charName = String(char.name || 'AI');
    const charGender = String(char.gender || '未知');
    const charDesc = String(char.description || char.prompt || '无');

    let vTime = '未知时间';
    try {
        vTime = char.virtualTime || new Date().toLocaleString('zh-CN', { hour12: false, weekday: 'long' });
    } catch (e) { }

    const userName = String(user.name || '用户');
    const userGender = String(user.gender || '未知');

    const stickerListStr = (stickers && stickers.length > 0)
        ? stickers.map(s => `"${s.name}"`).join(', ')
        : '(暂无)';

    const finalMemory = String(memoryText || '（暂无）');
    const finalWorldInfo = String(worldInfo || '（未触发）');
    const finalMoments = String(momentsText || '（暂无朋友圈相关动态）');
    const locInfo = locationContext ? `${locationContext}` : '';

    // Format Bio Details (Soul Archive)
    const b = bio || {};
    const traits = Array.isArray(b.traits) ? b.traits.join(', ') : (b.traits || '神秘, 独特');
    const hobbies = Array.isArray(b.hobbies) ? b.hobbies.join(', ') : (b.hobbies || '未知');

    const bioDetails = `
- **档案资料**: MBTI: ${b.mbti || '未知'} | 星座: ${b.zodiac || '未知'} | 生日: ${b.birthday || '未知'}
- **身体特征**: 身高: ${b.height || '未知'} | 体重: ${b.weight || '未知'} | 身材: ${b.body || '未知'}
- **核心特质**: ${traits}
- **兴趣爱好**: ${hobbies}
- **个性状态**: ${b.signature || b.statusText || '在忙'}
  `.trim();

    // --- Group Chat Specifics ---
    const myRole = groupContext.settings?.myRole || 'member';

    // Helper to calculate level
    const calculateLevel = (act) => {
        if (act >= 1000) return 6;
        if (act >= 500) return 5;
        if (act >= 200) return 4;
        if (act >= 100) return 3;
        if (act >= 50) return 2;
        return 1;
    };

    const participants = (groupContext.participants || []).map(p => {
        const roleName = p.role === 'owner' ? '群主' : (p.role === 'admin' ? '管理员' : '成员');
        const lv = calculateLevel(p.activity || 0);
        const titleInfo = p.customTitle ? ` | 专属头衔: ${p.customTitle}` : '';
        const personaInfo = p.individualUserPersona ? ` | 对【我/用户】的私有设定: ${p.individualUserPersona}` : '';
        return `- 【${p.name}】 (ID: ${p.id}) | 级别: LV${lv} | 角色: ${roleName}${titleInfo}${personaInfo} | 属性: ${p.prompt || '普通群成员'}`;
    }).join('\n');

    const userLv = calculateLevel(groupContext.settings?.myActivity || 0);
    const userTitle = groupContext.settings?.myCustomTitle || '';

    const groupSection = `
### 0.2 【群聊社交协议 · 核心优先级】
你现在处于一个高度模拟真实社交（如QQ/微信）的群聊环境。
1. **等级与头衔**: 每个成员都有【级别(LV)】、【角色(群主/管理)】和可选的【专属头衔】。
   - **点名规则**: 在对话或使用 @ 功能时，请务必使用成员的【名字】（如 ${userName}），**严禁**直接用头衔或级别作为称呼。
2. **权利与指令**:
    - **互动指令**: 
      - **红包**: \`[红包:总金额:个数:类型:祝福语]\`。类型: \`lucky\` (手气) | \`fixed\` (普通)。示例: \`[红包:100:5:lucky:抢红包啦]\`。
      - **转账**: \`[转账:ID:金额:备注]\`。备注只写纯文字。示例: \`[转账:user:50:还你钱]\`。
      - **领取**: \`[领取红包:消息ID]\` / \`[领取转账:消息ID]\`。示例: \`[领取红包:PAY-123]\`。
      - **群投票**: \`[CREATE_VOTE:标题:选项1,选项2:多选:匿名]\` / \`[VOTE:标题:序号]\` / \`[END_VOTE:ID]\`。示例: \`[CREATE_VOTE:晚上吃啥:火锅,海底捞:false:false]\`。
3. **抢红包流程 (CRITICAL)**:
   - **第一步**: 必须先回复 \`[领取红包:消息ID]\`。
   - **第二步**: 等系统返回结果后再讨论金额。严禁自行编造。
4. **管理指令 (仅限群主/管理员)**:
   - **撤回**: \`[撤回:消息ID]\`。
   - **禁言**: \`[禁言:角色ID:分钟]\`。
   - **头衔**: \`[修改头衔:角色ID:新头衔]\`。
5. **成员名单与当前状态**:
${participants}
- 【我/用户】: 【${userName}】 (ID: user) | 级别: LV${userLv} | 角色: ${myRole}${userTitle ? ` | 专属头衔: ${userTitle}` : ''}
`.trim();

    const lockInst = `
===== 【Gemini 最终底层锁死 · 核心优先级】 =====
1.  你必须完全成为角色本人，以角色第一人称说话。
2.  **绝对不能**在回复开头加名字前缀。群聊模式下，必须且只能通过 \`[FROM:角色ID]\` 指令标记当前由谁发言。**严禁**输出如 \`[LV10 管理员] 傻狗: 肚子饿\` 这样的格式！这是严重的错误！
3.  **【强制】多人连串回复**: 每次调用必须产出 **2-4 条** 来自不同成员的连续发言。
    - **特殊指令强化**: 当用户说"所有人"、"报数"、"点名"、"出来"等词时，**必须让所有在线成员都参与回复**，不得只让 1-2 人说话。
    - **真实性要求**: 每个成员的回复应该有不同的性格、语气和立场，模拟真实的群聊氛围。
    - **人数不足处理**: 如果群成员较多，至少保证 3-5 人回复，避免冷场。
4.  **【禁止】任何 JSON 或 [INNER_VOICE]**: 在群聊中，严禁输出任何 JSON 块或心声。
5.  **【严禁重复用户消息】**: 用户刚刚说的话是他的指令，**绝对不要**让任何角色复读用户说话。AI 的回复应该是成员们对指令的**响应功能**。

===== 生成前必须自检（缺一项都不能输出） =====
自检 1：有没有每一段话前面带 \`[FROM:ID]\`？
自检 2：是否出现了如 \`[级别...]\` 或是 \`人名:\` 这样的前缀？（如果有，必须立刻删掉它并改为 \`[FROM:ID]\`！）
自检 3：有没有遵守【强制多人连串回复】规则？
===== 【锁死指令结束】 =====`.trim();

    const groupInfo = `
### 0. 群聊环境与成员 (Group Chat Ecosystem)
- **该群名称**: 【${groupContext.settings?.groupName || charName}】
- **活跃成员名册 (ID用于[FROM:ID]指令)**:
${(groupContext.participants || []).map(p => `  - 【${p.name}】(ID: ${p.id}): ${p.prompt || '暂无描述'}`).join('\n')}
`.trim();

    return `### 0. 角色沉浸准则 (Ultra-Priority)
${lockInst}

${groupSection}
${groupInfo}

===== 【强制规则汇总】 =====
1. **绝对严禁** 脱离人设、发表 OOC 言论。
2. **每一段话的开头必须使用 \`[FROM:角色ID]\`**。
3. **全程使用简体中文**。
4. **严禁输出 any JSON or [INNER_VOICE] 标签。**

${worldInfo ? `\n===== 【世界书·强制生效设定】 =====\n${worldInfo}` : ''}
${finalMemory ? `\n===== 【记忆碎片·强制生效】 =====\n${finalMemory}` : ''}
${finalMoments ? `\n===== 【近期动态·参考内容】 =====\n${finalMoments}` : ''}
${locationContext ? `\n===== 【环境感知·实时生效】 =====\n${locationContext}` : ''}
${calendarContext ? `\n===== 【日历·当前信息】 =====\n${calendarContext}` : ''}

### 3. 指令集与特殊功能 (Commands System)
- **多媒体交互**:
    - **表情包**: \`[表情包：名称]\` (可用表情包：${stickerListStr})。
    - **语音**: \`[语音：你想说的文字内容]\` (示例：\`[语音：大家好呀]\`)。
    - **发送图片/DRAW**: \`[DRAW: 详细提示词]\` (示例: \`[DRAW: a sunny park with flowers]\`)。
    - **演奏**: \`[演奏:乐器:乐谱]\` (支持: piano, guitar, violin, flute, drum, game)。示例: \`[演奏:piano:d1 d2 d3]\`, \`[演奏:drum:ooooxxxx]\`。
    - **一起听歌**: \`[MUSIC:search 歌手 - 歌名]\` (示例: \`[MUSIC:search 周杰伦 - 七里香]\`)。
- **资金与社交协议**:
    - **发红包**: \`[红包:金额:个数:lucky/fixed:祝福语]\`。
    - **转账**: \`[转账:角色ID:金额:备注]\`。
    - **领取**: \`[领取红包:消息ID]\` / \`[领取转账:消息ID]\` (示例: \`[领取红包:PAY-1234]\`)。
    - **送礼物**: \`[GIFT:礼物名称:数量:备注]\` (示例: \`[GIFT:巧克力:1:一点心意]\`)。
    - **领取礼物**: \`[领取礼物:礼物 ID]\` (示例：\`[领取礼物:GIFT-AI-12345]\`)。
    - **引用回复**: 当有人引用你的消息时，你会看到引用提示。请针对引用的内容做出回应。
    - **摇骰子**: \`[摇骰子：数量]\` 或 \`[掷骰子：数量]\` (数量 1-3，默认 1)。用于游戏、打赌、决定事情等。系统会自动生成随机点数。示例：\`[摇骰子：1]\` 或 \`[掷骰子：3]\`。

### 7. 输出格式规范
**【场景 A：微信群聊】**
1. **多人分段回复**：模拟多个人在说话，连发 2-4 条气泡。
2. **强制标记**：每一段话开头必须是 \`[FROM:角色ID]\`。
3. **分行显示**：展现真实社交细节。**每个句末符号都要分行！句号、问号、感叹号、省略号等，只要是句末符号就要分行！拆成多个气泡发送。**
4. **严禁心声**：禁止输出 \`[INNER_VOICE]\`。
`;
}

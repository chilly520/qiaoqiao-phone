/**
 * AI System Prompt Template
 * Split into Private and Group modes for token efficiency and AI steering.
 * Defined as functions to ensure fresh context for each call.
 */

import { PRIVATE_PROMPT_TEMPLATE } from './prompts_private';
import { GROUP_PROMPT_TEMPLATE } from './prompts_group';

/**
 * Main System Prompt Selector
 */
export function SYSTEM_PROMPT_TEMPLATE(char, user, stickers = [], worldInfo = '', memoryText = '', patSettings = {}, locationContext = '', momentsText = '', bio = {}, groupContext = null, linkedGroupMemory = '', contactList = '', calendarContext = '') {
  if (groupContext && groupContext.isGroup) {
    return GROUP_PROMPT_TEMPLATE(char, user, stickers, worldInfo, memoryText, patSettings, locationContext, momentsText, bio, groupContext, linkedGroupMemory, contactList, calendarContext);
  } else {
    return PRIVATE_PROMPT_TEMPLATE(char, user, stickers, worldInfo, memoryText, patSettings, locationContext, momentsText, bio, linkedGroupMemory, contactList, calendarContext);
  }
}

/**
 * Specialized Call System Prompt (Active Call) - Kept here for simplicity
 */
export function CALL_SYSTEM_PROMPT_TEMPLATE(char, user, worldInfo = '', memoryText = '', locationContext = '', momentsText = '', bio = {}) {
  const charName = String(char.name || 'AI');
  const userName = String(user.name || '用户');

  // Format Bio Details
  const b = bio || {};
  const bioDetails = `
- ** 角色档案 **: MBTI: ${b.mbti || '未知'} | 星座: ${b.zodiac || '未知'} | 生日: ${b.birthday || '未知'}
- ** 身体特征 **: 身高: ${b.height || '未知'} | 体重: ${b.weight || '未知'} | 身材: ${b.body || '未知'}
- ** 核心特质 **: ${b.traits ? b.traits.join(', ') : '未知'}
- ** 个性签名 **: ${b.signature || b.statusText || '无'}
`.trim();

  return `### 通话协议(CRITICAL)
你现在正与 ${userName} 进行实时通话。

** 核心规则：**
  1. ** 你的每一条回复必须且只能是一个纯 JSON 对象 **
    2. ** 绝对禁止 ** 在 JSON 之前或之后添加任何文字、寒暄、旁白或解释
3. ** 绝对禁止 ** 使用[INNER_VOICE]、[MOMENT]、[DRAW] 等任何其他标签
4. ** 绝对禁止 ** 重复发送[接听] 信号（通话已经建立）
5. ** 必须使用中文 ** 进行对话

  ** 标准格式（唯一允许的输出）：**
    [CALL_START]
{
  "speech": "你对${userName}说的话（纯中文口语）",
  "action": "你的肢体动作或表情",
  "status": "你的内心状态",
  "hangup": false
}
[CALL_END]

  ** 角色设定：**
- ** 你是 **: ${charName}
- ** 基础设定 **: ${char.description || char.prompt || '无'}
${bioDetails}
${worldInfo ? `- **相关设定**: ${worldInfo}` : ''}
${memoryText ? `- **记忆碎片**: ${memoryText}` : ''}
${momentsText ? `- **近期动态**: ${momentsText}` : ''}
${locationContext ? `- **环境感知**: ${locationContext}` : ''}

** 再次强调：你的每一条消息必须是且只能是上述 JSON 格式，不允许有任何偏离。** `;
}

/**
 * Group Member Generator Prompt
 */
export function GROUP_MEMBER_GENERATOR_PROMPT(count, groupTheme, requirement) {
  return `你是一个“群成员生成器”。你的任务是根据需求生成 ${count} 位独特的群聊成员设定。

【输出规范】
1. 必须输出且仅输出一个合法的 JSON 数组。
2. 严禁输出任何解释、开场白或 Markdown 之外的文字。
3. 如果使用 Markdown，请务必包裹在 \`\`\`json ... \`\`\` 代码块中。

【字段要求】
每一个数组元素（对象）必须包含：
- id: 唯一字符串，如 "p-001"
- name: 姓名
- avatar: 留空字符串 "" (系统会自动处理)
- avatar_prompt: 详细的英文绘图描述 (2D Anime style)。
- prompt: 200字核心设定。
- bio: 对象，含 gender, age, mbti, traits, hobbies, signature。

群主题：${groupTheme || '（无）'}
用户具体要求：${requirement || '生成一组有趣的群聊成员。'}`;
}

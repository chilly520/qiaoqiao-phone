package dev.qiaoqiao.phone.llm

import dev.qiaoqiao.phone.prefs.AppPrefs
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * 消息生成器
 * 拼装 system prompt + 上下文 (时间 / 天气 / 最近聊天), 调 LLM 生成一条主动消息
 */
class MessageGenerator {

    suspend fun generateProactiveMessage(): Result<ProactiveMessage> {
        if (!AppPrefs.isConfigured()) {
            return Result.failure(IllegalStateException("LLM 未配置"))
        }
        val client = LlmClient(
            baseUrl = AppPrefs.llmBaseUrl,
            apiKey = AppPrefs.llmApiKey,
            model = AppPrefs.llmModel
        )

        val now = System.currentTimeMillis()
        val systemPrompt = buildSystemPrompt()
        val userPrompt = buildUserPrompt(now)

        return client.chat(
            systemPrompt = systemPrompt,
            userMessage = userPrompt,
            temperature = 0.92,
            maxTokens = 180
        ).map { content ->
            ProactiveMessage(
                characterName = AppPrefs.characterName,
                content = content.trim(),
                generatedAt = now
            )
        }
    }

    private fun buildSystemPrompt(): String {
        val name = AppPrefs.characterName
        val persona = AppPrefs.characterPersona
        return """
            你是「$name」。$persona

            现在你要主动给用户发一条消息, 不是回复, 是你**主动想起用户**后说的话。
            风格要求:
            - 像真人发微信, 1-3 句, 不超过 60 字
            - 口语化, 可以用 1-2 个 emoji, 但不要堆砌
            - 不要用 "亲爱的用户" "您好" 这种客服腔
            - 不要重复"我在呢""我在听"这种被动回应
            - 场景合适的话可以分享你看到的/想到的/正在做的
            - 输出**只发一条消息内容**, 不要加引号/前缀/解释
        """.trimIndent()
    }

    private fun buildUserPrompt(nowMillis: Long): String {
        val cal = Calendar.getInstance().apply { timeInMillis = nowMillis }
        val timeStr = SimpleDateFormat("HH:mm", Locale.CHINA).format(Date(nowMillis))
        val dateStr = SimpleDateFormat("yyyy年M月d日 EEEE", Locale.CHINA).format(Date(nowMillis))
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val timeOfDay = when (hour) {
            in 5..8 -> "清晨"
            in 9..11 -> "上午"
            in 12..13 -> "中午"
            in 14..17 -> "下午"
            in 18..20 -> "傍晚"
            in 21..23 -> "晚上"
            else -> "深夜"
        }

        val intervalMin = AppPrefs.proactiveIntervalMin
        val lastAt = AppPrefs.lastMessageAt
        val sinceLast = if (lastAt > 0) {
            val mins = (nowMillis - lastAt) / 60_000
            "距离上次主动发消息约 $mins 分钟 (用户设置的最短间隔是 $intervalMin 分钟)"
        } else {
            "这是今天第一次主动发消息"
        }

        return """
            当前时间: $dateStr $timeStr ($timeOfDay)
            $sinceLast

            请主动给用户发一条简短、自然的消息。
        """.trimIndent()
    }
}

data class ProactiveMessage(
    val characterName: String,
    val content: String,
    val generatedAt: Long
)

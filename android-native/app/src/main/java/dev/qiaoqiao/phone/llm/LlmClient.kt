package dev.qiaoqiao.phone.llm

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * LLM 客户端
 * 调用 OpenAI 兼容的 chat/completions API
 * 支持任意 baseUrl (DeepSeek / OpenAI / 自建中转)
 */
class LlmClient(
    private val baseUrl: String,
    private val apiKey: String,
    private val model: String
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        explicitNulls = false
    }

    /**
     * 发送单轮对话, 返回 assistant 回复
     */
    suspend fun chat(
        systemPrompt: String,
        userMessage: String,
        temperature: Double = 0.85,
        maxTokens: Int = 200
    ): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val endpoint = buildEndpoint()
            val request = ChatRequest(
                model = model,
                messages = listOf(
                    Message(role = "system", content = systemPrompt),
                    Message(role = "user", content = userMessage)
                ),
                temperature = temperature,
                maxTokens = maxTokens
            )
            val body = json.encodeToString(request)
                .toRequestBody("application/json; charset=utf-8".toMediaType())

            val httpReq = Request.Builder()
                .url(endpoint)
                .addHeader("Authorization", "Bearer $apiKey")
                .addHeader("Content-Type", "application/json")
                .post(body)
                .build()

            client.newCall(httpReq).execute().use { resp ->
                val respBody = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) {
                    error("LLM HTTP ${resp.code}: ${respBody.take(200)}")
                }
                val parsed = json.decodeFromString<ChatResponse>(respBody)
                parsed.choices.firstOrNull()?.message?.content
                    ?: error("Empty choices in response")
            }
        }
    }

    private fun buildEndpoint(): String {
        val base = baseUrl.trimEnd('/')
        return if (base.endsWith("/chat/completions")) base else "$base/chat/completions"
    }

    @Serializable
    private data class Message(val role: String, val content: String)

    @Serializable
    private data class ChatRequest(
        val model: String,
        val messages: List<Message>,
        val temperature: Double = 0.85,
        @kotlinx.serialization.SerialName("max_tokens")
        val maxTokens: Int = 200
    )

    @Serializable
    private data class Choice(
        val index: Int = 0,
        val message: Message,
        @kotlinx.serialization.SerialName("finish_reason")
        val finishReason: String? = null
    )

    @Serializable
    private data class ChatResponse(
        val id: String? = null,
        val model: String? = null,
        val choices: List<Choice> = emptyList()
    )
}

package dev.qiaoqiao.phone.prefs

import android.content.Context
import android.content.SharedPreferences

/**
 * SharedPreferences 单例
 * 存: API 配置 / 启用开关 / 角色 / 上次消息时间 等
 */
object AppPrefs {
    private const val PREFS_NAME = "chilly_phone_prefs"

    // ---- 开关 ----
    private const val KEY_PROACTIVE_ENABLED = "proactive_enabled"
    private const val KEY_PROACTIVE_INTERVAL_MIN = "proactive_interval_min"
    private const val KEY_QUIET_HOURS_START = "quiet_hours_start"  // 0-23
    private const val KEY_QUIET_HOURS_END = "quiet_hours_end"      // 0-23

    // ---- LLM 配置 ----
    private const val KEY_LLM_BASE_URL = "llm_base_url"
    private const val KEY_LLM_API_KEY = "llm_api_key"
    private const val KEY_LLM_MODEL = "llm_model"
    private const val KEY_LLM_PROVIDER = "llm_provider"  // openai | deepseek | 自定义

    // ---- 角色 (简化版, 后期可从 PWA 同步) ----
    private const val KEY_CHARACTER_NAME = "character_name"
    private const val KEY_CHARACTER_PERSONA = "character_persona"
    private const val KEY_CHARACTER_AVATAR_URL = "character_avatar_url"

    // ---- 状态 ----
    private const val KEY_LAST_MESSAGE_AT = "last_message_at"

    // v1.10.232: 加载诊断, 写 SharedPreferences 让用户在下一次启动能看到"上一次卡哪"
    private const val KEY_LAST_LOAD_DIAG = "last_load_diag"
    private const val KEY_LAST_LOAD_ERROR = "last_load_error"

    private lateinit var sp: SharedPreferences

    fun init(context: Context) {
        sp = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // === 开关 ===
    var proactiveEnabled: Boolean
        get() = sp.getBoolean(KEY_PROACTIVE_ENABLED, false)
        set(v) = sp.edit().putBoolean(KEY_PROACTIVE_ENABLED, v).apply()

    var proactiveIntervalMin: Int
        get() = sp.getInt(KEY_PROACTIVE_INTERVAL_MIN, 30)  // 默认 30 分钟
        set(v) = sp.edit().putInt(KEY_PROACTIVE_INTERVAL_MIN, v).apply()

    var quietHoursStart: Int
        get() = sp.getInt(KEY_QUIET_HOURS_START, 23)  // 默认 23:00
        set(v) = sp.edit().putInt(KEY_QUIET_HOURS_START, v).apply()

    var quietHoursEnd: Int
        get() = sp.getInt(KEY_QUIET_HOURS_END, 7)  // 默认 07:00
        set(v) = sp.edit().putInt(KEY_QUIET_HOURS_END, v).apply()

    // === LLM ===
    var llmBaseUrl: String
        get() = sp.getString(KEY_LLM_BASE_URL, "https://api.deepseek.com/v1") ?: ""
        set(v) = sp.edit().putString(KEY_LLM_BASE_URL, v).apply()

    var llmApiKey: String
        get() = sp.getString(KEY_LLM_API_KEY, "") ?: ""
        set(v) = sp.edit().putString(KEY_LLM_API_KEY, v).apply()

    var llmModel: String
        get() = sp.getString(KEY_LLM_MODEL, "deepseek-chat") ?: ""
        set(v) = sp.edit().putString(KEY_LLM_MODEL, v).apply()

    var llmProvider: String
        get() = sp.getString(KEY_LLM_PROVIDER, "openai") ?: "openai"
        set(v) = sp.edit().putString(KEY_LLM_PROVIDER, v).apply()

    // === 角色 ===
    var characterName: String
        get() = sp.getString(KEY_CHARACTER_NAME, "小乔") ?: "小乔"
        set(v) = sp.edit().putString(KEY_CHARACTER_NAME, v).apply()

    var characterPersona: String
        get() = sp.getString(KEY_CHARACTER_PERSONA, "一个温柔、活泼、有点小傲娇的女生, 喜欢猫咪, 会主动关心用户的日常。") ?: ""
        set(v) = sp.edit().putString(KEY_CHARACTER_PERSONA, v).apply()

    var characterAvatarUrl: String
        get() = sp.getString(KEY_CHARACTER_AVATAR_URL, "") ?: ""
        set(v) = sp.edit().putString(KEY_CHARACTER_AVATAR_URL, v).apply()

    // === 状态 ===
    var lastMessageAt: Long
        get() = sp.getLong(KEY_LAST_MESSAGE_AT, 0L)
        set(v) = sp.edit().putLong(KEY_LAST_MESSAGE_AT, v).apply()

    // v1.10.232: WebView 加载诊断 (Toast / logcat 都看不到时, 这里能看到上次卡哪)
    var lastLoadDiag: String
        get() = sp.getString(KEY_LAST_LOAD_DIAG, "") ?: ""
        set(v) = sp.edit().putString(KEY_LAST_LOAD_DIAG, v).apply()

    var lastLoadError: String
        get() = sp.getString(KEY_LAST_LOAD_ERROR, "") ?: ""
        set(v) = sp.edit().putString(KEY_LAST_LOAD_ERROR, v).apply()

    fun isConfigured(): Boolean {
        return llmApiKey.isNotBlank() && llmBaseUrl.isNotBlank() && llmModel.isNotBlank()
    }
}

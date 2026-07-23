package dev.qiaoqiao.phone.bridge

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import dev.qiaoqiao.phone.BuildConfig
import dev.qiaoqiao.phone.ProactiveMessageService
import dev.qiaoqiao.phone.prefs.AppPrefs

/**
 * PWA ↔ 原生 桥接
 * WebView 里的 JS 可以通过 window.ChillyNative.xxx() 调用原生能力
 *
 * 用法 (JS 端):
 *   // 读取 LLM 配置 (从原生 SP, 让 PWA 不用重复填)
 *   const config = JSON.parse(window.ChillyNative.getLlmConfig())
 *
 *   // 启用 / 禁用主动消息
 *   window.ChillyNative.setProactiveEnabled(true)
 *
 *   // 主动请求立刻生成一条 (手动测试)
 *   window.ChillyNative.triggerMessageNow()
 */
class WebAppInterface(private val context: Context) {

    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun getLlmConfig(): String {
        return """
            {
              "baseUrl": "${escape(AppPrefs.llmBaseUrl)}",
              "apiKey": "${escape(AppPrefs.llmApiKey)}",
              "model": "${escape(AppPrefs.llmModel)}",
              "provider": "${escape(AppPrefs.llmProvider)}"
            }
        """.trimIndent()
    }

    @JavascriptInterface
    fun setLlmConfig(baseUrl: String, apiKey: String, model: String, provider: String): Boolean {
        AppPrefs.llmBaseUrl = baseUrl
        AppPrefs.llmApiKey = apiKey
        AppPrefs.llmModel = model
        AppPrefs.llmProvider = provider
        return AppPrefs.isConfigured()
    }

    @JavascriptInterface
    fun isProactiveEnabled(): Boolean = AppPrefs.proactiveEnabled

    @JavascriptInterface
    fun setProactiveEnabled(enabled: Boolean): Boolean {
        AppPrefs.proactiveEnabled = enabled
        if (enabled && AppPrefs.isConfigured()) {
            ProactiveMessageService.start(context)
        } else if (!enabled) {
            ProactiveMessageService.stop(context)
        }
        return AppPrefs.proactiveEnabled
    }

    @JavascriptInterface
    fun setProactiveInterval(min: Int) {
        AppPrefs.proactiveIntervalMin = min.coerceIn(1, 24 * 60)
    }

    @JavascriptInterface
    fun getProactiveInterval(): Int = AppPrefs.proactiveIntervalMin

    @JavascriptInterface
    fun setQuietHours(start: Int, end: Int) {
        AppPrefs.quietHoursStart = start.coerceIn(0, 23)
        AppPrefs.quietHoursEnd = end.coerceIn(0, 23)
    }

    @JavascriptInterface
    fun getCharacterName(): String = AppPrefs.characterName

    @JavascriptInterface
    fun setCharacterName(name: String) {
        AppPrefs.characterName = name
    }

    @JavascriptInterface
    fun getCharacterPersona(): String = AppPrefs.characterPersona

    @JavascriptInterface
    fun setCharacterPersona(persona: String) {
        AppPrefs.characterPersona = persona
    }

    /**
     * 立刻生成一条 (调试用, WebView JS 可调)
     */
    @JavascriptInterface
    fun triggerMessageNow() {
        ProactiveMessageService.start(context)
    }

    @JavascriptInterface
    fun showToast(message: String) {
        mainHandler.post {
            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun getPlatformInfo(): String {
        return """
            {
              "platform": "android",
              "version": "${android.os.Build.VERSION.RELEASE}",
              "sdk": ${android.os.Build.VERSION.SDK_INT}
            }
        """.trimIndent()
    }

    /**
     * 当前 native APP 版本号 (BuildConfig.VERSION_NAME).
     * PWA 用来判断 GitHub release 是不是新版本.
     */
    @JavascriptInterface
    fun getNativeAppVersion(): String = BuildConfig.VERSION_NAME

    /**
     * 打开浏览器到指定 URL (用户点 "更新" 时调).
     * 跳到 GitHub Releases 页面让用户点下载.
     */
    @JavascriptInterface
    fun openExternalUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            mainHandler.post {
                Toast.makeText(context, "无法打开链接: $e", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun escape(s: String): String =
        s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n")
}

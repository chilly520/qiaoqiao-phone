package dev.qiaoqiao.phone

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.webkit.WebView
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.ConsoleMessage
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import dev.qiaoqiao.phone.bridge.WebAppInterface
import dev.qiaoqiao.phone.prefs.AppPrefs
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * MainActivity
 * - 加载 PWA 到 WebView
 * - 申请通知权限 + 电池白名单
 * - 提供 JS Bridge (WebView ↔ 原生)
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    private val notifPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            startProactiveServiceIfReady()
            requestBatteryWhitelist()
        } else {
            Toast.makeText(this, R.string.perm_notification_rationale, Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        setupWebView()

        // 整体缩放 90%, 避免 PWA 在大屏手机上元素过大.
        // PWA 设计是 375px 宽的"虚拟手机", 真实 6.5 寸屏上 1:1 渲染会显得撑满.
        webView.setInitialScale(90)

        // 处理从通知点进来的数据
        handleNotificationIntent(intent)

        // 启动 5s 超时看门狗, onPageFinished 触发后取消.
        loadTimeoutHandler.postDelayed(loadTimeoutRunnable, 5000)
        // 加载本地 PWA (file:///android_asset/index.html).
        // 原因: 国内访问 Cloudflare Pages 慢, 远程加载会一直转圈.
        // 本地资源秒开, 只有调 LLM API (https) 时才走网络.
        // 想用最新 PWA 内容? 重装即可, 下次 build 会把新 dist/ 打进 assets.
        webView.loadUrl("file:///android_asset/index.html")

        // 申请权限
        requestPermissionsIfNeeded()

        // 后台检查 GitHub Releases 是否有新版本.
        // 有新版本时通过 evaluateJavascript 给 PWA 发 CustomEvent,
        // PWA 在设置页显示红点提醒, 用户点 "检查更新" 跳浏览器下载.
        checkForUpdates()
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            // 本地资源 (file:///android_asset/) 用默认缓存即可.
            // 之前设 LOAD_NO_CACHE 是为了规避 vivo/华为 WebView 的 HTTP 缓存问题,
            // 但 LOAD_NO_CACHE 强制每次重下 + 国内访问 Cloudflare 慢 → 一直转圈.
            // 现在资源在 APK 内, 不存在 hash 缓存问题, 用 LOAD_DEFAULT 即可.
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            // 允许 file:// 页面调用 https API (LLM).
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            // IndexedDB 需要
            domStorageEnabled = true
            // file:// 页面允许访问本地 file 资源 (assets 内)
            allowFileAccess = true
            allowContentAccess = true
        }

        webView.webViewClient = object : android.webkit.WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                Log.d(TAG, "WebView onPageStarted: $url")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "WebView onPageFinished: $url")
                // 加载完成, 取消超时看门狗
                loadTimeoutHandler.removeCallbacks(loadTimeoutRunnable)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                val url = request?.url?.toString() ?: "?"
                val code = error?.errorCode
                val desc = error?.description
                Log.e(TAG, "WebView onReceivedError: url=$url code=$code desc=$desc")
                // file:// 资源加载失败 → 弹 Toast 提示用户
                if (url.startsWith("file:///android_asset/") && code != null) {
                    Toast.makeText(
                        this@MainActivity,
                        "PWA 资源加载失败: ${code} $desc",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                val url = request?.url?.toString() ?: "?"
                val code = errorResponse?.statusCode
                Log.w(TAG, "WebView onReceivedHttpError: url=$url code=$code")
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                // file:// 内部 + 任何 https 都交给 WebView 加载
                return if (url.startsWith("file://") ||
                    url.startsWith("https://qiaqiao-phone.pages.dev/") ||
                    url.startsWith(BuildConfig.PWA_URL)) {
                    false
                } else {
                    // 真正的外链 (LLM API 文档等) 用浏览器打开
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                }
            }
        }

        // JS console 全部转发到 logcat, 标签 ChillyWebView
        // 用 `adb logcat -s ChillyWebView` 就能看到 PWA 内部 console.log
        webView.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage?): Boolean {
                if (msg != null) {
                    Log.d(
                        "ChillyWebView",
                        "[${msg.messageLevel()}] ${msg.message()} (${msg.sourceId()}:${msg.lineNumber()})"
                    )
                }
                return true
            }
        }

        // 注册 JS Bridge
        webView.addJavascriptInterface(
            WebAppInterface(this),
            JS_BRIDGE_NAME
        )
    }

    private fun handleNotificationIntent(intent: Intent?) {
        if (intent == null) return
        val charName = intent.getStringExtra(dev.qiaoqiao.phone.notif.Notifier.EXTRA_CHARACTER_NAME)
        val content = intent.getStringExtra(dev.qiaoqiao.phone.notif.Notifier.EXTRA_MESSAGE_CONTENT)
        // 后续: 这里可以注入 JS 把消息同步到 PWA 那边
        if (charName != null && content != null) {
            // TODO: 注入 JS, 让 PWA 把这条消息存到 chatStore
        }
    }

    private fun requestPermissionsIfNeeded() {
        // 通知权限 (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val perm = Manifest.permission.POST_NOTIFICATIONS
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                notifPermLauncher.launch(perm)
                return
            }
        }
        // 没授权就跳过服务
        startProactiveServiceIfReady()
        requestBatteryWhitelist()
    }

    private fun startProactiveServiceIfReady() {
        if (AppPrefs.proactiveEnabled && AppPrefs.isConfigured()) {
            ProactiveMessageService.start(this)
        }
    }

    private fun requestBatteryWhitelist() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(android.os.PowerManager::class.java)
            if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.parse("package:$packageName"))
                try {
                    startActivity(intent)
                } catch (_: Exception) {
                    // 部分定制 ROM 不支持, 静默
                }
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    /**
     * 后台调 GitHub Releases API 检查有没有新版本.
     * - 本地: BuildConfig.VERSION_NAME ("1.10.202")
     * - remote: release.tag_name ("v1.10.202-native") → 去掉 v 前缀和 -native 后缀得到 "1.10.202"
     * - remote > local → evaluateJavascript 给 PWA 发 CustomEvent
     * - 网络失败静默忽略 (不影响 APP 启动)
     */
    private fun checkForUpdates() {
        val localVersion = BuildConfig.VERSION_NAME
        Thread {
            try {
                val client = OkHttpClient.Builder()
                    .connectTimeout(5, TimeUnit.SECONDS)
                    .readTimeout(5, TimeUnit.SECONDS)
                    .build()
                val req = Request.Builder()
                    .url("https://api.github.com/repos/chilly520/qiaoqiao-phone/releases/latest")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use
                    val body = resp.body?.string() ?: return@use
                    val json = JSONObject(body)
                    val tagName = json.optString("tag_name", "")
                    val htmlUrl = json.optString("html_url", "")
                    // tag 形如 "v1.10.202-native" → 纯版本 "1.10.202"
                    val remoteVer = tagName.removePrefix("v").removeSuffix("-native")
                    if (remoteVer.isNotEmpty() && isNewerVersion(remoteVer, localVersion)) {
                        // 通知 PWA (PWA 监听 'chilly-update-available' CustomEvent)
                        val js = """
                            (function(){
                              try {
                                window.dispatchEvent(new CustomEvent('chilly-update-available', {
                                  detail: { version: ${jsString(remoteVer)}, url: ${jsString(htmlUrl)} }
                                }));
                              } catch(e) {}
                            })();
                        """.trimIndent()
                        runOnUiThread { webView.evaluateJavascript(js, null) }
                    }
                }
            } catch (_: Exception) {
                // 静默, 检查更新失败不影响 APP
            }
        }.start()
    }

    private fun jsString(s: String): String {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
    }

    /**
     * 比较 semver "1.10.202" > "1.10.201" 这种.
     */
    private fun isNewerVersion(remote: String, local: String): Boolean {
        val r = remote.split(".").mapNotNull { it.toIntOrNull() }
        val l = local.split(".").mapNotNull { it.toIntOrNull() }
        for (i in 0 until maxOf(r.size, l.size)) {
            val rv = r.getOrElse(i) { 0 }
            val lv = l.getOrElse(i) { 0 }
            if (rv > lv) return true
            if (rv < lv) return false
        }
        return false
    }

    companion object {
        const val JS_BRIDGE_NAME = "ChillyNative"
        private const val TAG = "ChillyMainActivity"
    }
}

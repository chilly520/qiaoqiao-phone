package dev.qiaoqiao.phone

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import dev.qiaoqiao.phone.bridge.WebAppInterface
import dev.qiaoqiao.phone.prefs.AppPrefs

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

        // 处理从通知点进来的数据
        handleNotificationIntent(intent)

        // 加载本地 PWA (file:///android_asset/index.html).
        // 原因: 国内访问 Cloudflare Pages 慢, 远程加载会一直转圈.
        // 本地资源秒开, 只有调 LLM API (https) 时才走网络.
        // 想用最新 PWA 内容? 重装即可, 下次 build 会把新 dist/ 打进 assets.
        webView.loadUrl("file:///android_asset/index.html")

        // 申请权限
        requestPermissionsIfNeeded()
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
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: android.webkit.WebResourceRequest?
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

    companion object {
        const val JS_BRIDGE_NAME = "ChillyNative"
    }
}

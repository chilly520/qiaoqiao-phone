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
import androidx.webkit.WebViewAssetLoader
import android.webkit.WebViewClient
import dev.qiaoqiao.phone.bridge.WebAppInterface
import dev.qiaoqiao.phone.prefs.AppPrefs
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader

    // v1.10.232: 加载诊断状态 (启动后记住, 写 SharedPreferences, 下次启动 Toast 出来)
    private var isPageFinished = false
    private var lastLoadedUrl = ""
    private var resourceErrorCount = 0
    private var httpErrorCount = 0

    private val loadTimeoutHandler = Handler(Looper.getMainLooper())
    private val loadTimeoutRunnable = Runnable {
        Toast.makeText(
            this,
            "PWA 加载中, 请稍候…\n(首次启动需要几秒钟)",
            Toast.LENGTH_LONG
        ).show()
        Log.w(TAG, "WebView load timeout (5s) — still loading or stuck")
    }

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

        webView.setInitialScale(90)

        handleNotificationIntent(intent)

        // v1.10.232: 启动时显示上一次的加载诊断, 让用户知道上次为什么卡住
        val prevDiag = AppPrefs.lastLoadDiag
        val prevErr = AppPrefs.lastLoadError
        if (prevErr.isNotBlank()) {
            Toast.makeText(this, "上次加载出错:\n$prevErr", Toast.LENGTH_LONG).show()
        } else if (prevDiag.isNotBlank() && prevDiag.contains("TIMEOUT")) {
            Toast.makeText(this, "上次加载卡住:\n$prevDiag", Toast.LENGTH_LONG).show()
        }

        // v1.10.232: 清掉上次状态 (诊断读完后清掉, 避免每次启动都显示)
        AppPrefs.lastLoadError = ""
        AppPrefs.lastLoadDiag = ""

        val loadStartTime = System.currentTimeMillis()
        loadTimeoutHandler.postDelayed(loadTimeoutRunnable, 5000)

        // v1.10.232: 30 秒硬超时 (5s soft Toast + 30s hard 标记"卡在加载")
        loadTimeoutHandler.postDelayed({
            if (!isPageFinished) {
                val diag = "TIMEOUT(30s)\nurl=${lastLoadedUrl}\nresourceErrors=${resourceErrorCount}\nhttpErrors=${httpErrorCount}"
                AppPrefs.lastLoadDiag = diag
                runOnUiThread {
                    Toast.makeText(this, "加载超时 (30s):\n$diag", Toast.LENGTH_LONG).show()
                }
            }
        }, 30000)

        // WebViewAssetLoader: AndroidX 官方方案.
        // 把 APK 内 assets/ 映射到 https://appassets.androidplatform.net/assets/...,
        // 自动处理 MIME type, 无 file:// CORS 问题, 所有 Android 版本一致.
        // Vite base 设为 './', 相对路径 ./assets/xxx.js 正确解析为
        // https://appassets.androidplatform.net/assets/assets/xxx.js
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        lastLoadedUrl = webView.url ?: "https://appassets.androidplatform.net/assets/index.html"

        requestPermissionsIfNeeded()
        checkForUpdates()
    }

    private fun setupWebView() {
        // WebViewAssetLoader: 用 AssetsPathHandler 把 /assets/ 映射到 APK assets 目录.
        // 它内部会自动设置正确的 MIME type (.js → text/javascript, .css → text/css 等).
        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/res/", WebViewAssetLoader.ResourcesPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false
        }

        // 不用 androidx.webkit.WebViewClientCompat — 1.10+ 把 onReceivedError / onReceivedHttpError 标成 final 不能 override
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                // WebViewAssetLoader 拦截并处理 appassets.androidplatform.net 请求,
                // 返回正确 MIME type 的 WebResourceResponse, 其他请求返回 null 走正常网络.
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                Log.d(TAG, "WebView onPageStarted: $url")
                lastLoadedUrl = url ?: ""
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "WebView onPageFinished: $url")
                isPageFinished = true
                lastLoadedUrl = url ?: ""
                loadTimeoutHandler.removeCallbacks(loadTimeoutRunnable)

                // v1.10.232: 详细诊断 — 页面加载完立刻 evaluateJavascript 检查 DOM 状态,
                // 写 SharedPreferences, 下次启动 Toast 出来 (用户不用 logcat 也能看到)
                Handler(Looper.getMainLooper()).postDelayed({
                    webView.evaluateJavascript("""
                        (function(){
                            var app=document.getElementById('app');
                            var splash=document.getElementById('native-splash');
                            var cs=app?app.children.length:0;
                            var rs=document.readyState;
                            var sb=splash?getComputedStyle(splash).opacity:'none';
                            return JSON.stringify({
                                readyState: rs,
                                appChildren: cs,
                                appExists: !!app,
                                splashOpacity: sb,
                                title: document.title
                            });
                        })();
                    """.trimIndent()) { result ->
                        val safe = result?.replace("\"", "'") ?: "null"
                        AppPrefs.lastLoadDiag = "URL=${lastLoadedUrl}\nDOM=${safe}\nerrCount=${resourceErrorCount}\nhttpErrCount=${httpErrorCount}"
                        if (result != null && (result.contains("\"appChildren\":0") || result.contains("\"appExists\":false"))) {
                            runOnUiThread {
                                Toast.makeText(
                                    this@MainActivity,
                                    "Vue 未挂载:\n${safe}",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        }
                    }
                }, 3000)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: android.webkit.WebResourceError
            ) {
                resourceErrorCount++
                val msg = "url=${request.url} code=${error.errorCode} desc=${error.description}"
                Log.e(TAG, "WebView onReceivedError: $msg")
                AppPrefs.lastLoadError = msg
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse
            ) {
                httpErrorCount++
                val msg = "HTTP url=${request.url} status=${errorResponse.statusCode}"
                Log.w(TAG, "WebView onReceivedHttpError: $msg")
                // HTTP 错误不一定是致命的 (CDN/PWA 上可能有), 不覆盖 lastLoadError,
                // 但累加 httpErrorCount, onPageFinished 时一起写 diag
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                // appassets.androidplatform.net (本地 PWA) + pages.dev (线上) 交给 WebView
                return if (url.startsWith("https://appassets.androidplatform.net/") ||
                    url.startsWith(BuildConfig.PWA_URL)) {
                    false
                } else {
                    // 外链用浏览器打开
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                }
            }
        }

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

        webView.addJavascriptInterface(
            WebAppInterface(this),
            JS_BRIDGE_NAME
        )
    }

    private fun handleNotificationIntent(intent: Intent?) {
        if (intent == null) return
        val charName = intent.getStringExtra(dev.qiaoqiao.phone.notif.Notifier.EXTRA_CHARACTER_NAME)
        val content = intent.getStringExtra(dev.qiaoqiao.phone.notif.Notifier.EXTRA_MESSAGE_CONTENT)
        if (charName != null && content != null) {
            // TODO: 注入 JS, 让 PWA 把这条消息存到 chatStore
        }
    }

    private fun requestPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val perm = Manifest.permission.POST_NOTIFICATIONS
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                notifPermLauncher.launch(perm)
                return
            }
        }
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
                } catch (_: Exception) {}
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
                    val remoteVer = tagName.removePrefix("v").removeSuffix("-native")
                    if (remoteVer.isNotEmpty() && isNewerVersion(remoteVer, localVersion)) {
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
            } catch (_: Exception) {}
        }.start()
    }

    private fun jsString(s: String): String {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
    }

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

package dev.qiaoqiao.phone.update

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.webkit.MimeTypeMap
import android.webkit.WebView
import android.widget.Toast
import androidx.core.content.FileProvider
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * 在 APP 内部直接下载新版本 APK, 下载完调系统安装器.
 * 关键: 不走浏览器, 不走 vivo 应用商店 (它们会拦截并限速到 0.30 KB/s).
 * 走 APP 自己的 OkHttp, 下载到 APP 私有目录, FileProvider 给系统安装器读.
 *
 * 用法 (从 JS bridge 调用):
 *   window.ChillyNative.downloadAndInstall(releaseUrl)
 *   releaseUrl 形如 https://github.com/.../chilly-phone-native-1.10.205.apk
 */
class AppUpdateManager(
    private val context: Context,
    private val webView: WebView
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    fun start(releaseUrl: String) {
        // releaseUrl 是 release 页 URL (https://github.com/.../releases/tag/vX.X.X-native)
        // 需要从里面提取 apk 下载地址. 直接调 GitHub API /releases/latest 拿 assets URL 更稳.
        Thread {
            try {
                // 用 redirect 跟踪找到 .apk URL
                val client = OkHttpClient.Builder()
                    .connectTimeout(8, TimeUnit.SECONDS)
                    .readTimeout(8, TimeUnit.SECONDS)
                    .followRedirects(true)
                    .build()

                val apiUrl = "https://api.github.com/repos/chilly520/qiaoqiao-phone/releases/latest"
                val req = Request.Builder()
                    .url(apiUrl)
                    .header("Accept", "application/vnd.github+json")
                    .build()
                val resp = client.newCall(req).execute()
                if (!resp.isSuccessful) {
                    notifyError("检查更新失败: HTTP ${resp.code}")
                    resp.close()
                    return@Thread
                }
                val body = resp.body?.string() ?: run {
                    notifyError("检查更新失败: 空响应")
                    resp.close()
                    return@Thread
                }
                resp.close()

                // 找 native APK 资源 URL
                val apkUrl = extractNativeApkUrl(body) ?: run {
                    notifyError("没找到 native APK 资源")
                    return@Thread
                }
                val version = extractTagName(body) ?: run {
                    notifyError("没找到版本号")
                    return@Thread
                }

                // 通知 PWA 开始下载
                notifyProgress(version, "downloading", 0, -1L)

                // 下载 APK
                val downloadReq = Request.Builder().url(apkUrl).build()
                client.newCall(downloadReq).execute().use { downloadResp ->
                    if (!downloadResp.isSuccessful) {
                        notifyError("下载失败: HTTP ${downloadResp.code}")
                        return@Thread
                    }
                    val downloadBody = downloadResp.body ?: run {
                        notifyError("下载响应为空")
                        return@Thread
                    }
                    val totalBytes = downloadBody.contentLength()

                    // 写到 APP 私有 downloads 目录 (vivo 不会接管)
                    val outDir = File(context.getExternalFilesDir(null), "downloads")
                    if (!outDir.exists()) outDir.mkdirs()
                    val outFile = File(outDir, "chilly-update-$version.apk")

                    downloadBody.byteStream().use { input ->
                        outFile.outputStream().use { output ->
                            val buf = ByteArray(64 * 1024)
                            var downloaded = 0L
                            var lastNotify = 0L
                            while (true) {
                                val n = input.read(buf)
                                if (n <= 0) break
                                output.write(buf, 0, n)
                                downloaded += n
                                // 每 200ms 通知一次进度
                                val now = System.currentTimeMillis()
                                if (now - lastNotify > 200) {
                                    val percent = if (totalBytes > 0) (downloaded * 100 / totalBytes).toInt() else -1
                                    notifyProgress(version, "downloading", percent, downloaded)
                                    lastNotify = now
                                }
                            }
                        }
                    }
                    notifyProgress(version, "downloading", 100, outFile.length())
                    installApk(outFile)
                }
            } catch (e: Exception) {
                notifyError("更新异常: ${e.message}")
            }
        }.start()
    }

    private fun installApk(apkFile: File) {
        mainHandler.post {
            try {
                val uri: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    FileProvider.getUriForFile(
                        context,
                        "${context.packageName}.fileprovider",
                        apkFile
                    )
                } else {
                    Uri.fromFile(apkFile)
                }

                // Android 8.0+ 需要"安装未知来源应用"权限
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!context.packageManager.canRequestPackageInstalls()) {
                        // 跳设置让用户开
                        Toast.makeText(context, "请允许'安装未知应用'权限", Toast.LENGTH_LONG).show()
                        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                            data = Uri.parse("package:${context.packageName}")
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        context.startActivity(intent)
                        // 用户开完权限回来再装: 发个 CustomEvent 通知 PWA
                        notifyProgress("?", "need-permission", -1, -1L)
                        return@post
                    }
                }

                val install = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(install)
                notifyProgress("?", "installing", -1, -1L)
            } catch (e: Exception) {
                notifyError("启动安装器失败: ${e.message}")
            }
        }
    }

    private fun notifyProgress(version: String, stage: String, percent: Int, downloaded: Long) {
        val js = """
            (function(){
              try {
                window.dispatchEvent(new CustomEvent('chilly-update-progress', {
                  detail: { version: ${jsString(version)}, stage: ${jsString(stage)}, percent: $percent, downloaded: $downloaded }
                }));
              } catch(e) {}
            })();
        """.trimIndent()
        mainHandler.post { webView.evaluateJavascript(js, null) }
    }

    private fun notifyError(msg: String) {
        mainHandler.post {
            Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
            val js = """
                (function(){
                  try {
                    window.dispatchEvent(new CustomEvent('chilly-update-progress', {
                      detail: { version: '', stage: 'error', percent: -1, error: ${jsString(msg)} }
                    }));
                  } catch(e) {}
                })();
            """.trimIndent()
            webView.evaluateJavascript(js, null)
        }
    }

    private fun jsString(s: String): String {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
    }

    private fun extractNativeApkUrl(json: String): String? {
        // 找 "browser_download_url": "..../chilly-phone-native-X.Y.Z.apk"
        val regex = Regex("\"browser_download_url\"\\s*:\\s*\"([^\"]*chilly-phone-native-[^\"]+\\.apk)\"")
        return regex.find(json)?.groupValues?.get(1)
    }

    private fun extractTagName(json: String): String? {
        val regex = Regex("\"tag_name\"\\s*:\\s*\"v([^\"]+)\"")
        return regex.find(json)?.groupValues?.get(1)
    }
}

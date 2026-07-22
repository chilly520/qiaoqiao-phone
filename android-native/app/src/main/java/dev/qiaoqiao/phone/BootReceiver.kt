package dev.qiaoqiao.phone

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import dev.qiaoqiao.phone.prefs.AppPrefs

/**
 * 开机自启 / APP 更新
 * 满足条件 (启用 + 配置好) 就启动 ProactiveMessageService
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.i("BootReceiver", "Received $action")

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                AppPrefs.init(context)
                if (AppPrefs.proactiveEnabled && AppPrefs.isConfigured()) {
                    ProactiveMessageService.start(context)
                }
            }
        }
    }
}

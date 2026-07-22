package dev.qiaoqiao.phone

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import dev.qiaoqiao.phone.prefs.AppPrefs
import dev.qiaoqiao.phone.work.ProactiveWorker

/**
 * Application 入口
 * - 初始化 SharedPreferences
 * - 创建通知渠道 (Android 8+)
 */
class ChillyApp : Application() {

    override fun onCreate() {
        super.onCreate()
        AppPrefs.init(this)
        createNotificationChannels()
        ProactiveWorker.ensureScheduled(this)
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // 渠道 1: 角色消息 (用户可见的通知)
        val roleChannel = NotificationChannel(
            CHANNEL_ROLE_MESSAGE,
            getString(R.string.notif_channel_role_message),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = getString(R.string.notif_channel_role_message_desc)
            enableVibration(true)
            setShowBadge(true)
        }
        nm.createNotificationChannel(roleChannel)

        // 渠道 2: 前台服务运行中 (持续显示, 低优先级)
        val serviceChannel = NotificationChannel(
            CHANNEL_SERVICE_RUNNING,
            "Chilly Phone 运行中",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "显示 Chilly Phone 正在后台运行, 角色消息能正常收到"
            setShowBadge(false)
        }
        nm.createNotificationChannel(serviceChannel)
    }

    companion object {
        const val CHANNEL_ROLE_MESSAGE = "role_message"
        const val CHANNEL_SERVICE_RUNNING = "service_running"

        fun from(context: Context): ChillyApp =
            context.applicationContext as ChillyApp
    }
}

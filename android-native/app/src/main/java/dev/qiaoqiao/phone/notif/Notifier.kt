package dev.qiaoqiao.phone.notif

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import dev.qiaoqiao.phone.ChillyApp
import dev.qiaoqiao.phone.MainActivity
import dev.qiaoqiao.phone.R
import dev.qiaoqiao.phone.llm.ProactiveMessage

/**
 * 通知封装
 * - 角色消息: 仿微信式, 折叠/展开, 显示头像 + 名字 + 预览
 */
class Notifier(private val context: Context) {

    private val nm = NotificationManagerCompat.from(context)

    /**
     * 发一条角色消息
     */
    fun postRoleMessage(msg: ProactiveMessage) {
        if (!nm.areNotificationsEnabled()) return

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_CHARACTER_NAME, msg.characterName)
            putExtra(EXTRA_MESSAGE_CONTENT, msg.content)
            putExtra(EXTRA_MESSAGE_AT, msg.generatedAt)
        }
        val pi = PendingIntent.getActivity(
            context,
            msg.generatedAt.toInt(),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 模拟角色头像 (用系统图标代替, 真实头像后续可加)
        val avatar = R.drawable.ic_notification

        val bigTextStyle = NotificationCompat.BigTextStyle()
            .setBigContentTitle(msg.characterName)
            .bigText(msg.content)
            .setSummaryText("Chilly Phone")

        val notification = NotificationCompat.Builder(context, ChillyApp.CHANNEL_ROLE_MESSAGE)
            .setSmallIcon(avatar)
            .setLargeIcon(android.graphics.BitmapFactory.decodeResource(
                context.resources,
                avatar
            ))
            .setContentTitle(msg.characterName)
            .setContentText(msg.content)
            .setStyle(bigTextStyle)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setWhen(msg.generatedAt)
            .build()

        try {
            nm.notify(NOTIF_ID_ROLE_MESSAGE, notification)
        } catch (e: SecurityException) {
            // 用户没授权 POST_NOTIFICATIONS, 静默忽略
        }
    }

    /**
     * 前台服务常驻通知 (低优先级, 不打扰用户)
     */
    fun postServiceRunning(): Int {
        if (!nm.areNotificationsEnabled()) return NOTIF_ID_SERVICE

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, ChillyApp.CHANNEL_SERVICE_RUNNING)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.service_role_message_title))
            .setContentText(context.getString(R.string.service_role_message_text))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pi)
            .build()

        return NOTIF_ID_SERVICE.also { id ->
            try {
                nm.notify(id, notification)
            } catch (_: SecurityException) {}
        }
    }

    companion object {
        const val NOTIF_ID_ROLE_MESSAGE = 1001
        const val NOTIF_ID_SERVICE = 1002

        const val EXTRA_CHARACTER_NAME = "extra_character_name"
        const val EXTRA_MESSAGE_CONTENT = "extra_message_content"
        const val EXTRA_MESSAGE_AT = "extra_message_at"
    }
}

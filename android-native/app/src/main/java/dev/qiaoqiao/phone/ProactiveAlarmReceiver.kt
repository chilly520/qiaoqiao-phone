package dev.qiaoqiao.phone

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Alarm 到点接收器
 * 把 ACTION_TICK 转发给 ProactiveMessageService
 */
class ProactiveAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d(ProactiveMessageService.TAG, "AlarmReceiver fired action=${intent.action}")
        val svc = Intent(context, ProactiveMessageService::class.java).apply {
            action = intent.action
        }
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(svc)
            } else {
                context.startService(svc)
            }
        } catch (e: Exception) {
            Log.e(ProactiveMessageService.TAG, "Failed to start service from alarm", e)
        }
    }
}

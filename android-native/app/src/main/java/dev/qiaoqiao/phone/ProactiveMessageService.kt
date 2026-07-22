package dev.qiaoqiao.phone

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import dev.qiaoqiao.phone.llm.MessageGenerator
import dev.qiaoqiao.phone.notif.Notifier
import dev.qiaoqiao.phone.prefs.AppPrefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * 前台服务
 * 角色主动发消息 - 即使 APP 在后台/锁屏也常驻
 *
 * 调度策略:
 *  - 用 AlarmManager 精准定时 (到点拉起自己, 避免 setInterval 漂移)
 *  - 同时启一个协程定时自检, 兜底
 *  - 静默时段 (默认 23:00 - 07:00) 不发消息
 *  - 最短间隔不少于用户配置
 */
class ProactiveMessageService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var tickJob: Job? = null
    private val notifier by lazy { Notifier(this) }
    private val generator = MessageGenerator()

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Service onCreate")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "Service onStartCommand action=${intent?.action}")

        // 提升为前台服务 (必须 5s 内调用, 否则 ANR)
        startForegroundCompat()

        when (intent?.action) {
            ACTION_TICK -> {
                // 定时到点, 检查是否要发消息
                tickJob?.cancel()
                tickJob = scope.launch { tryGenerateAndNotify() }
            }
            else -> {
                // 首次启动 / 正常 START, 启动兜底协程 + 安排下一次 alarm
                startInternalTicker()
                scheduleNextAlarm()
            }
        }
        return START_STICKY
    }

    private fun startForegroundCompat() {
        val notif = notifier.postServiceRunning()
        try {
            startForeground(notif, null)
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed", e)
        }
    }

    /**
     * 兜底协程: 每分钟检查一次 (alarm 是精准触发, 这个是兜底)
     */
    private fun startInternalTicker() {
        if (tickJob?.isActive == true) return
        tickJob = scope.launch {
            while (true) {
                delay(60_000L)
                if (shouldSendNow()) {
                    tryGenerateAndNotify()
                    scheduleNextAlarm()
                }
            }
        }
    }

    private suspend fun tryGenerateAndNotify() {
        if (!AppPrefs.proactiveEnabled) {
            Log.d(TAG, "proactive disabled, skip")
            return
        }
        if (!AppPrefs.isConfigured()) {
            Log.w(TAG, "LLM not configured, skip")
            return
        }
        if (isInQuietHours()) {
            Log.d(TAG, "quiet hours, skip")
            return
        }

        val intervalMin = AppPrefs.proactiveIntervalMin.coerceIn(1, 24 * 60)
        val lastAt = AppPrefs.lastMessageAt
        val nowMs = System.currentTimeMillis()
        if (lastAt > 0 && (nowMs - lastAt) < intervalMin * 60_000L) {
            Log.d(TAG, "too soon, skip. last=${(nowMs - lastAt) / 1000}s ago, min=${intervalMin * 60}s")
            return
        }

        val result = generator.generateProactiveMessage()
        result.onSuccess { msg ->
            AppPrefs.lastMessageAt = nowMs
            notifier.postRoleMessage(msg)
            Log.i(TAG, "Sent proactive message: ${msg.content.take(30)}")
        }.onFailure { e ->
            Log.e(TAG, "Failed to generate: ${e.message}", e)
        }
    }

    private fun shouldSendNow(): Boolean {
        if (!AppPrefs.proactiveEnabled) return false
        if (!AppPrefs.isConfigured()) return false
        if (isInQuietHours()) return false
        val intervalMin = AppPrefs.proactiveIntervalMin.coerceIn(1, 24 * 60)
        val nowMs = System.currentTimeMillis()
        val lastAt = AppPrefs.lastMessageAt
        // 从未发过, 或距上次超过 interval 即可
        if (lastAt <= 0) return true
        return (nowMs - lastAt) >= intervalMin * 60_000L
    }

    private fun isInQuietHours(): Boolean {
        val start = AppPrefs.quietHoursStart
        val end = AppPrefs.quietHoursEnd
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return if (start <= end) {
            hour in start until end
        } else {
            // 跨午夜, 例如 23-7
            hour >= start || hour < end
        }
    }

    /**
     * 安排下一次 alarm (精准触发)
     */
    private fun scheduleNextAlarm() {
        val intervalMin = AppPrefs.proactiveIntervalMin.coerceIn(1, 24 * 60)
        val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAt = SystemClock.elapsedRealtime() + intervalMin * 60_000L

        val intent = Intent(this, ProactiveAlarmReceiver::class.java).apply {
            action = ACTION_TICK
        }
        val pi = PendingIntent.getBroadcast(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (am.canScheduleExactAlarms()) {
                    am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
                }
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pi)
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "Schedule alarm failed: ${e.message}")
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        Log.i(TAG, "Service onDestroy")
        super.onDestroy()
    }

    companion object {
        const val TAG = "ProactiveSvc"
        const val ACTION_TICK = "dev.qiaoqiao.phone.TICK"

        /**
         * 启动服务
         */
        fun start(context: Context) {
            val intent = Intent(context, ProactiveMessageService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, ProactiveMessageService::class.java))
        }
    }
}

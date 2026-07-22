package dev.qiaoqiao.phone.work

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.qiaoqiao.phone.ProactiveMessageService
import dev.qiaoqiao.phone.prefs.AppPrefs
import java.util.concurrent.TimeUnit

/**
 * WorkManager 兜底
 * 即使前台服务被系统杀掉, 这个周期性任务也能拉起
 * 间隔最少 15 分钟 (WorkManager 限制)
 */
class ProactiveWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        Log.d(TAG, "ProactiveWorker tick")
        AppPrefs.init(applicationContext)
        if (AppPrefs.proactiveEnabled && AppPrefs.isConfigured()) {
            // 用 service 跑实际生成 (service 能保活, worker 不行)
            ProactiveMessageService.start(applicationContext)
        }
        return Result.success()
    }

    companion object {
        const val TAG = "ProactiveWorker"
        const val UNIQUE_NAME = "chilly_proactive_tick"

        fun ensureScheduled(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<ProactiveWorker>(
                15, TimeUnit.MINUTES  // WorkManager 最小周期
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_NAME)
        }
    }
}

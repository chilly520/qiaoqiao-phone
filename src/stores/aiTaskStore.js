import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { generateImage } from '../utils/aiService'
import { useLoggerStore } from './loggerStore'

/**
 * 全局 AI 任务 Store
 * 用于管理所有耗时的 AI 生成任务，确保任务在后台持续运行，不受页面切换影响
 */
export const useAITaskStore = defineStore('aiTasks', () => {
    const logger = useLoggerStore()

    // 任务状态管理
    const activeTasks = reactive(new Map()) // taskId -> { status, progress, result, error, abortController }
    const taskResults = reactive(new Map()) // taskId -> result data

    // 任务状态枚举
    const TaskStatus = {
        PENDING: 'pending',
        RUNNING: 'running',
        COMPLETED: 'completed',
        FAILED: 'failed',
        ABORTED: 'aborted'
    }

    /**
     * 创建并执行一个流式 AI 请求任务
     * @param {string} taskId - 唯一任务 ID
     * @param {Function} apiFunc - AI API 函数（如 generateReply）
     * @param {Array} args - API 函数参数
     * @param {Function} onChunk - 流式数据块回调
     * @param {Function} onComplete - 完成回调
     * @param {Function} onError - 错误回调
     */
    async function createStreamingTask({
        taskId,
        apiFunc,
        args,
        onChunk,
        onComplete,
        onError
    }) {
        // 如果任务已存在，先取消
        if (activeTasks.has(taskId)) {
            abortTask(taskId)
        }

        // 初始化任务状态
        activeTasks.set(taskId, {
            status: TaskStatus.PENDING,
            progress: 0,
            result: null,
            error: null,
            abortController: new AbortController()
        })

        // [BUG FIX] 捕获当前 task 引用, 防止旧任务的 AbortError 误覆盖新任务状态
        const myTask = activeTasks.get(taskId)

        try {
            // 更新状态为运行中
            myTask.status = TaskStatus.RUNNING

            // 执行 AI 请求
            const result = await apiFunc(...args, myTask.abortController.signal, {
                onChunk: (delta, fullContent) => {
                    // 流式数据回调
                    if (onChunk) onChunk(delta, fullContent)
                }
            })

            // 任务完成
            if (myTask.status === TaskStatus.RUNNING) {
                myTask.status = TaskStatus.COMPLETED
                myTask.result = result
                myTask.progress = 100

                // 存储结果
                taskResults.set(taskId, result)

                // 回调
                if (onComplete) onComplete(result)
            }
        } catch (error) {
            // 任务失败处理
            // [BUG FIX] 只处理属于当前 task 的错误, 旧 task 的 AbortError 不应影响新 task
            if (activeTasks.get(taskId) !== myTask) {
                // 当前 taskId 已被新任务覆盖, 丢弃旧任务的错误
                return
            }
            if (myTask) {
                // [BUG FIX] 原代码 status 判断用宽谓词 (name === 'AbortError' || message 含 aborted),
                // 但 onError 调用判断用窄谓词 (仅 name !== 'AbortError'). 这导致:
                // 当 error.name 不是 AbortError 但 message 包含 'aborted' (例如某些 fetch wrapper
                // 把 AbortError 重命名为 DOMException 或自定义 Error) 时, status 被设为 ABORTED
                // (认为已取消), 但 onError 仍被调用 (认为真实错误). 监听 onError 的 UI 会弹出
                // 错误 toast, 同时状态条显示"已取消", 行为自相矛盾. 用统一的 isAbort 标志.
                const isAbort = error.name === 'AbortError' ||
                    error.message?.includes('aborted') ||
                    error.message?.includes('signal is aborted')

                if (isAbort) {
                    myTask.status = TaskStatus.ABORTED
                    console.log(`[AITaskStore] Task ${taskId} was aborted (component unmounted or user cancelled)`);
                } else {
                    myTask.status = TaskStatus.FAILED
                    myTask.error = error.message
                    logger?.addLog('ERROR', `AI 任务 ${taskId} 失败`, error.message)
                }

                // 回调 - 只在非中止错误时调用 onError
                if (onError && !isAbort) onError(error)
            }
        } finally {
            // 清理 abortController（延迟清理，避免立即清理导致的问题）
            // [BUG FIX] 保存 setTimeout ID 到 task 上, 若 task 在 5s 内被同 ID 新任务覆盖,
            // 旧定时器仍会触发但被 `=== myTask` 守卫挡住, 这里把 timer 也存一下便于排查.
            myTask._cleanupTimer = setTimeout(() => {
                myTask._cleanupTimer = null
                // [BUG FIX] 只在 task 仍为当前 task 时清理
                if (activeTasks.get(taskId) === myTask &&
                    (myTask.status === TaskStatus.COMPLETED || myTask.status === TaskStatus.FAILED || myTask.status === TaskStatus.ABORTED)) {
                    activeTasks.delete(taskId)
                }
            }, 5000) // 5 秒后清理已完成任务
        }
    }

    /**
     * 取消/中止任务
     * @param {string} taskId - 任务 ID
     */
    function abortTask(taskId) {
        const task = activeTasks.get(taskId)
        if (task && task.abortController) {
            task.abortController.abort()
            task.status = TaskStatus.ABORTED
            logger?.addLog('INFO', `AI 任务 ${taskId} 已中止`)
        }
    }

    /**
     * 获取任务状态
     * @param {string} taskId - 任务 ID
     */
    function getTaskStatus(taskId) {
        const task = activeTasks.get(taskId)
        return task ? {
            status: task.status,
            progress: task.progress,
            error: task.error
        } : null
    }

    /**
     * 获取任务结果
     * @param {string} taskId - 任务 ID
     */
    function getTaskResult(taskId) {
        return taskResults.get(taskId)
    }

    /**
     * 清理已完成的任务结果
     * @param {string} taskId - 任务 ID
     */
    function clearTaskResult(taskId) {
        taskResults.delete(taskId)
    }

    /**
     * 检查任务是否正在运行
     * @param {string} taskId - 任务 ID
     */
    function isTaskRunning(taskId) {
        const task = activeTasks.get(taskId)
        return task && task.status === TaskStatus.RUNNING
    }

    return {
        // State
        activeTasks,
        taskResults,
        TaskStatus,

        // Actions
        createStreamingTask,
        abortTask,
        getTaskStatus,
        getTaskResult,
        clearTaskResult,
        isTaskRunning
    }
})

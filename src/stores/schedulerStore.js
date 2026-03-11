import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSchedulerStore = defineStore('scheduler', () => {
    // Shared Scheduled Tasks
    const tasks = ref([])

    // Random proactive configs per chat
    // { chatId: { enabled: bool, min: num, max: num, nextTrigger: timestamp } }
    const randomConfigs = ref({})

    function loadFromStorage() {
        const savedTasks = localStorage.getItem('qiaoqiao_scheduled_tasks')
        if (savedTasks) {
            try {
                tasks.value = JSON.parse(savedTasks)
            } catch (e) {
                console.error('Failed to load tasks', e)
                tasks.value = []
            }
        }

        const savedConfigs = localStorage.getItem('qiaoqiao_random_proactive_configs')
        if (savedConfigs) {
            try {
                randomConfigs.value = JSON.parse(savedConfigs)
            } catch (e) {
                console.error('Failed to load random configs', e)
                randomConfigs.value = {}
            }
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem('qiaoqiao_scheduled_tasks', JSON.stringify(tasks.value))
        } catch (e) {
            console.error('[Scheduler] Failed to save tasks to localStorage:', e);
            // It's still in memory, so it works for the current session
        }
    }

    function saveConfigs() {
        try {
            localStorage.setItem('qiaoqiao_random_proactive_configs', JSON.stringify(randomConfigs.value))
        } catch (e) {
            console.error('[Scheduler] Failed to save configs to localStorage:', e);
        }
    }

    function addTask(chatId, timeStr, content) {
        console.log('[Scheduler] Attempting to add task:', { chatId, timeStr, content });
        
        // Parse timeStr (Expect YYYY-MM-DD HH:mm or just HH:mm for today)
        let targetDate;
        // Clean up string
        const cleanTimeStr = timeStr.trim().replace(/年|月/g, '-').replace(/日/g, '').replace(/\s+/g, ' ');
        
        if (cleanTimeStr.includes('-')) {
            // Support "2026-03-13 06:00" or "2026-03-13"
            // Use T replacement for better compatibility in and Date constructor
            const isoStr = cleanTimeStr.replace(' ', 'T');
            targetDate = new Date(isoStr);
            // If it failed (maybe missing time), try as-is
            if (isNaN(targetDate.getTime())) {
                targetDate = new Date(cleanTimeStr);
            }
        } else {
            // Assume today/tomorrow HH:mm
            const now = new Date()
            const timeParts = cleanTimeStr.match(/(\d{1,2})[:：点]\s*(\d{1,2})?/);
            if (timeParts) {
                const hours = parseInt(timeParts[1]);
                const minutes = parseInt(timeParts[2] || 0);
                targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes)
                if (targetDate < now) {
                    targetDate.setDate(targetDate.getDate() + 1)
                }
            } else {
                targetDate = new Date(NaN);
            }
        }

        if (isNaN(targetDate.getTime())) {
            console.error('[Scheduler] Invalid date format:', timeStr);
            return false
        }

        console.log('[Scheduler] Task date parsed successfully:', targetDate.toLocaleString());

        const newTask = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            chatId,
            timestamp: targetDate.getTime(),
            content,
            enabled: true,
            createdAt: Date.now()
        }

        tasks.value.push(newTask)
        saveTasks()
        return true
    }

    function removeTask(id) {
        tasks.value = tasks.value.filter(t => t.id !== id)
        saveTasks()
    }

    function toggleTask(id) {
        const task = tasks.value.find(t => t.id === id)
        if (task) {
            task.enabled = !task.enabled
            saveTasks()
        }
    }

    // Process tasks (Background check)
    function checkDueTasks() {
        const now = Date.now()
        let changed = false
        
        tasks.value.forEach(task => {
            if (task.enabled && !task.triggered && task.timestamp <= now) {
                console.log('[Scheduler] Task triggered!', task);
                task.triggered = true;
                task.enabled = false;
                changed = true;
                
                // Emit global event for other stores (like chatStore) to react
                window.dispatchEvent(new CustomEvent('qiaoqiao_task_triggered', {
                    detail: { ...task }
                }));
            }
        })
        
        if (changed) saveTasks()
    }

    // Start background processor
    let processTimer = null
    function startProcessor() {
        if (processTimer) clearInterval(processTimer)
        processTimer = setInterval(checkDueTasks, 15000) // Every 15s
    }

    function setRandomConfig(chatId, { enabled, min, max }) {
        const config = {
            enabled,
            min: parseInt(min) || 30,
            max: parseInt(max) || 120,
            nextTrigger: 0
        }

        // If enabling, calculate first trigger time
        if (enabled) {
            const delay = Math.floor(Math.random() * (config.max - config.min + 1) + config.min)
            config.nextTrigger = Date.now() + delay * 60000
        }

        randomConfigs.value[chatId] = config
        saveConfigs()
    }

    function updateNextRandomTrigger(chatId) {
        const config = randomConfigs.value[chatId]
        if (config && config.enabled) {
            const delay = Math.floor(Math.random() * (config.max - config.min + 1) + config.min)
            config.nextTrigger = Date.now() + delay * 60000
            saveConfigs()
        }
    }

    // Init
    loadFromStorage()
    startProcessor()

    return {
        tasks,
        randomConfigs,
        addTask,
        removeTask,
        toggleTask,
        setRandomConfig,
        updateNextRandomTrigger,
        saveTasks
    }
})

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
        localStorage.setItem('qiaoqiao_scheduled_tasks', JSON.stringify(tasks.value))
    }

    function saveConfigs() {
        localStorage.setItem('qiaoqiao_random_proactive_configs', JSON.stringify(randomConfigs.value))
    }

    function addTask(chatId, timeStr, content) {
        // Parse timeStr (Expect YYYY-MM-DD HH:mm or just HH:mm for today)
        let targetDate;
        if (timeStr.includes('-')) {
            targetDate = new Date(timeStr.replace(/年|月/g, '-').replace(/日/g, ''))
        } else {
            // Assume today, but if time already passed, assume tomorrow
            const now = new Date()
            const [hours, minutes] = timeStr.split(/:|点|分/).map(Number)
            targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes || 0)
            if (targetDate < now) {
                targetDate.setDate(targetDate.getDate() + 1)
            }
        }

        if (isNaN(targetDate.getTime())) {
            console.error('Invalid date format:', timeStr)
            return false
        }

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

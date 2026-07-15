<template>
    <div v-if="show" class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="$emit('close')">
        <div class="bg-white w-[90%] max-w-[380px] rounded-2xl overflow-hidden shadow-2xl animate-scale-up"
            @click.stop>
            <!-- Header -->
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <button @click="prevMonth" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                    <i class="fa-solid fa-chevron-left text-gray-500 text-sm"></i>
                </button>
                <div class="text-center">
                    <div class="font-bold text-gray-900">{{ currentYear }}年{{ currentMonth + 1 }}月</div>
                    <div class="text-[10px] text-gray-400 mt-0.5">共 {{ monthTurnTotal }} 轮 · 点击日期选择</div>
                </div>
                <button @click="nextMonth" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                    <i class="fa-solid fa-chevron-right text-gray-500 text-sm"></i>
                </button>
            </div>

            <!-- 星期表头 -->
            <div class="grid grid-cols-7 px-2 py-2 gap-1">
                <div v-for="d in weekDays" :key="d" class="text-center text-[10px] font-bold text-gray-400 py-1">{{ d }}</div>
            </div>

            <!-- 日历网格 -->
            <div class="grid grid-cols-7 px-2 gap-1 mb-2">
                <div v-for="(cell, idx) in calendarCells" :key="idx"
                    class="aspect-square flex flex-col items-center justify-center rounded-lg transition-all cursor-pointer relative"
                    :class="getCellClass(cell)"
                    @click="selectDate(cell)">
                    <span class="text-xs font-medium" :class="cell.date ? '' : 'text-gray-300'">{{ cell.day || '' }}</span>
                    <span v-if="cell.date && cell.turns > 0" class="text-[9px] mt-0.5 font-bold"
                        :class="isDateSelected(cell.date) ? 'text-white' : 'text-purple-500'">{{ cell.turns }}轮</span>
                    <span v-if="isDateSelected(cell.date)" class="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-400"></span>
                </div>
            </div>

            <!-- 选中日期范围信息 -->
            <div v-if="selectedDates.length > 0" class="mx-4 mb-3 p-3 bg-purple-50 rounded-xl">
                <div class="text-xs text-gray-600">
                    已选 <b class="text-purple-600">{{ selectedDates.length }}</b> 天
                    <span v-if="selectedRangeText">: {{ selectedRangeText }}</span>
                </div>
                <div class="text-[10px] text-gray-400 mt-1">
                    覆盖 {{ selectedTurnTotal }} 轮对话
                </div>
            </div>

            <!-- 底部操作 -->
            <div class="flex gap-3 px-4 pb-4">
                <button @click="$emit('close')"
                    class="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold active:bg-gray-200 transition-colors text-sm">
                    取消
                </button>
                <button v-if="selectedDates.length > 0" @click="clearSelection"
                    class="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200 transition-colors text-sm">
                    清除
                </button>
                <button @click="executeSummary"
                    :disabled="selectedDates.length === 0"
                    class="flex-1 py-3 rounded-xl font-bold transition-colors text-sm"
                    :class="selectedDates.length > 0 ? 'bg-purple-500 text-white active:bg-purple-600 shadow-md' : 'bg-gray-200 text-gray-400'">
                    总结{{ selectedDates.length > 0 ? ` (${selectedTurnTotal}轮)` : '' }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getDailyTurnCounts } from '../../../utils/common'

const props = defineProps({
    show: { type: Boolean, default: false },
    msgs: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'summary'])

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

// 当前显示的月份
const today = new Date()
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())

// 选中的日期数组 ('YYYY-MM-DD')
const selectedDates = ref([])

// 每天轮次统计
const dailyTurnCounts = computed(() => getDailyTurnCounts(props.msgs || []))

// 当月总轮数
const monthTurnTotal = computed(() => {
    let total = 0
    for (const [key, count] of Object.entries(dailyTurnCounts.value)) {
        const [y, m] = key.split('-').map(Number)
        if (y === currentYear.value && m === currentMonth.value + 1) {
            total += count
        }
    }
    return total
})

// 生成日历单元格
const calendarCells = computed(() => {
    const cells = []
    const firstDay = new Date(currentYear.value, currentMonth.value, 1)
    const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)
    const startWeekday = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    // 前置空白
    for (let i = 0; i < startWeekday; i++) {
        cells.push({ day: null, date: null, turns: 0 })
    }

    // 当月每一天
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const turns = dailyTurnCounts.value[dateStr] || 0
        cells.push({ day: d, date: dateStr, turns })
    }

    // 后置空白补齐到 42 格(6行)或刚好
    while (cells.length % 7 !== 0) {
        cells.push({ day: null, date: null, turns: 0 })
    }

    return cells
})

const isDateSelected = (dateStr) => selectedDates.value.includes(dateStr)

const getCellClass = (cell) => {
    if (!cell.date) return 'cursor-default'
    const isSelected = isDateSelected(cell.date)
    const isToday = cell.date === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const hasTurns = cell.turns > 0

    if (isSelected) return 'bg-purple-500 text-white shadow-md'
    if (hasTurns) return 'bg-purple-50 text-gray-700 hover:bg-purple-100 active:scale-95'
    if (isToday) return 'bg-gray-50 text-gray-500 border border-gray-200'
    return 'text-gray-400 hover:bg-gray-50 active:scale-95'
}

const selectDate = (cell) => {
    if (!cell.date) return
    const idx = selectedDates.value.indexOf(cell.date)
    if (idx >= 0) {
        selectedDates.value.splice(idx, 1)
    } else {
        selectedDates.value.push(cell.date)
        // 自动排序,方便显示范围
        selectedDates.value.sort()
    }
}

const clearSelection = () => {
    selectedDates.value = []
}

// 选中的范围文本
const selectedRangeText = computed(() => {
    if (selectedDates.value.length === 0) return ''
    if (selectedDates.value.length === 1) return selectedDates.value[0]
    // 如果连续则显示起止
    const sorted = [...selectedDates.value].sort()
    let isContiguous = true
    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1] + 'T00:00:00')
        prev.setDate(prev.getDate() + 1)
        if (sorted[i] !== `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`) {
            isContiguous = false
            break
        }
    }
    if (isContiguous) return `${sorted[0]} ~ ${sorted[sorted.length - 1]}`
    return sorted.slice(0, 3).join(', ') + (sorted.length > 3 ? ` 等${sorted.length}天` : '')
})

// 选中日期覆盖的轮数
const selectedTurnTotal = computed(() => {
    return selectedDates.value.reduce((sum, date) => sum + (dailyTurnCounts.value[date] || 0), 0)
})

const prevMonth = () => {
    if (currentMonth.value === 0) {
        currentMonth.value = 11
        currentYear.value--
    } else {
        currentMonth.value--
    }
}

const nextMonth = () => {
    if (currentMonth.value === 11) {
        currentMonth.value = 0
        currentYear.value++
    } else {
        currentMonth.value++
    }
}

const executeSummary = () => {
    if (selectedDates.value.length === 0) return
    const sorted = [...selectedDates.value].sort()
    emit('summary', {
        startDate: sorted[0],
        endDate: sorted[sorted.length - 1]
    })
    clearSelection()
}
</script>

import { ref } from 'vue'
import { defineStore } from 'pinia'
import defaultFrames from '@/assets/avatar-frames.json'

export const useAvatarFrameStore = defineStore('avatarFrame', () => {
    // 头像框库
    const frames = ref([])
    
    // 初始化：从localStorage加载或使用默认
    function loadFrames() {
        const saved = localStorage.getItem('avatar_frames')
        if (saved) {
            try {
                frames.value = JSON.parse(saved)
            } catch (e) {
                console.error('Failed to load frames:', e)
                frames.value = defaultFrames
                saveFrames()
            }
        } else {
            frames.value = defaultFrames
            saveFrames()
        }
    }
    
    // 保存到localStorage
    function saveFrames() {
        localStorage.setItem('avatar_frames', JSON.stringify(frames.value))
    }
    
    // 添加头像框
    function addFrame(frame) {
        frames.value.push({
            id: 'frame_' + Date.now(),
            url: frame.url,
            name: frame.name || '自定义头像框',
            scale: frame.scale || 1,
            offsetX: frame.offsetX || 0,
            offsetY: frame.offsetY || 0
        })
        saveFrames()
    }
    
    // 删除头像框
    function deleteFrame(frameId) {
        const index = frames.value.findIndex(f => f.id === frameId)
        if (index > -1) {
            frames.value.splice(index, 1)
            saveFrames()
        }
    }
    
    // 导出头像框库
    function exportFrames() {
        const dataStr = JSON.stringify(frames.value, null, 2)
        const blob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `avatar-frames-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
    }
    
    // 导入头像框库
    function importFrames(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result)
                    if (Array.isArray(imported)) {
                        frames.value = imported
                        saveFrames()
                        resolve(imported.length)
                    } else {
                        reject('无效的JSON格式')
                    }
                } catch (err) {
                    reject('JSON解析失败')
                }
            }
            reader.onerror = () => reject('文件读取失败')
            reader.readAsText(file)
        })
    }
    
    loadFrames()
    
    return {
        frames,
        addFrame,
        deleteFrame,
        exportFrames,
        importFrames,
        loadFrames,
        saveFrames
    }
})

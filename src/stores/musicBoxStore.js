import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as Tone from 'tone'
import { useChatStore } from './chatStore'

export const useMusicBoxStore = defineStore('musicBox', () => {
    const synth = ref(null)
    const isPlaying = ref(false)
    const chatStore = useChatStore()

    const presets = {
        'piano': { oscillator: { type: "triangle" }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 } },
        'guitar': { oscillator: { type: "sawtooth" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 1 } },
        'violin': { oscillator: { type: "sawtooth" }, envelope: { attack: 0.2, decay: 0.1, sustain: 0.8, release: 2 } },
        'flute': { oscillator: { type: "sine" }, envelope: { attack: 0.1, decay: 0.1, sustain: 0.9, release: 1 } },
        'game': { oscillator: { type: "square" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 } },
        'drum': { oscillator: { type: "fmsine" }, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.2 } }
    }

    const init = () => {
        if (synth.value) return
        synth.value = new Tone.PolySynth(Tone.Synth).toDestination()
        synth.value.volume.value = -8
    }

    const playScore = async (rawContent) => {
        // Cancel TTS if any
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel()
        }

        await Tone.start()
        init()

        if (isPlaying.value) return
        isPlaying.value = true

        // Parse instrument and score
        let instrument = 'piano'
        let scoreStr = rawContent
        if (rawContent.includes(':') || rawContent.includes('：')) {
            const parts = rawContent.split(/[:：]/)
            const possibleInst = parts[0].trim().toLowerCase()
            if (presets[possibleInst]) {
                instrument = possibleInst
                scoreStr = parts[1]
            }
        }

        // Set instrument preset
        synth.value.set(presets[instrument])
        const notes = scoreStr.split(/[,，\s\n]+/).map(n => n.trim()).filter(n => n)

        chatStore.triggerToast(`🎵 ${instrument}演奏中...`, 'info')

        const now = Tone.now()
        notes.forEach((note, i) => {
            try {
                if (note === '0' || note.toLowerCase() === 'rest') return
                // Randomize time slightly for human feel
                const time = now + i * 0.4 + (Math.random() * 0.02)
                const duration = instrument === 'violin' ? "2n" : "8n"
                synth.value.triggerAttackRelease(note, duration, time)
            } catch (e) {
                console.warn('[MusicBox] Failed to play note:', note, e)
            }
        })

        setTimeout(() => {
            isPlaying.value = false
        }, notes.length * 450 + 1000)
    }

    return {
        isPlaying,
        playScore
    }
})

<template>
    <div v-if="isVisible" class="fixed inset-0 z-[50] flex flex-col overflow-hidden animate-fade-in font-inter">
        <!-- Background Layer -->
        <div class="absolute inset-0 bg-black">
            <transition name="crossfade">
                <img :key="backgroundUrl" :src="backgroundUrl" 
                     class="w-full h-full object-cover opacity-60 scale-105"
                     :class="{ 'animate-slow-pan': loopData?.currentMode === 'offline' }">
            </transition>
            
            <!-- Dynamic Lighting Overlay -->
            <div class="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-black/90"></div>
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(120,119,198,0.1),transparent_50%)]"></div>
            
            <!-- Scanline / Noise Effect -->
            <div class="absolute inset-0 pointer-events-none opacity-[0.03]"
                style="background-image: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06)); background-size: 100% 2px, 3px 100%;"></div>
        </div>

        <!-- Header (HUD) -->
        <div class="relative z-10 px-6 py-12 flex justify-between items-start">
            <div class="flex flex-col gap-2 group cursor-default">
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-6 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                    <h2 class="text-xl font-black text-white tracking-widest uppercase drop-shadow-md">
                        {{ loopData?.name }}
                    </h2>
                </div>
                <div class="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 self-start">
                    <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                    <span class="text-[9px] text-purple-200/70 font-bold tracking-widest uppercase">System Sync: Active</span>
                </div>
            </div>
            
            <div class="flex gap-4">
                <button @click="$emit('toggle-mode')" class="hud-btn group" title="切换模式">
                    <i class="fa-solid fa-repeat group-hover:rotate-180 transition-transform duration-500"></i>
                </button>
                <button @click="$emit('open-gm')" class="hud-btn border-purple-500/30 text-purple-300" title="上帝视角">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                </button>
                <button @click="$emit('close')" class="hud-btn hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400" title="关闭">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>

        <!-- NPC Character Portrait (Side) - Placeholder for future expansion -->
        <!-- <div class="absolute bottom-0 left-0 w-1/3 h-2/3 pointer-events-none">
             <img v-if="latestMessage?.avatar" :src="latestMessage.avatar" class="h-full object-contain object-bottom opacity-90 drop-shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        </div> -->

        <!-- Content Area (Dialogue Box) -->
        <div class="mt-auto relative z-10 p-4 sm:p-8 space-y-4 max-w-4xl mx-auto w-full">
            
            <!-- Dialogue Container -->
            <div v-if="latestMessage" class="animate-slide-up-content group relative">
                <!-- Decorative Elements -->
                <div class="absolute -top-6 left-10 flex items-end gap-1 px-4 py-1.5 bg-indigo-600 rounded-t-xl border-t border-x border-white/20 shadow-[0_-4px_15px_rgba(79,70,229,0.3)]">
                    <span class="text-xs font-black text-white tracking-tighter uppercase">{{ latestMessage.senderName || 'System' }}</span>
                    <span class="w-1 h-1 bg-white/40 rounded-full mb-1"></span>
                    <span class="text-[8px] text-white/50 font-bold">IDENTITY CONFIRMED</span>
                </div>

                <!-- Glass Box -->
                <div class="bg-[#0f111a]/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 transition-all group-hover:bg-[#0f111a]/70">
                    <!-- Dialogue Text -->
                    <div class="text-indigo-50 text-base sm:text-xl leading-relaxed font-songti min-h-[100px] max-h-[300px] overflow-y-auto pr-2 custom-scrollbar selection:bg-indigo-500/30 break-words">
                        {{ cleanDialogue }}
                    </div>

                    <!-- Interactions Indicators -->
                    <div class="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-white/30 font-mono tracking-widest">
                        <div class="flex items-center gap-4">
                            <span class="flex items-center gap-1.5"><span class="w-1 h-1 bg-green-500 rounded-full"></span> RECORDING</span>
                            <span>LOG_ID: {{ latestMessage.id?.substring(0,8) }}</span>
                        </div>
                        
                        <div v-if="isTyping" class="flex gap-1.5 items-center">
                            <span class="mr-2">SYNCING</span>
                            <div class="w-1 h-3 bg-indigo-500/40 animate-pulse"></div>
                            <div class="w-1 h-5 bg-indigo-500/60 animate-pulse delay-75"></div>
                            <div class="w-1 h-3 bg-indigo-500/40 animate-pulse delay-150"></div>
                        </div>
                        <div v-else class="flex items-center gap-2 group-hover:text-indigo-400 transition-colors">
                            <span>PROCEED</span>
                            <i class="fa-solid fa-chevron-right animate-bounce-x text-[8px]"></i>
                        </div>
                    </div>

                    <!-- Decorative Corners -->
                    <div class="absolute top-0 right-0 p-3 opacity-20"><i class="fa-solid fa-up-right-and-down-left-from-center text-[10px]"></i></div>
                    <div class="absolute bottom-0 left-0 p-3 opacity-20"><i class="fa-solid fa-expand text-[10px]"></i></div>
                </div>
            </div>

            <!-- RPG Functional Bar -->
            <div class="flex gap-4 justify-center items-center py-4 px-6 bg-black/20 backdrop-blur-sm rounded-full border border-white/5 self-center max-w-xs mx-auto">
                <button class="menu-tab">Log</button>
                <div class="w-px h-3 bg-white/10"></div>
                <button class="menu-tab">Auto</button>
                <div class="w-px h-3 bg-white/10"></div>
                <button class="menu-tab">Skip</button>
                <div class="w-px h-3 bg-white/10"></div>
                <button class="menu-tab" @click="$emit('open-gm')">GM</button>
            </div>
        </div>
        
        <!-- Ambient Grain/Dust Overlay -->
        <div class="absolute inset-0 pointer-events-none z-0 mix-blend-screen opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
    </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
    isVisible: Boolean,
    loopData: Object,
    latestMessage: Object,
    isTyping: Boolean
})

defineEmits(['close', 'open-gm', 'toggle-mode'])

const backgroundUrl = computed(() => {
    return props.loopData?.currentScene?.image || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2094&auto=format&fit=crop'
})

const cleanDialogue = computed(() => {
    const content = props.latestMessage?.content || ''
    if (typeof content !== 'string') return content
    
    // Clean Protocol Tags
    let clean = content
        .replace(/\[INNER_VOICE\][\s\S]*?\[\/INNER_VOICE\]/gi, '')
        .replace(/\[\s*CARD\s*\][\s\S]*?(?:\[\/\s*CARD\s*\]|$)/gi, '')
        .replace(/\[(?:图片|IMAGE|表情包|STICKER)[:：].*?\]/gi, '[Media Link]')
        .replace(/\{[\s\S]*?"html"\s*:[\s\S]*?\}/gi, '') // Remove JSON HTML
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .trim();
        
    return clean || (content.includes('[CARD]') ? '[Interactive UI Card - Click to View in Online Mode]' : '...')
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Noto+Serif+SC:wght@300;700&display=swap');

.font-songti {
    font-family: 'Noto Serif SC', serif;
}

.font-inter {
    font-family: 'Inter', sans-serif;
}

.animate-fade-in {
    animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.animate-slide-up-content {
    animation: slideUp 1s cubic-bezier(0.16, 1, 0.3, 1);
}

.animate-slow-pan {
    animation: slowPan 40s infinite alternate ease-in-out;
}

.hud-btn {
    width: 3rem;
    height: 3rem;
    border-radius: 1rem;
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.2s;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.hud-btn:hover {
    color: white;
    background-color: rgba(255, 255, 255, 0.1);
}

.menu-tab {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    transition: all 0.2s;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    background: none;
    border: none;
    cursor: pointer;
}

.menu-tab:hover {
    color: #818cf8;
}

@keyframes fadeIn {
    from { opacity: 0; filter: blur(20px); }
    to { opacity: 1; filter: blur(0); }
}

@keyframes slideUp {
    from { opacity: 0; transform: translateY(40px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes slowPan {
    0% { transform: scale(1.15) translate(-1%, -1%); }
    100% { transform: scale(1.15) translate(1%, 1%); }
}

@keyframes bounce-x {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(3px); }
}

.animate-bounce-x {
    animation: bounce-x 1s infinite ease-in-out;
}

/* Custom Scrollbar for Dialogue content if needed */
::-webkit-scrollbar {
    width: 4px;
}
::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}
</style>

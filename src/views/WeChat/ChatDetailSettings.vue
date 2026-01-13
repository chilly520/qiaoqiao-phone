<template>
    <div class="absolute inset-0 z-[9999] flex flex-col pt-[28px] animate-slide-in-right bg-[#f2f2f2] text-gray-800">
        <!-- Subpage wallpaper layer: mirrors global wallpaper so underlying app content doesn't show through -->
        <div class="absolute inset-0 bg-cover bg-center -z-10" :style="globalBgStyle"></div>

        <!-- Header -->
        <div
            class="h-[50px] bg-white/95 border-b border-gray-200 sticky top-0 flex items-center justify-between px-2 z-10">
            <button class="w-10 h-full text-gray-800 flex items-center justify-center" @click="$emit('close')">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="font-bold text-gray-800">角色设置</span>
            <button @click="saveSettings"
                class="ml-auto text-green-600 font-bold text-sm bg-green-100 px-3 py-1 rounded mr-2">保存</button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto overflow-x-visible p-4 space-y-6 pb-20">
            <!-- Toast -->
            <div v-if="toastMessage"
                class="fixed top-14 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm z-50 animate-fade-in shadow-lg">
                {{ toastMessage }}
            </div>
            <!-- Avatar & Basic Info -->
            <div class="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm">
                <div class="flex flex-col items-center gap-2 shrink-0">
                    <div class="relative">
                        <div class="w-16 h-16 bg-white flex items-center justify-center overflow-hidden relative group cursor-pointer"
                            :class="[getAvatarShapeClass(), !localData.avatarFrame ? 'border border-gray-100' : '']"
                            @click="triggerAvatarUpload">
                            <!-- Inner Avatar (Scaled based on frame properties) -->
                            <div class="w-full h-full transition-all duration-300 pointer-events-none" :style="{
                                padding: localData.avatarFrame ? ((1 - (localData.avatarFrame.scale || 1)) / 2 * 100) + '%' : '0',
                                transform: localData.avatarFrame ? `translate(${localData.avatarFrame.offsetX || 0}px, ${localData.avatarFrame.offsetY || 0}px)` : 'none'
                            }">
                                <img v-if="localData.avatar" :src="localData.avatar" class="w-full h-full object-cover">
                                <span v-else class="text-xs text-gray-400">头像</span>
                            </div>
                        </div>
                        <!-- 头像框叠加 -->
                        <img v-if="localData.avatarFrame" :src="localData.avatarFrame.url"
                            class="absolute inset-0 w-full h-full pointer-events-none">
                    </div>

                    <!-- 头像操作按钮组 -->
                    <div class="flex gap-1.5">
                        <!-- 形状切换按钮 -->
                        <button
                            class="w-5 h-5 bg-purple-100 text-purple-600 rounded flex items-center justify-center hover:bg-purple-200 transition-colors text-[10px]"
                            @click.stop="toggleAvatarShape" title="切换形状">
                            <i class="fa-solid"
                                :class="localData.avatarShape === 'circle' ? 'fa-square' : 'fa-circle'"></i>
                        </button>
                        <!-- 头像框选择按钮 -->
                        <button
                            class="w-5 h-5 bg-blue-100 text-blue-600 rounded flex items-center justify-center hover:bg-blue-200 transition-colors text-[10px]"
                            @click.stop="showFramePicker = true">
                            <i class="fa-solid fa-crown"></i>
                        </button>
                    </div>
                </div>

                <div class="flex-1 min-w-0">
                    <input v-model="localData.name" type="text"
                        class="text-base font-bold bg-transparent outline-none w-full mb-1" placeholder="角色名字">
                    <div class="text-[10px] text-gray-400 mb-2">微信号: <input v-model="localData.wechatId" type="text"
                            class="bg-transparent outline-none font-mono text-gray-500 w-28" placeholder="wxid_...">
                    </div>
                    <div class="flex gap-1.5 flex-wrap">
                        <button
                            class="text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                            @click.stop="triggerAvatarUpload">本地</button>
                        <button
                            class="text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                            @click.stop="promptAvatarUrl">URL</button>
                        <button
                            class="text-[10px] text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 flex items-center gap-1 hover:bg-green-100 transition-colors"
                            @click.stop="handleShowProfile">
                            <i class="fa-solid fa-id-card"></i>个人主页
                        </button>
                    </div>
                </div>
                <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleAvatarChange">
            </div>

            <!-- Persona -->
            <div>
                <h3 class="section-title">我的人设 (User Persona)</h3>
                <div class="bg-white p-3 rounded-xl shadow-sm">
                    <div class="flex items-center gap-3 mb-3">
                        <!-- 用户头像区域 -->
                        <div class="flex flex-col items-center gap-2 shrink-0">
                            <div class="relative">
                                <div class="w-16 h-16 bg-white flex items-center justify-center overflow-hidden relative group cursor-pointer"
                                    :class="[getAvatarShapeClass(), !localData.userAvatarFrame ? 'border border-gray-100' : '']"
                                    @click="triggerUserAvatarUpload">
                                    <!-- Inner Avatar (Scaled based on frame properties) -->
                                    <div class="w-full h-full transition-all duration-300 pointer-events-none" :style="{
                                        padding: localData.userAvatarFrame ? ((1 - (localData.userAvatarFrame.scale || 1)) / 2 * 100) + '%' : '0',
                                        transform: localData.userAvatarFrame ? `translate(${localData.userAvatarFrame.offsetX || 0}px, ${localData.userAvatarFrame.offsetY || 0}px)` : 'none'
                                    }">
                                        <img v-if="localData.userAvatar" :src="localData.userAvatar"
                                            class="w-full h-full object-cover">
                                        <span v-else class="text-xs text-gray-400">头像</span>
                                    </div>
                                </div>
                                <!-- 用户头像框 -->
                                <img v-if="localData.userAvatarFrame" :src="localData.userAvatarFrame.url"
                                    class="absolute inset-0 w-full h-full pointer-events-none">
                            </div>

                            <!-- 用户操作按钮组 -->
                            <div class="flex gap-1.5">
                                <!-- 用户头像框选择按钮 -->
                                <button
                                    class="w-5 h-5 bg-blue-100 text-blue-600 rounded flex items-center justify-center hover:bg-blue-200 transition-colors text-[10px]"
                                    @click.stop="showUserFramePicker = true">
                                    <i class="fa-solid fa-crown"></i>
                                </button>
                            </div>
                        </div>

                        <!-- 用户信息 -->
                        <div class="flex-1 min-w-0">
                            <input v-model="localData.userName" type="text"
                                class="text-base font-bold bg-transparent outline-none w-full mb-1" placeholder="我的名字">
                            <div class="flex gap-1.5">
                                <button
                                    class="text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                    @click="triggerUserAvatarUpload">本地</button>
                                <button
                                    class="text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                    @click="promptUserAvatarUrl">URL</button>
                            </div>
                        </div>
                        <input type="file" ref="userFileInput" class="hidden" accept="image/*"
                            @change="handleUserAvatarChange">
                    </div>
                    <textarea v-model="localData.userPersona" class="setting-input h-20"
                        placeholder="我的人设..."></textarea>
                </div>
            </div>

            <!-- Character Definition -->
            <div>
                <h3 class="section-title">角色设定</h3>
                <input v-model="localData.remark" type="text" class="setting-input" placeholder="备注名">
                <textarea v-model="localData.prompt" class="setting-input h-32 mt-2"
                    placeholder="设定 Prompt..."></textarea>
            </div>

            <!-- Opening Line -->
            <div>
                <h3 class="section-title">开场白设置</h3>
                <textarea v-model="localData.openingLine" class="setting-input h-20"
                    placeholder="自定义开场AI说的第一句话..."></textarea>
                <div class="text-xs text-gray-500 mt-1">留空则使用默认好友申请卡片</div>
            </div>

            <!-- Worldbook -->
            <div>
                <h3 class="section-title">关联世界书</h3>
                <div class="glass-panel p-2 rounded-lg bg-white/50 border border-white/20 max-h-48 overflow-y-auto">
                    <div v-if="worldBookStore.books.length === 0" class="text-xs text-gray-500 text-center py-2">
                        暂无世界书，请在桌面App中创建
                    </div>
                    <div v-else class="space-y-2">
                        <div v-for="book in worldBookStore.books" :key="book.id"
                            class="bg-white/40 rounded-lg overflow-hidden border border-white/20">
                            <!-- Book Header (Click to Expand) -->
                            <div class="flex items-center justify-between p-2 cursor-pointer hover:bg-white/50 transition-colors"
                                @click="toggleBookExpand(book.id)">
                                <div class="flex items-center gap-2">
                                    <i class="fa-solid fa-chevron-right text-xs text-gray-500 transition-transform duration-200"
                                        :class="expandedBooks.includes(book.id) ? 'rotate-90' : ''"></i>
                                    <div class="flex flex-col">
                                        <span class="text-sm font-bold text-gray-800">{{ book.name }}</span>
                                        <span class="text-[10px] text-gray-500">
                                            {{ book.entries?.length || 0 }} 条目
                                        </span>
                                    </div>
                                </div>

                                <!-- Helper: Select All (Optional, small link) -->
                                <div class="flex items-center gap-2" @click.stop>
                                    <!-- Prevent bubble up to expand -->
                                    <button class="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded"
                                        @click="selectAllBook(book)">全选</button>
                                </div>
                            </div>

                            <!-- Entries List (Visible if Expanded) -->
                            <div v-show="expandedBooks.includes(book.id)"
                                class="bg-white/30 p-2 space-y-1 border-t border-white/10">
                                <div v-if="!book.entries || book.entries.length === 0"
                                    class="text-center text-[10px] text-gray-400 py-1">
                                    (空)
                                </div>
                                <div v-for="entry in book.entries" :key="entry.id"
                                    class="flex items-center justify-between p-1.5 rounded hover:bg-white/60 transition-colors pl-4">
                                    <div class="flex flex-col overflow-hidden mr-2">
                                        <span class="text-xs font-medium text-gray-700 truncate" :title="entry.name">{{
                                            entry.name }}</span>
                                        <span class="text-[10px] text-gray-500 truncate">
                                            {{ entry.keys && entry.keys.length ? `[${entry.keys.join(',')}]` : '[常驻]' }}
                                        </span>
                                    </div>

                                    <!-- Toggle Entry -->
                                    <div class="w-[32px] h-[18px] rounded-full relative cursor-pointer transition-colors duration-200 shrink-0"
                                        :class="localData.worldBookLinks?.includes(entry.id) ? 'bg-[#07c160]' : 'bg-[#e0e0e0]'"
                                        @click="toggleWorldBook(entry.id)">
                                        <div class="absolute top-[2px] bg-white w-[14px] h-[14px] rounded-full shadow-sm transition-transform duration-200"
                                            :class="localData.worldBookLinks?.includes(entry.id) ? 'left-[16px]' : 'left-[2px]'">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="text-[10px] text-gray-400 mt-1 px-1">
                    已选 {{ localData.worldBookLinks?.length || 0 }} 项。绑定后，相关设定将注入到该角色的对话中。
                </div>
            </div>

            <!-- Time Awareness -->
            <div
                class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 bg-white/50 border border-white/20">
                <span class="text-sm text-gray-800">时间感知</span>
                <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                    :class="localData.timeAware ? 'bg-[#07c160]' : 'bg-[#e0e0e0]'"
                    @click="localData.timeAware = !localData.timeAware">
                    <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                        :class="localData.timeAware ? 'left-[22px]' : 'left-[2px]'"></div>
                </div>
            </div>
            <div v-if="localData.timeAware" class="space-y-2 mb-4 animate-fade-in transition-all">
                <div class="flex items-center gap-4 bg-white/40 p-2 rounded-lg border border-white/20">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" v-model="localData.timeSyncMode" value="system" class="accent-green-500">
                        <span class="text-xs">系统同步</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" v-model="localData.timeSyncMode" value="manual" class="accent-green-500">
                        <span class="text-xs">虚拟设定</span>
                    </label>
                </div>

                <div v-if="localData.timeSyncMode === 'manual'" class="animate-fade-in-down">
                    <input v-model="localData.virtualTime" @input="localData.virtualTimeLastSync = Date.now()"
                        type="text" class="setting-input mb-1" placeholder="虚拟时间 (如: 乾隆三十年)">
                    <div class="text-[10px] text-gray-400 px-1 italic">基准时间设定后，系统将模拟其时间的流逝</div>
                </div>
                <div v-else
                    class="text-xs text-green-600 bg-green-50/50 p-2 rounded border border-green-100/50 animate-fade-in">
                    <i class="fa-solid fa-clock-rotate-left mr-1"></i> 已启用实时同步：当前 AI 将时刻感知您的物理时间
                </div>
            </div>

            <!-- Active Chat -->
            <div
                class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 bg-white/50 border border-white/20">
                <span class="text-sm text-gray-800 font-bold">查岗（离开界面后触发）</span>
                <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                    :class="localData.activeChat ? 'bg-[#07c160]' : 'bg-[#e0e0e0]'"
                    @click="localData.activeChat = !localData.activeChat">
                    <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                        :class="localData.activeChat ? 'left-[22px]' : 'left-[2px]'"></div>
                </div>
            </div>
            <div class="flex items-center gap-2 mb-4 px-2">
                <span class="text-xs text-gray-600">离开</span>
                <input v-model="localData.activeInterval" type="number" class="short-input text-center"
                    style="width: 66px !important; min-width: 66px !important; max-width: 66px !important; flex: none !important;"
                    min="1">
                <span class="text-xs text-gray-600">分钟后触发</span>
            </div>

            <!-- Proactive Chat -->
            <div
                class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 bg-white/50 border border-white/20">
                <span class="text-sm text-gray-800 font-bold">主动发消息（界面内触发）</span>
                <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                    :class="localData.proactiveChat ? 'bg-[#07c160]' : 'bg-[#e0e0e0]'"
                    @click="localData.proactiveChat = !localData.proactiveChat">
                    <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                        :class="localData.proactiveChat ? 'left-[22px]' : 'left-[2px]'"></div>
                </div>
            </div>
            <div class="flex items-center gap-2 mb-4 px-2">
                <span class="text-xs text-gray-600">每隔</span>
                <input v-model="localData.proactiveInterval" type="number" class="short-input text-center"
                    style="width: 66px !important; min-width: 66px !important; max-width: 66px !important; flex: none !important; display: inline-block !important;"
                    min="1">
                <span class="text-xs text-gray-600">分钟主动发一条消息</span>
            </div>

            <!-- Memory -->
            <div>
                <h3 class="section-title">记忆与总结</h3>
                <div class="grid grid-cols-3 gap-2 text-center mb-3">
                    <div class="glass-panel p-2 rounded-lg bg-white/50 border border-white/20">
                        <div class="text-[10px] text-gray-600">总聊天数</div>
                        <div class="font-mono text-blue-600 text-base font-bold">{{ props.chatData.msgs?.length || 0 }}
                        </div>
                    </div>
                    <div class="glass-panel p-2 rounded-lg bg-white/50 border border-white/20">
                        <div class="text-[10px] text-gray-600">总Token</div>
                        <div class="font-mono text-orange-600 text-base font-bold">{{ tokenStats?.total || 0 }}</div>
                    </div>
                    <div class="glass-panel p-2 rounded-lg bg-white/50 border border-white/20">
                        <div class="text-[10px] text-gray-600">上下文</div>
                        <div class="font-mono text-purple-600 text-base font-bold cursor-pointer underline decoration-dotted"
                            @click="showTokenDetailModal">{{ tokenStats?.totalContext || 0 }}</div>
                    </div>
                </div>

                <div class="mb-2 flex items-center gap-2">
                    <label class="text-xs text-gray-600 w-24">上下文记忆条数</label>
                    <input v-model="localData.contextLimit" type="number" class="setting-input mt-0 flex-1"
                        placeholder="默认 20 条">
                </div>

                <div class="mb-2 flex items-center gap-2">
                    <label class="text-xs text-gray-600 w-24">上下文显示条数</label>
                    <input v-model="localData.displayLimit" type="number" class="setting-input mt-0 flex-1"
                        placeholder="防止卡顿 (默认 50)">
                </div>

                <div class="mb-2 flex items-center gap-2">
                    <label class="text-xs text-gray-600 w-24">自动总结条数</label>
                    <input v-model="localData.summaryLimit" type="number" class="setting-input mt-0 flex-1"
                        placeholder="每隔多少条触发 (默认 50)">
                </div>

                <div class="mb-2 flex items-center gap-2">
                    <label class="text-xs text-gray-600 w-24 font-bold text-blue-600">朋友圈记忆</label>
                    <input v-model="localData.momentsMemoryLimit" type="number"
                        class="setting-input mt-0 flex-1 border-blue-100 bg-blue-50/20" placeholder="感知最近几条朋友圈">
                </div>

                <div class="glass-panel p-3 rounded-lg mb-2 bg-white/50 border border-white/20 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-800">自动总结 (Auto Summary)</span>
                        <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                            :class="localData.autoSummary ? 'bg-[#07c160]' : 'bg-[#e0e0e0]'"
                            @click="localData.autoSummary = !localData.autoSummary">
                            <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                                :class="localData.autoSummary ? 'left-[22px]' : 'left-[2px]'"></div>
                        </div>
                    </div>

                    <div class="animate-fade-in-down pt-2 border-t border-gray-100">
                        <label class="text-[10px] text-gray-500 mb-1 block">总结提示词 (Prompt)</label>
                        <textarea v-model="localData.summaryPrompt" class="setting-input h-24 text-xs"
                            placeholder="自定义总结提示词..."></textarea>
                        <div class="flex gap-2 mt-2">
                            <button class="setting-btn secondary text-xs flex-1"
                                @click="triggerManualSummary">手动总结</button>
                            <button class="setting-btn secondary text-xs flex-1" @click="openMemoryLib">记忆管理库</button>
                        </div>
                    </div>
                </div>


                <!-- Voice (TTS) -->
                <div>
                    <h3 class="section-title">语音 (TTS)</h3>
                    <div
                        class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 bg-white/50 border border-white/20">
                        <span class="text-sm text-gray-800">启用 TTS</span>
                        <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                            :class="localData.autoTTS ? 'bg-[#07c160]' : 'bg-[#e0e0e0]'"
                            @click="localData.autoTTS = !localData.autoTTS">
                            <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                                :class="localData.autoTTS ? 'left-[22px]' : 'left-[2px]'"></div>
                        </div>
                    </div>
                    <input v-model="localData.voiceId" type="text" class="setting-input mb-2"
                        placeholder="角色 Voice ID (MiniMax)">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-400">语速</span>
                        <input v-model="localData.voiceSpeed" type="range" min="0.5" max="2" step="0.1"
                            class="flex-1 h-1 bg-gray-300 rounded-lg accent-green-500">
                        <span class="text-xs w-6 text-right">{{ localData.voiceSpeed }}</span>
                    </div>
                </div>

                <!-- Pat Settings -->
                <div>
                    <h3 class="section-title">拍一拍设置</h3>
                    <div class="space-y-2">
                        <input v-model="localData.patAction" type="text" class="setting-input"
                            placeholder="自定义动作，如：敲了敲、摸了摸">
                        <input v-model="localData.patSuffix" type="text" class="setting-input"
                            placeholder="自定义后缀，如：的头、的肩膀">
                    </div>
                </div>

                <!-- Bubble & Background -->
                <div>
                    <h3 class="section-title">气泡与背景</h3>
                    <!-- Preview Box (Dynamic) -->
                    <div class="relative overflow-hidden rounded-xl h-40 mb-4 border transition-all duration-300"
                        :class="localData.bgTheme === 'dark' ? 'bg-black border-white/10' : 'bg-gray-100 border-gray-200'">
                        <!-- Background Layer in Preview -->
                        <div class="absolute inset-0 bg-cover bg-center z-0 transition-all duration-300" :style="{
                            backgroundImage: localData.bgUrl ? `url('${localData.bgUrl}')` : '',
                            filter: `blur(${localData.bgBlur}px) opacity(${localData.bgOpacity})`
                        }"></div>

                        <div class="relative z-10 flex gap-2 mb-3">
                            <img :src="localData.avatar || 'https://picsum.photos/100'"
                                class="w-10 h-10 rounded shadow bg-white border border-white/50">
                            <div class="max-w-[70%]">
                                <div class="px-3 py-2 rounded-lg text-[15px] leading-relaxed shadow-sm bg-black text-[#f0e6d2] border border-[#f0e6d2]/30"
                                    :style="{ fontSize: localData.bubbleSize + 'px' }">
                                    角色回复的消息<span class="text-[10px] ml-1 opacity-50">12:00</span>
                                </div>
                            </div>
                        </div>

                        <div class="relative z-10 flex gap-2 flex-row-reverse">
                            <img :src="localData.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me'"
                                class="w-10 h-10 rounded shadow bg-white border border-white/50">
                            <div class="max-w-[70%] flex justify-end">
                                <div class="px-3 py-2 rounded-lg text-[15px] leading-relaxed shadow-sm bg-gray-800 text-gray-100 border border-white/10"
                                    :style="{ fontSize: localData.bubbleSize + 'px' }">
                                    我的消息<span class="text-[10px] ml-1 opacity-50">12:01</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-xs text-gray-400">字体大小</span>
                        <input v-model="localData.bubbleSize" type="range" min="12" max="30" step="1"
                            class="flex-1 h-1 bg-gray-300 rounded-lg accent-green-500">
                        <span class="text-xs w-6 text-right">{{ localData.bubbleSize }}</span>
                    </div>

                    <input v-model="localData.bubbleCss" type="text" class="setting-input mb-3"
                        placeholder="气泡 CSS (实时预览)">

                    <div class="space-y-3 mt-2">
                        <div class="flex gap-2">
                            <input v-model="localData.bgUrl" type="text" class="setting-input mb-0 flex-1"
                                placeholder="背景图 URL">
                            <button class="setting-btn secondary w-auto text-xs whitespace-nowrap px-3"
                                @click="triggerBgUpload">相册</button>
                            <button
                                class="setting-btn secondary w-auto text-xs whitespace-nowrap px-3 bg-red-50 text-red-500"
                                @click="localData.bgUrl = ''">清除</button>
                        </div>
                        <!-- Hidden BG Upload Input -->
                        <input type="file" ref="bgUploadInput" class="hidden" accept="image/*" @change="handleBgUpload">

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <div class="flex justify-between text-xs text-gray-400 mb-1"><span>模糊度</span><span>{{
                                    localData.bgBlur }}px</span></div>
                                <input v-model="localData.bgBlur" type="range" min="0" max="20" step="1"
                                    class="w-full h-1 bg-gray-300 rounded-lg accent-blue-500">
                            </div>
                            <div>
                                <div class="flex justify-between text-xs text-gray-400 mb-1"><span>透明度</span><span>{{
                                    localData.bgOpacity }}</span></div>
                                <input v-model="localData.bgOpacity" type="range" min="0" max="1" step="0.1"
                                    class="w-full h-1 bg-gray-300 rounded-lg accent-blue-500">
                            </div>
                        </div>

                        <!-- NEW: Background Theme Toggle -->
                        <div
                            class="flex items-center justify-between bg-white/40 p-2 rounded-lg border border-white/20">
                            <span class="text-xs text-gray-500 font-medium">背景底色主题</span>
                            <div class="flex bg-gray-200 rounded-md p-0.5">
                                <button @click="localData.bgTheme = 'light'"
                                    class="px-3 py-1 text-[10px] rounded-sm transition-all shadow-sm"
                                    :class="localData.bgTheme === 'light' ? 'bg-white text-gray-800' : 'text-gray-500 hover:text-gray-700'">浅色</button>
                                <button @click="localData.bgTheme = 'dark'"
                                    class="px-3 py-1 text-[10px] rounded-sm transition-all shadow-sm"
                                    :class="localData.bgTheme === 'dark' ? 'bg-[#2e2e2e] text-white' : 'text-gray-500 hover:text-gray-700'">深色</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Delete -->
                <div class="mt-8">
                    <button class="setting-btn danger w-full border py-3 rounded-lg font-bold transition-colors"
                        :class="confirmingDelete ? 'bg-red-600 text-white border-red-700' : 'bg-red-50 text-red-500 border-red-200'"
                        @click="handleDeleteChar">
                        {{ confirmingDelete ? '再次点击确认删除' : '删除角色' }}
                    </button>
                </div>

            </div>
            <!-- Token Detail Modal -->
            <div v-if="showTokenModal"
                class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
                @click="showTokenModal = false">
                <div class="bg-white w-[90%] max-w-[320px] rounded-xl overflow-hidden shadow-2xl" @click.stop>
                    <div class="bg-gray-100 p-3 flex justify-between items-center border-b border-gray-200">
                        <span class="font-bold text-gray-800">Token 统计详情</span>
                        <button @click="showTokenModal = false" class="text-gray-500 hover:text-gray-800"><i
                                class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="p-4 space-y-3 text-sm">
                        <!-- Total -->
                        <div class="flex justify-between items-center mb-2 pb-2 border-b border-gray-100">
                            <span class="font-bold text-gray-700">总计 (Total)</span>
                            <span class="font-bold text-purple-600 font-mono">{{ tokenStats?.total }}</span>
                        </div>

                        <!-- Breakdown -->
                        <div class="space-y-2">
                            <div class="flex justify-between text-gray-600">
                                <span>系统提示 (System)</span>
                                <span class="font-mono text-gray-500">{{ tokenStats?.system }}</span>
                            </div>
                            <div class="flex justify-between text-gray-600">
                                <span>人设 (Persona)</span>
                                <span class="font-mono text-gray-500">{{ tokenStats?.persona }}</span>
                            </div>
                            <div class="flex justify-between text-gray-600">
                                <span>世界书 (WorldBook)</span>
                                <span class="font-mono text-gray-500">{{ tokenStats?.worldBook }}</span>
                            </div>
                            <div class="flex justify-between text-gray-600">
                                <span>长期记忆 (Memory)</span>
                                <span class="font-mono text-gray-500">{{ tokenStats?.memory }}</span>
                            </div>
                            <div class="flex justify-between text-gray-600">
                                <span>上下文历史 (History)</span>
                                <span class="font-mono text-gray-500">{{ tokenStats?.history }}</span>
                            </div>
                            <div class="flex justify-between text-gray-600">
                                <span>自动总结库 (Summary)</span>
                                <span class="font-mono text-gray-500">{{ tokenStats?.summaryLib }}</span>
                            </div>
                        </div>

                        <div class="mt-4 text-[10px] text-gray-400 text-center">
                            * 估算值：1 中文 ≈ 1 Token, 3 英文 ≈ 1 Token
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Manual Summary Modal -->
    <div v-if="showManualSummaryModal"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="showManualSummaryModal = false">
        <div class="bg-white w-[90%] max-w-[320px] rounded-xl overflow-hidden shadow-2xl p-4" @click.stop>
            <h3 class="font-bold text-gray-800 mb-2">手动总结</h3>
            <div class="text-xs text-gray-500 mb-3">总结区间</div>
            <input v-model="manualSummaryRange" type="text"
                class="w-full border border-gray-300 rounded p-2 text-sm mb-1" placeholder="例如: 5-20 (总结第5到20条消息)">
            <div class="text-[10px] text-gray-400 mb-4">输入格式: 开始编号-结束编号</div>
            <div class="flex gap-2">
                <button class="flex-1 py-2 rounded bg-gray-100 text-gray-600 font-medium"
                    @click="showManualSummaryModal = false">取消</button>
                <button class="flex-1 py-2 rounded bg-blue-500 text-white font-medium shadow-md"
                    @click="executeManualSummary">确定</button>
            </div>
        </div>
    </div>

    <!-- Memory Library Modal (Redesigned with Themes) -->
    <div v-if="showMemoryModal"
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="showMemoryModal = false">
        <div class="bg-white w-[90%] max-w-[360px] h-[85%] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            @click.stop>
            <!-- Header with Theme Switcher -->
            <div class="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div class="flex justify-between items-center mb-3">
                    <span class="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        <i class="fa-solid fa-brain text-purple-500"></i> 记忆管理库
                    </span>
                    <button @click="showMemoryModal = false"
                        class="text-gray-500 hover:text-gray-800 transition-colors">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <!-- Theme Selector -->
                <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button v-for="theme in memoryThemes" :key="theme.id" @click="currentMemoryTheme = theme.id"
                        class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0"
                        :class="currentMemoryTheme === theme.id
                            ? 'bg-gradient-to-r ' + theme.activeGradient + ' text-white shadow-md scale-105'
                            : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'">
                        <i :class="theme.icon"></i> {{ theme.name }}
                    </button>
                </div>
            </div>

            <!-- Memory List with Dynamic Theme -->
            <div class="flex-1 overflow-y-auto p-4 space-y-3" :class="getThemeBackground()">
                <div v-if="memories.length === 0" class="text-center text-gray-400 py-12 text-sm">
                    <i class="fa-solid fa-box-open text-4xl mb-3 opacity-30"></i>
                    <div>暂无记忆</div>
                </div>

                <div v-for="(mem, index) in memories" :key="index" class="relative transition-all duration-300"
                    :class="{ 'pl-8': isEditMode }">
                    <!-- Checkbox (Only in Edit Mode) -->
                    <div v-if="isEditMode" class="absolute left-0 top-3">
                        <input type="checkbox"
                            class="w-5 h-5 rounded border-2 border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer transition-transform hover:scale-110"
                            :checked="selectedIndices.has(index)" @change="toggleSelection(index)">
                    </div>

                    <!-- Memory Card with Theme -->
                    <div :class="getThemeCardClass()" class="transition-all duration-300 hover:shadow-lg">
                        <!-- Editing Mode -->
                        <div v-if="editingIndex === index">
                            <textarea v-model="editingContent"
                                class="w-full border-2 border-purple-300 rounded-lg p-3 text-sm h-32 mb-2 focus:ring-2 focus:ring-purple-400 outline-none font-serif"></textarea>
                            <div class="flex justify-end gap-2">
                                <button
                                    class="text-xs px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                    @click="cancelEdit">取消</button>
                                <button
                                    class="text-xs px-4 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors shadow-md"
                                    @click="saveEdit(index)">保存</button>
                            </div>
                        </div>

                        <!-- Display Mode -->
                        <div v-else>
                            <div class="flex justify-between items-start mb-2">
                                <div class="flex items-center gap-2">
                                    <!-- Themed Number Badge -->
                                    <span :class="getThemeNumberClass()">
                                        {{ getThemeNumberPrefix(memories.length - index) }}
                                    </span>
                                    <span :class="getThemeBadgeClass()">{{ getThemeLabel() }}</span>
                                </div>
                                <div class="flex gap-2">
                                    <button class="text-blue-500 hover:text-blue-600 transition-colors p-1"
                                        @click="startEdit(index, mem)" title="编辑">
                                        <i class="fa-solid fa-pen text-sm"></i>
                                    </button>
                                    <button class="text-red-500 hover:text-red-600 transition-colors p-1"
                                        @click="deleteMemory(index)" title="删除">
                                        <i class="fa-solid fa-trash text-sm"></i>
                                    </button>
                                </div>
                            </div>
                            <div :class="getThemeContentClass()">
                                {{ typeof mem === 'object' ? (mem.content || JSON.stringify(mem)) : mem }}
                            </div>
                            <div v-if="typeof mem === 'object' && mem.range" :class="getThemeMetaClass()">
                                <i class="fa-solid fa-clock mr-1"></i>
                                {{ mem.range }} · {{ new Date(mem.timestamp).toLocaleString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric', hour: '2-digit', minute: '2-digit'
                                }) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer with Edit Mode Toggle -->
            <div class="p-3 bg-white border-t border-gray-200 flex justify-between items-center gap-2">
                <!-- Edit Mode Toggle -->
                <button @click="isEditMode = !isEditMode"
                    class="px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2" :class="isEditMode
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
                    <i class="fa-solid" :class="isEditMode ? 'fa-check' : 'fa-edit'"></i>
                    {{ isEditMode ? '完成' : '编辑' }}
                </button>

                <!-- Batch Delete (Only in Edit Mode) -->
                <div v-if="isEditMode" class="flex items-center gap-2">
                    <label class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                        <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"
                            class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
                        全选
                    </label>
                    <button class="text-xs px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-1.5"
                        :class="selectedIndices.size > 0
                            ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'" @click="batchDeleteMemory"
                        :disabled="selectedIndices.size === 0">
                        <i class="fa-solid fa-trash"></i>
                        删除 ({{ selectedIndices.size }})
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Avatar Frame Pickers -->
    <AvatarFramePicker v-if="showFramePicker" v-model="localData.avatarFrame" @close="showFramePicker = false" />
    <AvatarFramePicker v-if="showUserFramePicker" v-model="localData.userAvatarFrame"
        @close="showUserFramePicker = false" />
    <!-- Custom URL Input Modal -->
    <div v-if="showUrlModal"
        class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="showUrlModal = false">
        <div class="bg-white w-[90%] max-w-[340px] rounded-2xl overflow-hidden shadow-2xl p-6 transform transition-all scale-100"
            @click.stop>
            <div class="text-center font-bold text-gray-800 mb-6 text-lg">{{ urlModalTitle }}</div>

            <div class="space-y-4">
                <div>
                    <label class="text-[10px] text-gray-400 block mb-1">图片URL</label>
                    <input v-model="urlModalInput" type="text"
                        class="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-blue-400 focus:bg-white transition-all"
                        placeholder="https://example.com/image.png">
                </div>

                <div class="pt-2">
                    <button
                        class="w-full py-3 rounded-xl bg-blue-500 text-white font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all"
                        @click="confirmUrlModal">
                        使用此URL
                    </button>
                    <button
                        class="w-full py-3 mt-2 rounded-xl bg-transparent text-gray-400 text-sm font-medium active:bg-gray-50 transition-all"
                        @click="showUrlModal = false">
                        取消
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useWorldBookStore } from '../../stores/worldBookStore'
import { useAvatarFrameStore } from '../../stores/avatarFrameStore'
import AvatarFramePicker from '../../components/AvatarFramePicker.vue'

const props = defineProps({
    chatData: {
        type: Object,
        required: true
    }
})

const emit = defineEmits(['close', 'show-profile'])
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const worldBookStore = useWorldBookStore()
const frameStore = useAvatarFrameStore()

// Load World Book Data
worldBookStore.loadEntries()

const fileInput = ref(null)
const userFileInput = ref(null)
const bgUploadInput = ref(null)
const expandedBooks = ref([]) // IDs of expanded books

// Avatar Frame Pickers
const showFramePicker = ref(false)
const showUserFramePicker = ref(false)

// Toast & Confirm State
const toastMessage = ref('')
const toastTimer = ref(null)
const confirmingClear = ref(false)
const confirmingDelete = ref(false)
const isSaving = ref(false)

const showToast = (msg) => {
    toastMessage.value = msg
    clearTimeout(toastTimer.value)
    toastTimer.value = setTimeout(() => {
        toastMessage.value = ''
    }, 2000)
}

// Global BG for transparency effect
const globalBgStyle = computed(() => {
    const url = settingsStore.personalization.globalBgUrl
    return url ? { backgroundImage: `url('${url}')` } : {}
})



// --- Token Stats Logic ---
const showTokenModal = ref(false)
const tokenStats = computed(() => {
    return chatStore.getTokenBreakdown(props.chatData.id)
})

const showTokenDetailModal = () => {
    showTokenModal.value = true
}

// --- Manual Summary Logic ---
// --- Manual Summary Logic ---
const showManualSummaryModal = ref(false)
const manualSummaryRange = ref('')

const triggerManualSummary = () => {
    showManualSummaryModal.value = true
    manualSummaryRange.value = ''
}

const executeManualSummary = async () => {
    // Parse Range
    const rangeInput = manualSummaryRange.value.trim()
    const rangeRegex = /^(\d+)-(\d+)$/
    const match = String(rangeInput).match(rangeRegex)

    let options = {}
    if (match) {
        options.startIndex = parseInt(match[1]) - 1 // 1-based to 0-based
        options.endIndex = parseInt(match[2])
    }

    showManualSummaryModal.value = false
    showToast('正在生成总结...', 3000)

    try {
        // Pass range to store action
        const result = await chatStore.summarizeHistory(props.chatData.id, options)
        if (result && result.success) {
            showToast('总结生成成功！')
        } else if (result && result.error) {
            showToast('生成失败: ' + result.error)
        } else {
            showToast('生成失败或无新内容')
        }
    } catch (e) {
        showToast('生成出错: ' + e.message)
    }
}

// --- Memory Library Logic ---
const showMemoryModal = ref(false)
const memories = computed(() => {
    const memArray = chatStore.chats[props.chatData.id]?.memory || []
    // Reverse to show newest first (most recent at top)
    return memArray.slice().reverse()
})

const loadMemories = () => { /* Computed handles this now */ }

const openMemoryLib = () => {
    showMemoryModal.value = true
}

const deleteMemory = (reversedIndex) => {
    const chat = chatStore.chats[props.chatData.id]
    if (chat && chat.memory) {
        // Convert reversed index to original array index
        const originalIndex = chat.memory.length - 1 - reversedIndex
        chat.memory.splice(originalIndex, 1)
        chatStore.saveChats()
        showToast('已删除')
    }
}

// Edit Memory
const editingIndex = ref(-1)
const editingContent = ref('')

const startEdit = (reversedIndex, mem) => {
    // Convert reversed index to original array index
    const chat = chatStore.chats[props.chatData.id]
    const originalIndex = chat.memory.length - 1 - reversedIndex
    editingIndex.value = reversedIndex // Store reversed index for UI
    // Handle object vs string memory format
    editingContent.value = typeof mem === 'object' ? (mem.content || '') : mem
}

const cancelEdit = () => {
    editingIndex.value = -1
    editingContent.value = ''
}

const saveEdit = (reversedIndex) => {
    const chat = chatStore.chats[props.chatData.id]
    if (chat && chat.memory) {
        // Convert reversed index to original array index
        const originalIndex = chat.memory.length - 1 - reversedIndex
        if (chat.memory[originalIndex]) {
            // Prepare updated memory
            const original = chat.memory[originalIndex]
            if (typeof original === 'object') {
                original.content = editingContent.value
                original.updatedAt = Date.now()
            } else {
                chat.memory[originalIndex] = editingContent.value
            }

            chatStore.saveChats()
            cancelEdit()
            showToast('记忆已更新')
        }
    }
}

// --- Batch Selection Logic ---
const selectedIndices = ref(new Set())

const toggleSelection = (index) => {
    if (selectedIndices.value.has(index)) {
        selectedIndices.value.delete(index)
    } else {
        selectedIndices.value.add(index)
    }
}

const toggleSelectAll = () => {
    if (selectedIndices.value.size === memories.value.length) {
        selectedIndices.value.clear()
    } else {
        memories.value.forEach((_, i) => selectedIndices.value.add(i))
    }
}

const isAllSelected = computed(() => {
    return memories.value.length > 0 && selectedIndices.value.size === memories.value.length
})

const batchDeleteMemory = () => {
    if (selectedIndices.value.size === 0) return

    const chat = chatStore.chats[props.chatData.id]
    if (chat && chat.memory) {
        // Convert reversed indices to original array indices
        const originalIndicesToDelete = new Set()
        selectedIndices.value.forEach(reversedIndex => {
            const originalIndex = chat.memory.length - 1 - reversedIndex
            originalIndicesToDelete.add(originalIndex)
        })

        // Filter out deleted items
        const toKeep = chat.memory.filter((_, index) => !originalIndicesToDelete.has(index))
        chat.memory = toKeep

        chatStore.saveChats()
        showToast(`已删除 ${selectedIndices.value.size} 条记忆`)
        selectedIndices.value.clear()
    }
}

// --- Memory Theme System ---
const currentMemoryTheme = ref('diary')
const isEditMode = ref(false)

const memoryThemes = [
    { id: 'diary', name: '日记风', icon: 'fa-book', activeGradient: 'from-amber-400 to-orange-500' },
    { id: 'newspaper', name: '报纸风', icon: 'fa-newspaper', activeGradient: 'from-gray-700 to-gray-900' },
    { id: 'postage', name: '邮票风', icon: 'fa-stamp', activeGradient: 'from-red-500 to-pink-600' },
    { id: 'poster', name: '海报风', icon: 'fa-image', activeGradient: 'from-purple-500 to-indigo-600' }
]

const getThemeBackground = () => {
    const themes = {
        diary: 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50',
        newspaper: 'bg-gray-100',
        postage: 'bg-gradient-to-br from-red-50 via-pink-50 to-rose-50',
        poster: 'bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50'
    }
    return themes[currentMemoryTheme.value] || themes.diary
}

const getThemeCardClass = () => {
    const themes = {
        diary: 'bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border-2 border-amber-200/50',
        newspaper: 'bg-white p-4 rounded-none shadow-sm border-l-4 border-gray-800 font-serif',
        postage: 'bg-white p-4 rounded-lg shadow-lg border-4 border-dashed border-red-300',
        poster: 'bg-gradient-to-br from-white to-purple-50 p-4 rounded-2xl shadow-xl border-2 border-purple-200'
    }
    return themes[currentMemoryTheme.value] || themes.diary
}

const getThemeBadgeClass = () => {
    const themes = {
        diary: 'text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium',
        newspaper: 'text-[10px] bg-gray-800 text-white px-2 py-0.5 uppercase tracking-wider font-bold',
        postage: 'text-[10px] bg-red-500 text-white px-2 py-1 rounded font-bold',
        poster: 'text-[10px] bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full font-bold shadow-md'
    }
    return themes[currentMemoryTheme.value] || themes.diary
}

const getThemeLabel = () => {
    const labels = {
        diary: '日记条目',
        newspaper: 'MEMORY ARCHIVE',
        postage: '记忆邮票',
        poster: '★ 精彩片段 ★'
    }
    return labels[currentMemoryTheme.value] || labels.diary
}

const getThemeContentClass = () => {
    const themes = {
        diary: 'text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-serif italic',
        newspaper: 'text-sm text-gray-900 leading-snug whitespace-pre-wrap font-serif',
        postage: 'text-sm text-gray-800 leading-relaxed whitespace-pre-wrap text-center',
        poster: 'text-sm text-gray-900 leading-relaxed whitespace-pre-wrap font-bold'
    }
    return themes[currentMemoryTheme.value] || themes.diary
}

const getThemeMetaClass = () => {
    const themes = {
        diary: 'mt-2 text-[10px] text-amber-600 font-medium',
        newspaper: 'mt-2 text-[10px] text-gray-500 uppercase tracking-wide',
        postage: 'mt-2 text-[10px] text-red-500 font-mono',
        poster: 'mt-2 text-[10px] text-purple-600 font-bold'
    }
    return themes[currentMemoryTheme.value] || themes.diary
}

const getThemeNumberClass = () => {
    const themes = {
        diary: 'flex items-center gap-1 text-amber-700 font-serif italic text-base',
        newspaper: 'flex items-center gap-1 text-gray-900 font-bold text-sm tracking-wider uppercase',
        postage: 'flex items-center gap-0.5 text-red-600 font-mono font-bold text-sm',
        poster: 'flex items-center gap-1 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-black text-lg'
    }
    return themes[currentMemoryTheme.value] || themes.diary
}

const getThemeNumberPrefix = (num) => {
    const prefixes = {
        diary: `No.${num}`,
        newspaper: `Vol.${num}`,
        postage: `#${String(num).padStart(3, '0')}`,
        poster: `★ ${num} ★`
    }
    return prefixes[currentMemoryTheme.value] || prefixes.diary
}





// Local State mapping all fields
const localData = ref({
    name: '',
    avatar: '',
    avatarShape: 'square',
    userName: '',
    userPersona: '',
    userAvatar: '',
    remark: '',
    wechatId: '', // Add ID field
    prompt: '',
    openingLine: '',
    timeAware: false,
    timeSyncMode: 'system',
    virtualTime: '',
    activeChat: false,
    activeInterval: 30,
    proactiveChat: false,
    proactiveInterval: 5,
    contextLimit: 20,
    displayLimit: 50, // Default display limit
    summaryLimit: 50, // Default summary threshold
    autoSummary: false,
    summaryPrompt: '请以第三人称总结上下文对话中的关键信息，包括主要话题、重要事件、人物关系和关键细节，存入记忆库。保持简洁明了，重点突出。',
    autoTTS: false,
    showInnerVoice: true,
    voiceId: '',
    voiceSpeed: 1.0,
    patAction: '',
    patSuffix: '',
    bubbleSize: 15,
    bubbleCss: '',
    bgUrl: '',
    bgBlur: 0,
    bgOpacity: 1.0,
    bgTheme: 'light',
    emojiCategories: [],
    worldBookLinks: [],
    momentsMemoryLimit: 5,
    avatarShape: 'square', // 'circle' or 'square'
    avatarFrame: null, // { id, url, name, scale, offsetX, offsetY }
    userAvatarFrame: null
})

// Sync props
watch(() => props.chatData, (newVal) => {
    if (newVal && !isSaving.value) {
        // Use JSON parse/stringify to break reactivity references and ensure clean copy
        const dataCopy = JSON.parse(JSON.stringify(newVal))

        // Data Migration: handle legacy nickname vs new remark
        if (dataCopy.nickname && !dataCopy.remark) {
            dataCopy.remark = dataCopy.nickname
        }

        // Initialize userAvatar if missing
        if (!dataCopy.userAvatar) {
            dataCopy.userAvatar = chatStore.getRandomAvatar ? chatStore.getRandomAvatar() : '/avatars/小猫开心.jpg'
        }

        localData.value = { ...localData.value, ...dataCopy }

        // Explicitly set name if present (safety check)
        if (newVal.name) localData.value.name = newVal.name
    }
}, { immediate: true }) // Default deep: false for performance

// Image Compression Utility
const compressImage = (file, maxWidth = 400, quality = 0.7) => {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height

                if (width > maxWidth) {
                    height = (height * maxWidth) / width
                    width = maxWidth
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, width, height)
                resolve(canvas.toDataURL('image/jpeg', quality))
            }
            img.src = e.target.result
        }
        reader.readAsDataURL(file)
    })
}

// Avatar Handlers
const triggerAvatarUpload = () => {
    if (fileInput.value) {
        fileInput.value.click()
    } else {
        showToast('无法打开文件选择器')
    }
}
const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
        try {
            const compressed = await compressImage(file, 200, 0.6) // Avatars can be small
            localData.value.avatar = compressed
        } catch (err) {
            console.error('Compression failed', err)
            // Fallback
            const reader = new FileReader()
            reader.onload = (e) => localData.value.avatar = e.target.result
            reader.readAsDataURL(file)
        }
    }
}
const promptAvatarUrl = () => {
    openUrlPrompt('设置角色头像', (url) => {
        if (url) localData.value.avatar = url
    })
}

// User Avatar Handlers
const triggerUserAvatarUpload = () => userFileInput.value.click()
const handleUserAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
        try {
            const compressed = await compressImage(file, 200, 0.6)
            localData.value.userAvatar = compressed
        } catch (err) {
            const reader = new FileReader()
            reader.onload = (e) => localData.value.userAvatar = e.target.result
            reader.readAsDataURL(file)
        }
    }
}
const promptUserAvatarUrl = () => {
    openUrlPrompt('设置我的头像', (url) => {
        if (url) localData.value.userAvatar = url
    })
}

const handleShowProfile = () => {
    // Let parent handle closing and navigation
    emit('show-profile', props.chatData.id)
}


const showUrlModal = ref(false)
const urlModalTitle = ref('')
const urlModalInput = ref('')
const urlModalCallback = ref(null)

const openUrlPrompt = (title, callback) => {
    urlModalTitle.value = title
    urlModalInput.value = ''
    urlModalCallback.value = callback
    showUrlModal.value = true
}

const confirmUrlModal = () => {
    if (urlModalInput.value && urlModalCallback.value) {
        urlModalCallback.value(urlModalInput.value)
    }
    showUrlModal.value = false
}

// Logic
// Background Handlers
const triggerBgUpload = () => bgUploadInput.value.click()
const handleBgUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
        try {
            const compressed = await compressImage(file, 800, 0.7) // Backgrounds can be larger
            localData.value.bgUrl = compressed
        } catch (err) {
            const reader = new FileReader()
            reader.onload = (e) => localData.value.bgUrl = e.target.result
            reader.readAsDataURL(file)
        }
    }
}

const handleClearHistory = () => {
    if (confirmingClear.value) {
        chatStore.clearHistory(props.chatData.id)
        showToast('记录已清空')
        confirmingClear.value = false
    } else {
        confirmingClear.value = true
        setTimeout(() => confirmingClear.value = false, 3000)
    }
}

const handleDeleteChar = () => {
    if (confirmingDelete.value) {
        // chatStore.deleteChat(props.chatData.id) 
        showToast('功能开发中...')
        confirmingDelete.value = false
    } else {
        confirmingDelete.value = true
        setTimeout(() => confirmingDelete.value = false, 3000)
    }
}

const toggleWorldBook = (id) => {
    if (!localData.value.worldBookLinks) localData.value.worldBookLinks = []

    const idx = localData.value.worldBookLinks.indexOf(id)
    if (idx === -1) {
        localData.value.worldBookLinks.push(id)
    } else {
        localData.value.worldBookLinks.splice(idx, 1)
    }
}

const toggleBookExpand = (id) => {
    const idx = expandedBooks.value.indexOf(id)
    if (idx === -1) expandedBooks.value.push(id)
    else expandedBooks.value.splice(idx, 1)
}

const selectAllBook = (book) => {
    if (!book.entries) return
    if (!localData.value.worldBookLinks) localData.value.worldBookLinks = []

    // Check if fully selected
    const allSelected = book.entries.every(e => localData.value.worldBookLinks.includes(e.id))

    if (allSelected) {
        // Deselect all
        book.entries.forEach(e => {
            const idx = localData.value.worldBookLinks.indexOf(e.id)
            if (idx !== -1) localData.value.worldBookLinks.splice(idx, 1)
        })
    } else {
        // Select all
        book.entries.forEach(e => {
            if (!localData.value.worldBookLinks.includes(e.id)) {
                localData.value.worldBookLinks.push(e.id)
            }
        })
    }
}

const saveSettings = () => {
    if (!props.chatData || !props.chatData.id) {
        console.error('[Settings] FAILED TO SAVE: Chat ID is missing!', props.chatData)
        showToast('保存失败：会话ID缺失')
        return
    }

    isSaving.value = true

    console.log('[Settings] Save Clicked - Preparing Data for ID:', props.chatData.id)

    // Check for Remark Change
    const oldRemark = props.chatData.remark
    const newRemark = localData.value.remark

    // Virtual time sync logic
    if (localData.value.timeSyncMode === 'manual' && (!localData.value.virtualTimeLastSync || localData.value.virtualTimeLastSync === 0)) {
        localData.value.virtualTimeLastSync = Date.now()
    }

    // Capture final data state
    const finalData = JSON.parse(JSON.stringify(localData.value))

    console.log('[Settings] Dispatching Update to Store:', finalData)

    // 1. Update character in centralized store
    const success = chatStore.updateCharacter(props.chatData.id, finalData)

    if (success) {
        // 2. Add system notification if remark changed
        // 2. Add system notification if remark changed (SKIP for new chats to avoid hiding friend request)
        if (!props.chatData.isNew && newRemark !== undefined && newRemark !== oldRemark) {
            chatStore.addMessage(props.chatData.id, {
                role: 'system',
                content: `${localData.value.userName || '用户'}将你的备注改成了${newRemark || '无'}`
            })
        }

        showToast('设置已保存')

        // Use a slightly longer delay to ensure Vue has processed the store update 
        // and reflected it back to props BEFORE we destroy the component.
        setTimeout(() => {
            isSaving.value = false
            console.log('[Settings] Save Sequence Complete. Closing modal.')
            emit('close')
        }, 600)
    } else {
        // saveChats already showed an alert/console error
        isSaving.value = false
    }
}

const handleManualSummary = async () => {
    try {
        showToast('正在生成总结...')
        const result = await chatStore.summarizeHistory(props.chatData.id)
        if (result) showToast('总结已生成')
    } catch (e) {
        console.error(e)
        showToast('生成失败: ' + e.message)
    }
}
// Sticker Logic
const triggerStickerUpload = () => stickerInput.value.click()
const handleStickerUpload = async (e) => {
    const file = e.target.files[0]
    if (file) {
        try {
            const scope = stickerScope.value === 'special_global' ? 'global' : props.chatData.id
            await stickerStore.uploadSticker(file, scope)
            showToast('添加成功')
        } catch (err) {
            console.error(err)
            showToast('添加失败')
        }
        e.target.value = ''
    }
}

const handleStickerUrlAdd = () => {
    if (!stickerUrlInput.value) return
    const scope = stickerScope.value === 'special_global' ? 'global' : props.chatData.id
    const success = stickerStore.addSticker(stickerUrlInput.value, '', scope)
    if (success) {
        showToast('添加成功')
        stickerUrlInput.value = ''
        showStickerUrlInput.value = false
    } else {
        showToast('添加失败或已存在')
    }
}

const triggerTxtImport = () => txtInput.value.click()
const handleTxtImport = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
        const content = event.target.result
        const scope = stickerScope.value === 'special_global' ? 'global' : 'special'
        const res = stickerStore.importStickersFromText(content, scope)

        if (scope === 'special' && res.newStickers?.length > 0) {
            const newEmojis = [...(props.chatData.emojis || []), ...res.newStickers]
            chatStore.updateCharacter(props.chatData.id, { emojis: newEmojis })
        }

        showToast(`成功:${res.success}, 重复:${res.duplicate}, 失败:${res.failed}`)
        e.target.value = ''
    }
    reader.onerror = () => showToast('读取文件失败')
    reader.readAsText(file)
}

const confirmDeleteSticker = (url) => {
    // Custom confirm? Or just delete? User hates alerts.
    // I'll make it direct delete context menu or similar. Or just delete.
    // Or I can add a small text "Double click to delete" or similar.
    // For now, I will just delete it, or maybe log a warning.
    // Given user frustration, I will implementing a simple inline Confirm state if possible, or just delete.
    const scope = stickerScope.value === 'special_global' ? 'global' : props.chatData.id
    stickerStore.deleteSticker(url, scope)
}

// Avatar Shape and Frame Functions
function getAvatarShapeClass() {
    // 有头像框时强制圆形
    if (localData.value.avatarFrame || localData.value.userAvatarFrame) {
        return 'rounded-full'
    }
    // 根据设置返回形状
    return localData.value.avatarShape === 'circle' ? 'rounded-full' : 'rounded-md'
}

function toggleAvatarShape() {
    localData.value.avatarShape = localData.value.avatarShape === 'circle' ? 'square' : 'circle'
}

</script>

<style scoped>
.animate-slide-in-right {
    animation: slideInRight 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
    }

    to {
        transform: translateX(0);
    }
}

.setting-input {
    width: 100%;
    background-color: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    padding: 8px;
    font-size: 14px;
    color: #1f2937;
    outline: none;
    transition: all 0.2s;
}

.setting-input:focus {
    background-color: white;
    border-color: #22c55e;
    /* green-500 */
}

.short-input {
    width: 60px;
    background-color: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    padding: 4px;
    font-size: 14px;
    color: #1f2937;
    outline: none;
}

.short-input:focus {
    background-color: white;
    border-color: #22c55e;
}

.section-title {
    font-size: 13px;
    font-weight: bold;
    color: #4b5563;
    /* gray-600 */
    margin-bottom: 6px;
    margin-left: 2px;
}

.setting-btn {
    padding: 8px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.setting-btn.secondary {
    background-color: white;
    border: 1px solid #e5e7eb;
    color: #374151;
}

.setting-btn.secondary:active {
    background-color: #f3f4f6;
}
</style>

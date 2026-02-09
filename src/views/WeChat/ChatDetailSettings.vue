<template>
    <div class="absolute inset-0 z-[9999] flex flex-col pt-[28px] animate-slide-in-right bg-[#f2f2f2] text-gray-800">
        <!-- Subpage wallpaper layer: mirrors global wallpaper so underlying app content doesn't show through -->
        <div class="absolute inset-0 bg-cover bg-center -z-10" :style="globalBgStyle"></div>

        <!-- Header -->
        <div class="h-[50px] sticky top-0 flex items-center justify-between px-2 z-10"
            :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b]/95 border-b border-[#334155]' : 'bg-white/95 border-b border-gray-200'">
            <button class="w-10 h-full flex items-center justify-center"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'"
                @click="$emit('close')">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="font-bold"
                :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">角色设置 - {{
                    localData.name }}</span>
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
            <div class="flex items-center gap-3 p-3 rounded-xl shadow-sm"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] text-white' : 'bg-white text-gray-800'">
                <div class="flex flex-col items-center gap-2 shrink-0">
                    <div class="relative">
                        <!-- Outer wrapper: NO overflow hidden, so frame can expand -->
                        <div class="w-16 h-16 relative group cursor-pointer" @click="triggerAvatarUpload">

                            <!-- Inner Avatar Wrapper: Handles clipping for shape -->
                            <div class="absolute inset-0 overflow-hidden bg-white flex items-center justify-center border-gray-100"
                                :class="[getAvatarShapeClass(), !localData.avatarFrame ? 'border' : '']">

                                <!-- Inner Avatar Image (Scaled based on frame) -->
                                <div class="w-full h-full transition-all duration-300 pointer-events-none" :style="{
                                    padding: localData.avatarFrame ? ((1 - (localData.avatarFrame.scale || 1)) / 2 * 100) + '%' : '0',
                                    transform: localData.avatarFrame ? `translate(${localData.avatarFrame.offsetX || 0}px, ${localData.avatarFrame.offsetY || 0}px)` : 'none'
                                }">
                                    <img v-if="localData.avatar" :src="localData.avatar"
                                        class="w-full h-full object-cover">
                                    <span v-else class="text-xs text-gray-400">头像</span>
                                </div>
                            </div>

                            <!-- Frame Overlay (Expanded to 130% & Shifted Up) -->
                            <img v-if="localData.avatarFrame" :src="localData.avatarFrame.url"
                                class="absolute pointer-events-none z-10 object-contain"
                                style="left: -15%; top: -25%; width: 130%; height: 130%; max-width: none;">
                        </div>
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
                    <div class="flex items-center gap-0 mb-1">
                        <input v-model="localData.name" type="text"
                            class="text-base font-bold bg-transparent outline-none min-w-[60px] max-w-[180px]"
                            placeholder="角色名字" :style="'width:' + ((localData.name?.length || 4) * 12) + 'px'">
                        <!-- 角色性别图标 (Click to Toggle) -->
                        <button
                            @click="localData.gender = localData.gender === '男' ? '女' : (localData.gender === '女' ? '无' : '男')"
                            class="transition-opacity hover:opacity-70" :title="'性别: ' + localData.gender">
                            <i v-if="localData.gender === '男'" class="fa-solid fa-mars text-blue-500 text-sm"></i>
                            <i v-else-if="localData.gender === '女'" class="fa-solid fa-venus text-pink-500 text-sm"></i>
                            <i v-else class="fa-solid fa-genderless text-gray-400 text-sm"></i>
                        </button>
                    </div>
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
                <h3 class="section-title"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">我的人设
                    (User Persona)</h3>
                <div class="p-3 rounded-xl shadow-sm"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] text-white' : 'bg-white text-gray-800'">
                    <div class="flex items-center gap-3 mb-3">
                        <!-- 用户头像区域 -->
                        <div class="flex flex-col items-center gap-2 shrink-0">
                            <div class="relative">
                                <!-- Outer wrapper: NO overflow hidden -->
                                <div class="w-16 h-16 relative group cursor-pointer" @click="triggerUserAvatarUpload">

                                    <!-- Inner Wrapper: Clips the avatar image -->
                                    <div class="absolute inset-0 overflow-hidden bg-white flex items-center justify-center border-gray-100"
                                        :class="[getAvatarShapeClass(), !localData.userAvatarFrame ? 'border' : '']">

                                        <!-- Inner Content -->
                                        <div class="w-full h-full transition-all duration-300 pointer-events-none"
                                            :style="{
                                                padding: localData.userAvatarFrame ? ((1 - (localData.userAvatarFrame.scale || 1)) / 2 * 100) + '%' : '0',
                                                transform: localData.userAvatarFrame ? `translate(${localData.userAvatarFrame.offsetX || 0}px, ${localData.userAvatarFrame.offsetY || 0}px)` : 'none'
                                            }">
                                            <img v-if="localData.userAvatar" :src="localData.userAvatar"
                                                class="w-full h-full object-cover">
                                            <span v-else class="text-xs"
                                                :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'">头像</span>
                                        </div>
                                    </div>

                                    <!-- User Avatar Frame (Expanded 130% & Shifted Up) -->
                                    <img v-if="localData.userAvatarFrame" :src="localData.userAvatarFrame.url"
                                        class="absolute pointer-events-none z-10 object-contain"
                                        style="left: -15%; top: -25%; width: 130%; height: 130%; max-width: none;">
                                </div>
                            </div>

                            <!-- 用户操作按钮组 -->
                            <div class="flex flex-col gap-1.5">
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
                            <div class="flex items-center gap-0 mb-1">
                                <input v-model="localData.userName" type="text"
                                    class="text-base font-bold bg-transparent outline-none min-w-[60px] max-w-[180px]"
                                    placeholder="我的名字"
                                    :style="'width:' + ((localData.userName?.length || 4) * 12) + 'px'">
                                <!-- 用户性别图标 (Click to Toggle) -->
                                <button
                                    @click="localData.userGender = localData.userGender === '男' ? '女' : (localData.userGender === '女' ? '无' : '男')"
                                    class="transition-opacity hover:opacity-70" :title="'性别: ' + localData.userGender">
                                    <i v-if="localData.userGender === '男'"
                                        class="fa-solid fa-mars text-blue-500 text-sm"></i>
                                    <i v-else-if="localData.userGender === '女'"
                                        class="fa-solid fa-venus text-pink-500 text-sm"></i>
                                    <i v-else class="fa-solid fa-genderless text-gray-400 text-sm"></i>
                                </button>
                            </div>

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
                    <textarea v-model="localData.userPersona" class="setting-input h-20" placeholder="我的人设..."
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''"></textarea>
                </div>
            </div>

            <!-- Character Definition -->
            <div>
                <h3 class="section-title"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">角色设定
                </h3>
                <input v-model="localData.remark" type="text" class="setting-input mb-2" placeholder="备注名"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">
                <textarea v-model="localData.prompt" class="setting-input h-32 mt-2" placeholder="设定 Prompt..."
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''"></textarea>
            </div>

            <!-- Opening Line -->
            <div>
                <h3 class="section-title"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">开场白设置
                </h3>
                <textarea v-model="localData.openingLine" class="setting-input h-20" placeholder="自定义开场AI说的第一句话..."
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''"></textarea>
                <div class="text-xs mt-1"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-500'">
                    留空则使用默认好友申请卡片</div>
            </div>

            <!-- Worldbook -->
            <div>
                <h3 class="section-title"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">关联世界书
                </h3>
                <div class="glass-panel p-2 rounded-lg border max-h-48 overflow-y-auto"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-white/50 border-white/20'">
                    <div v-if="worldBookStore.books.length === 0" class="text-xs text-center py-2"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-500'">
                        暂无世界书，请在桌面App中创建
                    </div>
                    <div v-else class="space-y-2">
                        <div v-for="book in worldBookStore.books" :key="book.id"
                            class="rounded-lg overflow-hidden border"
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/40 border-white/20'">
                            <!-- Book Header (Click to Expand) -->
                            <div class="flex items-center justify-between p-2 cursor-pointer transition-colors"
                                :class="settingsStore.personalization.theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-white/50'"
                                @click="toggleBookExpand(book.id)">
                                <div class="flex items-center gap-2">
                                    <i class="fa-solid fa-chevron-right text-xs text-gray-500 transition-transform duration-200"
                                        :class="expandedBooks.includes(book.id) ? 'rotate-90' : ''"></i>
                                    <div class="flex flex-col">
                                        <span class="text-sm font-bold"
                                            :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">{{
                                                book.name }}</span>
                                        <span class="text-[10px]"
                                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">
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
                            <div v-show="expandedBooks.includes(book.id)" class="p-2 space-y-1 border-t"
                                :class="settingsStore.personalization.theme === 'dark' ? 'bg-black/10 border-white/5' : 'bg-white/30 border-white/10'">
                                <div v-if="!book.entries || book.entries.length === 0"
                                    class="text-center text-[10px] text-gray-400 py-1">
                                    (空)
                                </div>
                                <div v-for="entry in book.entries" :key="entry.id"
                                    class="flex items-center justify-between p-1.5 rounded transition-colors pl-4"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-white/60'">
                                    <div class="flex flex-col overflow-hidden mr-2">
                                        <span class="text-xs font-medium truncate"
                                            :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-700'"
                                            :title="entry.name">{{ entry.name }}</span>
                                        <span class="text-[10px] truncate"
                                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">
                                            {{ entry.keys && entry.keys.length ? `[${entry.keys.join(',')}]` : '[常驻]' }}
                                        </span>
                                    </div>

                                    <!-- Toggle Entry -->
                                    <div class="w-[32px] h-[18px] rounded-full relative cursor-pointer transition-colors duration-200 shrink-0"
                                        :class="localData.worldBookLinks?.includes(entry.id) ? 'bg-emerald-500' : (settingsStore.personalization.theme === 'dark' ? 'bg-gray-600' : 'bg-[#e0e0e0]')"
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
                <div class="text-[10px] mt-1 px-1"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'">
                    已选 {{ actualSelectedCount }} 项。绑定后，相关设定将注入到该角色的对话中。
                </div>
            </div>

            <!-- Time Awareness -->
            <div class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 border"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                <span class="text-sm"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">时间感知</span>
                <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                    :class="localData.timeAware ? 'bg-emerald-500' : (settingsStore.personalization.theme === 'dark' ? 'bg-gray-600' : 'bg-[#e0e0e0]')"
                    @click="localData.timeAware = !localData.timeAware">
                    <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                        :class="localData.timeAware ? 'left-[22px]' : 'left-[2px]'"></div>
                </div>
            </div>
            <div v-if="localData.timeAware" class="space-y-2 mb-4 animate-fade-in transition-all">
                <div class="flex items-center gap-4 p-2 rounded-lg border"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/40 border-white/20'">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" v-model="localData.timeSyncMode" value="system" class="accent-green-500">
                        <span class="text-xs"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'">系统同步</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" v-model="localData.timeSyncMode" value="manual" class="accent-green-500">
                        <span class="text-xs"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'">虚拟设定</span>
                    </label>
                </div>

                <div v-if="localData.timeSyncMode === 'manual'" class="animate-fade-in-down">
                    <input v-model="localData.virtualTime" @input="localData.virtualTimeLastSync = Date.now()"
                        type="text" class="setting-input mb-1" placeholder="虚拟时间 (如: 乾隆三十年)"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">
                    <div class="text-[10px] px-1 italic"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'">
                        基准时间设定后，系统将模拟其时间的流逝</div>
                </div>
                <div v-else
                    class="text-xs text-green-600 bg-green-50/50 p-2 rounded border border-green-100/50 animate-fade-in">
                    <i class="fa-solid fa-clock-rotate-left mr-1"></i> 已启用实时同步：当前 AI 将时刻感知您的物理时间
                </div>
            </div>

            <!-- Location Sync -->
            <div class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 border"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                <span class="text-sm"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">定位同步</span>
                <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                    :class="localData.locationSync ? 'bg-emerald-500' : (settingsStore.personalization.theme === 'dark' ? 'bg-gray-600' : 'bg-[#e0e0e0]')"
                    @click="toggleLocationSync">
                    <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                        :class="localData.locationSync ? 'left-[22px]' : 'left-[2px]'"></div>
                </div>
            </div>
            <div v-if="localData.locationSync" class="mb-4 animate-fade-in transition-all">
                <div class="text-xs bg-blue-50/50 p-3 rounded border border-blue-100/50 space-y-2">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-location-dot text-blue-600"></i>
                        <span class="font-medium"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-200' : 'text-gray-800'">
                            {{ locationInfo?.realCity || '获取中...' }}
                            <span class="text-gray-500">→</span>
                            {{ locationInfo?.virtualCity || '...' }}
                        </span>
                    </div>
                    <div v-if="locationInfo?.weather" class="text-[10px] space-y-0.5"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'">
                        <div>☁️ {{ locationInfo.weather.weather }} | 🌡️ {{ typeof locationInfo.weather.temperature ===
                            'string' ? locationInfo.weather.temperature.replace('°', '') :
                            locationInfo.weather.temperature }}°C</div>
                        <div v-if="locationInfo.weather.windDirection">💨 {{ locationInfo.weather.windDirection }}
                            {{ locationInfo.weather.windPower }}级</div>
                    </div>
                    <button @click="refreshLocation" class="text-[10px] text-blue-600 hover:underline">
                        <i class="fa-solid fa-arrows-rotate mr-1"></i>刷新定位
                    </button>
                </div>
            </div>

            <!-- Active Chat -->
            <div class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 border"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                <span class="text-sm font-bold"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">查岗（离开界面后触发）</span>
                <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                    :class="localData.activeChat ? 'bg-emerald-500' : (settingsStore.personalization.theme === 'dark' ? 'bg-gray-600' : 'bg-[#e0e0e0]')"
                    @click="localData.activeChat = !localData.activeChat">
                    <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                        :class="localData.activeChat ? 'left-[22px]' : 'left-[2px]'"></div>
                </div>
            </div>
            <div class="flex items-center gap-2 mb-4 px-2">
                <span class="text-xs"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">离开</span>
                <input v-model="localData.activeInterval" type="number" class="short-input text-center"
                    style="width: 66px !important; min-width: 66px !important; max-width: 66px !important; flex: none !important;"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''"
                    min="1">
                <span class="text-xs"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">分钟后触发</span>
            </div>

            <!-- Proactive Chat -->
            <div class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 border"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                <span class="text-sm font-bold"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">主动发消息（界面内触发）</span>
                <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                    :class="localData.proactiveChat ? 'bg-emerald-500' : (settingsStore.personalization.theme === 'dark' ? 'bg-gray-600' : 'bg-[#e0e0e0]')"
                    @click="localData.proactiveChat = !localData.proactiveChat">
                    <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                        :class="localData.proactiveChat ? 'left-[22px]' : 'left-[2px]'"></div>
                </div>
            </div>
            <div class="flex items-center gap-2 mb-4 px-2">
                <span class="text-xs"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">每隔</span>
                <input v-model="localData.proactiveInterval" type="number" class="short-input text-center"
                    style="width: 66px !important; min-width: 66px !important; max-width: 66px !important; flex: none !important; display: inline-block !important;"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''"
                    min="1">
                <span class="text-xs"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">分钟后触发</span>
            </div>

            <!-- Random Proactive Chat -->
            <div class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 border"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                <span class="text-sm font-bold"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">随机主动发消息</span>
                <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                    :class="localData.randomProactive ? 'bg-indigo-500' : (settingsStore.personalization.theme === 'dark' ? 'bg-gray-600' : 'bg-[#e0e0e0]')"
                    @click="localData.randomProactive = !localData.randomProactive">
                    <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                        :class="localData.randomProactive ? 'left-[22px]' : 'left-[2px]'"></div>
                </div>
            </div>
            <div v-if="localData.randomProactive" class="flex items-center gap-2 mb-4 px-2">
                <span class="text-xs"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">频率区间</span>
                <input v-model="localData.randomMin" type="number" class="short-input text-center"
                    style="width: 50px !important; min-width: 50px !important;"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''"
                    min="1">
                <span class="text-xs text-gray-400">-</span>
                <input v-model="localData.randomMax" type="number" class="short-input text-center"
                    style="width: 50px !important; min-width: 50px !important;"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''"
                    min="1">
                <span class="text-xs"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">分钟</span>
            </div>

            <!-- Memory -->
            <div>
                <h3 class="section-title"
                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">记忆与总结
                </h3>
                <div class="grid grid-cols-3 gap-2 text-center mb-3">
                    <div class="glass-panel p-2 rounded-lg border"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                        <div class="text-[10px]"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-600'">
                            总聊天数</div>
                        <div class="font-mono text-blue-600 text-base font-bold">{{ props.chatData.msgs?.length || 0 }}
                        </div>
                    </div>
                    <div class="glass-panel p-2 rounded-lg border"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                        <div class="text-[10px]"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-600'">
                            总Token</div>
                        <div class="font-mono text-orange-600 text-base font-bold">{{ tokenStats?.total || 0 }}</div>
                    </div>
                    <div class="glass-panel p-2 rounded-lg border"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                        <div class="text-[10px]"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500' : 'text-gray-600'">
                            上下文</div>
                        <div class="font-mono text-purple-600 text-base font-bold cursor-pointer underline decoration-dotted"
                            @click="showTokenDetailModal">{{ tokenStats?.totalContext || 0 }}</div>
                    </div>
                </div>

                <div class="mb-2 flex items-center gap-2">
                    <label class="text-xs w-24"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">上下文记忆条数</label>
                    <input v-model="localData.contextLimit" type="number" class="setting-input mt-0 flex-1"
                        placeholder="默认 20 条"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">
                </div>

                <div class="mb-2 flex items-center gap-2">
                    <label class="text-xs w-24"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">上下文显示条数</label>
                    <input v-model="localData.displayLimit" type="number" class="setting-input mt-0 flex-1"
                        placeholder="防止卡顿 (默认 50)"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">
                </div>

                <div class="mb-2 flex items-center gap-2">
                    <label class="text-xs w-24"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">自动总结条数</label>
                    <input v-model="localData.summaryLimit" type="number" class="setting-input mt-0 flex-1"
                        placeholder="每隔多少条触发 (默认 50)"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">
                </div>

                <div class="mb-2 flex items-center gap-2">
                    <label class="text-xs w-24 font-bold text-blue-600">朋友圈记忆</label>
                    <input v-model="localData.momentsMemoryLimit" type="number"
                        class="setting-input mt-0 flex-1 border-blue-100 bg-blue-50/20" placeholder="感知最近几条朋友圈"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-blue-900/20 border-blue-800/50 text-white' : ''">
                </div>

                <div class="glass-panel p-3 rounded-lg mb-2 space-y-3"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                    <div class="flex items-center justify-between">
                        <span class="text-sm"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">自动总结
                            (Auto Summary)</span>
                        <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                            :class="localData.autoSummary ? 'bg-emerald-500' : (settingsStore.personalization.theme === 'dark' ? 'bg-gray-600' : 'bg-[#e0e0e0]')"
                            @click="localData.autoSummary = !localData.autoSummary">
                            <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                                :class="localData.autoSummary ? 'left-[22px]' : 'left-[2px]'"></div>
                        </div>
                    </div>

                    <div class="pt-2 border-t"
                        :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10' : 'border-gray-100'">
                        <label class="text-[10px] mb-1 block"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">总结提示词
                            (Prompt)</label>
                        <textarea v-model="localData.summaryPrompt" class="setting-input h-24 text-xs"
                            placeholder="自定义总结提示词..."
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''"></textarea>
                        <div class="flex gap-2 mt-2">
                            <button class="setting-btn secondary text-xs flex-1"
                                :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : ''"
                                @click="triggerManualSummary">手动总结</button>
                            <button class="setting-btn secondary text-xs flex-1"
                                :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : ''"
                                @click="openMemoryLib">记忆管理库</button>
                        </div>
                    </div>
                </div>


                <!-- Voice (TTS) -->
                <div>
                    <h3 class="section-title"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">语音
                        (TTS)</h3>
                    <div class="flex items-center justify-between glass-panel p-3 rounded-lg mb-2 border"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b] border-white/10' : 'bg-white/50 border-white/20'">
                        <span class="text-sm"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">启用
                            TTS</span>
                        <div class="w-[44px] h-[24px] rounded-full relative cursor-pointer transition-colors duration-200"
                            :class="localData.autoTTS ? 'bg-emerald-500' : (settingsStore.personalization.theme === 'dark' ? 'bg-gray-600' : 'bg-[#e0e0e0]')"
                            @click="localData.autoTTS = !localData.autoTTS">
                            <div class="absolute top-[2px] bg-white w-[20px] h-[20px] rounded-full shadow-sm transition-transform duration-200"
                                :class="localData.autoTTS ? 'left-[22px]' : 'left-[2px]'"></div>
                        </div>
                    </div>
                    <div v-if="settingsStore.voice.engine === 'minimax'" class="mb-2">
                        <input v-model="localData.voiceId" type="text" class="setting-input"
                            placeholder="角色 Voice ID (MiniMax)"
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">
                    </div>
                    <div v-if="settingsStore.voice.engine === 'doubao'" class="mb-2">
                        <div @click="showVoicePicker = true"
                            class="w-full border rounded-lg px-3 py-2 text-sm flex items-center justify-between cursor-pointer transition-colors"
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200'">
                            <span class="truncate">{{ currentVoiceName }}</span>
                            <i class="fa-solid fa-chevron-down text-gray-400 text-[10px]"></i>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'">语速</span>
                        <input v-model.number="localData.voiceSpeed" type="range" min="0.5" max="2" step="0.1"
                            class="flex-1 h-1 bg-gray-300 rounded-lg accent-green-500">
                        <span class="text-xs w-6 text-right"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300' : 'text-gray-800'">{{
                                localData.voiceSpeed }}</span>
                    </div>

                    <!-- Call Virtual Avatar Settings -->
                    <div class="mt-4 border-t pt-3"
                        :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10' : 'border-gray-100'">
                        <label class="text-xs block mb-2"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">通话虚拟形象
                            (视频通话)</label>
                        <div class="grid grid-cols-2 gap-4">
                            <!-- Character Call Avatar -->
                            <div class="flex flex-col items-center gap-2">
                                <span class="text-[10px]"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'">角色形象</span>
                                <div class="w-16 h-16 rounded-lg overflow-hidden border relative group cursor-pointer"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'"
                                    @click="triggerCallAvatarUpload('char')">
                                    <img v-if="localData.callAvatarChar" :src="localData.callAvatarChar"
                                        class="w-full h-full object-cover">
                                    <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
                                        <i class="fa-solid fa-camera"></i>
                                    </div>
                                    <div
                                        class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <i class="fa-solid fa-pen text-white text-xs"></i>
                                    </div>
                                </div>
                                <div class="flex gap-1">
                                    <button class="text-[10px] px-1.5 py-0.5 rounded hover:bg-gray-100"
                                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-50 text-gray-500'"
                                        @click="promptCallAvatarUrl('char')">URL</button>
                                    <button
                                        class="text-[10px] text-red-400 bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100"
                                        @click="localData.callAvatarChar = ''">清空</button>
                                </div>
                            </div>
                            <!-- User Call Avatar -->
                            <div class="flex flex-col items-center gap-2">
                                <span class="text-[10px]"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'">我的形象</span>
                                <div class="w-16 h-16 rounded-lg overflow-hidden border relative group cursor-pointer"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'"
                                    @click="triggerCallAvatarUpload('user')">
                                    <img v-if="localData.callAvatarUser" :src="localData.callAvatarUser"
                                        class="w-full h-full object-cover">
                                    <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
                                        <i class="fa-solid fa-user"></i>
                                    </div>
                                    <div
                                        class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <i class="fa-solid fa-pen text-white text-xs"></i>
                                    </div>
                                </div>
                                <div class="flex gap-1">
                                    <button class="text-[10px] px-1.5 py-0.5 rounded hover:bg-gray-100"
                                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-50 text-gray-500'"
                                        @click="promptCallAvatarUrl('user')">URL</button>
                                    <button
                                        class="text-[10px] text-red-400 bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100"
                                        @click="localData.callAvatarUser = ''">清空</button>
                                </div>
                            </div>
                        </div>
                        <input type="file" ref="callAvatarInput" class="hidden" accept="image/*"
                            @change="handleCallAvatarChange">
                    </div>
                </div>

                <!-- Pat Settings -->
                <div>
                    <h3 class="section-title"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">
                        拍一拍设置</h3>
                    <div class="space-y-2">
                        <input v-model="localData.patAction" type="text" class="setting-input"
                            placeholder="自定义动作，如：敲了敲、摸了摸"
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">
                        <input v-model="localData.patSuffix" type="text" class="setting-input"
                            placeholder="自定义后缀，如：的头、的肩膀"
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">
                    </div>
                </div>

                <!-- Bubble & Background -->
                <div>
                    <h3 class="section-title"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">
                        气泡与背景</h3>
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
                                class="w-10 h-10 rounded shadow bg-white border border-white/50 object-cover">
                            <div class="flex flex-col max-w-[70%]">
                                <div class="px-3 py-2 leading-relaxed shadow-sm transition-all relative" :style="{
                                    fontSize: localData.bubbleSize + 'px',
                                    ...parsePreviewBubbleCss(localData.bubbleCss, 'ai')
                                }">
                                    角色回复的消息
                                </div>
                                <div class="text-[10px] text-gray-400 mt-0.5 px-1">12:00</div>
                            </div>
                        </div>

                        <div class="relative z-10 flex gap-2 flex-row-reverse">
                            <img :src="localData.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me'"
                                class="w-10 h-10 rounded shadow bg-white border border-white/50 object-cover">
                            <div class="flex flex-col items-end max-w-[70%]">
                                <div class="px-3 py-2 leading-relaxed shadow-sm transition-all" :style="{
                                    fontSize: localData.bubbleSize + 'px',
                                    ...parsePreviewBubbleCss(localData.bubbleCss, 'user')
                                }">
                                    我的消息
                                </div>
                                <div class="text-[10px] text-gray-400 mt-0.5 px-1">12:01</div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-xs"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'">字体大小</span>
                        <input v-model="localData.bubbleSize" type="range" min="12" max="30" step="1"
                            class="flex-1 h-1 bg-gray-300 rounded-lg accent-green-500">
                        <span class="text-xs w-6 text-right"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300' : 'text-gray-800'">{{
                                localData.bubbleSize }}</span>
                    </div>

                    <!-- Presets -->
                    <div class="mb-2">
                        <label class="text-xs mb-1 block"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">气泡预设</label>
                        <select @change="onPresetChange"
                            class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 transition-colors"
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200'">
                            <option value="">默认样式</option>
                            <option v-for="preset in presetBubbles" :key="preset.name" :value="preset.name">
                                {{ preset.name }}
                            </option>
                        </select>
                    </div>

                    <input v-model="localData.bubbleCss" type="text" class="setting-input mb-3"
                        placeholder="气泡 CSS (实时预览)"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">

                    <div class="space-y-3 mt-2">
                        <div class="flex gap-2">
                            <input v-model="localData.bgUrl" type="text" class="setting-input mb-0 flex-1"
                                placeholder="背景图 URL"
                                :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : ''">
                            <button class="setting-btn secondary w-auto text-xs whitespace-nowrap px-3"
                                :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : ''"
                                @click="triggerBgUpload">相册</button>
                            <button
                                class="setting-btn secondary w-auto text-xs whitespace-nowrap px-3 bg-red-50 text-red-500"
                                @click="localData.bgUrl = ''">清除</button>
                        </div>
                        <!-- Hidden BG Upload Input -->
                        <input type="file" ref="bgUploadInput" class="hidden" accept="image/*" @change="handleBgUpload">

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <div class="flex justify-between text-xs mb-1"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'">
                                    <span>模糊度</span><span>{{
                                        localData.bgBlur }}px</span>
                                </div>
                                <input v-model="localData.bgBlur" type="range" min="0" max="20" step="1"
                                    class="w-full h-1 bg-gray-300 rounded-lg accent-blue-500">
                            </div>
                            <div>
                                <div class="flex justify-between text-xs mb-1"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'">
                                    <span>透明度</span><span>{{
                                        localData.bgOpacity }}</span>
                                </div>
                                <input v-model="localData.bgOpacity" type="range" min="0" max="1" step="0.1"
                                    class="w-full h-1 bg-gray-300 rounded-lg accent-blue-500">
                            </div>
                        </div>

                        <!-- NEW: Background Theme Toggle -->
                        <div class="flex items-center justify-between p-2 rounded-lg border"
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white/40 border-white/20'">
                            <span class="text-xs font-medium"
                                :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'">背景底色主题</span>
                            <div class="flex bg-gray-200 rounded-md p-0.5"
                                :class="settingsStore.personalization.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'">
                                <button @click="localData.bgTheme = 'light'"
                                    class="px-3 py-1 text-[10px] rounded-sm transition-all shadow-sm"
                                    :class="localData.bgTheme === 'light' ? (settingsStore.personalization.theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-800') : (settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700')">浅色</button>
                                <button @click="localData.bgTheme = 'dark'"
                                    class="px-3 py-1 text-[10px] rounded-sm transition-all shadow-sm"
                                    :class="localData.bgTheme === 'dark' ? (settingsStore.personalization.theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-[#2e2e2e] text-white') : (settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700')">深色</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Delete -->
                <!-- Data & Management -->
                <div class="mt-6">
                    <h3 class="section-title"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">
                        数据与管理</h3>

                    <!-- Export Card -->
                    <button
                        class="w-full py-3 mb-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
                        @click="handleExportCardClick">
                        <i class="fa-solid fa-file-export"></i> 导出角色卡
                    </button>

                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <!-- Reset Layout -->
                        <button
                            class="py-3 rounded-xl bg-white text-orange-500 font-bold border border-orange-100 active:bg-orange-50 transition-colors shadow-sm"
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-orange-900/50 text-orange-400 active:bg-orange-900/20' : ''"
                            @click="handleResetConfigClick">
                            重置配置
                        </button>
                        <!-- Clear History -->
                        <button
                            class="py-3 rounded-xl bg-white text-gray-700 font-bold border border-gray-200 active:bg-gray-50 transition-colors shadow-sm"
                            :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 border-gray-700 text-gray-300 active:bg-gray-700/20' : ''"
                            @click="handleClearHistoryClick">
                            删除记录
                        </button>
                    </div>

                    <!-- Delete Character -->
                    <button
                        class="w-full py-3 rounded-xl bg-red-50 text-red-500 font-bold border border-red-100 active:bg-red-100 transition-colors shadow-sm"
                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-red-900/20 border-red-800/50 text-red-400 active:bg-red-900/40' : ''"
                        @click="handleDeleteCharacterClick">
                        删除角色 (删除好友)
                    </button>
                </div>
            </div>
        </div>
        <!-- Token Detail Modal -->
        <div v-if="showTokenModal"
            class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            @click="showTokenModal = false">
            <div class="w-[90%] max-w-[320px] rounded-xl overflow-hidden shadow-2xl"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#1e293b]' : 'bg-white'" @click.stop>
                <div class="p-3 flex justify-between items-center border-b"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#334155] border-[#475569]' : 'bg-gray-100 border-gray-200'">
                    <span class="font-bold"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">Token
                        统计详情</span>
                    <button @click="showTokenModal = false"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'"><i
                            class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-4 space-y-3 text-sm">
                    <!-- Total -->
                    <div class="flex justify-between items-center mb-2 pb-2 border-b"
                        :class="settingsStore.personalization.theme === 'dark' ? 'border-gray-700' : 'border-gray-100'">
                        <span class="font-bold"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-700'">总计
                            (Total Context)</span>
                        <span class="font-bold text-purple-600 font-mono">{{ contextTokenCounts?.total || 0
                        }}</span>
                    </div>

                    <!-- Breakdown List -->
                    <div class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        <div v-for="(label, key) in contextLabels" :key="key">
                            <div class="flex justify-between items-center text-gray-600 cursor-pointer p-2 rounded transition-colors"
                                :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-300 hover:bg-white/10' : 'hover:bg-gray-50'"
                                @click="toggleContextExpand(key)">
                                <span class="font-medium border-b border-dashed transition-colors"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'border-gray-600 hover:border-gray-400' : 'border-gray-300 hover:border-gray-500'">{{
                                        label }}</span>
                                <span class="font-mono px-1.5 rounded text-xs"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400 bg-gray-700' : 'text-gray-500 bg-gray-100'">{{
                                        contextTokenCounts[key] || 0 }}</span>
                            </div>

                            <!-- Expanded Content -->
                            <div v-if="expandedContextKey === key"
                                class="mt-1 p-2 rounded text-[10px] whitespace-pre-wrap font-mono break-all max-h-[200px] overflow-y-auto shadow-inner"
                                :class="settingsStore.personalization.theme === 'dark' ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-gray-50 text-gray-500 border border-gray-100'">
                                {{ contextPreviewData[key] || '（无内容）' }}
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 text-[10px] text-center border-t pt-2"
                        :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-500 border-gray-700' : 'text-gray-400'">
                        * 点击条目可查看实际发送给 AI 的文本内容<br>
                        * 估算值：1 中文 ≈ 1 Token, 3 英文 ≈ 1 Token
                    </div>
                </div>
            </div>
        </div>

        <!-- Memory Library Modal (Redesigned with Themes) -->
        <div v-if="showMemoryModal"
            class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            @click="showMemoryModal = false">
            <div class="w-[90%] max-w-[360px] h-[85%] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white'" @click.stop>
                <!-- Header with Theme Switcher -->
                <div class="p-4 border-b" :class="settingsStore.personalization.theme === 'dark'
                    ? 'border-[#334155] bg-gradient-to-r from-purple-900/50 to-pink-900/50'
                    : 'border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50'">
                    <div class="flex justify-between items-center mb-3">
                        <span class="font-bold flex items-center gap-2 text-lg"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-white' : 'text-gray-800'">
                            <i class="fa-solid fa-brain text-purple-500"></i> 记忆管理库
                        </span>
                        <button @click="showMemoryModal = false" class="transition-colors"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'">
                            <i class="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>

                    <!-- Theme Selector -->
                    <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <button v-for="theme in memoryThemes" :key="theme.id" @click="currentMemoryTheme = theme.id"
                            class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0"
                            :class="currentMemoryTheme === theme.id
                                ? 'bg-gradient-to-r ' + theme.activeGradient + ' text-white shadow-md scale-105'
                                : (settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')">
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
                                    class="w-full border-2 border-purple-300 rounded-lg p-3 text-sm h-32 mb-2 focus:ring-2 focus:ring-purple-400 outline-none font-serif"
                                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-gray-700 text-white border-purple-600 focus:ring-purple-500' : ''"></textarea>
                                <div class="flex justify-end gap-2">
                                    <button class="text-xs px-4 py-1.5 rounded-lg transition-colors"
                                        :class="settingsStore.personalization.theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
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
                <div class="p-3 border-t flex justify-between items-center gap-2"
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a] border-[#334155]' : 'bg-white border-gray-200'">
                    <!-- Edit Mode Toggle -->
                    <button @click="isEditMode = !isEditMode"
                        class="px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2"
                        :class="isEditMode
                            ? 'bg-purple-500 text-white shadow-md'
                            : (settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')">
                        <i class="fa-solid" :class="isEditMode ? 'fa-check' : 'fa-edit'"></i>
                        {{ isEditMode ? '完成' : '编辑' }}
                    </button>

                    <!-- Batch Delete (Only in Edit Mode) -->
                    <div v-if="isEditMode" class="flex items-center gap-2">
                        <label class="flex items-center gap-1.5 text-xs cursor-pointer select-none"
                            :class="settingsStore.personalization.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'">
                            <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"
                                class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
                            全选
                        </label>
                        <button
                            class="text-xs px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-1.5"
                            :class="selectedIndices.size > 0
                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
                                : (settingsStore.personalization.theme === 'dark' ? 'bg-white/5 text-gray-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed')"
                            @click="batchDeleteMemory" :disabled="selectedIndices.size === 0">
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

        <!-- Export Card Modal -->
        <div v-if="showExportModal"
            class="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            @click="showExportModal = false">
            <div class="bg-white w-[85%] max-w-[320px] rounded-2xl overflow-hidden shadow-2xl p-6 animate-scale-up"
                @click.stop>
                <h3 class="text-lg font-bold text-gray-900 mb-4 text-center">导出角色卡</h3>

                <div class="space-y-3 mb-6">
                    <!-- Include Memory -->
                    <div class="bg-gray-50 p-3 rounded-xl flex items-center gap-3 cursor-pointer select-none"
                        @click="exportIncludeMemory = !exportIncludeMemory">
                        <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm"
                            :class="exportIncludeMemory ? 'bg-purple-500 border-purple-500' : 'bg-white border-gray-300'">
                            <i v-if="exportIncludeMemory" class="fa-solid fa-check text-white text-xs"></i>
                        </div>
                        <div class="flex-1">
                            <div class="text-sm font-bold text-gray-700">包含记忆库</div>
                            <div class="text-[10px] text-gray-400">保留角色已有的长期记忆</div>
                        </div>
                    </div>

                    <!-- Include History -->
                    <div class="bg-gray-50 p-3 rounded-xl flex items-center gap-3 cursor-pointer select-none"
                        @click="exportIncludeHistory = !exportIncludeHistory">
                        <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm"
                            :class="exportIncludeHistory ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'">
                            <i v-if="exportIncludeHistory" class="fa-solid fa-check text-white text-xs"></i>
                        </div>
                        <div class="flex-1">
                            <div class="text-sm font-bold text-gray-700">包含聊天记录</div>
                            <div class="text-[10px] text-gray-400 text-orange-500">
                                <i class="fa-solid fa-triangle-exclamation mr-1"></i>文件可能较大
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex gap-3">
                    <button
                        class="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold active:scale-95 transition-transform"
                        @click="showExportModal = false">取消</button>
                    <button
                        class="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                        @click="handleExportCard">导出</button>
                </div>
            </div>
        </div>

        <!-- Avatar Cropper Modal -->
        <AvatarCropper v-if="showAvatarCropper || showUserAvatarCropper" :image-src="cropperImageSrc"
            @crop="handleCropComplete" @cancel="handleCropCancel" />

        <!-- Voice Picker Modal -->
        <Transition name="fade">
            <div v-if="showVoicePicker"
                class="fixed inset-0 z-[10002] bg-black/60 backdrop-blur-sm flex items-end justify-center"
                @click="showVoicePicker = false">
                <div class="w-full max-w-[500px] bg-[#f8f9fa] rounded-t-[32px] flex flex-col max-h-[85vh] animate-slide-up shadow-2xl"
                    @click.stop
                    :class="settingsStore.personalization.theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#f8f9fa] text-gray-800'">
                    <!-- Header -->
                    <div class="sticky top-0 p-6 flex flex-col gap-4 bg-inherit rounded-t-[32px] border-b"
                        :class="settingsStore.personalization.theme === 'dark' ? 'border-white/10' : 'border-gray-100'">
                        <div class="flex justify-between items-center">
                            <h2 class="text-xl font-black">选择音色 (Doubao)</h2>
                            <button @click="showVoicePicker = false"
                                class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <!-- Search Bar -->
                        <div class="relative">
                            <i
                                class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                            <input v-model="voiceSearchQuery" type="text" placeholder="搜索发声人名称或 ID..."
                                class="w-full pl-11 pr-4 py-3 rounded-2xl border-none outline-none text-sm transition-all shadow-sm"
                                :class="settingsStore.personalization.theme === 'dark' ? 'bg-white/5 focus:bg-white/10 text-white' : 'bg-white focus:shadow-md'">
                        </div>
                    </div>

                    <!-- List container with specific height/scroll -->
                    <div class="flex-1 overflow-y-auto p-4 space-y-2 min-h-[300px]">
                        <div v-for="v in filteredVoices" :key="v.id" @click="selectVoice(v.id)"
                            class="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                            :class="[
                                localData.doubaoSpeaker === v.id
                                    ? (settingsStore.personalization.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-100')
                                    : (settingsStore.personalization.theme === 'dark' ? 'hover:bg-white/5 border border-transparent' : 'hover:bg-white border border-transparent hover:border-gray-100')
                            ]">
                            <div class="flex flex-col">
                                <span class="font-bold text-sm">{{ v.name }}</span>
                                <span class="text-[10px] opacity-40 font-mono">{{ v.id }}</span>
                            </div>
                            <div v-if="localData.doubaoSpeaker === v.id"
                                class="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                                <i class="fa-solid fa-check text-white text-[10px]"></i>
                            </div>
                        </div>
                        <div v-if="filteredVoices.length === 0" class="py-12 text-center opacity-40 italic text-sm">
                            未找到相关音色
                        </div>
                    </div>

                    <!-- Footer Area Padding for Safe Space -->
                    <div class="h-8 shrink-0"></div>
                </div>
            </div>
        </Transition>
    </div> <!-- End Main Wrapper -->
</template>

<script setup>
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useWorldBookStore } from '../../stores/worldBookStore'
import { useSchedulerStore } from '../../stores/schedulerStore'
import { useAvatarFrameStore } from '../../stores/avatarFrameStore'
import AvatarFramePicker from '../../components/AvatarFramePicker.vue'
import AvatarCropper from '../../components/AvatarCropper.vue'
import { weatherService } from '../../utils/weatherService'

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
const schedulerStore = useSchedulerStore()
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

// Avatar Cropper
const showAvatarCropper = ref(false)
const showUserAvatarCropper = ref(false)
const cropperImageSrc = ref('')
const currentAvatarType = ref('character') // 'character' or 'user'

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

// Location Sync Logic
const locationInfo = ref(null)

const toggleLocationSync = async () => {
    if (!localData.value.locationSync) {
        // Enabling
        localData.value.locationSync = true
        showToast('正在获取位置信息...')

        try {
            const result = await weatherService.enableLocationSync()
            if (result.success) {
                locationInfo.value = weatherService.getLocationInfo()
                showToast(`定位成功: ${result.realCity} → ${result.virtualCity}`)
            } else {
                showToast('定位失败，已使用默认城市')
                locationInfo.value = weatherService.getLocationInfo()
            }
        } catch (error) {
            showToast('定位失败: ' + error.message)
            localData.value.locationSync = false
        }
    } else {
        // Disabling
        localData.value.locationSync = false
        weatherService.disableLocationSync()
        locationInfo.value = null
        showToast('已关闭定位同步')
    }
}

const refreshLocation = async () => {
    showToast('刷新中...')
    try {
        await weatherService.refreshWeather()
        locationInfo.value = weatherService.getLocationInfo()
        showToast('刷新成功')
    } catch (error) {
        showToast('刷新失败')
    }
}




// --- Token Stats Logic ---
// --- Token Stats Logic ---
const showTokenModal = ref(false)
const contextPreviewData = ref({})
const contextTokenCounts = ref({})
const expandedContextKey = ref(null)

// Restored: This is needed for the stats cards in the template
const tokenStats = computed(() => {
    return chatStore.getTokenBreakdown(props.chatData.id) || {
        total: 0,
        totalContext: 0,
        system: 0,
        persona: 0,
        worldBook: 0,
        memory: 0,
        history: 0,
        summaryLib: 0
    }
})



const contextLabels = {
    system: '系统提示 (System)',
    persona: '人设 (Persona)',
    worldBook: '世界书 (WorldBook)',
    moments: '朋友圈 (Moments)',
    history: '上下文历史 (History)',
    summary: '自动总结库 (Summary)'
}

const showTokenDetailModal = () => {
    try {
        // Load Preview Data
        const raw = chatStore.getPreviewContext(props.chatData.id)
        if (raw) {
            contextPreviewData.value = raw
            // Calculate tokens locally for preview consistency
            let total = 0
            const counts = {}
            for (const k in raw) {
                const text = raw[k] || ''
                const count = chatStore.estimateTokens(text)
                counts[k] = count
                total += count
            }
            counts.total = total
            contextTokenCounts.value = counts
            showTokenModal.value = true
        } else {
            showToast('无法生成上下文预览')
        }
    } catch (e) {
        console.error('ShowTokenDetailModal Error:', e)
        showToast('加载失败，请重试')
    }
}

const toggleContextExpand = (key) => {
    if (expandedContextKey.value === key) expandedContextKey.value = null
    else expandedContextKey.value = key
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

    try {
        // Pass range to store action
        await chatStore.summarizeHistory(props.chatData.id, options)
    } catch (e) {
        console.error(e)
    }
}

// --- Memory Library Logic ---
const showMemoryModal = ref(false)
const memories = computed(() => {
    const memArray = chatStore.chats[props.chatData.id]?.memory || []
    // The store uses unshift, so new items are already at the beginning.
    // No need to reverse, which would put oldest items at the top.
    return memArray.slice()
})

const loadMemories = () => { /* Computed handles this now */ }

const openMemoryLib = () => {
    showMemoryModal.value = true
}

const deleteMemory = (index) => {
    const chat = chatStore.chats[props.chatData.id]
    if (chat && chat.memory) {
        chat.memory.splice(index, 1)
        chatStore.saveChats()
        showToast('已删除')
    }
}

// Edit Memory
const editingIndex = ref(-1)
const editingContent = ref('')

const startEdit = (index, mem) => {
    editingIndex.value = index
    editingContent.value = typeof mem === 'object' ? (mem.content || '') : mem
}

const cancelEdit = () => {
    editingIndex.value = -1
    editingContent.value = ''
}

const saveEdit = (index) => {
    const chat = chatStore.chats[props.chatData.id]
    if (chat && chat.memory) {
        if (chat.memory[index]) {
            // Prepare updated memory
            const original = chat.memory[index]
            if (typeof original === 'object') {
                original.content = editingContent.value
                original.updatedAt = Date.now()
            } else {
                chat.memory[index] = editingContent.value
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
    const isDark = settingsStore.personalization.theme === 'dark'
    const themes = {
        diary: isDark ? 'bg-gradient-to-br from-[#1a1410] to-[#2d1d15]' : 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50',
        newspaper: isDark ? 'bg-[#121212]' : 'bg-gray-100',
        postage: isDark ? 'bg-gradient-to-br from-[#1a0f0f] to-[#2d1212]' : 'bg-gradient-to-br from-red-50 via-pink-50 to-rose-50',
        poster: isDark ? 'bg-gradient-to-br from-[#130d1a] to-[#1e1432]' : 'bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50'
    }
    return themes[currentMemoryTheme.value] || themes.diary
}

const getThemeCardClass = () => {
    const isDark = settingsStore.personalization.theme === 'dark'
    const themes = {
        diary: isDark ? 'bg-[#3d2b1f]/40 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-amber-500/20' : 'bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-md border-2 border-amber-200/50',
        newspaper: isDark ? 'bg-[#1a1a1a] p-4 rounded-none shadow-sm border-l-4 border-gray-600 font-serif border border-white/5' : 'bg-white p-4 rounded-none shadow-sm border-l-4 border-gray-800 font-serif',
        postage: isDark ? 'bg-[#4d1a1a]/40 p-4 rounded-lg shadow-lg border-2 border-dashed border-rose-500/30' : 'bg-white p-4 rounded-lg shadow-lg border-4 border-dashed border-red-300',
        poster: isDark ? 'bg-gradient-to-br from-purple-900/60 to-indigo-900/60 p-4 rounded-2xl shadow-2xl border border-purple-500/20' : 'bg-gradient-to-br from-white to-purple-50 p-4 rounded-2xl shadow-xl border-2 border-purple-200'
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
    const isDark = settingsStore.personalization.theme === 'dark'
    const themes = {
        diary: `text-sm leading-relaxed whitespace-pre-wrap font-serif italic ${isDark ? 'text-amber-100/80' : 'text-gray-800'}`,
        newspaper: `text-sm leading-snug whitespace-pre-wrap font-serif ${isDark ? 'text-gray-200' : 'text-gray-900'}`,
        postage: `text-sm leading-relaxed whitespace-pre-wrap text-center ${isDark ? 'text-rose-100/90' : 'text-gray-800'}`,
        poster: `text-sm leading-relaxed whitespace-pre-wrap font-bold ${isDark ? 'text-white' : 'text-gray-900'}`
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

// --- Voice Picker System ---
const showVoicePicker = ref(false)
const voiceSearchQuery = ref('')
const filteredVoices = computed(() => {
    const list = settingsStore.voice.doubaoVoices || []
    if (!voiceSearchQuery.value) return list
    const q = voiceSearchQuery.value.toLowerCase()
    return list.filter(v => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q))
})
const selectVoice = (voiceId) => {
    localData.value.doubaoSpeaker = voiceId
    showVoicePicker.value = false
    voiceSearchQuery.value = ''
}
const currentVoiceName = computed(() => {
    const v = settingsStore.voice.doubaoVoices?.find(v => v.id === localData.value.doubaoSpeaker)
    return v ? v.name : (localData.value.doubaoSpeaker || '未选择')
})

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
    locationSync: false, // Location sync toggle
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
    doubaoSpeaker: 'zh_female_sichuan',
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
    userGender: '无', // Add User Gender
    gender: '无',    // Add Char Gender
    avatarShape: 'square', // 'circle' or 'square'
    avatarFrame: null, // { id, url, name, scale, offsetX, offsetY }
    userAvatarFrame: null,
    callAvatarChar: '', // New Call Avatar Fields
    callAvatarUser: '',
    randomProactive: false,
    randomMin: 30,
    randomMax: 120
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

        // Ensure gender fields are present
        if (!dataCopy.gender) dataCopy.gender = '无'
        if (!dataCopy.userGender) dataCopy.userGender = '无'

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

// Count only existing world book links
const actualSelectedCount = computed(() => {
    if (!localData.value.worldBookLinks) return 0
    const allEntryIds = new Set()
    worldBookStore.books.forEach(book => {
        if (book.entries) {
            book.entries.forEach(e => allEntryIds.add(e.id))
        }
    })
    return localData.value.worldBookLinks.filter(id => allEntryIds.has(id)).length
})

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
            // Read file as data URL to show in cropper
            const reader = new FileReader()
            reader.onload = (e) => {
                cropperImageSrc.value = e.target.result
                currentAvatarType.value = 'character'
                showAvatarCropper.value = true
            }
            reader.readAsDataURL(file)
        } catch (err) {
            console.error('Failed to read file', err)
            showToast('文件读取失败')
        }
    }
}
const promptAvatarUrl = () => {
    chatStore.triggerPrompt('设置角色头像', '请输入头像图片URL', 'https://...', localData.value.avatar, (url) => {
        if (url) localData.value.avatar = url
    })
}

// User Avatar Handlers
const triggerUserAvatarUpload = () => userFileInput.value.click()
const handleUserAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
        try {
            // Read file as data URL to show in cropper
            const reader = new FileReader()
            reader.onload = (e) => {
                cropperImageSrc.value = e.target.result
                currentAvatarType.value = 'user'
                showUserAvatarCropper.value = true
            }
            reader.readAsDataURL(file)
        } catch (err) {
            console.error('Failed to read file', err)
            showToast('文件读取失败')
        }
    }
}
const promptUserAvatarUrl = () => {
    chatStore.triggerPrompt('设置我的头像', '请输入我的头像图片URL', 'https://...', localData.value.userAvatar, (url) => {
        if (url) localData.value.userAvatar = url
    })
}

// Call Avatar Handlers
const callAvatarInput = ref(null)
const currentCallAvatarTarget = ref('char') // 'char' or 'user'

const triggerCallAvatarUpload = (target) => {
    currentCallAvatarTarget.value = target
    if (callAvatarInput.value) callAvatarInput.value.click()
}

const handleCallAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
        try {
            const compressed = await compressImage(file, 200, 0.6)
            if (currentCallAvatarTarget.value === 'char') {
                localData.value.callAvatarChar = compressed
            } else {
                localData.value.callAvatarUser = compressed
            }
        } catch (err) {
            console.error('Call avatar upload failed', err)
        }
    }
}

const promptCallAvatarUrl = (target) => {
    chatStore.triggerPrompt('设置通话形象 URL', '请输入形象图片 URL', 'https://...', target === 'char' ? localData.value.callAvatarChar : localData.value.callAvatarUser, (url) => {
        if (url) {
            if (target === 'char') localData.value.callAvatarChar = url
            else localData.value.callAvatarUser = url
        }
    })
}

// Avatar Cropper Handlers
const handleCropComplete = async (croppedImage) => {
    // Compress the cropped image for better performance
    try {
        // Convert data URL to blob
        const blob = await (await fetch(croppedImage)).blob()
        // Compress the cropped image
        const compressed = await compressImage(blob, 200, 0.6)

        // Set the avatar based on type
        if (currentAvatarType.value === 'character') {
            localData.value.avatar = compressed
            showAvatarCropper.value = false
        } else {
            localData.value.userAvatar = compressed
            showUserAvatarCropper.value = false
        }

        showToast('头像设置成功')
    } catch (err) {
        console.error('Compression failed', err)
        // Fallback: use the cropped image directly
        if (currentAvatarType.value === 'character') {
            localData.value.avatar = croppedImage
            showAvatarCropper.value = false
        } else {
            localData.value.userAvatar = croppedImage
            showUserAvatarCropper.value = false
        }
        showToast('头像设置成功')
    }
}

const handleCropCancel = () => {
    showAvatarCropper.value = false
    showUserAvatarCropper.value = false
}

const handleShowProfile = () => {
    // Let parent handle closing and navigation
    emit('show-profile', props.chatData.id)
}

function parsePreviewBubbleCss(cssString, role) {
    if (!cssString || typeof cssString !== 'string') {
        // Fallback defaults if empty
        if (role === 'user') return { backgroundColor: '#95ec69', color: 'black', borderRadius: '4px' }
        return { backgroundColor: '#ffffff', color: 'black', borderRadius: '4px' }
    }

    let targetCss = cssString
    if (cssString.includes('|||')) {
        const parts = cssString.split('|||')
        targetCss = role === 'user' ? (parts[1] || '') : parts[0]
    }

    const style = {}
    targetCss.split(';').forEach(rule => {
        const trimmed = rule.trim()
        if (!trimmed) return
        const parts = trimmed.split(':')
        if (parts.length >= 2) {
            const key = parts[0].trim().replace(/-([a-z])/g, g => g[1].toUpperCase())
            const value = parts.slice(1).join(':').trim()
            if (key && value) style[key] = value
        }
    })
    return style
}


// Bubble Presets
const presetBubbles = [
    {
        name: '乌金·沉浸',
        css: `background: radial-gradient(circle at top left, #2a2520 0%, #0e0e10 100%); border: 1px solid rgba(212, 175, 55, 0.2); border-top: 1px solid rgba(212, 175, 55, 0.4); color: #e6dcc0; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6); font-family: 'Noto Serif SC', serif; font-weight: 300; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8); border-radius: 2px 12px 12px 12px; ||| background: radial-gradient(circle at top right, #374151 0%, #1f2937 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-top: 1px solid rgba(255, 255, 255, 0.2); color: #e5e7eb; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4); font-family: 'Noto Serif SC', serif; font-weight: 300; letter-spacing: 0.5px; border-radius: 12px 2px 12px 12px;`
    },
    {
        name: '信笺·对话',
        css: `background: #f7f5f0; border: 1px solid rgba(140, 126, 99, 0.3); color: #2c2c2c; box-shadow: 2px 2px 0 rgba(212, 175, 55, 0.2); font-family: 'KaiTi', 'STKaiti', serif; font-weight: 600; border-radius: 4px; padding: 10px 14px; letter-spacing: 1px; ||| background: #e5e7eb; border: 1px solid rgba(156, 163, 175, 0.3); color: #1f2937; box-shadow: -2px 2px 0 rgba(107, 114, 128, 0.1); font-family: 'KaiTi', 'STKaiti', serif; font-weight: 600; border-radius: 4px; padding: 10px 14px; letter-spacing: 1px;`
    },
    {
        name: '极致·琉璃',
        css: `background: rgba(30, 30, 35, 0.75); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.15); border-left: 2px solid #d4af37; color: #ffffff; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4); font-family: system-ui, -apple-system, 'Microsoft YaHei', sans-serif; font-weight: 400; letter-spacing: 1px; border-radius: 8px; --no-arrow: true; ||| background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); border-right: 2px solid #e5e7eb; color: #ffffff; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); font-family: system-ui, -apple-system, 'Microsoft YaHei', sans-serif; font-weight: 400; letter-spacing: 1px; border-radius: 8px; --no-arrow: true;`
    },
    {
        name: '软萌·甜心',
        css: `background: #fff0f5; color: #8b4789; border: 2px dashed #ffb7c5; border-radius: 20px; box-shadow: 0 4px 12px rgba(255,183,197,0.4); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: #f0f8ff; color: #6868a8; border: 2px dashed #add8e6; border-radius: 20px; box-shadow: 0 4px 12px rgba(173,216,230,0.4); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
    },
    {
        name: '梦幻·睡眠',
        css: `background: linear-gradient(135deg, #e3f2fd 0%, #fff0f5 100%); color: #4a5a7b; border: 2px solid rgba(173, 216, 230, 0.4); border-radius: 18px; box-shadow: 0 3px 10px rgba(100, 149, 237, 0.2); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: linear-gradient(135deg, #fff0f5 0%, #ffe6f0 100%); color: #765681; border: 2px solid rgba(255, 192, 203, 0.4); border-radius: 18px; box-shadow: 0 3px 10px rgba(255, 182, 193, 0.2); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
    },
    {
        name: '星星·小美好',
        css: `background: linear-gradient(135deg, #fffacd 0%, #fff8dc 100%); color: #766045; border: 2px solid rgba(255, 215, 0, 0.3); border-radius: 20px; box-shadow: 0 4px 12px rgba(255, 215, 0, 0.2); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: linear-gradient(135deg, #fff8dc 0%, #ffe4b5 100%); color: #8a6c57; border: 2px solid rgba(255, 222, 173, 0.4); border-radius: 20px; box-shadow: 0 4px 12px rgba(255, 228, 181, 0.25); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
    },
    {
        name: '粉心·甜蜜',
        css: `background: linear-gradient(135deg, #ffe6f0 0%, #fff0f8 100%); color: #a6447d; border: 2px solid rgba(255, 182, 193, 0.5); border-radius: 22px; box-shadow: 0 5px 15px rgba(255, 105, 180, 0.2); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: linear-gradient(135deg, #fff0f8 0%, #ffe6f5 100%); color: #bf5e8e; border: 2px solid rgba(255, 192, 203, 0.5); border-radius: 22px; box-shadow: 0 5px 15px rgba(255, 182, 193, 0.25); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
    },
    {
        name: '云朵·梦境',
        css: `background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%); color: #4d80b3; border: 2px solid rgba(135, 206, 250, 0.4); border-radius: 24px; box-shadow: 0 4px 14px rgba(135, 206, 235, 0.25); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px; ||| background: linear-gradient(135deg, #e6f3ff 0%, #d4ebff 100%); color: #3d70a3; border: 2px solid rgba(173, 216, 230, 0.4); border-radius: 24px; box-shadow: 0 4px 14px rgba(176, 224, 230, 0.3); padding: 12px 16px; font-family: 'YouYuan', 'Round', sans-serif; font-weight: 600; letter-spacing: 1px;`
    },
    {
        name: '赛博·霓虹',
        css: `background: rgba(5, 20, 30, 0.9); border: 1px solid #00f3ff; color: #00f3ff; box-shadow: 0 0 10px rgba(0, 243, 255, 0.3), inset 0 0 5px rgba(0, 243, 255, 0.1); border-radius: 4px; letter-spacing: 1px; font-family: 'Consolas', 'Monaco', monospace; font-weight: bold; ||| background: rgba(30, 5, 20, 0.9); border: 1px solid #ff0055; color: #ff0055; box-shadow: 0 0 10px rgba(255, 0, 85, 0.3), inset 0 0 5px rgba(255, 0, 85, 0.1); border-radius: 4px; letter-spacing: 1px; font-family: 'Consolas', 'Monaco', monospace; font-weight: bold;`
    },
    {
        name: '水墨·丹青',
        css: `background: #fdfbf7; border-left: 4px solid #2b2b2b; color: #333; font-family: 'KaiTi', 'STKaiti', serif; font-weight: 600; letter-spacing: 1px; box-shadow: 2px 2px 8px rgba(0,0,0,0.1); border-radius: 2px; padding: 10px 15px; ||| background: #f2f2f2; border-right: 4px solid #8b0000; color: #333; font-family: 'KaiTi', 'STKaiti', serif; font-weight: 600; letter-spacing: 1px; box-shadow: -2px 2px 8px rgba(0,0,0,0.1); border-radius: 2px; padding: 10px 15px;`
    },
    {
        name: '极简·磨砂',
        css: `background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.6); color: #1f2937; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); font-family: system-ui, -apple-system, sans-serif; font-weight: 500; letter-spacing: 0.5px; ||| background: rgba(59, 130, 246, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 16px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); font-family: system-ui, -apple-system, sans-serif; font-weight: 500; letter-spacing: 0.5px;`
    }
]

const showUrlModal = ref(false)
const urlModalTitle = ref('')
const urlModalInput = ref('')
const urlModalCallback = ref(null)

function onPresetChange(event) {
    const presetName = event.target.value
    if (!presetName) {
        localData.value.bubbleCss = ''
        return
    }
    const preset = presetBubbles.find(p => p.name === presetName)
    if (preset) {
        localData.value.bubbleCss = preset.css
    }
}

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

const showResetConfirm = ref(false)
const showClearConfirm = ref(false)
const clearIncludeMemory = ref(false)
const showDeleteConfirm = ref(false)

const confirmReset = () => {
    chatStore.triggerConfirm('确认重置?', '将重置界面配置、背景等设置。保留角色设定、人设和记忆库。', () => {
        chatStore.resetCharacter(props.chatData.id)
        showToast('角色已重置', 'success')
        emit('close')
    })
}

const confirmClearHistory = () => {
    chatStore.triggerConfirm('确认清除聊天记录?', '删除所有的聊天历史，此操作不可撤销。', () => {
        chatStore.clearHistory(props.chatData.id, { includeMemory: false })
        showToast('记录已清除', 'success')
    })
}

const confirmDelete = () => {
    chatStore.triggerConfirm('确认删除角色?', '将删除所有聊天记录、配置和记忆。此操作不可恢复！', () => {
        chatStore.deleteChat(props.chatData.id)
        showToast('角色已删除', 'success')
        emit('close')
    }, null, '确认删除', '我再想想')
}

// --- Export Logic ---
const showExportModal = ref(false)
const exportIncludeHistory = ref(false)
const exportIncludeMemory = ref(true)

const handleExportCard = () => {
    try {
        const chat = chatStore.chats[props.chatData.id]
        if (!chat) return

        const exportData = {
            version: '1.0',
            type: 'qiaoqiao_character_card',
            timestamp: Date.now(),
            character: {
                // Basic Info
                name: localData.value.name,
                avatar: localData.value.avatar,
                remark: localData.value.remark,
                gender: localData.value.gender,
                wechatId: localData.value.wechatId,
                openingLine: localData.value.openingLine,

                // Persona & Prompt
                prompt: localData.value.prompt,

                // Visuals
                bgUrl: localData.value.bgUrl,
                bgTheme: localData.value.bgTheme,
                bgBlur: localData.value.bgBlur,
                bgOpacity: localData.value.bgOpacity,
                bubbleCss: localData.value.bubbleCss,
                bubbleSize: localData.value.bubbleSize,
                avatarFrame: localData.value.avatarFrame,
                userAvatarFrame: localData.value.userAvatarFrame,

                // Voice (TTS)
                voiceId: localData.value.voiceId,
                doubaoSpeaker: localData.value.doubaoSpeaker,
                voiceSpeed: localData.value.voiceSpeed,
                autoTTS: localData.value.autoTTS,

                // Interaction (Pat, Proactive)
                patAction: localData.value.patAction,
                patSuffix: localData.value.patSuffix,
                activeChat: localData.value.activeChat,
                activeInterval: localData.value.activeInterval,
                proactiveChat: localData.value.proactiveChat,
                proactiveInterval: localData.value.proactiveInterval,

                // Memory & Context Config
                contextLimit: localData.value.contextLimit,
                displayLimit: localData.value.displayLimit,
                summaryLimit: localData.value.summaryLimit,
                autoSummary: localData.value.autoSummary,
                summaryPrompt: localData.value.summaryPrompt,
                momentsMemoryLimit: localData.value.momentsMemoryLimit,

                // World Sync
                locationSync: localData.value.locationSync,
                timeAware: localData.value.timeAware,
                timeSyncMode: localData.value.timeSyncMode,
                virtualTime: localData.value.virtualTime,

                // Bindings
                worldBookLinks: localData.value.worldBookLinks
            },
            user: {
                name: localData.value.userName,
                avatar: localData.value.userAvatar,
                gender: localData.value.userGender,
                persona: localData.value.userPersona
            }
        }

        if (exportIncludeMemory.value && chat.memory) {
            exportData.memory = chat.memory
        }

        if (exportIncludeHistory.value && chat.msgs) {
            exportData.msgs = chat.msgs
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${localData.value.name || 'character'}_card.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        showExportModal.value = false
        showToast('导出成功')
    } catch (e) {
        console.error(e)
        showToast('导出失败')
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

    // Validation / Defaulting
    if (!localData.value.gender) localData.value.gender = '无'
    if (!localData.value.userGender) localData.value.userGender = '无'

    // Check for Remark Change
    const oldRemark = props.chatData.remark
    const newRemark = localData.value.remark

    // Cleanup stale world book links
    if (localData.value.worldBookLinks) {
        const allEntryIds = new Set()
        worldBookStore.books.forEach(book => {
            if (book.entries) {
                book.entries.forEach(e => allEntryIds.add(e.id))
            }
        })
        localData.value.worldBookLinks = localData.value.worldBookLinks.filter(id => allEntryIds.has(id))
    }

    // Virtual time sync logic
    if (localData.value.timeSyncMode === 'manual' && (!localData.value.virtualTimeLastSync || localData.value.virtualTimeLastSync === 0)) {
        localData.value.virtualTimeLastSync = Date.now()
    }

    // Capture final data state
    const finalData = JSON.parse(JSON.stringify(localData.value))

    // CRITICAL: Protect live fields from being overwritten by stale local state
    // These fields are updated in the background (AI analysis, messages, summaries)
    const protectedFields = ['msgs', 'memory', 'summary', 'bio', 'lastSummaryIndex', 'lastSummaryCount', 'isSummarizing', 'unreadCount']
    protectedFields.forEach(field => delete finalData[field])

    console.log('[Settings] Dispatching Update to Store (Sanitized):', finalData)

    // Sync with scheduler store
    schedulerStore.setRandomConfig(props.chatData.id, {
        enabled: localData.value.randomProactive,
        min: localData.value.randomMin,
        max: localData.value.randomMax
    })

    // 1. Update character in centralized store
    const success = chatStore.updateCharacter(props.chatData.id, finalData)

    if (success) {
        // 2. Add system notification if remark changed
        // (SKIP for new chats, or if remark is cleared/empty)
        if (!props.chatData.isNew && newRemark !== undefined && newRemark !== oldRemark && newRemark.trim() !== '') {
            chatStore.addMessage(props.chatData.id, {
                role: 'system',
                content: `${localData.value.userName || '用户'}将你的备注改成了${newRemark}`
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

const handleConfirmManualSummary = async () => {
    const options = {}
    if (manualSummaryRange.value && manualSummaryRange.value.trim()) {
        const parts = manualSummaryRange.value.split(/[-: ]+/)
        if (parts.length === 2) {
            options.startIndex = parseInt(parts[0]) - 1 // 1-based to 0-based
            options.endIndex = parseInt(parts[1])
        }
    }

    showManualSummaryModal.value = false
    try {
        // Must await to catch errors from store
        const result = await chatStore.summarizeHistory(props.chatData.id, options)
        if (!result.success && result.error) {
            showToast('总结失败: ' + result.error)
        }
    } catch (e) {
        console.error(e)
        showToast('执行异常')
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

onMounted(() => {
    if (localData.value.locationSync) {
        weatherService.enableLocationSync().then(() => {
            locationInfo.value = weatherService.getLocationInfo()
        })
    }
})
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

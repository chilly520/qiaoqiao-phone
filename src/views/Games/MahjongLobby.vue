<template>
    <div class="mahjong-lobby w-full h-full flex flex-col bg-emerald-50">
        <!-- 顶部导航 -->
        <div
            class="h-[56px] bg-gradient-to-r from-emerald-600 to-green-600 flex items-center justify-between px-4 shadow-lg">
            <button @click="router.push('/games')" class="w-12 h-12 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
                <span>🀄</span>
                <span>麻将大厅</span>
            </h1>
            <button @click="showSettings = true" class="w-12 h-12 flex items-center justify-center text-white">
                <i class="fa-solid fa-gear text-xl"></i>
            </button>
        </div>

        <!-- 个人信息卡片 -->
        <div class="m-4 p-5 bg-white rounded-2xl shadow-md border border-emerald-100">
            <div class="flex items-center gap-5">
                <!-- 头像显示 -->
                <div class="w-20 h-20 rounded-2xl overflow-hidden shadow-inner border-2 border-emerald-50">
                    <img :src="userAvatar" class="w-full h-full object-cover" />
                </div>

                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-base font-black text-gray-800">{{ userName }}</span>
                        <span class="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-xs rounded-full font-bold">
                            {{ mahjongStore.rank }}
                        </span>
                    </div>
                    <div class="text-xs text-gray-400 mt-2 flex flex-wrap gap-4">
                        <span>积分:{{ mahjongStore.score }}</span>
                        <span>胜率:{{ winRate }}%</span>
                        <span>连胜:{{ mahjongStore.winStreak }}</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-xl font-black text-orange-500">{{ formattedBeans }}</div>
                    <div class="text-xs text-gray-400">欢乐豆</div>
                </div>
            </div>

            <!-- 充值按钮 -->
            <button @click="showRecharge = true"
                class="w-full mt-4 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-white font-bold rounded-lg shadow-md active:scale-95 transition-transform">
                <i class="fa-solid fa-coins mr-2"></i>
                充值欢乐豆
            </button>
        </div>

        <!-- 快速开始 -->
        <div class="px-4 mb-6">
            <button v-if="hasActiveGame" @click="returnToGame"
                class="w-full py-5 mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 animate-pulse">
                <i class="fa-solid fa-rotate-left text-xl"></i>
                <span>回到牌桌</span>
            </button>
            <button @click="quickStart"
                class="w-full py-5 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-lg rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                <i class="fa-solid fa-bolt text-xl"></i>
                <span>快速开始</span>
            </button>
        </div>

        <!-- 功能按钮 -->
        <div class="px-4 grid grid-cols-2 gap-4 mb-6">
            <button @click="showCreateRoom = true"
                class="py-4 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-3">
                <i class="fa-solid fa-plus-circle text-3xl text-blue-500"></i>
                <span class="text-sm font-bold text-gray-700">创建房间</span>
            </button>

            <button @click="showRanking = true"
                class="py-4 bg-white rounded-xl shadow-md active:scale-95 transition-transform flex flex-col items-center gap-3">
                <i class="fa-solid fa-trophy text-3xl text-yellow-500"></i>
                <span class="text-sm font-bold text-gray-700">排行榜</span>
            </button>
        </div>

        <!-- 游戏规则说明 -->
        <div class="px-4 mb-6">
            <div class="bg-white rounded-xl shadow-md p-5">
                <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-plus text-emerald-500"></i>
                    <span>游戏规则</span>
                </h3>
                <ul class="text-sm text-gray-600 space-y-2">
                    <li>• 大众麻将，支持吃、碰、杠、胡</li>
                    <li>• 每局底注100欢乐豆</li>
                    <li>• 胡牌根据番数获得奖励</li>
                    <li>• 积分影响段位，段位越高奖励越多</li>
                </ul>
            </div>
        </div>

        <!-- 充值弹窗 -->
        <Transition name="fade">
            <div v-if="showRecharge" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                @click="showRecharge = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full relative" @click.stop>
                    <h2 class="text-xl font-bold mb-4 text-center">充值欢乐豆</h2>

                    <!-- 成功提示 Toast -->
                    <Transition name="fade">
                        <div v-if="toastMsg"
                            class="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 text-white text-sm rounded-full z-[60] whitespace-nowrap">
                            {{ toastMsg }}
                        </div>
                    </Transition>

                    <div class="space-y-3 mb-6">
                        <button v-for="pkg in rechargePackages" :key="pkg.amount" @click="recharge(pkg)"
                            class="w-full p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl active:scale-95 transition-transform">
                            <div class="flex items-center justify-between">
                                <div class="text-left">
                                    <div class="text-2xl font-bold text-orange-600">{{ pkg.amount }}</div>
                                    <div class="text-xs text-gray-500">欢乐豆</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xl font-bold text-red-600">¥{{ pkg.price }}</div>
                                    <div v-if="pkg.bonus" class="text-xs text-green-600">送{{ pkg.bonus }}豆</div>
                                </div>
                            </div>
                        </button>
                    </div>

                    <button @click="showRecharge = false"
                        class="w-full py-3 bg-gray-200 text-gray-700 font-bold rounded-lg">
                        取消
                    </button>
                </div>
            </div>
        </Transition>

        <!-- 创建房间弹窗 -->
        <Transition name="fade">
            <div v-if="showCreateRoom" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                @click="showCreateRoom = false">
                <div class="bg-white rounded-2xl p-6 m-4 max-w-sm w-full" @click.stop>
                    <h2 class="text-xl font-bold mb-4 text-center">创建房间</h2>

                    <div class="space-y-6 mb-6">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">底注</label>
                            <div class="grid grid-cols-3 gap-2">
                                <button v-for="stake in [100, 500, 1000]" :key="stake"
                                    @click="roomConfig.baseStake = stake"
                                    class="py-3 rounded-lg border-2 transition-all"
                                    :class="roomConfig.baseStake === stake ? 'border-red-500 bg-red-50 text-red-600 font-bold' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ stake }}欢乐豆
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-3">局数</label>
                            <div class="grid grid-cols-3 gap-2">
                                <button v-for="round in [4, 8, 16]" :key="round" @click="roomConfig.totalRounds = round"
                                    class="py-3 rounded-lg border-2 transition-all"
                                    :class="roomConfig.totalRounds === round ? 'border-blue-500 bg-blue-50 text-blue-600 font-bold' : 'border-gray-200 bg-gray-50 text-gray-700'">
                                    {{ round }}局
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-3">
                        <button @click="showCreateRoom = false"
                            class="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg">
                            取消
                        </button>
                        <button @click="createRoom"
                            class="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-lg">
                            创建
                        </button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 排行榜弹窗 -->
        <Transition name="fade">
            <div v-if="showRanking"
                class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
                @click="showRanking = false">
                <div class="bg-white rounded-[32px] w-full max-w-[450px] m-4 flex flex-col max-h-[85vh] shadow-2xl overflow-hidden"
                    @click.stop>
                    <!-- 头部 -->
                    <div class="p-6 bg-gradient-to-br from-yellow-400 to-orange-500 text-white relative">
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <h2 class="text-3xl font-black italic tracking-wider">TOP榜单</h2>
                                <p class="text-sm opacity-80 font-bold uppercase">Mahjong Legend</p>
                            </div>
                            <button @click="shareLeaderboard"
                                class="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center active:scale-90 transition-all">
                                <i class="fa-solid fa-share-nodes text-xl"></i>
                            </button>
                        </div>

                        <!-- 前三名特殊展示 -->
                        <div class="flex justify-around items-end pt-4 pb-2">
                            <!-- 第二名 -->
                            <div v-if="mahjongStore.leaderboard[1]" class="flex flex-col items-center">
                                <div class="relative mb-2">
                                    <img :src="mahjongStore.leaderboard[1].avatar"
                                        class="w-14 h-14 rounded-full border-4 border-gray-300 shadow-lg object-cover bg-gray-100" />
                                    <div
                                        class="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-black text-gray-700 shadow-sm">
                                        2</div>
                                </div>
                                <span class="text-xs font-bold truncate w-20 text-center">{{
                                    mahjongStore.leaderboard[1].name }}</span>
                                <span class="text-[10px] font-black text-white/90">{{ mahjongStore.leaderboard[1].score
                                }}分</span>
                            </div>
                            <!-- 第一名 -->
                            <div v-if="mahjongStore.leaderboard[0]"
                                class="flex flex-col items-center transform scale-125 -translate-y-4">
                                <div class="relative mb-2">
                                    <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl animate-bounce">👑
                                    </div>
                                    <img :src="mahjongStore.leaderboard[0].avatar"
                                        class="w-16 h-16 rounded-full border-4 border-yellow-200 shadow-2xl object-cover bg-gray-100" />
                                    <div
                                        class="absolute -bottom-1 -right-1 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center text-sm font-black text-white shadow-md border-2 border-white">
                                        1</div>
                                </div>
                                <span class="text-xs font-bold truncate w-24 text-center">{{
                                    mahjongStore.leaderboard[0].name }}</span>
                                <span class="text-[10px] font-black text-white">{{ mahjongStore.leaderboard[0].score
                                }}分</span>
                            </div>
                            <!-- 第三名 -->
                            <div v-if="mahjongStore.leaderboard[2]" class="flex flex-col items-center">
                                <div class="relative mb-2">
                                    <img :src="mahjongStore.leaderboard[2].avatar"
                                        class="w-12 h-12 rounded-full border-4 border-amber-600 shadow-lg object-cover bg-gray-100" />
                                    <div
                                        class="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm">
                                        3</div>
                                </div>
                                <span class="text-xs font-bold truncate w-16 text-center">{{
                                    mahjongStore.leaderboard[2].name }}</span>
                                <span class="text-[10px] font-black text-white/80">{{ mahjongStore.leaderboard[2].score
                                }}分</span>
                            </div>
                        </div>
                    </div>

                    <!-- 列表 -->
                    <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                        <div v-for="(item, idx) in mahjongStore.leaderboard" :key="item.name"
                            class="flex items-center gap-4 p-3 rounded-2xl border transition-all"
                            :class="item.isUser ? 'bg-orange-50 border-orange-200' : 'bg-white border-transparent shadow-sm'">
                            <div class="w-6 text-center font-black"
                                :class="idx < 3 ? 'text-orange-500' : 'text-gray-400'">
                                {{ idx + 1 }}</div>
                            <img :src="item.avatar"
                                class="w-10 h-10 rounded-xl object-cover border border-gray-100 shadow-inner" />
                            <div class="flex-1">
                                <div class="font-bold text-gray-800 flex items-center gap-1.5">
                                    {{ item.name }}
                                    <span v-if="item.isUser"
                                        class="text-[8px] bg-orange-500 text-white px-1 rounded">ME</span>
                                </div>
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{{ item.rank
                                    ||
                                    '青铜' }}段位</div>
                            </div>
                            <div class="text-right">
                                <div class="text-lg font-black text-gray-800 leading-none">{{ item.score }}</div>
                                <div class="text-[9px] text-gray-400 font-bold">POINTS</div>
                            </div>
                        </div>
                    </div>

                    <div class="p-4 bg-white border-t border-gray-100 flex gap-2">
                        <button @click="showRanking = false"
                            class="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl active:scale-95 transition-all">收起列表</button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 设置弹窗 -->
        <Transition name="fade">
            <div v-if="showSettings"
                class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
                @click="showSettings = false">
                <div class="bg-white rounded-[32px] w-full max-w-[450px] m-4 flex flex-col max-h-[85vh] shadow-2xl overflow-hidden"
                    @click.stop>
                    <div class="p-6 border-b border-gray-100 bg-emerald-50 relative">
                        <h2 class="text-xl font-black text-emerald-800 flex items-center gap-2">
                            <i class="fa-solid fa-palette"></i> 个性化配置
                        </h2>
                        <button @click="showSettings = false"
                            class="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-emerald-800/50 hover:text-emerald-800"><i
                                class="fa-solid fa-xmark text-xl"></i></button>
                    </div>

                    <div class="flex-1 overflow-y-auto p-6 space-y-8">
                        <div>
                            <div class="flex justify-between items-center mb-4">
                                <label class="text-base font-black text-gray-700">自定义桌布</label>
                                <span class="text-xs text-emerald-600 font-bold">可上传图片或输入 URL</span>
                            </div>
                            <div class="flex gap-3 items-center">
                                <div @click="triggerUpload('tablecloth')"
                                    class="w-16 h-16 bg-gray-100 rounded-2xl flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 relative group overflow-hidden">
                                    <img v-if="mahjongStore.tablecloth" :src="mahjongStore.tablecloth"
                                        class="w-full h-full object-cover" />
                                    <template v-else>
                                        <i class="fa-solid fa-image text-xl mb-1"></i>
                                        <span class="text-[9px] font-bold">点击上传</span>
                                    </template>
                                </div>
                                <div class="flex-1 flex flex-col gap-2">
                                    <input v-model="mahjongStore.tablecloth" placeholder="在此输入图片 URL..."
                                        class="w-full px-3 py-2 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm outline-none"
                                        @change="mahjongStore.saveData" />
                                    <button @click="mahjongStore.tablecloth = ''; mahjongStore.saveData()"
                                        class="text-[10px] text-left text-gray-400 font-bold">重置默认</button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between items-center mb-4">
                                <label class="text-base font-black text-gray-700">自定义牌背</label>
                                <span class="text-xs text-blue-600 font-bold">勾选多个可实现随机切换</span>
                            </div>
                            <div class="grid grid-cols-4 gap-3">
                                <div v-for="b in mahjongStore.tileBacks" :key="b.id"
                                    class="relative group cursor-pointer" @click="toggleTileBackActive(b)">
                                    <div class="w-full aspect-[3/4] rounded-lg border-2 shadow-sm transition-all overflow-hidden"
                                        :class="b.active ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-100'"
                                        :style="b.type === 'color' ? { background: b.value } : {}">
                                        <img v-if="b.type === 'image'" :src="b.value"
                                            class="w-full h-full object-cover" />
                                    </div>
                                    <i v-if="b.active"
                                        class="fa-solid fa-circle-check absolute -top-1 -right-1 text-emerald-500 text-sm bg-white rounded-full"></i>
                                    <button @click.stop="removeTileBack(b)" v-if="b.id !== 'default'"
                                        class="absolute -top-1 -left-1 w-4 h-4 bg-red-400 text-white rounded-full text-[8px] flex items-center justify-center"><i
                                            class="fa-solid fa-xmark"></i></button>
                                </div>
                                <div @click="showAddTileBackMenu = true"
                                    class="w-full aspect-[3/4] bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300 hover:text-emerald-500 transition-all">
                                    <i class="fa-solid fa-plus text-lg"></i>
                                </div>
                            </div>
                            <div v-if="showAddTileBackMenu"
                                class="mt-4 p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 space-y-4">
                                <div class="flex gap-2">
                                    <button @click="newTileBackType = 'color'"
                                        class="flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all"
                                        :class="newTileBackType === 'color' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-500'">颜色</button>
                                    <button @click="newTileBackType = 'image'"
                                        class="flex-1 py-1 px-3 rounded-lg text-xs font-bold transition-all"
                                        :class="newTileBackType === 'image' ? 'bg-emerald-500 text-white' : 'bg-white text-gray-500'">图片</button>
                                </div>
                                <div v-if="newTileBackType === 'color'" class="flex items-center gap-3">
                                    <input type="color" v-model="newTileBackColor"
                                        class="w-12 h-10 border-0 p-0 bg-transparent cursor-pointer" />
                                    <input v-model="newTileBackName" placeholder="预设名称..."
                                        class="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm" />
                                </div>
                                <div v-else class="flex flex-col gap-3">
                                    <div @click="triggerUpload('tileback')"
                                        class="w-full h-24 bg-white rounded-xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-400 overflow-hidden">
                                        <img v-if="newTileBackImage" :src="newTileBackImage"
                                            class="w-full h-full object-cover" />
                                        <span v-else class="text-[10px] font-bold">上传牌背图片</span>
                                    </div>
                                    <input v-model="newTileBackName" placeholder="预设名称..."
                                        class="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm" />
                                </div>
                                <div class="flex gap-2">
                                    <button @click="showAddTileBackMenu = false"
                                        class="flex-1 py-2 bg-gray-200 text-gray-500 text-xs font-bold rounded-xl">取消</button>
                                    <button @click="saveNewTileBack"
                                        class="flex-1 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl">确认添加</button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between items-center mb-4">
                                <label class="text-base font-black text-gray-700">默认桌布</label>
                                <span class="text-xs text-blue-600 font-bold">点击选择桌布样式</span>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div @click="mahjongStore.tablecloth = ''; mahjongStore.saveData()"
                                    class="relative group cursor-pointer">
                                    <div class="w-full aspect-[4/3] rounded-lg border-2 shadow-sm transition-all overflow-hidden"
                                        :class="!mahjongStore.tablecloth ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-100'">
                                        <div class="w-full h-full bg-[#064e3b] flex items-center justify-center">
                                            <div class="w-full h-full opacity-50"
                                                style="background-image: radial-gradient(circle at center, #065f46 0%, #064e3b 100%);">
                                            </div>
                                            <span class="absolute text-white font-bold text-[10px] drop-shadow-md">经典绿
                                                (CSS)</span>
                                        </div>
                                    </div>
                                    <i v-if="!mahjongStore.tablecloth"
                                        class="fa-solid fa-circle-check absolute -top-1 -right-1 text-emerald-500 text-sm bg-white rounded-full"></i>
                                </div>

                                <div @click="mahjongStore.tablecloth = 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/10/698b323fe1435.webp'; mahjongStore.saveData()"
                                    class="relative group cursor-pointer">
                                    <div class="w-full aspect-[4/3] rounded-lg border-2 shadow-sm transition-all overflow-hidden"
                                        :class="mahjongStore.tablecloth === 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/10/698b323fe1435.webp' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-100'">
                                        <img src="https://youke.xn--y7xa690gmna.cn/s1/2026/02/10/698b323fe1435.webp"
                                            class="w-full h-full object-cover" />
                                    </div>
                                    <i v-if="mahjongStore.tablecloth === 'https://youke.xn--y7xa690gmna.cn/s1/2026/02/10/698b323fe1435.webp'"
                                        class="fa-solid fa-circle-check absolute -top-1 -right-1 text-emerald-500 text-sm bg-white rounded-full"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="p-6 bg-gray-50 flex gap-2">
                        <button @click="showSettings = false"
                            class="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl active:scale-95 transition-all">保存返回</button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 通用文件上传 -->
        <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileChange" />

        <!-- 聊天选择器 (用于分享榜单) -->
        <Transition name="fade">
            <div v-if="showContactPicker"
                class="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
                @click="showContactPicker = false">
                <div class="w-full max-w-[500px] bg-gray-100 rounded-t-[32px] flex flex-col max-h-[70vh] animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.3)]"
                    @click.stop>
                    <div
                        class="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-[32px]">
                        <h3 class="font-bold text-gray-800">发送榜单给...</h3>
                        <button @click="showContactPicker = false" class="text-gray-400 p-2"><i
                                class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                        <div v-for="contact in contactListForSharing" :key="contact.id"
                            @click="handleShareLeaderboardToContact(contact.id)"
                            class="flex items-center gap-4 bg-white p-3 rounded-2xl hover:bg-blue-50 active:scale-98 transition-all cursor-pointer border border-gray-100 shadow-sm">
                            <img :src="contact.avatar"
                                class="w-12 h-12 rounded-xl object-cover border border-gray-100 shadow-inner" />
                            <div class="flex-1">
                                <div class="font-bold text-gray-800">{{ contact.name }}</div>
                            </div>
                            <i class="fa-solid fa-paper-plane text-blue-400"></i>
                        </div>
                    </div>
                    <div class="p-5 pb-safe-area bg-white border-t border-gray-100">
                        <button @click="showContactPicker = false"
                            class="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">取消</button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMahjongStore } from '../../stores/mahjongStore.js'
import { useWalletStore } from '../../stores/walletStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { useChatStore } from '../../stores/chatStore.js'
import mahjongEngine from '../../utils/mahjong/MahjongEngine.js'



const router = useRouter()
const mahjongStore = useMahjongStore()
const walletStore = useWalletStore()
const settingsStore = useSettingsStore()

// 用户信息
const userName = computed(() => settingsStore.personalization.userProfile.name || '我')
const userAvatar = computed(() => settingsStore.personalization.userProfile.avatar || '🎭')

// 判断是否为图片头像
const isImageAvatar = (avatar) => {
    if (!avatar) return false
    return avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http')
}
const formattedBeans = computed(() => mahjongStore.beans.toLocaleString())
const winRate = computed(() => mahjongStore.winRate)
const hasActiveGame = computed(() => mahjongStore.currentRoom && mahjongStore.currentRoom.status === 'playing')

onMounted(() => {
    // Check for active game and redirect
    if (mahjongStore.currentRoom && mahjongStore.currentRoom.status === 'playing') {
        router.replace('/games/mahjong')
    }
})

const getPlayer = (position) => {
    return mahjongStore.currentRoom?.players?.find(p => p.position === position)
}
// 段位与设置
const showRecharge = ref(false)
const showCreateRoom = ref(false)
const showRanking = ref(false)
const showSettings = ref(false)
const toastMsg = ref('')

// 个性化临时状态
const fileInput = ref(null)
const uploadTarget = ref('')
const showAddTileBackMenu = ref(false)
const newTileBackType = ref('color')
const newTileBackColor = ref('#10b981')
const newTileBackImage = ref('')
const newTileBackName = ref('')
const showContactPicker = ref(false)

const contactListForSharing = computed(() => {
    const chatStore = useChatStore()
    return chatStore.contactList || []
})

// 分享榜单逻辑
const shareLeaderboard = () => {
    showContactPicker.value = true
}

const handleShareLeaderboardToContact = async (chatId) => {
    const chatStore = useChatStore()

    const user = mahjongStore.leaderboard.find(i => i.isUser) || { score: 0, rank: '青铜' }
    const survivors = mahjongStore.leaderboard.slice(0, 5)

    const htmlContent = `
<div style="background: linear-gradient(135deg, #f59e0b, #ea580c); border-radius: 20px; padding: 16px; color: white; font-family: system-ui; box-shadow: 0 10px 20px rgba(234, 88, 12, 0.3);">
    <div style="font-weight: 900; font-size: 18px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 8px;">🀄️ 雀神榜单 · 傲视群雄</div>
    <div style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 12px; margin-bottom: 12px;">
        <div style="font-size: 12px; opacity: 0.8;">我的战绩</div>
        <div style="font-size: 24px; font-weight: 900; display: flex; align-items: center; gap: 8px;">
            ${user.score} <span style="font-size: 14px; opacity: 0.9;">pts</span> 
            <span style="font-size: 10px; padding: 2px 6px; background: white; color: #ea580c; border-radius: 4px; margin-left: 10px;">${user.rank}</span>
        </div>
    </div>
    <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px;">当前 Top 5:</div>
    ${survivors.map((s, idx) => `
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; background: rgba(0,0,0,0.05); padding: 4px 8px; border-radius: 6px;">
            <span>${idx + 1}. ${s.name}${s.isUser ? ' (我)' : ''}</span>
            <span style="font-weight: 900;">${s.score}</span>
        </div>
    `).join('')}
    <div style="margin-top: 10px; font-size: 9px; opacity: 0.6; text-align: center;">快来牌桌跟我一决高下吧！</div>
</div>
`.trim()

    await chatStore.addMessage(chatId, {
        role: 'user',
        content: `[CARD]${htmlContent}[/CARD]`,
        timestamp: Date.now()
    })

    showToast('榜单已成功分享')
    showContactPicker.value = false
    showRanking.value = false
}

// 文件上传
const triggerUpload = (target) => {
    uploadTarget.value = target
    fileInput.value.click()
}

const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // 性能优化：检查文件大小
    if (file.size > 500 * 1024) {
        showToast('图片超过 500KB，Base64 编码会导致游戏卡顿，建议手动压缩图片或使用 URL 引用')
    }

    const reader = new FileReader()
    reader.onload = (event) => {
        const base64 = event.target.result
        if (uploadTarget.value === 'tablecloth') {
            mahjongStore.tablecloth = base64
            mahjongStore.saveData()
        } else if (uploadTarget.value === 'tileback') {
            newTileBackImage.value = base64
        }
    }
    reader.readAsDataURL(file)
}

const testTableclothURL = () => {
    if (!mahjongStore.tablecloth) return showToast('请输入 URL')
    showToast('链接已保存')
    mahjongStore.saveData()
}

// 牌背管理
const toggleTileBackActive = (b) => {
    b.active = !b.active
    mahjongStore.saveData()
}

const removeTileBack = (b) => {
    const idx = mahjongStore.tileBacks.findIndex(item => item.id === b.id)
    if (idx !== -1) {
        mahjongStore.tileBacks.splice(idx, 1)
        mahjongStore.saveData()
    }
}

const saveNewTileBack = () => {
    if (!newTileBackName.value) return showToast('请输入预设名称')

    const newPreset = {
        id: 'cb_' + Date.now(),
        type: newTileBackType.value,
        value: newTileBackType.value === 'color' ? newTileBackColor.value : newTileBackImage.value,
        name: newTileBackName.value,
        active: true
    }

    if (newPreset.type === 'image' && !newPreset.value) return showToast('请先上传图片')

    mahjongStore.tileBacks.push(newPreset)
    mahjongStore.saveData()

    // 重置
    showAddTileBackMenu.value = false
    newTileBackImage.value = ''
    newTileBackName.value = ''
    showToast('预设添加成功')
}


const showToast = (msg) => {
    toastMsg.value = msg
    setTimeout(() => {
        toastMsg.value = ''
    }, 2000)
}

const roomConfig = ref({
    baseStake: 100,
    totalRounds: 8
})

const rechargePackages = [
    { amount: 6000, price: 6, bonus: 0 },
    { amount: 30000, price: 30, bonus: 3000 },
    { amount: 68000, price: 68, bonus: 10000 },
    { amount: 128000, price: 128, bonus: 20000 }
]

// 快速开始
const quickStart = async () => {
    // 检查欢乐豆
    if (mahjongStore.beans < 100) {
        showToast('欢乐豆不足，请先充值！')
        showRecharge.value = true
        return
    }

    // 创建房间
    await mahjongStore.createRoom({ mode: 'quick', baseStake: 100, totalRounds: 8 })

    // 跳转到房间等待页面
    router.push('/games/mahjong-room')
}

const returnToGame = () => {
    router.push('/games/mahjong')
}

// 创建房间
const createRoom = async () => {
    // 检查欢乐豆
    if (mahjongStore.beans < roomConfig.value.baseStake) {
        showToast('欢乐豆不足，请先充值！')
        showCreateRoom.value = false
        showRecharge.value = true
        return
    }

    // 创建房间
    await mahjongStore.createRoom({
        mode: 'custom',
        baseStake: roomConfig.value.baseStake,
        totalRounds: roomConfig.value.totalRounds
    })

    // 关闭弹窗
    showCreateRoom.value = false

    // 跳转到房间等待页面
    router.push('/games/mahjong-room')
}

// 充值
const recharge = (pkg) => {
    const amount = pkg.amount
    const price = pkg.price

    // 调用钱包扣款 (decreaseBalance 会处理亲属卡/零钱/银行卡优先级)
    const success = walletStore.decreaseBalance(price, `麻将欢乐豆充值(${amount}豆)`)

    if (!success) {
        showToast('支付失败，请检查余额')
        return
    }

    const result = mahjongStore.rechargeBeans(amount + (pkg.bonus || 0))

    if (result.success) {
        showToast('充值成功！')
        setTimeout(() => {
            showRecharge.value = false
        }, 1000)
    } else {
        showToast(result.message)
    }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* 响应式设计 - 适配1224*2548屏幕 */
@media (max-width: 1224px) {

    /* 顶部导航栏 */
    .mahjong-lobby>div:first-child {
        height: 48px;
    }

    .mahjong-lobby>div:first-child h1 {
        font-size: 18px;
    }

    /* 个人信息卡片 */
    .mahjong-lobby>div:nth-child(2) {
        margin: 12px;
        padding: 16px;
    }

    .mahjong-lobby>div:nth-child(2)>div>div:first-child {
        width: 72px;
        height: 72px;
    }

    .mahjong-lobby>div:nth-child(2)>div>div:nth-child(2)>div:first-child>span:first-child {
        font-size: 16px;
    }

    .mahjong-lobby>div:nth-child(2)>div>div:nth-child(2)>div:nth-child(2) {
        font-size: 12px;
        gap: 12px;
    }

    .mahjong-lobby>div:nth-child(2)>div>div:nth-child(3)>div:first-child {
        font-size: 20px;
    }

    /* 快速开始按钮 */
    .mahjong-lobby>div:nth-child(3) {
        margin-bottom: 16px;
    }

    .mahjong-lobby>div:nth-child(3) button {
        padding: 12px;
        font-size: 16px;
    }

    /* 功能按钮 */
    .mahjong-lobby>div:nth-child(4) {
        margin-bottom: 16px;
        gap: 12px;
    }

    .mahjong-lobby>div:nth-child(4) button {
        padding: 12px;
    }

    .mahjong-lobby>div:nth-child(4) button i {
        font-size: 24px;
    }

    .mahjong-lobby>div:nth-child(4) button span {
        font-size: 12px;
    }

    /* 游戏规则说明 */
    .mahjong-lobby>div:nth-child(5) {
        margin-bottom: 16px;
    }

    .mahjong-lobby>div:nth-child(5)>div {
        padding: 16px;
    }

    .mahjong-lobby>div:nth-child(5)>div h3 {
        font-size: 16px;
    }

    .mahjong-lobby>div:nth-child(5)>div ul {
        font-size: 12px;
    }
}

/* 针对高度的适配 */
@media (max-height: 2548px) {
    .mahjong-lobby {
        overflow-y: auto;
    }

    /* 确保内容不会溢出 */
    .mahjong-lobby>div {
        max-width: 100%;
    }
}

/* 小屏幕适配 */
@media (max-width: 768px) {

    /* 个人信息卡片布局调整 */
    .mahjong-lobby>div:nth-child(2)>div {
        flex-wrap: wrap;
        gap: 12px;
    }

    .mahjong-lobby>div:nth-child(2)>div>div:first-child {
        margin: 0 auto;
    }

    .mahjong-lobby>div:nth-child(2)>div>div:nth-child(2) {
        width: 100%;
        text-align: center;
    }

    .mahjong-lobby>div:nth-child(2)>div>div:nth-child(3) {
        width: 100%;
        text-align: center;
    }
}
</style>

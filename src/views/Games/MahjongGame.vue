<template>
    <div @click="unlockAudio" class="mahjong-game w-full h-full flex flex-col bg-table-felt overflow-hidden relative"
        :style="tileBackStyles">
        <div class="table-border absolute inset-0 pointer-events-none"></div>
        <!-- 顶部信息栏 -->
        <div class="h-[50px] bg-black/30 flex items-center justify-between px-4">
            <button @click="handleExit" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>

            <div class="flex items-center gap-4 text-white text-sm">
                <span>局数: {{ mahjongStore.currentRoom?.currentRound }}/{{ mahjongStore.currentRoom?.totalRounds
                }}</span>
                <span>底注: {{ mahjongStore.currentRoom?.baseStake }}</span>
                <span>牌堆: {{ mahjongStore.gameState?.deck?.length || 0 }}</span>
            </div>

            <div class="flex items-center gap-1">
                <button @click="showChatPanel = !showChatPanel"
                    class="h-8 px-3 rounded-full bg-blue-500/80 text-white text-xs flex items-center gap-1 hover:bg-blue-600 transition-colors mr-1 relative">
                    <i class="fa-solid fa-message"></i> 聊天
                    <div v-if="hasNewMsg"
                        class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"></div>
                </button>
                <button @click="showCardCounter = !showCardCounter"
                    class="h-8 px-3 rounded-full bg-white/10 text-white text-xs flex items-center gap-1 hover:bg-white/20 transition-colors mr-1">
                    <i class="fa-solid fa-calculator"></i> 记牌器
                </button>
                <button @click="showSettings = true" class="w-10 h-10 flex items-center justify-center text-white">
                    <i class="fa-solid fa-gear text-xl"></i>
                </button>
                <button @click="mahjongStore.toggleCheat()"
                    class="w-10 h-10 flex items-center justify-center text-white" @touchstart="handleLongPress"
                    @touchend="cancelLongPress">
                    <i class="fa-solid fa-ellipsis-vertical text-xl"></i>
                </button>
            </div>
        </div>

        <!-- 游戏区域 -->
        <div class="flex-1 flex flex-col p-2 px-4 md:px-6">
            <!-- 对家（上） -->
            <div class="flex flex-col items-center mb-2">
                <div class="flex items-center gap-2 mb-1">
                    <!-- 北位头像 -->
                    <div class="relative transition-all duration-300"
                        :class="{ 'active-breathing': mahjongStore.gameState?.currentPlayer === 2 }">
                        <div v-if="isImageAvatar(getPlayer('north')?.avatar)"
                            class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                            <img :src="getPlayer('north')?.avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-xl">
                            {{ getPlayer('north')?.avatar || '👤' }}
                        </div>
                        <div v-if="mahjongStore.gameState?.dealer === 2" class="dealer-icon">庄</div>
                    </div>
                    <div class="text-white text-xs">
                        <div class="font-bold">{{ getPlayer('north')?.name }}</div>
                        <div class="opacity-80">{{ getPlayer('north')?.beans }}豆</div>
                    </div>
                    <!-- 北家气泡 (向上弹，防止挡牌堆) -->
                    <Transition name="fade">
                        <div v-if="mahjongStore.activeReplies[2]"
                            class="absolute -top-12 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap">
                            <div
                                class="bg-white text-black px-2 py-1 rounded-lg rounded-bl-none shadow-xl border-2 border-green-500 text-[10px] max-w-[90px] break-words">
                                {{ mahjongStore.activeReplies[2] }}
                            </div>
                        </div>
                    </Transition>
                </div>

                <!-- 手牌（背面或结算亮出） -->
                <div class="flex gap-0.5">
                    <div v-for="tile in getPlayer('north')?.hand" :key="'north-' + tile"
                        :class="mahjongStore.gameState?.roundResult ? ['mahjong-tile-up', getTileColorClass(tile)] : 'mahjong-tile-back'">
                        {{ mahjongStore.gameState?.roundResult ? getTileEmoji(tile) : '' }}
                    </div>
                </div>

                <!-- 已吃碰杠（倒下明牌） - 增加间距防止重合 -->
                <div class="mt-4 flex gap-1.5" v-if="getPlayer('north')?.exposed?.length">
                    <div v-for="(group, idx) in getPlayer('north').exposed" :key="idx"
                        class="flex bg-black/30 p-1 rounded border border-white/5 shadow-inner">
                        <div v-for="(tile, tIdx) in group.tiles" :key="tIdx"
                            class="mahjong-tile-small !w-[24px] !h-[34px] !text-[18px] flex items-center justify-center bg-white shadow-[0_2px_0_#ccc]"
                            :class="getTileColorClass(tile)">
                            {{ getTileEmoji(tile) }}
                        </div>
                    </div>
                </div>

            </div>

            <!-- 中间区域 -->
            <div class="flex-1 flex items-center gap-2">
                <!-- 左家 -->
                <div class="flex flex-col items-center w-16 text-xs">
                    <!-- 西位头像 -->
                    <div class="relative mb-1 transition-all duration-300"
                        :class="{ 'active-breathing': mahjongStore.gameState?.currentPlayer === 3 }">
                        <div v-if="isImageAvatar(getPlayer('west')?.avatar)"
                            class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                            <img :src="getPlayer('west')?.avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-lg">
                            {{ getPlayer('west')?.avatar || '🎭' }}
                        </div>
                        <div v-if="mahjongStore.gameState?.dealer === 3" class="dealer-icon">庄</div>
                    </div>

                    <div class="text-white text-[9px] text-center mb-1 scale-90 origin-top">
                        <div class="font-bold w-16 break-words leading-tight truncate">{{ getPlayer('west')?.name }}
                        </div>
                        <div class="opacity-80">{{ getPlayer('west')?.beans }}豆</div>
                    </div>
                    <!-- 西家气泡 (向上弹) -->
                    <Transition name="fade">
                        <div v-if="mahjongStore.activeReplies[3]" class="absolute -top-10 left-0 z-50">
                            <div
                                class="bg-white text-black px-2 py-1 rounded-lg rounded-bl-none shadow-xl border-2 border-green-500 text-[10px] max-w-[90px] break-words">
                                {{ mahjongStore.activeReplies[3] }}
                            </div>
                        </div>
                    </Transition>
                    <div class="flex flex-col gap-1 mb-2">
                        <!-- 已吃碰杠（竖向显示） -->
                        <div v-for="(group, idx) in getPlayer('west')?.exposed" :key="idx"
                            class="flex flex-col gap-0.5 bg-black/20 p-0.5 rounded-sm">
                            <div v-for="(tile, tIdx) in group.tiles" :key="tIdx"
                                class="mahjong-tile-small !w-[22px] !h-[18px] !text-[12px] flex items-center justify-center bg-gray-200 rotate-90 my-[-3px] mx-auto">
                                {{ getTileEmoji(tile) }}
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col" :class="mahjongStore.gameState?.roundResult ? '-space-y-5' : 'gap-1'">
                        <div v-for="tile in getPlayer('west')?.hand" :key="'west-' + tile"
                            :class="mahjongStore.gameState?.roundResult ? ['mahjong-tile-up-side', getTileColorClass(tile)] : 'mahjong-tile-vertical'">
                            {{ mahjongStore.gameState?.roundResult ? getTileEmoji(tile) : '' }}
                        </div>
                    </div>
                </div>


                <!-- 牌池 -->
                <div class="flex-1 flex flex-col items-center justify-center">
                    <div v-if="!mahjongStore.gameState" class="text-white text-center">
                        <div class="text-6xl mb-4">🀄</div>
                        <div class="text-xl font-bold">准备中...</div>
                    </div>
                    <div v-else-if="mahjongStore.currentRoom?.status === 'settling'" class="text-white text-center">
                        <div class="text-5xl mb-3">🎉</div>
                        <div class="text-2xl font-bold mb-2">{{ mahjongStore.currentRoom.lastResult?.winnerName }} 胡了！
                        </div>
                        <div class="text-lg">{{ mahjongStore.currentRoom.lastResult?.fan }}番</div>
                        <div class="text-xl font-bold text-yellow-300 mt-2">+{{
                            mahjongStore.currentRoom.lastResult?.reward }}豆</div>
                    </div>
                    <div v-else class="flex flex-col items-center">
                        <div class="mb-3 flex gap-1">
                            <div v-for="i in Math.min(18, deckCount)" :key="i" class="deck-tile">
                            </div>
                        </div>
                        <div class="text-white text-xs mb-2">剩余 {{ deckCount }} 张</div>

                        <!-- 牌池（打出的牌） - 增加 Tray 背景 -->
                        <div
                            class="bg-black/20 p-3 rounded-xl border border-white/5 shadow-inner min-w-[160px] min-h-[100px] flex flex-wrap gap-1.5 justify-center relative">
                            <!-- 放大显示刚打出的牌 -->
                            <Transition name="zoom">
                                <div v-if="activeTile"
                                    class="absolute z-40 bg-white border-2 border-orange-500 rounded-lg shadow-2xl flex items-center justify-center text-6xl w-24 h-32 -top-20 active-tile-zoom"
                                    :class="getTileColorClass(activeTile)">
                                    {{ getTileEmoji(activeTile) }}
                                </div>
                            </Transition>

                            <div v-for="(tile, i) in mahjongStore.gameState?.pool" :key="i" class="mahjong-tile-pool"
                                :class="getTileColorClass(tile)">
                                {{ getTileEmoji(tile) }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右家 -->
                <div class="flex flex-col items-center w-16 text-xs">
                    <!-- 东位头像 -->
                    <div class="relative mb-1 transition-all duration-300"
                        :class="{ 'active-breathing': mahjongStore.gameState?.currentPlayer === 1 }">
                        <div v-if="isImageAvatar(getPlayer('east')?.avatar)"
                            class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                            <img :src="getPlayer('east')?.avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-lg">
                            {{ getPlayer('east')?.avatar || '🎭' }}
                        </div>
                        <div v-if="mahjongStore.gameState?.dealer === 1" class="dealer-icon">庄</div>
                    </div>


                    <div class="text-white text-[9px] text-center mb-1 scale-90 origin-top">
                        <div class="font-bold w-16 break-words leading-tight truncate">{{ getPlayer('east')?.name }}
                        </div>
                        <div class="opacity-80">{{ getPlayer('east')?.beans }}豆</div>
                    </div>
                    <!-- 东家气泡 (向上弹) -->
                    <Transition name="fade">
                        <div v-if="mahjongStore.activeReplies[1]" class="absolute -top-10 right-0 z-50">
                            <div
                                class="bg-white text-black px-2 py-1 rounded-lg rounded-br-none shadow-xl border-2 border-green-500 text-[10px] max-w-[90px] break-words">
                                {{ mahjongStore.activeReplies[1] }}
                            </div>
                        </div>
                    </Transition>
                    <div class="flex flex-col gap-1 mb-2">
                        <!-- 已吃碰杠（竖向显示） -->
                        <div v-for="(group, idx) in getPlayer('east')?.exposed" :key="idx"
                            class="flex flex-col gap-0.5 bg-black/20 p-0.5 rounded-sm">
                            <div v-for="(tile, tIdx) in group.tiles" :key="tIdx"
                                class="mahjong-tile-small !w-[22px] !h-[18px] !text-[12px] flex items-center justify-center bg-gray-200 -rotate-90 my-[-3px] mx-auto">
                                {{ getTileEmoji(tile) }}
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col" :class="mahjongStore.gameState?.roundResult ? '-space-y-5' : 'gap-1'">
                        <div v-for="tile in getPlayer('east')?.hand" :key="'east-' + tile"
                            :class="mahjongStore.gameState?.roundResult ? ['mahjong-tile-up-side', getTileColorClass(tile)] : 'mahjong-tile-vertical'">
                            {{ mahjongStore.gameState?.roundResult ? getTileEmoji(tile) : '' }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 我（下） -->
            <div class="flex flex-col items-center transition-all duration-500"
                :class="mahjongStore.gameState?.roundResult ? 'mt-0' : 'mt-2'">
                <!-- 玩家信息栏 -->
                <div class="flex items-center gap-2 transition-all duration-300"
                    :class="mahjongStore.gameState?.roundResult ? 'mb-0.5' : 'mb-2'">
                    <div class="relative transition-all duration-300"
                        :class="{ 'active-breathing': mahjongStore.gameState?.currentPlayer === 0 }">
                        <div v-if="isImageAvatar(getPlayer('south')?.avatar)"
                            class="w-14 h-14 rounded-full overflow-hidden shadow-lg border-2 border-white/20">
                            <img :src="getPlayer('south')?.avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else
                            class="w-14 h-14 rounded-full bg-gray-300 flex items-center justify-center text-2xl shadow-lg border-2 border-white/20">
                            {{ getPlayer('south')?.avatar || 'ME' }}
                        </div>
                        <div v-if="mahjongStore.gameState?.dealer === 0" class="dealer-icon"
                            style="width: 24px; height: 24px; font-size: 12px; top: -5px; right: -5px;">庄</div>
                    </div>
                    <div class="text-white text-xs">

                        <div class="font-bold">{{ getPlayer('south')?.name }}</div>
                        <div class="opacity-80">{{ getPlayer('south')?.beans }}豆 | 积分: {{ mahjongStore.score }}</div>
                    </div>
                    <!-- 玩家气泡 -->
                    <Transition name="fade">
                        <div v-if="mahjongStore.activeReplies[0]"
                            class="absolute -top-10 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap">
                            <div
                                class="bg-blue-500 text-white px-2 py-1 rounded-lg rounded-bl-none shadow-xl border-2 border-white text-[10px] max-w-[100px] break-words">
                                {{ mahjongStore.activeReplies[0] }}
                            </div>
                        </div>
                    </Transition>
                </div>


                <div class="flex items-center gap-3 z-20 transition-all duration-300"
                    :class="mahjongStore.gameState?.roundResult ? 'mb-1 min-h-[0px] h-0' : 'mb-3 min-h-[50px]'">
                    <div v-if="canAction"
                        class="bg-black/50 backdrop-blur-lg px-4 py-2 rounded-full flex gap-3 border border-white/20 shadow-2xl">
                        <div v-if="canChi" @click="handleChiClick" class="action-circle chi">吃</div>
                        <div v-if="canPeng" @click="performAction('peng')" class="action-circle peng">碰</div>
                        <div v-if="canGang" @click="performAction('gang')" class="action-circle gang">杠</div>
                        <div v-if="canHu" @click="performAction('hu')" class="action-circle hu animate-hu-glow">胡</div>
                        <div v-if="!isMyTurn && (canChi || canPeng || canGang || canHu)" @click="performAction('pass')"
                            class="action-circle pass">过</div>
                    </div>

                    <!-- 吃牌选择器 -->
                    <Transition name="fade">
                        <div v-if="showChiOptions"
                            class="absolute -top-16 bg-black/80 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-2xl flex gap-3 z-50">
                            <div v-for="(comb, idx) in chiOptions" :key="idx" @click="confirmChi(comb)"
                                class="flex bg-white/10 p-1.5 rounded-lg hover:bg-white/20 transition-all cursor-pointer border border-white/10 group">
                                <div v-for="t in comb" :key="t"
                                    class="mahjong-tile-small !w-[24px] !h-[36px] !text-[16px] group-active:scale-95 transition-transform">
                                    {{ getTileEmoji(t) }}
                                </div>
                            </div>
                            <div @click="showChiOptions = false"
                                class="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center text-white cursor-pointer hover:bg-red-500">
                                <i class="fa-solid fa-xmark"></i>
                            </div>
                        </div>
                    </Transition>

                    <button v-if="selectedTile !== null && isMyTurn" @click="playSelectedTile" class="play-btn">
                        <span class="relative z-10 flex items-center gap-2">
                            出牌 <i class="fa-solid fa-arrow-up"></i>
                        </span>
                    </button>

                    <!-- 当前回合提示 -->
                    <div v-if="isMyTurn && selectedTile === null" class="animate-bounce">
                        <div
                            class="bg-yellow-400 text-black px-4 py-2 rounded-full text-sm font-black shadow-lg border-2 border-white">
                            轮到你了！
                        </div>
                    </div>
                </div>

                <!-- 吃碰杠显示区域 (移到手牌上方) -->
                <div class="flex gap-1 mb-2 px-2 h-[44px]" v-if="getPlayer('south')?.exposed?.length">
                    <div v-for="(group, idx) in getPlayer('south').exposed" :key="idx"
                        class="flex bg-black/20 p-1 rounded-sm shadow-sm scale-90 origin-left">
                        <div v-for="(tile, tIdx) in group.tiles" :key="tIdx"
                            class="mahjong-tile-small relative !w-[26px] !h-[40px] !text-[18px] flex items-center justify-center bg-gray-200 border border-gray-300 rounded shadow-sm">
                            {{ getTileEmoji(tile) }}
                        </div>
                    </div>
                </div>

                <!-- 手牌展示区域 (底部留间距) -->
                <div class="flex items-end gap-2 px-2 relative transition-all duration-300"
                    :class="mahjongStore.gameState?.roundResult ? 'mb-10' : 'mb-4'">
                    <!-- 听牌参考浮窗 -->
                    <Transition name="fade">
                        <div v-if="showTingHelp && tingTiles.length > 0"
                            class="absolute -top-16 left-0 right-0 z-30 flex justify-center pointer-events-none">
                            <div
                                class="bg-black/80 backdrop-blur-md p-2 rounded-lg border border-white/20 shadow-2xl flex gap-1 pointer-events-auto">
                                <span class="text-white text-xs mr-1 opacity-70">胡：</span>
                                <div v-for="tile in tingTiles" :key="tile" class="flex flex-col items-center">
                                    <div class="mahjong-tile-small bg-white !w-[22px] !h-[30px] !text-[16px]">
                                        {{ getTileEmoji(tile) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Transition>

                    <!-- 手牌（立着显示或结算摊开） -->
                    <div class="flex items-end gap-0.5 relative w-full"
                        :class="{ 'justify-center': mahjongStore.gameState?.roundResult }"
                        :style="{ height: mahjongStore.gameState?.roundResult ? '40px' : '64px' }">
                        <!-- 排序好的主手牌 -->
                        <div v-for="item in displayedHand.main" :key="'main-' + item.i"
                            @click="!mahjongStore.gameState?.roundResult && selectTile(item.i)" :class="[
                                mahjongStore.gameState?.roundResult ? 'mahjong-tile-up' : 'mahjong-tile',
                                { 'selected': selectedTile === item.i, 'disabled': !isMyTurn || mahjongStore.gameState?.roundResult },
                                getTileColorClass(item.t),
                                'transition-all duration-200'
                            ]">
                            {{ getTileEmoji(item.t) }}
                        </div>

                        <!-- 摸到的新牌 (单独靠右) -->
                        <div v-if="displayedHand.drawn"
                            @click="!mahjongStore.gameState?.roundResult && selectTile(displayedHand.drawn.i)" :class="[
                                mahjongStore.gameState?.roundResult ? 'mahjong-tile-up' : 'mahjong-tile',
                                { 'selected': selectedTile === displayedHand.drawn.i, 'disabled': !isMyTurn || mahjongStore.gameState?.roundResult },
                                getTileColorClass(displayedHand.drawn.t),
                                'ml-3 transition-all duration-200 animate-slide-in'
                            ]">
                            {{ getTileEmoji(displayedHand.drawn.t) }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 作弊/记牌器... -->
        <Transition name="slide-up">
            <div v-if="showCardCounter" class="absolute bottom-20 left-4 right-4 z-40">
                <!-- ...略... -->
            </div>
        </Transition>

        <!-- 悬浮聊天按钮 (新) -->
        <button @click="showChatPanel = !showChatPanel"
            class="fixed right-4 bottom-36 w-12 h-12 rounded-full bg-blue-500/90 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform z-30 border-2 border-white/20 hover:bg-blue-600 backdrop-blur-sm">
            <i class="fa-solid fa-message text-xl"></i>
            <div v-if="hasNewMsg"
                class="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse">
            </div>
        </button>

        <!-- 局内聊天记录面板 -->
        <Transition name="slide-right">
            <div v-if="showChatPanel" @click="showChatPanel = false"
                class="fixed inset-0 bg-black/20 z-[60] flex justify-end">
                <div @click.stop
                    class="w-56 h-full bg-table-felt-dark shadow-2xl flex flex-col border-l border-white/10 p-3">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="text-white text-xs font-bold flex items-center gap-1">
                            <i class="fa-solid fa-comments"></i> 局内对话
                        </h3>
                        <button @click="showChatPanel = false" class="text-white/60">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="flex-1 overflow-y-auto space-y-2 mb-3 pr-1 scrollbar-none" id="chat-history">
                        <div v-for="(msg, i) in mahjongStore.gameChatMessages" :key="i"
                            :class="msg.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'">
                            <div class="text-[9px] text-white/40 mb-0.5">{{ msg.sender }}</div>
                            <div :class="msg.role === 'user' ? 'bg-blue-500 text-white rounded-l-md rounded-tr-md' : 'bg-white text-black rounded-r-md rounded-tl-md'"
                                class="px-2 py-1.5 text-[10px] shadow-sm max-w-[95%] break-words">
                                {{ msg.content }}
                            </div>
                        </div>
                        <div v-if="isAiReplying" class="flex gap-1 items-center text-white/40 text-[9px] animate-pulse">
                            <i class="fa-solid fa-ellipsis"></i>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex gap-1">
                            <input v-model="chatInput" @keyup.enter="handleSendChat" placeholder="给TA们发消息..."
                                class="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white text-[10px] outline-none focus:border-white/30" />
                        </div>
                        <button @click="handleSendChat"
                            class="w-full bg-blue-500 text-white py-1.5 rounded text-[10px] font-bold active:scale-95 transition-transform">
                            发送
                        </button>
                        <div class="flex gap-1 justify-between px-1">
                            <span @click="chatInput = '快点出牌啊'"
                                class="text-[9px] text-white/50 cursor-pointer hover:text-white bg-white/10 px-1 rounded">快点</span>
                            <span @click="chatInput = '这也太巧了吧'"
                                class="text-[9px] text-white/50 cursor-pointer hover:text-white bg-white/10 px-1 rounded">太巧了</span>
                            <span @click="chatInput = '能不能让我一张'"
                                class="text-[9px] text-white/50 cursor-pointer hover:text-white bg-white/10 px-1 rounded">求牌</span>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>


        <!-- 记牌器组件 -->
        <Transition name="fade">
            <div v-if="showCardCounter" class="card-counter-panel scrollbar-hide">
                <div class="text-[10px] text-white/50 text-center mb-1">剩余牌数</div>
                <div v-for="tile in ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'east', 'south', 'west', 'north', 'red', 'green', 'white']"
                    :key="tile" class="counter-item">
                    <span class="counter-tile" :class="getTileColorClass(tile)">{{ getTileEmoji(tile) }}</span>
                    <span class="counter-num">{{ 4 - (playedCardsMap[tile] || 0) }}</span>
                </div>
            </div>
        </Transition>

        <!-- 结算界面 -->
        <Transition name="fade">
            <div v-if="mahjongStore.gameState?.roundResult"
                class="fixed inset-0 z-[100] flex items-center justify-center px-4 transition-all duration-500"
                :class="showScoreCard ? 'bg-black/60 backdrop-blur-sm' : 'pointer-events-none'"
                @click="showScoreCard = !showScoreCard">
                <!-- 结果卡片 -->
                <Transition name="zoom">
                    <div v-if="showScoreCard"
                        class="bg-gradient-to-br from-amber-50 to-orange-100 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-400"
                        :class="{ '!border-gray-400 !from-gray-100 !to-gray-200': mahjongStore.gameState.roundResult.type === '流局' }"
                        @click.stop>
                        <!-- 背景装饰 -->
                        <div class="relative p-6 text-center transition-all bg-gradient-to-r"
                            :class="mahjongStore.gameState.roundResult.type === '流局' ? 'from-gray-600 to-gray-700' : 'from-red-600 to-orange-600'">
                            <div class="text-6xl mb-2 animate-bounce">
                                {{ mahjongStore.gameState.roundResult.type === '流局' ? '💨' : '🎉' }}
                            </div>
                            <h2 class="text-3xl font-bold text-white mb-1">
                                {{ mahjongStore.gameState.roundResult.winner.name }}
                            </h2>
                            <div class="text-5xl font-black drop-shadow-lg"
                                :class="mahjongStore.gameState.roundResult.type === '流局' ? 'text-gray-200' : 'text-yellow-300'">
                                {{ mahjongStore.gameState.roundResult.type === '流局' ? '流局了' : '胡了！' }}
                            </div>
                            <div v-if="mahjongStore.gameState.roundResult.type !== '流局'"
                                class="mt-2 inline-block px-3 py-1 bg-white/20 rounded-full text-white text-xs backdrop-blur-sm">
                                {{ mahjongStore.gameState.roundResult.isZiMo ? '自摸' : '点炮' }}
                            </div>
                        </div>

                        <div class="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                            <!-- 胡牌牌面显示 -->
                            <div class="bg-white/90 rounded-xl p-4 shadow-inner">
                                <div class="text-xs text-gray-500 mb-2 flex items-center justify-between">
                                    <div class="flex items-center gap-1">
                                        <span class="w-1 h-3 bg-red-500 rounded-full"></span> 赢家牌面
                                    </div>
                                    <span v-if="mahjongStore.gameState.roundResult.winningTile"
                                        class="text-red-500 font-bold">胡奖张：{{
                                            getTileEmoji(mahjongStore.gameState.roundResult.winningTile) }}</span>
                                </div>
                                <div class="flex flex-wrap gap-y-2 items-end">
                                    <!-- 已露出的牌 (吃碰杠) -->
                                    <div v-for="(group, idx) in mahjongStore.gameState.roundResult.winnerExposed"
                                        :key="'exp-' + idx"
                                        class="flex gap-0.5 bg-black/5 p-1 rounded-md mr-1 scale-90 origin-bottom border border-black/5">
                                        <div v-for="(t, ti) in group.tiles" :key="'ti-' + ti"
                                            class="mahjong-tile-small !w-[20px] !h-[30px] !text-[14px] flex items-center justify-center bg-gray-100">
                                            {{ getTileEmoji(t) }}
                                        </div>
                                    </div>
                                    <!-- 剩余手牌 -->
                                    <div class="flex gap-0.5">
                                        <div v-for="(t, i) in mahjongStore.gameState.roundResult.winnerHand"
                                            :key="'hand-' + i"
                                            class="mahjong-tile-small !w-[22px] !h-[32px] !text-[16px] flex items-center justify-center bg-white shadow-sm border border-gray-200">
                                            {{ getTileEmoji(t) }}
                                        </div>
                                    </div>
                                    <!-- 胡的那张牌 -->
                                    <div v-if="mahjongStore.gameState.roundResult.winningTile"
                                        class="mahjong-tile-small !w-[26px] !h-[36px] !text-[18px] bg-yellow-50 border-2 border-yellow-400 ml-2 shadow-[0_0_10px_rgba(251,191,36,0.6)] flex items-center justify-center animate-pulse">
                                        {{ getTileEmoji(mahjongStore.gameState.roundResult.winningTile) }}
                                    </div>
                                </div>
                            </div>
                            <!-- 番数信息 -->
                            <div class="bg-white/80 rounded-xl p-4 text-center">
                                <div class="text-sm text-gray-600 mb-1">番数</div>
                                <div class="text-3xl font-bold text-red-600">
                                    {{ mahjongStore.gameState.roundResult.fan }}番
                                </div>
                                <div class="text-xs text-gray-500 mt-1">
                                    {{ mahjongStore.gameState.roundResult.type }}
                                </div>
                            </div>

                            <div class="space-y-2">
                                <div v-for="change in mahjongStore.gameState.roundResult.changes" :key="change.name"
                                    class="flex justify-between items-center bg-white/60 rounded-lg px-4 py-2"
                                    :class="{ 'ring-2 ring-red-400 ring-inset bg-red-50/50': change.isPao }">
                                    <div class="flex flex-col">
                                        <span class="font-medium flex items-center gap-1">
                                            {{ change.name }}
                                            <span class="text-[10px] px-1 bg-gray-200 rounded text-gray-500">{{
                                                getPlayerRelation(change.idx) }}</span>
                                        </span>
                                        <span v-if="change.isPao"
                                            class="text-[10px] text-red-500 font-bold">点炮给赢家</span>
                                    </div>
                                    <span class="font-bold text-lg"
                                        :class="change.amount > 0 ? 'text-green-600' : 'text-red-600'">
                                        {{ change.amount > 0 ? '+' : '' }}{{ change.amount }}<span
                                            class="text-xs ml-0.5">豆</span>
                                    </span>
                                </div>
                            </div>

                            <!-- 按钮区域 -->
                            <button @click="handleRoundEnd"
                                class="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform">
                                下一局
                            </button>
                        </div>
                    </div>
                </Transition>

                <!-- 隐藏卡片后的中心按钮 -->
                <div v-if="!showScoreCard" class="flex flex-col items-center gap-4 animate-fadeIn">
                    <div
                        class="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full text-white font-bold border border-white/20 shadow-2xl">
                        {{ mahjongStore.gameState.roundResult.winner.name }} [{{ mahjongStore.gameState.roundResult.type
                        }}]
                    </div>
                    <button @click.stop="handleRoundEnd"
                        class="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-10 py-4 rounded-full font-black text-2xl shadow-[0_0_30px_rgba(16,185,129,0.5)] border-4 border-white active:scale-90 transition-all hover:scale-105">
                        <i class="fa-solid fa-play mr-2"></i>再来一局
                    </button>
                    <div class="text-white bg-black/40 px-3 py-1 rounded-lg text-sm animate-pulse">点击空白处返回结算单</div>
                </div>
            </div>
        </Transition>

        <!-- 动作特效文字 -->
        <Transition name="action-pop">
            <div v-if="actionText"
                class="fixed inset-0 z-[150] flex flex-col items-center justify-center pointer-events-none">
                <!-- 背景光效 -->
                <div class="absolute inset-0 bg-white/10 backdrop-blur-[2px] opacity-0 animate-fadeInOut"></div>
                <div class="action-glow absolute w-96 h-96 rounded-full blur-[80px]" :class="'bg-' + actionType"></div>

                <div class="relative flex flex-col items-center">
                    <div class="text-8xl mb-4 transform -rotate-12 translate-y-8 animate-actionIcon"
                        v-if="actionType === 'hu'">🏆</div>
                    <div class="text-6xl mb-4 animate-actionIcon" v-else-if="actionType === 'gang'">⚡</div>
                    <div class="text-6xl mb-4 animate-actionIcon" v-else-if="actionType === 'peng'">💥</div>
                    <div class="text-6xl mb-4 animate-actionIcon" v-else-if="actionType === 'chi'">🥢</div>

                    <div class="action-text-main" :class="'action-' + actionType">
                        {{ actionText }}
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 开局动画 -->
        <Transition name="fade">
            <div v-if="showGameStart" class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
                <!-- 摇骰子阶段 -->
                <div v-if="gameStartPhase === 'dice'" class="text-center">
                    <div class="text-white text-2xl font-bold mb-6">{{ dealerName }} 是庄家</div>
                    <div class="flex gap-8 justify-center mb-8">
                        <div class="dice-box animate-bounce" :class="{ 'rolling': rolling }">
                            <div class="dice-face">{{ dice1Emoji }}</div>
                        </div>
                        <div class="dice-box animate-bounce" :class="{ 'rolling': rolling }"
                            style="animation-delay: 0.1s">
                            <div class="dice-face">{{ dice2Emoji }}</div>
                        </div>
                    </div>

                    <!-- 已摇出结果 -->
                    <div v-if="diceResult > 0">
                        <div class="text-white text-3xl font-bold mb-2">{{ diceResult }} 点</div>
                        <div class="text-white text-xl">从 {{ dealPosition }} 开始发牌</div>
                    </div>

                    <!-- 等待摇骰子 -->
                    <div v-else>
                        <button v-if="isUserDealer" @click="rollDice"
                            class="px-8 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xl font-bold rounded-xl shadow-xl active:scale-95 transition-transform">
                            点击摇骰子
                        </button>
                        <div v-else class="text-white text-xl">{{ dealerName }} 正在摇骰子...</div>
                    </div>
                </div>

                <!-- 牌堆/发牌阶段 -->
                <div v-else-if="gameStartPhase === 'deck'" class="text-center">
                    <div class="text-white text-xl font-bold mb-6">牌堆准备中...</div>
                    <div class="grid grid-cols-10 gap-1 mb-4 max-w-[200px] mx-auto">
                        <div v-for="i in 40" :key="i"
                            class="w-4 h-6 bg-gradient-to-b from-green-400 to-green-600 border border-green-700 rounded-sm animate-pulse"
                            :style="{ animationDelay: `${i * 20}ms` }">
                        </div>
                    </div>
                    <div class="text-white text-lg">136张牌 已就绪</div>
                </div>
                <div v-else-if="gameStartPhase === 'deal'" class="text-center">
                    <div class="text-white text-2xl font-bold mb-6">发牌中...</div>
                    <div class="text-6xl mb-4 animate-bounce">🀄</div>
                    <div class="text-white text-xl">{{ dealingProgress }}/52</div>
                    <div class="w-64 h-2 bg-gray-700 rounded-full mt-4 overflow-hidden mx-auto">
                        <div class="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-300"
                            :style="{ width: `${(dealingProgress / 52) * 100}%` }">
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 作弊模式遮罩 -->
        <Transition name="fade">
            <div v-if="mahjongStore.cheatMode" class="fixed inset-0 bg-black/80 z-50 overflow-y-auto"
                @click="mahjongStore.toggleCheat()">
                <div class="p-4">
                    <h2 class="text-white text-xl font-bold mb-4 text-center">👀 作弊模式</h2>
                    <div v-for="player in otherPlayers" :key="player.id" class="mb-4">
                        <div class="text-white text-sm font-bold mb-2">{{ player.name }} 的手牌：</div>
                        <div class="flex flex-wrap gap-1">
                            <div v-for="(tile, i) in player.hand" :key="i" class="mahjong-tile-small bg-white">{{
                                getTileEmoji(tile) }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 设置弹出层 -->
        <Transition name="fade">
            <div v-if="showSettings"
                class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center px-6"
                @click.self="showSettings = false">
                <div
                    class="bg-gradient-to-br from-gray-800 to-gray-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-white text-xl font-bold">游戏设置</h3>
                            <button @click="showSettings = false" class="text-gray-400 hover:text-white">
                                <i class="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>
                        <div class="space-y-6">
                            <div class="flex justify-between items-center">
                                <div class="text-white">
                                    <div class="font-bold">开启语音</div>
                                    <div class="text-xs text-gray-400">报牌、动作语音提示</div>
                                </div>
                                <button @click="mahjongStore.toggleSound()"
                                    class="w-14 h-8 rounded-full transition-colors relative"
                                    :class="mahjongStore.soundEnabled ? 'bg-green-500' : 'bg-gray-700'">
                                    <div class="absolute top-1 w-6 h-6 bg-white rounded-full transition-all"
                                        :class="mahjongStore.soundEnabled ? 'left-7' : 'left-1'"></div>
                                </button>
                            </div>
                            <div class="flex justify-between items-center">
                                <div class="text-white">
                                    <div class="font-bold">背景音乐</div>
                                    <div class="text-xs text-gray-400">开启游戏背景BGM</div>
                                </div>
                                <button @click="mahjongStore.toggleBgm()"
                                    class="w-14 h-8 rounded-full transition-colors relative"
                                    :class="mahjongStore.bgmEnabled ? 'bg-green-500' : 'bg-gray-700'">
                                    <div class="absolute top-1 w-6 h-6 bg-white rounded-full transition-all"
                                        :class="mahjongStore.bgmEnabled ? 'left-7' : 'left-1'"></div>
                                </button>
                            </div>

                            <!-- 音量调节 -->
                            <div class="space-y-4 pt-2 border-t border-white/5">
                                <div class="space-y-2">
                                    <div class="flex justify-between text-xs text-gray-400">
                                        <span>语音/音效音量</span>
                                        <span>{{ Math.round(mahjongStore.sfxVolume * 100) }}%</span>
                                    </div>
                                    <input type="range" v-model.number="mahjongStore.sfxVolume" min="0" max="1"
                                        step="0.1"
                                        class="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500">
                                </div>
                                <div class="space-y-2">
                                    <div class="flex justify-between text-xs text-gray-400">
                                        <span>背景音乐音量</span>
                                        <span>{{ Math.round(mahjongStore.bgmVolume * 100) }}%</span>
                                    </div>
                                    <input type="range" v-model.number="mahjongStore.bgmVolume" min="0" max="1"
                                        step="0.1"
                                        class="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                        @input="updateBgmVolume">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 背景音乐 (换成本地拟真 BGM) -->
        <audio v-if="mahjongStore.bgmEnabled" id="bgm-audio" autoplay loop hidden src="/sounds/mahjong/打麻将全局背景音乐.MP3"
            :volume="mahjongStore.bgmVolume"></audio>
    </div>
</template>


<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMahjongStore } from '../../stores/mahjongStore.js'
import mahjongEngine from '../../utils/mahjong/MahjongEngine.js'

const actionType = ref('') // 动作类型
const actionText = ref('') // 动作文字内容
const showScoreCard = ref(false) // 初始设为 false，胡牌后延迟开启
const showCardCounter = ref(false) // 是否显示记牌器
const tileBackStyles = ref({}) // 动态背景色样式

// 颜色池
const TILE_BACK_COLORS = [
    { p: '#10b981', s: '#059669', sh: '#047857' }, // 绿
    { p: '#3b82f6', s: '#2563eb', sh: '#1e40af' }, // 蓝
    { p: '#f59e0b', s: '#d97706', sh: '#b45309' }, // 金
    { p: '#a855f7', s: '#9333ea', sh: '#7e22ce' }, // 紫
    { p: '#ea580c', s: '#c2410c', sh: '#9a3412' }  // 橙
]

const randomTileBackColor = () => {
    const color = TILE_BACK_COLORS[Math.floor(Math.random() * TILE_BACK_COLORS.length)]
    tileBackStyles.value = {
        '--tile-back-primary': color.p,
        '--tile-back-secondary': color.s,
        '--tile-back-shadow': color.sh
    }
}

// 辅助计算：当前桌面/手中已出现的牌（用于记牌器）
const playedCardsMap = computed(() => {
    const counts = {}
    if (!mahjongStore.gameState) return counts

    // 牌池
    mahjongStore.gameState.pool.forEach(t => counts[t] = (counts[t] || 0) + 1)

    // 各家明牌
    mahjongStore.currentRoom.players.forEach(p => {
        p.exposed.forEach(group => {
            group.tiles.forEach(t => counts[t] = (counts[t] || 0) + 1)
        })
    })

    // 我的手牌
    const myHand = mahjongStore.currentRoom.players[0].hand
    myHand.forEach(t => counts[t] = (counts[t] || 0) + 1)

    return counts
})

// 检查是否有任何操作可以执行
const canAction = computed(() => canChi.value || canPeng.value || canGang.value || canHu.value)

const updateBgmVolume = () => {
    const bgm = document.getElementById('bgm-audio')
    if (bgm) bgm.volume = mahjongStore.bgmVolume
}

const unlockAudio = () => {
    // 强制激活声音上下文
    const utterance = new SpeechSynthesisUtterance('开始咯')
    utterance.volume = 0
    window.speechSynthesis.speak(utterance)

    // 强制播放 BGM 并设置音量
    const bgm = document.getElementById('bgm-audio')
    if (bgm) {
        bgm.muted = false
        bgm.volume = mahjongStore.bgmVolume
        bgm.play().catch(e => console.error('BGM play error:', e))
    }
}


const router = useRouter()

const onNavbarBack = () => {
    handleExit()
}

const handleExit = () => {
    mahjongStore.exitRoom()
    router.push('/games/mahjong-lobby')
}

const mahjongStore = useMahjongStore()
const selectedTile = ref(null)
const canChi = ref(false)
const canPeng = ref(false)
const canGang = ref(false)
const canHu = ref(false)

// 开局动画状态
const showGameStart = ref(false)
const gameStartPhase = ref('dice') // 'dice' | 'deck' | 'deal'
const dealerName = ref('')
const dealingProgress = ref(0)
const diceResult = ref(0)
const dealPosition = ref('')
const isUserDealer = ref(false)
const rolling = ref(false) // 摇骰子动画状态
const dice1Emoji = ref('🎲')
const dice2Emoji = ref('🎲')
const activeTile = ref(null) // 当前打出的放大预览牌
const activeTilePosition = ref('south') // 谁打的
const showSettings = ref(false) // 是否显示设置
const showTingHelp = ref(false) // 是否显示听牌帮助
const showChiOptions = ref(false) // 是否显示吃牌选择
const chiOptions = ref([]) // 可选的吃牌组合
const showChatPanel = ref(false) // 是否显示聊天面板
const chatInput = ref('') // 聊天输入
const isAiReplying = ref(false) // 是否正在回复
const hasNewMsg = ref(false) // 是否有新消息提醒

const tileNames = {
    'w1': '一万', 'w2': '二万', 'w3': '三万', 'w4': '四万', 'w5': '五万', 'w6': '六万', 'w7': '七万', 'w8': '八万', 'w9': '九万',
    't1': '一条', 't2': '二条', 't3': '三条', 't4': '四条', 't5': '五条', 't6': '六条', 't7': '七条', 't8': '八条', 't9': '九条',
    'b1': '一筒', 'b2': '二筒', 'b3': '三筒', 'b4': '四筒', 'b5': '五筒', 'b6': '六筒', 'b7': '七筒', 'b8': '八筒', 'b9': '九筒',
    'east': '东风', 'south': '南风', 'west': '西风', 'north': '北风',
    'red': '红中', 'green': '发财', 'white': '白板'
}

const playSfx = (name) => {
    if (!mahjongStore.soundEnabled) return
    // 使用用户提供的本地拟真音效
    const soundFiles = {
        'dice': '/sounds/mahjong/掷骰子.MP3',
        'shuffle': '/sounds/mahjong/所有吃、碰、杠背景音效.MP3',
        'deal': '/sounds/mahjong/发牌.MP3',
        'play': '/sounds/mahjong/出牌.MP3',
        'select': '/sounds/mahjong/点击选择牌未出牌.MP3',
        'draw': '/sounds/mahjong/我方起牌.MP3',
        'action_bg': '/sounds/mahjong/所有吃、碰、杠背景音效.MP3'
    }

    const audioUrl = soundFiles[name]
    if (audioUrl) {
        const audio = new Audio(audioUrl)
        audio.volume = mahjongStore.sfxVolume
        audio.play().catch((e) => { console.warn('SFX Error:', name, e) })
    }
}

const speak = (type, playerIndex = null) => {
    if (!mahjongStore.soundEnabled) return

    // 只要是鸣牌（吃碰杠），无论谁操作都播放环境音效
    if (['chi', 'peng', 'gang'].includes(type)) {
        playSfx('action_bg')
    }

    // 优先使用本地拟真语音包 (针对我方动作)
    if (playerIndex === 0 || playerIndex === null) {
        const voiceMap = {
            'chi': '/sounds/mahjong/我方吃牌语音great.MP3',
            'peng': '/sounds/mahjong/我方碰牌语音good.MP3',
            'gang': '/sounds/mahjong/我方杠牌语音unbelievable.MP3',
            'hu': '/sounds/mahjong/我方胡牌庆祝bgm.MP3'
        }
        if (voiceMap[type]) {
            // 如果是胡牌，播放背景音时可能需要特殊处理，这里先播放语音
            const audio = new Audio(voiceMap[type])
            audio.volume = mahjongStore.sfxVolume
            audio.play().catch(() => { })
            if (type !== 'hu') return // 胡牌除了语音还要播背景，其他动作播完退出
        }
    } else if (type === 'hu') {
        // AI 胡牌，播放失败音效
        const audio = new Audio('/sounds/mahjong/非己方胡牌失败音效.MP3')
        audio.volume = mahjongStore.sfxVolume
        audio.play().catch(() => { })
    }

    // 报牌依然使用 TTS (移除模拟方言)
    const isFemale = playerIndex === null ? true : (playerIndex % 2 === 0)
    const text = tileNames[type] || (type === 'chi' ? '吃' : type === 'peng' ? '碰' : type === 'gang' ? '杠' : (type === 'hu' ? '胡' : '过'))

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.pitch = isFemale ? 1.2 : 0.9
    utterance.rate = 1.1
    utterance.volume = mahjongStore.sfxVolume // 应用音效音量

    // 清除队列立即播放最新的
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
}

let longPressTimer = null

// 获取玩家
const getPlayer = (position) => {
    if (!mahjongStore.currentRoom) return null
    const mapping = {
        'south': 0, // 我（下）
        'east': 1, // 东方（右）
        'north': 2, // 北方（上）
        'west': 3 // 西方（左）
    }

    return mahjongStore.currentRoom.players[mapping[position]]
}

// 其他玩家
const otherPlayers = computed(() => {
    return mahjongStore.currentRoom?.players?.filter(p => p.id !== 'user') || []
})

// 是否轮到我
const isMyTurn = computed(() => {
    const currentPlayer = mahjongStore.currentRoom?.players?.[mahjongStore.gameState?.currentPlayer]
    return currentPlayer?.id === 'user'
})

// 听牌数据
const tingTiles = computed(() => {
    const myHand = getPlayer('south')?.hand || []
    // 考虑吃碰杠后，剩余手牌可能是 13, 10, 7, 4, 1 张
    if (![1, 4, 7, 10, 13].includes(myHand.length)) return []
    return mahjongEngine.getTingPai(myHand)
})

// 剩余牌堆数量
const deckCount = computed(() => {
    return mahjongStore.gameState?.deck?.length || 0
})

// 分解手牌：主手牌和新摸的牌
const displayedHand = computed(() => {
    const player = getPlayer('south')
    if (!player) return { main: [], drawn: null }

    const hand = player.hand || []
    const drawn = mahjongStore.gameState?.drawnTile

    // 如果我有14, 11, 8, 5, 2张牌，且手牌中有匹配新摸出的牌
    if (isMyTurn.value && [2, 5, 8, 11, 14].includes(hand.length) && drawn) {
        const lastIdx = hand.lastIndexOf(drawn)
        if (lastIdx !== -1) {
            const main = hand.map((t, i) => ({ t, i })).filter((_, i) => i !== lastIdx)
            return { main, drawn: { t: drawn, i: lastIdx } }
        }
    }

    return { main: hand.map((t, i) => ({ t, i })), drawn: null }
})

// 监听起牌音效
watch(() => mahjongStore.gameState?.drawnTile, (newVal) => {
    if (newVal && isMyTurn.value) {
        playSfx('draw')
    }
})

// 选择牌
const selectTile = (index) => {
    if (!isMyTurn.value) return
    const isSame = selectedTile.value === index
    selectedTile.value = isSame ? null : index
    if (!isSame) {
        playSfx('select')
    }
}

// 打出选中的牌
const playSelectedTile = () => {
    if (selectedTile.value === null) return
    const myHand = getPlayer('south')?.hand || []
    const tile = myHand[selectedTile.value]

    // 播放出牌音效
    playSfx('play')

    // 显示放大预览
    activeTile.value = tile
    activeTilePosition.value = 'south'

    // 800ms后关闭预览 (改为先设置定时器)
    const timeoutCard = tile
    setTimeout(() => {
        if (activeTile.value === timeoutCard) {
            activeTile.value = null
        }
    }, 800)

    // 移除这里的冗余播报，统一由 watch 处理
    // speak(tile)

    try {
        // 执行打牌
        mahjongStore.playTile(selectedTile.value)
    } catch (err) {
        console.error('打牌失败:', err)
    } finally {
        // 无论成功失败都清空选中状态
        selectedTile.value = null
        showTingHelp.value = false // 打牌后关闭听牌帮助
    }
}


// 判断是否为图片头像
const isImageAvatar = (avatar) => {
    if (!avatar) return false
    return avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http')
}

// 获取玩家相对于我的关系
const getPlayerRelation = (index) => {
    if (index === 0) return '我'
    // 0: 我 (南), 1: 下家 (东), 2: 对家 (北), 3: 上家 (西)
    const relations = ['我', '下家', '对家', '上家']
    return relations[index] || '旁观'
}

// 显示大字特效
const triggerActionEffect = (text, type) => {
    actionText.value = text
    actionType.value = type
    setTimeout(() => {
        actionText.value = ''
    }, 1500)
}


// 监听胡牌状态，延迟开启结算
watch(() => mahjongStore.gameState?.roundResult, (newVal) => {
    if (newVal) {
        // 只有当有胜利者时才播放胡牌特效
        if (newVal.winner && newVal.type !== '流局') {
            const winnerIdx = mahjongStore.currentRoom.players.findIndex(p => p.name === newVal.winner.name)
            // 语音已经由 handleAction/watch(lastAction) 触发，这里重点是多留时间看摊牌
        }

        // 延长等待时间到 3.5 秒，让摊牌和“胡”字特效展示完整
        setTimeout(() => {
            showScoreCard.value = true
        }, 3500)
    }
})


// 点击吃按钮的处理
const handleChiClick = () => {
    const myHand = getPlayer('south')?.hand || []
    const tile = mahjongStore.gameState?.currentTile
    const options = mahjongEngine.canChi(myHand, tile, 'previous')

    if (options.length > 1) {
        chiOptions.value = options
        showChiOptions.value = true
    } else {
        performAction('chi', options[0])
    }
}

// 确认具体的吃法
const confirmChi = (comb) => {
    showChiOptions.value = false
    performAction('chi', comb)
}

// 执行操作
const performAction = (action, chiCombo = null) => {
    const textMap = {
        'chi': '吃',
        'peng': '碰',
        'gang': '杠',
        'hu': '胡',
        'pass': '过'
    }

    if (action !== 'pass') {
        triggerActionEffect(textMap[action], action)
        speak(action, 0) // 语音播报用户动作
    }

    // 调用 store 处理
    mahjongStore.handleAction(action, 0, chiCombo)
    showTingHelp.value = false
    showChiOptions.value = false

    // 执行后立即清空标志位，防止按钮残留
    canChi.value = false
    canPeng.value = false
    canGang.value = false
    canHu.value = false
}


// 长按激活作弊模式
const handleLongPress = () => {
    longPressTimer = setTimeout(() => {
        mahjongStore.toggleCheat()
    }, 3000)
}

const cancelLongPress = () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }
}

// 获取牌的emoji
const getTileEmoji = (tile) => {
    const emojiMap = {
        // 万子
        'w1': '🀇', 'w2': '🀈', 'w3': '🀉', 'w4': '🀊', 'w5': '🀋',
        'w6': '🀌', 'w7': '🀍', 'w8': '🀎', 'w9': '🀏',
        // 条子
        't1': '🀐', 't2': '🀑', 't3': '🀒', 't4': '🀓', 't5': '🀔',
        't6': '🀕', 't7': '🀖', 't8': '🀗', 't9': '🀘',
        // 筒子
        'b1': '🀙', 'b2': '🀚', 'b3': '🀛', 'b4': '🀜', 'b5': '🀝',
        'b6': '🀞', 'b7': '🀟', 'b8': '🀠', 'b9': '🀡',
        // 字牌
        'east': '🀀', 'south': '🀁', 'west': '🀂', 'north': '🀃',
        'red': '🀄', 'green': '🀅', 'white': '🀆'
    }
    return emojiMap[tile] || '🀫'
}

// 监听动作特效
watch(() => mahjongStore.lastAction, (action) => {
    if (action && action.type) {
        const textMap = {
            'chi': '吃',
            'peng': '碰',
            'gang': '杠',
            'hu': '胡'
        }
        if (textMap[action.type]) {
            triggerActionEffect(textMap[action.type], action.type)
            // 播报动作者的声音 (修正：使用正确的 action 触发者索引)
            speak(action.type, action.playerIndex)
        }
    }
})

// 核心监听：监听所有可能触发操作变化的状态
watch([
    () => mahjongStore.gameState?.currentTile,
    () => mahjongStore.gameState?.currentPlayer,
    () => getPlayer('south')?.hand?.length
], ([newTile, currPlayer, handLen]) => {
    // 处理出牌时的公共视觉/听觉反馈
    if (newTile) {
        // 播放出牌音效（所有玩家）
        playSfx('play')

        // 只要有人打牌就显示放大动画
        activeTile.value = newTile

        // 播报打牌者的语音
        speak(newTile, mahjongStore.gameState?.lastPlayer)

        setTimeout(() => {
            if (activeTile.value === newTile) {
                activeTile.value = null
            }
        }, 1000)
    }

    const myHand = getPlayer('south')?.hand || []

    // 如果是我的回合：检查自摸和暗杠/补杠
    if (isMyTurn.value) {
        canHu.value = mahjongEngine.canHu(myHand) // 自摸检查

        // 杠检查：暗杠
        const gangTiles = mahjongEngine.canAnGang(myHand)
        canGang.value = gangTiles.length > 0

        canPeng.value = false
        canChi.value = false
        return
    }

    // 如果不是我的回合且有人出牌：检查胡、杠、碰、吃
    if (newTile) {
        canHu.value = mahjongEngine.canHu(myHand, newTile)
        canGang.value = mahjongEngine.canGang(myHand, newTile)
        canPeng.value = mahjongEngine.canPeng(myHand, newTile)

        // 只能吃上家（左侧玩家 index 3）打出来的牌
        // 注意：这里逻辑需要严谨，lastPlayer 是 打牌的人
        const lastPlayer = mahjongStore.gameState?.lastPlayer
        const isFromPrevious = lastPlayer === 3
        canChi.value = isFromPrevious && mahjongEngine.canChi(myHand, newTile, 'previous').length > 0
    } else {
        // 无人出牌时清空除自摸外的标志
        canHu.value = isMyTurn.value ? mahjongEngine.canHu(myHand) : false
        canGang.value = isMyTurn.value ? (mahjongEngine.canAnGang(myHand).length > 0) : false
        canPeng.value = false
        canChi.value = false
    }
}, { immediate: true })


// 播放开局动画
const playGameStartAnimation = async () => {
    showGameStart.value = true
    diceResult.value = 0

    // 获取庄家信息
    const dealerIndex = mahjongStore.gameState?.dealer || 0
    const dealer = mahjongStore.currentRoom?.players?.[dealerIndex]
    dealerName.value = dealer?.name || '玩家'
    isUserDealer.value = dealer?.id === 'user'

    // 阶段1: 摇骰子
    gameStartPhase.value = 'dice'

    if (isUserDealer.value) {
        // 用户是庄家，等待点击摇骰子
        // 等待用户点击（通过rollDice函数触发）
        await new Promise(resolve => {
            window._diceResolve = resolve
        })
    } else {
        // AI庄家自动摇骰子
        rolling.value = true
        playSfx('dice')
        // 骰子滚动动画
        const rollInterval = setInterval(() => {
            const dice = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
            dice1Emoji.value = dice[Math.floor(Math.random() * 6)]
            dice2Emoji.value = dice[Math.floor(Math.random() * 6)]
        }, 100)

        await new Promise(resolve => setTimeout(resolve, 1500))
        clearInterval(rollInterval)
        rolling.value = false

        // 摇骰子结果
        const d1 = Math.floor(Math.random() * 6) + 1
        const d2 = Math.floor(Math.random() * 6) + 1
        const diceChars = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
        dice1Emoji.value = diceChars[d1]
        dice2Emoji.value = diceChars[d2]

        diceResult.value = d1 + d2

        // 确定发牌位置
        const positions = ['东', '南', '西', '北']
        const positionIndex = (dealerIndex + (diceResult.value - 1) % 4) % 4
        dealPosition.value = positions[positionIndex]

        // 显示结果2秒
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // 阶段2: 显示牌堆 (1.5秒) + 洗牌音效
    gameStartPhase.value = 'deck'
    playSfx('shuffle')
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 阶段3: 发牌动画 (2.6秒)
    gameStartPhase.value = 'deal'
    dealingProgress.value = 0
    playSfx('deal')

    // 模拟发牌进度 (4个玩家 * 13张牌 = 52张)
    const dealInterval = setInterval(() => {
        dealingProgress.value++
        if (dealingProgress.value >= 52) {
            clearInterval(dealInterval)
        }
    }, 50) // 每50ms发一张牌

    await new Promise(resolve => setTimeout(resolve, 2600))

    // 关闭动画
    showGameStart.value = false
}

// 封装完整的游戏流程（动画+正式开始）
const runGameFlow = async () => {
    await playGameStartAnimation()

    // 动画完成后正式开始
    mahjongStore.startGame()

    // 庄家是第一个出牌的
    if (mahjongStore.gameState.currentPlayer !== mahjongStore.gameState.dealer) {
        mahjongStore.gameState.currentPlayer = mahjongStore.gameState.dealer
    }

    // 触发庄家的动作
    const dealer = mahjongStore.currentRoom.players[mahjongStore.gameState.dealer]
    if (dealer.isAI) {
        setTimeout(() => {
            mahjongStore.aiPlayTile(dealer)
        }, 1000)
    }
}

// 手动摇骰子（用户点击）
const rollDice = () => {
    rolling.value = true
    playSfx('dice')
    // 骰子滚动动画
    const rollInterval = setInterval(() => {
        const dice = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
        dice1Emoji.value = dice[Math.floor(Math.random() * 6)]
        dice2Emoji.value = dice[Math.floor(Math.random() * 6)]
    }, 100)

    setTimeout(() => {
        clearInterval(rollInterval)
        rolling.value = false
        const d1 = Math.floor(Math.random() * 6) + 1
        const d2 = Math.floor(Math.random() * 6) + 1
        const diceChars = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
        dice1Emoji.value = diceChars[d1]
        dice2Emoji.value = diceChars[d2]
        diceResult.value = d1 + d2

        const dealerIndex = mahjongStore.gameState?.dealer || 0
        const positions = ['东', '南', '西', '北']
        const positionIndex = (dealerIndex + (diceResult.value - 1) % 4) % 4
        dealPosition.value = positions[positionIndex]

        setTimeout(() => {
            if (window._diceResolve) {
                window._diceResolve()
                window._diceResolve = null
            }
        }, 1500)
    }, 1500)
}

// 结算结束，进入下一局前的处理
const handleRoundEnd = async () => {
    showScoreCard.value = false // 关闭结算界面
    randomTileBackColor() // 每一局换个颜色
    mahjongStore.startNextRound()
    await runGameFlow()
}

// 自动开始第一局
onMounted(() => {
    // 初始颜色
    randomTileBackColor()
    // 如果没有房间信息（可能是刷新页面），返回大厅
    if (!mahjongStore.currentRoom) {
        router.push('/games/mahjong-lobby')
        return
    }

    // 如果还没有发牌（deck为空），或者没有gameState，播放开局动画
    if (!mahjongStore.gameState || mahjongStore.gameState.deck.length === 0) {
        runGameFlow()
    }
})

// 处理局内聊天发送
const handleSendChat = async () => {
    if (!chatInput.value.trim() || isAiReplying.value) return
    const text = chatInput.value
    chatInput.value = ''
    isAiReplying.value = true
    await mahjongStore.sendGameChat(text)
    isAiReplying.value = false
    scrollToBottom()
}

const scrollToBottom = () => {
    nextTick(() => {
        const el = document.getElementById('chat-history')
        if (el) el.scrollTop = el.scrollHeight
    })
}

watch(() => mahjongStore.gameChatMessages.length, () => {
    if (!showChatPanel.value) hasNewMsg.value = true
    scrollToBottom()
})

watch(showChatPanel, (val) => {
    if (val) {
        hasNewMsg.value = false
        scrollToBottom()
    }
})

// 获取花色颜色
const getTileColorClass = (tile) => {
    if (!tile) return ''
    if (tile.startsWith('w') || tile === 'red') return 'tile-red'
    if (tile.startsWith('t') || tile === 'green') return 'tile-green'
    if (tile.startsWith('b')) return 'tile-blue'
    return ''
}
</script>

<style scoped>
.mahjong-tile {
    width: 32px;
    height: 46px;
    background: #fff;
    border-radius: 4px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
    /* 3D 侧边 */
    box-shadow:
        0 1px 0 #ddd,
        0 2px 0 #ccc,
        0 3px 0 #bbb,
        0 4px 0 #aaa,
        0 5px 6px rgba(0, 0, 0, 0.3);
    color: #333;
    padding-bottom: 4px;
    margin-bottom: 5px;
}

/* 彩色花色样式 */
.tile-red {
    color: #e11d48 !important;
}

.tile-green {
    color: #16a34a !important;
}

.tile-blue {
    color: #2563eb !important;
}

.mahjong-tile:not(.disabled):hover {
    transform: translateY(-4px);
    box-shadow:
        0 1px 0 #ddd,
        0 2px 0 #ccc,
        0 3px 0 #bbb,
        0 4px 0 #aaa,
        0 8px 12px rgba(0, 0, 0, 0.4);
}

.mahjong-tile.selected {
    transform: translateY(-12px);
    box-shadow:
        0 1px 0 #ddd,
        0 2px 0 #ccc,
        0 3px 0 #bbb,
        0 4px 0 #aaa,
        0 12px 20px rgba(59, 130, 246, 0.5);
    border: 2px solid #3b82f6;
}

.mahjong-tile-back {
    width: 24px;
    height: 34px;
    background: linear-gradient(135deg, var(--tile-back-primary, #10b981), var(--tile-back-secondary, #059669));
    border-radius: 3px;
    position: relative;
    box-shadow:
        0 1px 0 var(--tile-back-shadow, #047857),
        0 2px 0 var(--tile-back-shadow, #047857),
        0 3px 0 var(--tile-back-shadow, #047857),
        0 4px 4px rgba(0, 0, 0, 0.4);
    border: 1px solid var(--tile-back-primary, #10b981);
}

.mahjong-tile-back::after {
    content: '';
    position: absolute;
    inset: 2px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 2px;
}

.mahjong-tile-up,
.mahjong-tile-up-side {
    width: 24px;
    height: 34px;
    background: #fff;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 1px 0 #ccc, 0 2px 3px rgba(0, 0, 0, 0.2);
    color: #333;
    padding-bottom: 2px;
}

.mahjong-tile-pool {
    width: 24px;
    height: 34px;
    background: #fff;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    box-shadow:
        0 1px 0 #ddd,
        0 2px 0 #ccc,
        0 3px 4px rgba(0, 0, 0, 0.3);
    color: #333;
    padding-bottom: 2px;
}

.mahjong-tile-vertical {
    width: 24px;
    height: 16px;
    background: linear-gradient(to bottom, var(--tile-back-primary, #10b981), var(--tile-back-shadow, #047857));
    border-radius: 2px;
    position: relative;
    box-shadow:
        0 1px 0 var(--tile-back-shadow, #047857),
        0 2px 0 var(--tile-back-shadow, #047857),
        0 3px 4px rgba(0, 0, 0, 0.4);
    margin: 0;
}

.mahjong-tile-vertical::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px 2px 0 0;
}

/* 开局动画牌堆 3D 加强 */
.deck-tile {
    width: 14px;
    height: 20px;
    background: linear-gradient(135deg, var(--tile-back-primary, #10b981), var(--tile-back-secondary, #059669));
    border-radius: 2px;
    box-shadow: 0 2px 0 var(--tile-back-shadow, #047857);
}

.action-btn {
    padding: 10px 24px;
    color: white;
    font-weight: 900;
    border-radius: 12px;
    transition: all 0.2s;
    cursor: pointer;
    font-size: 18px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    position: relative;
    border: none;
    box-shadow:
        0 4px 0 var(--btn-shadow),
        0 8px 15px rgba(0, 0, 0, 0.3);
}

.action-btn:active {
    transform: translateY(2px);
    box-shadow:
        0 2px 0 var(--btn-shadow),
        0 4px 8px rgba(0, 0, 0, 0.3);
}

.btn-chi {
    --btn-shadow: #1e40af;
    background: linear-gradient(to bottom, #3b82f6, #2563eb);
}

.btn-peng {
    --btn-shadow: #166534;
    background: linear-gradient(to bottom, #22c55e, #16a34a);
}

.btn-gang {
    --btn-shadow: #6b21a8;
    background: linear-gradient(to bottom, #a855f7, #9333ea);
}

.btn-hu {
    --btn-shadow: #991b1b;
    background: linear-gradient(to bottom, #ef4444, #dc2626);
}

.btn-pass {
    --btn-shadow: #374151;
    background: linear-gradient(to bottom, #6b7280, #4b5563);
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

/* 高级感桌布 */
.bg-table-felt {
    background-color: #064e3b;
    background-image: radial-gradient(circle at center, #065f46 0%, #064e3b 100%);
    position: relative;
}

.bg-table-felt::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3%3Cfilter id='noiseFilter'%3%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3%3C/filter%3%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3%3C/svg%3");
    opacity: 0.08;
    pointer-events: none;
}

.table-border {
    border: 12px solid #3f2b1c;
    border-image: linear-gradient(to bottom, #5d4037, #3e2723) 1;
    box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.6);
}

/* 记牌器侧边栏 */
.card-counter-panel {
    position: fixed;
    right: 12px;
    top: 60px;
    bottom: 80px;
    width: 60px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    z-index: 80;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
}

.card-counter-panel::-webkit-scrollbar {
    display: none;
}

.counter-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    padding: 6px 2px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s;
}

.counter-tile {
    font-size: 18px;
    background: white;
    border-radius: 4px;
    width: 24px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    margin-bottom: 2px;
}

.counter-num {
    font-size: 11px;
    font-weight: 900;
    color: #fbbf24;
}

/* 圆形操作按钮 - 极致空间优化 */
.action-circle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 16px;
    color: white;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    position: relative;
    box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.4),
        inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.action-circle::after {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    right: 4px;
    height: 35%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.3), transparent);
    border-radius: 22px 22px 0 0;
}

.action-circle:active {
    transform: scale(0.9) translateY(4px);
    filter: brightness(0.9);
}

.chi {
    background: radial-gradient(circle at 30% 30%, #3b82f6, #1d4ed8);
    border: 2px solid #93c5fd;
}

.peng {
    background: radial-gradient(circle at 30% 30%, #22c55e, #15803d);
    border: 2px solid #86efac;
}

.gang {
    background: radial-gradient(circle at 30% 30%, #a855f7, #7e22ce);
    border: 2px solid #d8b4fe;
}

.hu {
    background: radial-gradient(circle at 30% 30%, #ef4444, #b91c1c);
    border: 2px solid #fca5a5;
}

.pass {
    background: radial-gradient(circle at 30% 30%, #6b7280, #374151);
    border: 2px solid #d1d5db;
    font-size: 16px;
}

.animate-hu-glow {
    animation: huGlow 1.2s infinite;
}

@keyframes huGlow {

    0%,
    100% {
        box-shadow: 0 0 15px #ef4444, inset 0 2px 4px rgba(255, 255, 255, 0.3);
        transform: scale(1);
    }

    50% {
        box-shadow: 0 0 35px #ef4444, 0 0 60px rgba(239, 68, 68, 0.5);
        transform: scale(1.1);
    }
}

.play-btn {
    background: linear-gradient(to bottom, #f97316, #c2410c);
    color: white;
    font-weight: 900;
    padding: 10px 30px;
    border-radius: 99px;
    font-size: 18px;
    border: 2px solid #ffedd5;
    box-shadow:
        0 4px 8px rgba(194, 65, 12, 0.5),
        inset 0 2px 4px rgba(255, 255, 255, 0.4);
    transition: all 0.2s;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.play-btn:active {
    transform: translateY(2px);
    box-shadow: 0 2px 4px rgba(194, 65, 12, 0.4);
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: scale(0.8);
    }

    to {
        opacity: 1;
        transform: scale(1);
    }
}

.animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
}

.zoom-enter-active {
    animation: zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.zoom-leave-active {
    animation: zoomIn 0.3s reverse forwards;
}

@keyframes zoomIn {
    from {
        opacity: 0;
        transform: scale(0.3) translateY(50px);
    }

    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

/* 操作大字特效 */
.action-text-main {
    font-size: 140px;
    font-weight: 900;
    color: white;
    text-shadow: 0 0 20px rgba(0, 0, 0, 0.5),
        0 0 60px var(--action-color),
        8px 8px 0 var(--action-border);
    -webkit-text-stroke: 4px white;
    font-style: italic;
    filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.8));
    letter-spacing: 10px;
}

.action-glow {
    opacity: 0.6;
}

.bg-chi {
    background-color: #3b82f6;
}

.bg-peng {
    background-color: #22c55e;
}

.bg-gang {
    background-color: #a855f7;
}

.bg-hu {
    background-color: #ef4444;
}

@keyframes actionIconMove {
    0% {
        transform: scale(0.5) translateY(20px);
        opacity: 0;
    }

    50% {
        transform: scale(1.2) translateY(-10px);
        opacity: 1;
    }

    100% {
        transform: scale(1) translateY(0);
        opacity: 1;
    }
}

.animate-actionIcon {
    animation: actionIconMove 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.action-chi {
    --action-color: #3b82f6;
    --action-border: #1e3a8a;
}

.action-peng {
    --action-color: #22c55e;
    --action-border: #064e3b;
}

.action-gang {
    --action-color: #a855f7;
    --action-border: #581c87;
}

.action-hu {
    --action-color: #ef4444;
    --action-border: #7f1d1d;
}

.action-pop-enter-active {
    animation: actionPopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.5) forwards;
}

.action-pop-leave-active {
    animation: actionPopOut 0.4s ease-in forwards;
}

@keyframes actionPopIn {
    0% {
        transform: scale(0) rotate(-20deg);
        opacity: 0;
        filter: brightness(2);
    }

    70% {
        transform: scale(1.2) rotate(5deg);
        opacity: 1;
        filter: brightness(1.5);
    }

    100% {
        transform: scale(1) rotate(0deg);
        opacity: 1;
        filter: brightness(1);
    }
}

@keyframes actionPopOut {
    0% {
        transform: scale(1);
        opacity: 1;
    }

    100% {
        transform: scale(2);
        opacity: 0;
        filter: blur(10px);
    }
}

/* 扩展动作特效 CSS */
.action-text-main {
    font-size: 140px;
    font-weight: 900;
    color: white;
    text-shadow: 0 0 20px rgba(0, 0, 0, 0.5),
        0 0 60px var(--action-color),
        10px 10px 0 var(--action-border);
    -webkit-text-stroke: 4px white;
    font-style: italic;
    filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.8));
    letter-spacing: 12px;
}

.action-glow {
    opacity: 0.8;
    transition: all 0.5s ease;
}

.bg-chi {
    background-color: rgba(59, 130, 246, 0.8);
}

.bg-peng {
    background-color: rgba(34, 197, 94, 0.8);
}

.bg-gang {
    background-color: rgba(168, 85, 247, 0.8);
}

.bg-hu {
    background-color: rgba(239, 68, 68, 0.8);
}

@keyframes actionIconMove {
    0% {
        transform: scale(0.3) translateY(40px);
        opacity: 0;
    }

    50% {
        transform: scale(1.4) translateY(-20px);
        opacity: 1;
    }

    100% {
        transform: scale(1) translateY(0);
        opacity: 1;
    }
}

.animate-actionIcon {
    animation: actionIconMove 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes fadeInOut {
    0% {
        opacity: 0;
    }

    30% {
        opacity: 1;
    }

    70% {
        opacity: 1;
    }

    100% {
        opacity: 0;
    }
}

.animate-fadeInOut {
    animation: fadeInOut 1.5s ease-in-out forwards;
}

.dealer-icon {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 20px;
    height: 20px;
    background: #fbbf24;
    color: #92400e;
    border-radius: 50%;
    border: 2px solid white;
    font-size: 10px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

@keyframes breathing {

    0%,
    100% {
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.4);
        transform: scale(1);
    }

    50% {
        box-shadow: 0 0 30px rgba(59, 130, 246, 1), 0 0 50px rgba(59, 130, 246, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.5);
        transform: scale(1.05);
    }
}

.active-breathing {
    border-radius: 9999px;
    animation: breathing 1.5s ease-in-out infinite;
    z-index: 5;
    position: relative;
    border: 3px solid #60a5fa;
}

.active-breathing::before {
    content: '';
    position: absolute;
    inset: -6px;
    border: 2px solid #3b82f6;
    border-radius: 9999px;
    animation: pulse-ring 1.5s ease-out infinite;
}

@keyframes pulse-ring {
    0% {
        transform: scale(0.9);
        opacity: 1;
    }

    100% {
        transform: scale(1.5);
        opacity: 0;
    }
}

/* 3D 骰子样式 */
.dice-box {
    width: 100px;
    height: 100px;
    background: white;
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 70px;
    color: #333;
    box-shadow:
        inset 0 -10px 0 #ddd,
        0 10px 20px rgba(0, 0, 0, 0.3);
    transition: all 0.1s;
}

.dice-box.rolling {
    animation: shake 0.1s infinite;
}

@keyframes shake {
    0% {
        transform: rotate(0deg) translate(0, 0);
    }

    25% {
        transform: rotate(5deg) translate(2px, -2px);
    }

    50% {
        transform: rotate(0deg) translate(-2px, 2px);
    }

    75% {
        transform: rotate(-5deg) translate(2px, 2px);
    }

    100% {
        transform: rotate(0deg) translate(-2px, -2px);
    }
}

.dice-face {
    text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.1);
}

.animate-slide-in {
    animation: slideIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

@keyframes slideIn {
    0% {
        transform: translateX(30px);
        opacity: 0;
    }

    100% {
        transform: translateX(0);
        opacity: 1;
    }
}
</style>

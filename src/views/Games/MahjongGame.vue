<template>
    <div @click="unlockAudio"
        class="mahjong-game fixed inset-0 w-full h-full flex flex-col overflow-hidden select-none touch-none items-center justify-center bg-black/40">
        <!-- 适配长屏的容器 -->
        <div class="w-full h-full max-w-[600px] max-h-[1200px] relative flex flex-col shadow-2xl overflow-hidden bg-[#064e3b]"
            :class="!mahjongStore.tablecloth ? 'bg-table-felt' : ''" :style="mainGameStyles">
            <div class="table-border absolute inset-0 pointer-events-none"></div>

            <!-- 水印 (Fixed: 修复显示层级和文案) -->
            <div
                class="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 opacity-[0.08]">
                <div
                    class="transform -rotate-12 text-6xl md:text-8xl font-black tracking-widest text-black whitespace-nowrap drop-shadow-md select-none">
                    {{ mahjongStore.currentRoom?.mode === 'quick' ? '快速模式' : '房间模式' }}
                </div>
            </div>
            <!-- 顶部信息栏 (微调高度，平衡防撞与空间) -->
            <div
                class="game-top-bar shrink-0 bg-blue-400/30 backdrop-blur-md flex items-center justify-between px-3 pt-[32px] pb-1 min-h-[68px] z-[100] relative border-b border-blue-300/30">
                <div class="flex items-center gap-2">
                    <button @click="handleExit" title="结束对局"
                        class="w-8 h-8 flex items-center justify-center text-white/90 hover:text-red-300 active:scale-90 transition-all bg-white/10 rounded-full shadow-md">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                    <button @click="handleMinimize" title="最小化挂机"
                        class="w-8 h-8 flex items-center justify-center text-white/90 hover:text-blue-300 active:scale-90 transition-all bg-white/10 rounded-full shadow-md">
                        <i class="fa-solid fa-minus text-sm"></i>
                    </button>
                </div>

                <div
                    class="flex items-center gap-2 text-white text-xs font-black whitespace-nowrap overflow-hidden drop-shadow-sm">
                    <span class="opacity-80">局: <span class="text-white">{{ mahjongStore.currentRoom?.currentRound
                            }}/{{ mahjongStore.currentRoom?.totalRounds }}</span></span>
                    <span class="opacity-80">底: <span class="text-white">{{ mahjongStore.currentRoom?.baseStake
                            }}</span></span>
                    <span class="opacity-80">堆: <span class="text-yellow-400 font-black">{{
                        mahjongStore.gameState?.deck?.length
                        || 0
                            }}</span></span>
                </div>

                <div class="flex items-center gap-1.5">
                    <button v-if="mahjongStore.currentRoom?.mode !== 'quick'"
                        @click="isChatPanelVisible = !isChatPanelVisible"
                        class="w-8 h-8 rounded-full bg-blue-500/80 text-white flex items-center justify-center active:scale-95 transition-transform relative border border-white/20">
                        <i class="fa-solid fa-message text-[10px]"></i>
                    </button>
                    <button @click="showCardCounter = !showCardCounter"
                        class="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-95 transition-transform border border-white/10">
                        <i class="fa-solid fa-calculator text-[10px]"></i>
                    </button>
                    <button @click="mahjongStore.cheatMode = !mahjongStore.cheatMode"
                        class="w-8 h-8 flex items-center justify-center text-white opacity-70 hover:opacity-100">
                        <i class="fa-solid fa-eye-slash text-[10px]"
                            :class="{ 'fa-eye text-yellow-400 opacity-100': mahjongStore.cheatMode }"></i>
                    </button>
                    <button @click="showSettings = true"
                        class="w-8 h-8 flex items-center justify-center text-white opacity-70 hover:opacity-100">
                        <i class="fa-solid fa-gear text-[10px]"></i>
                    </button>
                </div>
            </div>

            <!-- 弹幕层 -->
            <div class="absolute inset-0 pointer-events-none z-[80] overflow-hidden">
                <div v-for="dm in danmakuList" :key="dm.id"
                    class="absolute flex items-center gap-2 animate-slide-left transition-all"
                    :style="{ top: dm.top + '%', animationDuration: dm.duration + 's' }">

                    <!-- 头像 (无背景框，仅保留头像本身) -->
                    <div
                        class="w-8 h-8 rounded-full overflow-hidden border border-white/50 shadow-[0_2px_4px_rgba(0,0,0,0.6)] shrink-0 bg-black/20 flex items-center justify-center">
                        <img v-if="isImageAvatar(dm.avatar)" :src="dm.avatar" class="w-full h-full object-cover" />
                        <div v-else class="text-xs font-bold text-white drop-shadow-md">
                            {{ dm.avatar || (dm.sender && dm.sender[0]) || '👤' }}
                        </div>
                    </div>

                    <!-- 文字部分 (使用强投影代替背景盒) -->
                    <div class="flex items-center gap-1 whitespace-nowrap px-1"
                        style="text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 4px rgba(0,0,0,0.8);">
                        <span class="text-sm font-black tracking-wide" :style="{ color: dm.color }">
                            {{ dm.sender }}:
                        </span>
                        <span class="text-white text-sm font-bold">
                            {{ dm.text }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- 游戏区域 (添加 min-h-0 防止撑开父容器，实现自适应缩小) -->
            <div class="flex-1 flex flex-col p-2 px-4 md:px-6 min-h-0 overflow-y-auto overflow-x-hidden relative z-10">

                <!-- 对家（上） -->
                <div class="player-north flex flex-col items-center mb-4 shrink-0">
                    <div class="flex items-center gap-3">
                        <!-- 北位头像 -->
                        <div class="relative transition-all duration-300"
                            :class="{ 'active-breathing': mahjongStore.gameState?.currentPlayer === 2 }">
                            <div v-if="isImageAvatar(getPlayer('north')?.avatar)"
                                class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
                                <img :src="getPlayer('north')?.avatar" class="w-full h-full object-cover" />
                            </div>
                            <div v-else
                                class="w-10 h-10 rounded-full bg-gray-600/50 flex items-center justify-center text-xl text-white">
                                {{ getPlayer('north')?.avatar || '👤' }}
                            </div>
                            <div v-if="mahjongStore.gameState?.dealer === 2" class="dealer-icon">庄</div>
                        </div>

                        <div class="text-white text-xs">
                            <div class="font-bold">{{ getPlayer('north')?.name }}</div>
                            <div class="opacity-60 text-[10px]">{{ getPlayer('north')?.beans }}豆</div>
                        </div>
                    </div>



                    <!-- 手牌（背面或结算亮出） -->
                    <div class="flex gap-0.5 mt-2">
                        <div v-for="(tile, i) in getPlayer('north')?.hand" :key="i"
                            :class="mahjongStore.gameState?.roundResult ? ['mahjong-tile-pool !w-6 !h-9 !text-[16px]', getTileColorClass(tile)] : 'mahjong-tile-back'">
                            <div v-if="mahjongStore.gameState?.roundResult" class="tile-face-content"
                                v-html="getTileFaceHTML(tile)"></div>
                        </div>
                    </div>

                    <div class="mt-2 flex gap-1.5" v-if="getPlayer('north')?.exposed?.length">
                        <div v-for="(group, idx) in getPlayer('north').exposed" :key="idx"
                            class="flex bg-black/40 p-0.5 rounded shadow-inner border border-white/10 scale-90">
                            <div v-for="(tile, tIdx) in group.tiles" :key="tIdx"
                                class="mahjong-tile-small !w-5 !h-7 !text-[12px]" :class="getTileColorClass(tile)">
                                <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 中间区域 -->
                <div class="flex-1 flex justify-between items-center w-full px-1 min-h-[350px]">
                    <!-- 左家 -->
                    <div class="player-west flex flex-col items-center gap-2 min-w-[60px] text-xs flex-shrink-0 z-10">
                        <!-- Left Player Avatar & Info (Unchanged from original structure, just copying to context) -->
                        <div class="flex flex-col items-center w-16 relative">
                            <div class="relative mb-1 transition-all duration-300"
                                :class="{ 'active-breathing': mahjongStore.gameState?.currentPlayer === 3 }">
                                <div v-if="isImageAvatar(getPlayer('west')?.avatar)"
                                    class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                    <img :src="getPlayer('west')?.avatar" class="w-full h-full object-cover" />
                                </div>
                                <div v-else
                                    class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-lg">
                                    {{ getPlayer('west')?.avatar || '🎭' }}
                                </div>
                                <div v-if="mahjongStore.gameState?.dealer === 3" class="dealer-icon">庄</div>
                            </div>

                            <div class="text-white text-[9px] text-center mb-1 scale-90 origin-top">
                                <div class="font-bold w-16 break-words leading-tight truncate">
                                    {{ getPlayer('west')?.name }}
                                </div>
                                <div class="opacity-80">{{ getPlayer('west')?.beans }}豆</div>
                            </div>
                        </div>

                        <!-- Left Player Tiles -->
                        <div class="flex flex-row items-end gap-1">
                            <div class="flex flex-col items-center"
                                :class="mahjongStore.gameState?.roundResult ? 'mr-3 my-auto' : 'gap-1'">
                                <div v-for="tile in getPlayer('west')?.hand" :key="'west-hand-' + tile"
                                    :class="mahjongStore.gameState?.roundResult ? ['mahjong-tile-pool', '!w-[36px] !h-[26px] my-[-2px]', getTileColorClass(tile)] : 'mahjong-tile-vertical'">
                                    <div v-if="mahjongStore.gameState?.roundResult" class="tile-face-content"
                                        v-html="getTileFaceHTML(tile)"></div>
                                </div>
                            </div>
                            <div v-if="getPlayer('west')?.exposed?.length" class="flex flex-col gap-0.5">
                                <div v-for="(group, idx) in getPlayer('west')?.exposed" :key="idx"
                                    class="flex flex-col gap-0.5 bg-black/40 p-0.5 rounded shadow-inner border border-white/10 scale-90">
                                    <div v-for="(tile, tIdx) in group.tiles" :key="tIdx"
                                        class="mahjong-tile-small !w-5 !h-7 !text-[12px] rotate-90 my-[-2px] mx-auto"
                                        :class="getTileColorClass(tile)">
                                        <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    <!-- 牌池 (Widened + Bigger Active Tile) -->
                    <div class="flex-1 flex flex-col items-center justify-center min-w-0 mx-2">
                        <div v-if="!mahjongStore.gameState" class="text-white text-center">
                            <div class="text-6xl mb-4">🀄</div>
                            <div class="text-xl font-bold">准备中...</div>
                        </div>
                        <div v-else-if="mahjongStore.currentRoom?.status === 'settling'" class="text-white text-center">
                            <div class="text-5xl mb-3">🎉</div>
                            <div class="text-2xl font-bold mb-2">{{ mahjongStore.currentRoom.lastResult?.winnerName
                            }}
                                胡了！
                            </div>
                            <div class="text-lg">{{ mahjongStore.currentRoom.lastResult?.fan }}番</div>
                            <div class="text-xl font-bold text-yellow-300 mt-2">+{{
                                mahjongStore.currentRoom.lastResult?.reward }}豆</div>
                        </div>
                        <div v-else class="flex flex-col items-center w-full scale-90 md:scale-100">
                            <div class="text-white text-[10px] mb-1 opacity-40">剩余 {{ deckCount }} 张</div>

                            <!-- 牌池（打出的牌） - 扩大最大宽度 -->
                            <div
                                class="bg-black/30 p-2 rounded-xl border border-white/10 shadow-inner w-full max-w-[500px] min-h-[100px] flex flex-wrap gap-1 justify-center relative overflow-visible">
                                <!-- 扩大刚打出的牌提示 -->
                                <Transition name="zoom">
                                    <div v-if="activeTile"
                                        class="absolute z-40 bg-white border-4 border-orange-500 rounded-xl shadow-[0_0_20px_rgba(255,165,0,0.6)] flex items-center justify-center w-20 h-28 -top-20 active-tile-zoom overflow-hidden"
                                        :class="getTileColorClass(activeTile)">
                                        <div class="tile-face-content" v-html="getTileFaceHTML(activeTile)">
                                        </div>
                                    </div>
                                </Transition>

                                <div v-for="(tile, i) in mahjongStore.gameState?.pool" :key="i"
                                    class="mahjong-tile-pool !w-5 !h-7 !text-[12px]" :class="getTileColorClass(tile)">
                                    <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 右家 -->
                    <div class="player-east flex flex-col items-center gap-2 min-w-[60px] text-xs flex-shrink-0 z-10">
                        <div class="flex flex-col items-center w-16 relative">
                            <div class="relative mb-1 transition-all duration-300"
                                :class="{ 'active-breathing': mahjongStore.gameState?.currentPlayer === 1 }">
                                <div v-if="isImageAvatar(getPlayer('east')?.avatar)"
                                    class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                                    <img :src="getPlayer('east')?.avatar" class="w-full h-full object-cover" />
                                </div>
                                <div v-else
                                    class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-lg">
                                    {{ getPlayer('east')?.avatar || '🎭' }}
                                </div>
                                <div v-if="mahjongStore.gameState?.dealer === 1" class="dealer-icon">庄</div>
                            </div>

                            <div class="text-white text-[9px] text-center mb-1 scale-90 origin-top">
                                <div class="font-bold w-16 break-words leading-tight truncate">
                                    {{ getPlayer('east')?.name }}
                                </div>
                                <div class="opacity-80">{{ getPlayer('east')?.beans }}豆</div>
                            </div>
                        </div>

                        <div class="flex flex-row-reverse items-end gap-1">
                            <div class="flex flex-col items-center"
                                :class="mahjongStore.gameState?.roundResult ? 'ml-3 my-auto' : 'gap-1'">
                                <div v-for="tile in getPlayer('east')?.hand" :key="'east-hand-' + tile"
                                    :class="mahjongStore.gameState?.roundResult ? ['mahjong-tile-pool', '!w-[36px] !h-[26px] my-[-2px]', getTileColorClass(tile)] : 'mahjong-tile-vertical'">
                                    <div v-if="mahjongStore.gameState?.roundResult" class="tile-face-content"
                                        v-html="getTileFaceHTML(tile)"></div>
                                </div>
                            </div>
                            <div v-if="getPlayer('east')?.exposed?.length" class="flex flex-col gap-0.5">
                                <div v-for="(group, idx) in getPlayer('east')?.exposed" :key="idx"
                                    class="flex flex-col gap-0.5 bg-black/40 p-0.5 rounded shadow-inner border border-white/10 scale-90">
                                    <div v-for="(tile, tIdx) in group.tiles" :key="tIdx"
                                        class="mahjong-tile-small !w-5 !h-7 !text-[12px] -rotate-90 my-[-2px] mx-auto"
                                        :class="getTileColorClass(tile)">
                                        <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 我（下） -->
                <div class="player-south flex flex-col items-center mt-auto shrink-0 transition-all duration-500 relative pb-4"
                    :class="mahjongStore.gameState?.roundResult ? 'mb-4' : 'mb-3'">
                    <!-- 动作按钮区域 (Positioned above tiles) -->
                    <div
                        class="absolute top-[-60px] left-1/2 -translate-x-1/2 flex items-center justify-center gap-3 z-50 transition-all duration-300 w-full pointer-events-none">
                        <div v-if="canAction"
                            class="flex gap-2 items-center justify-center animate-bounce-in pointer-events-auto">
                            <img v-if="canChi" src="/images/mahjong/麻将_吃-按钮.png" @click="handleChiClick"
                                class="w-12 h-12 cursor-pointer hover:scale-110 active:scale-95 transition-transform drop-shadow-lg"
                                alt="吃" />
                            <img v-if="canPeng" src="/images/mahjong/麻将_碰-按钮.png" @click="performAction('peng')"
                                class="w-12 h-12 cursor-pointer hover:scale-110 active:scale-95 transition-transform drop-shadow-lg"
                                alt="碰" />
                            <img v-if="canGang" src="/images/mahjong/麻将_杠-按钮.png" @click="performAction('gang')"
                                class="w-12 h-12 cursor-pointer hover:scale-110 active:scale-95 transition-transform drop-shadow-lg"
                                alt="杠" />
                            <img v-if="canHu" src="/images/mahjong/麻将_胡-按钮.png" @click="performAction('hu')"
                                class="w-12 h-12 cursor-pointer hover:scale-110 active:scale-95 transition-transform drop-shadow-xl animate-pulse"
                                alt="胡" />
                            <img v-if="!isMyTurn && (canChi || canPeng || canGang || canHu)"
                                src="/images/mahjong/麻将_过-按钮.png" @click="performAction('pass')"
                                class="w-10 h-10 cursor-pointer hover:scale-110 active:scale-95 transition-transform opacity-80 hover:opacity-100"
                                alt="过" />
                        </div>

                        <!-- 听牌灯泡按钮 -->
                        <div v-if="tingTiles.length > 0"
                            class="absolute right-2 top-0 pointer-events-auto flex flex-col items-center gap-1 group z-[60]"
                            @click="showTingPreview = !showTingPreview">
                            <div :class="showTingPreview ? 'bg-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-blue-400/40 text-blue-300 border border-blue-400/50 backdrop-blur-md'"
                                class="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-lg animate-pulse">
                                <i class="fa-solid fa-lightbulb text-lg"></i>
                            </div>
                        </div>

                        <!-- 吃牌选择器 -->
                        <Transition name="fade">
                            <div v-if="showChiOptions"
                                class="absolute -top-24 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-xl p-3 rounded-2xl border-2 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.4)] flex flex-col gap-2 z-[70] items-center pointer-events-auto min-w-[200px]">
                                <div
                                    class="text-xs text-blue-400 font-black flex items-center gap-1 opacity-90 border-b border-white/10 pb-1 w-full justify-center">
                                    <span>请选择吃牌组合</span>
                                </div>
                                <div class="flex flex-wrap justify-center gap-2">
                                    <div v-for="(comb, idx) in chiOptions" :key="idx" @click="confirmChi(comb)"
                                        class="flex bg-white/10 p-2 rounded-xl hover:bg-white/20 active:bg-blue-500/30 active:scale-95 transition-all cursor-pointer border border-white/10 hover:border-blue-400 group gap-1 shadow-lg">
                                        <div v-for="t in comb" :key="t"
                                            class="mahjong-tile-small !w-[24px] !h-[34px] !text-[16px] shadow-sm transform group-hover:scale-105 transition-transform">
                                            <div class="tile-face-content" v-html="getTileFaceHTML(t)"></div>
                                        </div>
                                    </div>
                                </div>
                                <div @click="showChiOptions = false"
                                    class="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md cursor-pointer hover:scale-110 transition-transform">
                                    <i class="fa-solid fa-xmark text-xs"></i>
                                </div>
                            </div>
                        </Transition>

                        <!-- 出牌按钮 - 图片替换 -->
                        <div v-if="selectedTile !== null && isMyTurn"
                            class="z-50 pointer-events-auto absolute top-0 left-1/2 -translate-x-1/2">
                            <img src="/images/mahjong/麻将_出牌-按钮.png" @click="playSelectedTile"
                                class="w-20 h-auto cursor-pointer hover:scale-105 active:scale-95 transition-transform drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
                                alt="出牌" />
                        </div>

                        <!-- 当前回合提示 -->
                        <div v-if="isMyTurn && selectedTile === null"
                            class="animate-bounce absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none">
                            <div
                                class="bg-yellow-400 text-black px-3 py-1.5 rounded-full text-[11px] font-black shadow-lg border-2 border-white">
                                轮到你了！
                            </div>
                        </div>
                    </div>

                    <!-- 副牌和手牌展示区域 (合并为一个整体，使用固定间距) -->
                    <div class="flex flex-col items-center relative transition-all duration-300 mt-4">
                        <!-- 副牌展示区域 -->
                        <div class="flex items-center gap-1 px-1 min-h-[40px] transition-all mb-1"
                            v-if="getPlayer('south')?.exposed?.length">
                            <div v-for="(group, idx) in getPlayer('south').exposed" :key="idx"
                                class="flex bg-black/30 p-0.5 rounded shadow-inner scale-85 origin-left border border-white/10">
                                <div v-for="(tile, tIdx) in group.tiles" :key="tIdx"
                                    class="mahjong-tile-small !w-6 !h-9 !text-[16px]" :class="getTileColorClass(tile)">
                                    <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                                </div>
                            </div>
                        </div>

                        <!-- 改进后的听牌预览 (点击听按钮后显示) -->
                        <Transition name="fade">
                            <div v-if="showTingPreview && tingTiles.length > 0"
                                class="fixed bottom-32 right-4 bg-gray-900/90 backdrop-blur-xl p-3 px-4 rounded-2xl border-2 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.4)] z-[100] flex flex-col gap-2 min-w-[120px]">
                                <div class="text-[10px] text-yellow-400 font-black flex items-center justify-between">
                                    <div class="flex items-center gap-1">
                                        <i class="fa-solid fa-eye"></i> 听张 ({{ tingTiles.length }})
                                    </div>
                                    <div @click="showTingPreview = false"
                                        class="w-5 h-5 bg-white/10 rounded-full flex items-center justify-center text-[10px] cursor-pointer hover:bg-red-500/80 transition-all">
                                        <i class="fa-solid fa-xmark"></i>
                                    </div>
                                </div>
                                <div class="flex flex-wrap gap-2.5 max-w-[160px]">
                                    <div v-for="tile in tingTiles" :key="tile" class="flex flex-col items-center gap-1">
                                        <div class="mahjong-tile-small !w-7 !h-10 !text-[20px] bg-white shadow-md border border-gray-300"
                                            :class="getTileColorClass(tile)">
                                            <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                                        </div>
                                        <span
                                            class="text-[9px] text-white/50 font-black px-1.5 py-0.5 bg-white/5 rounded-md">
                                            {{ Math.max(0, 4 - (playedCardsMap[tile] || 0)) }}张
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Transition>

                        <!-- 手牌展示区域 -->
                        <div class="flex items-end w-full">
                            <!-- 手牌（立着显示或结算摊开） -->
                            <div class="flex items-end gap-0.5 relative w-full"
                                :class="{ 'justify-center': mahjongStore.gameState?.roundResult }"
                                :style="{ minHeight: '64px' }">
                                <!-- 排序好的主手牌 -->
                                <div v-for="item in displayedHand.main" :key="'main-' + item.i"
                                    @click="!mahjongStore.gameState?.roundResult && selectTile(item.i)" :class="[
                                        mahjongStore.gameState?.roundResult ? 'mahjong-tile-pool !w-10 !h-14 !text-[28px]' : 'mahjong-tile',
                                        { 'selected': selectedTile === item.i, 'disabled': !isMyTurn || mahjongStore.gameState?.roundResult },
                                        getTileColorClass(item.t),
                                        'transition-all duration-200'
                                    ]">
                                    <div class="tile-face-content" v-html="getTileFaceHTML(item.t)"></div>
                                </div>

                                <!-- 摸到的新牌 (单独靠右) -->
                                <div v-if="displayedHand.drawn"
                                    @click="!mahjongStore.gameState?.roundResult && selectTile(displayedHand.drawn.i)"
                                    :class="[
                                        mahjongStore.gameState?.roundResult ? 'mahjong-tile-pool !w-10 !h-14 !text-[28px]' : 'mahjong-tile',
                                        { 'selected': selectedTile === displayedHand.drawn.i, 'disabled': !isMyTurn || mahjongStore.gameState?.roundResult },
                                        getTileColorClass(displayedHand.drawn.t),
                                        'ml-3 transition-all duration-200 animate-slide-in'
                                    ]">
                                    <div class="tile-face-content" v-html="getTileFaceHTML(displayedHand.drawn.t)">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 玩家信息栏 (上移一点，避免挡着桌子边) -->
                    <div class="flex items-center gap-2 transition-all duration-300 z-10 mt-3 px-4">
                        <div class="relative transition-all duration-300"
                            :class="{ 'active-breathing': mahjongStore.gameState?.currentPlayer === 0 }">
                            <div v-if="isImageAvatar(getPlayer('south')?.avatar)"
                                class="w-12 h-12 rounded-full overflow-hidden shadow-lg border-2 border-white/20">
                                <img :src="getPlayer('south')?.avatar" class="w-full h-full object-cover" />
                            </div>
                            <div v-else
                                class="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-xl shadow-lg border-2 border-white/20">
                                {{ getPlayer('south')?.avatar || 'ME' }}
                            </div>
                            <div v-if="mahjongStore.gameState?.dealer === 0" class="dealer-icon"
                                style="width: 20px; height: 20px; font-size: 10px; top: -5px; right: -5px;">庄</div>
                        </div>
                        <div class="text-white text-xs">
                            <div class="font-bold">{{ getPlayer('south')?.name }}</div>
                            <div class="opacity-80">{{ getPlayer('south')?.beans }}豆 | 积分: {{ mahjongStore.score }}
                            </div>
                            <div class="opacity-80 text-blue-400">时长: {{ formatGameDuration(gameDuration) }}</div>
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



            <!-- 局内聊天记录面板 - 改为右侧悬浮三分之一 -->
            <Transition name="slide-right">
                <div v-if="isChatPanelVisible" @click.stop
                    class="absolute top-1/2 right-2 -translate-y-1/2 z-[60] flex flex-col 
                           w-[33%] min-w-[200px] max-w-[300px] h-[60%] max-h-[500px]
                           bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 p-3 shadow-blue-500/10">

                    <div class="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                        <h3 class="text-white text-xs font-bold flex items-center gap-1.5">
                            <i class="fa-solid fa-comments text-blue-400"></i> 局内对话
                        </h3>
                        <button @click="isChatPanelVisible = false"
                            class="text-white/40 hover:text-white transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="flex-1 overflow-y-auto space-y-2 mb-2 pr-1 scrollbar-none" id="chat-history">
                        <div v-for="(msg, i) in mahjongStore.gameChatMessages" :key="i"
                            :class="msg.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'">
                            <div class="text-[9px] text-white/40 mb-0.5 px-0.5">{{ msg.sender }}</div>
                            <div :class="msg.role === 'user' ? 'bg-blue-600/80 text-white rounded-xl rounded-tr-sm' : 'bg-white/10 text-gray-200 rounded-xl rounded-tl-sm'"
                                class="px-2.5 py-1.5 text-[10px] shadow-sm max-w-[95%] break-words border border-white/5 leading-tight">
                                {{ msg.content }}
                            </div>
                        </div>
                        <div v-if="isAiReplying"
                            class="flex gap-1.5 items-center text-blue-400/60 text-[10px] animate-pulse px-2">
                            <div class="flex gap-1">
                                <span class="w-1 h-1 bg-current rounded-full"></span>
                                <span class="w-1 h-1 bg-current rounded-full animation-delay-200"></span>
                                <span class="w-1 h-1 bg-current rounded-full animation-delay-400"></span>
                            </div>
                            <span>AI思考中...</span>
                        </div>
                    </div>

                    <div class="flex flex-col gap-3 bg-white/5 p-3 rounded-2xl">
                        <div class="flex gap-1">
                            <input v-model="chatInput" @keyup.enter="handleSendChat" placeholder="给TA们发消息..."
                                class="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-[11px] outline-none focus:border-blue-500/50 transition-colors" />
                        </div>
                        <button @click="handleSendChat"
                            class="w-full bg-blue-500/80 hover:bg-blue-600/80 text-white py-1.5 rounded-xl text-[11px] font-bold active:scale-95 transition-all shadow-lg shadow-blue-500/30">
                            发送
                        </button>
                        <div class="flex gap-1.5 justify-between">
                            <span v-for="quick in ['快点', '太巧了', '求牌']" :key="quick"
                                @click="chatInput = quick === '快点' ? '快点出牌啊' : quick === '太巧了' ? '这也太巧了吧' : '能不能让我一张'"
                                class="flex-1 text-center text-[9px] text-white/50 cursor-pointer hover:text-white hover:bg-white/10 bg-white/5 py-1 rounded-lg transition-colors border border-white/5">
                                {{ quick }}
                            </span>
                        </div>
                    </div>
                </div>
            </Transition>


            <!-- 记牌器组件 -->
            <Transition name="fade">
                <div v-if="showCardCounter" class="card-counter-panel scrollbar-hide">
                    <div class="text-[10px] text-white/50 text-center mb-1 w-full">剩余牌数</div>
                    <!-- 按花色分行 -->
                    <div class="flex flex-wrap justify-center gap-1 w-full pb-1 border-b border-white/5">
                        <div v-for="tile in ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9']" :key="tile"
                            class="counter-item">
                            <span class="counter-tile" :class="getTileColorClass(tile)">
                                <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                            </span>
                            <span class="counter-num">{{ 4 - (playedCardsMap[tile] || 0) }}</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap justify-center gap-1 w-full py-1 border-b border-white/5">
                        <div v-for="tile in ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']" :key="tile"
                            class="counter-item">
                            <span class="counter-tile" :class="getTileColorClass(tile)">
                                <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                            </span>
                            <span class="counter-num">{{ 4 - (playedCardsMap[tile] || 0) }}</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap justify-center gap-1 w-full py-1 border-b border-white/5">
                        <div v-for="tile in ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9']" :key="tile"
                            class="counter-item">
                            <span class="counter-tile" :class="getTileColorClass(tile)">
                                <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                            </span>
                            <span class="counter-num">{{ 4 - (playedCardsMap[tile] || 0) }}</span>
                        </div>
                    </div>
                    <div class="flex flex-wrap justify-center gap-1 w-full pt-1">
                        <div v-for="tile in ['east', 'south', 'west', 'north', 'red', 'green', 'white']" :key="tile"
                            class="counter-item">
                            <span class="counter-tile" :class="getTileColorClass(tile)">
                                <div class="tile-face-content" v-html="getTileFaceHTML(tile)"></div>
                            </span>
                            <span class="counter-num">{{ 4 - (playedCardsMap[tile] || 0) }}</span>
                        </div>
                    </div>
                </div>
            </Transition>

            <!-- 结算界面 -->
            <Transition name="fade">
                <div v-if="mahjongStore.gameState?.roundResult"
                    class="fixed inset-0 z-[100] flex items-center justify-center px-4 transition-all duration-500"
                    :class="showScoreCard ? 'bg-black/60 backdrop-blur-sm' : 'pointer-events-none'"
                    @click="showScoreCard = !showScoreCard">
                    <!-- 自适应结果卡片 -->
                    <Transition name="zoom">
                        <div v-if="showScoreCard"
                            class="bg-gradient-to-br from-amber-50 to-orange-100 w-full max-w-[min(90vw,400px)] rounded-[24px] overflow-hidden shadow-2xl border-2 border-amber-400 flex flex-col max-h-[90vh]"
                            :class="{ '!border-gray-400 !from-gray-100 !to-gray-200': mahjongStore.gameState.roundResult.type === '流局' }"
                            @click.stop>
                            <!-- 背景装饰 - 紧凑版 -->
                            <div class="relative p-3 text-center transition-all bg-gradient-to-r flex-shrink-0"
                                :class="mahjongStore.gameState.roundResult.type === '流局' ? 'from-gray-600 to-gray-700' : 'from-red-600 to-orange-600'">
                                <div class="text-3xl mb-0.5 animate-bounce">
                                    {{ mahjongStore.gameState.roundResult.type === '流局' ? '💨' : '🎉' }}
                                </div>
                                <h2 class="text-lg font-bold text-white mb-0.5 opacity-90 truncate px-4">
                                    {{ mahjongStore.gameState.roundResult.winner?.name || '四强争霸' }}
                                </h2>
                                <div class="text-2xl font-black drop-shadow-md leading-none"
                                    :class="mahjongStore.gameState.roundResult.type === '流局' ? 'text-gray-200' : 'text-yellow-300'">
                                    {{ mahjongStore.gameState.roundResult.type === '流局' ? '流局了' : '胡了！' }}
                                </div>
                                <div v-if="mahjongStore.gameState.roundResult.type !== '流局'"
                                    class="mt-1 inline-block px-2 py-0.5 bg-white/20 rounded-full text-white text-[10px] backdrop-blur-sm">
                                    {{ mahjongStore.gameState.roundResult.isZiMo ? '自摸' : '点炮' }}
                                </div>
                            </div>

                            <div class="p-3 space-y-2 overflow-y-auto custom-scrollbar flex-1">
                                <!-- 胡牌牌面显示 - 紧凑 (流局不显示) -->
                                <div v-if="mahjongStore.gameState.roundResult.winner"
                                    class="bg-blue-50/80 backdrop-blur-sm rounded-lg p-2 shadow-inner border border-blue-200/30">
                                    <div class="text-[10px] text-blue-700 mb-1 flex items-center justify-between">
                                        <div class="flex items-center gap-1">
                                            <span class="w-0.5 h-2.5 bg-blue-500 rounded-full"></span> 赢家牌面
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap gap-y-1 items-end justify-center">
                                        <!-- 已露出的牌 -->
                                        <div v-for="(group, idx) in mahjongStore.gameState.roundResult.winnerExposed"
                                            :key="'exp-' + idx"
                                            class="flex gap-[1px] bg-black/5 p-0.5 rounded mr-1 scale-90 origin-bottom border border-black/5">
                                            <div v-for="(t, ti) in group.tiles" :key="'ti-' + ti"
                                                class="mahjong-tile-small !w-5 !h-7 !text-xs !bg-white"
                                                :class="getTileColorClass(t)">
                                                <div class="tile-face-content" v-html="getTileFaceHTML(t)"></div>
                                            </div>
                                        </div>
                                        <!-- 剩余手牌 -->
                                        <div class="flex gap-[1px]">
                                            <div v-for="(t, i) in mahjongStore.gameState.roundResult.winnerHand"
                                                :key="'hand-' + i"
                                                class="mahjong-tile-small !w-5 !h-7 !text-xs !bg-white"
                                                :class="getTileColorClass(t)">
                                                <div class="tile-face-content" v-html="getTileFaceHTML(t)"></div>
                                            </div>
                                        </div>
                                        <!-- 胡的那张牌 -->
                                        <div v-if="mahjongStore.gameState.roundResult.winningTile"
                                            class="mahjong-tile-small !w-6 !h-8 !text-base bg-yellow-50 border border-yellow-400 ml-2 shadow-[0_0_10px_rgba(251,191,36,0.8)] flex items-center justify-center animate-pulse"
                                            :class="getTileColorClass(mahjongStore.gameState.roundResult.winningTile)">
                                            <div class="tile-face-content"
                                                v-html="getTileFaceHTML(mahjongStore.gameState.roundResult.winningTile)">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- 番数信息 - 紧凑横向 -->
                                <div
                                    class="bg-blue-50/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-blue-300/30 flex items-center justify-between">
                                    <div class="flex flex-col items-start">
                                        <span class="text-[10px] text-blue-600">牌型</span>
                                        <span class="text-base font-bold text-blue-700 leading-tight">{{
                                            mahjongStore.gameState.roundResult.type }}</span>
                                    </div>
                                    <div class="h-6 w-[1px] bg-blue-300/50 mx-2"></div>
                                    <div class="flex flex-col items-center">
                                        <span class="text-[10px] text-blue-600">时长</span>
                                        <span class="text-lg font-black text-blue-600 font-serif leading-tight">{{
                                            formatGameDuration(gameDuration) }}</span>
                                    </div>
                                    <div class="h-6 w-[1px] bg-blue-300/50 mx-2"></div>
                                    <div class="flex flex-col items-end">
                                        <span class="text-[10px] text-blue-600">番数</span>
                                        <span class="text-lg font-black text-blue-700 font-serif leading-tight">{{
                                            mahjongStore.gameState.roundResult.fan }}番</span>
                                    </div>
                                </div>

                                <!-- 积分变动列表 - 极简 -->
                                <div class="space-y-1.5">
                                    <div v-for="change in mahjongStore.gameState.roundResult.changes" :key="change.name"
                                        class="flex justify-between items-center bg-white/60 rounded px-3 py-1.5 border"
                                        :class="change.isPao || (!mahjongStore.gameState.roundResult.isZiMo && change.amount < 0 && mahjongStore.gameState.roundResult.type !== '流局') ? 'border-orange-500/50 bg-orange-50/50' : 'border-transparent'">
                                        <div class="flex items-center gap-2 min-w-0">
                                            <!-- min-w-0 for truncate -->
                                            <div class="flex gap-1 shrink-0">
                                                <span class="text-[9px] px-1 py-0.5 bg-red-500 text-white rounded-[2px]"
                                                    v-if="change.isWinner">赢</span>
                                                <span
                                                    class="text-[9px] px-1 py-0.5 bg-gray-600 text-white rounded-[2px]"
                                                    v-else>{{ getPlayerRelation(change.idx) }}</span>
                                                <span
                                                    class="text-[9px] px-1 py-0.5 bg-orange-500 text-white rounded-[2px]"
                                                    v-if="change.isPao || (!mahjongStore.gameState.roundResult.isZiMo && change.amount < 0 && mahjongStore.gameState.roundResult.type !== '流局')">炮</span>
                                            </div>
                                            <span class="font-bold text-sm text-gray-800 truncate">{{ change.name
                                                }}</span>
                                        </div>
                                        <span class="font-bold text-sm shrink-0"
                                            :class="change.amount > 0 ? 'text-green-600' : 'text-red-500'">
                                            {{ change.amount > 0 ? '+' : '' }}{{ change.amount }}
                                        </span>
                                    </div>
                                </div>

                                <!-- 按钮区域 - 紧凑 -->
                                <div class="mt-2 pt-2 border-t border-amber-200">
                                    <div class="flex gap-2">
                                        <button
                                            @click.stop="mahjongStore.exitRoom(); router.push('/games/mahjong-lobby')"
                                            class="flex-[0.8] bg-white border border-gray-300 text-gray-600 py-2.5 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all">
                                            退出
                                        </button>
                                        <button @click.stop="showContactPicker = true"
                                            class="flex-1 bg-white border border-amber-300 text-amber-600 py-2.5 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1">
                                            <i class="fa-solid fa-share-nodes"></i> 分享
                                        </button>
                                        <button @click.stop="handleRoundEnd"
                                            class="flex-[1.5] bg-gradient-to-r from-red-500 to-orange-500 text-white py-2.5 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all">
                                            <i class="fa-solid fa-play mr-1"></i> 下一局
                                        </button>
                                    </div>
                                    <div class="text-center mt-1 text-[9px] text-gray-400 font-medium">点击任意空白处可先看摊牌
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Transition>

                    <!-- 隐藏卡片后的透明交互层 (方便查看桌面) -->
                    <div v-if="!showScoreCard"
                        class="fixed inset-0 z-[80] flex flex-col items-center justify-center pointer-events-auto cursor-pointer"
                        @click.stop="showScoreCard = true">
                        <div
                            class="mt-auto mb-10 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full text-white/80 text-xs font-bold animate-pulse border border-white/10 shadow-lg">
                            点击屏幕任意位置返回结算单
                        </div>
                    </div>
                </div>
            </Transition>

            <!-- 动作特效文字 -->
            <Transition name="action-pop">
                <div v-if="actionText"
                    class="fixed inset-0 z-[150] flex flex-col items-center justify-center pointer-events-none bg-blue-500/10 backdrop-blur-[1px]">
                    <!-- 全屏特效贴图 -->
                    <div class="relative w-full h-full flex items-center justify-center animate-scale-up-bounce">
                        <img v-if="actionType === 'hu'" src="/images/mahjong/胡-全屏.png"
                            class="w-[90vw] max-w-[600px] object-contain drop-shadow-[0_0_50px_rgba(255,0,0,0.8)] animate-pulse-fast" />
                        <img v-else-if="actionType === 'gang'" src="/images/mahjong/杠-全屏.png"
                            class="w-[80vw] max-w-[500px] object-contain drop-shadow-[0_0_30px_rgba(255,255,0,0.6)]" />
                        <img v-else-if="actionType === 'peng'" src="/images/mahjong/碰-全屏.png"
                            class="w-[80vw] max-w-[500px] object-contain drop-shadow-[0_0_30px_rgba(0,0,255,0.6)]" />
                        <img v-else-if="actionType === 'chi'" src="/images/mahjong/吃-全屏.png"
                            class="w-[80vw] max-w-[500px] object-contain drop-shadow-[0_0_30px_rgba(0,255,0,0.6)]" />

                        <!-- 兜底文字显示 (以防图片加载失败或未知类型) -->
                        <div v-if="!['hu', 'gang', 'peng', 'chi'].includes(actionType)"
                            class="text-6xl font-black text-white drop-shadow-[0_0_10px_rgba(0,0,0,1)] stroke-2 stroke-black">
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
                <div v-if="mahjongStore.cheatMode"
                    class="fixed top-[44px] inset-x-0 bottom-0 bg-blue-500/30 backdrop-blur-md z-[110] overflow-y-auto"
                    @click="mahjongStore.cheatMode = false">
                    <div class="p-6 max-w-lg mx-auto">
                        <h2
                            class="text-blue-400 text-xl font-black mb-6 text-center flex items-center justify-center gap-2">
                            <i class="fa-solid fa-eye"></i> 偷窥模式
                        </h2>
                        <div v-for="player in otherPlayers" :key="player.id"
                            class="mb-6 bg-white/5 p-4 rounded-2xl border border-white/10">
                            <div class="text-white text-sm font-bold mb-3 flex items-center gap-2">
                                <span class="bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[10px]">{{
                                    getPlayerRelation(mahjongStore.currentRoom?.players?.indexOf(player)) }}</span>
                                {{ player.name }}
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                                <div v-for="(tile, i) in player.hand" :key="i" class="mahjong-tile-small !bg-[#f9f9f7]"
                                    :class="getTileColorClass(tile)">
                                    <span>{{ getTileEmoji(tile) }}</span>
                                </div>
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

            <!-- 分享选择器 -->
            <Transition name="fade">
                <div v-if="showContactPicker"
                    class="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm"
                    @click="showContactPicker = false">
                    <div class="w-full max-w-[500px] bg-gray-100 rounded-t-[32px] flex flex-col max-h-[70vh] animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.3)]"
                        @click.stop>
                        <div
                            class="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-[32px]">
                            <h3 class="font-bold text-gray-800">发送给...</h3>
                            <button @click="showContactPicker = false" class="text-gray-400 p-2"><i
                                    class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                            <div v-for="contact in contactListForSharing" :key="contact.id"
                                @click="handleShareResult(contact.id)"
                                class="flex items-center gap-4 bg-white p-3 rounded-2xl hover:bg-blue-50 active:scale-98 transition-all cursor-pointer border border-gray-100 shadow-sm">
                                <img :src="contact.avatar"
                                    class="w-12 h-12 rounded-xl object-cover border border-gray-100 shadow-inner" />
                                <div class="flex-1">
                                    <div class="font-bold text-gray-800">{{ contact.name }}</div>
                                    <div class="text-xs text-gray-500">{{ contact.remark || contact.signature ||
                                        '在这个世界与你相遇' }}</div>
                                </div>
                                <i
                                    class="fa-solid fa-paper-plane text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </div>
                            <div v-if="!contactListForSharing?.length" class="text-center py-10 text-gray-400">
                                <i class="fa-solid fa-user-slash text-4xl mb-2 opacity-20"></i>
                                <p class="text-sm">暂无联系人可分享</p>
                            </div>
                        </div>
                        <div class="p-5 pb-safe-area bg-white border-t border-gray-100">
                            <button @click="showContactPicker = false"
                                class="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">取消</button>
                        </div>
                    </div>
                </div>
            </Transition>

            <!-- 背景音乐 (换成本地拟真 BGM) -->
            <audio v-if="mahjongStore.bgmEnabled" id="bgm-audio" autoplay loop hidden
                src="/sounds/mahjong/打麻将全局背景音乐.MP3" :volume="mahjongStore.bgmVolume"></audio>

            <!-- 自定义确认弹窗 -->
            <div v-if="showConfirmModal"
                class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div class="bg-white rounded-2xl p-6 max-w-[300px] w-full shadow-2xl">
                    <h3 class="text-lg font-bold text-center mb-4 text-gray-800">{{ confirmModal.title }}</h3>
                    <p class="text-center text-gray-600 mb-6">{{ confirmModal.message }}</p>
                    <div class="flex gap-3">
                        <button @click="confirmModal.onCancel()"
                            class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm active:scale-95 transition-all">
                            {{ confirmModal.cancelText || '取消' }}
                        </button>
                        <button @click="confirmModal.onConfirm()"
                            class="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all">
                            {{ confirmModal.confirmText || '确认' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>


<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMahjongStore } from '../../stores/mahjongStore.js'
import { useChatStore } from '../../stores/chatStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import mahjongEngine from '../../utils/mahjong/MahjongEngine.js'

const router = useRouter()
const mahjongStore = useMahjongStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const contactListForSharing = computed(() => chatStore.contactList || [])

const actionType = ref('') // 动作类型
const actionText = ref('') // 动作文字内容
const showCardCounter = ref(false) // 是否显示记牌器

// --- 新功能：精细化样式管理 ---
const mainGameStyles = computed(() => {
    const styles = { ...tileBackStyles.value }
    if (mahjongStore.tablecloth) {
        styles.backgroundImage = `url(${mahjongStore.tablecloth})`
        styles.backgroundSize = 'cover'
        styles.backgroundPosition = 'center'
    }
    return styles
})

const tileBackStyles = computed(() => {
    const back = mahjongStore.currentTileBack
    if (back.type === 'color') {
        const p = back.value
        // 简单生成辅助色（略深/略浅）
        return {
            '--tile-back-primary': p,
            '--tile-back-secondary': p, // 这里可以加算法，暂时简化
            '--tile-back-shadow': '#00000044',
            '--tile-back-image': 'none'
        }
    } else {
        return {
            '--tile-back-primary': 'transparent',
            '--tile-back-secondary': 'transparent',
            '--tile-back-shadow': 'rgba(0,0,0,0.3)',
            '--tile-back-image': `url(${back.value})`
        }
    }
})

// 颜色池
const TILE_BACK_COLORS = [
    { p: '#10b981', s: '#059669', sh: '#047857' }, // 绿
    { p: '#3b82f6', s: '#2563eb', sh: '#1e40af' }, // 蓝
    { p: '#f59e0b', s: '#d97706', sh: '#b45309' }, // 金
    { p: '#a855f7', s: '#9333ea', sh: '#7e22ce' }, // 紫
    { p: '#ea580c', s: '#c2410c', sh: '#9a3412' } // 橙
]

// 移除原有的随机逻辑，改为使用 store 的配置
const randomTileBackColor = () => { }

// 辅助计算：当前桌面/手中已出现的牌（用于记牌器）
const playedCardsMap = computed(() => {
    const counts = {}
    if (!mahjongStore.gameState) return counts

    // 牌池
    mahjongStore.gameState.pool.forEach(t => counts[t] = (counts[t] || 0) + 1)

    // 各家明牌
    mahjongStore.currentRoom?.players?.forEach(p => {
        p.exposed.forEach(group => {
            group.tiles.forEach(t => counts[t] = (counts[t] || 0) + 1)
        })
    })

    // 我的手牌
    const myHand = mahjongStore.currentRoom?.players?.[0]?.hand || []
    myHand.forEach(t => counts[t] = (counts[t] || 0) + 1)

    return counts
})

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


const handleExit = () => {
    confirmModal.value = {
        title: '结束对局',
        message: '确定要结束对局吗？进度将不会保存。',
        confirmText: '确认',
        cancelText: '取消',
        onConfirm: () => {
            // 发送游戏结束通知
            sendGameEndNotification()
            mahjongStore.exitRoom()
            router.push('/games/mahjong-lobby')
            showConfirmModal.value = false
        },
        onCancel: () => {
            showConfirmModal.value = false
        }
    }
    showConfirmModal.value = true
}

const onNavbarBack = () => {
    handleExit()
}

const handleMinimize = () => {
    // 最小化到游戏中心 (挂在后台)
    router.push('/games')
}

const selectedTile = ref(null)
const canChi = ref(false)
const canPeng = ref(false)
const canGang = ref(false)
const canHu = ref(false)
const canTing = computed(() => tingTiles.value.length > 0)
const chiOptions = ref([])
const showChiOptions = ref(false)
const tingTiles = ref([])
const showTingPreview = ref(false) // 点击听按钮显示预览
const showTingHelp = ref(false) // 选牌时的听牌提示
const showScoreCard = ref(false) // 结果卡片展示状态

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
const activeTile = ref(null)
const playingTilePos = ref('south')
const isChatPanelVisible = ref(false)
const chatInput = ref('')
const isAiReplying = ref(false)
const hasNewMsg = ref(false)
const showSettings = ref(false)
const showContactPicker = ref(false) // 分享选择器开关

// 本局时长计时器
const gameStartTime = ref(mahjongStore.gameState?.gameStartTime || null)
const gameDuration = ref(mahjongStore.gameState?.gameDuration || 0) // 单位：秒
const gameTimer = ref(null)

// 自定义确认弹窗
const showConfirmModal = ref(false)
const confirmModal = ref({
    title: '',
    message: '',
    confirmText: '确认',
    cancelText: '取消',
    onConfirm: () => { },
    onCancel: () => { }
})

// 分享到通讯录
const handleShareResult = async (chatId) => {
    const chatStore = useChatStore()
    const result = mahjongStore.gameState.roundResult
    if (!result) return

    // 构建一份精美的麻将结算卡片 (HTML 格式)
    const isWin = result.winner.id === 'user'
    const title = isWin ? '🀄️ 清账啦！大获全胜！' : '🀄️ 输麻了... 技不如人'
    const color = isWin ? '#ef4444' : '#6b7280'
    const bgColor = isWin ? '#fff3f4' : '#f9fafb'
    const emoji = isWin ? '🔥' : '☁️'

    const htmlContent = `
<div style="background: ${bgColor}; border-radius: 16px; border: 2px solid ${color}55; padding: 16px; font-family: system-ui; overflow: visible; box-shadow: 0 4px 12px rgba(0,0,0,0.1); min-height: 200px; height: auto; word-break: break-word; overflow-wrap: break-word;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-weight: 800; color: ${color}; font-size: 14px;">${title}</span>
        <span style="font-size: 10px; color: ${color}aa;">${new Date().toLocaleTimeString()}</span>
    </div>
    <div style="background: white; border-radius: 12px; padding: 12px; margin-bottom: 12px; border: 1px solid ${color}22; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">本局结算：${result.type} (${result.fan}番)</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <div style="font-size: 20px; font-weight: 900; color: ${isWin ? '#e11d48' : '#333'};">
                ${isWin ? '+' : ''}${result.changes.find(c => c.isWinner)?.amount || 0} 豆
            </div>
            <div style="font-size: 12px; font-weight: 600; color: #3b82f6;">
                时长：${formatGameDuration(gameDuration.value)}
            </div>
        </div>
    </div>
    <div style="display: flex; gap: 4px; font-size: 16px; opacity: 0.9; flex-wrap: wrap; margin-bottom: 12px;">
        ${result.winnerHand.map(t => getTileEmoji(t)).join('')}
        <span style="color: ${color}; font-weight: bold; margin-left: 4px;">${getTileEmoji(result.winningTile)}</span>
    </div>
    <div style="margin-top: 8px; font-size: 10px; color: ${color}99; text-align: right; margin-bottom: 8px;">— 雀神争霸赛 —</div>
    <div style="margin-top: 8px; font-size: 10px; color: #9ca3af; text-align: left; line-height: 1.5; padding: 8px; background: rgba(255,255,255,0.8); border-radius: 8px;">
        ${result.changes.map(change => `${change.name}: ${change.amount > 0 ? '+' : ''}${change.amount}豆`).join('<br>')}
    </div>
</div>
`.trim()

    try {
        await chatStore.addMessage(chatId, {
            role: 'user',
            content: `[CARD]${htmlContent}[/CARD]`,
            timestamp: Date.now()
        })
        chatStore.triggerToast('已成功分享到聊天', 'success')
        showContactPicker.value = false
    } catch (e) {
        console.error('分享失败:', e)
        chatStore.triggerToast('分享失败', 'error')
    }
}

const danmakuList = ref([]) // 弹幕列表

const addDanmaku = (text, sender, isSelf = false) => {
    if (!text) return
    const id = Date.now() + Math.random()
    // random top but avoid extreme top/bottom overlap
    const top = 15 + Math.random() * 50
    const duration = 10 + Math.random() * 4 // Slower for better readability
    const color = isSelf ? '#60a5fa' : '#fbbf24' // Blue / Amber

    let avatar = null
    const player = mahjongStore.currentRoom?.players?.find(p => p.name === sender)
    if (player) avatar = player.avatar

    danmakuList.value.push({
        id, text, sender, top, duration, color, isSelf, avatar
    })

    // Clean up
    setTimeout(() => {
        danmakuList.value = danmakuList.value.filter(d => d.id !== id)
    }, duration * 1000 + 100)
}

const tileNames = {
    'w1': '一万', 'w2': '二万', 'w3': '三万', 'w4': '四万', 'w5': '五万', 'w6': '六万', 'w7': '七万', 'w8': '八万', 'w9': '九万',
    't1': '一条', 't2': '二条', 't3': '三条', 't4': '四条', 't5': '五条', 't6': '六条', 't7': '七条', 't8': '八条', 't9': '九条',
    'b1': '一筒', 'b2': '二筒', 'b3': '三筒', 'b4': '四筒', 'b5': '五筒', 'b6': '六筒', 'b7': '七筒', 'b8': '八筒', 'b9': '九筒',
    'east': '东风', 'south': '南风', 'west': '西风', 'north': '北风',
    'red': '红中', 'green': '发财', 'white': '白板'
}

// 全局语音缓存，避免重复生成相同的牌名语音，大幅提升响应速度
const ttsCache = new Map();

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
        'chi': '/sounds/mahjong/我方吃牌语音great.MP3',
        'peng': '/sounds/mahjong/我方碰牌语音good.MP3',
        'gang': '/sounds/mahjong/我方杠牌语音unbelievable.MP3',
        'hu': '/sounds/mahjong/我方胡牌庆祝bgm.MP3',
        'lose': '/sounds/mahjong/非己方胡牌失败音效.MP3',
        'action_bg': '/sounds/mahjong/所有吃、碰、杠背景音效.MP3'
    }

    const audioUrl = soundFiles[name]
    if (audioUrl) {
        const audio = new Audio(audioUrl)
        audio.volume = mahjongStore.sfxVolume
        audio.play().catch((e) => { console.warn('SFX Error:', name, e) })
    }
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

    return mahjongStore.currentRoom?.players?.[mapping[position]]
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

// 打出选中的牌
const playSelectedTile = () => {
    if (selectedTile.value === null) return
    const myHand = getPlayer('south')?.hand || []
    const tile = myHand[selectedTile.value]

    // 播放出牌音效
    playSfx('play')

    // 显示放大预览
    activeTile.value = tile
    playingTilePos.value = 'south'

    // 800ms后关闭预览 (改为先设置定时器)
    const timeoutCard = tile
    setTimeout(() => {
        if (activeTile.value === timeoutCard) {
            activeTile.value = null
        }
    }, 800)

    try {
        // 执行打牌
        mahjongStore.playTile(selectedTile.value)
    } catch (err) {
        console.error('打牌失败:', err)
    } finally {
        // 无论成功失败都清空选中状态
        selectedTile.value = null
        showTingHelp.value = false // 打牌后关闭辅助提示
        showTingPreview.value = false // 打牌后关闭预览
    }
}

// 选择牌
const selectTile = (index) => {
    if (!isMyTurn.value) return
    const isSame = selectedTile.value === index
    if (isSame) {
        // Double click to play (Better UX)
        playSelectedTile()
    } else {
        selectedTile.value = index
        playSfx('select')
    }
}


// 判断是否为图片头像
const isImageAvatar = (avatar) => {
    if (!avatar) return false
    return avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http')
}

// 获取玩家相对于我的关系
const getPlayerRelation = (index) => {
    // 基础修复：防止 undefined 引发的"旁观"
    if (index === undefined || index === null) return '玩家'
    if (index === 0) return '我'

    // 如果 index 是 user id (字符串)，尝试转换
    if (typeof index === 'string' && index === 'user') return '我'

    // 0: 我 (南), 1: 下家 (东), 2: 对家 (北), 3: 上家 (西)
    const relations = ['我', '下家', '对家', '上家']
    return relations[index] || '玩家'
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
        // 游戏结束，停止计时器
        stopGameTimer()

        // 只有当有胜利者时才播放胡牌特效
        if (newVal.winner && newVal.type !== '流局') {
            const winnerIdx = mahjongStore.currentRoom?.players?.findIndex(p => p.name === newVal.winner.name)

            // 播放胜负音效
            if (winnerIdx === 0) {
                playSfx('hu') // 我方胡牌 BGM
            } else {
                playSfx('lose') // 别人胡牌失败音效
            }

            // 确保播放胡牌语音 (防止 lastAction 监听未触发)
            speak('hu', winnerIdx)

            // 延长等待时间到 3.5 秒，让摊牌和“胡”字特效展示完整
            setTimeout(() => {
                showScoreCard.value = true
            }, 3500)
        } else if (newVal.type === '流局') {
            // 流局特殊处理
            triggerActionEffect('流局', 'liuju')
            playSfx('lose') // 或者专门的流局音效
            // 说话
            speak('流局了', 0)

            // 流局稍微快一点出结果
            setTimeout(() => {
                showScoreCard.value = true
            }, 2000)
        }
    }
})


// 听牌按钮点击
const handleTingClick = () => {
    // 简单实现：切换听牌助手显示，并提示
    if (!canTing.value) return
    showTingHelp.value = !showTingHelp.value
    if (showTingHelp.value) {
        triggerActionEffect('请选择出牌', 'ting')
    }
}

// 监听 selections，看打这张牌听什么
watch(selectedTile, (newIdx) => {
    if (newIdx !== null && isMyTurn.value) {
        const myHand = [...(getPlayer('south')?.hand || [])]
        // 模拟打出这张牌
        const tempHand = myHand.filter((_, i) => i !== newIdx)
        // 检查听口
        const waits = mahjongEngine.getTingPai(tempHand)
        if (waits.length > 0) {
            tingTiles.value = waits
            showTingHelp.value = true
        } else {
            showTingHelp.value = false
        }
    } else {
        // 取消选择时隐藏
        // showTingHelp.value = false
    }
})
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
        // 移除重复的 speak 调用，统一由 watch(lastAction) 处理
        // speak(action, 0)
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

// 获取牌的图形数据 (取代 Emoji 系列)
const getTileGraphics = (tile) => {
    if (!tile) return null;
    const type = tile[0];
    const num = parseInt(tile[1]);
    const colors = { red: '#e11d48', green: '#16a34a', blue: '#2563eb', black: '#1f2937', gold: '#d97706' };

    const winds = { 'east': '東', 'south': '南', 'west': '西', 'north': '北' };
    if (winds[tile]) return { type: 'char', text: winds[tile], color: colors.black };
    if (tile === 'red') return { type: 'char', text: '中', color: colors.red };
    if (tile === 'green') return { type: 'char', text: '發', color: colors.green };
    if (tile === 'white') return { type: 'white', color: colors.blue };

    const nums = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (type === 'w') return { type: 'wan', top: nums[num], bottom: '萬', color: colors.red };

    const dotPos = {
        1: [[5, 5]],
        2: [[3, 3], [7, 7]],
        3: [[2.5, 2.5], [5, 5], [7.5, 7.5]],
        4: [[3, 3], [7, 3], [3, 7], [7, 7]],
        5: [[2.5, 2.5], [7.5, 2.5], [5, 5], [2.5, 7.5], [7.5, 7.5]],
        6: [[3, 2.5], [7, 2.5], [3, 5], [7, 5], [3, 7.5], [7, 7.5]],
        7: [[2.2, 2.2], [5, 3.5], [7.8, 4.8], [3, 7.2], [7, 7.2], [3, 9], [7, 9]], // 斜3下4
        8: [[3, 1.8], [7, 1.8], [3, 3.8], [7, 3.8], [3, 5.8], [7, 5.8], [3, 7.8], [7, 7.8]],
        9: [[2.5, 2], [5, 2], [7.5, 2], [2.5, 5], [5, 5], [7.5, 5], [2.5, 8], [5, 8], [7.5, 8]]
    };
    if (type === 'b') {
        const dots = (dotPos[num] || []).map((p, i) => ({
            x: p[0] * 10, y: p[1] * 10,
            color: num === 1 ? colors.red : (i < (num > 6 ? 3 : 0) ? colors.red : (i % 3 === 0 ? colors.blue : (i % 2 === 0 ? colors.green : colors.red)))
        }));
        // 修正 7 筒颜色：上 3 红，下 4 (2 绿 2 蓝)
        if (num === 7) {
            dots[0].color = colors.red; dots[1].color = colors.red; dots[2].color = colors.red;
            dots[3].color = colors.green; dots[4].color = colors.blue;
            dots[5].color = colors.green; dots[6].color = colors.blue;
        }
        return { type: 'dots', items: dots, special: num === 1 };
    }

    if (type === 't') {
        if (num === 1) return { type: 'bird', color: colors.green };
        const bamPos = {
            2: [[5, 3], [5, 7]],
            3: [[5, 2.5], [3, 7.5], [7, 7.5]],
            4: [[3, 3], [7, 3], [3, 7], [7, 7]],
            5: [[5, 5], [2.5, 2.5], [7.5, 2.5], [2.5, 7.5], [7.5, 7.5]],
            6: [[3, 3], [7, 3], [3, 7], [7, 7], [3, 5], [7, 5]], // 重新排序以便按行着色
            7: [[5, 1.5], [3, 4.5], [7, 4.5], [3, 7], [7, 7], [3, 9.5], [7, 9.5]],
            8: [[3, 2], [7, 2], [3, 4.5], [7, 4.5], [3, 7], [7, 7], [3, 9.5], [7, 9.5]],
            9: [[2.5, 2.3], [5, 2.3], [7.5, 2.3], [2.5, 5], [5, 5], [7.5, 5], [2.5, 7.7], [5, 7.7], [7.5, 7.7]]
        };
        const bams = (bamPos[num] || []).map((p, i) => {
            let color = colors.green;
            const y = p[1];
            // 按行配色逻辑：首行绿，次行红，末行蓝
            if (y < 4) color = colors.green;
            else if (y < 7) color = colors.red;
            else color = colors.blue;

            return { x: p[0] * 10, y: p[1] * 10, color };
        });
        return { type: 'bams', items: bams };
    }
    return null;
}

const getTileFaceHTML = (tile) => {
    const emoji = getTileEmoji(tile);
    return `<span class="tile-emoji">${emoji}</span>`;
}

// 获取牌的emoji (保留用于分享)
const getTileEmoji = (tile) => {
    const emojiMap = {
        'w1': '🀇', 'w2': '🀈', 'w3': '🀉', 'w4': '🀊', 'w5': '🀋',
        'w6': '🀌', 'w7': '🀍', 'w8': '🀎', 'w9': '🀏',
        't1': '🀐', 't2': '🀑', 't3': '🀒', 't4': '🀓', 't5': '🀔',
        't6': '🀕', 't7': '🀖', 't8': '🀗', 't9': '🀘',
        'b1': '🀙', 'b2': '🀚', 'b3': '🀛', 'b4': '🀜', 'b5': '🀝',
        'b6': '🀞', 'b7': '🀟', 'b8': '🀠', 'b9': '🀡',
        'east': '🀀', 'south': '🀁', 'west': '🀂', 'north': '🀃',
        'red': '🀄', 'green': '🀅', 'white': '🀆'
    }
    return emojiMap[tile] || '🀫'
}

// 获取牌的花色样式
const getTileColorClass = (tile) => {
    if (!tile) return ''
    if (tile.startsWith('w')) return 'tile-red'
    if (tile.startsWith('t')) return 'tile-green'
    if (tile.startsWith('b')) return 'tile-blue'
    if (tile === 'red') return 'tile-red'
    if (tile === 'green') return 'tile-green'
    if (tile === 'white') return 'tile-blue'
    return ''
}

// 监听动作特效
watch(() => mahjongStore.lastAction, (action) => {
    if (action && action.type) {
        const textMap = {
            'chi': '吃',
            'peng': '碰',
            'gang': '杠',
            'hu': '胡',
            'play': '打牌', // 虽然不显示文字特效，但需要触发语音
            'chat': '聊天'  // 触发 AI 回复语音
        }
        if (textMap[action.type]) {
            if (['chi', 'peng', 'gang', 'hu'].includes(action.type)) {
                triggerActionEffect(textMap[action.type], action.type)
            }

            const playerIdx = action.playerIndex !== undefined ? action.playerIndex : mahjongStore.gameState?.lastPlayer

            // 播报语音
            if (action.type === 'chat') {
                speak(action.text, playerIdx)
            } else {
                speak(action.type, playerIdx)
            }

            // 音效逻辑区分：
            if (playerIdx === 0 && ['chi', 'peng', 'gang', 'hu'].includes(action.type)) {
                playSfx(action.type)
            } else if (action.type === 'play') {
                playSfx('play')
            } else if (['chi', 'peng', 'gang'].includes(action.type)) {
                playSfx('action_bg')
            }
        }
    }
})

const isVolcVoice = (id) => {
    if (!id) return true
    return id.startsWith('tts.other.BV') || id.startsWith('ICL_') ||
        [
            'zh_male_rap', 'zh_female_zhubo', 'zh_male_xiaoming', 'zh_female_qingxin', 'zh_female_story',
            'zh_female_sichuan', 'zh_male_zhubo',
            'en_male_adam', 'en_male_bob', 'en_female_sarah',
            'jp_male_satoshi', 'jp_female_mai', 'kr_male_gye',
            'es_male_george', 'pt_female_alice', 'de_female_sophie', 'fr_male_enzo', 'id_female_noor',
            'zh_male_lengkugege_emo_v2_mars_bigtts'
        ].includes(id);
}

const generateId = () => {
    return Math.floor(Math.random() * 1000000000).toString()
}

// 语音播报
const speak = async (actionType, playerIndex) => {
    // 0. 基础开关检查
    if (!mahjongStore.soundEnabled) return;

    // 1. 确定说话的角色
    const currentRoom = mahjongStore.currentRoom
    const player = currentRoom?.players?.[playerIndex || 0];
    const isMe = playerIndex === 0;

    // 2. 确定台词内容
    let text = '';
    const gender = player?.gender || '女';

    switch (actionType) {
        case 'chi': text = '吃！'; break;
        case 'peng': text = '碰！'; break;
        case 'gang': text = '杠！'; break;
        case 'play':
            if (tileNames[mahjongStore.gameState?.currentTile]) {
                text = tileNames[mahjongStore.gameState.currentTile];
            }
            break;
        case 'hu':
        case 'zimo':
            const winType = mahjongStore.gameState?.roundResult?.type || '平胡';
            const prefix = actionType === 'zimo' ? '自摸！' : '胡了！';
            text = winType === '平胡' ? prefix : `${prefix} ${winType}！`;
            break;
        default:
            if (tileNames[actionType]) {
                text = tileNames[actionType];
            } else if (getTileEmoji(actionType) !== '🀫') {
                return;
            } else {
                text = actionType;
            }
    }

    if (!text) return

    // 3. 执行 TTS
    const voiceConfig = settingsStore.voice || {};
    let engine = voiceConfig.engine || 'browser';
    let speakerId = '';
    let cookie = voiceConfig.doubao?.cookie || '';

    if (isMe) {
        if (engine === 'bdetts') {
            speakerId = voiceConfig.bdetts?.speaker || 'wen-yi-nv-sheng';
        } else {
            // 用户：默认使用四川姐姐，除非后续增加了麻将特定的个人语音设置
            speakerId = 'zh_female_sichuan';
        }
    } else {
        // AI 玩家：使用角色特定设置或随机分配的豆包语音
        if (engine === 'doubao' || engine === 'volc_paid') {
            speakerId = player?.doubaoSpeaker || 'zh_female_sichuan';
        } else if (engine === 'bdetts') {
            speakerId = player?.bdettsSpeaker || 'nuan-xin-jie-jie';
        } else if (engine === 'minimax') {
            speakerId = player?.voiceId || '';
            if (!speakerId) {
                engine = 'browser';
            }
        }
    }

    console.log(`[Mahjong-TTS] ${player?.name || '未知'} 说话: "${text}" 引擎: ${engine} ID: ${speakerId}`);

    const cacheKey = `${speakerId}_${text}`;
    if (ttsCache.has(cacheKey)) {
        console.log(`[Mahjong-TTS] 使用缓存语音: ${text}`);
        const audio = new Audio(ttsCache.get(cacheKey));
        audio.playbackRate = 1.3;
        audio.play().catch(() => { });
        return;
    }

    if (engine === 'browser' || !speakerId) {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(text);
        u.rate = isMe ? (voiceConfig.speed || 1.1) : 1.3;
        if (!isMe) {
            u.pitch = gender === '男' ? 0.8 : 1.2;
            const voices = window.speechSynthesis.getVoices();
            const preferred = voices.find(v => (gender === '男' ? (v.name.includes('Male') || v.name.includes('男')) : (v.name.includes('Female') || v.name.includes('女'))));
            if (preferred) u.voice = preferred;
        }
        window.speechSynthesis.speak(u);
    } else if ((engine === 'doubao' || engine === 'bdetts' || engine === 'volc_paid') && speakerId) {
        try {
            let audioData;

            // Determine if we should use HTTP (Volc API) or WebSocket (Doubao App API)
            // BDeTTS always uses HTTP with new IDs
            const useHttp = engine === 'bdetts' || isVolcVoice(speakerId);
            const useWS = !useHttp;

            if (useWS) {
                if (!cookie) {
                    console.warn('[TTS] Custom voice needs cookie, falling back to default.');
                    speakerId = 'zh_female_sichuan';
                }
            }

            if (engine === 'volc_paid') {
                const volcConfig = voiceConfig.volcPaid || {};
                const appId = volcConfig.appId;
                const token = volcConfig.token;

                if (appId && token) {
                    // 使用付费版 API
                    const spk = speakerId.startsWith('tts.other.') ? speakerId.replace('tts.other.', '') : speakerId;
                    const body = {
                        app: { appid: appId, token: token, cluster: 'volcano_mega' },
                        user: { uid: 'mahjong_player' },
                        audio: {
                            voice_type: spk,
                            encoding: 'mp3',
                            speed_ratio: 1.2,
                            volume_ratio: 1.0,
                            pitch_ratio: 1.0,
                            emotion: volcConfig.emotion === 'neutral' ? undefined : volcConfig.emotion
                        },
                        request: {
                            reqid: crypto.randomUUID(),
                            text: text,
                            text_type: 'plain',
                            operation: 'query'
                        }
                    };

                    const response = await fetch('/volc-paid/api/v1/tts', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(body)
                    });

                    if (response.ok) {
                        const res = await response.json();
                        if (res.data) audioData = res.data;
                    } else {
                        const err = await response.text();
                        console.error('[TTS-Paid] Error:', err);
                    }
                }
            }

            if (!audioData && useHttp) {
                // Normalizing ID for the free endpoint
                const crxSpeaker = speakerId.startsWith('tts.other.') ? speakerId.replace('tts.other.', '') : speakerId;
                const response = await fetch('/volc/crx/tts/v1/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Support both Doubao/BDeTTS params
                    body: JSON.stringify({ text, speaker: crxSpeaker })
                })

                if (!response.ok) {
                    const errMsg = await response.text();
                    throw new Error(`Volc API Error ${response.status}: ${errMsg}`);
                }

                const res = await response.json();
                if (res.audio) {
                    // Normalize audio data from various Volc formats
                    if (typeof res.audio === 'string') {
                        audioData = res.audio;
                    } else if (res.audio.data) {
                        audioData = res.audio.data;
                    } else if (res.data) {
                        audioData = res.data;
                    }
                }
            } else {
                // WebSocket Logic for Doubao App API
                audioData = await new Promise((resolve, reject) => {
                    const currentId = generateId()
                    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const wsBase = `${wsProtocol}//${window.location.host}/ws-doubao/samantha/audio/tts`;
                    const params = new URLSearchParams({
                        format: 'aac', speaker: speakerId, speech_rate: '200', pitch: '0',
                        mode: '0', language: 'zh', device_platform: 'web', aid: '586861',
                        device_id: currentId, tea_uuid: currentId, web_id: currentId,
                        doubao_cookie: cookie
                    })
                    const ws = new WebSocket(`${wsBase}?${params.toString()}`);
                    const audioChunks = [];
                    ws.onopen = () => {
                        ws.send(JSON.stringify({ event: 'text', text }));
                        ws.send(JSON.stringify({ event: 'finish' }));
                    };
                    ws.onmessage = (e) => { if (e.data instanceof Blob) audioChunks.push(e.data); };
                    ws.onclose = () => { resolve(audioChunks.length > 0 ? new Blob(audioChunks, { type: 'audio/aac' }) : null); };
                    ws.onerror = (e) => reject(e);
                    setTimeout(() => ws.close(), 5000);
                });
            }

            if (audioData) {
                let url;
                if (audioData instanceof Blob) {
                    url = URL.createObjectURL(audioData);
                } else {
                    // Base64 string
                    url = `data:audio/mp3;base64,${audioData}`;
                }

                // 存入缓存
                ttsCache.set(cacheKey, url);

                const audio = new Audio(url);
                audio.playbackRate = 1.3;
                audio.play().catch(err => console.warn('[Mahjong-TTS] Audio play blocked:', err));
            }
        } catch (e) {
            console.error('[TTS] Engine failed, falling back to local', e);
            try {
                // Fallback to local TTS
                window.speechSynthesis.cancel()
                const u = new SpeechSynthesisUtterance(text);
                u.rate = isMe ? (voiceConfig.speed || 1.1) : 1.3;
                if (!isMe) {
                    u.pitch = gender === '男' ? 0.8 : 1.2;
                    const voices = window.speechSynthesis.getVoices();
                    const preferred = voices.find(v => (gender === '男' ? (v.name.includes('Male') || v.name.includes('男')) : (v.name.includes('Female') || v.name.includes('女'))));
                    if (preferred) u.voice = preferred;
                }
                window.speechSynthesis.speak(u);
            } catch (err) {
                console.error('[TTS] Local fallback also failed', err)
            }
        }
    } else if (engine === 'minimax') {
        // Simple Minimax placeholder or direct logic if available in common utils
        console.log('[TTS] Minimax voice requested but not fully implemented in separate helper');
    }
}

// 核心监听：监听所有可能触发操作变化的状态
watch([
    () => mahjongStore.gameState?.currentTile,
    () => mahjongStore.gameState?.currentPlayer,
    () => getPlayer('south')?.hand?.length
], ([newTile, currPlayer, handLen]) => {
    // 处理出牌时的公共视觉/听觉反馈
    if (newTile) {
        // 1. 优先播报语音 (自带缓存，响应最快)
        speak(newTile, mahjongStore.gameState?.lastPlayer)

        // 2. 播放出牌音效
        playSfx('play')

        // 3. 视觉反馈：显示放大动画
        activeTile.value = newTile

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
        const options = mahjongEngine.canChi(myHand, newTile, 'previous')
        canChi.value = isFromPrevious && options.length > 0

        // 如果当前牌变了或者不能吃了，关闭吃牌选择框
        if (!canChi.value) showChiOptions.value = false

        // 检查是否可以听牌 (由专门的 watch 处理 tingTiles，canTing 是其计算属性)
        if (isMyTurn.value) {
            // 这里不需要手动设置 canTing，watch(hand) 会自动更新 tingTiles
        }
    } else {
        // 无人出牌时清空除自摸外的标志
        canHu.value = isMyTurn.value ? mahjongEngine.canHu(myHand) : false
        canGang.value = isMyTurn.value ? (mahjongEngine.canAnGang(myHand).length > 0) : false

        // 抓牌后也检查听 (由专门的 watch 处理 tingTiles)
    }
}, { immediate: true })

// 专门监听手牌变化来更新听牌
watch(() => getPlayer('south')?.hand, (newHand) => {
    if (newHand && [1, 4, 7, 10, 13, 14].includes(newHand.length)) {
        // 只有在 1, 4, 7, 10, 13 这类张数时才是"听某某牌"
        // 如果是 14 张，则是"打哪张牌后能听" (由 watch(selectedTile) 处理)
        if (newHand.length !== 14) {
            tingTiles.value = mahjongEngine.getTingPai(newHand)
        }
    } else {
        // tingTiles.value = [] // 这里不要随意清空，防止闪烁
    }
}, { deep: true, immediate: true })


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

    // 启动本局时长计时器
    startGameTimer()

    // 庄家是第一个出牌的
    if (mahjongStore.gameState.currentPlayer !== mahjongStore.gameState.dealer) {
        mahjongStore.gameState.currentPlayer = mahjongStore.gameState.dealer
    }

    // 触发庄家的动作
    const dealer = mahjongStore.currentRoom?.players?.[mahjongStore.gameState?.dealer]
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

// 计时器控制方法
const startGameTimer = () => {
    if (!gameStartTime.value) {
        gameStartTime.value = Date.now()
        // 保存到store中，确保状态持久化
        if (mahjongStore.gameState) {
            mahjongStore.gameState.gameStartTime = gameStartTime.value
            mahjongStore.gameState.gameDuration = 0
        }
        gameTimer.value = setInterval(() => {
            gameDuration.value = Math.floor((Date.now() - gameStartTime.value) / 1000)
            // 更新到store中
            if (mahjongStore.gameState) {
                mahjongStore.gameState.gameDuration = gameDuration.value
            }
        }, 1000)
    }
}

const stopGameTimer = () => {
    if (gameTimer.value) {
        clearInterval(gameTimer.value)
        gameTimer.value = null
        // 更新到store中
        if (mahjongStore.gameState) {
            mahjongStore.gameState.gameDuration = gameDuration.value
        }
    }
}

const resetGameTimer = () => {
    stopGameTimer()
    gameStartTime.value = null
    gameDuration.value = 0
    // 更新到store中
    if (mahjongStore.gameState) {
        mahjongStore.gameState.gameStartTime = null
        mahjongStore.gameState.gameDuration = 0
    }
}

// 格式化时长为 MM:SS 格式
const formatGameDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 结算结束，进入下一局前的处理
const handleRoundEnd = async () => {
    showScoreCard.value = false // 关闭结算界面
    randomTileBackColor() // 每一局换个颜色
    tingTiles.value = [] // 清除听牌状态
    showTingPreview.value = false
    resetGameTimer() // 重置本局时长计时器
    mahjongStore.startNextRound()
    await runGameFlow()
}

// 游戏结束时发送系统提示
const sendGameEndNotification = () => {
    const chatStore = useChatStore()
    // 向所有房间内的玩家发送游戏结束通知
    const players = mahjongStore.currentRoom?.players || []
    const timestamp = Date.now()
    const formattedTime = new Date(timestamp).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })
    players.forEach(player => {
        if (player.id !== 'user') {
            chatStore.addMessage(player.id, {
                role: 'system',
                content: `麻将对局结束 [TIMESTAMP:${formattedTime}]`,
                timestamp: timestamp
            })
        }
    })
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

    // 恢复计时器状态
    if (mahjongStore.gameState && mahjongStore.gameState.gameStartTime) {
        gameStartTime.value = mahjongStore.gameState.gameStartTime
        gameDuration.value = mahjongStore.gameState.gameDuration || 0
        // 重新启动计时器
        if (!gameTimer.value) {
            gameTimer.value = setInterval(() => {
                gameDuration.value = Math.floor((Date.now() - gameStartTime.value) / 1000)
                // 更新到store中
                if (mahjongStore.gameState) {
                    mahjongStore.gameState.gameDuration = gameDuration.value
                }
            }, 1000)
        }
    }

    // 如果还没有发牌（deck为空），或者没有gameState，播放开局动画
    if (!mahjongStore.gameState || mahjongStore.gameState.deck.length === 0) {
        runGameFlow()
    }

    // 监听页面关闭或刷新事件，发送游戏结束通知
    const handleBeforeUnload = () => {
        // 只有在有游戏状态时才发送通知
        if (mahjongStore.currentRoom && mahjongStore.gameState) {
            sendGameEndNotification()
        }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // 组件卸载时移除事件监听
    onUnmounted(() => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
    })
})

// 处理局内聊天发送
// 处理局内聊天发送
const handleSendChat = async () => {
    if (!chatInput.value.trim() || isAiReplying.value) return
    const text = chatInput.value
    chatInput.value = ''

    // 设置正在回复状态，显示加载提示
    isAiReplying.value = true
    try {
        await mahjongStore.sendGameChat(text)
    } catch (err) {
        console.error('发送失败:', err)
    } finally {
        isAiReplying.value = false
        scrollToBottom()
    }
}

const scrollToBottom = () => {
    nextTick(() => {
        const el = document.getElementById('chat-history')
        if (el) el.scrollTop = el.scrollHeight
    })
}

watch(() => mahjongStore.gameChatMessages.length, (newLen, oldLen) => {
    if (newLen > oldLen) {
        // 遍历所有新增消息，防止批量消息只显示最后一条
        for (let i = oldLen; i < newLen; i++) {
            const newMsg = mahjongStore.gameChatMessages[i]
            if (newMsg) {
                const isSelf = newMsg.role === 'user'
                // 稍微错开时间添加，避免重叠完全一致
                setTimeout(() => {
                    addDanmaku(newMsg.content, newMsg.sender, isSelf)
                }, (i - oldLen) * 300)
            }
        }

        if (!isChatPanelVisible.value) hasNewMsg.value = true
        scrollToBottom()
    }
})

watch(isChatPanelVisible, (val) => {
    if (val) {
        hasNewMsg.value = false
        scrollToBottom()
    }
})

</script>



<style scoped>
@keyframes slide-left {
    from {
        transform: translateX(100vw);
    }

    to {
        transform: translateX(-100%);
    }
}

.animate-slide-left {
    animation-name: slide-left;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
    /* keep state at end */
    left: 0;
    /* Align to left but start off-screen due to translate */
}



.mahjong-tile {
    width: 30px;
    height: 42px;
    background: #f9f9f7;
    /* 象牙乳白更加真实 */
    border-radius: 4px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    line-height: 1;
    font-weight: 900;
    padding: 0;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
    /* 3D 侧边 */
    box-shadow:
        0 1px 0 #ddd,
        0 2px 0 #ccc,
        0 3px 0 #bbb,
        0 4px 0 #aaa,
        0 4px 5px rgba(0, 0, 0, 0.3);
    margin-bottom: 2px;
    border: 1px solid #ddd;
}

/* span 用于渲染 emoji 牌面，不再隐藏 */

/* 矢量牌面渲染器 - 需要 :deep() 穿透 v-html 注入的内容 */
.tile-face-content {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    overflow: hidden;
}

:deep(.tile-emoji) {
    font-size: 38px !important;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateY(-3px);
}

.tile-svg {
    width: 90%;
    height: 90%;
    display: block;
}

.face-char {
    font-size: 0.9em;
    font-weight: 900;
    line-height: 1;
}

.face-wan {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
}

.wan-top {
    font-size: 0.55em;
    font-weight: 900;
    margin-bottom: -0.1em;
}

.wan-bottom {
    font-size: 0.45em;
    font-weight: 900;
    opacity: 0.9;
}

.face-grid {
    position: relative;
    width: 100%;
    height: 100%;
}

.visual-item {
    position: absolute;
    transform: translate(-50%, -50%);
}

.dot-item {
    width: 22%;
    height: 16%;
    border-radius: 50%;
    box-shadow: inset -1px -1px 2px rgba(0, 0, 0, 0.3), 1px 1px 1px rgba(255, 255, 255, 0.4);
}

.dot-special {
    width: 70%;
    height: 50%;
    border-radius: 50%;
    border: 2px solid #e11d48;
    background: radial-gradient(circle at 30% 30%, #fca5a5, #e11d48);
}

.bam-item {
    width: 12%;
    height: 25%;
    border-radius: 4px;
    box-shadow: inset -1px -1px 2px rgba(0, 0, 0, 0.2);
}

.bird-visual {
    width: 80%;
    height: 80%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8em;
    color: #16a34a;
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.2));
}

.face-white-border {
    width: 70%;
    height: 80%;
    border: 2px solid #2563eb;
    border-radius: 3px;
    box-shadow: inset 0 0 4px rgba(37, 99, 235, 0.2);
}

/* 彩色花色样式 (仅基础) */
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
    background-color: var(--tile-back-primary);
    background-image: var(--tile-back-image);
    background-size: cover;
    background-position: center;
    border-radius: 3px;
    position: relative;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(0, 0, 0, 0.1);
    will-change: transform;
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
    background: #f9f9f7;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: bold;
    box-shadow: 0 1px 0 #ccc, 0 2px 3px rgba(0, 0, 0, 0.2);
    padding: 0;
}

.mahjong-tile-up span,
.mahjong-tile-up-side span {
    display: flex;
    align-items: center;
    justify-content: center;
    transform: scale(1.6);
}

.mahjong-tile-pool {
    width: 18px;
    height: 26px;
    background: #f9f9f7;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 0 #ccc, 0 2px 2px rgba(0, 0, 0, 0.2);
    border: 0.5px solid #ddd;
    overflow: hidden;
}

.mahjong-tile-pool span {
    font-size: 16px;
    transform: scale(1.6);
    display: flex;
    align-items: center;
    justify-content: center;
}

.mahjong-tile-small {
    width: 24px;
    height: 34px;
    background: #f9f9f7;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: bold;
    box-shadow: 0 1px 0 #ccc, 0 2px 3px rgba(0, 0, 0, 0.2);
    padding: 0;
    overflow: hidden;
}

.mahjong-tile-small span {
    display: flex;
    align-items: center;
    justify-content: center;
    transform: scale(1.6);
}

.mahjong-tile-vertical {
    width: 24px;
    height: 16px;
    background-color: var(--tile-back-primary);
    background-image: var(--tile-back-image);
    background-size: cover;
    background-position: center;
    border-radius: 2px;
    position: relative;
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.4);
    margin: 0;
    will-change: transform;
}

.mahjong-tile-vertical::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px 2px 0 0;
}

/* 开局动画牌堆 3D 加强 */
.deck-tile {
    width: 14px;
    height: 20px;
    background-color: var(--tile-back-primary);
    background-image: var(--tile-back-image);
    background-size: cover;
    background-position: center;
    border-radius: 2px;
    box-shadow: 0 2px 0 var(--tile-back-shadow);
    will-change: transform;
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

/* 高级感桌布 - 移除卡顿源，改用纯净高性能方案 */
.bg-table-felt {
    background-color: #064e3b;
    background-image:
        radial-gradient(circle at 50% 50%, #065f46 0%, #064e3b 100%);
}


.table-border {
    border: 12px solid #3f2b1c;
    border-image: linear-gradient(to bottom, #5d4037, #3e2723) 1;
    box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.6);
}

/* 记牌器面板 - 横向紧凑型 */
.card-counter-panel {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    top: 72px !important;
    width: 96%;
    max-width: 440px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(15px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    z-index: 100;
    padding: 8px 4px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.card-counter-panel :deep(.tile-emoji) {
    font-size: 20px !important;
    transform: scale(1.4) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
}

:deep(.active-tile-zoom .tile-emoji) {
    font-size: 84px !important;
    transform: translateY(-4px) !important;
    white-space: nowrap !important;
}

.active-tile-zoom {
    position: absolute !important;
}

.counter-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 4px;
    border-radius: 4px;
    gap: 3px;
    min-width: 38px;
    justify-content: center;
}

.counter-tile {
    background: white;
    border-radius: 2px;
    width: 14px;
    height: 19px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    position: relative !important;
}

.counter-num {
    font-size: 11px;
    font-weight: 900;
    color: #fbbf24;
    line-height: 1;
}

/* 操作大字特效 - 缩小版 */
.action-text-main {
    font-size: 80px;
    /* 缩小到 80px */
    font-weight: 900;
    color: white;
    text-shadow: 0 0 10px rgba(0, 0, 0, 0.5),
        0 0 30px var(--action-color),
        4px 4px 0 var(--action-border);
    -webkit-text-stroke: 2px white;
    font-style: italic;
    filter: drop-shadow(0 0 10px rgba(0, 0, 0, 0.8));
    letter-spacing: 4px;
}

.action-circle {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 14px;
    color: white;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    position: relative;
    box-shadow:
        0 3px 6px rgba(0, 0, 0, 0.4),
        inset 0 1px 3px rgba(255, 255, 255, 0.3);
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
    padding: 6px 20px;
    border-radius: 99px;
    font-size: 14px;
    border: 1px solid #ffedd5;
    box-shadow:
        0 4px 12px rgba(194, 65, 12, 0.5),
        inset 0 2px 4px rgba(255, 255, 255, 0.4);
    transition: all 0.2s;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 50;
    pointer-events: auto;
}

.play-btn:active {
    transform: translateY(2px) scale(0.95);
    box-shadow: 0 2px 4px rgba(194, 65, 12, 0.4);
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
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

/* 听牌按钮样式 */
.action-circle.ting {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    box-shadow: 0 4px 0 #5b21b6, 0 8px 10px rgba(0, 0, 0, 0.3);
}

.action-circle.ting:active {
    box-shadow: 0 2px 0 #5b21b6, 0 4px 5px rgba(0, 0, 0, 0.3);
    transform: translateY(2px);
}


/* 统一小牌样式（用于吃碰杠和对手明牌） */
.mahjong-tile-small,
.mahjong-tile-pool {
    width: 24px;
    height: 34px;
    background-color: #f9f9f7;
    border-radius: 3px;
    position: relative !important;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: bold;
    box-shadow: 0 1px 0 #ccc, 0 2px 3px rgba(0, 0, 0, 0.2);
    padding: 0;
    overflow: hidden;
    color: inherit;
    border: 0.5px solid #ddd;
}

.mahjong-tile-small span {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3.5vmin !important;
    transform: translateY(-0.2vmin);
    line-height: 1;
}

/* 通用 Flex 修正 */
.flex-1 {
    min-height: 0;
    min-width: 0;
}

@media (max-width: 900px),
(max-height: 500px) {

    /* 顶部导航栏自适应 */
    .game-top-bar {
        height: 44px !important;
    }

    .game-top-bar .text-sm,
    .game-top-bar .text-xs {
        font-size: 12px !important;
        gap: 8px !important;
    }

    .game-top-bar button {
        width: 32px !important;
        height: 32px !important;
        margin-right: 2px !important;
    }

    .game-top-bar .fa-solid {
        font-size: 16px !important;
    }

    /* 手牌再次缩小并居中 */
    .mahjong-tile {
        width: 5.8vmin !important;
        height: 8.2vmin !important;
        font-size: 3.8vmin !important;
        padding-bottom: 0 !important;
        margin-bottom: 0 !important;
    }

    .mahjong-tile.selected {
        transform: translateY(-1vmin) !important;
    }

    /* 按钮与提示缩小 */
    .play-btn {
        padding: 5px 15px !important;
        font-size: 13px !important;
        border-radius: 20px !important;
    }

    .animate-bounce .bg-yellow-400 {
        padding: 4px 10px !important;
        font-size: 11px !important;
    }

    .action-circle {
        width: 32px !important;
        height: 32px !important;
        font-size: 12px !important;
    }

    /* 桌面牌面缩小 */
    .mahjong-tile-small,
    .mahjong-tile-up,
    .mahjong-tile-up-side {
        width: 3.5vmin !important;
        height: 5.2vmin !important;
        font-size: 3.2vmin !important;
        background-color: #f9f9f7 !important;
    }

    /* 侧边堆叠缩小 */
    .mahjong-tile-vertical {
        width: 5.5vmin !important;
        height: 3.5vmin !important;
        background: var(--tile-back-image), linear-gradient(to bottom, var(--tile-back-primary), var(--tile-back-secondary)) !important;
        background-size: cover !important;
        background-position: center !important;
    }
}
</style>

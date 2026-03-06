<template>
    <div class="w-full z-10">
        <!-- Center Time Divider -->
        <div v-if="shouldShowTimeDivider" class="flex justify-center my-4 animate-fade-in relative">
            <span class="text-[10px] px-2 py-0.5 rounded shadow-sm select-none transition-colors duration-300"
                :class="chatData?.bgTheme === 'dark' ? 'text-white/60 bg-white/10' : 'text-gray-400 bg-gray-100/60'">
                {{ formatTimelineTime(msg.timestamp) }}
            </span>
        </div>

        <!-- Multi-select Layer Wrapper -->
        <div class="flex items-center gap-3 transition-all duration-300 relative"
            :class="isMultiSelectMode ? 'pl-10' : ''">

            <!-- Selection Circle -->
            <div v-if="isMultiSelectMode"
                class="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all shrink-0"
                :class="isSelected ? 'bg-[#07c160] border-[#07c160]' : 'border-gray-300 bg-white/10'"
                @click.stop="$emit('toggle-select', msg.id)">
                <i v-if="isSelected" class="fa-solid fa-check text-white text-[10px]"></i>
            </div>

            <div class="flex-1 overflow-visible" @click="isMultiSelectMode ? $emit('toggle-select', msg.id) : null">

                <!-- CASE 1: System / Recall Message -->
                <div v-if="msg.type === 'system' || msg.role === 'system'"
                    class="flex flex-col items-center my-2 w-full animate-fade-in"
                    @contextmenu.prevent="emitContextMenu">
                    <span class="text-[11px] px-3 py-1 rounded font-songti select-none transition-colors duration-300"
                        :class="[
                            msg.isRecallTip ? 'cursor-pointer hover:bg-opacity-80 transition-colors' : '',
                            chatData?.bgTheme === 'dark' ? 'bg-white/10 text-white/40' : 'bg-gray-200/50 text-gray-400'
                        ]" @click="msg.isRecallTip && (localShowDetail = !localShowDetail)">
                        {{ getCleanContent(msg.content) }}
                    </span>
                    <!-- Foldable Content -->
                    <div v-if="localShowDetail && msg.realContent"
                        class="mt-1.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500 max-w-[80%] break-all shadow-sm animate-fade-in-down">
                        <div class="mb-0.5 text-gray-400 text-[10px]">原内容:</div>
                        {{ getCleanContent(msg.realContent) }}
                    </div>
                </div>

                <div v-else-if="isValidMessage" class="flex gap-2 w-full animate-fade-in"
                    :class="msg.role === 'user' ? 'flex-row-reverse' : ''">

                    <!-- Avatar -->
                    <div class="relative w-10 h-10 shrink-0 cursor-pointer z-10 overflow-visible"
                        @click.stop="handleAvatarClick(msg)" @dblclick="$emit('dblclick-avatar', msg)"
                        @touchstart="startAvatarLongPress(msg, $event)" @touchend="cancelAvatarLongPress"
                        @touchcancel="cancelAvatarLongPress" @mousedown="startAvatarLongPress(msg, $event)"
                        @mouseup="cancelAvatarLongPress" @mouseleave="cancelAvatarLongPress">
                        <!-- Inner Avatar -->
                        <div class="absolute overflow-hidden bg-white shadow-sm transition-all duration-300" :class="[
                            (msg.role === 'user' ? chatData?.userAvatarFrame : chatData?.avatarFrame) || chatData?.avatarShape === 'circle' ? 'rounded-full' : 'rounded',
                            { 'animate-shake': shakingAvatars?.has(msg.id) }
                        ]" :style="avatarInnerStyle">
                            <!-- Show dynamic sender avatar in groups -->
                            <img :src="chatData?.isGroup ? (msg.senderAvatar || avatarSrc) : avatarSrc"
                                class="w-full h-full object-cover">
                        </div>
                        <!-- Frame -->
                        <img v-if="frameSrc" :src="frameSrc" class="absolute pointer-events-none z-20 object-contain"
                            style="left: -15%; top: -25%; width: 130%; height: 130%; max-width: none;">
                    </div>

                    <!-- Content Column -->
                    <div class="flex flex-col" :class="[
                        msg.role === 'user' ? 'items-end' : 'items-start',
                        (msg.type === 'html' || isHtmlCard) ? 'max-w-[82%]' : (parsedVoteData ? 'max-w-[80%] w-full' : 'max-w-[80%]')
                    ]">
                        <!-- New: Sender Name and Title for Group Chats -->
                        <div v-if="chatData?.isGroup && msg.role !== 'system'"
                            class="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5 px-1"
                            :class="msg.role === 'user' ? 'flex-row-reverse mr-0.5' : 'ml-0.5'">
                            <!-- Title Badge -->
                            <span v-if="senderTitle" :class="senderTitleClass"
                                class="px-1 rounded-[2px] text-white transform scale-[0.85] origin-center font-bold">
                                {{ senderTitle }}
                            </span>
                            <!-- Only show leaderboard icon on the announcement message -->
                            <div v-if="isAnnouncementMsg && chatData?.isGroup"
                                @click.stop="$emit('show-rank', chatData.id)"
                                class="cursor-pointer bg-amber-50 text-amber-500 px-1 rounded-[2px] border border-amber-100 font-black scale-[0.85] origin-center hover:bg-amber-100 transition-colors flex items-center shrink-0">
                                <i class="fa-solid fa-trophy mr-0.5 text-[7px]"></i>榜
                            </div>
                            <!-- Name -->
                            <span :class="msg.role === 'user' ? 'text-gray-500' : ''" class="truncate max-w-[120px]">{{
                                displaySenderName }}</span>
                        </div>
                        <!-- Anchor for scroll-to-vote -->
                        <div v-if="msg.id" :id="'msg-' + msg.id" class="absolute -top-16"></div>

                        <!-- CASE 2: Gift Card -->
                        <div v-if="msg.type === 'gift'"
                            class="group relative w-[240px] overflow-hidden rounded-2xl shadow-md transition-all active:scale-[0.98] select-none cursor-pointer"
                            :class="[
                                msg.status === 'claimed' ? 'opacity-80 grayscale-[20%]' : 'hover:shadow-lg',
                                msg.role === 'user' ? 'mr-1' : 'ml-1'
                            ]" @click="$emit('click-gift', msg)" @contextmenu.prevent="emitContextMenu">

                            <!-- Top Area -->
                            <div class="p-4 flex flex-col gap-3 transition-colors" :class="[
                                msg.status === 'claimed' ? 'bg-gray-400' : 'bg-gradient-to-br from-pink-400 to-rose-500',
                            ]">
                                <div class="flex items-center gap-3">
                                    <div
                                        class="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                                        <img :src="msg.giftImage || 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png'"
                                            class="w-9 h-9 object-contain drop-shadow-md">
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div
                                            class="text-white text-xs font-black uppercase tracking-widest opacity-80 mb-0.5">
                                            {{ msg.status === 'claimed' ? '礼物已领取' : '收到新礼物' }}
                                        </div>
                                        <div class="text-white text-base font-bold truncate drop-shadow-sm">{{
                                            msg.giftName }}
                                        </div>
                                    </div>
                                </div>

                                <!-- Note -->
                                <div class="bg-black/5 rounded-lg p-2 border border-white/10">
                                    <p class="text-white/90 text-xs leading-relaxed italic line-clamp-2">"{{
                                        msg.giftNote ||
                                        '送给你的小惊喜' }}"</p>
                                </div>
                            </div>

                            <!-- Bottom Status Bar -->
                            <div class="px-4 py-2 bg-white flex items-center justify-between border-t border-gray-50">
                                <div class="flex items-center gap-1.5">
                                    <template v-if="msg.status === 'claimed'">
                                        <img :src="msg.claimedBy?.avatar"
                                            class="w-4 h-4 rounded-full object-cover grayscale-[30%]">
                                        <span class="text-[10px] text-gray-400 font-bold">{{ msg.claimedBy?.name }}
                                            已领取</span>
                                    </template>
                                    <template v-else>
                                        <i class="fa-solid fa-gift text-rose-400 text-[10px] animate-bounce"></i>
                                        <span class="text-[10px] text-rose-500 font-black animate-pulse">待领取</span>
                                    </template>
                                </div>
                                <div class="text-[9px] text-gray-300 font-mono tracking-tighter">ID: {{
                                    msg.giftId?.slice(-6) }}
                                </div>
                            </div>

                            <!-- Claimed Overlay -->
                            <div v-if="msg.status === 'claimed'"
                                class="absolute inset-0 pointer-events-none bg-black/[0.03] flex items-center justify-center">
                                <div
                                    class="rotate-[-12deg] border-4 border-gray-400/20 px-4 py-1 rounded-xl opacity-20">
                                    <span class="text-2xl font-black text-gray-400 uppercase">CLAIMED</span>
                                </div>
                            </div>
                        </div>

                        <!-- CASE 3: Order Share Card -->
                        <div v-else-if="msg.type === 'order_share'"
                            class="group relative w-[280px] overflow-hidden rounded-2xl shadow-md transition-all active:scale-[0.98] select-none cursor-pointer"
                            :class="[
                                'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 hover:shadow-lg',
                                msg.role === 'user' ? 'mr-1' : 'ml-1'
                            ]" @click="handleOrderCardClick(msg)" @contextmenu.prevent="emitContextMenu">

                            <!-- 头部 -->
                            <div class="p-4 flex flex-col gap-3 relative overflow-hidden">
                                <!-- 装饰图案 -->
                                <div class="absolute top-0 left-0 w-full h-full opacity-10">
                                    <div class="absolute top-2 left-2 w-8 h-8 border-2 border-white rounded-full"></div>
                                    <div class="absolute bottom-2 right-2 w-12 h-12 border-2 border-white rounded-full"></div>
                                </div>

                                <div class="relative z-10 flex items-center gap-3">
                                    <div class="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                                        <span class="text-3xl">📦</span>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-white text-xs font-black uppercase tracking-widest opacity-80 mb-0.5">
                                            订单分享
                                        </div>
                                        <div class="text-white text-sm font-bold truncate drop-shadow-sm">
                                            {{ msg.orderData?.items?.[0]?.title || '订单分享' }}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 订单信息 -->
                            <div class="bg-white px-4 pb-4 pt-2">
                                <div v-if="msg.orderData?.items?.[0]" class="flex items-center gap-3 mb-3">
                                    <img :src="msg.orderData.items[0].image" class="w-16 h-16 rounded-xl object-cover bg-slate-100">
                                    <div class="flex-1 min-w-0">
                                        <h4 class="text-sm font-bold text-slate-800 line-clamp-2">
                                            {{ msg.orderData.items[0].title }}
                                        </h4>
                                        <p class="text-xs text-slate-400 mt-1">订单号：{{ msg.orderId }}</p>
                                    </div>
                                </div>
                                <div v-else class="flex items-center gap-3 mb-3">
                                    <div class="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-3xl">📦</div>
                                    <div class="flex-1">
                                        <h4 class="text-sm font-bold text-slate-800">订单分享</h4>
                                        <p class="text-xs text-slate-400 mt-1">订单号：{{ msg.orderId }}</p>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <span class="text-xs text-slate-500">实付金额</span>
                                    <span class="text-lg font-black text-orange-600">¥{{ msg.orderData?.total || '0' }}</span>
                                </div>
                            </div>

                            <!-- 物流信息 -->
                            <div v-if="msg.orderData?.status" class="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-t border-orange-100">
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="text-lg">🚚</span>
                                    <span class="text-xs font-bold text-slate-700">物流状态</span>
                                    <span :class="[
                                        'text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto',
                                        msg.orderData.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                                    ]">
                                        {{ getOrderStatusText(msg.orderData.status) }}
                                    </span>
                                </div>
                                <p class="text-[10px] text-slate-500">
                                    {{ getOrderLogisticsInfo(msg) }}
                                </p>
                            </div>
                            <div v-else class="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-t border-orange-100">
                                <p class="text-[10px] text-slate-500 text-center">
                                    🔒 点击可查看订单详情和物流状态
                                </p>
                            </div>
                        </div>

                        <!-- CASE 2.1: Gift Claimed Card -->
                        <div v-else-if="msg.type === 'gift_claimed'"
                            class="group relative w-[240px] overflow-hidden rounded-2xl shadow-md transition-all active:scale-[0.98] select-none cursor-pointer"
                            :class="[
                                'bg-gradient-to-br from-green-400 to-emerald-500 hover:shadow-lg',
                                msg.role === 'user' ? 'mr-1' : 'ml-1'
                            ]" @click="$emit('click-gift', msg)" @contextmenu.prevent="emitContextMenu">

                            <!-- Top Area -->
                            <div class="p-4 flex flex-col gap-3">
                                <div class="flex items-center gap-3">
                                    <div
                                        class="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                                        <img :src="msg.giftImage || 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png'"
                                            class="w-9 h-9 object-contain drop-shadow-md">
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div
                                            class="text-white text-xs font-black uppercase tracking-widest opacity-80 mb-0.5">
                                            礼物已领取
                                        </div>
                                        <div class="text-white text-base font-bold truncate drop-shadow-sm">{{
                                            msg.giftName }}
                                        </div>
                                    </div>
                                </div>

                                <!-- Claim Info -->
                                <div class="bg-black/5 rounded-lg p-2 border border-white/10">
                                    <p class="text-white/90 text-xs leading-relaxed italic line-clamp-2">"{{
                                        msg.giftNote ||
                                        '送给你的小惊喜' }}"</p>
                                    <div class="mt-2 pt-2 border-t border-white/20">
                                        <div class="flex items-center gap-2">
                                            <img :src="msg.claimantAvatar" class="w-4 h-4 rounded-full object-cover">
                                            <span class="text-white/80 text-xs">{{ msg.claimantName }} 领取了这份礼物</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Bottom Status Bar -->
                            <div class="px-4 py-2 bg-white flex items-center justify-between border-t border-gray-50">
                                <div class="flex items-center gap-1.5">
                                    <i class="fa-solid fa-check-circle text-green-500 text-[10px]"></i>
                                    <span class="text-[10px] text-green-600 font-bold">已领取</span>
                                </div>
                                <div class="text-[9px] text-gray-300 font-mono tracking-tighter">ID: {{
                                    msg.giftId?.slice(-6) }}
                                </div>
                            </div>
                        </div>

                        <!-- Pay Card (Red Packet / Transfer) -->
                        <div v-else-if="isPayCard"
                            class="pay-card group relative w-[240px] overflow-hidden rounded-xl shadow-md transition-all active:scale-[0.98] select-none cursor-pointer"
                            :class="[
                                (msg.isClaimed || msg.status === 'received' || msg.isRejected) ? 'opacity-80 grayscale-[20%]' : 'hover:shadow-lg',
                                msg.role === 'user' ? 'mr-1' : 'ml-1'
                            ]" @click="$emit('click-pay', msg)" @contextmenu.prevent="emitContextMenu">

                            <!-- Top Area -->
                            <div class="p-3 flex items-center gap-3 transition-colors" :class="[
                                (msg.type === 'transfer' || ensureString(msg.content).includes('转账')) ? 'bg-[#f79c1f]' : 'bg-[#fa9d3b]',
                                (msg.isClaimed || msg.isRejected) && 'opacity-70'
                            ]">
                                <div class="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center shrink-0">
                                    <i :class="getPayIcon(msg)" class="text-white text-xl"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-white text-sm font-medium truncate drop-shadow-sm">{{
                                        getPayTitle(msg) }}</div>
                                    <div class="text-white/70 text-[10px] truncate">{{ getPayDesc(msg, chatData) }}</div>
                                </div>
                            </div>

                            <!-- Bottom Status Bar -->
                            <div class="px-3 py-1.5 bg-white flex items-center justify-between">
                                <span class="text-[10px] text-gray-400 font-medium">{{ getPayStatusText(msg) }}</span>
                                <div
                                    class="flex items-center gap-1 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <i class="fa-brands fa-weixin text-[#07c160] text-[10px]"></i>
                                    <span class="text-[8px] transform scale-90">微信支付</span>
                                </div>
                            </div>

                            <!-- Claimed Overlay Pattern (Subtle) -->
                            <div v-if="msg.isClaimed || msg.isRejected"
                                class="absolute inset-0 pointer-events-none bg-black/[0.02]">
                            </div>
                        </div>

                        <div v-else-if="parsedVoteData" class="flex flex-col gap-2 w-full"
                            :class="msg.role === 'user' ? 'mr-1' : 'ml-1'">
                            <div class="w-full bg-white rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-gray-100/50 overflow-hidden animate-fade-in"
                                @contextmenu.prevent="emitContextMenu">

                                <!-- Vote Header: Softer Cute Gradient -->
                                <div class="p-5 bg-gradient-to-br from-[#62a5ff] to-[#7c83ff] text-white relative">
                                    <!-- Decorative circle -->
                                    <div class="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full blur-xl">
                                    </div>

                                    <div class="flex items-center justify-between mb-2">
                                        <div class="flex items-center gap-2">
                                            <div
                                                class="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">
                                                <i class="fa-solid fa-chart-simple text-sm"></i>
                                            </div>
                                            <span class="text-[10px] font-bold tracking-widest opacity-90">POLL /
                                                群投票</span>
                                        </div>
                                        <div
                                            class="px-2 py-0.5 bg-black/10 rounded-full text-[9px] font-medium backdrop-blur-sm">
                                            {{ parsedVoteData.isMultiple ? '多选' : '单选' }}
                                        </div>
                                    </div>

                                    <h3 class="text-lg font-bold leading-tight tracking-tight drop-shadow-sm">{{
                                        parsedVoteData.title }}</h3>

                                    <div class="flex items-center gap-1.5 mt-3">
                                        <div class="flex -space-x-1.5 items-center">
                                            <template v-for="(voterAvatar, vIdx) in getVoterAvatars()" :key="vIdx">
                                                <img v-if="vIdx < 3" :src="voterAvatar"
                                                    class="w-4 h-4 rounded-full border border-white/30 object-cover">
                                            </template>
                                        </div>
                                        <span class="text-[10px] opacity-80">{{ getTotalVoters() }} 人已参与活跃投票</span>
                                    </div>
                                </div>

                                <!-- Vote Options: Bubbly Style -->
                                <div class="p-4 bg-gray-50/30">
                                    <div class="flex flex-col gap-2.5">
                                        <div v-for="(option, idx) in parsedVoteData.options" :key="idx"
                                            class="relative group transition-all duration-200"
                                            :class="parsedVoteData.isEnded ? 'cursor-default' : 'cursor-pointer active:scale-[0.97]'"
                                            @click="handleVoteToggle(idx)">

                                            <!-- Option Container -->
                                            <div class="relative bg-white rounded-xl border border-gray-100 overflow-hidden min-h-[52px] transition-all group-hover:border-blue-200 group-hover:shadow-sm"
                                                :class="isOptionSelected(idx) ? 'ring-2 ring-blue-400/30 border-blue-200' : ''">

                                                <!-- Progress Bar -->
                                                <div class="absolute inset-y-0 left-0 bg-blue-50 transition-all duration-700 ease-out"
                                                    :style="{ width: calculateVotePercent(parsedVoteData.optionVoters[idx].length) + '%' }">
                                                </div>

                                                <!-- Content -->
                                                <div class="relative px-4 py-3 flex items-center gap-3">
                                                    <!-- Checkbox/Radio Circle -->
                                                    <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300"
                                                        :class="isOptionSelected(idx) ? 'bg-[#5cafff] border-[#5cafff] scale-110 shadow-sm' : 'border-gray-200 bg-gray-50'">
                                                        <i v-if="isOptionSelected(idx)"
                                                            class="fa-solid fa-check text-white text-[10px]"></i>
                                                    </div>

                                                    <div class="flex-1 min-w-0">
                                                        <div
                                                            class="text-[13px] font-medium text-gray-700 truncate mb-0.5">
                                                            {{ typeof option === 'string' ? option : option.text }}
                                                        </div>
                                                        <!-- Voter icons if real-name and has voters -->
                                                        <div v-if="!parsedVoteData.isAnonymous && parsedVoteData.optionVoters[idx].length > 0"
                                                            class="flex -space-x-1 mt-0.5">
                                                            <template
                                                                v-for="(uid, uIdx) in parsedVoteData.optionVoters[idx]"
                                                                :key="uIdx">
                                                                <img v-if="uIdx < 5" :src="getAvatarForUser(uid)"
                                                                    class="w-3 h-3 rounded-full border border-white object-cover">
                                                            </template>
                                                        </div>
                                                    </div>

                                                    <div class="flex flex-col items-end shrink-0">
                                                        <span class="text-[12px] font-bold text-gray-600">{{
                                                            parsedVoteData.optionVoters[idx].length
                                                            }}</span>
                                                        <span class="text-[9px] text-gray-400 font-medium">{{
                                                            calculateVotePercent(parsedVoteData.optionVoters[idx].length)
                                                            }}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Vote Footer -->
                                <div
                                    class="px-4 py-2.5 border-t border-gray-50 bg-white/80 backdrop-blur-sm flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <i class="fa-solid fa-user-shield text-[10px] text-blue-400"></i>
                                        <span class="text-[10px] text-gray-400 font-medium tracking-tight">
                                            {{ parsedVoteData.isAnonymous ? '匿名投票 (仅发起人可见)' : '公开实名投票' }}
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <!-- End Vote Button -->
                                        <button v-if="!parsedVoteData.isEnded && parsedVoteData.creatorId === 'user'"
                                            @click.stop="handleEndVote"
                                            class="px-2 py-0.5 bg-red-50 text-red-400 text-[10px] font-bold rounded-md hover:bg-red-100 transition-colors">
                                            结束投票
                                        </button>
                                        <div class="flex items-center gap-1">
                                            <div class="w-1.5 h-1.5 rounded-full"
                                                :class="parsedVoteData.isEnded ? 'bg-gray-300' : 'bg-green-400 animate-pulse'">
                                            </div>
                                            <span class="text-[10px] text-gray-400 font-bold">
                                                {{ parsedVoteData.isEnded ? '已结束' : '进行中' }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>


                        <div v-else-if="parsedVoteResult" class="flex flex-col gap-2 w-[280px]"
                            :class="msg.role === 'user' ? 'mr-1' : 'ml-1'">
                            <div class="w-full bg-[#fcfcfc] rounded-2xl border border-gray-100 p-4 shadow-sm animate-fade-in text-center relative overflow-hidden"
                                @contextmenu.prevent="emitContextMenu">

                                <i
                                    class="fa-solid fa-flag-checkered absolute -top-1 -right-1 text-4xl text-gray-200 rotate-12 opacity-30"></i>

                                <div class="relative z-10">
                                    <div
                                        class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 rounded-full border border-green-100 mb-3">
                                        <i class="fa-solid fa-circle-check text-green-500 text-[8px]"></i>
                                        <span
                                            class="text-[9px] font-black text-green-600 uppercase tracking-tighter">投票已落幕</span>
                                    </div>

                                    <h4 class="text-[13px] font-bold text-gray-800 mb-3 line-clamp-1">《{{
                                        parsedVoteResult?.title }}》结果</h4>

                                    <div class="space-y-1.5 mb-4">
                                        <div v-for="(winner, wIdx) in getTopOptions()" :key="wIdx"
                                            class="flex items-center justify-between p-2 bg-white rounded-xl border border-gray-50 shadow-sm">
                                            <div class="flex items-center gap-2 overflow-hidden">
                                                <div
                                                    class="w-5 h-5 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                                                    <i class="fa-solid fa-trophy text-[10px] text-amber-500"></i>
                                                </div>
                                                <span class="text-[11px] font-bold text-gray-600 truncate">{{
                                                    winner.text }}</span>
                                            </div>
                                            <span class="text-[10px] font-black text-orange-500 shrink-0 ml-2">{{
                                                winner.count }} 票</span>
                                        </div>
                                    </div>

                                    <div class="text-[10px] text-gray-300 font-medium mb-1">
                                        截止于 {{ new Date(parsedVoteResult?.endedAt || Date.now()).toLocaleTimeString() }}
                                    </div>

                                    <button @click.stop="scrollToVote(parsedVoteResult?.refId)"
                                        class="text-[10px] font-bold text-blue-400 hover:text-blue-500 transition-colors">
                                        <i class="fa-solid fa-eye mr-1"></i>查看完整计票
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- CASE: Moment Card -->
                        <div v-else-if="msg.type === 'moment_card'" @click="navigateToMoment(msg)"
                            @contextmenu.prevent="emitContextMenu"
                            class="cursor-pointer active:opacity-80 animate-fade-in w-full max-w-[300px]"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                            <MomentShareCard :data="msg.content" />
                        </div>

                        <!-- CASE 6: Favorite Card (Shared Favorite) -->
                        <div v-else-if="isFavoriteCard"
                            class="max-w-[280px] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-95 transition-transform duration-200 select-none animate-fade-in"
                            @click="$router.push('/favorites/' + favoriteCardData.favoriteId)">
                            <div class="p-4 flex flex-col gap-2">
                                <div class="flex items-center gap-2 mb-1"
                                    :class="favoriteCardData.source === '通话记录' ? 'text-[#07c160]' : 'text-[#fabb05]'">
                                    <i
                                        :class="favoriteCardData.source === '通话记录' ? 'fa-solid fa-phone' : 'fa-solid fa-star'"></i>
                                    <span class="text-xs font-bold text-gray-400">
                                        {{ favoriteCardData.source === '通话记录' ? '通话记录' : (favoriteCardData.type ===
                                            'chat_record' ? '收藏的消息记录' : '收藏的消息') }}
                                    </span>
                                </div>
                                <div class="text-[13px] text-gray-500 line-clamp-1 mb-2">
                                    {{ favoriteCardData.source === '通话记录' ? favoriteCardData.title : `来自与
                                    ${favoriteCardData.source} 的聊天` }}
                                </div>

                                <div class="bg-gray-50/50 p-3 rounded-lg border border-gray-50">
                                    <div class="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                                        {{ favoriteCardData.preview }}
                                    </div>
                                </div>

                                <div
                                    class="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-300">
                                    <template v-if="favoriteCardData.source === '通话记录'">
                                        <span>已保存至收藏夹</span>
                                    </template>
                                    <template v-else-if="favoriteCardData.type === 'chat_record'">
                                        <span>共 {{ favoriteCardData.count }} 条消息</span>
                                    </template>
                                    <template v-else>
                                        <span>收藏于 {{ new Date(favoriteCardData.savedAt).getMonth() + 1 }}-{{ new
                                            Date(favoriteCardData.savedAt).getDate() }} {{ new
                                                Date(favoriteCardData.savedAt).getHours().toString().padStart(2, '0')
                                            }}:{{ new
                                                Date(favoriteCardData.savedAt).getMinutes().toString().padStart(2, '0')
                                            }}</span>
                                    </template>
                                </div>
                            </div>
                        </div>

                        <!-- Music (Replicated from old version) -->
                        <div v-else-if="msg.type === 'music'" class="flex flex-col w-full"
                            :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                            <div class="voice-container">
                                <div class="voice-bubble music-bubble"
                                    style="width: 140px; flex: none; background-color: #fce7f3; border-color: #fbcfe8; color: #be185d;"
                                    @click="handlePlayMusic">
                                    <div class="voice-icon">
                                        <i class="fa-solid fa-music"
                                            :class="{ 'animate-pulse': musicBoxStore.isPlaying }"></i>
                                    </div>
                                    <span class="voice-duration" style="font-size:12px; margin-left:6px;">
                                        {{ musicInfo }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Voice (Moved up) -->
                        <div v-else-if="msg.type === 'voice'" class="flex flex-col w-full"
                            :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                            <div class="flex items-center gap-2" :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
                                <div class="h-10 rounded-lg flex items-center px-4 cursor-pointer relative shadow-sm min-w-[80px]"
                                    :class="[
                                        msg.role === 'user' ? 'bg-[#2e2e2e] text-white flex-row-reverse' : 'bg-black text-[#e6dcc0]',
                                        (msg.isPlaying || false) ? 'voice-playing-effect' : ''
                                    ]"
                                    :style="{ width: Math.max(80, 40 + getDuration(msg) * 5) + 'px', maxWidth: '200px' }"
                                    @click="handleToggleVoice" @contextmenu.prevent="emitContextMenu">

                                    <!-- Wave Animation - Enhanced Sound Wave with 5 bars -->
                                    <div class="voice-wave"
                                        :class="[(msg.isPlaying || false) ? 'playing' : '', msg.role === 'user' ? 'wave-right' : 'wave-left']">
                                        <div class="bar bar1"></div>
                                        <div class="bar bar2"></div>
                                        <div class="bar bar3"></div>
                                        <div class="bar bar4"></div>
                                        <div class="bar bar5"></div>
                                    </div>
                                    <!-- Arrow - Hidden as per user request -->
                                    <div class="absolute top-3 w-0 h-0 border-y-[6px] border-y-transparent"
                                        :class="msg.role === 'user' ? 'right-[-6px] border-l-[6px] border-l-[#2e2e2e]' : 'left-[-6px] border-r-[6px] border-r-black'"
                                        style="display: none;">
                                    </div>
                                    <span class="text-[10px] font-bold opacity-70"
                                        :class="msg.role === 'user' ? 'mr-0 ml-1' : 'ml-1 mr-0'">{{
                                            getDuration(msg)
                                        }}"</span>
                                </div>
                                <div v-if="msg.role === 'ai' && !msg.isPlayed" class="w-2 h-2 bg-red-500 rounded-full">
                                </div>
                            </div>
                            <!-- Transcript -->
                            <div v-if="localShowTranscript" class="mt-2 max-w-full animate-fade-in-down">
                                <div class="bg-white border border-gray-200 p-3 rounded-lg text-[14.5px] text-gray-800 font-songti leading-relaxed shadow-sm whitespace-pre-wrap relative overflow-hidden"
                                    :class="msg.role === 'user' ? 'mr-0 ml-auto' : ''" style="max-width: 280px;">
                                    {{ msg.content }}
                                </div>
                            </div>
                        </div>

                        <!-- CASE: Weibo Card -->
                        <div v-else-if="isWeiboCard && weiboCardData"
                            class="max-w-[280px] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-95 transition-transform duration-200 select-none animate-fade-in"
                            @click="$router.push('/weibo')"> <!-- Simple nav for now -->
                            <div class="flex flex-col">
                                <!-- Top: Content Snippet -->
                                <div
                                    class="p-4 pb-2 text-[14px] text-gray-800 leading-relaxed font-songti line-clamp-3">
                                    {{ weiboCardData.summary }}
                                </div>

                                <!-- Middle: Image/Media -->
                                <div v-if="weiboCardData.image" class="w-full h-32 bg-gray-100 relative">
                                    <img :src="weiboCardData.image" class="w-full h-full object-cover">
                                    <div class="absolute inset-0 bg-black/5"></div>
                                </div>
                                <div v-else class="h-2 w-full"></div>

                                <!-- Bottom: Source -->
                                <div
                                    class="px-3 py-2 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                                    <div class="flex items-center gap-2">
                                        <div class="w-5 h-5 rounded-full overflow-hidden">
                                            <img :src="weiboCardData.avatar" class="w-full h-full object-cover">
                                        </div>
                                        <span class="text-xs text-gray-500 font-bold">@{{ weiboCardData.author }}</span>
                                    </div>
                                    <div class="flex items-center gap-1 opacity-50">
                                        <i class="fa-brands fa-weibo text-[#ff8200] text-xs"></i>
                                        <span class="text-[10px] transform scale-90 text-gray-400">微博</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- CASE: Dice Result Card -->
                        <div v-else-if="msg.diceResults" class="flex flex-col gap-2 w-[280px]"
                            :class="msg.role === 'user' ? 'mr-1' : 'ml-1'">
                            <div class="w-full bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-3 rounded-2xl shadow-sm border border-white/50 text-center relative overflow-hidden"
                                @contextmenu.prevent="emitContextMenu">

                                <!-- 装饰星星 -->
                                <div class="absolute top-2 left-2 text-yellow-400 text-xs animate-twinkle z-0">✨</div>
                                <div class="absolute top-3 right-3 text-purple-400 text-xs animate-twinkle z-0"
                                    style="animation-delay: 0.5s">⭐
                                </div>
                                <div class="absolute bottom-2 left-3 text-pink-400 text-xs animate-twinkle z-0"
                                    style="animation-delay: 1s">✨
                                </div>

                                <div class="bg-white/90 backdrop-blur-sm rounded-xl p-4 relative z-10">
                                    <div class="flex items-center justify-between mb-3">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xl">🎲</span>
                                            <span class="text-sm font-bold text-purple-600">摇骰子</span>
                                        </div>
                                        <span v-if="msg.diceResults.every(r => r === msg.diceResults[0])"
                                            class="text-xs bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">豹子!</span>
                                        <span v-else-if="msg.diceTotal >= msg.diceCount * 6 * 0.8"
                                            class="text-xs bg-gradient-to-r from-purple-400 to-pink-400 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">大吉!</span>
                                        <span v-else-if="msg.diceTotal <= msg.diceCount * 2"
                                            class="text-xs bg-gradient-to-r from-blue-400 to-blue-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">加油!</span>
                                    </div>

                                    <!-- 骰子结果展示 -->
                                    <div class="flex justify-center gap-2 mb-3">
                                        <div v-for="(r, i) in msg.diceResults" :key="i"
                                            class="w-14 h-14 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-md flex items-center justify-center border-2 border-purple-200 dice-msg-dice"
                                            :style="{ animationDelay: (i * 100) + 'ms' }">
                                            <i class="fa-solid text-purple-600 drop-shadow-sm text-4xl"
                                                :class="'fa-dice-' + ['one', 'two', 'three', 'four', 'five', 'six'][r - 1]">
                                            </i>
                                        </div>
                                    </div>

                                    <!-- 分数展示 -->
                                    <div
                                        class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-100">
                                        <div class="flex items-center justify-center gap-2">
                                            <span class="text-sm text-gray-600">合计点数</span>
                                            <span class="text-3xl font-bold text-purple-600">{{ msg.diceTotal }}</span>
                                            <span class="text-xs text-gray-400">/ {{ msg.diceCount * 6 }}</span>
                                        </div>
                                        <div class="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div class="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-1000"
                                                :style="{ width: ((msg.diceTotal / (msg.diceCount * 6)) * 100) + '%' }">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- CASE: Tarot Result Card -->
                        <div v-else-if="msg.tarotCards" class="flex flex-col gap-2 w-[300px]"
                            :class="msg.role === 'user' ? 'mr-1' : 'ml-1'">
                            <div class="w-full bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-3 rounded-2xl shadow-lg border border-purple-400/50 text-center relative overflow-hidden"
                                @contextmenu.prevent="emitContextMenu">

                                <!-- 神秘装饰 -->
                                <div class="absolute top-2 left-2 text-yellow-300 text-xs animate-twinkle z-0">✨</div>
                                <div class="absolute top-3 right-3 text-purple-300 text-xs animate-twinkle z-0"
                                    style="animation-delay: 0.5s">🌙
                                </div>
                                <div class="absolute bottom-2 left-3 text-pink-300 text-xs animate-twinkle z-0"
                                    style="animation-delay: 1s">⭐
                                </div>

                                <div class="bg-black/40 backdrop-blur-sm rounded-xl p-4 relative z-10">
                                    <!-- 标题 -->
                                    <div class="flex items-center justify-center gap-2 mb-3">
                                        <span class="text-xl">🔮</span>
                                        <span class="text-sm font-bold text-white">{{ msg.tarotInterpretation ? '塔罗解牌' :
                                            '塔罗占卜' }}</span>
                                    </div>

                                    <!-- 问题显示 -->
                                    <div v-if="msg.tarotQuestion" class="mb-3 bg-white/10 rounded-lg p-2">
                                        <p class="text-xs text-purple-200 mb-1">问题</p>
                                        <p class="text-sm text-white">{{ msg.tarotQuestion }}</p>
                                    </div>

                                    <!-- 牌阵名称 -->
                                    <div class="text-xs text-purple-300 mb-3">{{ msg.tarotSpread?.name }}</div>

                                    <!-- 塔罗牌展示 -->
                                    <div class="flex justify-center gap-2 mb-3 flex-wrap">
                                        <div v-for="(card, i) in msg.tarotCards.slice(0, 5)" :key="i"
                                            class="w-10 h-14 rounded-lg border border-purple-400/50 flex flex-col items-center justify-center"
                                            :class="getTarotCardColorClass(card)"
                                            :style="{ animationDelay: (i * 100) + 'ms' }">
                                            <span class="text-sm">{{ getTarotCardIcon(card) }}</span>
                                            <span v-if="card.isReversed" class="text-[6px] text-white/70">逆</span>
                                        </div>
                                        <div v-if="msg.tarotCards.length > 5"
                                            class="w-10 h-14 rounded-lg border border-purple-400/30 bg-white/10 flex items-center justify-center">
                                            <span class="text-xs text-white/70">+{{ msg.tarotCards.length - 5 }}</span>
                                        </div>
                                    </div>

                                    <!-- 解牌内容 -->
                                    <div v-if="msg.tarotInterpretation"
                                        class="bg-white/10 rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar">
                                        <p class="text-xs text-purple-200 mb-1">解牌</p>
                                        <p class="text-sm text-white leading-relaxed whitespace-pre-wrap">{{
                                            msg.tarotInterpretation }}</p>
                                    </div>

                                    <!-- 简单提示 -->
                                    <div v-else class="text-xs text-purple-300">
                                        抽到了 {{ msg.tarotCards.length }} 张塔罗牌
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Universal Mixed Content Wrapper (Image / HTML / Text) -->
                        <div v-else class="flex flex-col gap-2"
                            :class="msg.role === 'user' ? 'items-end' : 'items-start'">

                            <!-- 1. Text Bubble Layer (Sticker / Text) -->
                            <!-- Show bubble if there's cleaned content. We no longer hide it if it's also an HTML card, to allow text + card messages. -->
                            <div v-if="cleanedContent && !isImageMsg(msg)" @contextmenu.prevent="emitContextMenu"
                                @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                                @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress"
                                class="px-3 py-2 text-[15px] leading-relaxed break-words shadow-sm relative transition-all"
                                :class="[
                                    msg.role === 'user' ? 'chat-bubble-right' : 'chat-bubble-left',
                                ]" :style="{
                                    fontSize: (chatData?.bubbleSize || 15) + 'px',
                                    ...(computedBubbleStyle || {})
                                }">
                                <!-- Arrow -->
                                <div v-if="shouldShowArrow"
                                    class="absolute top-3 w-0 h-0 border-y-[6px] border-y-transparent"
                                    :class="msg.role === 'user' ? 'right-[-6px] border-l-[6px] border-l-[#95EC69]' : 'left-[-6px] border-r-[6px] border-r-white'">
                                </div>

                                <!-- Quote -->
                                <div v-if="msg.quote"
                                    class="mb-1.5 pb-1.5 border-b border-white/10 opacity-70 text-[11px] leading-tight flex flex-col gap-0.5">
                                    <div class="font-bold">{{ msg.quote.role === 'user' ? '我' : (chatData.name || '对方')
                                        }}
                                    </div>
                                    <div class="truncate max-w-[200px]">{{ msg.quote.content }}</div>
                                </div>

                                <!-- Content -->
                                <span v-html="formattedContent"></span>
                            </div>

                            <div v-if="isImageMsg(msg) || msg.image" class="msg-image bg-transparent"
                                @contextmenu.prevent="emitContextMenu">
                                <img :src="msg.image || getImageSrc(msg)"
                                    class="max-w-[200px] max-h-[250px] rounded-lg cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                                    :class="{ 'animate-bounce-subtle': msg.type === 'sticker' || isSticker(msg) }"
                                    :alt="ensureString(msg.content).substring(0, 20)"
                                    @click="previewImage(msg.image || getImageSrc(msg))" @error="handleImageError"
                                    referrerpolicy="no-referrer">
                            </div>

                            <!-- 3. HTML Card Layer -->
                            <div v-if="shouldRenderCard && hasHtmlContent"
                                class="mt-1 transition-all relative z-10 w-auto" @contextmenu.prevent="emitContextMenu"
                                @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                                @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress"
                                @message="handleIframeMessage">
                                <SafeHtmlCard :content="getPureHtml(msg.html || msg.content)" />
                            </div>

                            <!-- 4. Empty/Protocol Placeholder (Clickable Fallback) -->
                            <div v-if="!cleanedContent && !isImageMsg(msg) && !shouldRenderCard && !isPayCard && !isFamilyCard && !isFavoriteCard && msg.type !== 'voice' && msg.type !== 'music'"
                                @contextmenu.prevent="emitContextMenu" @touchstart="startLongPress"
                                @touchend="cancelLongPress" @touchmove="cancelLongPress" @mousedown="startLongPress"
                                @mouseup="cancelLongPress" @mouseleave="cancelLongPress"
                                class="px-3 py-1.5 text-[11px] text-gray-400 italic bg-gray-100/30 border border-dashed border-gray-200 rounded-lg opacity-60 hover:opacity-100 transition-opacity">
                                [协议/空内容消息 - 右键编辑/删除]
                            </div>

                            <!-- Bubble Timestamp -->
                            <div v-if="msg.timestamp" class="text-[10px] text-gray-400 mt-0.5 px-1">
                                {{ new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                                    hour: '2-digit', minute: '2-digit'
                                }) }}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Family Card Claim Modal -->
    <FamilyCardClaimModal ref="familyCardModal" @confirm="handleCardClaim" />
    <!-- Family Card Detail Modal -->
    <FamilyCardDetailModal ref="familyDetailModal" :userName="chatData.userName || '我'" />
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import { useStickerStore } from '../../../stores/stickerStore'
import { useChatStore } from '../../../stores/chatStore'
import { useWalletStore } from '../../../stores/walletStore'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useMusicBoxStore } from '../../../stores/musicBoxStore'
import { parseWeChatEmojis } from '../../../utils/emojiParser'
import SafeHtmlCard from '../../../components/SafeHtmlCard.vue'
import MomentShareCard from '../../../components/MomentShareCard.vue'
import FamilyCardClaimModal from '../FamilyCardClaimModal.vue'
import FamilyCardDetailModal from '../FamilyCardDetailModal.vue'

const props = defineProps({
    msg: Object,
    prevMsg: Object,
    chatData: Object,
    isMultiSelectMode: Boolean,
    isSelected: Boolean,
    shakingAvatars: {
        type: Object, // Set behaves like object in props passing usually
        default: () => new Set()
    }
})

const emit = defineEmits([
    'click-avatar', 'dblclick-avatar', 'context-menu', 'avatar-longpress',
    'toggle-select', 'click-pay', 'play-voice', 'click-gift'
])

const stickerStore = useStickerStore()
const chatStore = useChatStore()
const walletStore = useWalletStore()
const settingsStore = useSettingsStore()
const musicBoxStore = useMusicBoxStore()
const router = useRouter()
const localShowDetail = ref(false)
const localShowTranscript = ref(false)
const familyCardModal = ref(null)
const familyDetailModal = ref(null)
const isPressing = ref(false)
const pressTimer = ref(null)

// --- Group Roles & Titles ---
const senderActivity = computed(() => {
    if (props.msg.role === 'user') return props.chatData?.groupSettings?.myActivity || 0
    const pid = props.msg.senderId || props.chatData?.id
    const p = props.chatData?.participants?.find(p => p.id === pid)
    return p?.activity || 0
})

const senderLv = computed(() => chatStore.calculateMemberLevel(senderActivity.value))

const senderRole = computed(() => {
    if (props.msg.role === 'user') return props.chatData?.groupSettings?.myRole || 'member'
    const pid = props.msg.senderId || props.chatData?.id
    const p = props.chatData?.participants?.find(p => p.id === pid)
    return p?.role || 'member'
})

const senderCustomTitle = computed(() => {
    if (props.msg.role === 'user') return props.chatData?.groupSettings?.myCustomTitle || ''
    const pid = props.msg.senderId || props.chatData?.id
    const p = props.chatData?.participants?.find(p => p.id === pid)
    return p?.customTitle || ''
})

const senderTitle = computed(() => {
    return chatStore.getMemberTitle(props.chatData.id, props.msg.role === 'user' ? 'user' : (props.msg.senderId || props.chatData.id))
})

const displaySenderName = computed(() => {
    if (props.msg.role === 'user') {
        return props.chatData.groupSettings?.myNickname || props.chatData.userName || '我'
    }
    // Priority 1: Use senderId to find participant
    const pid = props.msg.senderId
    if (pid) {
        const p = props.chatData?.participants?.find(p => p.id === pid)
        if (p) return p?.nickname || p?.name
    }
    // Priority 2: Use explicit senderName
    if (props.msg.senderName) return props.msg.senderName
    // Priority 3: Fallback to chat name (for system messages)
    return props.chatData?.name || '未知'
})

// Only show the leaderboard shortcut when the message is the group announcement
const isAnnouncementMsg = computed(() => {
    const c = ensureString(props.msg.content || '').toString()
    return c.includes('[群公告]') || c.includes('isAnnouncement') || c.includes('发布了新群公告')
})

const senderTitleClass = computed(() => {
    const role = senderRole.value
    const custom = senderCustomTitle.value
    if (role === 'owner') return 'bg-[#f7b500]' // Yellow
    if (role === 'admin') return 'bg-[#07c160]' // Green
    if (custom) return 'bg-[#a855f7]' // Purple
    return 'bg-[#b1b1b1]' // Gray (For regular tiers)
})

// Settings History Sync

// Handle Family Card Click (Open Modal)
const handleFamilyCardClick = () => {
    console.log('[Family Card Click]', {
        type: props.msg.type,
        isApply: isFamilyCardApply.value,
        isReject: isFamilyCardReject.value,
        status: props.msg.status,
        isClaimed: props.msg.isClaimed
    })

    // 拒绝卡不可点击
    if (isFamilyCardReject.value) {
        console.log('[Family Card] Reject card clicked, ignoring')
        return
    }

    // 已领取/已生效的卡片 (无论是申请还是赠送) -> 打开详情弹窗
    if (props.msg.isClaimed || props.msg.status === 'claimed') {
        console.log('[Family Card] Opening detail modal for claimed card')
        const card = walletStore.familyCards.find(c => c.ownerId === props.chatData.id)
        if (card) {
            familyDetailModal.value?.open({
                cardName: card.remark || '亲属卡',
                ownerName: card.ownerName || props.chatData.name,
                number: card.number,
                theme: card.theme,
                amount: card.amount
            })
        } else {
            chatStore.triggerToast('未找到钱包中的卡片记录', 'warn')
        }
        return
    }

    // 申请卡待确认点击 - 打开详情模态框（查看提交的申请）
    if (isFamilyCardApply.value) {
        console.log('[Family Card] Apply card clicked, opening view modal')
        const { text } = familyCardData.value
        familyCardModal.value?.open({
            uuid: props.msg.id,
            amount: 0,
            note: text || '送我一张亲属卡好不好？',
            fromCharId: props.chatData?.id,
            isApply: true,
            status: 'waiting'
        }, '亲属卡申请')
        return
    }

    // 未领取的普通卡：打开领取模态框
    if (!isFamilyCardApply.value && !isFamilyCardReject.value && props.msg.role === 'ai') {
        const { amount, text } = familyCardData.value
        console.log('[Family Card] Opening claim modal', { amount, text })
        familyCardModal.value?.open({
            uuid: props.msg.id,
            amount: parseFloat(amount) || 0,
            note: text || '拿去买糖吃~',
            fromCharId: props.chatData?.id
        }, text || '亲属卡')
    }
}

// Navigate to moment detail
const navigateToMoment = (msg) => {
    try {
        const data = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content
        if (data.id) {
            router.push(`/wechat/moments/detail/${data.id}`)
        }
    } catch (e) {
        console.error('Failed to navigate to moment', e)
    }
}


// Handle modal confirm
const handleCardClaim = (data) => {
    const cardOwnerName = props.chatData?.name || '对方'

    // Add to wallet with user's customization
    walletStore.addFamilyCard({
        ownerId: data.fromCharId,
        ownerName: cardOwnerName,
        amount: data.amount,
        remark: data.cardName || '亲属卡',
        number: data.number,
        theme: data.theme
    })

    // Update message state in store (This specific card message)
    chatStore.updateMessage(props.chatData.id, props.msg.id, {
        isClaimed: true,
        claimTime: Date.now(),
        status: 'claimed'
    })

    // Update the original "Apply Card" message status if found in history
    const msgs = chatStore.currentChat?.msgs || []
    const applyMsg = [...msgs].reverse().find(m =>
        m.role === 'user' &&
        (typeof m.content === 'string' && m.content.includes('FAMILY_CARD_APPLY')) &&
        m.timestamp < props.msg.timestamp
    )

    if (applyMsg) {
        chatStore.updateMessage(props.chatData.id, applyMsg.id, {
            status: 'claimed',
            claimedCardName: data.cardName || '亲属卡'
        })
    }

    // Add a system notification message (Matching Red Packet logic)
    chatStore.addMessage(props.chatData.id, {
        role: 'system',
        content: `你已领取了${cardOwnerName}的亲属卡「${data.cardName || '亲属卡'}」`
    })

    console.log(`[Family Card] Successfully claimed card from ${cardOwnerName}`)
}

function handleIframeMessage(event) {
    if (event.data && event.data.type === 'CHAT_SEND') {
        const text = event.data.text;
        console.log('[HTML Card] triggered send:', text);
        // Logic to send message as user
        chatStore.addMessage(props.chatData.id, {
            role: 'user',
            content: text
        });
        chatStore.sendMessageToAI(props.chatData.id);
    }
}

// --- Computeds & Helpers ---

const shouldShowTimeDivider = computed(() => {
    if (!props.prevMsg) return true
    const diff = props.msg.timestamp - props.prevMsg.timestamp
    return diff > 5 * 60 * 1000
})

const isPayCard = computed(() => {
    if (!props.msg) return false
    const content = ensureString(props.msg.content)
    return props.msg.type === 'redpacket' ||
        props.msg.type === 'transfer' ||
        (typeof content === 'string' && (content.includes('[红包]') || content.includes('[转账]')))
})

const cleanedContent = computed(() => getCleanContent(props.msg.content, isHtmlCard.value))

const formattedTime = computed(() => {
    return formatTime(props.msg.timestamp)
})

const hasHtmlContent = computed(() => {
    const html = getPureHtml(props.msg.html || props.msg.content)
    return html && html.trim().length > 0
})

const isValidMessage = computed(() => {
    // Debug: Log gift messages
    if (props.msg.type === 'gift') {
        console.log('[ChatMessageItem] Checking gift message:', { id: props.msg.id, type: props.msg.type, giftName: props.msg.giftName })
    }

    // 1. If it's a system message, it must have content
    if (props.msg.role === 'system') {
        const clean = getCleanContent(ensureString(props.msg.content))
        return clean && clean.length > 0
    }

    // 2. Card & Media Checks
    if (shouldRenderCard.value || isPayCard.value || isFamilyCard.value || isFavoriteCard.value || isWeiboCard.value || props.msg.type === 'gift' || props.msg.type === 'gift_claimed') return true;
    if (props.msg.type === 'voice' || props.msg.type === 'music' || props.msg.type === 'image' || props.msg.image || isImageMsg(props.msg)) return true

    // 3. Text Content Filtering
    const content = ensureString(props.msg.content).trim()
    const clean = getCleanContent(content)

    // If the displayed content is empty...
    if (!clean || clean.length === 0) {
        // ...and it looks like a protocol/metadata object, HIDE IT.
        if (content.startsWith('{') && (
            content.includes('"status"') ||
            content.includes('"mind"') ||
            content.includes('"着装"') ||
            content.includes('"心声"') ||
            content.includes('"mood"')
        )) {
            return false
        }

        // Hide BIO updates
        if (content.match(/^\[(?:UPDATE_)?BIO:/i)) return false
    }

    // Default: Show (render the placeholder if empty, to allow debug/delete)
    return true
})

const formattedContent = computed(() => formatMessageContent(props.msg))

const isFamilyCard = computed(() => {
    // Priority: use message type (set by store)
    if (props.msg.type === 'family_card') return true

    // Do NOT check HTML messages for family card keywords - they should be handled by msg.type
    if (props.msg.type === 'html') return false

    // Check for family card tags in text content
    const content = ensureString(props.msg.content).toUpperCase()
    // Only match proper [FAMILY_CARD] tags, not random strings containing the keyword
    return /[\\]?\[\s*FAMILY_CARD/i.test(content)
})

const isFamilyCardApply = computed(() => {
    const content = ensureString(props.msg.content)
    return /[\\]?\[\s*FAMILY_CARD_APPLY/i.test(content)
})

const isFamilyCardReject = computed(() => {
    const c = ensureString(props.msg.content)
    // Regular check OR HTML JSON check
    return /[\\]?\[\s*FAMILY_CARD_REJECT/i.test(c) || (c.includes('type":"html"') && c.includes('拒绝'))
})

const isHtmlCard = computed(() => {
    // 1. Explicit type or flag
    if (props.msg.type === 'html' || props.msg.forceCard) return true

    // 2. Detect JSON wrapper or [CARD] tag in content
    const c = ensureString(props.msg.content).trim()
    // Robust [CARD] check
    if (/\[\s*CARD\s*\]/i.test(c)) return true
    if (c === '[HTML卡片]') return true

    // Robust JSON check: "type": "html" OR "html": "..."
    if ((c.includes('"type"') && c.includes('"html"')) || (c.includes('"html"') && c.includes('{') && c.includes('}'))) return true

    // 3. Raw HTML tags (if it starts with div/style and has closing tag or significant length)
    if (c.includes('<div') || c.includes('<html') || c.includes('<style')) {
        if (c.includes('</') || (c.includes('style=') && c.length > 50)) return true
    }

    return false
})

const isHtmlContentCard = computed(() => isHtmlCard.value)
const shouldRenderCard = computed(() => {
    // Render the card if flagged OR if we have valid HTML content
    if (props.msg.forceCard) return hasHtmlContent.value;
    return (props.msg.type === 'html' || isHtmlCard.value) && hasHtmlContent.value
})

const isFavoriteCard = computed(() => props.msg.type === 'favorite_card')
const isWeiboCard = computed(() => props.msg.type === 'weibo_card')

const weiboCardData = computed(() => {
    if (!isWeiboCard.value) return null
    try {
        const content = ensureString(props.msg.content)
        return JSON.parse(content)
    } catch (e) {
        return null
    }
})

const favoriteCardData = computed(() => {
    if (!isFavoriteCard.value) return null
    try {
        const content = ensureString(props.msg.content)
        return JSON.parse(content)
    } catch (e) {
        return null
    }
})

const musicInfo = computed(() => {
    if (props.msg.type !== 'music') return ''
    const content = ensureString(props.msg.content)
    let info = '点击重听'

    // Robust parsing for [演奏:piano:score] or [MUSIC:piano:score] or piano:score
    const clean = content.replace(/[\[\]]/g, '').replace(/^(演奏|MUSIC)[:：]?/i, '');

    if (clean.includes(':') || clean.includes('：')) {
        const parts = clean.split(/[:：]/)
        const inst = parts[0].trim().toLowerCase()
        const instMap = {
            'piano': '🎹 钢琴',
            'guitar': '🎸 吉他',
            'violin': '🎻 小提琴',
            'flute': '🪈 长笛',
            'game': '👾 8-bit',
            'drum': '🥁 架子鼓',
            'search': '🎵 音乐点播'
        }
        info = instMap[inst] || '🎵 音乐演奏'
    } else if (content.toUpperCase().includes('SEARCH')) {
        info = '🎵 音乐点播'
    }

    return info
})

const familyCardData = computed(() => {
    const content = ensureString(props.msg.content)

    // Recovery for HTML JSON Garbage
    // Check if it's an HTML card acting as a logic carrier (e.g. Reject)
    if ((props.msg.type === 'html' && props.msg.role === 'ai') || (content.includes('"html"') && content.includes('拒绝'))) {
        if (content.includes('拒绝') || content.includes('reject')) {
            return { amount: '0', text: '对方拒绝了您的申请', isReject: true }
        }
        // If it's just a generic HTML card, don't force it to be a family card unless explicit
    }

    // 预处理：有时候AI会把卡片放在代码块里，或者转义，先简单清理一下转义符
    const cleanContent = content.replace(/\\\[/g, '[').replace(/\\\]/g, ']')

    // 辅助正则：允许中文冒号，允许冒号周围有空格
    const colonRegex = '[:：]\\s*'

    // Pattern 1: 标准卡片 [FAMILY_CARD:金额:文案]
    const match = cleanContent.match(new RegExp(`\\[FAMILY_CARD\\s*${colonRegex}([\\d\\.]+)\\s*${colonRegex}([\\s\\S]*?)\\]`, 'i'))
    if (match) return { amount: match[1], text: match[2].trim(), isReject: false }

    // Pattern 2: 申请卡 [FAMILY_CARD_APPLY:文案]
    const applyMatch = cleanContent.match(new RegExp(`\\[FAMILY_CARD_APPLY\\s*${colonRegex}([\\s\\S]*?)\\]`, 'i'))
    if (applyMatch) return { amount: '0', text: applyMatch[1].trim(), isReject: false }

    // Pattern 3: 拒绝卡 [FAMILY_CARD_REJECT:文案]
    const rejectMatch = cleanContent.match(new RegExp(`\\[FAMILY_CARD_REJECT\\s*${colonRegex}([\\s\\S]*?)\\]`, 'i'))
    if (rejectMatch) return { amount: '0', text: rejectMatch[1].trim(), isReject: true }

    // Pattern 5: 异常鲁棒性处理 [FAMILY_CARD:备注] (没有金额的情况)
    const noteOnlyMatch = cleanContent.match(new RegExp(`\\[FAMILY_CARD\\s*${colonRegex}([^\\d\\s][\\s\\S]*?)\\]`, 'i'))
    if (noteOnlyMatch) return { amount: '5200', text: noteOnlyMatch[1].trim(), isReject: false }

    // 兜底：虽然检测到了标签但没提取到内容，给一个默认值防止空白
    return { amount: '5200', text: '送给你的亲属卡', isReject: false }
})

const getUserName = computed(() => {
    return props.chatData.userName || '用户'
})


function getCleanContent(contentRaw, isCard = false) {
    if (!contentRaw) return '';
    const content = ensureString(contentRaw);

    // If it's a card and it's ONLY the card code, just hide the bubble immediately
    if (isCard && !content.includes('\n') && content.trim().startsWith('<') && content.trim().endsWith('>')) {
        return '';
    }

    // EARLY FILTER: JSON Fragment Detection
    const trimmed = content.trim();
    let clean = content;

    // Removal of strictly internal protocol tags
    // Refined: Priority match full blocks, then handle unclosed, then scrub stray closing tags
    clean = clean.replace(/\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]/gi, '');
    clean = clean.replace(/\[\s*INNER[-_ ]?VOICE\s*\]([\s\S]*?)(?=\s*\n\s*\[(?!\/)|$)/gi, '');
    clean = clean.replace(/\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]/gi, ''); // Scrub stray closing tags

    // Remove Moment Interaction tags from display bubble
    clean = clean.replace(/\[LIKE[:：]\s*[^\]]+\]/gi, '');
    clean = clean.replace(/\[COMMENT[:：]\s*[^\]]+\]/gi, '');
    clean = clean.replace(/\[REPLY[:：]\s*[^\]]+\]/gi, '');

    // Remove TIMESTAMP tags (hidden from user, only for AI)
    clean = clean.replace(/\s*\[TIMESTAMP:\d{2}\/\d{2} \d{2}:\d{2}\]/gi, '');
    clean = clean.replace(/\s*\[TIMESTAMP:[^\]]+\]/gi, '');

    // Remove Vote tags
    clean = clean.replace(/\[VOTE:\s*[^\]]+\]/gi, '');
    clean = clean.replace(/\[CREATE_VOTE:\s*[^\]]+\]/gi, '');

    // Remove [CARD] ... [/CARD] blocks entirely from the text bubble
    clean = clean.replace(/\[CARD\][\s\S]*?(?:\[\/CARD\]|$)/gi, '');

    // Remove JSON metadata blocks (心声, 着装, status, etc.)
    clean = clean.replace(/\{[\s\n]*"(?:type|着装|环境|status|心声|行为|mind|outfit|scene|action|thoughts|mood|spirit|stats|state|metadata|speech)"[\s\S]*?\}/gi, '');

    // AGGRESSIVE: Remove loose JSON properties (e.g. spirit: {...}, "mood": {...}) that might be missing enclosing braces
    clean = clean.replace(/(?:^|[\r\n,])\s*["']?(?:spirit|mood|location|distance|outfit|scene|stats|status|mind|thoughts)["']?\s*[:：]\s*(?:\{[^{}]*\}|"[^"]*"|'[^']*'|[^\n,]*)(?:,)?/gi, '');

    // ATOMIC BLOCK REMOVAL for cards & Leaked Tech Code
    if (isCard || clean.includes('<') || clean.includes('{') || clean.includes('transform:') || clean.includes('animation:')) {
        clean = clean.replace(/\[\s*CARD\s*\][\s\S]*?(?:\[\/\s*CARD\s*\]|$)/gi, '');
        clean = clean.replace(/```[\s\S]*?```/gi, '');
        clean = clean.replace(/\{[\s\S]*?"html"\s*:[\s\S]*?\}/gi, '');
        clean = clean.replace(/\{[\s\n]*"(?:type|心声|status|thoughts|mood|state|behavior|action|mind|outfit|scene|transform|stats|spirit|speech|hangup)"[\s\S]*?\}/gi, '');
        clean = clean.replace(/(?:@keyframes|to|from|[\#\.]?[a-zA-Z0-9\-\_\: \~\+\>\*\#\[\]\=\^]+)\s*\{[^{}]*\{[^{}]*\}[^{}]*\}|(?:\s|^)(?:@keyframes|to|from|[\#\.]?[a-zA-Z0-9\-\_\: \~\+\>\*\#\[\]\=\^]+)\s*\{[\s\S]*?\}/gi, '');
        clean = clean.replace(/(?:\s|^)\d+%\s*\{[\s\S]*?\}/gi, '');

        const f = clean.indexOf('<');
        const l = clean.lastIndexOf('>');
        if (f !== -1 && l > f) {
            const sub = clean.substring(f, l + 1);
            if (sub.includes('<div') || sub.includes('<style') || sub.includes('style=')) {
                clean = clean.substring(0, f) + clean.substring(l + 1);
            }
        }
    }

    // Fallback: Remove remaining tags and technical remnants
    clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');
    clean = clean.replace(/<[^>]+>/g, '');
    clean = clean.replace(/&[a-z0-9#]+;/gi, ''); // HTML entities

    clean = clean.trim();
    // Strip operational tags (claims, rejections, financial, and multi-media commands)
    const opRegex = /\[(领取|拒收|退回|GIFT|礼物|DRAW|MUSIC|演奏|UPDATE_BIO|VOTE|CREATE_VOTE|RECEIVE_RED_PACKET|HTML卡片)[:：\-\s]?[^\]]*\]/gi;
    clean = clean.replace(opRegex, '').trim();
    clean = clean.replace(/\[(?:图片|IMAGE|表情包|STICKER)[:：\-\s]*https?:\/\/[^\]]+\]/gi, '').trim();

    // Final clean
    // FINAL GUARD: If it's a card and the remaining text is minimal, hide the bubble
    if (isCard && (clean.length < 150)) {
        const hasNaturalLanguage = /[\u4e00-\u9fa5]/.test(clean) || (/[a-zA-Z]/.test(clean) && clean.split(' ').length > 2);
        if (!hasNaturalLanguage || clean.length < 5) {
            return '';
        }
    }

    // FINAL GUARD: Filter all zero-width characters and re-trim
    clean = clean.replace(/[\u200b\u200c\u200d\ufeff]/g, '');

    return clean.trim();
}

function getPureHtml(content) {
    if (!content) return ''
    const str = ensureString(content)
    let trimmed = str.trim()

    // Helper to unescape typical string escapes into actual characters
    const unescapeContent = (text) => {
        if (!text || typeof text !== 'string') return text;
        return text
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\');
    }

    // 1. Unified Favorites Store Logic: Aggressive JSON cleanup
    // Favor standard-like JSON first (stripping whitespace/newlines)
    try {
        let jsonStr = trimmed;
        if (jsonStr.includes('[CARD]')) {
            jsonStr = jsonStr.replace(/\[CARD\][\s\S]*?(\{|<)/i, '$1').trim();
            // If it ends with [/CARD], remove it too
            jsonStr = jsonStr.replace(/\[\/CARD\]/gi, '').trim();
        }

        // Remove markdown backticks if present
        jsonStr = jsonStr.replace(/```(?:html|json)?/gi, '').replace(/```/g, '').trim();

        // Cleaning newlines that typically break JSON.parse in technical responses
        const cleanedJson = jsonStr.replace(/[\r\n]/g, '');
        const parsed = JSON.parse(cleanedJson);
        if (parsed.type === 'html' || parsed.html) {
            return unescapeContent(parsed.html || parsed.content);
        }
    } catch (e) {
        // Standard JSON failed, move to regex recovery
    }

    // 2. Favorites Regex Logic: Greedy match until the last quote before closing }
    // This handles unescaped quotes inside the HTML content
    if (trimmed.includes('"type":') || trimmed.includes('"html":')) {
        const htmlMatch = str.match(/"html"\s*:\s*(["'])([\s\S]*)\1\s*\}/);
        if (htmlMatch) {
            const rawStr = htmlMatch[2];
            try {
                // Try to parse just the string part to handle escapes
                return JSON.parse(`"${rawStr}"`);
            } catch (e) {
                // Final fallback: return the raw greedy match (tolerant browsers)
                return unescapeContent(rawStr);
            }
        }
    }

    // 3. Raw Fallback: If it's pure HTML or contains markers
    const decoded = trimmed.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const startIdx = decoded.toLowerCase().indexOf('<div') !== -1 ? decoded.toLowerCase().indexOf('<div') : decoded.toLowerCase().indexOf('<style');

    if (startIdx !== -1) {
        const endIdx = decoded.lastIndexOf('>');
        if (endIdx > startIdx) {
            return unescapeContent(decoded.substring(startIdx, endIdx + 1));
        }
    }

    return ''
}

const mixedText = computed(() => {
    if (!isFamilyCard.value) return '';
    const content = ensureString(props.msg.content)
    // Remove family card tags using the SAME robust regex
    const colonRegexStr = '[:：]\\s*';
    let text = content.replace(new RegExp(`\\\\?\\[\\s*FAMILY_CARD(?:_APPLY|_REJECT)?\\s*${colonRegexStr}[\\s\\S]*?\\]`, 'gi'), '');

    // Also run standard cleanup (to remove inner voice, css, etc.)
    return getCleanContent(text);
})

const avatarSrc = computed(() => {
    return props.msg.role === 'user'
        ? (props.chatData?.userAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me')
        : (props.chatData?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${props.chatData?.name || 'AI'}`)
})

const frameSrc = computed(() => {
    return props.msg.role === 'user' ? props.chatData?.userAvatarFrame?.url : props.chatData?.avatarFrame?.url
})

const avatarInnerStyle = computed(() => {
    const frame = props.msg.role === 'user' ? props.chatData?.userAvatarFrame : props.chatData?.avatarFrame
    if (frame) {
        return {
            inset: ((1 - (frame.scale || 1)) / 2 * 100) + '%',
            transform: `translate(${frame.offsetX || 0}px, ${frame.offsetY || 0}px)`
        }
    }
    return { inset: '0', transform: 'none' }
})

const computedBubbleStyle = computed(() => {
    if (!props.chatData?.bubbleCss) return {}
    const raw = props.chatData.bubbleCss
    if (raw.includes('|||')) {
        const parts = raw.split('|||')
        const styleStr = props.msg.role === 'user' ? (parts[1] || '') : parts[0]
        return parseBubbleCss(styleStr)
    }
    return parseBubbleCss(raw)
})

const shouldShowArrow = computed(() => {
    return false // 全局禁用箭头
})

// --- Methods (Ported) ---

function ensureString(val) {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return val.text || val.content || JSON.stringify(val);
    return String(val || '');
}


function formatTimelineTime(timestamp) {
    const now = new Date()
    const date = new Date(timestamp)
    const isToday = now.toDateString() === date.toDateString()
    const isYesterday = new Date(now - 86400000).toDateString() === date.toDateString()
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    if (isToday) return timeStr
    if (isYesterday) return `昨天 ${timeStr}`

    const isThisYear = now.getFullYear() === date.getFullYear()
    if (isThisYear) return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${timeStr}`
}

function isImageMsg(msg) {
    if (!msg) return false

    // 优先检查 msg.image 属性
    if (msg.image && (msg.image.startsWith('http') || msg.image.startsWith('data:'))) return true;

    // 检查消息类型
    if (msg.type === 'image') return true;

    const content = ensureString(msg.content)
    if (!content.trim()) return false

    // Direct Data/Blob URLs are always images
    if (content.includes('blob:') || content.includes('data:image/')) return true

    // If it's currently DRAWING, we want to show it as text (loading card)
    if ((msg.type === 'image' || msg.type === 'sticker') && content.toUpperCase().includes('[DRAW:')) return false;

    const clean = getCleanContent(content).trim()

    // URL check
    const isUrlOnly = clean.startsWith('http') && clean.split(/\s+/).length === 1 &&
        (clean.split('?')[0].toLowerCase().match(/\.(jpg|png|gif|jpeg|webp)$/i))
    if (isUrlOnly) return true;

    // Sticker check (Only return true if it exists or is a URL)
    const match = clean.match(STICKER_REGEX)
    if (match) {
        const c = match[1].trim()
        if (c.startsWith('http') || c.startsWith('blob:') || c.startsWith('data:')) return true

        // Return TRUE only if we have a standalone tag AND it's a known sticker
        // This ensures broken stickers fall back to text bubble
        const found = findSticker(c);
        if (found) {
            // Check if it's purely just the sticker tag
            const isTagOnly = /^\[(?:图片|IMAGE|表情包|表情-包|STICKER)[:：].*?\]$/i.test(clean)
            return isTagOnly
        }
    }

    return false
}

function isSticker(msg) {
    if (!msg) return false
    const content = ensureString(msg.content)
    return STICKER_REGEX.test(content)
}

const STICKER_REGEX = /\[(?:图片|IMAGE|表情包|表情-包|STICKER)[:：]\s*(.*?)\s*\]/i;

function normalizeStickerName(s) {
    if (!s) return '';
    return s.toString()
        .replace(/\.(?:png|jpg|gif|webp|jpeg|svg)$/i, '') // Remove standard extensions
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // Remove emojis
        .replace(/[。.，,！!？?\-\s\(\)（）"'"““”‘’\[\]]/g, '') // Remove punctuation, quotes and remaining brackets
        .toLowerCase()
        .trim();
}

function findSticker(name) {
    if (!name) return null;
    const n = name.trim();
    const nClean = normalizeStickerName(n);
    if (!nClean && !n) return null;

    const charStickers = props.chatData?.emojis || [];
    const globalStickers = stickerStore.getStickers('global') || [];
    const allAvailable = [...charStickers, ...globalStickers];

    // 1. Precise Match (Raw)
    let found = allAvailable.find(s => s.name === n);
    if (found) return found;

    // 2. Normalized Match
    found = allAvailable.find(s => normalizeStickerName(s.name) === nClean);
    if (found) return found;

    // 3. Fuzzy Match (Partial)
    if (nClean.length >= 1) {
        found = allAvailable.find(s => {
            const sClean = normalizeStickerName(s.name);
            return sClean && (sClean.includes(nClean) || nClean.includes(sClean));
        });
    }
    return found;
}

function getImageSrc(msg) {
    const content = ensureString(msg.content).trim()
    if (content.startsWith('data:image/')) return content
    const clean = getCleanContent(content).trim()

    // Direct URL check
    if (clean.startsWith('http') || clean.startsWith('blob:') || clean.startsWith('data:image/')) {
        const urlMatch = clean.match(/(?:https?|blob|data):[^\]\s]+/);
        if (urlMatch) return urlMatch[0];
    }

    const match = clean.match(STICKER_REGEX)
    if (match) {
        const c = match[1].trim()
        if (c.startsWith('http') || c.startsWith('blob:') || c.startsWith('data:')) return c

        // Robust Lookup
        const found = findSticker(c);
        if (found) return found.url;

        // Fallback to Dicebear INITIALS (using cleaned name)
        const seed = normalizeStickerName(c) || c;
        return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`
    }

    // Final check for the whole string being a valid URL/data URL
    if (clean.startsWith('http') || clean.startsWith('blob:') || clean.startsWith('data:image/')) {
        return clean;
    }

    return null
}

function formatMessageContent(msg) {
    if (!msg) return ''
    const textRaw = ensureString(msg.content)

    // 0. Performance: Don't parse massive image strings or blob URLs as markdown
    if (textRaw.length > 500 && (textRaw.includes('data:image/') || textRaw.includes('blob:'))) {
        return '';
    }

    // Force unescape specific chars before processing (Fix for garbled \n display)
    let text = getCleanContent(textRaw)

    // Safety check: ensure we didn't miss any double-escaped newlines
    if (text.includes('\\n')) {
        text = text.replace(/\\n/g, '\n');
    }

    // Continue chaining processing on the 'text' variable
    text = text.replace(/\[Image Reference ID:.*?\]/g, '') // Remove ID tags
        .replace(/Here is the original image:/gi, '') // Remove AI parroting
        .trim();

    // 2. Render [DRAW:...] as loading indicator
    if (msg.isDrawing !== false && /\[DRAW:\s*[\s\S]*?\]/i.test(text)) {
        text = text.replace(/\[DRAW:\s*([\s\S]*?)\]/gi, (match, prompt) => {
            const promptText = prompt.trim();
            const truncated = promptText.length > 30 ? promptText.substring(0, 30) + '...' : promptText
            return `<div class="inline-flex items-center gap-2 bg-blue-50/10 border border-blue-400/30 rounded-lg px-3 py-2 my-1 select-none backdrop-blur-sm shadow-sm overflow-hidden max-w-full">
                <i class="fa-solid fa-spinner fa-spin text-blue-400"></i>
                <span class="text-xs text-blue-200/80 whitespace-nowrap overflow-hidden text-ellipsis">AI 正在绘制: ${truncated}</span>
            </div>`
        })
    }

    // 6. Handle bracketed text (Small font styling)
    // Supports (), （）
    const bracketRegex = /([\(（][\s\S]*?[\)）])/g;
    text = text.replace(bracketRegex, '<span class="bracket-text">$1</span>');

    // text = text.replace(/\[(?:图片|IMAGE|表情包|STICKER)[:：].*?\]/gi, '') // DESTRUCTIVE: Removed to let inline replacer handle it

    // 5. Highlight Mentions (@name or @id)
    const userName = settingsStore.personalization.userProfile.name;
    const myName = props.chatData?.groupSettings?.myNickname || userName || '我';
    const contactName = props.chatData?.name;
    const allMembers = props.chatData?.isGroup ? '全体成员' : null;

    // Normalize AI referring to user generically
    text = text.replace(/@(user|User|我)(?!\w)/g, `@${myName}`);

    let namesToHighlight = [myName, userName, contactName, allMembers].filter(Boolean);

    if (props.chatData?.isGroup && Array.isArray(props.chatData.participants)) {
        props.chatData.participants.forEach(p => {
            if (p.id && p.name) {
                // Escapie id for regex just in case
                const escapedId = p.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const idRegex = new RegExp(`@${escapedId}`, 'g');
                text = text.replace(idRegex, `@${p.name}`);
                namesToHighlight.push(p.name);
            }
        });
    }

    // Deduplicate and sort by length descending to prevent double-wrapping (e.g., @Alice vs @Ali)
    namesToHighlight = [...new Set(namesToHighlight)].sort((a, b) => b.length - a.length);

    namesToHighlight.forEach(name => {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const mentionRegex = new RegExp(`@${escapedName}`, 'g')
        const isAll = name === allMembers
        const isMe = (name === myName || name === userName)

        // Improve styling: only highlight @Me and @All with background
        let highlightClass = ''
        if (isAll) {
            highlightClass = 'text-orange-600 bg-orange-100/80 px-1 rounded font-bold'
        } else if (isMe) {
            highlightClass = 'text-[#07c160] bg-[#07c160]/10 px-1 rounded font-bold'
        } else {
            // For others, just blue text (like a handle) but NO background to avoid confusion
            highlightClass = 'text-blue-500 font-medium'
        }
        text = text.replace(mentionRegex, `<span class="${highlightClass}">@${name}</span>`)
    });

    // --- STICKER INLINE REPLACER ---
    // Moved after marked.parse to prevent escaping
    let html = '';
    try {
        html = marked.parse(text);
    } catch (e) {
        html = text;
    }

    // Replace [StickerName] or [表情包: StickerName]
    html = html.replace(/\[(.*?)\]/g, (match, name) => {
        let n = name.trim()

        // Strip prefixes, but EXCLUDE DRAW commands
        // If it starts with DRAW:, it is NOT a sticker.
        if (n.toUpperCase().startsWith('DRAW:')) return match;

        const prefixMatch = n.match(/^(?:表情包|表情|STICKER|IMAGE|图片)[:：\-\s]\s*(.*)/i);
        if (prefixMatch) {
            n = prefixMatch[1].trim();
        }

        const found = findSticker(n);
        if (found) {
            return `<img src="${found.url}" class="w-16 h-16 inline-block mx-1 align-middle animate-bounce-subtle" alt="${found.name}" />`
        }

        // If it was a generated image URL directly in the tag, remove it
        if (n.startsWith('http') || n.includes('//')) {
            return '';
        }

        // Fallback: If sticker not found, return the original match to render as text
        // This allows the user to see the hallucinated name and edit it.
        return match;
    });

    // Also remove any standalone [图片:https...] URLs to prevent duplicate display for DRAW commands
    html = html.replace(/\[(?:图片|IMAGE|表情包|STICKER)[:：\-\s]*https?:\/\/[^\]]+\]/gi, '');

    // --- WECHAT EMOJI FALLBACK ---
    // Handle [微笑] [心] etc.
    html = parseWeChatEmojis(html);

    return html;
}

function getDuration(msg) {
    if (msg.duration) return msg.duration
    return Math.min(60, Math.max(1, Math.ceil(ensureString(msg.content).length / 3)))
}

function getPayTitle(msg) {
    const isTransfer = msg.type === 'transfer' || ensureString(msg.content).includes('[转账]')
    if (isTransfer) return `¥${msg.amount || '0.00'}`

    // For Red Packet
    return msg.note || '恭喜发财，大吉大利'
}

function getPayDesc(msg, chatData) {
    const isTransfer = msg.type === 'transfer' || ensureString(msg.content).includes('[转账]')
    if (isTransfer) return msg.note || '转账给您'

    // Private chat always shows '微信红包', group chat shows '微信手气红包' for lucky type
    if (chatData?.isGroup && msg.packetType === 'lucky') return '微信手气红包'
    return '微信红包'
}

function getPayStatusText(msg) {
    if (msg.isRejected) return '已拒收'
    if (msg.isClaimed || msg.status === 'received') {
        if (msg.type === 'transfer' || ensureString(msg.content).includes('[转账]')) return '已收款'
        return '已领取'
    }

    if (msg.type === 'redpacket' && msg.remainingCount === 0) return '已领完'

    const content = ensureString(msg.content)
    if (msg.type === 'transfer' || content.includes('[转账]')) return '待收款'
    return '待领取'
}

function getPayIcon(msg) {
    const isTransfer = msg.type === 'transfer' || ensureString(msg.content).includes('[转账]')
    if (isTransfer) return 'fa-solid fa-arrow-right-arrow-left'
    return 'fa-solid fa-envelope-open-text'
}

function parseBubbleCss(cssString) {
    if (!cssString || typeof cssString !== 'string') return {}
    const style = {}
    cssString.split(';').forEach(rule => {
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

function handleImageError(e) {
    const target = e.target;
    const retries = parseInt(target.getAttribute('data-retries') || '0');

    if (retries < 3) {
        console.log(`[ImageError] Retrying image load (${retries + 1}/3)...`);
        target.setAttribute('data-retries', retries + 1);

        // Add a small delay and try explicitly resetting src
        setTimeout(() => {
            const currentSrc = target.src;
            // Append a timestamp if it looks like a generic URL to force cache bust
            // But be careful with signed URLs
            if (currentSrc.includes('pollinations.ai') || currentSrc.includes('dicebear')) {
                const separator = currentSrc.includes('?') ? '&' : '?';
                target.src = currentSrc + separator + '_retry=' + Date.now();
            } else {
                target.src = currentSrc;
            }
        }, 1000);
        return;
    }

    target.src = '/broken-image.png'
    target.onerror = null
}

function previewImage(src) {
    // We could emit or just open. Original used window.open
    window.open(src, '_blank')
}

function handleToggleVoice() {
    localShowTranscript.value = !localShowTranscript.value
    // Only play voice for AI messages, not user's own voice messages
    if (props.msg.role !== 'user') {
        emit('play-voice', {
            msg: props.msg,
            showTranscript: localShowTranscript.value
        })
    }
    // Ensure isPlaying is properly initialized
    if (props.msg.isPlaying === undefined) {
        props.msg.isPlaying = false
    }
}

function handlePlayMusic() {
    const raw = ensureString(props.msg.content)
    // Clean protocol wrapping before playing
    const clean = raw.replace(/[\[\]]/g, '').replace(/^(演奏|MUSIC)[:：]?/i, '');
    musicBoxStore.playScore(clean)
}

// 处理订单卡片点击
function handleOrderCardClick(msg) {
    // 跳转到订单分享页面
    const orderId = msg.orderId
    router.push(`/share/order/${orderId}`)
}

// 获取订单标题
function getOrderTitle(msg) {
    if (msg.orderData?.items?.[0]?.title) {
        return msg.orderData.items[0].title
    }
    if (msg.content?.title) {
        return msg.content.title
    }
    return '订单分享'
}

// 获取订单图片
function getOrderImage(msg) {
    if (msg.orderData?.items?.[0]?.image) {
        return msg.orderData.items[0].image
    }
    if (msg.content?.image) {
        return msg.content.image
    }
    return 'https://via.placeholder.com/150?text=订单'
}

// 获取订单总价
function getOrderTotal(msg) {
    if (msg.orderData?.total) {
        return msg.orderData.total
    }
    if (msg.content?.total) {
        return msg.content.total
    }
    return '0'
}

// 获取订单状态文本
function getOrderStatusText(status) {
    const statusMap = {
        'pending': '待发货',
        'paid': '已付款',
        'shipped': '已发货',
        'shipping': '运输中',
        'delivering': '派送中',
        'completed': '已签收',
        'cancelled': '已取消'
    }
    return statusMap[status] || status
}

// 获取物流信息
function getOrderLogisticsInfo(msg) {
    // 从 orderData 中获取物流信息
    if (msg.orderData?.logistics?.status) {
        return msg.orderData.logistics.status
    }
    // 默认返回
    return '物流信息同步中...'
}

function emitContextMenu(event) {
    emit('context-menu', { msg: props.msg, event })
}

// Long Press Logic
let longPressTimer = null
function startLongPress(event) {
    // Capture coordinates immediately to prevent stale event issues
    const touch = event.touches ? event.touches[0] : event;
    const capturedEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => event.preventDefault?.()
    };

    longPressTimer = setTimeout(() => {
        emitContextMenu(capturedEvent)
    }, 500)
}
function cancelLongPress() {
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }
}

// Avatar Long Press Logic
let avatarLongPressTimer = null
let avatarLongPressTriggered = false

function startAvatarLongPress(msg, event) {
    avatarLongPressTriggered = false
    cancelAvatarLongPress()

    avatarLongPressTimer = setTimeout(() => {
        avatarLongPressTriggered = true
        emit('avatar-longpress', msg)
        avatarLongPressTimer = null
    }, 500)
}

function cancelAvatarLongPress() {
    if (avatarLongPressTimer) {
        clearTimeout(avatarLongPressTimer)
        avatarLongPressTimer = null
    }
}

function handleAvatarClick(msg) {
    if (avatarLongPressTriggered) {
        avatarLongPressTriggered = false // Reset
        return
    }
    emit('click-avatar', msg)
}

// Helper for SafeHtmlCard - 处理完整的[CARD]格式
function getHtmlContent(content) {
    if (!content) return ''
    try {
        let processed = content;

        // 1. 移除[INNER_VOICE]标签和内容（包括换行符）
        processed = processed.replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim();

        // 2. 检查是否是[CARD]格式
        if (processed.startsWith('[CARD]')) {
            // 移除[CARD]标签
            processed = processed.replace(/\[CARD\]/gi, '').trim();
            // 移除[/CARD]标签（如果存在）
            processed = processed.replace(/\[\/CARD\]/gi, '').trim();

            // 直接返回HTML内容（因为[CARD]格式中直接包含HTML）
            return processed;
        }

        // 3. 移除markdown反引号
        processed = processed.replace(/^```(?:html|json)?\n?|```$/gi, '').trim();

        // 3.1 鲁棒性：如果看起来是JSON但缺了大括号，补齐它
        if (!processed.startsWith('{') && (processed.includes('"type":') || processed.includes('"html":'))) {
            processed = '{' + processed + '}';
        } else if (processed.startsWith('{') && !processed.endsWith('}')) {
            processed = processed + '}';
        }

        // 4. 直接尝试解析整个处理后的内容为JSON
        try {
            let jsonData = JSON.parse(processed);
            if (jsonData.html && typeof jsonData.html === 'string') {
                return jsonData.html;
            } else if (jsonData.content && typeof jsonData.content === 'string') {
                return jsonData.content;
            }
        } catch (e) {
            // If direct parse fails, proceed to more aggressive extraction
            console.warn('[ChatMessageItem] Direct JSON parse failed, trying extraction');
        }

        // 5. 如果JSON解析成功但没有html或content字段，尝试直接返回
        return processed;

    } catch (e) {
        console.warn('[ChatMessageItem] 直接JSON解析失败，尝试提取JSON片段:', e);
        try {
            // 6. 尝试提取JSON片段
            let cleaned = content;

            // 重新处理原始内容
            cleaned = cleaned.replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim();
            cleaned = cleaned.replace(/\[CARD\]/gi, '').trim();
            cleaned = cleaned.replace(/\[\/CARD\]/gi, '').trim();
            cleaned = cleaned.replace(/^```(?:html|json)?\n?|```$/gi, '').trim();

            // 提取JSON对象
            let jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                let jsonData = JSON.parse(jsonMatch[0]);
                if (jsonData.html && typeof jsonData.html === 'string') {
                    return jsonData.html;
                } else if (jsonData.content && typeof jsonData.content === 'string') {
                    return jsonData.content;
                }
            } else {
                // 如果没有找到大括号，但包含HTML标签，直接返回HTML内容
                const htmlMatch = cleaned.match(/<div[\s\S]*<\/div>|<html[\s\S]*<\/html>|<style[\s\S]*<\/style>/i);
                if (htmlMatch) return htmlMatch[0];
            }

            // 7. 兜底：直接返回处理后的内容
            return cleaned;

        } catch (e2) {
            console.error('[ChatMessageItem] 所有解析尝试都失败了:', e2);
            return content;
        }
    }
}
// --- Group Vote Logic ---
const parsedVoteData = computed(() => {
    // Only show votes in group chats.
    if ((props.msg.type !== 'vote' && !props.msg.vote) || !props.chatData.isGroup) return null
    try {
        const data = props.msg.vote || (typeof props.msg.content === 'string' ? JSON.parse(props.msg.content) : props.msg.content)

        // Derive option voter lists for easy rendering
        const optionVoters = (data.options || []).map(() => [])
        Object.entries(data.votes || {}).forEach(([uid, oIdxs]) => {
            oIdxs.forEach(oIdx => {
                if (optionVoters[oIdx]) optionVoters[oIdx].push(uid)
            })
        })

        return {
            ...data,
            optionVoters // Array of arrays of userIds per option
        }
    } catch (e) {
        console.warn('[Vote] Parse error', e)
        return null
    }
})

const handleVoteToggle = (optionIndex) => {
    const v = parsedVoteData.value
    if (!v || v.isEnded) return

    const currentVotes = v.votes?.['user'] || []
    let newVotes = []

    if (v.isMultiple) {
        if (currentVotes.includes(optionIndex)) {
            newVotes = currentVotes.filter(i => i !== optionIndex)
        } else {
            newVotes = [...currentVotes, optionIndex]
        }
    } else {
        // Single choice: if already selected, unselect; else select
        newVotes = currentVotes.includes(optionIndex) ? [] : [optionIndex]
    }

    console.log('[Vote] Casting vote:', newVotes)
    chatStore.castVote(props.chatData.id, props.msg.id, 'user', newVotes)
}

const handleEndVote = () => {
    if (!parsedVoteData.value) return
    chatStore.endVote(props.chatData.id, props.msg.id)
}

const isOptionSelected = (optionIndex) => {
    const v = parsedVoteData.value
    if (!v || !v.votes) return false
    return v.votes['user']?.includes(optionIndex) || false
}

// --- Tarot Helpers ---
function getTarotCardColorClass(card) {
    if (card.id < 22) return 'from-purple-600 to-indigo-700' // 大阿卡纳
    if (card.suit === 'wands') return 'from-red-500 to-orange-600' // 权杖
    if (card.suit === 'cups') return 'from-blue-500 to-cyan-600' // 圣杯
    if (card.suit === 'swords') return 'from-yellow-500 to-amber-600' // 宝剑
    if (card.suit === 'pentacles') return 'from-green-500 to-emerald-600' // 星币
    return 'from-purple-600 to-indigo-700'
}

function getTarotCardIcon(card) {
    if (card.id < 22) return '🔮' // 大阿卡纳
    if (card.suit === 'wands') return '🔥' // 权杖
    if (card.suit === 'cups') return '💧' // 圣杯
    if (card.suit === 'swords') return '⚔️' // 宝剑
    if (card.suit === 'pentacles') return '💰' // 星币
    return '🔮'
}



const calculateVotePercent = (count) => {
    const total = getTotalVoters()
    if (total === 0) return 0
    return Math.round((count / total) * 100)
}

const getTotalVoters = () => {
    const v = parsedVoteData.value
    if (!v || !v.votes) return 0
    return Object.keys(v.votes).length
}

const getVoterAvatars = () => {
    const v = parsedVoteData.value
    if (!v || !v.votes) return []

    const allVoterIds = Object.keys(v.votes)
    return allVoterIds.map(voterId => getAvatarForUser(voterId))
}

const getAvatarForUser = (voterId) => {
    if (voterId === 'user') return settingsStore.personalization.userProfile.avatar || '/avatars/user.png'
    const participant = props.chatData.participants?.find(p => p.id === voterId)
    if (participant) return participant.avatar
    return `https://api.dicebear.com/7.x/initials/svg?seed=${voterId}`
}

// --- Vote Result Logic ---
const parsedVoteResult = computed(() => {
    // Accept explicit vote_result messages or any content that looks like a result object.
    let data = null
    try {
        data = typeof props.msg.content === 'string' ? JSON.parse(props.msg.content) : props.msg.content
    } catch (e) {
        return null
    }

    if (!data || typeof data !== 'object') return null

    // basic shape check - refId plus options/votes
    if (data.refId && data.options && data.votes) {
        return data
    }

    return null
})

const getTopOptions = () => {
    const res = parsedVoteResult.value
    if (!res || !res.options || !res.votes) return []
    const counts = res.options.map((opt, idx) => {
        let count = 0
        Object.values(res.votes).forEach(vArr => {
            if (vArr.includes(idx)) count++
        })
        return { text: typeof opt === 'string' ? opt : opt.text, count }
    })
    return counts.sort((a, b) => b.count - a.count).slice(0, 2)
}

const scrollToVote = (refId) => {
    if (!refId) return
    const el = document.getElementById(`msg-${refId}`)
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Add highlight effect
        el.classList.add('ring-2', 'ring-blue-400', 'rounded-2xl', 'transition-all', 'duration-1000')
        setTimeout(() => {
            el.classList.remove('ring-2', 'ring-blue-400')
        }, 2000)
    }
}

</script>

<style scoped>
/* Reuse styles from ChatWindow */
.chat-bubble-right {
    background-color: #95EC69;
    color: #000000;
    border: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: 12px 2px 12px 12px;
}

.chat-bubble-left {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: 2px 12px 12px 12px;
}

/* Voice bubble styles for Wujin theme */
/* For AI messages (left side) */
.h-10.rounded-lg.flex.items-center.px-4.cursor-pointer.relative.shadow-sm.min-w-\[80px\]:not(.bg-\[\#2e2e2e\]) {
    background: radial-gradient(circle at top left, #2a2520 0%, #0e0e10 100%) !important;
    border: 1px solid rgba(212, 175, 55, 0.2) !important;
    border-top: 1px solid rgba(212, 175, 55, 0.4) !important;
    color: #e6dcc0 !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6) !important;
    font-family: 'Noto Serif SC', serif !important;
    font-weight: 300 !important;
    letter-spacing: 0.5px !important;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) !important;
    border-radius: 2px 12px 12px 12px !important;
}

/* For user messages (right side) */
.h-10.rounded-lg.flex.items-center.px-4.cursor-pointer.relative.shadow-sm.min-w-\[80px\].bg-\[\#2e2e2e\] {
    background: radial-gradient(circle at top right, #374151 0%, #1f2937 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-top: 1px solid rgba(255, 255, 255, 0.2) !important;
    color: #e5e7eb !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4) !important;
    font-family: 'Noto Serif SC', serif !important;
    font-weight: 300 !important;
    letter-spacing: 0.5px !important;
    border-radius: 12px 2px 12px 12px !important;
}

/* Voice arrow styles */
/* For AI messages (left side) */
.absolute.top-3.w-0.h-0.border-y-\[6px\].border-y-transparent.border-r-\[6px\].border-r-black {
    border-right-color: #0e0e10 !important;
}

/* For user messages (right side) */
.absolute.top-3.w-0.h-0.border-y-\[6px\].border-y-transparent.border-l-\[6px\].border-l-\[\#2e2e2e\] {
    border-left-color: #1f2937 !important;
}

.voice-wave {
    display: flex;
    align-items: center;
    gap: 3px;
}

.bar {
    width: 3px;
    border-radius: 2px;
    background-color: currentColor;
    opacity: 0.8;
    animation: none;
}

/* Individual bar heights */
.bar1 {
    height: 5px;
}

.bar2 {
    height: 12px;
}

.bar3 {
    height: 16px;
}

.bar4 {
    height: 9px;
}

.bar5 {
    height: 14px;
}

/* Animation when playing */
.voice-wave.playing .bar {
    animation: voice-wave-anim 1s infinite ease-in-out;
}

/* Fix for voice playing effect */
.voice-playing-effect {
    animation: none !important;
}

.voice-wave.playing .bar1 {
    animation-delay: 0s;
}

.voice-wave.playing .bar2 {
    animation-delay: 0.1s;
}

.voice-wave.playing .bar3 {
    animation-delay: 0.2s;
}

.voice-wave.playing .bar4 {
    animation-delay: 0.3s;
}

.voice-wave.playing .bar5 {
    animation-delay: 0.4s;
}

/* Realistic wave animation */
@keyframes voice-wave-anim {

    0%,
    100% {
        height: 5px;
        opacity: 0.5;
    }

    20% {
        height: 16px;
        opacity: 0.9;
    }

    50% {
        height: 14px;
        opacity: 1;
    }

    90% {
        height: 13px;
        opacity: 0.9;
    }
}

.pay-card {
    transition: all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.pay-card:hover {
    transform: translateY(-2px);
}

.pay-card:active {
    transform: scale(0.96);
}

.pay-card img {
    pointer-events: none;
}

.pay-card i {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

/* Background Glow Effect */
.pay-card::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
}

.pay-card:hover::after {
    opacity: 1;
}

/* Family Card Black Gold Design - Credit Card Form Factor */
.family-card-wrapper {
    margin-top: 8px;
    width: 280px;
    perspective: 1000px;
}

.family-card-main {
    aspect-ratio: 1.58 / 1;
    background: linear-gradient(135deg, #2c2c2e 0%, #151517 100%);
    border: 1px solid rgba(212, 175, 55, 0.4);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 12px 25px rgba(0, 0, 0, 0.6);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.family-card-clickable {
    cursor: pointer;
    transition: all 0.2s ease;
}

.family-card-clickable:hover {
    transform: translateY(-2px);
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.7);
    border-color: rgba(212, 175, 55, 0.6);
}

.family-card-clickable:active {
    transform: translateY(0);
}

.family-card-chip {
    position: absolute;
    top: 40px;
    left: 16px;
    width: 32px;
    height: 24px;
    background: linear-gradient(135deg, #d4af37 0%, #907320 100%);
    border-radius: 4px;
    opacity: 0.6;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
}

.family-card-logo {
    position: absolute;
    top: 16px;
    right: 16px;
    font-size: 20px;
    color: rgba(212, 175, 55, 0.4);
}

.family-card-inner {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 14px;
}

.family-card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 0;
}

.family-card-icon {
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #1c1c1e;
    font-size: 11px;
}

.family-card-title {
    font-size: 13px;
    font-weight: 500;
    color: #d4af37;
    letter-spacing: 0.5px;
}

.family-card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-top: 32px;
    text-align: center;
}

.family-card-text {
    font-size: 14px;
    color: #ffffff;
    line-height: 1.4;
    font-family: "Songti SC", serif;
    margin-bottom: 12px;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    text-align: center;
    word-wrap: break-word;
    word-break: break-word;
    max-width: 100%;
    padding: 0 12px;
}

.msg-content {
    word-break: break-word;
}

@keyframes twinkle {

    0%,
    100% {
        opacity: 0.3;
        transform: scale(1);
    }

    50% {
        opacity: 1;
        transform: scale(1.2);
    }
}

.dice-msg-dice {
    animation: dice-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    opacity: 0;
}

@keyframes dice-pop {
    0% {
        opacity: 0;
        transform: scale(0) translateY(20px);
    }

    60% {
        transform: scale(1.2) translateY(-5px);
    }

    100% {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.animate-twinkle {
    animation: twinkle 1.5s ease-in-out infinite;
}

.family-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: auto;
}

.family-card-hint {
    margin-top: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
    font-style: italic;
}

.family-card-amount {
    font-size: 11px;
    color: #d4af37;
    font-weight: bold;
}

.family-card-status {
    font-size: 10px;
    color: rgba(212, 175, 55, 0.6);
    font-style: italic;
}

.family-card-reject-text {
    font-size: 11px;
    color: #ff6b6b;
    font-weight: bold;
}

.family-card-no {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    font-family: 'Courier New', Courier, monospace;
    letter-spacing: 1.5px;
}

.font-songti {
    font-family: "Songti SC", serif;
}

.animate-fade-in {
    animation: fadeIn 0.3s ease-out;
}

.animate-fade-in-down {
    animation: fadeInDown 0.3s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.animate-bounce-subtle {
    animation: bounce-subtle 2s infinite ease-in-out;
}

.bracket-text {
    font-size: 0.85em;
    opacity: 0.7;
    font-style: italic;
    color: inherit;
    display: inline-block;
    filter: brightness(0.9);
}

@keyframes bounce-subtle {

    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-3px);
    }
}

/* Custom scrollbar for tarot interpretation */
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(168, 85, 247, 0.5);
    border-radius: 2px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(168, 85, 247, 0.7);
}
</style>

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

                <!-- CASE 1: System / Recall Message / Error -->
                <div v-if="(msg.type === 'system' || msg.role === 'system' || msg.type === 'error') && getCleanContent(msg.content)"
                    class="system-chip animate-fade-in"
                    :class="{ 'chat-bg-dark': chatData?.bgTheme === 'dark' }"
                    @contextmenu.prevent="emitContextMenu">
                    <div class="system-chip-content"
                        :class="[ msg.isRecallTip ? 'cursor-pointer hover:bg-opacity-80 transition-colors' : '' ]" 
                        @click="msg.isRecallTip && (localShowDetail = !localShowDetail)">
                        <i v-if="msg.type === 'error'" class="fa-solid fa-circle-info opacity-70 mr-1.5"></i>
                        <span>{{ getCleanContent(msg.content) }}</span>
                    </div>
                    <!-- Foldable Content -->
                    <div v-if="localShowDetail && msg.realContent"
                        class="mt-1.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500 max-w-[80%] break-all shadow-sm animate-fade-in-down">
                        <div class="mb-0.5 text-gray-400 text-[10px]">原内容:</div>
                        {{ getCleanContent(msg.realContent) }}
                    </div>
                </div>

                <div v-else-if="isValidMessage" class="flex gap-2 animate-fade-in"
                    :class="[
                        msg.role === 'user' ? 'flex-row-reverse' : '',
                        (msg.type === 'html' || isHtmlCard) ? 'w-full justify-center' : 'w-full'
                    ]">

                    <!-- Avatar -->
                    <div v-if="!forceOffline && shouldShowAvatar" class="relative w-10 h-10 shrink-0 cursor-pointer z-10 overflow-visible"
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
                        (msg.type === 'html' || isHtmlCard) ? 'max-w-[82%]' : (parsedVoteData ? 'max-w-[80%] w-full' : 'max-w-[80%]'),
                        isCenteredContent ? 'w-full items-center' : ''
                    ]">
                        <!-- New: Sender Name and Title for Group Chats -->
                        <div v-if="!forceOffline && chatData?.isGroup && msg.role !== 'system'"
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
                            ]" @click="$emit('click-gift', msg)" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">

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

                                <!-- Description -->
                                <div class="bg-white/10 rounded-lg p-2 border border-white/10">
                                    <p class="text-white/80 text-xs leading-relaxed line-clamp-2">{{
                                        msg.giftDescription || '一件珍贵的礼物' }}</p>
                                </div>

                                <!-- Note -->
                                <div v-if="msg.giftNote" class="bg-black/5 rounded-lg p-2 border border-white/10">
                                    <p class="text-white/90 text-xs leading-relaxed italic line-clamp-2">"{{
                                        msg.giftNote }}"</p>
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
                            ]" @click="handleOrderCardClick(msg)" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">

                            <!-- 头部 -->
                            <div class="p-4 flex flex-col gap-3 relative overflow-hidden">
                                <!-- 装饰图案 -->
                                <div class="absolute top-0 left-0 w-full h-full opacity-10">
                                    <div class="absolute top-2 left-2 w-8 h-8 border-2 border-white rounded-full"></div>
                                    <div class="absolute bottom-2 right-2 w-12 h-12 border-2 border-white rounded-full">
                                    </div>
                                </div>

                                <div class="relative z-10 flex items-center gap-3">
                                    <div
                                        class="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                                        <span class="text-3xl">📦</span>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div
                                            class="text-white text-xs font-black uppercase tracking-widest opacity-80 mb-0.5">
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
                                    <img :src="msg.orderData.items[0].image"
                                        class="w-16 h-16 rounded-xl object-cover bg-slate-100">
                                    <div class="flex-1 min-w-0">
                                        <h4 class="text-sm font-bold text-slate-800 line-clamp-2">
                                            {{ msg.orderData.items[0].title }}
                                        </h4>
                                        <p class="text-xs text-slate-400 mt-1">订单号：{{ msg.orderId }}</p>
                                    </div>
                                </div>
                                <div v-else class="flex items-center gap-3 mb-3">
                                    <div
                                        class="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-3xl">
                                        📦</div>
                                    <div class="flex-1">
                                        <h4 class="text-sm font-bold text-slate-800">订单分享</h4>
                                        <p class="text-xs text-slate-400 mt-1">订单号：{{ msg.orderId }}</p>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <span class="text-xs text-slate-500">实付金额</span>
                                    <span class="text-lg font-black text-orange-600">¥{{ msg.orderData?.total || '0'
                                        }}</span>
                                </div>
                            </div>

                            <!-- 物流信息 -->
                            <div v-if="msg.orderData?.status"
                                class="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-t border-orange-100">
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
                            <div v-else
                                class="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-t border-orange-100">
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
                            ]" @click="$emit('click-gift', msg)" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">

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

                                <!-- Description -->
                                <div class="bg-white/10 rounded-lg p-2 border border-white/10">
                                    <p class="text-white/80 text-xs leading-relaxed line-clamp-2">{{
                                        msg.giftDescription || '一件珍贵的礼物' }}</p>
                                </div>

                                <!-- Claim Info -->
                                <div v-if="msg.giftNote" class="bg-black/5 rounded-lg p-2 border border-white/10">
                                    <p class="text-white/90 text-xs leading-relaxed italic line-clamp-2">"{{
                                        msg.giftNote }}"</p>
                                </div>
                                <div class="mt-2 pt-2 border-t border-white/20">
                                    <div class="flex items-center gap-2">
                                        <img :src="msg.claimantAvatar" class="w-4 h-4 rounded-full object-cover">
                                        <span class="text-white/80 text-xs">{{ msg.claimantName }} 领取了这份礼物</span>
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
                            ]" @click="$emit('click-pay', msg)" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">

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
                                    <div class="text-white/70 text-[10px] truncate">{{ getPayDesc(msg, chatData) }}
                                    </div>
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
                                @contextmenu.prevent="emitContextMenu"
                                @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                                @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">

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
                                @contextmenu.prevent="emitContextMenu"
                                @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                                @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">

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
                        
                        <!-- CASE: HTML Card (from [CARD] tag or type: html) -->
                        <div v-else-if="msg.type === 'card' || msg.type === 'html'"
                            class="w-full max-w-[280px] mt-1"
                            @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                            <SafeHtmlCard :content="getPureHtml(msg.html || msg.content)" />
                        </div>
                        
                        <!-- CASE: Forum Share Card -->
                        <div v-else-if="parsedForumCard"
                            class="max-w-[280px] bg-white rounded-2xl shadow-sm border border-teal-50 overflow-hidden cursor-pointer active:scale-95 transition-transform duration-200 select-none animate-fade-in group mt-1"
                            @click="handleForumCardClick" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                            <!-- Header -->
                            <div class="px-4 py-2.5 bg-gradient-to-r from-teal-400 to-emerald-400 flex items-center justify-between">
                                <div class="flex items-center gap-1.5 text-white shadow-sm">
                                    <i class="fa-brands fa-pagelines text-[13px]"></i>
                                    <span class="text-[11px] font-bold tracking-widest drop-shadow-sm">星愿社区分享</span>
                                </div>
                                <div class="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                                    <i class="fa-solid fa-seedling text-white text-[10px]"></i>
                                </div>
                            </div>
                            
                            <!-- Content -->
                            <div class="p-4 flex flex-col gap-2 relative overflow-hidden bg-[#f4f9f9]">
                                <div class="absolute -right-4 -bottom-4 text-[60px] text-teal-500 opacity-5 pointer-events-none">
                                    <i class="fa-solid fa-leaf"></i>
                                </div>
                                <div class="text-[14px] font-black text-slate-800 line-clamp-2 leading-snug group-hover:text-teal-600 transition-colors relative z-10 drop-shadow-sm">
                                    {{ parsedForumCard.title }}
                                </div>
                                <div class="bg-white p-3 rounded-xl border border-teal-100/50 shadow-inner relative z-10">
                                    <div class="text-[12px] text-slate-500 line-clamp-3 leading-relaxed break-words font-medium">
                                        {{ parsedForumCard.preview }}
                                    </div>
                                </div>
                                <div class="mt-1 pt-2 border-t border-teal-50 flex justify-between items-center text-[10px] text-teal-800/60 font-medium relative z-10">
                                    <span>点击进入主页查看全部评论</span>
                                    <i class="fa-solid fa-chevron-right text-[8px]"></i>
                                </div>
                            </div>
                        </div>

                        <!-- CASE 6: Favorite Card (Shared Favorite) -->
                        <div v-else-if="isFavoriteCard"
                            class="max-w-[280px] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer active:scale-95 transition-transform duration-200 select-none animate-fade-in"
                            @click="$router.push('/favorites/' + favoriteCardData.favoriteId)" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
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

                        <!-- CASE: Music Share Card (Listen Together) -->
                        <div v-else-if="msg.type === 'music_share'" class="w-full max-w-[280px]"
                            @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                            <div class="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-4 border border-blue-100 shadow-sm flex items-center gap-4 cursor-pointer active:scale-95 transition-all"
                                @click="musicStore.togglePlayer()">
                                <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center relative overflow-hidden">
                                     <i class="fa-solid fa-music text-blue-400 text-xl absolute z-10" :class="{ 'animate-pulse': musicStore.isPlaying }"></i>
                                     <div v-if="musicStore.isPlaying" class="absolute inset-0 bg-blue-400/5 animate-pulse"></div>
                                </div>
                                <div class="flex-1 overflow-hidden">
                                    <div class="text-[14px] font-bold text-slate-800 truncate">{{ msg.content }}</div>
                                    <div class="text-[11px] text-slate-400 font-medium">正在一起听歌...</div>
                                </div>
                                <div class="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
                                     <i class="fa-solid text-blue-500 text-sm" :class="musicStore.isPlaying ? 'fa-pause' : 'fa-play'"></i>
                                </div>
                            </div>
                        </div>

                        <!-- Music (Replicated from old version) -->
                        <div v-else-if="msg.type === 'music'" class="flex flex-col w-full"
                            :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                            <div class="voice-container">
                                <!-- ✅ 修复：语音气泡样式遵循全局 bubbleCss 规则 -->
                                <div class="voice-bubble music-bubble chat-bubble-voice"
                                    :class="msg.role === 'user' ? 'chat-bubble-right' : 'chat-bubble-left'"
                                    :style="[
                                        getVoiceBubbleStyle(),
                                        computedBubbleStyle
                                    ]"
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

                        <!-- Timer Reminder -->
                        <div v-else-if="msg.type === 'timer'" class="flex flex-col w-full"
                            :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                            <div class="timer-bubble chat-bubble"
                                :class="msg.role === 'user' ? 'chat-bubble-right' : 'chat-bubble-left'"
                                :style="computedBubbleStyle">
                                <div class="flex items-center gap-2">
                                    <i class="fa-solid fa-clock text-amber-500"></i>
                                    <span class="text-sm font-medium">定时提醒</span>
                                </div>
                                <div class="mt-1 text-sm opacity-90">{{ msg.content }}</div>
                            </div>
                        </div>

                        <!-- Search Result -->
                        <div v-else-if="msg.type === 'search'" class="flex flex-col w-full"
                            :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                            <div class="search-bubble chat-bubble"
                                :class="msg.role === 'user' ? 'chat-bubble-right' : 'chat-bubble-left'"
                                :style="computedBubbleStyle">
                                <div class="flex items-center gap-2">
                                    <i class="fa-solid fa-magnifying-glass text-blue-500"></i>
                                    <span class="text-sm font-medium">搜索</span>
                                </div>
                                <div class="mt-1 text-sm opacity-90">{{ msg.content }}</div>
                            </div>
                        </div>

                        <!-- Almanac / Fortune -->
                        <div v-else-if="msg.type === 'almanac'" class="flex flex-col w-full"
                            :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                            <div class="almanac-bubble chat-bubble"
                                :class="msg.role === 'user' ? 'chat-bubble-right' : 'chat-bubble-left'"
                                :style="computedBubbleStyle">
                                <div class="flex items-center gap-2">
                                    <i class="fa-solid fa-calendar-days text-red-500"></i>
                                    <span class="text-sm font-medium">今日运势</span>
                                </div>
                                <div class="mt-1 text-sm opacity-90">{{ msg.content }}</div>
                            </div>
                        </div>

                        <!-- Voice (Moved up) -->
                        <div v-else-if="msg.type === 'voice'" class="flex flex-col w-full"
                            :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                            <div class="flex items-center gap-2" :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
                                <div class="h-10 rounded-lg flex items-center px-4 cursor-pointer relative shadow-sm min-w-[80px] chat-bubble-voice"
                                    :class="[
                                        msg.role === 'user' ? 'chat-bubble-right flex-row-reverse' : 'chat-bubble-left',
                                        (msg.isPlaying || false) ? 'voice-playing-effect' : ''
                                    ]"
                                    :style="[
                                        { width: Math.max(80, 40 + getDuration(msg) * 5) + 'px', maxWidth: '200px', fontSize: (chatData?.bubbleSize || 15) + 'px' },
                                        computedBubbleStyle
                                    ]"
                                    @click="handleToggleVoice" @contextmenu.prevent="emitContextMenu"
                                    @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                                    @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">

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
                                        :class="msg.role === 'user' ? 'right-[-6px] border-l-[6px]' : 'left-[-6px] border-r-[6px]'"
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
                            @click="$router.push('/weibo')" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
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
                        <div v-else-if="isDiceMsg" class="flex flex-col gap-2 w-[280px] mb-2"
                            :class="msg.role === 'user' ? 'mr-1' : 'ml-1'"
                            @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                            
                            <!-- Premium Dice Card -->
                            <div class="w-full p-3 rounded-2xl shadow-lg border relative overflow-hidden transition-all duration-300 hover:shadow-xl"
                                :class="msg.role === 'user' 
                                    ? 'bg-gradient-to-br from-purple-50 to-white border-purple-200' 
                                    : 'bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 border-white/50'">

                                <!-- Decorative Stars (Only for AI/Premium look) -->
                                <template v-if="msg.role !== 'user'">
                                    <div class="absolute top-2 left-2 text-yellow-400 text-xs animate-twinkle z-0">✨</div>
                                    <div class="absolute top-3 right-3 text-purple-400 text-xs animate-twinkle z-0" style="animation-delay: 0.5s">⭐</div>
                                    <div class="absolute bottom-2 left-3 text-pink-400 text-xs animate-twinkle z-0" style="animation-delay: 1s">✨</div>
                                </template>

                                <div class="bg-white/80 backdrop-blur-sm rounded-xl p-4 relative z-10 border border-white/40">
                                    <div class="flex items-center justify-between mb-3">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xl">🎲</span>
                                            <span class="text-sm font-bold" :class="msg.role === 'user' ? 'text-purple-600' : 'text-purple-700'">摇骰子</span>
                                        </div>
                                        <div class="flex gap-1">
                                            <span v-if="diceResultsValue.length > 1 && diceResultsValue.every(r => r === diceResultsValue[0])"
                                                class="text-[10px] bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2 py-0.5 rounded-full font-bold animate-pulse shadow-sm">豹子!</span>
                                            <span v-else-if="diceTotalValue >= diceCountValue * 6 * 0.8"
                                                class="text-[10px] bg-gradient-to-r from-purple-400 to-pink-400 text-white px-2 py-0.5 rounded-full font-bold animate-pulse shadow-sm">大吉!</span>
                                            <span v-else-if="diceTotalValue <= diceCountValue * 2"
                                                class="text-[10px] bg-gradient-to-r from-blue-400 to-blue-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse shadow-sm">加油!</span>
                                        </div>
                                    </div>

                                    <!-- Dice Visuals -->
                                    <div class="flex justify-center flex-wrap gap-2 mb-4">
                                        <div v-for="(r, i) in diceResultsValue" :key="i"
                                            class="w-14 h-14 rounded-2xl shadow-sm flex items-center justify-center border-2 transition-all hover:scale-110 active:scale-95 duration-300"
                                            :class="msg.role === 'user' 
                                                ? 'bg-white border-purple-200' 
                                                : 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100'"
                                            :style="{ animationDelay: (i * 100) + 'ms' }">
                                            <i class="fa-solid text-4xl drop-shadow-sm dice-msg-dice"
                                                :class="[
                                                    'fa-dice-' + ['one', 'two', 'three', 'four', 'five', 'six'][r - 1],
                                                    msg.role === 'user' ? 'text-purple-500' : 'text-purple-600'
                                                ]">
                                            </i>
                                        </div>
                                    </div>

                                    <!-- Score Display -->
                                    <div class="bg-gray-50/50 rounded-xl p-3 border border-gray-100 flex flex-col items-center">
                                        <div class="flex items-center gap-2 mb-2">
                                            <span class="text-xs text-gray-500">合计点数</span>
                                            <span class="text-3xl font-black italic tracking-tighter" 
                                                :class="msg.role === 'user' ? 'text-purple-600' : 'text-purple-700'">
                                                {{ diceTotalValue }}
                                            </span>
                                            <span class="text-[10px] text-gray-400 font-mono">/ {{ diceCountValue * 6 }}</span>
                                        </div>
                                        <!-- Progress Bar -->
                                        <div class="w-full h-1.5 bg-gray-200/50 rounded-full overflow-hidden shadow-inner">
                                            <div class="h-full rounded-full transition-all duration-1000 ease-out"
                                                :class="msg.role === 'user' ? 'bg-purple-500' : 'bg-gradient-to-r from-purple-400 to-pink-400'"
                                                :style="{ width: ((diceTotalValue / (diceCountValue * 6)) * 100) + '%' }">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- CASE: Tarot Result Card -->
                        <div v-else-if="isTarotMsg" class="flex flex-col gap-2 w-[300px]"
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
                                        <span class="text-sm font-bold text-white">{{ tarotDataValue?.interpretation ? '塔罗解牌' :
                                            '塔罗占卜' }}</span>
                                    </div>

                                    <!-- 问题显示 -->
                                    <div v-if="tarotDataValue?.question" class="mb-3 bg-white/10 rounded-lg p-2">
                                        <p class="text-xs text-purple-200 mb-1">问题</p>
                                        <p class="text-sm text-white">{{ tarotDataValue.question }}</p>
                                    </div>

                                    <!-- 牌阵名称 -->
                                    <div class="text-xs text-purple-300 mb-3">{{ tarotDataValue?.spread?.name }}</div>

                                    <!-- 塔罗牌展示 -->
                                    <div v-if="tarotDataValue?.cards && tarotDataValue.cards.length > 0" class="flex justify-center gap-2 mb-3 flex-wrap">
                                        <div v-for="(card, i) in tarotDataValue.cards.slice(0, 5)" :key="i"
                                            class="w-10 h-14 rounded-lg border border-purple-400/50 flex flex-col items-center justify-center"
                                            :class="getTarotCardColorClass(card)"
                                            :style="{ animationDelay: (i * 100) + 'ms' }">
                                            <span class="text-sm">{{ getTarotCardIcon(card) }}</span>
                                            <span v-if="card.isReversed" class="text-[6px] text-white/70">逆</span>
                                        </div>
                                        <div v-if="tarotDataValue.cards.length > 5"
                                            class="w-10 h-14 rounded-lg border border-purple-400/30 bg-white/10 flex items-center justify-center">
                                            <span class="text-xs text-white/70">+{{ tarotDataValue.cards.length - 5 }}</span>
                                        </div>
                                    </div>

                                    <!-- 解牌内容 -->
                                    <div v-if="tarotDataValue?.interpretation"
                                        class="bg-white/10 rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar">
                                        <p class="text-xs text-purple-200 mb-1">解牌</p>
                                        <p class="text-sm text-white leading-relaxed whitespace-pre-wrap">{{
                                            tarotDataValue.interpretation }}</p>
                                    </div>

                                    <!-- 简单提示 -->
                                    <div v-else-if="tarotDataValue?.cards && tarotDataValue.cards.length > 0" class="text-xs text-purple-300">
                                        抽到了 {{ tarotDataValue.cards.length }} 张塔罗牌
                                    </div>
                                    
                                    <!-- 等待解牌提示 -->
                                    <div v-else class="text-xs text-purple-300">
                                        等待塔罗解牌...
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- CASE: Love Space Invite Card -->
                        <div v-else-if="isLoveSpaceInvite && parsedLoveSpaceInvite"
                            class="max-w-[280px] bg-white rounded-2xl shadow-xl border border-pink-100/50 overflow-hidden cursor-pointer active:scale-95 transition-all duration-300 select-none animate-fade-in group mt-1"
                            @click="handleLoveSpaceInviteClick" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                            <div class="px-5 py-4 bg-gradient-to-br from-pink-400 via-rose-400 to-rose-500 relative overflow-hidden">
                                <div class="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
                                <div class="flex items-center gap-3 text-white relative z-10">
                                    <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-inner">
                                        <i class="fa-solid fa-heart text-[18px] animate-beat text-rose-100"></i>
                                    </div>
                                    <div class="flex flex-col">
                                        <span class="text-[14px] font-black tracking-widest text-white uppercase drop-shadow-md">情侣空间邀请</span>
                                        <span class="text-[9px] text-pink-50 font-medium opacity-80 letter-spacing-1">Invitation Link</span>
                                    </div>
                                </div>
                            </div>
                            <div class="p-5 bg-gradient-to-b from-white to-pink-50 flex flex-col gap-4">
                                <div class="flex items-center gap-3">
                                   <div class="w-1 h-8 bg-pink-300 rounded-full"></div>
                                   <p class="text-[13px] text-gray-700 font-bold leading-tight line-clamp-2">"我想和你开启一段专属的甜蜜旅程，记录我们的点点滴滴..."</p>
                                </div>
                                <div class="flex items-center justify-between px-4 py-2 bg-rose-500/10 rounded-full border border-rose-200 text-rose-600 font-black text-[11px] shadow-sm hover:bg-rose-500 hover:text-white transition-colors duration-300">
                                    <span>点击进入并同意</span>
                                    <i class="fa-solid fa-chevron-right text-[9px] animate-bounce-x"></i>
                                </div>
                            </div>
                        </div>

                        <!-- CASE: Love Space Contract Card -->
                        <div v-else-if="isLoveSpaceContract && parsedLoveSpaceContract"
                            class="max-w-[300px] bg-white rounded-2xl shadow-2xl border-[4px] border-double border-pink-100/80 overflow-hidden cursor-pointer active:scale-95 transition-all duration-500 select-none animate-scale-in mt-1 relative"
                            @click="handleLoveSpaceInviteClick" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                            <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-pink-50/50 via-transparent to-transparent pointer-events-none"></div>
                            <div class="p-6 flex flex-col items-center gap-5 relative z-10">
                                <div class="relative flex items-center justify-center w-full py-2">
                                    <div class="absolute w-[80%] h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent"></div>
                                    <div class="bg-white px-4 relative z-10 transform scale-110">
                                        <i class="fa-solid fa-crown text-pink-300 text-sm"></i>
                                    </div>
                                </div>
                                
                                <div class="flex items-center gap-5">
                                    <div class="relative group">
                                        <div class="absolute inset-0 bg-pink-400 rounded-full blur group-hover:blur-md transition-all"></div>
                                        <img :src="chatData.userAvatar" class="w-14 h-14 rounded-full border-2 border-white relative z-10 object-cover">
                                        <div class="absolute -right-1 -bottom-1 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center text-[10px] text-white shadow-lg ring-2 ring-white z-20">
                                            <i class="fa-solid fa-check"></i>
                                        </div>
                                    </div>
                                    <div class="text-pink-400 animate-heart-beat-fast flex flex-col items-center">
                                        <i class="fa-solid fa-heart-pulse text-3xl drop-shadow-sm"></i>
                                        <span class="text-[8px] font-black mt-1 opacity-50 uppercase tracking-tighter">Connected</span>
                                    </div>
                                    <div class="relative group">
                                        <div class="absolute inset-0 bg-rose-300 rounded-full blur group-hover:blur-md transition-all"></div>
                                        <img :src="chatData.avatar" class="w-14 h-14 rounded-full border-2 border-white relative z-10 object-cover">
                                        <div class="absolute -right-1 -bottom-1 w-6 h-6 bg-rose-400 rounded-full flex items-center justify-center text-[10px] text-white shadow-lg ring-2 ring-white z-20">
                                            <i class="fa-solid fa-check"></i>
                                        </div>
                                    </div>
                                </div>

                                <div class="text-center">
                                    <h5 class="text-[16px] font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-rose-500 mb-1 tracking-[0.2em]">专属契约正式达成</h5>
                                    <div class="inline-block px-3 py-0.5 bg-pink-100/50 rounded-full">
                                        <p class="text-[11px] text-pink-500 font-bold">相恋第 {{ parsedLoveSpaceContract.days }} 天</p>
                                    </div>
                                </div>
                                
                                <blockquote class="text-[10px] text-gray-400 italic font-medium text-center border-l-2 border-pink-100 pl-3 py-1">
                                    "此契约见证：所有的温柔都将为你留存"
                                </blockquote>
                            </div>
                            <div class="bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 text-center active:brightness-90 transition-all shadow-inner" @click.stop="router.push('/couple')">
                                <span class="text-[11px] font-black text-white tracking-[0.3em] drop-shadow-sm">立即进入空间</span>
                            </div>
                        </div>

                        <!-- CASE: Love Space Reject Card -->
                        <div v-else-if="isLoveSpaceReject && parsedLoveSpaceReject"
                            class="max-w-[280px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-lg border border-gray-200 overflow-hidden cursor-default select-none animate-fade-in mt-1 opacity-75">
                            <div class="px-4 py-3 bg-gradient-to-br from-gray-400 to-gray-500 relative overflow-hidden">
                                <div class="absolute -right-3 -top-3 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
                                <div class="flex items-center gap-3 text-white relative z-10">
                                    <div class="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                        <i class="fa-solid fa-heart-crack text-[16px] text-gray-200"></i>
                                    </div>
                                    <div class="flex flex-col">
                                        <span class="text-[13px] font-bold text-white">情侣空间邀请已失效</span>
                                        <span class="text-[8px] text-gray-200">Invitation Expired</span>
                                    </div>
                                </div>
                            </div>
                            <div class="p-4 bg-white">
                                <div class="flex items-start gap-3">
                                    <div class="w-1 h-6 bg-gray-300 rounded-full shrink-0 mt-0.5"></div>
                                    <p class="text-[12px] text-gray-600 leading-relaxed italic">
                                        "对方暂时拒绝了你的邀请，也许现在还不是最好的时机..."
                                    </p>
                                </div>
                                <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400">
                                    <i class="fa-solid fa-hourglass-end text-[10px]"></i>
                                    <span class="text-[9px] font-medium">邀请已失效，可以继续聊天增进感情</span>
                                </div>
                            </div>
                        </div>

                        <!-- CASE: Moment Share Card -->
                        <div v-else-if="isMomentCard && momentDataValue"
                            class="max-w-[260px] animate-fade-in mt-1 overflow-hidden"
                            :class="msg.role === 'user' ? 'mr-1' : 'ml-1'"
                            @click="navigateToMoment(msg)" @contextmenu.prevent="emitContextMenu"
                            @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                            @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress">
                            <MomentShareCard :data="momentDataValue" />
                        </div>

                        <!-- CASE: Location / Scene Tag (Premium Glassmorphism) -->
                        <div v-else-if="msg.type === 'location'"
                            class="w-full flex justify-center my-6 px-4 animate-scale-in"
                            @contextmenu.prevent="emitContextMenu">
                            <div class="relative group max-w-[90%]">
                                <!-- Ambient Glow -->
                                <div class="absolute inset-0 bg-indigo-500/10 blur-[40px] rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-1000"></div>
                                <!-- Main Glass Backdrop -->
                                <div class="relative bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl px-10 py-5 flex flex-col items-center gap-2.5 shadow-[0_12px_48px_rgba(0,0,0,0.4)] ring-1 ring-white/10 transition-all hover:bg-white/10 hover:border-white/20">
                                    <div class="flex items-center gap-3">
                                        <div class="w-1.5 h-7 bg-gradient-to-b from-indigo-400 via-purple-500 to-indigo-600 rounded-full shadow-[0_0_15px_rgba(129,140,248,0.6)]"></div>
                                        <span class="text-[10px] font-black text-indigo-300/80 uppercase tracking-[0.4em] select-none">Theater Locale</span>
                                    </div>
                                    <h4 class="text-xl md:text-2xl font-black text-white/95 text-center leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] tracking-widest font-songti">
                                        {{ formatLocation(msg.content) }}
                                    </h4>
                                    <div class="flex items-center gap-2.5 mt-1.5">
                                        <div class="flex gap-1">
                                            <span class="w-1 h-3 bg-indigo-400/40 rounded-full animate-pulse"></span>
                                            <span class="w-1 h-4 bg-indigo-400/60 rounded-full animate-pulse [animation-delay:0.2s]"></span>
                                            <span class="w-1 h-3 bg-indigo-400/40 rounded-full animate-pulse [animation-delay:0.4s]"></span>
                                        </div>
                                        <span class="text-[8px] text-white/20 font-bold uppercase tracking-[0.2em] select-none">Environment Active</span>
                                    </div>
                                </div>
                                <!-- Subtle Corner Accents -->
                                <div class="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white/5 rounded-tr-lg"></div>
                                <div class="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white/5 rounded-bl-lg"></div>
                            </div>
                        </div>

                        <!-- Universal Mixed Content Wrapper (Image / HTML / Text) -->
                        <div v-else class="flex flex-col gap-2"
                            :class="[
                                msg.role === 'user' ? 'items-end' : 'items-start',
                                (msg.type === 'html' || isHtmlCard) ? 'items-center' : ''
                            ]">

                            <!-- 0. Inner Voice Block -->
                            <div v-if="parsedInnerVoice" class="w-full mb-1">
                                <div class="bg-gray-50/50 rounded-xl p-3 border border-pink-100 flex flex-col gap-1 shadow-inner" style="backdrop-filter: blur(4px);">
                                    <div class="flex items-center gap-2 mb-1">
                                        <i class="fa-solid fa-heart-pulse text-pink-400 text-xs animate-pulse"></i>
                                        <span class="text-[9px] font-bold text-pink-300 uppercase tracking-widest">Inner State</span>
                                    </div>
                                    <div v-if="typeof parsedInnerVoice === 'object'" class="flex flex-col gap-1">
                                        <div v-for="(val, key) in parsedInnerVoice" :key="key" class="flex items-baseline gap-2">
                                            <span v-if="!['date', 'time', 'stats', 'emotion'].includes(key)" class="text-[10px] font-bold text-gray-400 capitalize shrink-0">{{ key }}:</span>
                                            <span v-if="!['date', 'time', 'stats', 'emotion'].includes(key)" class="text-[12px] text-gray-500 italic leading-relaxed break-words font-medium">{{ val }}</span>
                                        </div>
                                    </div>
                                    <div v-else class="text-[12px] text-gray-500 italic leading-relaxed break-words font-medium">
                                        {{ parsedInnerVoice }}
                                    </div>
                                </div>
                            </div>

                            <!-- 1. Text Bubble Layer (Sticker / Text) -->
                            <!-- Show bubble if there's cleaned content and not a family card. -->
                            <!-- Added check for isDiceMsg to prevent double rendering/bubble background for dice rolls -->
                            <!-- Split into multiple bubbles for multi-paragraph AI messages -->
                            <!-- Scene change hint (online mode only) -->
                            <div v-if="hasSceneChange && !forceOffline" class="scene-change-hint">
                                <i class="fa-solid fa-arrows-rotate"></i>
                                <span>已更换场景</span>
                            </div>
                            
                            <template v-for="(segment, segIndex) in contentSegments" :key="segIndex">
                                <div v-if="segment && !isImageMsg(msg) && !isFamilyCard && !isFamilyCardApply && !isFamilyCardReject && !shouldRenderCard && !isDiceMsg && !isTarotMsg" 
                                    @contextmenu.prevent="emitContextMenu"
                                    @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                                    @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress"
                                    class="px-3 py-2 text-[15px] leading-relaxed break-words relative transition-all"
                                    :class="[
                                        forceOffline ? 'no-bubble-offline w-full' : (msg.role === 'user' ? 'chat-bubble-right shadow-sm' : 'chat-bubble-left shadow-sm'),
                                        (msg.type === 'html' || isHtmlCard) ? 'flex justify-center !w-auto max-w-[90%]' : ''
                                    ]" :style="{
                                        fontSize: (chatData?.bubbleSize || 15) + 'px',
                                        ...(computedBubbleStyle || {})
                                    }">
                                    <!-- Arrow (only show on last segment for multi-segment messages) -->
                                    <div v-if="shouldShowArrow && segIndex === contentSegments.length - 1"
                                        class="absolute top-3 w-0 h-0 border-y-[6px] border-y-transparent"
                                        :class="msg.role === 'user' ? 'right-[-6px] border-l-[6px] border-l-[#95EC69]' : 'left-[-6px] border-r-[6px] border-r-white'">
                                    </div>

                                    <!-- Quote (only on first segment) -->
                                    <div v-if="msg.quote && segIndex === 0"
                                        class="mb-1.5 pb-1.5 border-b border-white/10 opacity-70 text-[11px] leading-tight flex flex-col gap-0.5">
                                        <div class="font-bold">{{ msg.quote.role === 'user' ? '我' : (chatData.name || '对方') }}</div>
                                        <div class="truncate max-w-[200px]">{{ msg.quote.content }}</div>
                                    </div>

                                    <!-- Content -->
                                    <span v-html="renderSegment(segment)" :class="(msg.type === 'html' || isHtmlCard) ? 'inline-block' : ''"></span>
                                </div>
                            </template>

                            <!-- 2. Image Layer -->
                            <div v-if="isImageMsg(msg) || msg.image" class="msg-image bg-transparent"
                                @contextmenu.prevent="emitContextMenu">
                                <img :src="msg.image || getImageSrc(msg)"
                                    class="max-w-[200px] max-h-[250px] rounded-lg cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                                    :class="{ 'animate-bounce-subtle': msg.type === 'sticker' || isSticker(msg) }"
                                    :alt="ensureString(msg.content).substring(0, 20)"
                                    @click="previewImage(msg.image || getImageSrc(msg))" @error="handleImageError"
                                    referrerpolicy="no-referrer">
                            </div>

                            <!-- 3. Family Card Layer (Premium Black Gold Edition) -->
                            <div v-if="isFamilyCard || isFamilyCardApply || isFamilyCardReject"
                                class="mt-1 transition-all relative z-10 w-full max-w-[280px]"
                                @contextmenu.prevent="emitContextMenu" @touchstart="startLongPress"
                                @touchend="cancelLongPress" @touchmove="cancelLongPress" @mousedown="startLongPress"
                                @mouseup="cancelLongPress" @mouseleave="cancelLongPress">

                                <!-- State A: Applying (HOLDER View) -->
                                <div v-if="isFamilyCardApply"
                                    class="relative overflow-hidden rounded-[18px] shadow-2xl transition-all active:scale-[0.98] cursor-pointer group bg-gradient-to-br from-[#1a1a1a] via-[#333333] to-[#000000] border border-[#d4af37]/40 w-[260px] h-[155px]"
                                    @click="handleFamilyCardClick">
                                    <!-- Metallic Texture Overlay -->
                                    <div class="absolute inset-0 opacity-[0.1] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]"></div>
                                    <div class="absolute inset-0 bg-gradient-to-tr from-[#d4af37]/5 via-transparent to-white/10"></div>
                                    
                                    <div class="p-4 h-full flex flex-col justify-between text-white relative z-10">
                                        <div class="flex justify-between items-start">
                                            <div class="flex items-center gap-2">
                                                <div class="w-8 h-6 rounded bg-gradient-to-br from-[#d4af37] via-[#f1d592] to-[#b8860b] flex items-center justify-center shadow-md relative overflow-hidden">
                                                    <div class="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,#000_1px,#000_2px)]"></div>
                                                    <i class="fa-solid fa-microchip text-black/70 text-[10px] relative z-10"></i>
                                                </div>
                                                <span class="text-[11px] font-black tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-[#f1d592] to-[#b8860b]">亲属卡申请</span>
                                            </div>
                                            <div class="flex flex-col items-end">
                                                <span class="text-[8px] font-bold text-[#d4af37] opacity-60 tracking-widest">VIP PASS</span>
                                                <div class="h-0.5 w-6 bg-gradient-to-r from-[#d4af37] to-transparent mt-0.5"></div>
                                            </div>
                                        </div>

                                        <div class="mt-3 px-3 py-2 bg-black/30 rounded-lg border border-white/5 backdrop-blur-md">
                                            <p class="text-[8px] text-[#d4af37] opacity-50 mb-1 font-bold uppercase tracking-widest">Memo / 申请备注</p>
                                            <h3 class="text-[12px] font-medium text-gray-200 tracking-wide line-clamp-1">「{{ getFamilyCardApplyNote() }}」</h3>
                                        </div>

                                        <div class="flex justify-between items-end mt-2">
                                            <div class="space-y-1">
                                                <div class="flex gap-1.5 opacity-30">
                                                    <div v-for="i in 3" :key="i" class="flex gap-1">
                                                        <span v-for="j in 4" :key="j" class="w-1 h-1 bg-white rounded-full"></span>
                                                    </div>
                                                </div>
                                                <p class="text-[9px] font-mono tracking-[0.2em] text-[#d4af37] opacity-80">{{ chatData.userName || 'HOLDER' }}</p>
                                            </div>
                                            
                                            <div class="flex flex-col items-end gap-1.5">
                                                <div v-if="msg.status === 'claimed' || msg.isClaimed"
                                                    class="px-3 py-1 bg-[#07c16020] text-[#07c160] rounded-full text-[9px] font-black border border-[#07c16040] flex items-center gap-1 shadow-[0_0_15px_rgba(7,193,96,0.1)]">
                                                    <i class="fa-solid fa-circle-check text-[10px]"></i> 已成功领取
                                                </div>
                                                <div v-else
                                                    class="px-3 py-1 bg-[#d4af37]/20 text-[#f1d592] rounded-full text-[9px] font-black border border-[#d4af37]/30 backdrop-blur-sm animate-pulse-subtle flex items-center gap-1">
                                                    <i class="fa-solid fa-clock-rotate-left text-[9px]"></i> 等待赠送中
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Decorative corner glow -->
                                    <div class="absolute -bottom-12 -left-12 w-24 h-24 bg-[#d4af37]/5 rounded-full blur-[30px]"></div>
                                </div>

                                <!-- State B: Rejected (Disabled View) -->
                                <div v-else-if="isFamilyCardReject"
                                    class="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-4 opacity-70 w-full max-w-[260px] h-[80px] flex items-center shadow-lg">
                                    <div class="flex items-center gap-4 w-full">
                                        <div class="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
                                            <i class="fa-solid fa-credit-card text-gray-400 text-lg"></i>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="text-[13px] font-black text-gray-300 uppercase tracking-wider">Application Rejected</div>
                                            <div class="text-[11px] text-gray-500 mt-0.5 truncate italic">{{ familyCardData?.text || '对方暂时未通过您的申请' }}</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- State C: Received/Valid (RECIPIENT View) -->
                                <div v-else-if="familyCardData"
                                    class="relative overflow-hidden rounded-[18px] shadow-2xl transition-all active:scale-[0.98] cursor-pointer group bg-gradient-to-br from-[#121212] via-[#2a2a2a] to-[#000000] border border-[#d4af37]/60 w-[260px] h-[155px]"
                                    @click="handleFamilyCardClick">
                                    <!-- Metallic Texture Overlay -->
                                    <div class="absolute inset-0 opacity-[0.1] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/brushed-alum.png')]"></div>
                                    <div class="absolute inset-0 bg-gradient-to-tr from-[#d4af37]/10 via-transparent to-white/5"></div>
                                    
                                    <div class="p-4 h-full flex flex-col justify-between text-white relative z-10">
                                        <div class="flex justify-between items-start">
                                            <div class="flex items-center gap-2">
                                                <div class="w-8 h-6 rounded bg-gradient-to-br from-[#d4af37] via-[#f1d592] to-[#b8860b] flex items-center justify-center shadow-lg relative overflow-hidden">
                                                    <div class="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,#000_1px,#000_2px)]"></div>
                                                    <i class="fa-solid fa-microchip text-black/70 text-[10px] relative z-10"></i>
                                                </div>
                                                <span class="text-[11px] font-black tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-[#f1d592] to-[#b8860b]">{{ familyCardData.text || '专属亲属卡' }}</span>
                                            </div>
                                            <div class="flex items-center gap-1.5">
                                                <div class="w-5 h-5 rounded-full bg-[#eb001b]/80 flex items-center justify-center border border-white/10 -mr-2 shadow-sm"></div>
                                                <div class="w-5 h-5 rounded-full bg-[#f79e1b]/80 flex items-center justify-center border border-white/10 shadow-sm"></div>
                                            </div>
                                        </div>

                                        <div class="mt-2 text-center">
                                            <div class="text-[9px] font-black text-[#d4af37] opacity-60 uppercase tracking-[0.3em] mb-1">Monthly Allowance / 月额度</div>
                                            <div class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#f1d592] via-[#d4af37] to-[#b8860b] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] tracking-tighter">
                                                ¥{{ familyCardData.amount || '0' }}
                                            </div>
                                        </div>

                                        <div class="flex justify-between items-end mt-auto">
                                            <div class="space-y-1">
                                                <div class="flex gap-1.5 font-mono text-white/40 text-[10px] tracking-widest">
                                                    <span>****</span> <span>****</span> <span>****</span> <span class="text-[#d4af37] font-bold">{{ String(familyCardData.number || '8888').slice(-4) }}</span>
                                                </div>
                                                <p class="text-[9px] font-mono tracking-[0.1em] text-[#d4af37] opacity-70 uppercase">{{ familyCardData.ownerName || 'HOLDER' }}</p>
                                            </div>
                                            <!-- UnionPay stylized logo -->
                                            <div class="flex items-center bg-white/5 px-2 py-1 rounded border border-white/10 italic font-black text-[8px] text-[#f1d592] tracking-tighter shadow-inner">
                                                <span class="text-rose-500">Union</span><span class="ml-0.5">Pay</span>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Shine effect -->
                                    <div class="absolute top-[-100%] left-[-100%] w-[300%] h-[300%] bg-gradient-to-tr from-transparent via-white/5 to-transparent rotate-45 pointer-events-none group-hover:translate-x-[50%] group-hover:translate-y-[50%] transition-transform duration-1000"></div>
                                </div>

                                <!-- Text Fallback (Internal use) -->
                                <div v-else class="text-[11px] opacity-50 italic px-2 py-1">[亲属卡数据异常]</div>
                            </div>

                            <!-- 3. HTML Card Layer -->
                            <div v-if="shouldRenderCard"
                                class="mt-1 transition-all relative z-10 w-full min-w-[280px] max-w-full overflow-hidden" @contextmenu.prevent="emitContextMenu"
                                @touchstart="startLongPress" @touchend="cancelLongPress" @touchmove="cancelLongPress"
                                @mousedown="startLongPress" @mouseup="cancelLongPress" @mouseleave="cancelLongPress"
                                @message="handleIframeMessage">
                                <SafeHtmlCard :content="getPureHtml(msg.html || msg.content)" />
                            </div>

                            <!-- 4. Empty/Protocol Placeholder (Clickable Fallback) -->
                            <div v-if="!cleanedContent && parsedInnerVoice === null && !isImageMsg(msg) && !shouldRenderCard && !isPayCard && !isFamilyCard && !isFavoriteCard && !isWeiboCard && !isForumCard && !isTarotMsg && !isDiceMsg && !isLoveSpaceInvite && !isLoveSpaceContract && !isLoveSpaceReject && !isMomentCard && msg.type !== 'voice' && msg.type !== 'music'"
                                @contextmenu.prevent="emitContextMenu" @touchstart="startLongPress"
                                @touchend="cancelLongPress" @touchmove="cancelLongPress" @mousedown="startLongPress"
                                @mouseup="cancelLongPress" @mouseleave="cancelLongPress"
                                class="px-3 py-1.5 text-[11px] text-gray-400 italic bg-gray-100/30 border border-dashed border-gray-200 rounded-lg opacity-60 hover:opacity-100 transition-opacity">
                                [协议/空内容消息 - 右键编辑/删除]
                            </div>

                            <!-- Bubble Timestamp -->
                            <div v-if="shouldShowBubbleTimestamp" class="text-[10px] text-gray-400 mt-0.5 px-1">
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
import { useMusicStore } from '../../../stores/musicStore'
import { parseWeChatEmojis } from '../../../utils/emojiParser'
import {
    ensureMessageString,
    getOfflineRenderableContent,
    getOfflineTextContent,
    getOnlineRenderableContent,
    getOnlineTextContent,
    parseOfflineSegments,
    shouldShowInOnlineMode,
    shouldShowInOfflineMode,
    getUnifiedCleanContent,
    extractInnerVoiceData
} from '../../../utils/chatMessageDisplay'
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
        type: Object,
        default: () => new Set()
    },
    forceOffline: {
        type: Boolean,
        default: false
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
const musicStore = useMusicStore()
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

// --- Family Card Actions ---
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
        // 优先使用消息中的text作为卡名
        const cardName = props.msg.text || '亲属卡'
        // 从walletStore中查找卡片，优先匹配卡名
        const card = walletStore.familyCards.find(c => 
            (c.ownerId === props.chatData.id || c.ownerName === props.chatData.name) && 
            c.remark === cardName
        ) || walletStore.familyCards.find(c => 
            c.ownerId === props.chatData.id || c.ownerName === props.chatData.name
        )
        if (card) {
            // 确保卡名正确
            const cardData = {
                ...card,
                cardName: card.remark || card.cardName || '亲属卡'
            }
            familyDetailModal.value?.open(cardData)
        } else {
            chatStore.triggerToast('未找到钱包中的卡片记录', 'warn')
        }
        return
    }

    // 申请卡片：打开申请详情模态框
    if (isFamilyCardApply.value) {
        console.log('[Family Card] Apply card clicked, opening view modal')
        const note = getFamilyCardApplyNote()
        familyCardModal.value?.open({
            uuid: props.msg.id,
            amount: 0,
            note: note,
            fromCharId: props.chatData?.id,
            isApply: true,
            status: 'waiting'
        }, '亲属卡申请')
        return
    }

    // 未领取的普通卡：打开领取模态框
    if (!isFamilyCardReject.value) {
        const data = familyCardData.value
        console.log('[Family Card] Opening claim modal', data)
        familyCardModal.value?.open({
            uuid: props.msg.id,
            amount: parseFloat(data.amount) || 0,
            note: data.text || '拿去买糖吃~',
            fromCharId: props.chatData?.id
        }, data.text || '亲属卡')
    }
}

// Navigate to moment detail
const navigateToMoment = (msg) => {
    try {
        const data = momentDataValue.value
        if (data && data.id) {
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
        ownerId: props.chatData?.id,
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
        status: 'claimed',
        text: data.cardName || '亲属卡' // Update text to show user's card name
    })

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

    const isOffline = props.msg.mode === 'offline'

    if (isOffline) {
        return !props.prevMsg || props.prevMsg.mode !== 'offline'
    }

    const diff = props.msg.timestamp - props.prevMsg.timestamp
    return diff > 5 * 60 * 1000
})

const isPayCard = computed(() => {
    if (!props.msg) return false
    const content = ensureString(props.msg.content)
    // Check for redpacket/transfer type or tags in content
    // Support both [红包] and [红包：...] formats, including those inside [ONLINE]/[OFFLINE] tags
    const hasRedPacket = /\[红包[:：\s\]]/.test(content) || content.includes('[发红包]') || props.msg.type === 'redpacket'
    const hasTransfer = /\[转账[:：\s\]]/.test(content) || props.msg.type === 'transfer'
    return hasRedPacket || hasTransfer
})

function getPayData(msg) {
    if (!msg) return { type: 'unknown' }
    const content = ensureString(msg.content)
    
    // Transfer check
    const transferMatch = content.match(/\[转账[:：\s]?([^:：\]]*)(?:[:：\s]([^:：\]]*))?(?:[:：\s]([^\]]*))?\]/i)
    if (msg.type === 'transfer' || transferMatch) {
        let amount = msg.amount
        let note = msg.note
        if (transferMatch) {
            if (transferMatch[1] && !isNaN(parseFloat(transferMatch[1]))) {
                amount = transferMatch[1]
                note = transferMatch[2]
            } else if (transferMatch[1]) {
                note = transferMatch[1]
            }
        }
        return { type: 'transfer', amount: amount || '0.00', note: note || '转账给您' }
    }

    // Red Packet check
    const redpacketMatch = content.match(/\[红包[:：\s]?([^:：\]]*)(?:[:：\s]([^:：\]]*))?(?:[:：\s]([^\]]*))?\]/i)
    if (msg.type === 'redpacket' || redpacketMatch || content.includes('[发红包]')) {
        let amount = msg.amount
        let note = msg.note
        if (redpacketMatch) {
            if (redpacketMatch[1] && !isNaN(parseFloat(redpacketMatch[1]))) {
                amount = redpacketMatch[1]
                note = redpacketMatch[2]
            } else if (redpacketMatch[1]) {
                note = redpacketMatch[1]
            }
        }
        return { type: 'redpacket', amount: amount || '0.00', note: note || '恭喜发财' }
    }
    
    return { type: 'unknown' }
}

const cleanedContent = computed(() => getCleanContent(props.msg.content, isHtmlCard.value, props.msg.role))

// Detect scene change for online mode (show small hint only)
const hasSceneChange = computed(() => {
    if (!props.msg || props.msg.role !== 'ai') return false
    const content = ensureString(props.msg.content)
    // Check for【场景：xxx】tag
    return /[\\[【] 场景：[^\]】]*[\]】]/i.test(content)
})

// Split content into segments for bubble rendering (only for AI messages with multiple paragraphs)
const contentSegments = computed(() => {
    if (!props.msg) return [cleanedContent.value]
    
    // User messages and system messages are not split
    if (props.msg.role === 'user' || props.msg.role === 'system') return [cleanedContent.value]
    
    // Special message types are not split
    if (props.msg.type === 'html' || isHtmlCard.value) return [cleanedContent.value]
    if (isImageMsg(props.msg) || isDiceMsg.value || isTarotMsg.value) return [cleanedContent.value]
    
    const content = cleanedContent.value
    if (!content) return []
    
    // Split by double newlines (paragraphs)
    const segments = content.split(/\n\s*\n/).filter(s => s.trim().length > 0)
    
    // Only split if there are multiple substantial paragraphs
    if (segments.length <= 1) return [content]
    
    return segments
})

const isDiceMsg = computed(() => {
    if (props.msg.diceResults) return true
    if (props.msg.type === 'dice_result') return true
    // Explicitly check for [摇骰子] or [掷骰子] tags in text
    const content = ensureString(props.msg.content)
    return /[\[【](?:摇骰子|掷骰子|DICE)[:：]?\s*(\d+)?[\]】]/i.test(content)
})

const shouldShowBubbleTimestamp = computed(() => {
    if (!props.msg.timestamp) return false

    const isOffline = props.msg.mode === 'offline'

    if (isOffline) {
        return !props.prevMsg || props.prevMsg.mode !== 'offline'
    }

    return true
})

const isValidDiceRollCommand = computed(() => {
    if (props.msg.diceResults) return false
    const content = ensureString(props.msg.content)
    return /[\[【](?:摇骰子|掷骰子|DICE)[:：]?\s*(\d+)?[\]】]/i.test(content)
})

const formattedTime = computed(() => {
    return formatTime(props.msg.timestamp)
})

const diceCountValue = computed(() => {
    if (props.msg.diceCount) return props.msg.diceCount;
    const content = ensureString(props.msg.content);
    const match = content.match(/[\[【](?:摇骰子|掷骰子|DICE)[:：]?\s*(\d+)?[\]】]/i);
    return match && match[1] ? parseInt(match[1]) : 1;
})

const diceResultsValue = computed(() => {
    if (props.msg.diceResults && Array.isArray(props.msg.diceResults) && props.msg.diceResults.length > 0) {
        return props.msg.diceResults;
    }
    // Fallback: Generate random results if missing
    const results = [];
    for (let i = 0; i < diceCountValue.value; i++) {
        results.push(Math.floor(Math.random() * 6) + 1);
    }
    return results;
})

const diceTotalValue = computed(() => {
    if (props.msg.diceTotal != null && props.msg.diceTotal > 0) return props.msg.diceTotal;
    return diceResultsValue.value.reduce((a, b) => a + b, 0);
})

// Parse Inner Voice dynamically to extract all parameters
const parsedInnerVoice = computed(() => {
    if (!props.msg) return null;
    const data = extractInnerVoiceData(props.msg.content, props.msg);
    if (!data) return null;
    
    // If it's just a single field we care about, return the string for simplicity
    const keys = Object.keys(data);
    if (keys.length === 1 && !['心声', 'status', 'mind', 'thoughts', 'content'].includes(keys[0])) {
        // Even if it's just one field like spirit: calm, we want to show it as "Spirit: calm"
        // But if it's a "known" main text field, just show the text.
    }
    
    // Check if it's fundamentally just a string disguised as an object {content: '...'}
    if (keys.length === 1 && keys[0] === 'content') return data.content;

    // Filter out internal fields for the preview string if returning a string
    const mainFields = ['心声', 'status', 'mind', 'thoughts'];
    for (const f of mainFields) {
        if (data[f] && keys.length === 1) return data[f];
    }
    
    return data;
});

const hasHtmlContent = computed(() => {
    const source = props.msg.html || props.msg.content
    const html = getPureHtml(source)
    const hasContent = html && html.trim().length > 0
    if (props.msg.type === 'html') {
        console.log('[ChatMessageItem] HTML message check:', {
            msgId: props.msg.id,
            hasHtml: !!props.msg.html,
            htmlLength: props.msg.html?.length,
            contentLength: props.msg.content?.length,
            resultLength: html?.length,
            hasContent
        })
    }
    return hasContent
})

const isValidMessage = computed(() => {
    // 0. Explicit hidden flag from store
    if (props.msg.hidden) return false

    // 1. Determine visibility based on mode (Online vs Offline)
    // If in offline stage (forceOffline), check if it should show in offline mode
    if (props.forceOffline) {
        if (!shouldShowInOfflineMode(props.msg)) return false
    } else {
        // If in online stage, check if it should show in online mode
        if (!shouldShowInOnlineMode(props.msg)) return false
    }

    // 2. Role-specific checks
    if (props.msg.role === 'system') {
        const clean = getCleanContent(ensureString(props.msg.content))
        return clean && clean.length > 0
    }

    // 3. Card & Media Checks
    const isSpecialType = shouldRenderCard.value || isPayCard.value || isFamilyCard.value || 
                         isFavoriteCard.value || isMomentCard.value || isWeiboCard.value || 
                         isForumCard.value || isLoveSpaceInvite.value || isLoveSpaceContract.value || 
                         props.msg.type === 'gift' || props.msg.type === 'gift_claimed' || 
                         props.msg.type === 'card' || props.msg.type === 'order_share' || isDiceMsg.value || isTarotMsg.value ||
                         parsedInnerVoice.value !== null

    if (isSpecialType) {
        // Hide if no effective content for cards
        if ((shouldRenderCard.value || props.msg.type === 'card') && !hasHtmlContent.value) {
            return false;
        }
        return true;
    }

    if (props.msg.type === 'voice' || props.msg.type === 'music' || props.msg.type === 'image' || 
        props.msg.image || isImageMsg(props.msg) || props.msg.diceResults) {
        return true
    }

    // 4. Text Content Filtering
    const clean = getCleanContent(ensureString(props.msg.content))
    if (!clean || clean.length === 0) {
        return false
    }

    return true
})

const formattedContent = computed(() => formatMessageContent(props.msg))

const isFamilyCard = computed(() => {
    // Priority: use message type (set by store)
    if (props.msg.type === 'family_card') return true

    // Do NOT check HTML messages for family card keywords - they should be handled by msg.type
    if (props.msg.type === 'html') return false

    // Check for family card tags in text content
    const content = ensureString(props.msg.content)
    // Only match proper [FAMILY_CARD] or [亲属卡] tags, not random strings containing the keyword
    return /[\\]?\[\s*(?:FAMILY_CARD|亲属卡)/i.test(content)
})

const isFamilyCardApply = computed(() => {
    const content = ensureString(props.msg.content)
    return props.msg.type === 'family_card_apply' || /[\\]?\[\s*(?:FAMILY_CARD_APPLY|申请亲属卡)/i.test(content)
})

const isFamilyCardReject = computed(() => {
    // Priority: use message type (set by store)
    if (props.msg.type === 'family_card_reject') return true
    
    const c = ensureString(props.msg.content)
    // Regular check OR HTML JSON check
    return /[\\]?\[\s*(?:FAMILY_CARD_REJECT|拒绝亲属卡)/i.test(c) || (c.includes('type":"html"') && c.includes('拒绝'))
})



const isHtmlCard = computed(() => {
    if (props.msg.type === 'html') return true
    const c = ensureString(props.msg.content)
    if (c.includes('[CARD]')) return true
    
    // Check for nested types
    if (c.includes('"type"') && c.includes('"html"')) return true
    if (c.includes('\\"type\\"') && c.includes('\\"html\\"')) return true
    
    // Check for raw HTML tags
    if (/<[a-zA-Z][^>]*\s+(style|class|id)=/i.test(c) || /<div\s+/i.test(c) || /<style\s*/i.test(c)) {
        return true
    }
    
    return false
})



const isHtmlContentCard = computed(() => isHtmlCard.value)
const shouldRenderCard = computed(() => {
    // Render the card if flagged OR if we have valid HTML content OR if it's a card type
    if (props.msg.forceCard) return hasHtmlContent.value;
    if (props.msg.type === 'card') return hasHtmlContent.value;  // 只有有有效内容时才渲染
    return (props.msg.type === 'html' || isHtmlCard.value) && hasHtmlContent.value
})

// 收藏卡片检测 - 支持 type: 'favorite_card' 或内容包含收藏标签/JSON
const isFavoriteCard = computed(() => {
    if (props.msg.type === 'favorite_card') return true
    const content = ensureString(props.msg.content)
    // 检测 [收藏:...] 或 [FAVORITE:...] 标签
    if (/[\[【](?:收藏|FAVORITE)[:：]/.test(content)) return true
    // 检测裸 JSON 格式（包含 favorite 相关字段）
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        try {
            const parsed = JSON.parse(content)
            if (parsed.source || parsed.preview || parsed.fullContent || parsed.favoriteId) return true
        } catch (e) {}
    }
    return false
})

// 微博卡片检测 - 支持 type: 'weibo_card' 或内容包含微博标签/JSON
const isWeiboCard = computed(() => {
    if (props.msg.type === 'weibo_card') return true
    const content = ensureString(props.msg.content)
    // 检测 [微博:...] 或 [WEIBO:...] 标签
    if (/[\[【](?:微博|WEIBO)[:：]/.test(content)) return true
    // 检测裸 JSON 格式（包含 weibo 相关字段）
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        try {
            const parsed = JSON.parse(content)
            if (parsed.summary || parsed.author || parsed.avatar || parsed.weiboId) return true
        } catch (e) {}
    }
    return false
})

const isForumCard = computed(() => {
    const c = ensureString(props.msg.content)
    return c.startsWith('[FORUM_CARD:') && c.endsWith(']')
})

const parsedForumCard = computed(() => {
    if (!isForumCard.value) return null
    const c = ensureString(props.msg.content)
    const inner = c.slice(1, -1) // remove []
    const parts = inner.split(':')
    if (parts.length >= 5) { // [FORUM_CARD, forumId, postId, title, preview...]
        return {
            forumId: parts[1],
            postId: parts[2],
            title: parts[3],
            preview: parts.slice(4).join(':') || '点击查看详情'
        }
    }
    return null
})

function handleForumCardClick() {
    if (!parsedForumCard.value) return
    const { forumId, postId } = parsedForumCard.value
    router.push({ path: '/forum', query: { forum: forumId, post: postId } })
}

const isLoveSpaceInvite = computed(() => {
    return /[\\[【]\s*LOVESPACE_INVITE[:：]?\s*/i.test(ensureString(props.msg.content))
})

const parsedLoveSpaceInvite = computed(() => {
    if (!isLoveSpaceInvite.value) return null
    const c = ensureString(props.msg.content).trim()
    const tag = '[LOVESPACE_INVITE:'
    const startIndex = c.indexOf(tag)
    if (startIndex === -1) return null
    
    // Extract everything from after the tag until the last ]
    const afterTag = c.slice(startIndex + tag.length)
    const lastBracketIndex = afterTag.lastIndexOf(']')
    const inner = lastBracketIndex !== -1 ? afterTag.slice(0, lastBracketIndex) : afterTag
    
    const parts = inner.split(':')
    if (parts.length >= 1 && parts[0].trim()) {
        return { charId: parts[0].trim() }
    }
    return null
})

function handleLoveSpaceInviteClick() {
    if (isLoveSpaceInvite.value && parsedLoveSpaceInvite.value) {
        router.push({ path: '/couple', query: { char: parsedLoveSpaceInvite.value.charId } })
    } else if (isLoveSpaceContract.value) {
        router.push('/couple')
    }
}

const isLoveSpaceContract = computed(() => {
    return /[\\[【]\s*LOVESPACE_CONTRACT[:：]?\s*/i.test(ensureString(props.msg.content))
})

const parsedLoveSpaceContract = computed(() => {
    if (!isLoveSpaceContract.value) return null
    const c = ensureString(props.msg.content).trim()
    const tag = '[LOVESPACE_CONTRACT:'
    const startIndex = c.indexOf(tag)
    if (startIndex === -1) return { days: '1' }
    
    // Extract everything from after the tag until the last ]
    const afterTag = c.slice(startIndex + tag.length)
    const lastBracketIndex = afterTag.lastIndexOf(']')
    const inner = lastBracketIndex !== -1 ? afterTag.slice(0, lastBracketIndex) : afterTag
    
    const parts = inner.split(':')
    if (parts.length >= 1 && parts[0].trim()) {
        return { days: parts[0].trim() }
    }
    return { days: '1' }
})

const isLoveSpaceReject = computed(() => {
    return /[\\[【]\s*LOVESPACE_REJECT[:：]?\s*/i.test(ensureString(props.msg.content))
})

const parsedLoveSpaceReject = computed(() => {
    if (!isLoveSpaceReject.value) return null
    const c = ensureString(props.msg.content).trim()
    const tag = '[LOVESPACE_REJECT:'
    const startIndex = c.indexOf(tag)
    if (startIndex === -1) return { charId: '' }
    
    // Extract everything from after the tag until the last ]
    const afterTag = c.slice(startIndex + tag.length)
    const lastBracketIndex = afterTag.lastIndexOf(']')
    const inner = lastBracketIndex !== -1 ? afterTag.slice(0, lastBracketIndex) : afterTag
    
    const parts = inner.split(':')
    if (parts.length >= 1 && parts[0].trim()) {
        return { charId: parts[0].trim() }
    }
    return { charId: '' }
})

const weiboCardData = computed(() => {
    if (!isWeiboCard.value) return null
    try {
        const content = ensureString(props.msg.content)
        
        // 1. 如果已有结构化数据，直接使用
        if (props.msg.weiboData) return props.msg.weiboData
        
        // 2. 尝试直接解析 JSON
        if (content.trim().startsWith('{')) {
            return JSON.parse(content)
        }
        
        // 3. 从 [微博:...] 或 [WEIBO:...] 标签中解析
        const match = content.match(/[\[【](?:微博|WEIBO)[:：]\s*([\s\S]*?)[\]】]/i)
        if (match) {
            const dataStr = match[1].trim()
            if (dataStr.startsWith('{')) {
                return JSON.parse(dataStr)
            }
            // 纯文本格式，构造默认数据
            return {
                summary: dataStr,
                author: props.msg.role === 'ai' ? 'AI' : '用户',
                avatar: '',
                image: null
            }
        }
        
        return null
    } catch (e) {
        console.warn('[ChatMessageItem] Failed to parse weibo card data', e)
        return null
    }
})

const isMomentCard = computed(() => {
    return props.msg.type === 'moment_card' || /\[(?:MOMENT_SHARE|分享朋友圈)[:：]/.test(ensureString(props.msg.content))
})

const isTogetherListening = computed(() => {
    const content = ensureString(props.msg.content)
    return content.includes('[一起听歌:') || content.includes('<bgm>') || content.includes('[MUSIC:')
})


// 塔罗牌消息检测 - 支持 type: 'tarot'/'tarot_card'/'tarot_interpretation' 或内容包含塔罗标签
const isTarotMsg = computed(() => {
    if (props.msg.type === 'tarot' || props.msg.type === 'tarot_card' || props.msg.type === 'tarot_interpretation') return true
    if (props.msg.tarotCards && props.msg.tarotCards.length > 0) return true
    const content = ensureString(props.msg.content)
    return /[\[【](?:塔罗|塔罗牌|塔罗占卜|塔罗解牌|TAROT)[:：\]】]/.test(content)
})

// 解析塔罗数据
const tarotDataValue = computed(() => {
    if (!isTarotMsg.value) return null
    
    // 如果已有结构化数据，直接使用
    if (props.msg.tarotCards && props.msg.tarotCards.length > 0) {
        return {
            cards: props.msg.tarotCards,
            question: props.msg.tarotQuestion || '',
            interpretation: props.msg.tarotInterpretation || '',
            spread: props.msg.tarotSpread || null
        }
    }
    
    // 从内容中解析塔罗数据
    const content = ensureString(props.msg.content)
    
    // 尝试解析 [塔罗:...] 或 [塔罗牌:...] 标签中的 JSON 数据
    const tarotMatch = content.match(/[\[【](?:塔罗|塔罗牌|TAROT)[:：]\s*([\s\S]*?)[\]】]/i)
    if (tarotMatch) {
        const dataStr = tarotMatch[1].trim()
        
        // 尝试解析 JSON 格式
        if (dataStr.startsWith('{')) {
            try {
                const parsed = JSON.parse(dataStr)
                return {
                    cards: parsed.cards || parsed.tarotCards || [],
                    question: parsed.question || parsed.tarotQuestion || '',
                    interpretation: parsed.interpretation || parsed.tarotInterpretation || '',
                    spread: parsed.spread || parsed.tarotSpread || null
                }
            } catch (e) {
                // JSON 解析失败，返回文本内容
                return { cards: [], question: dataStr, interpretation: '', spread: null }
            }
        } else {
            // 纯文本格式
            return { cards: [], question: dataStr, interpretation: '', spread: null }
        }
    }
    
    return { cards: [], question: '', interpretation: '', spread: null }
})

const momentDataValue = computed(() => {
    if (!isMomentCard.value) return null
    try {
        // 1. If structured data already exists (set by chatStore)
        if (props.msg.momentData) return props.msg.momentData;
        
        const content = ensureString(props.msg.content)
        
        // 2. If content is a JSON string (type moment_card)
        if (props.msg.type === 'moment_card') {
            try { return JSON.parse(content); } catch (e) {}
        }
        
        // 3. Extract and parse from raw text tag
        const match = content.match(/\[(?:MOMENT_SHARE|分享朋友圈):\s*([\s\S]+?)\](?=\s*(?:\[|$))/i);
        if (match) {
            let dataStr = match[1].trim()
            // Unescape common AI quote escapes
            dataStr = dataStr.replace(/\\"/g, '"');
            
            if (dataStr.startsWith('{')) {
                return JSON.parse(dataStr)
            }
            return { text: dataStr } // Simple text fallback
        }
    } catch (e) {
        console.warn('[ChatMessageItem] Failed to parse moment card data', e);
        return null
    }
    return null
})

const favoriteCardData = computed(() => {
    if (!isFavoriteCard.value) return null
    try {
        const content = ensureString(props.msg.content)
        
        // 1. 如果已有结构化数据，直接使用
        if (props.msg.favoriteData) return props.msg.favoriteData
        
        // 2. 尝试直接解析 JSON
        if (content.trim().startsWith('{')) {
            return JSON.parse(content)
        }
        
        // 3. 从 [收藏:...] 或 [FAVORITE:...] 标签中解析
        const match = content.match(/[\[【](?:收藏|FAVORITE)[:：]\s*([\s\S]*?)[\]】]/i)
        if (match) {
            const dataStr = match[1].trim()
            if (dataStr.startsWith('{')) {
                return JSON.parse(dataStr)
            }
            // 纯文本格式，构造默认数据
            return {
                source: '收藏',
                preview: dataStr,
                fullContent: dataStr,
                savedAt: Date.now()
            }
        }
        
        return null
    } catch (e) {
        console.warn('[ChatMessageItem] Failed to parse favorite card data', e)
        return null
    }
})

const cardData = computed(() => {
    if (props.msg.type !== 'card') return null
    try {
        const content = ensureString(props.msg.content)
        console.log('[ChatMessageItem] Card message received:', { 
            type: props.msg.type, 
            content: content,
            contentLength: content.length 
        })
        
        // Try multiple extraction patterns
        let jsonStr = null
        
        // Pattern 1: [CARD]{...} or [CARD] {...}
        const match1 = content.match(/\[CARD\]\s*([\{][\s\S]*[\}])/i)
        if (match1) {
            jsonStr = match1[1].trim()
            console.log('[ChatMessageItem] Pattern 1 matched: [CARD]{...}')
        }
        // Pattern 2: Just JSON object (no tag)
        else if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
            jsonStr = content.trim()
            console.log('[ChatMessageItem] Pattern 2 matched: naked JSON')
        }
        // Pattern 3: Extract JSON from anywhere in text
        else {
            const jsonMatch = content.match(/\{[\s\S]*"(?:title|content|type|html)"[\s\S]*\}/)
            if (jsonMatch) {
                jsonStr = jsonMatch[0]
                console.log('[ChatMessageItem] Pattern 3 matched: extracted JSON from text')
            }
        }
        
        if (!jsonStr) {
            console.warn('[ChatMessageItem] No JSON pattern found in card content')
            return null
        }
        
        // Clean up common JSON formatting issues
        jsonStr = jsonStr.replace(/\n/g, ' ').replace(/\s+/g, ' ')
        
        const parsed = JSON.parse(jsonStr)
        console.log('[ChatMessageItem] Card parsed successfully:', parsed)
        return parsed
    } catch (e) {
        console.error('[ChatMessageItem] Card parse error:', e.message, '\nContent:', props.msg.content)
        return null
    }
})

// Check if card contains HTML content
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
    if (props.msg.type === 'family_card' && (props.msg.amount || props.msg.text)) {
        return {
            amount: props.msg.amount || '5200',
            text: props.msg.text || '送给你的亲属卡',
            paymentId: props.msg.paymentId || null,
            isReject: false
        }
    }

    const content = ensureString(props.msg.content)

    // Recovery for HTML JSON Garbage
    if ((props.msg.type === 'html' && props.msg.role === 'ai') || (content.includes('"html"') && content.includes('拒绝'))) {
        if (content.includes('拒绝') || content.includes('reject')) {
            return { amount: '0', text: '对方拒绝了您的申请', isReject: true }
        }
    }

    const cleanContent = content.replace(/\\\[/g, '[').replace(/\\\]/g, ']')
    const colonRegex = '[:：]\\s*'
    const tagRegex = '(?:FAMILY_CARD|亲属卡)'
    const applyTagRegex = '(?:FAMILY_CARD_APPLY|申请亲属卡)'

    if (props.msg.type === 'family_card_apply') {
        if (props.msg.note) {
            return {
                amount: '0',
                text: props.msg.note,
                paymentId: props.msg.paymentId || null,
                isReject: false
            }
        }
    }

    const applyMatch = cleanContent.match(new RegExp(`\\[${applyTagRegex}\\s*${colonRegex}([^\\]:]+)(?:${colonRegex}([^\\]]+))?\\]`, 'i'))
    if (applyMatch) {
        return {
            amount: '0',
            text: applyMatch[1]?.trim() || '申请亲属卡',
            paymentId: applyMatch[2]?.trim() || null,
            isReject: false
        }
    }

    const standardMatch = cleanContent.match(new RegExp(`\\[${tagRegex}\\s*${colonRegex}([^\\]:]+)${colonRegex}([^\\]:]+)(?:${colonRegex}([^\\]]+))?\\]`, 'i'))
    if (standardMatch) {
        return {
            amount: standardMatch[1]?.trim() || '5200',
            text: standardMatch[2]?.trim() || '送给你的亲属卡',
            paymentId: standardMatch[3]?.trim() || null,
            isReject: false
        }
    }

    const shortMatch = cleanContent.match(new RegExp(`\\[${tagRegex}\\s*${colonRegex}([^\\]:]+)${colonRegex}([^\\]]+)\\]`, 'i'))
    if (shortMatch) {
        return {
            amount: shortMatch[1]?.trim() || '5200',
            text: shortMatch[2]?.trim() || '送给你的亲属卡',
            isReject: false
        }
    }

    const amountOnlyMatch = cleanContent.match(new RegExp(`\\[${tagRegex}\\s*${colonRegex}(\\d+)\\]`, 'i'))
    if (amountOnlyMatch) {
        return { amount: amountOnlyMatch[1].trim(), text: '送给你的亲属卡', isReject: false }
    }

    const noteOnlyMatch = cleanContent.match(new RegExp(`\\[${tagRegex}\\s*${colonRegex}([^\\d\\s][^\\]]*)\\]`, 'i'))
    if (noteOnlyMatch) return { amount: '5200', text: noteOnlyMatch[1].trim(), isReject: false }

    if (isFamilyCard.value) return { amount: '5200', text: '送给你的亲属卡', isReject: false }
    return null
})

const getUserName = computed(() => {
    return props.chatData.userName || '用户'
})

// Unified cleaning logic for AI responses
function getCleanContent(contentRaw, isCard = false, role = 'ai') {
    return getUnifiedCleanContent(contentRaw, isCard, role)
}


function getPureHtml(content) {
    if (!content) return ''
    const str = ensureString(content)
    let trimmed = str.trim()
    
    // 安全移除外层的 [CARD] 标签（可能包含由于双重包裹出现的转义斜杠）
    trimmed = trimmed.replace(/\[\s*\/?CARD\s*\]/gi, '').trim()
    
    // Pass: Strip Markdown Backticks (AI tend to wrap code in them)
    trimmed = trimmed.replace(/^```(?:html|json|xml)?\s*|```$/gi, '').trim();
    
    // 快速检查：如果内容包含常见的 HTML 标签且不包含 JSON 结构，直接返回（已经是纯 HTML）
    const hasHtmlTag = /<[a-zA-Z][^>]*>/.test(trimmed);
    // 检查是否看起来像 JSON：结构中包含 type 键
    const looksLikeJson = /"type"/i.test(trimmed) || /\\"type\\"/i.test(trimmed);
    
    if (hasHtmlTag && !looksLikeJson) {
        console.log('[getPureHtml] Content appears to be pure HTML, returning directly');
        return cleanHtmlResult(trimmed);
    }

    const unescapeContent = (text) => {
        if (!text || typeof text !== 'string') return text;
        
        // Pass 0: Robust Detection of Fragmented JSON
        // Check if string contains JSON-like structures that need deeper parsing (allowing for literal \\n spaces)
        const hasJsonStructure = /\{\s*(?:\\[nrt]\s*)*\\?["']?(?:type|html|card)\\?["']?\s*(?:\\[nrt]\s*)*:/i.test(text);
        
        if (hasJsonStructure) {
            console.log('[getPureHtml] Detected fragmented/nested JSON in HTML content, executing extraction...');
            try {
                // Try to find all JSON-like objects { ... } in the text
                let segments = [];
                let braceDepth = 0;
                let startPos = -1;
                
                for (let i = 0; i < text.length; i++) {
                    if (text[i] === '{') {
                        if (braceDepth === 0) startPos = i;
                        braceDepth++;
                    } else if (text[i] === '}') {
                        braceDepth--;
                        if (braceDepth === 0 && startPos !== -1) {
                            const segment = text.substring(startPos, i + 1);
                            try {
                                // Double unescape for potential double-wrapped AI outputs
                                const cleanSeg = segment.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                                const parsed = JSON.parse(cleanSeg);
                                if (parsed.html || parsed.content) {
                                    segments.push(parsed.html || parsed.content);
                                }
                            } catch (e) {
                                // Not a valid JSON, skip
                            }
                        }
                    }
                }
                
                if (segments.length > 0) {
                    // Recursive call to handle nested layers
                    return segments.map(s => unescapeContent(s)).join('');
                }
            } catch (err) { }
        }

        return text
            .replace(/\\\\n/g, '\n')  // 处理 \\\\n → 换行
            .replace(/\\\\r/g, '\r')
            .replace(/\\\\t/g, '\t')
            .replace(/\\\\"/g, '"')
            .replace(/\\\\/g, '\\')   // 处理 \\\\ → \
            .replace(/\\n/g, '\n')    // 处理 \\n → 换行
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"');
    }

    // Pass 0: 处理 [CARD] 标签包裹的 JSON（带双重转义）
    // 匹配 { 开头，中间包含 "type": "html" 或 "html":，且以 } 结尾的内容
    const deepDecoded = (() => {
        let decoded = trimmed
        for (let i = 0; i < 3; i += 1) {
            decoded = unescapeContent(decoded)
        }
        return decoded.replace(/`/g, '').trim()
    })()

    const firstHtmlIndex = deepDecoded.search(/<(div|section|article|table|ul|ol|p|h[1-6]|svg|details|summary|style)\b/i)
    if (firstHtmlIndex !== -1) {
        const closingTags = ['</div>', '</section>', '</article>', '</table>', '</ul>', '</ol>', '</p>', '</h1>', '</h2>', '</h3>', '</h4>', '</h5>', '</h6>', '</svg>', '</details>', '</summary>', '</style>']
        let lastHtmlIndex = -1

        closingTags.forEach((tag) => {
            const index = deepDecoded.toLowerCase().lastIndexOf(tag)
            if (index > lastHtmlIndex) lastHtmlIndex = index + tag.length
        })

        if (lastHtmlIndex > firstHtmlIndex) {
            let directHtml = deepDecoded
                .slice(firstHtmlIndex, lastHtmlIndex)
                .replace(/"\s*\}\s*(?=<)/g, '')
                .replace(/\{\s*"type"\s*:\s*"html"\s*,\s*"html"\s*:\s*"/gi, '')
                .replace(/\\"\}/g, '')
                .trim()
            
            // 移除可能残留的 JSON 结束符
            directHtml = directHtml.replace(/"\s*\}$/, '')
            directHtml = directHtml.replace(/\\"\}$/, '')
            
            if (directHtml) return cleanHtmlResult(directHtml)
        }
    }

    const cardJsonMatch = trimmed.match(/^\{\s*(?:[\s\S]*?)"(?:type|html)"\s*:\s*(?:[\s\S]*?)\}$/);
    if (cardJsonMatch) {
        try {
            const jsonStr = cardJsonMatch[0].replace(/[\r\n]/g, '');
            // 先处理双重转义
            const unescaped = jsonStr
                .replace(/\\"/g, '"')
                .replace(/\\\\n/g, '\\n')
                .replace(/\\\\/g, '\\');
            const parsed = JSON.parse(unescaped);
            if (parsed.html || parsed.content) {
                return cleanHtmlResult(unescapeContent(parsed.html || parsed.content));
            }
        } catch (e) {}
    }

    // Pass 1: 处理 "Leaked" 字符串转义 JSON（以 \\" 开头和结尾）
    if (trimmed.startsWith('\\"') && trimmed.endsWith('\\"')) {
        try {
            const unescapedOnce = trimmed.substring(2, trimmed.length - 2)
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
            if (unescapedOnce.includes('"html"')) {
                const parsed = JSON.parse(unescapedOnce);
                if (parsed.html || parsed.content) return cleanHtmlResult(unescapeContent(parsed.html || parsed.content));
            }
        } catch (e) {}
    }

    // Pass 2: 尝试标准 JSON 解析 (支持多 JSON 数组)
    try {
        // 去除前端可能带来的转义空白，比如 \\n, \\r, \\t 等等再做首字符判断
        let jsonStr = trimmed.replace(/^(?:\\[nrt]|\s)+/, '').replace(/(?:\\[nrt]|\s)+$/, '');
        // 如果是连续的多个对象 } {，补齐为数组
        if (jsonStr.match(/\}\s*\{/)) {
            jsonStr = '[' + jsonStr.replace(/\}\s*\{/g, '},{') + ']';
        }

        if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
            let cleanedJson = jsonStr.replace(/[\r\n]/g, '');
            if (cleanedJson.includes('\\"')) {
                try {
                    const unescaped = cleanedJson.replace(/\\"/g, '"');
                    const parsed = JSON.parse(unescaped);
                    if (Array.isArray(parsed)) {
                        // 提取所有 HTML 片段并合并
                        const htmlParts = parsed.map(p => cleanHtmlResult(unescapeContent(p.html || p.content))).filter(Boolean);
                        if (htmlParts.length > 0) {
                            // 如果有多个片段，尝试合并成一个完整的 HTML
                            if (htmlParts.length > 1) {
                                // 提取所有片段的内部内容，去掉外层的 <div> 标签
                                const merged = htmlParts.map(part => {
                                    const trimmedPart = part.trim();
                                    // 如果是以 <div 开头的完整标签，提取内部内容
                                    if (trimmedPart.startsWith('<div') && trimmedPart.endsWith('</div>')) {
                                        const match = trimmedPart.match(/^<div[^>]*>([\s\S]*)<\/div>$/i);
                                        return match ? match[1] : part;
                                    }
                                    return part;
                                }).join('');
                                return merged;
                            }
                            return htmlParts[0];
                        }
                    }
                    if (parsed.type === 'html' || parsed.html) {
                        const result = cleanHtmlResult(unescapeContent(parsed.html || parsed.content));
                        if (result) return result;
                    }
                } catch (e) { }
            }
            try {
                const parsed = JSON.parse(cleanedJson);
                if (Array.isArray(parsed)) {
                    // 提取所有 HTML 片段并合并
                    const htmlParts = parsed.map(p => cleanHtmlResult(unescapeContent(p.html || p.content))).filter(Boolean);
                    if (htmlParts.length > 0) {
                        // 如果有多个片段，尝试合并成一个完整的 HTML
                        if (htmlParts.length > 1) {
                            // 提取所有片段的内部内容，去掉外层的 <div> 标签
                            const merged = htmlParts.map(part => {
                                const trimmedPart = part.trim();
                                // 如果是以 <div 开头的完整标签，提取内部内容
                                if (trimmedPart.startsWith('<div') && trimmedPart.endsWith('</div>')) {
                                    const match = trimmedPart.match(/^<div[^>]*>([\s\S]*)<\/div>$/i);
                                    return match ? match[1] : part;
                                }
                                return part;
                            }).join('');
                            return merged;
                        }
                        return htmlParts[0];
                    }
                }
                if (parsed.type === 'html' || parsed.html) {
                    const result = cleanHtmlResult(unescapeContent(parsed.html || parsed.content));
                    if (result) return result;
                }
            } catch (e) { }
        }
    } catch (e) { }

    // Pass 3: 正则安全提取 html 键值
    try {
        let result = '';
        let currentIndex = 0;
        while (true) {
            let keyIdx = trimmed.indexOf('"html"', currentIndex);
            if (keyIdx === -1) keyIdx = trimmed.indexOf('\\"html\\"', currentIndex);
            if (keyIdx === -1) keyIdx = trimmed.indexOf('"content"', currentIndex);
            if (keyIdx === -1) break;

            let colonIdx = trimmed.indexOf(':', keyIdx);
            if (colonIdx === -1) break;

            let quoteIdx = trimmed.indexOf('"', colonIdx);
            if (quoteIdx === -1) break;

            // Count backslashes before the opening quote to determine escaping depth
            let startBackslashCount = 0;
            let k = quoteIdx - 1;
            while (k >= 0 && trimmed[k] === '\\') {
                startBackslashCount++;
                k--;
            }

            let endQuoteIdx = quoteIdx + 1;
            while (endQuoteIdx < trimmed.length) {
                if (trimmed[endQuoteIdx] === '"') {
                    let currentBackslashCount = 0;
                    let m = endQuoteIdx - 1;
                    while (m >= 0 && trimmed[m] === '\\') {
                        currentBackslashCount++;
                        m--;
                    }
                    if (currentBackslashCount === startBackslashCount) {
                        break;
                    }
                }
                endQuoteIdx++;
            }

            if (endQuoteIdx < trimmed.length) {
                let htmlContent = trimmed.substring(quoteIdx + 1, endQuoteIdx);
                result += cleanHtmlResult(unescapeContent(htmlContent)) + '\n';
            }
            currentIndex = endQuoteIdx + 1;
        }
        if (result.trim().length > 0) return result.trim();
    } catch (e) { }

    // Pass 4: 终极 Fallback - 提取纯 HTML
    const decoded = trimmed.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const htmlTags = ['<div', '<style', '<table', '<ul', '<ol', '<p', '<h1', '<h2>', '<h3', '<section', '<article', '<svg', '<details', '<summary'];
    let startIdx = -1;

    for (const tag of htmlTags) {
        const idx = decoded.toLowerCase().indexOf(tag);
        if (idx !== -1 && (startIdx === -1 || idx < startIdx)) {
            startIdx = idx;
        }
    }

    if (startIdx !== -1) {
        const endIdx = decoded.lastIndexOf('>');
        if (endIdx > startIdx) {
            return cleanHtmlResult(unescapeContent(decoded.substring(startIdx, endIdx + 1)));
        }
    }

    return '';
}

function cleanHtmlResult(html) {
    if (!html) return '';
    let result = html.trim();
    
    // 移除可能直接泄漏到 HTML 内部的 [CARD] 标签
    result = result.replace(/\[\s*\/?CARD\s*\]/gi, '');
    
    // 彻底移除由于多段输出或不规范输出导致的中间及开头 JSON 碎片包裹块
    // 例如："} \n {"type":"html","html":" 或者带转义的 {\"type\":\"html\"
    result = result.replace(/\\?["']?\s*\\?\}[\s\n\r,]*\{\s*\\?["']?type\\?["']?\s*:\s*\\?["']?(?:html|card)\\?["']?\s*(?:,\s*\\?["']?(?:html|content)\\?["']?\s*:\s*\\?["']?)?/gi, '\n');
    
    // 移除所有孤立开头的 JSON 结构残留 (无论中间或开头)，支持双重转义
    result = result.replace(/\{\s*\\?["']?type\\?["']?\s*:\s*\\?["']?(?:html|card)\\?["']?\s*(?:,\s*\\?["']?(?:html|content)\\?["']?\s*:\s*\\?["']?)?/gi, '');
    
    // 移除开头的 { 和 }（JSON 残留）
    while (result.startsWith('{') || result.startsWith('}')) {
        result = result.substring(1).trim();
    }
    
    // 移除结尾的 JSON 结构残留 - 更全面的匹配
    // 匹配 "} 或 "} 或 "} 后面跟着任何内容（包括空格）
    result = result.replace(/"\s*\}\s*$/g, '');
    result = result.replace(/'\s*\}\s*$/g, '');
    result = result.replace(/\\"\s*\}\s*$/g, '');
    result = result.replace(/\\'\s*\}\s*$/g, '');
    
    // 移除结尾的 } 和 {（JSON 残留）
    while (result.endsWith('}') || result.endsWith('{')) {
        result = result.substring(0, result.length - 1).trim();
    }
    
    // 移除 "html": 或 "content": 前缀
    result = result.replace(/^["']?html["']?\s*:\s*["']?/i, '');
    result = result.replace(/^["']?content["']?\s*:\s*["']?/i, '');
    
    // 移除开头和结尾的引号
    result = result.replace(/^["']/, '');
    result = result.replace(/["']$/, '');
    
    // 移除转义的引号
    result = result.replace(/\\"/g, '"');
    result = result.replace(/\\'/g, "'");
    
    // 再次清理可能残留的 JSON 结束符（处理多个片段合并后的情况）
    result = result.replace(/"\s*\}\s*\{/g, '');
    result = result.replace(/'\s*\}\s*\{/g, '');
    
    // 清理行首行尾的 JSON 残留符号（如 "} 或 "]）
    result = result.replace(/^\s*["']\s*\}\s*/gm, '');
    result = result.replace(/^\s*["']\s*\]\s*/gm, '');
    result = result.replace(/\s*["']\s*\}\s*$/gm, '');
    result = result.replace(/\s*["']\s*\]\s*$/gm, '');
    
    // 清理孤立的 "} 或 "] 在行内
    result = result.replace(/["']\s*\}\s*(?=<|$)/g, '');
    result = result.replace(/["']\s*\]\s*(?=<|$)/g, '');
    
    // 清理 HTML 标签之间的 JSON 残留
    result = result.replace(/>\s*["']\s*\}\s*</g, '><');
    result = result.replace(/>\s*["']\s*\]\s*</g, '><');
    
    // 清理段落开头/结尾的 JSON 残留
    result = result.replace(/<p[^>]*>\s*["']\s*\}\s*/gi, '<p>');
    result = result.replace(/<p[^>]*>\s*["']\s*\]\s*/gi, '<p>');
    result = result.replace(/\s*["']\s*\}\s*<\/p>/gi, '</p>');
    result = result.replace(/\s*["']\s*\]\s*<\/p>/gi, '</p>');
    
    // 清理 div 开头/结尾的 JSON 残留
    result = result.replace(/<div[^>]*>\s*["']\s*\}\s*/gi, '<div>');
    result = result.replace(/<div[^>]*>\s*["']\s*\]\s*/gi, '<div>');
    result = result.replace(/\s*["']\s*\}\s*<\/div>/gi, '</div>');
    result = result.replace(/\s*["']\s*\]\s*<\/div>/gi, '</div>');
    
    // 最终清理：移除所有孤立的 "} 或 "]（包括不在行首行尾的）
    result = result.replace(/\s*["']\s*[\}\]]\s*/g, ' ');
    
    return result.trim();
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

// ✅ 修复：语音/音乐气泡样式计算函数
const getVoiceBubbleStyle = computed(() => {
    // 如果是音乐类型，返回自定义样式（但会被 CSS 覆盖）
    if (props.msg.type === 'music') {
        // 基础样式 + 全局 bubbleCss
        const baseStyle = {
            width: '140px',
            flex: 'none'
        }
        // 合并全局气泡样式
        return { ...baseStyle, ...computedBubbleStyle.value }
    }
    // 语音类型直接返回全局样式
    return computedBubbleStyle.value
})

const shouldShowArrow = computed(() => {
    return false // 全局禁用箭头
})

// --- Methods (Ported) ---

function ensureString(val) {
    return ensureMessageString(val)
}

function escapeHtml(value) {
    return ensureString(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function renderOfflineMessageHtml(msg) {
    const segments = parseOfflineSegments(msg)
    if (!segments.length) {
        return escapeHtml(getOfflineTextContent(msg)).replace(/\n/g, '<br>')
    }

    const userName = props.chatData?.groupSettings?.myNickname
        || props.chatData?.userName
        || settingsStore.personalization.userProfile.name
        || '我'
    const characterName = props.chatData?.name || '对方'
    const userAvatar = props.chatData?.userAvatar
        || settingsStore.personalization.userProfile.avatar
        || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me'
    const characterAvatar = props.chatData?.avatar
        || 'https://api.dicebear.com/bottts/svg?seed=Bot'

    return segments.map((segment) => {
        if (segment.type === 'scene') {
            return `<div class="node-scene">${escapeHtml(segment.content)}</div>`
        }
        if (segment.type === 'narration') {
            return `<div class="node-narration">${escapeHtml(segment.content)}</div>`
        }
        if (segment.type === 'action') {
            return `<div class="node-action">${escapeHtml(segment.content)}</div>`
        }

        const speaker = segment.speaker || (msg?.role === 'user' ? userName : characterName)
        const isUser = msg?.role === 'user' || speaker === userName
        const side = isUser ? 'right' : 'left'
        const avatar = isUser ? userAvatar : characterAvatar
        const nameHtml = segment.speaker ? `<div class="node-name">${escapeHtml(speaker)}</div>` : ''

        return `
            <div class="node-speech ${side}">
                <img src="${avatar}" class="node-avatar shadow-sm" />
                <div class="node-content">
                    ${nameHtml}
                    <div class="node-text">${escapeHtml(segment.content).replace(/\n/g, '<br>')}</div>
                </div>
            </div>
        `
    }).join('')
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

    // 对于图片/表情包检查，使用原始内容或最小清理，避免移除标签
    let clean = content
    // 只移除基本的模式标签，保留表情包标签
    clean = clean.replace(/\[ONLINE\]|\[\/ONLINE\]|\[OFFLINE\]|\[\/OFFLINE\]/gi, '').trim()

    // URL check
    const isUrlOnly = clean.startsWith('http') && clean.split(/\s+/).length === 1 &&
        (clean.split('?')[0].toLowerCase().match(/\.(jpg|png|gif|jpeg|webp)$/i))
    if (isUrlOnly) return true;

    // 如果消息类型明确是 sticker，直接认为是图片/贴纸
    if (msg.type === 'sticker') return true;

    // Sticker check (Only return true if it exists or is a URL)
    const match = clean.match(STICKER_REGEX)
    if (match) {
        const stickerName = match[1].trim()
        const stickerUrl = match[2] ? match[2].trim() : null
        
        // 如果提供了URL，直接认为是图片
        if (stickerUrl && (stickerUrl.startsWith('http') || stickerUrl.startsWith('blob:') || stickerUrl.startsWith('data:'))) {
            return true
        }
        
        // 传统格式：名称就是URL
        if (stickerName.startsWith('http') || stickerName.startsWith('blob:') || stickerName.startsWith('data:')) {
            return true
        }

        // Return TRUE only if we have a standalone tag AND it's a known sticker
        // This ensures broken stickers fall back to text bubble
        const found = findSticker(stickerName, stickerUrl);
        if (found) {
            // Check if it's purely just the sticker tag
            const isTagOnly = /^\[(?:图片|IMAGE|表情包|表情-包|STICKER)[:：].*?\]$/i.test(clean)
            return isTagOnly
        }
        // If sticker not found, return FALSE to show as text bubble
        // This allows [表情包：xxx] to be displayed as text when sticker doesn't exist
    }

    return false
}

function getFamilyCardApplyNote() {
    const content = ensureString(props.msg.content)
    if (!content) return '申请亲属卡'
    
    // 优先从msg.note中获取（系统设置的值）
    if (props.msg.note) {
        return props.msg.note
    }
    
    // 尝试从消息内容中提取申请留言
    const applyMatch = content.match(/\[(?:FAMILY_CARD_APPLY|申请亲属卡)[:：]?\s*([^\]]*)\]/i)
    if (applyMatch && applyMatch[1]) {
        const note = applyMatch[1].trim()
        return note || '申请亲属卡'
    }
    
    // 尝试从familyCardData中获取
    if (familyCardData.value && familyCardData.value.text) {
        return familyCardData.value.text
    }
    
    // 尝试从原始内容中直接提取，不经过cleanContent
    const rawMatch = content.match(/(?:FAMILY_CARD_APPLY|申请亲属卡)[:：]?\s*([^\[\]]*)/i)
    if (rawMatch && rawMatch[1]) {
        const note = rawMatch[1].trim()
        return note || '申请亲属卡'
    }
    return '申请亲属卡'
}

function isSticker(msg) {
    if (!msg) return false
    const content = ensureString(msg.content)
    return STICKER_REGEX.test(content)
}

const shouldShowAvatar = computed(() => {
    if (!props.forceOffline) return true
    let text = ensureString(props.msg.content)
    
    // If markers are present, formatMessageContent will handle internal avatars.
    if (/[‖【（「\(]/.test(text)) return false
    
    // Default to true for plain dialogue without markers
    if (props.msg.type && props.msg.type !== 'text') return false
    if (isSticker(props.msg) || isImageMsg(props.msg)) return false
    
    return true
})

const isCenteredContent = computed(() => {
    if (!props.forceOffline) return false
    return !shouldShowAvatar.value
})

// 支持两种格式：
// 1. [表情包：名称] - 传统格式，通过名称查找
// 2. [表情包：名称：https://url] - 新格式，通过URL查找或验证
const STICKER_REGEX = /\[(?:图片|IMAGE|表情包|表情-包|STICKER)[:：]\s*([^:：\]]+)(?:[:：]\s*(https?:\/\/[^\]]+))?\s*\]/i;

function normalizeStickerName(s) {
    if (!s) return '';
    return s.toString()
        .replace(/\.(?:png|jpg|gif|webp|jpeg|svg)$/i, '') // Remove standard extensions
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // Remove emojis
        .replace(/[。.，,！!？?\-\s\(\)（）"'"““”‘’\[\]]/g, '') // Remove punctuation, quotes and remaining brackets
        .toLowerCase()
        .trim();
}

function findSticker(name, url = null) {
    if (!name && !url) return null;
    const n = name ? name.trim() : '';
    const nClean = normalizeStickerName(n);
    
    const charStickers = props.chatData?.emojis || [];
    const globalStickers = stickerStore.getStickers('global') || [];
    const allAvailable = [...charStickers, ...globalStickers];
    
    // 如果提供了URL，优先通过URL精确匹配
    if (url) {
        const urlMatch = allAvailable.find(s => s.url === url.trim());
        if (urlMatch) return urlMatch;
    }
    
    if (!n && !nClean) return null;

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
    // 如果消息有 sticker 对象，直接使用 sticker 的 URL
    if (msg.sticker && msg.sticker.url) {
        return msg.sticker.url;
    }

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
        const stickerName = match[1].trim()
        const stickerUrl = match[2] ? match[2].trim() : null
        
        // 如果提供了URL，直接使用
        if (stickerUrl) {
            // 同时通过URL查找验证
            const found = findSticker(stickerName, stickerUrl);
            if (found) return found.url;
            // 如果没找到但URL有效，直接使用URL
            if (stickerUrl.startsWith('http')) return stickerUrl;
        }
        
        // 传统格式：只提供了名称
        if (stickerName.startsWith('http') || stickerName.startsWith('blob:') || stickerName.startsWith('data:')) {
            return stickerName;
        }

        // Robust Lookup by name
        const found = findSticker(stickerName);
        if (found) return found.url;

        // Fallback to Dicebear INITIALS (using cleaned name)
        const seed = normalizeStickerName(stickerName) || stickerName;
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
    
    // 如果是贴纸/图片消息，不显示文本内容（由图片层显示）
    if (msg.type === 'sticker' || msg.type === 'image' || isImageMsg(msg)) {
        return ''
    }
    
    let text = ensureString(msg.content)

    // Strip protocol tags and common AI leakage fields
    text = text.replace(/\[(?:STATUS|THINK|INNER|GIFT|红包|REDPACKET|LOCATION|SCENE)[:：][\s\S]*?\]/gi, '')
               .replace(/^\s*(?:心声|内心|心里|想|着装|环境|行为|场景|地点|状态|mood|thoughts|mind|outfit|status)[:：].*$/gim, '')
               .trim();

    if (props.forceOffline) {
        return renderOfflineMessageHtml(msg)
    }

    // 0. Novel Style Rendering
    if (props.forceOffline) {
        text = text.replace(/\[(?:图片|IMAGE|表情包|STICKER)[:：]\s*([^\]]+)\]/gi, (m, n) => {
            const f = findSticker(n.trim())
            return f ? `<img src="${f.url}" class="node-inline-sticker" style="height: 1.25em; vertical-align: middle; display: inline-block; margin: 0 4px;" />` : m
        })

        if (/‖|【|（|\(|\「/.test(text)) {
            // 支持未闭合的括号（如内容跨行或被截断）
            const parts = text.split(/(‖[^‖]+‖|【[^】]+】|[（\(][^）\)]*|「[^」]+」)/g).filter(p => p && p.trim())
            let htmlResult = ''
            
            const userName = props.chatData.groupSettings?.myNickname || props.chatData.userName || settingsStore.personalization.userProfile.name || '我'
            const characterName = props.chatData.name || '对方'
            const userAvatar = props.chatData.userAvatar || settingsStore.personalization.userProfile.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Me'
            const characterAvatar = props.chatData.avatar || 'https://api.dicebear.com/bottts/svg?seed=Bot'

            parts.forEach(p => {
                const chunk = p.trim()
                if (chunk.startsWith('‖')) {
                    htmlResult += `<div class="node-narration">‖ ${chunk.slice(1, -1)} ‖</div>`
                } else if (chunk.startsWith('【')) {
                    htmlResult += `<div class="node-scene">${chunk.slice(1, -1)}</div>`
                } else if (chunk.startsWith('（') || chunk.startsWith('(')) {
                    htmlResult += `<div class="node-action">（ ${chunk.replace(/[（）()]/g, '')} ）</div>`
                } else {
                    const isTagged = chunk.startsWith('「')
                    let speaker = props.msg.role === 'user' ? userName : characterName
                    let content = chunk
                    
                    if (isTagged) {
                        const match = chunk.match(/「(?:([^：:]+)[：:])?(.+?)」/)
                        if (match) {
                            speaker = match[1] || speaker
                            content = match[2]
                        } else {
                            content = chunk.slice(1, -1)
                        }
                    }

                    const isMe = (speaker === userName || props.msg.role === 'user')
                    const avatar = isMe ? userAvatar : characterAvatar
                    const side = isMe ? 'right' : 'left'
                    
                    // Dialogue with Avatar and Name
                    htmlResult += `
                        <div class="node-speech ${side}">
                            <img src="${avatar}" class="node-avatar shadow-sm" />
                            <div class="node-content">
                                <div class="node-name">${speaker}</div>
                                <div class="node-text">${isTagged ? `「${content}」` : content}</div>
                            </div>
                        </div>`
                }
            })
            return htmlResult || text
        }
    }

    // Standard processing
    text = getCleanContent(text)
    if (text.includes('\\n')) text = text.replace(/\\n/g, '\n');
    text = text.replace(/heartRate\s*[:：]\s*\d+(?:\s*bpm)?/gi, '').trim();
    text = text.replace(/心率\s*[:：]\s*\d+(?:\s*次)?(?:\/min)?/gi, '').trim();

    // === 增强清洗：移除残留的CSS属性和代码片段 ===
    // 移除内联style属性
    text = text.replace(/style\s*=\s*['"][^'"]*['"]/gi, '')
    // 移除残留的CSS属性键值对 (如 color: #xxx, font-size: 12px 等)
    .replace(/\b(?:color|background|font-size|font-weight|line-height|margin|padding|border|width|height|display|flex|align-items|text-align|animation|opacity|box-shadow|border-radius|overflow|position|top|left|right|bottom|cursor|pointer-events|outline|background-color|letter-spacing)\s*[:：]\s*[^;{}()\n]+[;]?/gi, '')
    // 移除CSS代码块 { ... } （特别是动画keyframes和短代码块）
    .replace(/\{[^{}]*(?:opacity|transform|animation)[^{}]*\}/gi, '')
    .replace(/@keyframes[\s\S]{5,}?\}\s*/g, '')
    // 移除裸露的HTML标签属性（标签已被getCleanContent剥离，但属性文本可能残留）
    .replace(/\b(?:class|id|src|alt|href|title|target|rel|type|value|name|placeholder|disabled|readonly|required|checked|selected|autofocus|autocomplete|role|aria-\w+|data-\w+)\s*=\s*['"][^'"]*['"]\s*/gi, ' ')
    // 移除残留的自闭合或孤立HTML标签（防御性）
    .replace(/<\/?(?:span|div|p|br|hr|img|a|b|i|u|em|strong|small|big|sub|sup|code|pre|details|summary|section|article|header|footer|nav|main|aside|figure|figcaption|picture|source|video|audio|track|canvas|svg|path|circle|rect|text|tspan|g|defs|use|linearGradient|stop|filter|fe[\w]+|clipPath|mask|pattern|symbol|animate|set|animateTransform|animateMotion)\b[^>]*>/gi, '')
    // 清理多余空格和空白行
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    .trim();

    // Protocol Badges
    text = text.replace(/\[DRAW:\s*([\s\S]*?)\]/gi, (match, prompt) => {
        const truncated = prompt.trim().length > 30 ? prompt.trim().substring(0, 30) + '...' : prompt.trim()
        return `<div class="inline-flex items-center gap-2 bg-blue-50/10 border border-blue-400/30 rounded-lg px-3 py-2 my-1 select-none backdrop-blur-sm shadow-sm overflow-hidden max-w-full"><i class="fa-solid fa-spinner fa-spin text-blue-400"></i><span class="text-xs text-blue-200/80 whitespace-nowrap overflow-hidden text-ellipsis">AI 正在绘制：${truncated}</span></div>`
    })

    text = text.replace(/\[INNER_VOICE\]([\s\S]*?)(?:\[\/INNER_VOICE\]|$)/gi, '');
    
    // Dice result card
    const diceMatch = text.match(/[\[【](?:摇骰子|掷骰子)[:：]?\s*(\d+)?[\]】]/i);
    if (diceMatch) {
       let dCount = Math.min(3, Math.max(1, parseInt(diceMatch[1]) || 1));
       const icons = ['fa-dice-one', 'fa-dice-two', 'fa-dice-three', 'fa-dice-four', 'fa-dice-five', 'fa-dice-six'];
       let dDisp = ''; let total = 0;
       for(let i=0; i<dCount; i++) {
           let r = Math.floor(Math.random()*6)+1; total+=r;
           dDisp += `<i class="fa-solid ${icons[r-1]} text-2xl mx-0.5 text-amber-500 animate-bounce"></i>`;
       }
       return `<div class="inline-flex flex-col items-center gap-3 bg-gradient-to-br from-yellow-50/30 to-amber-50/30 border border-amber-400/40 rounded-xl px-5 py-4 my-2 select-none backdrop-blur-sm shadow-lg w-[280px] max-w-[90vw] min-h-[140px] justify-center"><div class="flex items-center gap-2"><i class="fa-solid fa-dice text-amber-500 text-[16px]"></i><span class="text-sm text-amber-700 font-bold">掷出了骰子</span></div><div class="flex items-center justify-center gap-2">${dDisp}</div><div class="flex items-center gap-2 bg-amber-100/50 rounded-full px-4 py-2 mt-2"><span class="text-sm text-amber-800 font-medium">合计点数</span><span class="text-xl font-bold text-amber-600">${total}</span></div></div>`;
    }

    const userName = settingsStore.personalization.userProfile.name;
    const myName = props.chatData?.groupSettings?.myNickname || userName || '我';
    text = text.replace(/@(user|User|我)(?!\w)/g, `@${myName}`);

    let html = '';
    try {
        html = marked.parse(text);
    } catch (e) {
        html = text;
    }

    // Sticker fallback
    html = html.replace(/\[(.*?)\]/g, (match, name) => {
        let n = name.trim();
        const found = findSticker(n);
        if (found) return `<img src="${found.url}" class="w-16 h-16 inline-block mx-1 align-middle animate-bounce-subtle" alt="${found.name}" />`;
        return match;
    });

    return parseWeChatEmojis(html);
}

function formatLocation(content) {
    if (!content) return ''
    return ensureString(content)
        .replace(/[\\\[【（]\s*(?:位置|地图|MAP|LOCATION|场景|地点|SCENE|THINK|STATUS|INNER|心里|内心|心声)[:：]?\s*/i, '')
        .replace(/[\]】）\)\s]+$/, '')
        .replace(/^[\s/\\•·-]+/, '')
        .replace(/(?:OFFLINE|ONLINE|线下|线上)/gi, '')
        .replace(/^[\s•·-]+/, '')
        .trim()
}

// Render a single segment of content (for multi-paragraph bubble splitting)
function renderSegment(segment) {
    if (!segment) return ''
    
    // Aggressive cleaning for metadata keys that might leak into split segments
    const metaKeywords = [
        '心声', '内心', '着装', '环境', '行为', '场景', '地点', '状态', '心里',
        'type', 'card', 'html', 'json', 'status', 'speech', 'thought', 'thinking', 'conclusion', 'mood'
    ]
    let cleanSegment = segment
    metaKeywords.forEach(key => {
        const regex = new RegExp(`^\\s*${key}\\s*[:：].*$`, 'gim')
        cleanSegment = cleanSegment.replace(regex, '')
    })
    
    cleanSegment = cleanSegment.trim()
    if (!cleanSegment) return ''

    // Create a temporary message object with just this segment's content
    const tempMsg = {
        ...props.msg,
        content: cleanSegment
    }
    
    return formatMessageContent(tempMsg)
}


function getDuration(msg) {
    if (msg.duration) return msg.duration
    return Math.min(60, Math.max(1, Math.ceil(ensureString(msg.content).length / 3)))
}

function getPayTitle(msg) {
    const data = getPayData(msg)
    if (data.type === 'transfer') return `¥${data.amount}`
    return data.note || '恭喜发财，大吉大利'
}

function getPayDesc(msg, chatData) {
    const data = getPayData(msg)
    if (data.type === 'transfer') return data.note || '转账给您'

    if (chatData?.isGroup && msg.packetType === 'lucky') return '微信手气红包'
    return '微信红包'
}

function getPayStatusText(msg) {
    if (msg.isRejected) return '已拒收'
    const data = getPayData(msg)
    
    if (msg.isClaimed || msg.status === 'received') {
        if (data.type === 'transfer') {
            return msg.role === 'user' ? '对方已收款' : '已收款'
        }
        return msg.role === 'user' ? '已被领取' : '已领取'
    }

    if (msg.type === 'redpacket' && msg.remainingCount === 0) return '已领完'

    if (data.type === 'transfer') return '待收款'
    return '待领取'
}

function getPayIcon(msg) {
    const data = getPayData(msg)
    if (data.type === 'transfer') return 'fa-solid fa-arrow-right-arrow-left'
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
    if (!event?.touches?.length) return
    cancelLongPress()
    // Capture coordinates immediately to prevent stale event issues
    const touch = event.touches ? event.touches[0] : event;
    const capturedEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => event.preventDefault?.()
    };

    longPressTimer = setTimeout(() => {
        emitContextMenu(capturedEvent)
    }, 450)
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
    if (!event?.touches?.length) return
    avatarLongPressTriggered = false
    cancelAvatarLongPress()

    avatarLongPressTimer = setTimeout(() => {
        avatarLongPressTriggered = true
        emit('avatar-longpress', msg)
        avatarLongPressTimer = null
    }, 450)
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

        // 1. 移除 [INNER_VOICE] 标签和内容（包括换行符）
        processed = processed.replace(/\[INNER_VOICE\][\s\S]*?(?:\[\/INNER_VOICE\]|$)/gi, '').trim();
        // ✅ 隐藏心率参数（防止泄露）
        // 英文格式: heartRate: 110, heartRate：110, heartRate: 110 bpm, heartRate:110bpm
        processed = processed.replace(/heartRate\s*[:：]\s*\d+(?:\s*bpm)?/gi, '').trim();
        // 中文格式: 心率：110, 心率: 110 次, 心率:110次, 心率：110次/min
        processed = processed.replace(/心率\s*[:：]\s*\d+(?:\s*次)?(?:\/min)?/gi, '').trim();

        // 2. 检查是否是[CARD]格式
        if (processed.startsWith('[CARD]')) {
            // 移除[CARD]标签
            processed = processed.replace(/\[CARD\]/gi, '').trim();
            // 移除[/CARD]标签（如果存在）
            processed = processed.replace(/\[\/CARD\]/gi, '').trim();

            // 尝试解析JSON内容
            try {
                // 如果内容是JSON格式，提取html或content字段
                if (processed.startsWith('{')) {
                    const jsonData = JSON.parse(processed);
                    if (jsonData.html && typeof jsonData.html === 'string') {
                        return jsonData.html;
                    } else if (jsonData.content && typeof jsonData.content === 'string') {
                        return jsonData.content;
                    }
                }
            } catch (e) {
                // JSON解析失败，直接返回HTML内容
            }

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
            // 隐藏心率参数
            cleaned = cleaned.replace(/heartRate\s*[:：]\s*\d+(?:\s*bpm)?/gi, '').trim();
            cleaned = cleaned.replace(/心率\s*[:：]\s*\d+(?:\s*次)?(?:\/min)?/gi, '').trim();
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

/* 场景变更提示（线上模式） */
.scene-change-hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(100, 120, 140, 0.12);
    color: #8899aa;
    font-size: 10px;
    font-weight: 500;
    margin-bottom: 6px;
    animation: fadeIn 0.3s ease;
}

.scene-change-hint i {
    font-size: 9px;
    opacity: 0.7;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Voice bubble adjustments */
.chat-bubble-voice {
    transition: transform 0.2s ease, filter 0.2s ease;
}

.chat-bubble-voice:active {
    transform: scale(0.98);
    filter: brightness(0.95);
}

/* ✅ 修复：音乐气泡默认样式（会被全局 bubbleCss 覆盖） */
.voice-bubble.music-bubble.chat-bubble-left {
    background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%) !important;
    border-color: #fbcfe8 !important;
    color: #be185d !important;
}

.voice-bubble.music-bubble.chat-bubble-right {
    background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%) !important;
    border-color: #fbcfe8 !important;
    color: #be185d !important;
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

@keyframes shimmer {
    0% {
        transform: translateX(-100%);
    }
    100% {
        transform: translateX(100%);
    }
}

.animate-shimmer {
    animation: shimmer 3s infinite linear;
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
.no-bubble-offline {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    color: white !important;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    width: 100%;
}

:deep(.node-narration) {
    text-align: center;
    font-style: italic;
    color: rgba(255, 255, 255, 0.85);
    padding: 12px 0;
    width: 100%;
    font-family: "KaiTi", "STKaiti", serif;
}

:deep(.node-scene) {
    text-align: center;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.95);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    margin: 18px 0;
    font-size: 13px;
    letter-spacing: 0.3em;
    width: 100%;
}

:deep(.node-action) {
    text-align: center;
    color: rgba(255, 255, 255, 0.8);
    font-size: 15px;
    margin: 8px 0;
    width: 100%;
}

:deep(.node-speech) {
    display: flex;
    gap: 12px;
    margin: 12px 0;
    width: 100%;
}

:deep(.node-speech.right) {
    flex-direction: row-reverse;
}

:deep(.node-avatar) {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid rgba(255, 255, 255, 0.2);
}

:deep(.node-content) {
    display: flex;
    flex-direction: column;
    max-width: 75%;
}

:deep(.node-speech.right .node-content) {
    align-items: flex-end;
}

:deep(.node-speech.left .node-content) {
    align-items: flex-start;
}

:deep(.node-name) {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 4px;
}

:deep(.node-text) {
    font-size: 16px;
    color: white;
    line-height: 1.6;
    background: rgba(255, 255, 255, 0.1);
    backdrop-blur: sm;
    padding: 8px 14px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.node-speech.right .node-text) {
    background: rgba(149, 236, 105, 0.2);
    border-radius: 12px 2px 12px 12px;
}

:deep(.node-speech.left .node-text) {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px 12px 12px 12px;
}

:deep(.node-inline-sticker) {
    height: 1.3em;
    vertical-align: middle;
    display: inline-block;
    margin: 0 4px;
}
</style>

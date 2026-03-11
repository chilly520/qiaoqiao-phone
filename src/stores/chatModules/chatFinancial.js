import { useSettingsStore } from '../settingsStore'
import { useWalletStore } from '../walletStore'

export const setupFinancialLogic = (chats, addMessage, saveChats, playSound) => {
    /**
     * Fair lucky money splitting algorithm
     */
    function _splitRedPacket(total, count) {
        if (count <= 0) return [];
        if (count === 1) return [total];

        const results = [];
        let remainingTotal = total;
        let remainingCount = count;

        for (let i = 0; i < count - 1; i++) {
            // Double mean method (Max = 2 * remainingAverage - 0.01)
            // Min = 0.01
            const max = (remainingTotal / remainingCount) * 2;
            let amt = Math.random() * max;
            amt = Math.max(0.01, Math.floor(amt * 100) / 100);

            // Safety: don't leave less than 0.01 per remaining packet
            if ((remainingTotal - amt) < (remainingCount - 1) * 0.01) {
                amt = Math.max(0.01, remainingTotal - (remainingCount - 1) * 0.01);
                amt = Math.floor(amt * 100) / 100;
            }

            results.push(amt);
            remainingTotal = parseFloat((remainingTotal - amt).toFixed(2));
            remainingCount--;
        }

        results.push(remainingTotal);
        // Shuffle to avoid bias
        return results.sort(() => Math.random() - 0.5);
    }

    async function claimRedPacket(chatId, messageId, claimantId) {
        const chat = chats.value[chatId];
        if (!chat) return null;
        const msg = chat.msgs.find(m => m.id === messageId);
        if (!msg || msg.type !== 'redpacket') return null;

        // Critical: Initialize the distribution amounts if not present BEFORE claim
        if (!msg.amounts || msg.amounts.length === 0) {
            const total = parseFloat(msg.amount) || 0
            const count = parseInt(msg.count) || 1
            if (msg.packetType === 'lucky' && count > 1) {
                msg.amounts = _splitRedPacket(total, count)
            } else {
                msg.amounts = Array(count).fill(total)
            }
            console.log(`[RP_SAFETY_INIT] ID=${msg.id} Total=${total} Count=${count} Amounts=`, msg.amounts)
        }

        // Check already claimed by this user
        if (msg.claims.some(c => c.id === claimantId)) {
            return { claimed: true, already: true, item: msg.claims.find(c => c.id === claimantId) };
        }

        if (msg.remainingCount <= 0) {
            return { claimed: false, empty: true };
        }

        // Claim logic
        const claimIndex = msg.claims.length;
        const amount = (msg.amounts && msg.amounts[claimIndex] !== undefined) ? msg.amounts[claimIndex] : 0;

        console.log(`[RP_CLAIM] ChatID=${chatId} MsgID=${messageId} User=${claimantId} Amount=${amount} Index=${claimIndex}`);

        // Find claimant name/avatar
        let name = '未知', avatar = '';
        if (claimantId === 'user') {
            name = useSettingsStore().personalization?.userProfile?.name || '我';
            avatar = useSettingsStore().personalization?.userProfile?.avatar || '';
        } else {
            const p = chat.participants.find(p => p.id === claimantId);
            if (p) {
                name = p.name;
                avatar = p.avatar;
            }
        }

        const claimInfo = {
            id: claimantId,
            name,
            avatar,
            amount,
            time: Date.now()
        };

        msg.claims.push(claimInfo);
        msg.remainingCount--;

        // If user claimed, add to wallet
        if (claimantId === 'user') {
            useWalletStore().increaseBalance(amount, `领取红包: ${msg.note || '恭喜发财'}`);
            if (typeof playSound === 'function') playSound('coins');
        }

        // Add system message
        const claimantStr = claimantId === 'user' ? (useSettingsStore().personalization?.userProfile?.name || '你') : name;
        const ownerName = msg.senderName || (msg.role === 'user' ? (useSettingsStore().personalization?.userProfile?.name || '你') : (chat.isGroup ? (chat.participants.find(p => p.id === msg.senderId)?.name || chat.name) : chat.name));

        // 1. Claimed notification (private chat always shows '红包', group chat shows '拼手气红包' for lucky type)
        const rpType = (chat.isGroup && msg.packetType === 'lucky') ? '拼手气红包' : '红包';
        addMessage(chatId, {
            role: 'system',
            content: `${claimantStr}领取了${ownerName}的${rpType}`
        });

        // 2. Fully claimed notification (only for group chats)
        if (msg.remainingCount === 0 && chat.isGroup) {
            const durationMs = Date.now() - msg.timestamp;
            let timeStr = '';
            if (durationMs < 60000) {
                timeStr = `${Math.ceil(durationMs / 1000)}秒`;
            } else if (durationMs < 3600000) {
                timeStr = `${Math.ceil(durationMs / 60000)}分钟`;
            } else {
                timeStr = `${Math.ceil(durationMs / 3600000)}小时`;
            }
            addMessage(chatId, {
                role: 'system',
                content: `${ownerName}的红包已领完，共用时${timeStr}`
            });
        }

        saveChats();
        return { claimed: true, amount, item: claimInfo };
    }

    async function claimTransfer(chatId, messageId, claimantId = 'user') {
        const chat = chats.value[chatId];
        if (!chat) return false;
        const msg = chat.msgs.find(m => m.id === messageId);
        if (!msg || msg.type !== 'transfer' || msg.isClaimed) return false;

        // Verify target (if designated)
        if (msg.targetId && msg.targetId !== claimantId) {
            // Needs triggerToast injected if used here, returning generalized err obj or boolean for now
            return false;
        }

        msg.isClaimed = true;
        msg.claimTime = Date.now();
        msg.claimedBy = claimantId;

        // Find claimant name
        let name = '未知';
        if (claimantId === 'user') {
            name = useSettingsStore().personalization?.userProfile?.name || '我';
            useWalletStore().increaseBalance(msg.amount, `领到转账: ${msg.note || '无备注'}`);
            if (typeof playSound === 'function') playSound('coins');
        } else {
            const p = chat.participants.find(p => p.id === claimantId);
            if (p) name = p.name;
        }

        const claimantStr = claimantId === 'user' ? '你' : name;
        const ownerName = msg.senderName || (msg.role === 'user' ? (useSettingsStore().personalization?.userProfile?.name || '你') : chat.name);

        addMessage(chatId, {
            role: 'system',
            content: `${claimantStr}已领取了${ownerName}的转账`
        });

        saveChats();
        return true;
    }

    async function claimGift(chatId, messageId, claimantId = 'user') {
        const chat = chats.value[chatId];
        if (!chat) return false;
        const msg = chat.msgs.find(m => m.id === messageId);
        if (!msg || msg.type !== 'gift' || msg.status === 'claimed') return false;

        msg.status = 'claimed';
        msg.claimTime = Date.now();

        let claimantName = '未知';
        let claimantAvatar = '';
        if (claimantId === 'user') {
            claimantName = useSettingsStore().personalization?.userProfile?.name || '我';
            claimantAvatar = useSettingsStore().personalization?.userProfile?.avatar || '';
            // If user claims AI gift, add to backpack
            try {
                const { useBackpackStore } = await import('../backpackStore')
                useBackpackStore().addItem({
                    id: msg.itemId || `item_${Date.now()}`,
                    title: msg.giftName,
                    image: msg.giftImage,
                    description: msg.giftNote || '对方送来的礼物。',
                    source: `好友赠送`,
                    category: 'all'
                }, msg.giftQuantity || 1)
            } catch (e) { console.error('Failed to add item to backpack:', e) }
        } else {
            // Try to find in participants (group chat) or use chat info (private chat)
            const p = chat.participants?.find(p => p.id === claimantId);
            if (p) {
                claimantName = p.name;
                claimantAvatar = p.avatar;
            } else if (chat.id === claimantId) {
                // Private chat: the chat itself is the AI character
                claimantName = chat.name;
                claimantAvatar = chat.avatar;
            }
        }

        msg.claimedBy = {
            id: claimantId,
            name: claimantName,
            avatar: claimantAvatar,
            time: Date.now()
        };

        const claimantStr = claimantId === 'user' ? '你' : claimantName;
        const senderName = msg.senderName || (msg.role === 'user' ? (useSettingsStore().personalization?.userProfile?.name || '你') : chat.name);

        // 添加已领取系统消息
        addMessage(chatId, {
            role: 'system',
            content: `${claimantStr}已领取了${senderName}的礼物：${msg.giftName}`,
            systemMsg: true // 标记为系统消息，避免触发其他逻辑
        });

        // 生成已领取卡片
        // 根据领取者角色设置消息角色：用户领取显示在右侧(user)，AI领取显示在左侧(assistant)
        const claimCardRole = claimantId === 'user' ? 'user' : 'assistant';
        addMessage(chatId, {
            role: claimCardRole,
            type: 'gift_claimed',
            giftId: msg.giftId,
            giftName: msg.giftName,
            giftQuantity: msg.giftQuantity,
            giftNote: msg.giftNote,
            giftImage: msg.giftImage,
            originalSender: msg.senderName,
            claimantName: claimantName,
            claimantAvatar: claimantAvatar,
            claimTime: Date.now(),
            senderName: chat.name,
            systemMsg: true // 标记为系统消息
        });

        saveChats();
        return true;
    }

    function hasUnclaimedRP(chatId) {
        const chat = chats.value[chatId]
        if (!chat || !chat.msgs) return false
        // Search back common list to find any unclaimed red packets/transfers
        // Only check recent 50 messages for performance
        const msgs = chat.msgs.slice(-50)
        return msgs.some(m => {
            if (m.type === 'redpacket') {
                return m.remainingCount > 0 && !(m.claims || []).some(c => c.id === 'user')
            }
            if (m.type === 'transfer') {
                return !m.isClaimed && (m.targetId === 'user' || !m.targetId) && m.role !== 'user'
            }
            return false
        })
    }

    async function claimFamilyCard(chatId, messageId, claimantId = 'user') {
        const chat = chats.value[chatId];
        if (!chat) return false;
        const msg = chat.msgs.find(m => m.id === messageId);
        if (!msg || msg.type !== 'family_card' || msg.isClaimed) return false;

        msg.isClaimed = true;
        msg.claimTime = Date.now();

        let claimantName = '未知';
        if (claimantId === 'user') {
            claimantName = useSettingsStore().personalization?.userProfile?.name || '我';
            if (typeof playSound === 'function') playSound('coins');
        } else {
            const p = chat.participants?.find(p => p.id === claimantId);
            if (p) {
                claimantName = p.name;
            } else if (chat.id === claimantId) {
                claimantName = chat.name;
            }
        }

        const claimantStr = claimantId === 'user' ? '你' : claimantName;
        const ownerName = msg.senderName || (msg.role === 'user' ? (useSettingsStore().personalization?.userProfile?.name || '你') : chat.name);

        // 添加已领取系统消息
        addMessage(chatId, {
            role: 'system',
            content: `${claimantStr}已领取了${ownerName}的亲属卡`,
            systemMsg: true
        });

        saveChats();
        return true;
    }

    return {
        _splitRedPacket,
        claimRedPacket,
        claimTransfer,
        claimGift,
        claimFamilyCard,
        hasUnclaimedRP
    }
}

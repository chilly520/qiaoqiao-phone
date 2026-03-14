// 在控制台执行这段代码来诊断问题

// 1. 检查当前聊天的 msgs 数组
const chat = chatStore.chats[chatStore.currentChatId];
console.log('=== 当前聊天信息 ===');
console.log('Chat ID:', chatStore.currentChatId);
console.log('Total msgs:', chat?.msgs?.length || 0);
console.log('Loaded count:', chatStore.loadedMessageCounts[chatStore.currentChatId] || 'undefined');
console.log('Displayed count:', chatStore.getDisplayedMessages(chatStore.currentChatId).length);

// 2. 检查最后 5 条消息
console.log('\n=== 最后 5 条消息 ===');
if (chat?.msgs?.length > 0) {
    chat.msgs.slice(-5).forEach((msg, i) => {
        console.log(`${i + 1}. [${msg.role}] ${msg.type} - ${msg.content?.substring(0, 50)}...`);
        console.log('   Hidden:', msg.hidden, '| Timestamp:', msg.timestamp, '| Time diff:', Date.now() - msg.timestamp, 'ms');
    });
} else {
    console.log('❌ msgs 数组为空！');
}

// 3. 检查 pendingSegments
console.log('\n=== Pending Segments ===');
console.log('Pending segments:', chat?.pendingSegments?.length || 0);
if (chat?.pendingSegments?.length > 0) {
    console.log('Segments:', chat.pendingSegments);
}

// 4. 检查 typingStatus
console.log('\n=== Typing Status ===');
console.log('Typing status:', chatStore.typingStatus[chatStore.currentChatId]);

// 5. 检查 IndexedDB 中的保存时间
console.log('\n=== 检查 IndexedDB ===');
localforage.getItem('qiaoqiao_chats_v2').then(saved => {
    if (saved) {
        const savedChat = saved[chatStore.currentChatId];
        console.log('IndexedDB 中的 Chat ID:', chatStore.currentChatId);
        console.log('IndexedDB 中的 msgs 长度:', savedChat?.msgs?.length || 0);
        if (savedChat?.msgs?.length > 0) {
            console.log('IndexedDB 中最后 1 条消息:', savedChat.msgs[savedChat.msgs.length - 1]);
        }
        
        // 比较内存和 IndexedDB 的差异
        console.log('\n=== 内存 vs IndexedDB ===');
        console.log('内存 msgs 长度:', chat?.msgs?.length);
        console.log('IndexedDB msgs 长度:', savedChat?.msgs?.length);
        console.log('差异:', (chat?.msgs?.length || 0) - (savedChat?.msgs?.length || 0));
        
        if ((chat?.msgs?.length || 0) > (savedChat?.msgs?.length || 0)) {
            console.log('⚠️ 警告：内存中的数据比 IndexedDB 新！说明保存可能失败了！');
        }
    }
});

// 6. 强制刷新响应式
console.log('\n=== 尝试强制刷新 ===');
console.log('执行以下命令强制刷新：');
console.log('chatStore.chats[chatStore.currentChatId] = { ...chatStore.chats[chatStore.currentChatId] };');
console.log('然后检查页面是否显示消息...');

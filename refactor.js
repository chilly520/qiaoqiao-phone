import fs from 'fs';
const codeBlocks = [
    [1583, 1616], [1618, 1696], [1698, 1734], [4486, 4501], // Financial
    [1736, 1818], [1850, 1883], [1885, 2065], [2212, 2278], [2282, 2288], // History
    [222, 226], [228, 321], [323, 372], [374, 384], [386, 412], [414, 422], [424, 446], [448, 533], [4066, 4119], [4121, 4140], [4142, 4152], [4154, 4164], [4166, 4177], [4432, 4466], [4468, 4484], // Group
    [2070, 2125], [2127, 2198] // Proactive
];

let lines = fs.readFileSync('src/stores/chatStore.js', 'utf8').split('\n');
const linesToKeep = new Set();

for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    let shouldDelete = false;
    for (const [start, end] of codeBlocks) {
        if (lineNum >= start && lineNum <= end) {
            shouldDelete = true;
            break;
        }
    }
    if (!shouldDelete) {
        linesToKeep.add(i);
    }
}

let newText = lines.filter((_, i) => linesToKeep.has(i)).join('\n');

// Replace imports
newText = newText.replace(/import localforage from 'localforage'/m,
    `import localforage from 'localforage'
import { setupFinancialLogic } from './chatModules/chatFinancial'
import { setupGroupLogic } from './chatModules/chatGroup'
import { setupHistoryLogic } from './chatModules/chatHistory'
import { setupProactiveLogic } from './chatModules/chatProactive'`);

// Hook module execution
newText = newText.replace(/(const loadedMessageCounts = ref\(\{\\}\))/m,
    `$1

    // MODULE EXTRACTS
    const { _splitRedPacket, claimRedPacket, claimTransfer, hasUnclaimedRP } = setupFinancialLogic(chats, addMessage, saveChats)

    const _extractJsonFromText = (text) => {
        if (!text) return null
        const s = String(text).trim()
        const fenceMatch = s.match(/\`\`\`json\\s*([\\s\\S]*?)\`\`\`/i) || s.match(/\`\`\`\\s*([\\s\\S]*?)\`\`\`/i)
        const raw = (fenceMatch ? fenceMatch[1].trim() : s).trim()
        const arrStart = raw.indexOf('[')
        const arrEnd = raw.lastIndexOf(']')
        if (arrStart !== -1 && arrEnd > arrStart) return raw.substring(arrStart, arrEnd + 1)
        const objStart = raw.indexOf('{')
        const objEnd = raw.lastIndexOf('}')
        if (objStart !== -1 && objEnd > objStart) return raw.substring(objStart, objEnd + 1)
        return null
    }

    const { _deriveGroupNoFromChatId, _ensureGroupDefaults, createGroupChat, updateGroupProfile, updateGroupSettings, updateGroupParticipants, generateGroupMembers, transferGroupOwner, setParticipantRole, setParticipantTitle, muteParticipant, exitGroup, dissolveGroup } = setupGroupLogic(chats, createChat, addMessage, saveChats, getRandomAvatar, sendMessageToAI, _extractJsonFromText)
    const { summarizeHistory, checkAutoSummary, analyzeCharacterArchive, searchHistory, toggleSearch } = setupHistoryLogic(chats, typingStatus, isProfileProcessing, addMessage, triggerToast, saveChats)
    const { startProactiveLoop, checkProactive } = setupProactiveLogic(chats, currentChatId, typingStatus, sendMessageToAI)`);

fs.writeFileSync('src/stores/chatStore.js', newText);
console.log('Refactoring complete');

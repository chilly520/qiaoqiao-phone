
const cleanContent = "好的好的！遵命，大小姐！我现在的心情嘛……就像是从等待石化的小蘑菇，一下子变成了见到太阳的向日葵！🌻\n\n[CARD]{\"type\":\"html\"}";

// --- Pre-process: Extract and Protect CARD blocks ---
const cardBlocks = [];
let processedContent = cleanContent;

// Extract complete CARD blocks by finding balanced braces
const cardStartRegex = /\[CARD\]\s*\{/g;
let match;
const cardPositions = [];

while ((match = cardStartRegex.exec(cleanContent)) !== null) {
    const startPos = match.index;
    const jsonStart = match.index + match[0].length - 1;
    let braceCount = 1;
    let endPos = jsonStart + 1;
    while (endPos < cleanContent.length && braceCount > 0) {
        if (cleanContent[endPos] === '{') braceCount++;
        else if (cleanContent[endPos] === '}') braceCount--;
        endPos++;
    }
    if (braceCount === 0) {
        const fullCard = cleanContent.substring(startPos, endPos);
        cardPositions.push({ start: startPos, end: endPos, content: fullCard });
    }
}

for (let i = cardPositions.length - 1; i >= 0; i--) {
    const pos = cardPositions[i];
    const placeholder = `__CARD_PLACEHOLDER_${i}__`;
    cardBlocks.push(pos.content);
    processedContent = processedContent.substring(0, pos.start) + placeholder + processedContent.substring(pos.end);
}

console.log("Processed:", processedContent);

// --- Improved Splitting Logic (V5) ---
// Note: added \\ for js string escaping in regex
const tokenRegex = /(__CARD_PLACEHOLDER_\d+__|\\[DRAW:.*?\\]|\\[表情包:.*?\\]|\\([^\\)]+\\)|（[^）]+）|[!?;。！？；…\n]+|[^!?;。！？；…\n\(\)（）\[\]]+|\[[^\]]+\])/g;

const rawTokens = processedContent.match(tokenRegex) || [];
console.log("Tokens:", rawTokens);

let segments = [];
let currentSegment = "";

for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i].trim();
    if (!token) continue;

    // Logic simulation
    // ...
    const isPunctuation = /^[!?;。！？；…\n]+$/.test(token);

    if (isPunctuation) {
        console.log(`Token [${token}] is punctuation`);
    } else {
        console.log(`Token [${token}] is text`);
    }
}

import { readFileSync, writeFileSync } from 'fs';

const file = 'src/stores/chatStore.js';
let content = readFileSync(file, 'utf8');
const lines = content.split('\n');

// ---- FIX 1: splitRegex on line 3122 (0-indexed: 3121) ----
// Check if it needs fixing (still a regex literal or already new RegExp)
const splitLineIdx = lines.findIndex(l => l.includes('const splitRegex ='));
if (splitLineIdx !== -1 && lines[splitLineIdx].includes('/(__CARD_PLACEHOLDER')) {
    const parts = [
        '__CARD_PLACEHOLDER_\\d+__',
        '\\[\\/\\?\\s*OFFLINE\\s*\\]',
        '\\[\\/\\?\\s*ONLINE\\s*\\]',
        '\\[\\s*INNER[\\s\\-_]*VOICE\\s*\\][\\s\\S]*?\\[\\/\\s*(?:INNER[\\s\\-_]*)?VOICE\\s*\\]',
        '\\([^\\)]+\\)',
        '\\uff08[^\\uff09]+\\uff09',
        '\\[\\s*LS_JSON[:\\uff1a][\\s\\S]*?\\]',
        '\\[DRAW:[\\s\\S]*?\\]',
        '\\[(?:\\u8868\\u60c5\\u5305|\\u8868\\u60c5-\\u5305)[:\\uff1a][\\s\\S]*?\\]',
        '\\[FAMILY_CARD(?:_APPLY|_REJECT)?:[\\s\\S]*?\\]',
        '\\[CARD\\][\\s\\S]*?(?=\\n\\n|\\[\\/CARD\\]|$)',
        '\\u201c[^\\u201d]*\\u201d',
        '"[^"]*"',
        "\\u2018[^\\u2019]*\\u2019",
        "'[^']*'",
        '\\[\\u56fe\\u7247[:\\uff1a]?[\\s\\S]*?\\]',
        '\\[\\u8bed\\u97f3[:\\uff1a]?[\\s\\S]*?\\]',
        '\\[LIKE[:\\uff1a][\\s\\S]*?\\]',
        '\\[COMMENT[:\\uff1a]?[\\s\\S]*?\\]',
        '\\[REPLY[:\\uff1a][\\s\\S]*?\\]',
        '\\[(?!INNER_VOICE|LS_JSON|CARD|OFFLINE|ONLINE)[^\\]]+\\]',
        '[!?;\\u3002\\uff01\\uff1f\\uff1b\\u2026\\n]+'
    ];
    const pattern = '(' + parts.join('|') + ')';
    const indent = lines[splitLineIdx].match(/^(\s*)/)[1];
    lines[splitLineIdx] = `${indent}const splitRegex = new RegExp(${JSON.stringify(pattern)});`;
    console.log(`Fixed splitRegex at line ${splitLineIdx + 1}`);
}

// ---- FIX 2: isSpecial regex on line 3136 (0-indexed: 3135) ----
const isSpecialIdx = lines.findIndex(l => l.includes('const isSpecial =') && l.includes('\u7ea2\u5305'));
if (isSpecialIdx !== -1) {
    const indent = lines[isSpecialIdx].match(/^(\s*)/)[1];
    const isSpecialPattern = '^(__CARD_PLACEHOLDER_\\d+__|\\[\\/\\?\\s*(?:OFFLINE|ONLINE|INNER|LS_JSON|DRAW|MUSIC|DICE|TAROT|\\u7ea2\\u5305|\\u8f6c\\u8d26|REDPACKET|TRANSFER|\\u8868\\u60c5\\u5305|\\u8868\\u60c5-\\u5305|STICKER|\\u56fe\\u7247|IMAGE|\\u8bed\\u97f3|VOICE|\\u8bed\\u97f3\\u901a\\u8bdd|\\u89c6\\u9891\\u901a\\u8bdd|\\u901a\\u8bdd|CALL|\\u7ed8\\u753b|\\u751f\\u6210\\u56fe\\u7247|\\u6f14\\u594f|\\u97f3\\u4e50|\\u9ab0\\u5b50|\\u63b7\\u9ab0\\u5b50|\\u5854\\u7f57|\\u5854\\u7f57\\u724c|FAMILY_CARD|\\u573a\\u666f|SCENE|LIKE|\\u70b9\\u8d5e|\\u559c\\u6b22|COMMENT|\\u8bc4\\u8bba|REPLY|\\u56de\\u590d|\\u4f4d\\u7f6e|LOCATION|\\u5730\\u56fe|MAP|SHARE|\\u5206\\u4eab|\\u8f6c\\u53d1|\\u6587\\u4ef6|FILE|LINK|\\u94fe\\u63a5|URL|SYSTEM|\\u7cfb\\u7edf|\\u901a\\u77e5|SET_AVATAR|SET_NAME|SET_PAT|\\u8bbe\\u7f6e\\u5934\\u50cf|\\u8bbe\\u7f6e\\u6635\\u79f0|\\u8bbe\\u7f6e\\u62cd\\u4e00\\u62cd|NUDGE|\\u6233\\u4e00\\u6233|\\u62cd\\u4e00\\u62cd|QUOTE|\\u5f15\\u7528|GIFT|\\u793c\\u7269|CARD|\\u5b9a\\u65f6|TIMER|REMIND|\\u63d0\\u9192|\\u641c\\u7d22|SEARCH|\\u67e5\\u627e|\\u9ec4\\u5386|ALMANAC|\\u8fd0\\u52bf)|\\(|\\uff08|\\u3010)';
    lines[isSpecialIdx] = `${indent}const isSpecial = new RegExp(${JSON.stringify(isSpecialPattern)}).test(trimmedPart);`;
    console.log(`Fixed isSpecial at line ${isSpecialIdx + 1}`);
}

// ---- FIX 3: isPunctuation regex ----
const isPunctIdx = lines.findIndex((l, i) => i > (isSpecialIdx || 0) && l.includes('const isPunctuation =') && l.includes('\u3002'));
if (isPunctIdx !== -1) {
    const indent = lines[isPunctIdx].match(/^(\s*)/)[1];
    lines[isPunctIdx] = `${indent}const isPunctuation = /^[!?;\\u3002\\uff01\\uff1f\\uff1b\\u2026\\r\\n]+$/.test(part);`;
    console.log(`Fixed isPunctuation at line ${isPunctIdx + 1}`);
}

writeFileSync(file, lines.join('\n'), 'utf8');
console.log('All fixes applied to', file);

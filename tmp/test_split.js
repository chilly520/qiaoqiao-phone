
const splitRegex = new RegExp("(\\r?\\n|__CARD_PLACEHOLDER_\\d+__|\\[\\/\\?\\s*OFFLINE\\s*\\]|\\[\\/\\?\\s*ONLINE\\s*\\]|\\|\\|[\\s\\S]*?\\|\\||\\u2016[\\s\\S]*?\\u2016|\\u3010[^\\u3011]+\\u3011|\\[[^\\]]+\\]|\\([^\\)]+\\)|\\uff08[^\\uff09]+\\uff09)");

const response = "Hello\nWorld\n[STICKER:123]";
const rawParts = response.split(splitRegex);
console.log("Parts:", rawParts);

let rawSegments = [];
let currentRawSegment = "";

for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    if (part === undefined) continue;

    const trimmedPart = part.trim();
    const isNewline = /^\r?\n$/.test(part);
    // Rough approximation of isTag for test
    const isTag = /^\[[^\s\]]+(?::[^\]]*)?\]$/.test(trimmedPart);
    const isTheater = /^(\|\||\u2016)[\s\S]*?(\|\||\u2016)$/.test(trimmedPart);
    const isPlaceholder = /^__CARD_PLACEHOLDER_\d+__$/.test(trimmedPart);
    
    if (isNewline || isPlaceholder || isTag || isTheater || trimmedPart.startsWith('【') || trimmedPart.startsWith('(') || trimmedPart.startsWith('（')) {
        if (currentRawSegment) { 
            rawSegments.push(currentRawSegment); 
            currentRawSegment = ""; 
        }
        if (!isNewline) rawSegments.push(part);
    } else {
        currentRawSegment += part;
    }
}
if (currentRawSegment) rawSegments.push(currentRawSegment);

console.log("Raw Segments:", rawSegments);

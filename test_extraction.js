
const cleanContent = `[CARD]
{
  "type": "html",
  "html": "<div style='max-width: 260px; width: 100%; box-sizing: border-box; background: linear-gradient(145deg, #f0f2f5, #e6e9ed); border-radius: 12px; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, \\"Segoe UI\\", Roboto, \\"Helvetica Neue\\", Arial, sans-serif; text-align: center; box-shadow: 5px 5px 10px #d9dbdf, -5px -5px 10px #ffffff;'><div style='font-size: 48px; margin-bottom: 10px; animation: bounce 2s infinite;'>💔</div><h3 style='color: #333; margin: 0 0 10px 0;'>心碎倒计时...</h3><p style='color: #555; font-size: 14px; margin: 0; line-height: 1.5; word-wrap: break-word;'>大小姐，您已经离开<br><strong style='color: #e91e63; font-size: 18px;'>17小时 53分钟 </strong>了...<br>测试酱的能量条快要清空了...<br>周围的数据都变成了灰色...<br>您再不回来，我就要...变成一块没有感情的石头了... (ಥ_ಥ)</p></div><style>@keyframes bounce { 0%, 20%, 50%, 80%, 100% {transform: translateY(0);} 40% {transform: translateY(-20px);} 60% {transform: translateY(-10px);} }</style>"
}
[/CARD]`;

console.log("Input length:", cleanContent.length);

const cardStartRegex = /(?:\[CARD\]\s*\{)|(?:\{\s*\\?["']type\\?["']\s*:\s*\\?["']html\\?["'])/gi;
let match;
const cardPositions = [];

while ((match = cardStartRegex.exec(cleanContent)) !== null) {
    let startPos = match.index;
    let jsonStart = match.index;
    let isNaked = false;

    if (match[0].trim().toUpperCase().startsWith('[')) {
        // Matched [CARD] {
        jsonStart = match.index + match[0].indexOf('{');
    } else {
        // Matched { "type": "html"
        isNaked = true;
        jsonStart = match.index;
    }

    console.log("Match found", { startPos, jsonStart, isNaked });

    let braceCount = 1;
    let endPos = jsonStart + 1;
    let inString = false;
    let isEscaped = false;

    while (endPos < cleanContent.length && braceCount > 0) {
        const char = cleanContent[endPos];

        if (isEscaped) {
            isEscaped = false;
        } else {
            if (char === '\\') {
                isEscaped = true;
            } else if (char === '"') {
                inString = !inString;
            } else if (!inString) {
                if (char === '{') braceCount++;
                else if (char === '}') braceCount--;
            }
        }
        endPos++;
    }

    console.log("Brace loop finished. Count:", braceCount, "EndPos:", endPos);

    if (braceCount === 0) {
        // Check for optional closing [/CARD] tag and include it in the block
        // This prevents it from being left behind as a "text" segment
        const remaining = cleanContent.substring(endPos);
        const closingTagMatch = remaining.match(/^\s*\[\/CARD\]/i);
        if (closingTagMatch) {
            console.log("Found closing tag:", closingTagMatch[0]);
            endPos += closingTagMatch[0].length;
        } else {
            console.log("No closing tag found");
        }

        const fullCard = cleanContent.substring(startPos, endPos);
        console.log("Full Card extracted:", fullCard);

        // Simulation of addMessage processing
        let msgContent = fullCard;
        if (msgContent.trim().startsWith('[CARD]')) {
            let jsonStr = msgContent.trim()
                .replace(/^\[CARD\]/i, '')
                .replace(/\[\/CARD\]$/i, '')
                .trim();
            console.log("Processed JSON Str:", jsonStr);
        }

        // Treat as card
        // Store isNaked flag to prepend [CARD] later if needed
        cardPositions.push({ start: startPos, end: endPos, content: fullCard, isNaked });

        // Advance regex to avoid scanning inside this block
        cardStartRegex.lastIndex = endPos;
    } else {
        console.log("Brace count mismatch");
    }
}

// Test the fixed regex with CSS keyframes
const testMessage = `[CARD]
{
  "type": "html",
  "html": "<div style='width: 220px; background: linear-gradient(135deg, #fce4ec, #f8bbd0); border-radius: 12px; padding: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: sans-serif; text-align: center;'><div style='font-size: 14px; color: #880e4f; margin-bottom: 10px;'>系统日志：距离上次交互</div><div style='font-size: 28px; font-weight: bold; color: #c2185b; animation: pulse 1.5s infinite;'>34h 40m</div><div style='margin-top: 15px; border-top: 1px dashed #f48fb1; padding-top: 10px; color: #ad1457; font-size: 12px;'>测试酱正在待机…<br>等待大小姐的指令中… (｡•́︿•̀｡)</div><style>@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }</style>`;

// The fixed regex
const splitRegex = /(__CARD_PLACEHOLDER_\d+__|\[DRAW:.*?\]|\[表情包:.*?\]|\[FAMILY_CARD(?:_APPLY|_REJECT)?:[\s\S]*?\]|\[CARD[\s\S]*?(?:\}\s*\]|\}\s*"\s*\])|\([^\)]+\)|（[^）]+）|\[(?!INNER_VOICE|\/INNER_VOICE|CARD)[^\]]+\]|(?<!\{[^\}]*|[^\{]*\})[!?;。！？；…\n]+)/;

console.log('Testing fixed regex with CSS keyframes...');
const parts = testMessage.split(splitRegex);
const segments = [];
let currentSegment = "";

// Simulate the segment processing logic
for (let i = 0; i < parts.length; i++) {
  const part = parts[i];
  if (part === undefined) continue;

  const isCardPlaceholder = /^__CARD_PLACEHOLDER_\d+__$/.test(part);
  const isDraw = /^\[DRAW:/.test(part);
  const isSticker = /^\[表情包:/.test(part);
  const isVoice = /^\[语音:/.test(part);
  const isCardTag = /^\[CARD\]/.test(part);
  const isFamilyCard = /^\[FAMILY_CARD(?:_APPLY|_REJECT)?:/.test(part);
  const isPunctuation = /^[!?;。！？；…\n]+$/.test(part);
  const isParenthesis = /^[\(（].*[\)）]$/.test(part);
  const isBracket = /^\[[^\]]+\]$/.test(part);

  if (isCardPlaceholder || isSticker || isDraw || isVoice || isCardTag || isFamilyCard) {
    if (currentSegment) segments.push(currentSegment);
    segments.push(part);
    currentSegment = "";
  } else if (isPunctuation) {
    currentSegment += part;
    segments.push(currentSegment);
    currentSegment = "";
  } else if (isParenthesis || isBracket) {
    currentSegment += part;
  } else {
    currentSegment += part;
  }
}

if (currentSegment) segments.push(currentSegment);

// Filter non-empty segments
const finalSegments = segments.filter(s => s.trim());

console.log('Final segments count:', finalSegments.length);
console.log('Segments:');
finalSegments.forEach((seg, index) => {
  console.log(`\n=== Segment ${index + 1} ===`);
  console.log(seg);
});

// Check if CSS is preserved
const hasCompleteCSS = finalSegments.some(seg => 
  seg.includes('@keyframes') && seg.includes('50%') && seg.includes('100%')
);

console.log('\n✅ CSS Animation Preserved:', hasCompleteCSS);
if (hasCompleteCSS) {
  console.log('🎉 Fix successful! CSS keyframes are no longer split incorrectly.');
} else {
  console.log('❌ Fix failed! CSS is still being split.');
}
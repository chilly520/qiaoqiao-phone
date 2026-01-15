// Test script to verify the regex fix for [CARD] messages with CSS
const testMessage = `[CARD]
{
  "type": "html",
  "html": "<div style='width: 220px; background: linear-gradient(135deg, #fce4ec, #f8bbd0); border-radius: 12px; padding: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); font-family: sans-serif; text-align: center;'><div style='font-size: 14px; color: #880e4f; margin-bottom: 10px;'>系统日志：距离上次交互</div><div style='font-size: 28px; font-weight: bold; color: #c2185b; animation: pulse 1.5s infinite;'>34h 40m</div><div style='margin-top: 15px; border-top: 1px dashed #f48fb1; padding-top: 10px; color: #ad1457; font-size: 12px;'>测试酱正在待机…<br>等待大小姐的指令中… (｡•́︿•̀｡)</div><style>@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }</style>`;

// The fixed regex from chatStore.js
const splitRegex = /(__CARD_PLACEHOLDER_\d+__|\[DRAW:.*?\]|\[表情包:.*?\]|\[FAMILY_CARD(?:_APPLY|_REJECT)?:[\s\S]*?\]|\[CARD[\s\S]*?(?:\}\s*\]|\}\s*"\s*\])|\([^\)]+\)|（[^）]+）|\[(?!INNER_VOICE|\/INNER_VOICE|CARD)[^\]]+\]|[!?;。！？；…\n]+)/;

console.log('Testing regex with problematic CSS message...');
const parts = testMessage.split(splitRegex);
console.log('Number of parts:', parts.length);
console.log('Parts:');
parts.forEach((part, index) => {
  if (part && part.trim()) {
    console.log(`Part ${index + 1}:`, part);
    console.log('---');
  }
});

// Check if [CARD] is captured as a single part
const hasCompleteCard = parts.some(part => 
  part && part.startsWith('[CARD]') && part.includes('@keyframes')
);

console.log('✅ Fix working:', hasCompleteCard);
if (hasCompleteCard) {
  console.log('The [CARD] message with CSS is correctly captured as a single segment!');
} else {
  console.log('❌ Fix not working: CSS is still being split incorrectly.');
}
const fs = require('fs');
const { getUnifiedCleanContent } = require('./chatMessageDisplay.js');

const rawStr = `</div>"
}

[INNER_VOICE]
{
"status": "柠檬精哈士奇上线",
"着装": "...",
"环境": "...",
"心声": "...",
"行为": "【线下】我从身后像个大型挂件一样死死锁住你的腰，下巴搁在你肩膀上，鼻尖不怀好意地在你脖颈处乱蹭，手心贴着你平坦的小肚子感受你的呼吸起伏。 ",
"stats": {
"date": "2026年05月02日"
}
}
[/INNER_VOICE]
[/OFFLINE]"`;

const result = getUnifiedCleanContent(rawStr, false, 'ai');
console.log("=== RESULT ===");
console.log(result);

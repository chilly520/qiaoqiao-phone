const str = `</div>"
}

[INNER_VOICE]
{
"status": "柠檬精哈士奇上线",
"行为": "【线下】我从身后像个大型挂件一样死死锁住你的腰"
}
[/INNER_VOICE]
[/OFFLINE]`;

const re = /\[\s*(?:INNER[-_ ]?VOICE|心声|内心|心理活动)\s*\][\s\S]*?(?:\[\/\s*(?:INNER[-_ ]?VOICE|心声|内心|心理活动)\s*\]|$)/gi;

console.log(str.replace(re, '---STRIPPED---'));

const str = `</div>"
}

[INNER_VOICE]
{
"status": "柠檬精哈士奇上线",
"行为": "【线下】我从身后像个大型挂件一样死死锁住你的腰"
}
[/INNER_VOICE]
[/OFFLINE]`;

const re = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|(?=(?:\n|\\n)?\s*[\[【]\s*(?:CARD|ONLINE|OFFLINE|IMAGE|VIDEO|AUDIO|FILE|MOMENT|红包|转账|表情包|图片))|$)/gi;

console.log(str.replace(re, '---STRIPPED---'));

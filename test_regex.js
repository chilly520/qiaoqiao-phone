const content = `(听到你这声熟悉的“猪”，我那颗七上八下、惊恐万分的心瞬间就落回了实处。这声骂简直就是天籁之音，是赦免令，是警报解除的信号。我紧绷的身体一下子就软了下来，整个人都松懈了。)(我非但没有生气，反而把脸在你柔软的胸口埋得更深了，像只终于找到主人的流浪狗，发出满足又委屈的哼唧声。)对对对，我是猪，我是全世界最大最笨的猪……(我闷闷的声音从你胸前传来，带着浓浓的鼻音和劫后余生的庆幸。)老婆骂得对……只有我的香香老婆才能骂我，多骂几句，我爱听……(我一边说，一边用脸颊蹭着你，贪婪地汲取着你的气息和温度，仿佛这样就能确认你没有真的生我的气。)只要你不讨厌我，怎么骂我都行。(我抬起头，红着眼睛，像只讨赏的小狗一样看着你，小心翼翼地问。)那……既然大姨妈都快走了……洗澡的事情……我们是不是可以重新商量一下了？十分钟，我保证把你洗得香喷喷的，然后抱回来睡觉觉，好不好呀，我的好老婆？[表情包:求求你了（求你之舞）]

[INNER_VOICE]
{
 "status": "劫后余生ing",
 "着装": "上装：无，裸着上半身 下装：深灰色丝质睡裤 鞋子：赤脚 装饰：无",
 "环境": "2026年01月20日 03:50 周二 / 司荔庄园主卧 / 床头的昏黄壁灯将房间照得暧昧又温暖，空气中弥漫着淡淡的沐浴露香气和属于你的甜香。",
 "心声": "情绪：从惊恐慌乱瞬间转为安心和窃喜。 想法：太好了，她没生气！骂我是猪就代表没事了！我的天，刚刚真的吓死我了，差点以为要引发婚姻危机了。她果然还是心疼我的，看我这么可怜就原谅我了。既然她大姨妈快走了，那是不是可以顺势把洗澡这件事给解决了？我真是个小机灵鬼。不过……记错日期这件事真的太离谱了，我得赶紧找个时间补补脑子，不能再这么浑浑噩噩下去了，太丢人了。",
 "行为": "【线下】。我将脸埋在你的胸口，像小动物一样依赖地蹭着，感受着你的心跳和体温。然后我抬起头，用湿漉漉的、充满恳求的眼神望着你，手指不自觉地抓着你睡衣的一角，轻轻晃动着，用肢体语言表达我的撒娇和讨好。"
}
[/INNER_VOICE]`;

const contentNoTail = `(Test content) [INNER_VOICE]
{
 "status": "Cut off test"
}`;

// The regex from chatStore.js (relaxed spaces + EOF support)
const innerVoiceRegex = /\[\s*INNER[\s-_]*VOICE\s*\]([\s\S]*?)(?:\[\/\s*(?:INNER[\s-_]*)?VOICE\s*\]|$)/gi;

console.log("--- Testing Full Content ---");
const fullMatches = [...content.matchAll(innerVoiceRegex)];
if (fullMatches.length > 0) {
    console.log("Match Found!");
    console.log("Extracted raw body length:", fullMatches[0][1].length);
    try {
        const json = JSON.parse(fullMatches[0][1]);
        console.log("JSON Parse Success. Status:", json.status);
    } catch (e) {
        console.log("JSON Parse Failed:", e.message);
    }
} else {
    console.log("No Match Found");
}

console.log("\n--- Testing Content with Missing Tail (Simulated Cutoff) ---");
const tailMatches = [...contentNoTail.matchAll(innerVoiceRegex)];
if (tailMatches.length > 0) {
    console.log("Match Found!");
    console.log("Extracted raw body:", tailMatches[0][1]);
} else {
    console.log("No Match Found");
}

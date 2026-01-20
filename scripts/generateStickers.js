
import fs from 'fs';
import path from 'path';

const inputFile = 'E:\\乔篱\\小手机\\表情包001.txt';
const outputFile = 'E:\\乔篱\\小手机\\qiaqiao-phone\\src\\stores\\defaultStickers.js';

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split(/\r?\n/);

const stickers = [];

lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    let name = '';
    let url = '';

    // Smart Separator Detection (Logic copied from StickerStore)
    let sepIndex = line.indexOf('：');
    if (sepIndex === -1) {
        const engIndex = line.indexOf(':');
        if (engIndex > -1) {
            const isUrlStart = line.substring(engIndex, engIndex + 3) === '://';
            if (isUrlStart) {
                // No separator
            } else {
                sepIndex = engIndex;
            }
        }
    }

    if (sepIndex > -1) {
        name = line.substring(0, sepIndex).trim();
        url = line.substring(sepIndex + 1).trim();
    } else if (line.startsWith('http')) {
        url = line;
        name = `Sticker_${stickers.length + 1}`;
    }

    if (!url || (!url.startsWith('http') && !url.startsWith('data:'))) return;

    // Categorization Logic
    let category = '其他';
    const n = name;

    if (/早安|晚安|早上好|晚上好|再见|拜拜|好的|收到|谢谢|不客气|OK|ok|Ok|嗯|哦|哈|嘿|Hi|Hello|你好|在吗/.test(n)) {
        category = '日常';
    } else if (/贴贴|亲亲|抱抱|喜欢|爱|么么|萌|乖|想你|可爱|心心|笔芯|比心|幸福|害羞|羞涩|唯美|软|甜|咪|猫|兔|老婆|老公|宝|贝/.test(n)) {
        category = '可爱';
    } else if (/哭|呜|泪|悲|伤|痛|惨|死|委屈|难过|失望|emo|抑郁|自闭|累|困|烦|怒|气|滚|操|草|傻|逼|笨|猪|狗|爷|老子|打你|揍|刀|枪|杀|暴|躁|恨|讨|厌|呸|去死|妈|爹/.test(n)) {
        category = '情绪';
    } else if (/笑|哈|乐|喜|耶|棒|赞|强|牛|666|加油|冲|胜|赢|好运|欧|皇|财|富|钱|V我|红包|转账/.test(n)) {
        category = '快乐'; // Merge into Emotion or separate?
    } else if (/惊|吓|呆|晕|惑|问|啥|什|怎|疑|懵|怪|奇|神|经|病|疯|癫|抽|搐|鬼|祟|偷|窥|觑|看|盯|瞧|瞅/.test(n)) {
        category = '搞怪';
    }

    // Refinement: Some keywords might overlap, prioritize mood/cute
    if (category === '快乐') category = '日常'; // Or Emotion

    // Final bucket
    if (['日常', '可爱', '情绪', '搞怪'].indexOf(category) === -1) {
        category = '搞怪'; // Default fallback for internet slangs
    }

    stickers.push({ name, url, category });
});

const fileContent = `// Auto-generated from 表情包001.txt
export const defaultStickers = ${JSON.stringify(stickers, null, 4)}
`;

fs.writeFileSync(outputFile, fileContent, 'utf-8');
console.log(`Generated ${stickers.length} stickers to ${outputFile}`);

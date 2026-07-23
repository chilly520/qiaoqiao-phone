import { readFile, writeFile } from 'node:fs/promises';
const enc = encodeURIComponent;
const base = new URL('../public/fonts/', import.meta.url);

// 只保留 3 个手写体 (Noto Serif SC / Cormorant Garamond 体积太大/对中文无效, 已放弃)
let ma = await readFile(new URL(`${enc('Ma Shan Zheng')}/${enc('Ma Shan Zheng')}.css`, base), 'utf8');
ma = ma.replace(/font-family:\s*'Ma Shan Zheng'/g, "font-family: 'huangkaihuaLawyerfont'");
const long = await readFile(new URL(`${enc('Long Cang')}/${enc('Long Cang')}.css`, base), 'utf8');
const zhi = await readFile(new URL(`${enc('Zhi Mang Xing')}/${enc('Zhi Mang Xing')}.css`, base), 'utf8');

const header = `/* 本地化手写体: 替代 v1.10.205 删除的 Google Fonts 远程 @import
   - huangkaihuaLawyerfont -> 本地 Ma Shan Zheng (主手写体, 覆盖 LoveSpace 所有组件)
   - Long Cang / Zhi Mang Xing -> 可选手写体
   全部走 file:// 本地加载, 不联网不白屏.
   心声卡片用的 Noto Serif SC / Cormorant Garamond 因体积(4.85MB)放弃本地化,
   中文 fallback 系统宋体(SimSun), 视觉接近衬线. */\n`;
const out = header + ma + '\n' + long + '\n' + zhi + '\n';
await writeFile(new URL('../src/assets/handwriting.css', import.meta.url), out);
console.log('written src/assets/handwriting.css', (out.length / 1024).toFixed(1), 'KB');

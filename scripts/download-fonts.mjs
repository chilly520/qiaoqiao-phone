// 把被 v1.10.205 删除的 Google Fonts 中文书法体本地化到 public/fonts/
// 只取"主用汉字区(4e/3400) + CJK标点(3000/ff0/fe3/2e8/f90) + latin" 段, 体积可控(~1.5MB/字体)
// APK 走 file:// 本地加载, 不联网不白屏
import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const OUT = new URL('../public/fonts/', import.meta.url);

// 恢复被 v1.10.205 删除的全部字体: 手写体(情侣空间) + 衬线(心声卡片/全局)
const FONTS = {
  'Ma Shan Zheng': 'Ma+Shan+Zheng',
  'Long Cang': 'Long+Cang',
  'Zhi Mang Xing': 'Zhi+Mang+Xing',
  'Noto Serif SC': 'Noto+Serif+SC:wght@400;500;700',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400',
};

function shouldKeep(range) {
  if (/\blatin\b/i.test(range)) return true; // 精确 latin (不含 latin-ext)
  // 基本汉字 4E00-9FFF / 扩展A 3400-4DBF / CJK标点 3000 3001.. / 全角 FF00 FE30 / 2E80 / 兼容汉字 F900
  return /(^|[^a-f0-9])(?:4e|3400|3000|ff0|fe3|2e8|f90)/i.test(range);
}

async function main() {
  for (const [family, param] of Object.entries(FONTS)) {
    const dir = new URL(`${encodeURIComponent(family)}/`, OUT);
    await mkdir(dir, { recursive: true });
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${param}&display=swap`, { headers: { 'User-Agent': UA } })).text();
    const re = /@font-face\s*\{([^}]+)\}/g;
    let m, i = 0, total = 0;
    let cssOut = `/* ${family} - 本地化 (chinese-simplified 主段 + latin), 来源 Google Fonts, 离线可用, 不触发 file:// 白屏 */\n`;
    while ((m = re.exec(css)) !== null) {
      const body = m[1];
      const range = (body.match(/unicode-range:\s*([^;]+)/i) || [])[1] || '';
      const src = (body.match(/src:\s*url\(([^)]+)\)/i) || [])[1];
      if (!shouldKeep(range) || !src) continue;
      const res = await fetch(src, { headers: { 'User-Agent': UA } });
      if (!res.ok) { console.warn(`  ! ${family} 失败 ${src} -> ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      const name = `${i}.woff2`; i++;
      await writeFile(new URL(name, dir), buf);
      total += buf.length;
      console.log(`  ✓ ${family} [${range.trim().slice(0, 30)}...] ${name} ${(buf.length / 1024).toFixed(0)}KB`);
      cssOut += `@font-face {\n  font-family: '${family}';\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url('/fonts/${encodeURIComponent(family)}/${name}') format('woff2');\n  unicode-range: ${range.trim()};\n}\n`;
    }
    await writeFile(new URL(`${encodeURIComponent(family)}.css`, dir), cssOut);
    console.log(`=> ${family}: ${i} 子集, ${(total / 1024 / 1024).toFixed(2)}MB, 生成 ${family}.css`);
  }
  console.log('ALL DONE');
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });

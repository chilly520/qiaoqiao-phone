// 审计所有 Pinia setup store,找出定义但未 return 的函数
import fs from 'fs';
import path from 'path';

const storesDir = 'src/stores';
const files = fs.readdirSync(storesDir).filter(f => f.endsWith('.js'));

const report = [];

for (const f of files) {
    const full = path.join(storesDir, f);
    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split('\n');

    // 找 defineStore('xxx', () => { 的位置
    const startMatch = content.match(/defineStore\(['"](\w+)['"]\s*,\s*\(\)\s*=>\s*\{/);
    if (!startMatch) continue; // 不是 setup store 语法,跳过

    const startIdx = startMatch.index;
    const storeName = startMatch[1];

    // 找 setup store 的结束 }) 对应行号
    // 简单方法:从 defineStore 后开始,数大括号层级
    let depth = 0;
    let setupStartLine = -1, setupEndLine = -1;
    let foundFirstBrace = false;
    for (let i = lines.length - 1; i >= 0; i--) {
        // 反向找文件最后的 })
        // 找最后一个 return { ... } 块
    }

    // 收集所有 `function name(` 定义
    const defined = new Set();
    const fnRegex = /^\s+(?:async\s+)?function\s+(\w+)\s*\(/;
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(fnRegex);
        if (m) defined.add(m[1]);
    }

    // 找文件末尾 return { ... } 块
    // 通常是 setup store 的最后几行
    let returnStart = -1, returnEnd = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].match(/^\s*\}\s*\)\s*$/)) {
            returnEnd = i;
            break;
        }
    }
    // 往前找匹配的 return {
    for (let i = returnEnd; i >= 0; i--) {
        if (lines[i].match(/^\s*return\s*\{/)) {
            returnStart = i;
            break;
        }
    }

    if (returnStart < 0) {
        report.push({ file: f, store: storeName, note: '未找到 return { ... } 块,需手动检查', defined: [...defined] });
        continue;
    }

    // 收集 return { ... } 中的字段
    const returned = new Set();
    for (let i = returnStart; i <= returnEnd; i++) {
        const line = lines[i];
        // 提取 `name,` 或 `name }` 或 `name: alias` 或 `name(args)` 这种
        const matches = line.matchAll(/^\s*(\w+)(?:\s*[:,].*?)?[,]?\s*$/g);
        for (const m of matches) {
            const name = m[1];
            // 过滤掉 false 关键字等
            if (['return', 'true', 'false', 'null', 'const', 'let', 'var', 'function', 'new'].includes(name)) continue;
            returned.add(name);
        }
    }

    const missing = [...defined].filter(n => !returned.has(n));
    if (missing.length > 0) {
        report.push({ file: f, store: storeName, missingFunctions: missing, definedCount: defined.size, returnedCount: returned.size });
    } else {
        report.push({ file: f, store: storeName, status: 'OK', definedCount: defined.size, returnedCount: returned.size });
    }
}

console.log(JSON.stringify(report, null, 2));

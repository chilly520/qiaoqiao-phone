import fs from 'fs';
import path from 'path';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.vue')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('e:/CHILLY/phone/qiaqiao-phone/src');
let totalFixed = 0;

files.forEach(file => {
    let buffer = fs.readFileSync(file);
    let changed = false;
    let bomCount = 0;

    while (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        buffer = buffer.slice(3);
        changed = true;
        bomCount++;
    }

    if (changed) {
        console.log(`Removed ${bomCount} BOM(s) from: ${file}`);
        fs.writeFileSync(file, buffer);
        totalFixed++;
    }
});

console.log(`Finished. Fixed ${totalFixed} files.`);

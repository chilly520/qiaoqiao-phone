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
let fixedCount = 0;

files.forEach(file => {
    const buffer = fs.readFileSync(file);
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        console.log('Fixing BOM in:', file);
        const content = buffer.slice(3);
        fs.writeFileSync(file, content);
        fixedCount++;
    }
});

console.log(`Finished. Fixed ${fixedCount} files.`);

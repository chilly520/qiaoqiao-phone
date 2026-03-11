import fs from 'fs';
import path from 'path';

function processDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.vue') || file.endsWith('.json')) {
            const buf = fs.readFileSync(fullPath);
            if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
                console.log('Removing BOM from:', fullPath);
                let start = 0;
                while (buf[start] === 0xEF && buf[start + 1] === 0xBB && buf[start + 2] === 0xBF) {
                    start += 3;
                    console.log('  ...another level of BOM detected');
                }
                const newBuf = buf.slice(start);
                fs.writeFileSync(fullPath, newBuf);
            }
        }
    });
}

processDir('src');
console.log('Done cleaning BOMs.');

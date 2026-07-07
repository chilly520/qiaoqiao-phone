import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionFilePath = path.join(__dirname, '../src/version.json');
const publicVersionFilePath = path.join(__dirname, '../public/version.json');

function bump() {
    try {
        const data = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
        const versionParts = data.version.split('.').map(Number);

        // Bump patch version: 1.2.0 -> 1.2.1
        versionParts[2] += 1;

        data.version = versionParts.join('.');

        // Update build time to current local time
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');

        data.buildTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

        const jsonStr = JSON.stringify(data, null, 2);
        fs.writeFileSync(versionFilePath, jsonStr, 'utf8');
        // v1.10.68: 同步到 public/,运行时 fetch('/version.json') 需要
        fs.writeFileSync(publicVersionFilePath, jsonStr, 'utf8');
        console.log(`Version bumped to ${data.version} at ${data.buildTime}`);
    } catch (error) {
        console.error('Failed to bump version:', error);
        process.exit(1);
    }
}

bump();

import fs from 'fs';
import path from 'path';

const originalPath = 'e:/CHILLY/phone/qiaqiao-phone/src/utils/ai/prompts_private.js';
const backupPath = 'e:/CHILLY/phone/qiaqiao-phone/src/utils/ai/prompts_private.js.backup';
const newPath = 'e:/CHILLY/phone/qiaqiao-phone/src/utils/ai/prompts_private.js';

try {
    // 读取原始文件
    const content = fs.readFileSync(originalPath, 'utf8');
    
    // 创建备份
    fs.writeFileSync(backupPath, content, 'utf8');
    console.log('Backup created at:', backupPath);
    
    // 简单的清理 - 移除任何可能的隐藏字符
    const cleanedContent = content
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim() + '\n';
    
    // 写回文件
    fs.writeFileSync(newPath, cleanedContent, 'utf8');
    console.log('File cleaned and rewritten successfully');
    
} catch (error) {
    console.error('Error:', error);
}

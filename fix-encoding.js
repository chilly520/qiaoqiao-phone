import fs from 'fs';
import path from 'path';

const filePath = 'e:/CHILLY/phone/qiaqiao-phone/src/utils/ai/prompts_private.js';

try {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log('File read successfully');
    console.log('First 500 chars:', content.substring(0, 500));
    
    // 重新写入，确保使用正确的编码
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('File rewritten successfully');
} catch (error) {
    console.error('Error:', error);
}

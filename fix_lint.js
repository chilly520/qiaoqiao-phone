import fs from 'fs';
const path = 'e:/乔篱/小手机/qiaqiao-phone/src/views/WeChat/CharacterProfileView.vue';
let content = fs.readFileSync(path, 'utf8');
console.log('Original content length:', content.length);
// More aggressive regex to match any flavor of newline and indentation
const newContent = content.replace(/\{\{\s*bio\.occupation\s*\|\|\s*'Personal[\s\r\n]+Identity'\s*\}\}/g, "{{ bio.occupation || 'Personal Identity' }}");
console.log('Modified content length:', newContent.length);
fs.writeFileSync(path, newContent, 'utf8');

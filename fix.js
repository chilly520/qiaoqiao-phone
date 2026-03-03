import fs from 'fs';
const files = [
    'src/stores/chatModules/chatGroup.js',
    'src/stores/chatModules/chatHistory.js',
    'src/stores/chatModules/chatProactive.js'
];
for (const f of files) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/\\\$/g, '$');
    content = content.replace(/\\`/g, '`');
    fs.writeFileSync(f, content);
}
console.log('Fixed escaping in modules');

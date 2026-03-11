import fs from 'fs';
const path = 'e:/CHILLY/phone/qiaqiao-phone/src/views/Forum/ForumApp.vue';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
const seen = new Set();
const newLines = [];
let removed = 0;
lines.forEach((line, i) => {
  const match = line.match(/\s*(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/);
  if (match) {
    const name = match[2];
    if (seen.has(name)) {
      console.log(`Removing duplicate declaration of ${name} at line ${i+1}: ${line.trim()}`);
      newLines.push('\n'); // push empty line to preserve line numbers if possible or just remove it
      removed++;
    } else {
      seen.add(name);
      newLines.push(line);
    }
  } else {
    newLines.push(line);
  }
});
fs.writeFileSync(path, newLines.join('\n'));
console.log(`Done. Removed ${removed} duplicates.`);

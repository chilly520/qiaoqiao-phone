import fs from 'fs';
const content = fs.readFileSync('e:/CHILLY/phone/qiaqiao-phone/src/views/Forum/ForumApp.vue', 'utf8');
const scriptMatch = content.match(/<script setup>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  const scriptContent = scriptMatch[1];
  const lines = scriptContent.split('\n');
  const counts = {};
  lines.forEach((line, i) => {
    // Look for identifier declarations
    const match = line.match(/\s*(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/);
    if (match) {
      const name = match[2];
      if (!counts[name]) counts[name] = [];
      counts[name].push({ line: i + 1, content: line.trim() });
    }
  });
  let found = false;
  for (const name in counts) {
    if (counts[name].length > 1) {
      console.log(`Duplicate found: ${name}`);
      counts[name].forEach(m => console.log(`  Line ${m.line}: ${m.content}`));
      found = true;
    }
  }
  if (!found) console.log('No duplicates found in script block');
} else {
  console.log('No script setup found');
}

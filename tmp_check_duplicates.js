const fs = require('fs');
const content = fs.readFileSync('e:/CHILLY/phone/qiaqiao-phone/src/views/Forum/ForumApp.vue', 'utf8');
const scriptMatch = content.match(/<script setup>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  const scriptContent = scriptMatch[1];
  const lines = scriptContent.split('\n');
  const counts = {};
  lines.forEach((line, i) => {
    const match = line.match(/^\s*const\s+([a-zA-Z0-9_$]+)\s*=/);
    if (match) {
      const name = match[1];
      if (!counts[name]) counts[name] = [];
      counts[name].push(i + 1);
    }
  });
  for (const name in counts) {
    if (counts[name].length > 1) {
      console.log(`Duplicate found: ${name} at script lines ${counts[name].join(', ')}`);
    } else {
      // also check for reactive/ref without const
      const match2 = lines[counts[name][0]-1].match(/ref|reactive/);
      // ... already checked above
    }
  }
} else {
  console.log('No script setup found');
}

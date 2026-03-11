import fs from 'fs';
const content = fs.readFileSync('e:/CHILLY/phone/qiaqiao-phone/src/views/Forum/ForumApp.vue', 'utf8');
const lines = content.split('\n');
for (let i = 660; i < 675; i++) {
  console.log(`${i+1}: ${lines[i] ? lines[i].replace(/\r/g, '') : 'UNDEFINED'}`);
}

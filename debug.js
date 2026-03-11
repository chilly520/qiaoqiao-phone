const fs = require('fs');
const content = fs.readFileSync('e:\\CHILLY\\phone\\qiaqiao-phone\\src\\stores\\chatStore.js', 'utf8');

const lines = content.split('\n');
let insideSendMessageToAI = false;
const constVars = new Set();
let scopeLevel = 0;

lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    if (trimmed.includes('async function sendMessageToAI')) {
        insideSendMessageToAI = true;
        scopeLevel = 0;
    }

    if (!insideSendMessageToAI) return;

    // Track braces
    for (let char of line) {
        if (char === '{') scopeLevel++;
        if (char === '}') scopeLevel--;
    }

    // Find const declarations (simple version)
    const constMatch = trimmed.match(/^const\s+(\w+)\s*=/);
    if (constMatch) {
        constVars.add(constMatch[1]);
    }

    // Find assignments
    const assignMatch = trimmed.match(/^(\w+)\s*=[^=]/);
    if (assignMatch) {
        const varName = assignMatch[1];
        if (constVars.has(varName)) {
            console.log(`Potential assignment to const: ${varName} at line ${lineNum}`);
        }
    }

    if (scopeLevel === -1 && insideSendMessageToAI) {
        insideSendMessageToAI = false;
        constVars.clear();
    }
});

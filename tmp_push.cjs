const { execSync } = require('child_process');
execSync('git add -A', { stdio: 'inherit' });
execSync('git commit -m "v1.10.181: fix AI incorrectly using shared link cover as avatar"', { stdio: 'inherit' });

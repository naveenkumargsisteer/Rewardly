const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const viteBin = path.join(rootDir, 'client', 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');

if (!fs.existsSync(viteBin)) {
  console.log('[Rewardly Build] Installing client dependencies...');
  execSync('npm --prefix client install --no-audit --no-fund', { cwd: rootDir, stdio: 'inherit' });
}

console.log('[Rewardly Build] Building React frontend...');
execSync('npm --prefix client run build', { cwd: rootDir, stdio: 'inherit' });

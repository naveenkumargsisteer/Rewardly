const fs = require('node:fs');
const path = require('node:path');
const { execSync, execFileSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const viteJs = path.join(clientDir, 'node_modules', 'vite', 'bin', 'vite.js');
const reactPluginPkg = path.join(clientDir, 'node_modules', '@vitejs', 'plugin-react', 'package.json');

if (!fs.existsSync(viteJs) || !fs.existsSync(reactPluginPkg)) {
  console.log('[Rewardly Build] Installing client dependencies (including Vite)...');
  const installEnv = { ...process.env, NODE_ENV: 'development' };
  delete installEnv.npm_config_omit;
  delete installEnv.npm_config_production;
  delete installEnv.NPM_CONFIG_PRODUCTION;
  execSync('npm --prefix client install --include=dev --no-audit --no-fund', {
    cwd: rootDir,
    stdio: 'inherit',
    env: installEnv,
  });
}

if (!fs.existsSync(viteJs)) {
  throw new Error(`[Rewardly Build] Vite entrypoint not found at ${viteJs}`);
}

console.log('[Rewardly Build] Building React frontend with Vite...');
execFileSync(process.execPath, [viteJs, 'build'], {
  cwd: clientDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

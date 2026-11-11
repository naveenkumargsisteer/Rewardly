const { getConfig } = require('./src/config/env');
const { getBackendStatus } = require('./src/db');
const app = require('./src/app');

const cfg = getConfig();

app.listen(cfg.port, () => {
  const status = getBackendStatus();
  console.log(`\n✨ Rewardly server running on http://localhost:${cfg.port}`);
  console.log(`   Data Source : ${status.label}`);
  console.log(`   Public API  : http://localhost:${cfg.port}/api/public/export\n`);
});

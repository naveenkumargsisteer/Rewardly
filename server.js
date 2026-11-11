const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { getConfig } = require('./src/config/env');
const { getBackendStatus } = require('./src/db');
const apiRoutes = require('./src/routes/apiRoutes');
const publicExportRoutes = require('./src/routes/publicExportRoutes');

const app = express();
const cfg = getConfig();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Mount Exposed Public Export API and Core API
app.use('/api', publicExportRoutes);
app.use('/api', apiRoutes);

// Serve built React UI from client/dist
const clientDist = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(
      '<h2>Rewardly API is running.</h2><p>Run <code>npm run build</code> to compile the UI into client/dist, or start Vite via <code>npm run dev:client</code>.</p>'
    );
  });
}

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[Rewardly Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

app.listen(cfg.port, () => {
  const status = getBackendStatus();
  console.log(`\n✨ Rewardly server running on http://localhost:${cfg.port}`);
  console.log(`   Data Source : ${status.label}`);
  console.log(`   Public API  : http://localhost:${cfg.port}/api/public/export\n`);
});


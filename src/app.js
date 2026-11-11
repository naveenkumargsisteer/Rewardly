const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes');
const publicExportRoutes = require('./routes/publicExportRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Mount Exposed Public Export API and Core API
app.use('/api', publicExportRoutes);
app.use('/api', apiRoutes);

// Serve built React UI locally when client/dist exists (Vercel serves client/dist via CDN)
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
if (!process.env.VERCEL && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else if (!process.env.VERCEL) {
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

module.exports = app;


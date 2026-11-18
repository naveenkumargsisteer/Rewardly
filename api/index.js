// Rewardly API Serverless Entry v1.0.1
const app = require('../src/app');

module.exports = (req, res) => {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req, res);
};


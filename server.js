const app = require('./app');
const env = require('./config/env');
const storageService = require('./services/storage.service');

async function start() {
  // Make sure storage folders exist before we accept any requests.
  await storageService.ensureStorageDirs();

  app.listen(env.port, () => {
    console.log(`Storage server running at http://localhost:${env.port}`);
    console.log(`Health check: http://localhost:${env.port}/health`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

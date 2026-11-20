'use strict';
const { loadConfig } = require('./config/env');
const { createApp } = require('./app');

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`\n✖ ${err.message}\n`);
  process.exit(1);
}

const app = createApp(config);

if (config.DEMO_MODE) {
  console.warn('\n⚠  DEMO MODE is ON: demo accounts may exist (see README). Never deploy with DEMO_MODE=true.\n');
}

const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`Tourly API listening on http://${config.HOST}:${config.PORT} (${config.NODE_ENV})`);
});

function shutdown() {
  server.close(() => { app.locals.close(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

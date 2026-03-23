import { startStudioServer } from './app.mjs';

const started = await startStudioServer();

async function shutdown() {
  await started.close();
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});

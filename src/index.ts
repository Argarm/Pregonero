import './config';
import cron from 'node-cron';
import { config } from './config';
import { getDb } from './db';
import { runPipeline } from './runner';
import { log } from './logger';

getDb(); // initialize DB on startup

const runNow = process.argv.includes('--run-now');

if (runNow) {
  log.info('Running pipeline now (--run-now flag)');
  runPipeline()
    .then(() => process.exit(0))
    .catch((err) => {
      log.error('Pipeline failed:', err);
      process.exit(1);
    });
} else {
  log.info(`Pregonero started. Cron schedule: "${config.cron}"`);
  if (config.dryRun) log.info('DRY_RUN=true — no Telegram messages will be sent');

  // Run once immediately on first start, then follow the cron schedule
  runPipeline().catch((err) => log.error('Initial pipeline run failed:', err));

  cron.schedule(config.cron, () => {
    runPipeline().catch((err) => log.error('Scheduled pipeline run failed:', err));
  });

  process.on('SIGINT', () => {
    log.info('Shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log.info('Shutting down...');
    process.exit(0);
  });
}

const required = ['ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[ERROR] Missing required environment variable: ${key}`);
    console.error('Copy .env.example to .env and fill in all required values.');
    process.exit(1);
  }
}

export const config = Object.freeze({
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN!,
    chatId: process.env.TELEGRAM_CHAT_ID!,
  },
  cron: process.env.CRON_SCHEDULE ?? '0 8 * * *',
  maxAiCallsPerRun: parseInt(process.env.MAX_AI_CALLS_PER_RUN ?? '20', 10),
  aiCallDelayMs: parseInt(process.env.AI_CALL_DELAY_MS ?? '1000', 10),
  dbPath: process.env.DB_PATH ?? './data/pregonero.db',
  dryRun: process.env.DRY_RUN === 'true',
  logLevel: process.env.LOG_LEVEL ?? 'info',
});

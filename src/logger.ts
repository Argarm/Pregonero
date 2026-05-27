type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function currentLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as Level;
  return LEVELS[raw] ?? LEVELS.info;
}

function fmt(level: string, msg: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
}

export const log = {
  debug: (...args: unknown[]) => {
    if (currentLevel() <= LEVELS.debug) console.log(fmt('debug', args.join(' ')));
  },
  info: (...args: unknown[]) => {
    if (currentLevel() <= LEVELS.info) console.log(fmt('info', args.join(' ')));
  },
  warn: (...args: unknown[]) => {
    if (currentLevel() <= LEVELS.warn) console.warn(fmt('warn', args.join(' ')));
  },
  error: (...args: unknown[]) => {
    if (currentLevel() <= LEVELS.error) console.error(fmt('error', args.join(' ')));
  },
};

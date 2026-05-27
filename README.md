# Pregonero

Automated dev/AI news curation pipeline. Pulls RSS feeds, filters articles with Claude Haiku, and posts approved items to a Telegram channel — once a day, on schedule.

```
RSS feeds → fetch → deduplicate → Claude Haiku filter → Telegram
```

## How it works

1. **Fetch** — pulls items from 12 RSS/Atom feeds (Hacker News, GitHub Blog, Anthropic, Reddit, dev.to, Lobsters, GitHub Trending, etc.)
2. **Deduplicate** — skips any URL already stored in the local SQLite database
3. **Filter** — sends each new item to Claude Haiku, which approves or rejects based on a strict classifier prompt (new tools, libraries, frameworks, SDKs, AI models)
4. **Publish** — approved items are formatted and sent to a Telegram chat with 3 bullet points: what it is, the key benefit, one concrete use case
5. **Store** — every processed item (approved, rejected, or error) is saved to SQLite to prevent reprocessing

## Requirements

- [Bun](https://bun.sh) >= 1.0
- Anthropic API key
- Telegram bot token + chat ID

## Setup

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env and fill in ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

## Usage

```bash
# Start the scheduler (runs immediately, then follows CRON_SCHEDULE)
bun start

# Run the pipeline once and exit
bun run-now

# Development mode (auto-restarts on file changes)
bun dev

# Type check
bun typecheck
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `TELEGRAM_BOT_TOKEN` | — | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | — | Numeric chat ID to post to |
| `CRON_SCHEDULE` | `0 8 * * *` | Cron expression (default: 8am daily) |
| `MAX_AI_CALLS_PER_RUN` | `20` | Max Claude calls per pipeline run |
| `AI_CALL_DELAY_MS` | `1000` | Delay between consecutive AI calls (ms) |
| `DB_PATH` | `./data/pregonero.db` | SQLite database path |
| `DRY_RUN` | `false` | Skip Telegram sends and DB writes |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

## Feeds

Configured in `feeds.json`. Default sources:

- Hacker News Show HN & top items
- GitHub Blog
- Anthropic blog
- Changelog News
- Reddit: r/programming, r/MachineLearning, r/LocalLLaMA
- dev.to: tools & AI tags
- Lobsters (programming)
- GitHub Trending (daily)

## Project structure

```
src/
  index.ts      — entry point, cron scheduler
  runner.ts     — main pipeline orchestrator
  fetcher.ts    — RSS fetch and parsing
  ai.ts         — Claude Haiku classifier
  telegram.ts   — Telegram message formatting and sending
  db.ts         — SQLite persistence
  config.ts     — environment config
  logger.ts     — structured logger
feeds.json      — list of RSS feed URLs
```

## Tech stack

- **Runtime**: Bun
- **AI**: Claude Haiku (`claude-haiku-4-5`) via Anthropic SDK
- **Telegram**: grammY
- **Database**: Bun SQLite (built-in)
- **Feeds**: rss-parser
- **Scheduling**: node-cron

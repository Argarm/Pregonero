# Pregonero

LLM-filtered tech digest delivered to Telegram every morning.

[![Daily Digest](https://github.com/Argarm/Pregonero/actions/workflows/daily.yml/badge.svg)](https://github.com/Argarm/Pregonero/actions/workflows/daily.yml)

There is too much noise on the internet to keep up with the tech industry. Pregonero filters it for you: every morning receive a digest in Telegram with the releases, tools and technical articles that are truly worth it — no basic tutorials, no business news, no noise.

```
RSS feeds → fetch → deduplicate → LLM filter → Telegram digest
```

## How it works

1. **Fetch** — fetches items from 11 RSS/Atom sources (Hacker News, GitHub Blog, Changelog, Reddit, dev.to, Lobsters, GitHub Trending). Items older than 24h are discarded.
2. **Deduplication** — ignores any already-processed URL, stored in a local SQLite database.
3. **Filter** — sends each new item to Groq (llama-3.3-70b-versatile), which approves or rejects based on a strict classifier aimed at senior AI engineers.
4. **Publication** — all approved items are grouped into a single Telegram digest with 3 bullets each: what it is, why it matters and a concrete use case. Output is in Spanish.
5. **Storage** — each processed item (approved, rejected or errored) is saved in SQLite to avoid reprocessing.

## Requirements

- [Bun](https://bun.sh) >= 1.0
- Groq API key
- Telegram bot token + chat ID

## Installation

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env and fill in GROQ_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

## Usage

```bash
# Start the scheduler (runs immediately then follows CRON_SCHEDULE)
bun start

# Run the pipeline once and exit
bun run-now

# Development mode (auto-restarts on file changes)
bun dev

# Type checking
bun typecheck
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | — | Groq API key |
| `TELEGRAM_BOT_TOKEN` | — | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | — | Numeric chat ID where the digest is published |
| `CRON_SCHEDULE` | `0 8 * * *` | Cron expression (default: 8am daily) |
| `MAX_AI_CALLS_PER_RUN` | `20` | Maximum AI calls per run |
| `AI_CALL_DELAY_MS` | `1000` | Pause between consecutive AI calls (ms) |
| `DB_PATH` | `./data/pregonero.db` | SQLite database path |
| `DRY_RUN` | `false` | Skips Telegram sending and DB writes |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

## Feeds

Configured in `feeds.json` as an array of `{ url, weight }` objects. Higher weight means more proportional slots per run via weighted round-robin.

Default sources:

- Hacker News Show HN and top items
- GitHub Blog
- Changelog News
- Reddit: r/programming, r/MachineLearning, r/LocalLLaMA
- dev.to: tools & AI tags
- Lobsters (programming)
- GitHub Trending (daily)

## CI / Scheduled execution

A GitHub Actions workflow (`.github/workflows/daily.yml`) runs the pipeline automatically at **7:00 UTC** every day (8:00 CET). The SQLite database is persisted between runs via `actions/cache` to maintain deduplication state.

Required repository secrets: `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

The workflow also supports manual triggering from the **Actions** tab.

## Project structure

```
src/
  index.ts      — entry point, cron scheduler
  runner.ts     — main pipeline orchestrator
  fetcher.ts    — RSS fetch and parsing (24h filter)
  ai.ts         — LLM classifier with Groq
  telegram.ts   — digest formatting and Telegram delivery
  db.ts         — SQLite persistence
  config.ts     — environment variable configuration
  logger.ts     — structured logger
feeds.json      — RSS feed list with weights
.github/
  workflows/
    daily.yml   — scheduled GitHub Actions workflow
```

## Tech stack

- **Runtime**: Bun
- **AI**: Groq (`llama-3.3-70b-versatile`) via groq-sdk
- **Telegram**: grammY
- **Database**: Bun SQLite (built-in)
- **Feeds**: rss-parser
- **Scheduling**: node-cron / GitHub Actions

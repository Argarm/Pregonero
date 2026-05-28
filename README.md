# Pregonero

Hay demasiado ruido en internet para seguir el ritmo de la industria tech. Pregonero lo filtra por ti: cada mañana recibe en Telegram un digest con los lanzamientos, herramientas y artículos técnicos que realmente valen la pena — sin tutoriales básicos, sin noticias de negocio, sin ruido.

```
RSS feeds → fetch → deduplicate → LLM filter → Telegram digest
```

## How it works

1. **Fetch** — pulls items from 11 RSS/Atom feeds (Hacker News, GitHub Blog, Changelog, Reddit, dev.to, Lobsters, GitHub Trending). Items older than 24h are skipped.
2. **Deduplicate** — skips any URL already stored in the local SQLite database.
3. **Filter** — sends each new item to Groq (llama-3.3-70b-versatile), which approves or rejects based on a strict classifier prompt targeting a senior AI-focused engineer.
4. **Publish** — all approved items are grouped into a single Telegram digest with 3 bullet points each: what it is, why it matters, one concrete takeaway. Output is in Spanish.
5. **Store** — every processed item (approved, rejected, or error) is saved to SQLite to prevent reprocessing.

## Requirements

- [Bun](https://bun.sh) >= 1.0
- Groq API key
- Telegram bot token + chat ID

## Setup

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env and fill in GROQ_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
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
| `GROQ_API_KEY` | — | Groq API key |
| `TELEGRAM_BOT_TOKEN` | — | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | — | Numeric chat ID to post to |
| `CRON_SCHEDULE` | `0 8 * * *` | Cron expression (default: 8am daily) |
| `MAX_AI_CALLS_PER_RUN` | `20` | Max AI calls per pipeline run |
| `AI_CALL_DELAY_MS` | `1000` | Delay between consecutive AI calls (ms) |
| `DB_PATH` | `./data/pregonero.db` | SQLite database path |
| `DRY_RUN` | `false` | Skip Telegram sends and DB writes |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

## Feeds

Configured in `feeds.json` as an array of `{ url, weight }` objects. Higher weight means proportionally more slots in each run via weighted round-robin.

Default sources:

- Hacker News Show HN & top items
- GitHub Blog
- Changelog News
- Reddit: r/programming, r/MachineLearning, r/LocalLLaMA
- dev.to: tools & AI tags
- Lobsters (programming)
- GitHub Trending (daily)

## CI / Scheduled runs

A GitHub Actions workflow (`.github/workflows/daily.yml`) runs the pipeline automatically at **7:00 UTC** every day (8:00 CET). The SQLite database is persisted between runs via `actions/cache` to maintain deduplication state.

Required repository secrets: `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

The workflow also supports manual dispatch from the **Actions** tab.

## Project structure

```
src/
  index.ts      — entry point, cron scheduler
  runner.ts     — main pipeline orchestrator
  fetcher.ts    — RSS fetch and parsing (24h cutoff)
  ai.ts         — Groq LLM classifier
  telegram.ts   — Telegram digest formatting and sending
  db.ts         — SQLite persistence
  config.ts     — environment config
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

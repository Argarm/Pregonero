# Pregonero

Hay demasiado ruido en internet para seguir el ritmo de la industria tech. Pregonero lo filtra por ti: cada mañana recibe en Telegram un digest con los lanzamientos, herramientas y artículos técnicos que realmente valen la pena — sin tutoriales básicos, sin noticias de negocio, sin ruido.

```
RSS feeds → fetch → deduplicar → filtro LLM → digest en Telegram
```

## Cómo funciona

1. **Fetch** — obtiene items de 11 fuentes RSS/Atom (Hacker News, GitHub Blog, Changelog, Reddit, dev.to, Lobsters, GitHub Trending). Se descartan items con más de 24h de antigüedad.
2. **Deduplicación** — ignora cualquier URL ya procesada, almacenada en una base de datos SQLite local.
3. **Filtro** — envía cada item nuevo a Groq (llama-3.3-70b-versatile), que aprueba o rechaza según un clasificador estricto orientado a ingenieros senior de IA.
4. **Publicación** — todos los items aprobados se agrupan en un único digest de Telegram con 3 bullets cada uno: qué es, por qué importa y un caso de uso concreto. El output es en español.
5. **Almacenamiento** — cada item procesado (aprobado, rechazado o con error) se guarda en SQLite para evitar reprocesamiento.

## Requisitos

- [Bun](https://bun.sh) >= 1.0
- API key de Groq
- Token de bot de Telegram + chat ID

## Instalación

```bash
# Instalar dependencias
bun install

# Configurar entorno
cp .env.example .env
# Editar .env y rellenar GROQ_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

## Uso

```bash
# Iniciar el scheduler (ejecuta inmediatamente y luego sigue CRON_SCHEDULE)
bun start

# Ejecutar el pipeline una vez y salir
bun run-now

# Modo desarrollo (reinicia automáticamente al cambiar archivos)
bun dev

# Verificación de tipos
bun typecheck
```

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `GROQ_API_KEY` | — | API key de Groq |
| `TELEGRAM_BOT_TOKEN` | — | Token del bot de @BotFather |
| `TELEGRAM_CHAT_ID` | — | Chat ID numérico donde se publica el digest |
| `CRON_SCHEDULE` | `0 8 * * *` | Expresión cron (por defecto: 8am diario) |
| `MAX_AI_CALLS_PER_RUN` | `20` | Máximo de llamadas a la IA por ejecución |
| `AI_CALL_DELAY_MS` | `1000` | Pausa entre llamadas consecutivas a la IA (ms) |
| `DB_PATH` | `./data/pregonero.db` | Ruta de la base de datos SQLite |
| `DRY_RUN` | `false` | Omite el envío a Telegram y las escrituras en BD |
| `LOG_LEVEL` | `info` | Nivel de log: `debug`, `info`, `warn`, `error` |

## Feeds

Configurados en `feeds.json` como un array de objetos `{ url, weight }`. A mayor peso, más slots proporcionales en cada ejecución mediante round-robin ponderado.

Fuentes por defecto:

- Hacker News Show HN y top items
- GitHub Blog
- Changelog News
- Reddit: r/programming, r/MachineLearning, r/LocalLLaMA
- dev.to: tags tools & AI
- Lobsters (programming)
- GitHub Trending (diario)

## CI / Ejecución programada

Un workflow de GitHub Actions (`.github/workflows/daily.yml`) ejecuta el pipeline automáticamente a las **7:00 UTC** cada día (8:00 CET). La base de datos SQLite se persiste entre ejecuciones mediante `actions/cache` para mantener el estado de deduplicación.

Secrets necesarios en el repositorio: `GROQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

El workflow también admite lanzamiento manual desde la pestaña **Actions**.

## Estructura del proyecto

```
src/
  index.ts      — punto de entrada, scheduler cron
  runner.ts     — orquestador principal del pipeline
  fetcher.ts    — fetch y parseo de RSS (filtro de 24h)
  ai.ts         — clasificador LLM con Groq
  telegram.ts   — formato y envío del digest a Telegram
  db.ts         — persistencia SQLite
  config.ts     — configuración por variables de entorno
  logger.ts     — logger estructurado
feeds.json      — lista de feeds RSS con pesos
.github/
  workflows/
    daily.yml   — workflow programado en GitHub Actions
```

## Stack tecnológico

- **Runtime**: Bun
- **IA**: Groq (`llama-3.3-70b-versatile`) via groq-sdk
- **Telegram**: grammY
- **Base de datos**: Bun SQLite (built-in)
- **Feeds**: rss-parser
- **Scheduling**: node-cron / GitHub Actions

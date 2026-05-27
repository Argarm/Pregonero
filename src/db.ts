import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from './config';

const SCHEMA = `
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS processed_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    url             TEXT    NOT NULL UNIQUE,
    title           TEXT    NOT NULL,
    source_feed     TEXT    NOT NULL,
    status          TEXT    NOT NULL CHECK(status IN ('approved', 'rejected', 'error')),
    ai_bullets      TEXT,
    telegram_msg_id INTEGER,
    processed_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    error_detail    TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_items_url ON processed_items(url);

  CREATE TABLE IF NOT EXISTS feed_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_url    TEXT    NOT NULL,
    ran_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    items_found INTEGER NOT NULL DEFAULT 0,
    items_new   INTEGER NOT NULL DEFAULT 0,
    success     INTEGER NOT NULL DEFAULT 1
  );
`;

export interface ProcessedItem {
  url: string;
  title: string;
  sourceFeed: string;
  status: 'approved' | 'rejected' | 'error';
  bullets?: string[];
  telegramMsgId?: number;
  errorDetail?: string;
}

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    mkdirSync(dirname(config.dbPath), { recursive: true });
    _db = new Database(config.dbPath, { create: true });
    _db.exec(SCHEMA);
  }
  return _db;
}

export function isUrlProcessed(url: string): boolean {
  return !!getDb().query('SELECT 1 FROM processed_items WHERE url = ?').get(url);
}

export function saveItem(item: ProcessedItem): void {
  getDb()
    .query(
      `INSERT OR IGNORE INTO processed_items
        (url, title, source_feed, status, ai_bullets, telegram_msg_id, error_detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      item.url,
      item.title,
      item.sourceFeed,
      item.status,
      item.bullets ? JSON.stringify(item.bullets) : null,
      item.telegramMsgId ?? null,
      item.errorDetail ?? null
    );
}

export function logFeedRun(feedUrl: string, itemsFound: number, itemsNew: number, success: boolean): void {
  getDb()
    .query('INSERT INTO feed_runs (feed_url, items_found, items_new, success) VALUES (?, ?, ?, ?)')
    .run(feedUrl, itemsFound, itemsNew, success ? 1 : 0);
}

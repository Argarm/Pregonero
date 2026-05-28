import Parser from 'rss-parser';
import { log } from './logger';
import { logFeedRun } from './db';

export interface FeedItem {
  url: string;
  title: string;
  snippet: string;
  sourceFeed: string;
  publishedAt: string;
}

const parser = new Parser({ timeout: 10000 });

export async function fetchFeed(feedUrl: string): Promise<FeedItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    const items: FeedItem[] = [];

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const item of feed.items ?? []) {
      if (!item.link || !item.title) continue;
      if (item.isoDate && new Date(item.isoDate) < cutoff) continue;
      items.push({
        url: item.link.trim(),
        title: item.title.trim(),
        snippet: ((item.contentSnippet ?? item.content ?? '') as string).slice(0, 400).trim(),
        sourceFeed: feedUrl,
        publishedAt: item.isoDate ?? new Date().toISOString(),
      });
    }

    logFeedRun(feedUrl, items.length, 0, true);
    log.debug(`Fetched ${items.length} items from ${feedUrl}`);
    return items;
  } catch (err) {
    log.warn(`Feed failed [${feedUrl}]: ${err}`);
    logFeedRun(feedUrl, 0, 0, false);
    return [];
  }
}

export interface Feed {
  url: string;
  weight: number;
}

export async function fetchAllFeeds(feeds: Feed[]): Promise<FeedItem[]> {
  const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f.url)));
  const all: FeedItem[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      all.push(...result.value);
    }
  }

  return all;
}

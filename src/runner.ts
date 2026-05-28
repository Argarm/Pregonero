import { config } from './config';
import { isUrlProcessed, saveItem } from './db';
import { fetchAllFeeds } from './fetcher';
import type { Feed } from './fetcher';
import { evaluateItem, sleep } from './ai';
import { sendDigest } from './telegram';
import { log } from './logger';
import feedsJson from '../feeds.json';

export async function runPipeline(): Promise<void> {
  log.info('Pipeline run started');

  const feeds = feedsJson as Feed[];
  const allItems = await fetchAllFeeds(feeds);
  log.info(`Fetched ${allItems.length} total items from ${feeds.length} feeds`);

  const newItems = allItems.filter((item) => !isUrlProcessed(item.url));
  log.info(`${newItems.length} new items after deduplication`);

  if (newItems.length === 0) {
    log.info('Nothing new. Pipeline complete.');
    return;
  }

  // Weighted round-robin: feeds with higher weight get proportionally more slots
  const feedWeights = new Map(feeds.map((f) => [f.url, f.weight]));
  const byFeed = new Map<string, typeof newItems>();
  for (const item of newItems) {
    if (!byFeed.has(item.sourceFeed)) byFeed.set(item.sourceFeed, []);
    byFeed.get(item.sourceFeed)!.push(item);
  }

  // Build ticket list: each feed URL repeated by its weight
  const tickets: string[] = [];
  for (const feedUrl of byFeed.keys()) {
    const weight = feedWeights.get(feedUrl) ?? 1;
    for (let w = 0; w < weight; w++) tickets.push(feedUrl);
  }

  const interleaved: typeof newItems = [];
  let ticketIndex = 0;
  while (interleaved.length < newItems.length) {
    const feedUrl = tickets[ticketIndex % tickets.length];
    ticketIndex++;
    const queue = byFeed.get(feedUrl)!;
    if (queue.length) interleaved.push(queue.shift()!);
    if ([...byFeed.values()].every((q) => q.length === 0)) break;
  }

  const toProcess = interleaved.slice(0, config.maxAiCallsPerRun);
  if (newItems.length > config.maxAiCallsPerRun) {
    log.warn(`Capped at ${config.maxAiCallsPerRun} items (${newItems.length - config.maxAiCallsPerRun} deferred to next run)`);
  }

  let approved = 0;
  let rejected = 0;
  let errors = 0;

  const approvedItems: Array<{ item: (typeof toProcess)[0]; bullets: string[] }> = [];

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];

    if (i > 0) await sleep(config.aiCallDelayMs);

    log.debug(`Evaluating [${i + 1}/${toProcess.length}]: "${item.title}"`);

    const result = await evaluateItem(item);

    if (!result) {
      errors++;
      if (!config.dryRun) {
        saveItem({ ...item, sourceFeed: item.sourceFeed, status: 'error', errorDetail: 'AI evaluation failed' });
      }
      continue;
    }

    if (!result.approved) {
      rejected++;
      log.debug(`Rejected: "${item.title}" — ${result.reason}`);
      if (!config.dryRun) {
        saveItem({ ...item, sourceFeed: item.sourceFeed, status: 'rejected' });
      }
      continue;
    }

    approved++;
    log.info(`Approved: "${item.title}"`);
    approvedItems.push({ item, bullets: result.bullets });
  }

  if (approvedItems.length > 0) {
    if (config.dryRun) {
      for (const { item, bullets } of approvedItems) {
        log.info(`[DRY RUN] Would include in digest:\n  ${item.title}\n  ${bullets.join('\n  ')}`);
      }
    } else {
      let telegramMsgId: number | undefined;
      try {
        telegramMsgId = await sendDigest(approvedItems);
        log.info(`Digest sent to Telegram (msg_id=${telegramMsgId}) with ${approvedItems.length} articles`);
      } catch (err) {
        log.error(`Telegram digest send failed: ${err}`);
      }

      for (const { item, bullets } of approvedItems) {
        saveItem({
          url: item.url,
          title: item.title,
          sourceFeed: item.sourceFeed,
          status: 'approved',
          bullets,
          telegramMsgId,
        });
      }
    }
  }

  log.info(
    `Pipeline complete — processed: ${toProcess.length}, approved: ${approved}, rejected: ${rejected}, errors: ${errors}`
  );
}

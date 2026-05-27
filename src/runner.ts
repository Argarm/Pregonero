import { config } from './config';
import { isUrlProcessed, saveItem } from './db';
import { fetchAllFeeds } from './fetcher';
import { evaluateItem, sleep } from './ai';
import { sendArticle } from './telegram';
import { log } from './logger';
import feedsJson from '../feeds.json';

export async function runPipeline(): Promise<void> {
  log.info('Pipeline run started');

  const feeds: string[] = feedsJson;
  const allItems = await fetchAllFeeds(feeds);
  log.info(`Fetched ${allItems.length} total items from ${feeds.length} feeds`);

  const newItems = allItems.filter((item) => !isUrlProcessed(item.url));
  log.info(`${newItems.length} new items after deduplication`);

  if (newItems.length === 0) {
    log.info('Nothing new. Pipeline complete.');
    return;
  }

  const toProcess = newItems.slice(0, config.maxAiCallsPerRun);
  if (newItems.length > config.maxAiCallsPerRun) {
    log.warn(`Capped at ${config.maxAiCallsPerRun} items (${newItems.length - config.maxAiCallsPerRun} deferred to next run)`);
  }

  let approved = 0;
  let rejected = 0;
  let errors = 0;

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

    if (config.dryRun) {
      log.info(`[DRY RUN] Would send:\n  ${item.title}\n  ${result.bullets.join('\n  ')}`);
      continue;
    }

    let telegramMsgId: number | undefined;
    try {
      telegramMsgId = await sendArticle(item, result.bullets);
      log.debug(`Sent to Telegram (msg_id=${telegramMsgId}): "${item.title}"`);
    } catch (err) {
      log.error(`Telegram send failed for "${item.title}": ${err}`);
    }

    saveItem({
      url: item.url,
      title: item.title,
      sourceFeed: item.sourceFeed,
      status: 'approved',
      bullets: result.bullets,
      telegramMsgId,
    });
  }

  log.info(
    `Pipeline complete — processed: ${toProcess.length}, approved: ${approved}, rejected: ${rejected}, errors: ${errors}`
  );
}

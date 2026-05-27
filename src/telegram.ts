import { Bot } from 'grammy';
import { config } from './config';
import { log } from './logger';
import type { FeedItem } from './fetcher';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatMessage(item: FeedItem, bullets: string[]): string {
  const escapedTitle = escapeHtml(item.title);
  const escapedBullets = bullets.map((b) => `• ${escapeHtml(b)}`).join('\n');
  const escapedUrl = item.url;

  return [
    `<b>🔧 ${escapedTitle}</b>`,
    '',
    escapedBullets,
    '',
    `<a href="${escapedUrl}">Leer más →</a>`,
  ].join('\n');
}

let _bot: Bot | null = null;

export function getBot(): Bot {
  if (!_bot) _bot = new Bot(config.telegram.token);
  return _bot;
}

export async function sendArticle(item: FeedItem, bullets: string[]): Promise<number> {
  const text = formatMessage(item, bullets);
  const delays = [5000, 15000, 45000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const msg = await getBot().api.sendMessage(config.telegram.chatId, text, {
        parse_mode: 'HTML',
        // @ts-ignore — link_preview_options available in Bot API 7.0+
        link_preview_options: { is_disabled: false },
      });
      return msg.message_id;
    } catch (err) {
      if (attempt < delays.length) {
        log.warn(`Telegram send failed (attempt ${attempt + 1}), retrying in ${delays[attempt] / 1000}s: ${err}`);
        await new Promise((r) => setTimeout(r, delays[attempt]));
      } else {
        throw err;
      }
    }
  }

  throw new Error('Unreachable');
}

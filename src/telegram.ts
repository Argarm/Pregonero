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

let _bot: Bot | null = null;

export function getBot(): Bot {
  if (!_bot) _bot = new Bot(config.telegram.token);
  return _bot;
}

async function sendText(text: string): Promise<number> {
  const delays = [5000, 15000, 45000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const msg = await getBot().api.sendMessage(config.telegram.chatId, text, {
        parse_mode: 'HTML',
        // @ts-ignore — link_preview_options available in Bot API 7.0+
        link_preview_options: { is_disabled: true },
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

const MAX_MSG_LEN = 4000;

export async function sendDigest(entries: Array<{ item: FeedItem; bullets: string[] }>): Promise<number> {
  const date = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const header = `🗞 <b>Dev News — ${date}</b>`;

  const blocks = entries.map(({ item, bullets }) => {
    const title = escapeHtml(item.title);
    const bulletLines = bullets.map((b) => `• ${escapeHtml(b)}`).join('\n');
    return `🔧 <b>${title}</b>\n${bulletLines}\n<a href="${item.url}">Leer más →</a>`;
  });

  // Split into chunks that respect Telegram's 4096-char limit
  const chunks: string[] = [];
  let current = header;

  for (const block of blocks) {
    const candidate = `${current}\n\n${block}`;
    if (candidate.length > MAX_MSG_LEN && current !== header) {
      chunks.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  chunks.push(current);

  let firstMsgId: number | undefined;
  for (const chunk of chunks) {
    const msgId = await sendText(chunk);
    if (firstMsgId === undefined) firstMsgId = msgId;
  }

  return firstMsgId!;
}

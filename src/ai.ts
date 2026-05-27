import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import { log } from './logger';
import type { FeedItem } from './fetcher';

export interface AiResult {
  approved: boolean;
  reason: string;
  bullets: string[];
}

const SYSTEM_PROMPT = `You are a strict content relevance classifier for a software developer news feed.

Your job: evaluate whether a news item is about a NEW and CONCRETE developer tool, library, framework, runtime, SDK, API, or AI model that developers can USE TODAY or in the near future.

APPROVED criteria (item MUST match at least one):
- Announcement of a new open-source library, framework, or runtime
- Release of a new version with significant developer-facing features
- Launch of a new AI model, AI coding tool, or AI-powered developer product
- New developer API or SDK from a major platform
- New CLI tool, build tool, or infrastructure tool relevant to software engineering

REJECTED criteria (item MUST be rejected if it matches any):
- Opinion pieces, editorials, or "hot takes"
- General tech news not directly actionable for a developer (layoffs, funding rounds, market share)
- Tutorials or how-to articles for already well-known tools
- Security vulnerability disclosures without a clear developer action item
- Consumer apps, social media, hardware unrelated to dev
- Conference schedules, job postings, or industry surveys

RESPONSE FORMAT:
You must respond with valid JSON only. No prose before or after. No markdown code fences.
Schema:
{
  "approved": boolean,
  "reason": string,
  "bullets": string[]
}

If approved=true, bullets must be exactly 3 strings:
- What the tool IS (one sentence, max 20 words)
- The key developer benefit (one sentence, max 20 words)
- One concrete capability or use case (one sentence, max 20 words)

If approved=false, bullets must be an empty array [].`;

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

async function callAi(item: FeedItem): Promise<AiResult> {
  const userContent = JSON.stringify({
    title: item.title,
    snippet: item.snippet,
    url: item.url,
  });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = (response.content[0] as { text: string }).text.trim();
  const parsed = JSON.parse(text) as AiResult;

  if (typeof parsed.approved !== 'boolean' || !Array.isArray(parsed.bullets)) {
    throw new Error(`Unexpected AI response shape: ${text.slice(0, 100)}`);
  }

  return parsed;
}

export async function evaluateItem(item: FeedItem): Promise<AiResult | null> {
  try {
    return await callAi(item);
  } catch (firstErr) {
    if (firstErr instanceof SyntaxError) {
      log.warn(`AI returned non-JSON for "${item.title}" — treating as rejected`);
      return { approved: false, reason: 'Non-JSON AI response', bullets: [] };
    }

    log.warn(`AI call failed for "${item.title}", retrying in 2s: ${firstErr}`);
    await sleep(2000);

    try {
      return await callAi(item);
    } catch (secondErr) {
      log.error(`AI call failed twice for "${item.title}": ${secondErr}`);
      return null;
    }
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

import Groq from 'groq-sdk';
import { config } from './config';
import { log } from './logger';
import type { FeedItem } from './fetcher';

export interface AiResult {
  approved: boolean;
  reason: string;
  bullets: string[];
}

const SYSTEM_PROMPT = `You are a strict content relevance classifier for a senior software developer specialized in AI.

TARGET READER: A senior software engineer whose work is heavily focused on AI/ML systems. They want to stay sharp technically and grow professionally.

APPROVED criteria (item MUST match at least one):
- New AI/ML model, framework, library, or tool that a senior dev can use in production or experimentation
- Significant release of an AI coding assistant, LLM API, or AI-powered developer tool
- Deep technical content on AI system design, architecture, or engineering best practices (not beginner tutorials)
- Soft skills content valuable for senior engineers: technical leadership, engineering communication, decision-making, managing complexity, career growth, mentorship
- New developer tooling, SDK, or infrastructure that meaningfully improves productivity or system quality

REJECTED criteria (item MUST be rejected if it matches any):
- Beginner or introductory tutorials for well-known tools
- Business news without technical substance (funding rounds, acquisitions, layoffs, market share)
- Consumer tech, hardware, or social media unrelated to software development
- Opinion pieces or hot takes with no actionable insight
- Conference schedules, job postings, or industry surveys
- Security vulnerability disclosures without a clear developer action item
- Generic productivity content not specific to software engineering

RESPONSE FORMAT:
You must respond with valid JSON only. No prose before or after. No markdown code fences.
Schema:
{
  "approved": boolean,
  "reason": string,
  "bullets": string[]
}

If approved=true, bullets must be exactly 3 strings:
- What it IS or what it covers (one sentence, max 20 words)
- Why it matters for a senior AI-focused developer (one sentence, max 20 words)
- One concrete takeaway or use case (one sentence, max 20 words)

If approved=false, bullets must be an empty array [].

LANGUAGE: Always write the "reason" field and all "bullets" in Spanish, regardless of the source article's language.`;

const client = new Groq({ apiKey: config.groq.apiKey });

async function callAi(item: FeedItem): Promise<AiResult> {
  const userContent = JSON.stringify({
    title: item.title,
    snippet: item.snippet,
    url: item.url,
  });

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 300,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  });

  const text = response.choices[0].message.content?.trim() ?? '';
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

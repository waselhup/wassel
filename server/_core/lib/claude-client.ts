// Centralized Claude API client — handles model routing + retry on 429/503.
// Uses fetch (not the SDK) to match the existing codebase style.

export const MODELS = {
  fast: 'claude-haiku-4-5-20251001',   // bulk generation, cheap
  balanced: 'claude-sonnet-4-6',       // default quality tier
  deep: 'claude-opus-4-7',             // reserve for highest-complexity tasks
};

export type ClaudeTask =
  | 'profile_analysis'
  | 'cv_generate'
  | 'post_generate'
  | 'campaign_message'
  | 'cv_parse';

const TASK_MODEL: Record<ClaudeTask, string> = {
  profile_analysis: MODELS.balanced, // Sonnet — deep analysis with citations
  cv_generate: MODELS.balanced,      // Sonnet — quality matters
  post_generate: MODELS.fast,        // Haiku — short form, fast
  campaign_message: MODELS.fast,     // Haiku — bulk per-company
  cv_parse: MODELS.fast,             // Haiku — structured extraction
};

export function pickModel(task: ClaudeTask): string {
  return TASK_MODEL[task] ?? MODELS.balanced;
}

interface ClaudeCallParams {
  task: ClaudeTask;
  system: string;
  userContent: string | Array<{ type: string; [k: string]: any }>;
  maxTokens?: number;
  temperature?: number;
  modelOverride?: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
  stop_reason?: string;
  model?: string;
}

/**
 * Call Claude with automatic model routing and exponential backoff on
 * 429 rate-limit and 503/529 overload responses.
 * Throws on final failure with status attached.
 */
export async function callClaude(params: ClaudeCallParams): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error('ANTHROPIC_API_KEY not configured'), { status: 500 });
  }

  const model = params.modelOverride || pickModel(params.task);
  const maxRetries = 4;
  const body = {
    model,
    max_tokens: params.maxTokens ?? 4000,
    temperature: params.temperature ?? 0.7,
    system: params.system,
    messages: [
      {
        role: 'user',
        content: params.userContent,
      },
    ],
  };

  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return (await res.json()) as ClaudeResponse;
      }

      const status = res.status;
      const retriable = status === 429 || status === 503 || status === 529;
      const errText = await res.text();
      lastErr = Object.assign(new Error(`Claude ${status}: ${errText.slice(0, 300)}`), {
        status,
        body: errText,
      });

      if (!retriable || attempt === maxRetries) {
        throw lastErr;
      }

      // Backoff: honor Retry-After header if present, else exponential
      const retryAfterSec = parseInt(res.headers.get('retry-after') || '0', 10);
      const delayMs = retryAfterSec > 0
        ? retryAfterSec * 1000
        : Math.min(2 ** attempt * 1000, 30000);
      console.log(
        `[claude-client] ${params.task} got ${status}, retry ${attempt}/${maxRetries} in ${delayMs}ms`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    } catch (err: any) {
      // Network-level error — retry a couple of times
      if (err?.status) throw err;
      lastErr = err;
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  throw lastErr ?? new Error('Claude API failed after retries');
}

/** Extract the text content from a Claude response (handles text + tool_use mixed). */
export function extractText(res: ClaudeResponse): string {
  if (!res?.content) return '';
  return res.content
    .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
    .map((c: any) => c.text as string)
    .join('');
}

/** Robust JSON extraction from Claude text output. */
export function extractJson<T = any>(text: string): T | null {
  if (!text) return null;

  // 1. direct parse
  try {
    return JSON.parse(text.trim()) as T;
  } catch {}

  // 2. strip markdown code fences
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {}

  // 3. balanced-brace scan — first complete JSON object
  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.substring(start, i + 1)) as T;
          } catch {}
          break;
        }
      }
    }
  }

  // 4. greedy fallback
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]) as T;
    } catch {}
  }

  return null;
}

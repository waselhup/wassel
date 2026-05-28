import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Error Formatter — Sprint 8.
 *
 * Translates raw runtime exceptions (Anthropic SDK errors, Supabase RPC
 * failures, network drops, validation errors) into bilingual, user-friendly
 * `{ messageKey, params, recovery }` payloads the frontend can render via
 * i18n. Wired into the tRPC errorFormatter middleware so every error returned
 * to the client carries a `messageKey` instead of a raw exception string.
 *
 * Each formatted error answers Wassel's R06 "3 questions":
 *   1. ماذا حدث؟          (from messageKey)
 *   2. هل خسرت شيئاً؟      (refundedTokens > 0 means we refunded)
 *   3. ماذا أفعل الآن؟     (recovery field: auto_refund / silent_retry /
 *                          user_action_required / escalated)
 */

export const ERROR_CODE_MAP = {
  // Auth
  AUTH_REQUIRED:           { key: 'errors.auth.required',             category: 'auth',       refundable: false },
  AUTH_EXPIRED:            { key: 'errors.auth.expired',              category: 'auth',       refundable: false },

  // Tokens
  INSUFFICIENT_TOKENS:     { key: 'errors.tokens.insufficient',       category: 'tokens',     refundable: false },
  TOKEN_REFUND_FAILED:     { key: 'errors.tokens.refund_failed',      category: 'tokens',     refundable: false },

  // AI Service (Anthropic)
  ANTHROPIC_RATE_LIMIT:    { key: 'errors.ai.rate_limit',             category: 'ai_service', refundable: true  },
  ANTHROPIC_OVERLOADED:    { key: 'errors.ai.overloaded',             category: 'ai_service', refundable: true  },
  ANTHROPIC_TIMEOUT:       { key: 'errors.ai.timeout',                category: 'ai_service', refundable: true  },
  AI_GENERATION_FAILED:    { key: 'errors.ai.generation_failed',      category: 'ai_service', refundable: true  },

  // LinkedIn (discovery — never say "scraping" or vendor names in UI)
  LINKEDIN_PROFILE_NOT_FOUND: { key: 'errors.linkedin.not_found',     category: 'linkedin',   refundable: true  },
  LINKEDIN_PROFILE_PRIVATE:   { key: 'errors.linkedin.private',       category: 'linkedin',   refundable: true  },
  LINKEDIN_URL_INVALID:       { key: 'errors.linkedin.invalid_url',   category: 'linkedin',   refundable: false },
  LINKEDIN_SCRAPE_FAILED:     { key: 'errors.linkedin.scrape_failed', category: 'linkedin',   refundable: true  },

  // Payment
  PAYMENT_FAILED:          { key: 'errors.payment.failed',            category: 'payment',    refundable: false },
  PAYMENT_CANCELLED:       { key: 'errors.payment.cancelled',         category: 'payment',    refundable: false },

  // Database
  DATABASE_ERROR:          { key: 'errors.database.generic',          category: 'database',   refundable: true  },
  RESOURCE_NOT_FOUND:      { key: 'errors.database.not_found',        category: 'database',   refundable: false },

  // Network / Generic
  NETWORK_ERROR:           { key: 'errors.network.generic',           category: 'network',    refundable: true  },
  VALIDATION_ERROR:        { key: 'errors.validation.generic',        category: 'validation', refundable: false },
  GENERIC_ERROR:           { key: 'errors.generic.unknown',           category: 'unknown',    refundable: true  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODE_MAP;

export type RecoveryAction =
  | 'auto_refund'
  | 'silent_retry'
  | 'user_action_required'
  | 'escalated';

export interface FormattedError {
  code: ErrorCode;
  messageKey: string;
  params: Record<string, unknown>;
  category: string;
  refundable: boolean;
  refundedTokens?: number;
  recovery: RecoveryAction;
}

/**
 * Auto-detect the canonical error code from a raw exception.
 * Returns `'GENERIC_ERROR'` for anything we can't pattern-match.
 *
 * Order matters here — more-specific patterns first.
 */
export function detectErrorCode(error: unknown): ErrorCode {
  if (!error) return 'GENERIC_ERROR';

  // Allow callers to pre-tag with a known code by attaching it to the
  // error object (e.g. throw Object.assign(new Error(...), { code: 'INSUFFICIENT_TOKENS' })).
  const tagged = (error as { code?: unknown }).code;
  if (typeof tagged === 'string' && tagged in ERROR_CODE_MAP) {
    return tagged as ErrorCode;
  }

  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // Anthropic — order matters: timeout before 429 because aborted timeouts
  // can occasionally land on a 429-styled response from Claude's gateway.
  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('econnaborted')) {
    return 'ANTHROPIC_TIMEOUT';
  }
  if (lower.includes('529') || lower.includes('overloaded')) {
    return 'ANTHROPIC_OVERLOADED';
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('rate_limit')) {
    return 'ANTHROPIC_RATE_LIMIT';
  }
  if (lower.includes('anthropic') || lower.includes('claude') || lower.includes('model_error')) {
    return 'AI_GENERATION_FAILED';
  }

  // LinkedIn — match before generic 404
  if (lower.includes('profile not found') || lower.includes('linkedin') && lower.includes('not found')) {
    return 'LINKEDIN_PROFILE_NOT_FOUND';
  }
  if (lower.includes('private profile') || (lower.includes('linkedin') && lower.includes('private'))) {
    return 'LINKEDIN_PROFILE_PRIVATE';
  }
  if (lower.includes('invalid linkedin') || lower.includes('url_mismatch') || lower.includes('linkedin_url_invalid')) {
    return 'LINKEDIN_URL_INVALID';
  }
  if (lower.includes('scrape') || lower.includes('discovery_failed')) {
    return 'LINKEDIN_SCRAPE_FAILED';
  }

  // Tokens
  if (lower.includes('insufficient_tokens') || lower.includes('insufficient tokens') || lower.includes('not enough tokens')) {
    return 'INSUFFICIENT_TOKENS';
  }
  if (lower.includes('refund') && lower.includes('failed')) {
    return 'TOKEN_REFUND_FAILED';
  }

  // Auth
  if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('auth_required')) {
    return 'AUTH_REQUIRED';
  }
  if (lower.includes('expired') && (lower.includes('session') || lower.includes('token'))) {
    return 'AUTH_EXPIRED';
  }

  // Payment
  if (lower.includes('payment') && lower.includes('cancel')) {
    return 'PAYMENT_CANCELLED';
  }
  if (lower.includes('payment') && (lower.includes('failed') || lower.includes('declined'))) {
    return 'PAYMENT_FAILED';
  }

  // Validation
  if (lower.includes('zod') || lower.includes('validation') || lower.includes('invalid input')) {
    return 'VALIDATION_ERROR';
  }

  // Database / Resource
  if (lower.includes('postgres') || lower.includes('pgrst') || lower.includes('relation') && lower.includes('does not exist')) {
    return 'DATABASE_ERROR';
  }
  if (lower.includes('not found') || lower.includes('404') || lower.includes('no rows')) {
    return 'RESOURCE_NOT_FOUND';
  }

  // Network
  if (lower.includes('fetch failed') || lower.includes('econnreset') || lower.includes('enotfound') || lower.includes('network')) {
    return 'NETWORK_ERROR';
  }

  return 'GENERIC_ERROR';
}

/**
 * Main formatter. Used by the tRPC errorFormatter middleware to wrap every
 * server-thrown error before it leaves the server.
 *
 * `refundedTokens` is the number of tokens the caller refunded *before*
 * throwing — pass it through so the client can show "تم استرداد X توكن".
 */
export function formatError(
  error: unknown,
  operation: string,
  language: 'ar' | 'en' = 'ar',
  refundedTokens?: number
): FormattedError {
  const code = detectErrorCode(error);
  const mapping = ERROR_CODE_MAP[code];

  const recovery: RecoveryAction =
    refundedTokens && refundedTokens > 0 ? 'auto_refund' :
    code === 'INSUFFICIENT_TOKENS'        ? 'user_action_required' :
    code === 'TOKEN_REFUND_FAILED'        ? 'escalated' :
    code === 'AUTH_REQUIRED' || code === 'AUTH_EXPIRED' ? 'user_action_required' :
    code === 'LINKEDIN_URL_INVALID' || code === 'VALIDATION_ERROR' ? 'user_action_required' :
    mapping.refundable                    ? 'silent_retry' :
                                            'user_action_required';

  return {
    code,
    messageKey: mapping.key,
    params: {
      operation,
      refundedTokens: refundedTokens ?? 0,
      language,
    },
    category: mapping.category,
    refundable: mapping.refundable,
    refundedTokens,
    recovery,
  };
}

/**
 * Best-effort fire-and-forget logger for error_events. Never throws —
 * the calling errorFormatter must not blow up because logging failed.
 *
 * Lives in the same module so callers don't have to import two things.
 */
export async function logErrorEvent(
  supabase: SupabaseClient,
  params: {
    userId?: string;
    errorCode: string;
    errorCategory: string;
    operation: string;
    rawMessage: string;
    formattedKey: string;
    formattedParams?: Record<string, unknown>;
    refundedTokens?: number;
    resolution: string;
    userAgent?: string;
    requestId?: string;
  }
): Promise<void> {
  try {
    await supabase.from('error_events').insert({
      user_id: params.userId ?? null,
      error_code: params.errorCode,
      error_category: params.errorCategory,
      operation: params.operation,
      raw_message: (params.rawMessage || '').slice(0, 2000),
      formatted_key: params.formattedKey,
      formatted_params: params.formattedParams ?? {},
      refunded_tokens: params.refundedTokens ?? 0,
      resolution: params.resolution,
      user_agent: params.userAgent ?? null,
      request_id: params.requestId ?? null,
    });
  } catch (e) {
    // Swallow — error logging must never break the user's flow.
    console.warn('[error-formatter] logErrorEvent failed:', (e as Error).message);
  }
}

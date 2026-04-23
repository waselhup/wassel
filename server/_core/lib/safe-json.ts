/**
 * Robust JSON parser that tolerates common LLM output artifacts:
 *   - markdown code fences (```json ... ```)
 *   - leading BOM (U+FEFF)
 *   - trailing commas (via substring extraction)
 *   - prose leaking in before/after the JSON object
 *
 * Returns `null` if nothing parseable is found — never throws.
 */
export function safeJsonParse<T = unknown>(raw: unknown): T | null {
  if (typeof raw !== 'string') return null;
  let s = raw;

  // Strip BOM
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  s = s.trim();
  if (!s) return null;

  // Fast path — raw parse
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through */
  }

  // Strip a markdown code fence wrapper
  let stripped = s
    .replace(/^```(?:json|JSON)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    /* fall through */
  }

  // Extract the first complete JSON object/array via balanced-brace scan.
  // Handles strings (with escaped quotes) correctly.
  const tryExtract = (open: string, close: string): string | null => {
    const start = stripped.indexOf(open);
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < stripped.length; i++) {
      const ch = stripped[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return stripped.slice(start, i + 1);
      }
    }
    return null;
  };

  const objectSlice = tryExtract('{', '}');
  if (objectSlice) {
    try {
      return JSON.parse(objectSlice) as T;
    } catch {
      /* fall through */
    }
  }

  const arraySlice = tryExtract('[', ']');
  if (arraySlice) {
    try {
      return JSON.parse(arraySlice) as T;
    } catch {
      /* fall through */
    }
  }

  return null;
}

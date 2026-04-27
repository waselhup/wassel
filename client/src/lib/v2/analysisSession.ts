/**
 * Tiny sessionStorage bridge for the 3-stage analysis flow.
 *
 * The `linkedin.analyzeTargeted` mutation is synchronous — there is no real
 * server-side job ID until the row lands in `profile_analyses`. So we mint a
 * temporary client-side id when Stage 1 (input) navigates to Stage 2
 * (loading), then upgrade it to the real DB id once the mutation resolves.
 *
 * sessionStorage (not localStorage) keeps the bridge tab-scoped and
 * automatically cleans up when the tab closes — there's no privacy concern
 * about CV/profile data lingering on shared machines.
 */

const PARAMS_KEY_PREFIX = 'wassel.analysis.params.';
const RESULT_KEY_PREFIX = 'wassel.analysis.result.';

export type TargetGoal =
  | 'job-search'
  | 'investment'
  | 'thought-leadership'
  | 'sales-b2b'
  | 'career-change'
  | 'internal-promotion';

export type Industry =
  | 'oil-gas' | 'tech' | 'finance' | 'healthcare' | 'legal' | 'consulting'
  | 'government' | 'academic' | 'entrepreneurship' | 'real-estate' | 'other';

export type ReportLang = 'ar' | 'en';

export interface AnalysisParams {
  linkedinUrl: string;
  targetGoal: TargetGoal;
  industry: Industry;
  customIndustryLabel?: string;
  targetRole?: string;
  targetCompany?: string;
  reportLanguage: ReportLang;
}

export interface StoredAnalysisResult {
  id: string;
  analysis: any;
  profileSummary?: any;
  linkedinUrl?: string;
  tokensUsed?: number;
  storedAt: number;
}

export function newTempAnalysisId(): string {
  return `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function setAnalysisParams(id: string, params: AnalysisParams): void {
  try {
    sessionStorage.setItem(PARAMS_KEY_PREFIX + id, JSON.stringify(params));
  } catch {
    /* quota/disabled — Stage 2 will detect and bounce back to Stage 1 */
  }
}

export function getAnalysisParams(id: string): AnalysisParams | null {
  try {
    const raw = sessionStorage.getItem(PARAMS_KEY_PREFIX + id);
    return raw ? JSON.parse(raw) as AnalysisParams : null;
  } catch {
    return null;
  }
}

export function clearAnalysisParams(id: string): void {
  try {
    sessionStorage.removeItem(PARAMS_KEY_PREFIX + id);
  } catch { /* swallow */ }
}

export function setAnalysisResult(id: string, result: Omit<StoredAnalysisResult, 'storedAt'>): void {
  try {
    const payload: StoredAnalysisResult = { ...result, storedAt: Date.now() };
    sessionStorage.setItem(RESULT_KEY_PREFIX + id, JSON.stringify(payload));
  } catch { /* swallow — Stage 3 will fall back to listAnalyses */ }
}

export function getAnalysisResult(id: string): StoredAnalysisResult | null {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY_PREFIX + id);
    return raw ? JSON.parse(raw) as StoredAnalysisResult : null;
  } catch {
    return null;
  }
}

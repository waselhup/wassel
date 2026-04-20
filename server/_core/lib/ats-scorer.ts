import { callClaude, extractText, extractJson } from './claude-client';

export interface ATSScore {
  overall: number;
  verdict: string;
  breakdown: {
    keywordMatch: {
      score: number;
      matched: string[];
      missing: string[];
      total: number;
    };
    formatSafety: {
      score: number;
      issues: string[];
    };
    length: {
      score: number;
      pages: number;
      verdict: string;
    };
    structure: {
      score: number;
      hasRequiredSections: boolean;
    };
  };
  improvements: string[];
}

const ATS_SCORER_SYSTEM = `You are an elite ATS (Applicant Tracking System) expert.

Analyze a CV against a job description and return a detailed ATS compatibility score.

SCORING RUBRIC:

1. KEYWORD MATCH (50 points):
   - Extract 10-15 most important keywords from JD (skills, tools, certifications, industry terms).
   - Count how many appear in the CV (exact or close variants).
   - Score = round((matched / total) * 50).
   - List the missing keywords — these are the user's gaps.

2. FORMAT SAFETY (20 points):
   - Full 20 if: plain linear structure, standard sections, no tables in main content, no images.
   - Deduct 5 for each issue noted (max deduction = 20).
   - Wassel-generated CVs are typically format-safe — default 20 unless clear issue.

3. LENGTH (15 points):
   - Estimate pages from character count (~3000 chars/page average).
   - 1-2 pages: 15 points, verdict "optimal"
   - 2-2.5 pages: 10 points, verdict "acceptable"
   - 2.5-3 pages: 5 points, verdict "long"
   - >3 pages or <0.5: 0 points, verdict "out-of-range"

4. STRUCTURE (15 points):
   - Has Summary + Experience + Education + Skills: 15, hasRequiredSections=true
   - Missing 1 section: 10, hasRequiredSections=true
   - Missing 2 sections: 5, hasRequiredSections=false
   - Missing 3+: 0, hasRequiredSections=false

VERDICT LABELS:
- If language=ar: 85-100 "ممتاز", 70-84 "جيد", 50-69 "متوسط", 0-49 "ضعيف"
- If language=en: 85-100 "Excellent", 70-84 "Good", 50-69 "Average", 0-49 "Weak"

IMPROVEMENTS (5-7 specific, actionable tips):
- Prioritize: missing keywords first, then format, then length, then structure.
- Each tip must be concrete and doable.
- Language matches the 'language' parameter.
- Example AR: "أضف 'Kubernetes' في قسم المهارات"
- Example EN: "Add 'Kubernetes' to Skills section"

OUTPUT: Valid JSON only, no markdown fences, no commentary.
Return overall = keywordMatch.score + formatSafety.score + length.score + structure.score.`;

export async function calculateATSScore(
  cvContent: any,
  jobDescription: string,
  language: 'ar' | 'en' = 'en'
): Promise<ATSScore> {
  const userPrompt = JSON.stringify({
    cv: cvContent,
    jobDescription,
    language,
  });

  const res = await callClaude({
    task: 'cv_generate',
    system: ATS_SCORER_SYSTEM,
    userContent: userPrompt,
    maxTokens: 2000,
  });

  const text = extractText(res);
  const parsed = extractJson<any>(text);
  if (!parsed) {
    throw new Error('ATS scorer did not return valid JSON');
  }

  return normalizeATSScore(parsed);
}

function normalizeATSScore(raw: any): ATSScore {
  const num = (v: any, dflt = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);
  const str = (v: any) => (typeof v === 'string' ? v : '');
  const arr = (v: any) => (Array.isArray(v) ? v : []);

  const km = raw.breakdown?.keywordMatch || {};
  const fs = raw.breakdown?.formatSafety || {};
  const len = raw.breakdown?.length || {};
  const st = raw.breakdown?.structure || {};

  const kmScore = Math.min(50, Math.max(0, num(km.score)));
  const fsScore = Math.min(20, Math.max(0, num(fs.score, 20)));
  const lenScore = Math.min(15, Math.max(0, num(len.score)));
  const stScore = Math.min(15, Math.max(0, num(st.score)));

  const overall = num(raw.overall, kmScore + fsScore + lenScore + stScore);

  return {
    overall: Math.round(Math.min(100, Math.max(0, overall))),
    verdict: str(raw.verdict) || 'Good',
    breakdown: {
      keywordMatch: {
        score: Math.round(kmScore),
        matched: arr(km.matched).filter((k: any) => typeof k === 'string'),
        missing: arr(km.missing).filter((k: any) => typeof k === 'string'),
        total: num(km.total, arr(km.matched).length + arr(km.missing).length),
      },
      formatSafety: {
        score: Math.round(fsScore),
        issues: arr(fs.issues).filter((i: any) => typeof i === 'string'),
      },
      length: {
        score: Math.round(lenScore),
        pages: num(len.pages, 1),
        verdict: str(len.verdict) || 'optimal',
      },
      structure: {
        score: Math.round(stScore),
        hasRequiredSections: Boolean(st.hasRequiredSections),
      },
    },
    improvements: arr(raw.improvements).filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 7),
  };
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Linkedin, Sparkles, CheckCircle2, AlertCircle, Loader2,
  TrendingUp, Copy, History, Target, Zap,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

type AnalysisResult = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  headline: { before: string; after: string };
  summary: { before: string; after: string };
};

export default function LinkedInAnalyzer() {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function analyze() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let clean = url.trim();
      if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;
      const data: any = await trpc.linkedin.analyze(clean);
      setResult({
        score: typeof data.score === "number" ? data.score : 0,
        strengths: Array.isArray(data.strengthPoints) ? data.strengthPoints : [],
        weaknesses: Array.isArray(data.improvementAreas) ? data.improvementAreas : [],
        headline: {
          before: data.headlineCurrent || "—",
          after: data.headlineSuggestion || "—",
        },
        summary: {
          before: data.summaryCurrent || "—",
          after: data.summarySuggestion || "—",
        },
      });
    } catch (e: any) {
      setError(e?.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-8 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0077b5] to-[#00a0dc] flex items-center justify-center shadow-md">
              <Linkedin className="w-5 h-5 text-white" />
            </div>
            {t("ln.title", "تحليل ملف LinkedIn")}
          </h1>
          <p className="text-gray-500 mt-2">{t("ln.subtitle", "ألصق رابط ملفك الشخصي واحصل على تقييم شامل مع اقتراحات تحسين فورية")}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
        >
          <label className="block text-sm font-semibold text-[#1a1a2e] mb-2">
            {t("ln.urlLabel", "رابط LinkedIn")}
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://linkedin.com/in/your-profile"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#ff6b35] focus:outline-none focus:ring-2 focus:ring-[#ff6b35]/20 transition"
            />
            <button onClick={analyze} disabled={loading || !url.trim()}
              className="px-6 py-3 rounded-xl bg-[#ff6b35] text-white font-semibold hover:bg-[#e55a2b] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#ff6b35]/30 hover:shadow-xl transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? t("ln.analyzing", "جاري التحليل...") : t("ln.analyze", "حلّل الآن")}
            </button>
          </div>
        </motion.div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-4 text-sm">
            {error}
          </div>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 md:p-8 grid md:grid-cols-[220px_1fr] gap-8 items-center">
                <ScoreGauge score={result.score} />
                <div>
                  <div className="text-sm text-gray-500 mb-1">{t("ln.overall", "التقييم الإجمالي")}</div>
                  <h2 className="text-2xl font-bold text-[#1a1a2e] mb-3">
                    {result.score >= 80 ? t("ln.excellent", "ممتاز! ملفك قوي") : t("ln.good", "جيد — يمكن التحسين")}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                      <TrendingUp className="w-3 h-3" /> +15 {t("ln.vsLast", "مقارنة بالسابق")}
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                      <Target className="w-3 h-3" /> {t("ln.topPct", "أفضل 20%")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <InsightCard color="emerald" icon={CheckCircle2} title={t("ln.strengths", "نقاط القوة")} items={result.strengths} />
                <InsightCard color="amber" icon={AlertCircle} title={t("ln.weaknesses", "نقاط التحسين")} items={result.weaknesses} />
              </div>

              <BeforeAfter label={t("ln.headline", "العنوان الرئيسي")} before={result.headline.before} after={result.headline.after} />
              <BeforeAfter label={t("ln.summary", "الملخّص")} before={result.summary.before} after={result.summary.after} />

              <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2c5282] text-white p-6 md:p-8 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-5 h-5" />
                  <h3 className="font-bold">{t("ln.historyTitle", "سجل التحليلات السابقة")}</h3>
                </div>
                <p className="text-white/70 text-sm mb-4">{t("ln.historyDesc", "تابع تطور ملفك عبر الزمن")}</p>
                <div className="grid grid-cols-3 gap-3">
                  {[72, 78, 87].map((s, i) => (
                    <div key={i} className="rounded-xl bg-white/10 backdrop-blur p-4 border border-white/10">
                      <div className="text-2xl font-bold">{s}</div>
                      <div className="text-xs text-white/60 mt-1">
                        {i === 0 ? t("ln.weeksAgo", "منذ 3 أسابيع") : i === 1 ? t("ln.weekAgo", "منذ أسبوع") : t("ln.today", "اليوم")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const r = 85, c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative w-52 h-52 mx-auto">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        <circle cx="100" cy="100" r={r} stroke="#f3f4f6" strokeWidth="16" fill="none" />
        <motion.circle
          cx="100" cy="100" r={r} stroke="url(#grad)" strokeWidth="16" fill="none"
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff6b35" />
            <stop offset="100%" stopColor="#f7931e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
          className="text-5xl font-bold text-[#1a1a2e] tabular-nums"
        >{score}</motion.div>
        <div className="text-xs text-gray-500">/ 100</div>
      </div>
    </div>
  );
}

function InsightCard({ color, icon: Icon, title, items }: { color: "emerald" | "amber"; icon: any; title: string; items: string[] }) {
  const bg = color === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600";
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-[#1a1a2e]">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${color === "emerald" ? "bg-emerald-500" : "bg-amber-500"} shrink-0`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BeforeAfter({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-[#ff6b35]" />
        <h3 className="font-bold text-[#1a1a2e]">{label}</h3>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
          <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Before</div>
          <p className="text-sm text-gray-600 line-through decoration-gray-300">{before}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-[#ff6b35] uppercase tracking-wide">After · AI</div>
            <button onClick={() => navigator.clipboard.writeText(after)} className="text-gray-400 hover:text-[#ff6b35] transition">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-[#1a1a2e] leading-relaxed">{after}</p>
        </div>
      </div>
    </div>
  );
}

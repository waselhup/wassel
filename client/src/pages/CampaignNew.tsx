import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Target, Users, Mail, Rocket, CheckCircle2, Search, Sparkles, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

export default function CampaignNew() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState({
    name: "", goal: "", industry: "", country: "SA",
    titles: "", count: 100, tone: "professional",
    subject: "", body: "",
  });
  const set = (k: string, v: any) => setData((d) => ({ ...d, [k]: v }));

  const steps = [
    { key: "target", label: t("new.s1", "الهدف"), icon: Target },
    { key: "audience", label: t("new.s2", "الجمهور"), icon: Users },
    { key: "message", label: t("new.s3", "الرسالة"), icon: Mail },
    { key: "launch", label: t("new.s4", "الإطلاق"), icon: Rocket },
  ];

  async function launch() {
    setLaunching(true);
    setError(null);
    try {
      await trpc.campaign.create({
        campaignName: data.name || "Untitled Campaign",
        jobTitle: data.titles || "Marketing",
        targetCompanies: (data.industry || "")
          .split(",").map((s) => s.trim()).filter(Boolean),
        recipientCount: Number(data.count) || 100,
        language: i18n.language === "ar" ? "ar" : "en",
      });
      setStep(4);
    } catch (e: any) {
      setError(e?.message || "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-4xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e]">
            {t("new.title", "حملة جديدة")}
          </h1>
          <p className="text-gray-500 mt-2">{t("new.subtitle", "أربع خطوات لإطلاق حملتك الذكية")}</p>
        </motion.div>

        <div className="flex items-center justify-between relative">
          <div className="absolute top-5 start-0 end-0 h-0.5 bg-gray-200" />
          <motion.div
            className="absolute top-5 start-0 h-0.5 bg-[#ff6b35]"
            initial={{ width: "0%" }} animate={{ width: `${(step / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
          {steps.map((s, i) => (
            <div key={s.key} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div
                animate={{ scale: step === i ? 1.1 : 1, backgroundColor: step >= i ? "#ff6b35" : "#ffffff" }}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow ${step >= i ? "border-[#ff6b35] text-white" : "border-gray-200 text-gray-400"}`}
              >
                {step > i ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
              </motion.div>
              <span className={`text-xs font-semibold ${step >= i ? "text-[#1a1a2e]" : "text-gray-400"}`}>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 md:p-8 min-h-[360px]">
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {step === 0 && (
                <>
                  <Field label={t("new.f.name", "اسم الحملة")}>
                    <input value={data.name} onChange={(e) => set("name", e.target.value)} placeholder="توسّع GCC 2026" className={inputCls} />
                  </Field>
                  <Field label={t("new.f.goal", "الهدف من الحملة")}>
                    <textarea value={data.goal} onChange={(e) => set("goal", e.target.value)} rows={3} placeholder={t("new.ph.goal", "حجز اجتماعات مع مدراء التسويق في شركات SaaS خليجية")} className={inputCls + " resize-none"} />
                  </Field>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label={t("new.f.industry", "القطاع")}>
                      <input value={data.industry} onChange={(e) => set("industry", e.target.value)} placeholder="SaaS, Fintech" className={inputCls} />
                    </Field>
                    <Field label={t("new.f.country", "الدولة")}>
                      <select value={data.country} onChange={(e) => set("country", e.target.value)} className={inputCls}>
                        <option value="SA">🇸🇦 السعودية</option>
                        <option value="AE">🇦🇪 الإمارات</option>
                        <option value="KW">🇰🇼 الكويت</option>
                        <option value="QA">🇶🇦 قطر</option>
                        <option value="BH">🇧🇭 البحرين</option>
                      </select>
                    </Field>
                  </div>
                  <Field label={t("new.f.titles", "المسميات الوظيفية")}>
                    <input value={data.titles} onChange={(e) => set("titles", e.target.value)} placeholder="CMO, Head of Marketing" className={inputCls} />
                  </Field>
                  <Field label={t("new.f.count", "عدد الإيميلات المستهدف")}>
                    <input type="number" value={data.count} onChange={(e) => set("count", +e.target.value)} className={inputCls} />
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <Field label={t("new.f.tone", "نبرة الكتابة")}>
                    <div className="flex flex-wrap gap-2">
                      {["professional", "friendly", "formal"].map((tn) => (
                        <button key={tn} onClick={() => set("tone", tn)}
                          className={`px-4 py-2 rounded-xl border text-sm font-semibold transition ${data.tone === tn ? "border-[#ff6b35] bg-orange-50 text-[#ff6b35]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                          {tn === "professional" ? t("new.tp", "احترافي") : tn === "friendly" ? t("new.tf", "ودّي") : t("new.tfm", "رسمي")}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={t("new.f.subject", "عنوان الإيميل")}>
                    <div className="relative">
                      <input value={data.subject} onChange={(e) => set("subject", e.target.value)} placeholder="فكرة سريعة لـ {company}" className={inputCls + " pe-11"} />
                      <button className="absolute end-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-orange-50 text-[#ff6b35] flex items-center justify-center hover:bg-orange-100 transition">
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </Field>
                  <Field label={t("new.f.body", "نص الرسالة")}>
                    <textarea value={data.body} onChange={(e) => set("body", e.target.value)} rows={6} placeholder={t("new.ph.body", "سيتم توليد الرسالة تلقائيًا بالذكاء الاصطناعي وتخصيصها لكل مستلم...")} className={inputCls + " resize-none"} />
                  </Field>
                </>
              )}
              {step === 3 && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#f7931e] flex items-center justify-center shadow-xl shadow-[#ff6b35]/30 mb-5">
                    <Rocket className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1a1a2e] mb-2">{t("new.confirm", "كل شيء جاهز!")}</h3>
                  <p className="text-gray-500 mb-6">{t("new.confirmD", "سيتم البحث عن {count} جهة اتصال وإرسال الإيميلات خلال 24 ساعة").replace("{count}", String(data.count))}</p>
                  <button onClick={launch} disabled={launching}
                    className="px-8 py-3 rounded-xl bg-[#ff6b35] hover:bg-[#e55a2b] disabled:opacity-50 text-white font-semibold shadow-lg shadow-[#ff6b35]/30 inline-flex items-center gap-2 transition">
                    {launching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                    {launching ? t("new.launching", "جاري الإطلاق...") : t("new.launch", "أطلق الحملة")}
                  </button>
                  {error && (
                    <div className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{error}</div>
                  )}
                </div>
              )}
              {step === 4 && (
                <div className="text-center py-8">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-[#1a1a2e] mb-2">{t("new.launched", "تم إطلاق الحملة!")}</h3>
                  <p className="text-gray-500">{t("new.launchedD", "ستصلك تحديثات عبر البريد الإلكتروني")}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {step < 3 && (
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              className="px-5 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2 transition">
              <ChevronRight className="w-4 h-4 rtl:rotate-180" /> {t("new.prev", "السابق")}
            </button>
            <button onClick={() => setStep(step + 1)}
              className="px-5 py-3 rounded-xl bg-[#1e3a5f] hover:bg-[#2c5282] text-white font-semibold flex items-center gap-2 transition">
              {t("new.next", "التالي")} <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#ff6b35] focus:outline-none focus:ring-2 focus:ring-[#ff6b35]/20 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

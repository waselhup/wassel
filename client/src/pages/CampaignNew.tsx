import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Target, Users, Mail, Eye, Rocket, CheckCircle2, Loader2, Edit3, Check } from 'lucide-react';
import { WasselLogo } from '../components/WasselLogo';
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

interface PreviewMessage {
  company: string;
  subject: string;
  body: string;
  approved: boolean;
}

export default function CampaignNew() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [data, setData] = useState({
    name: "", goal: "", industry: "", country: "SA",
    titles: "", count: 10, tone: "professional",
    subject: "", body: "",
  });
  const set = (k: string, v: any) => setData((d) => ({ ...d, [k]: v }));

  const steps = [
    { key: "target", label: t("new.s1", "الهدف"), icon: Target },
    { key: "audience", label: t("new.s2", "الجمهور"), icon: Users },
    { key: "message", label: t("new.s3", "الرسالة"), icon: Mail },
    { key: "review", label: t("new.s4review", "مراجعة الرسائل"), icon: Eye },
    { key: "launch", label: t("new.s5", "الإطلاق"), icon: Rocket },
  ];

  const companies = (data.industry || "").split(",").map((s) => s.trim()).filter(Boolean);
  const allApproved = messages.length > 0 && messages.every((m) => m.approved);

  async function generatePreview() {
    if (companies.length === 0) {
      setError(t("new.err.noCompanies", "أدخل شركات مستهدفة أولاً"));
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 240000)
      );
      const result = await Promise.race([
        trpc.campaign.previewMessages({
          jobTitle: data.titles || "Marketing Manager",
          targetCompanies: companies.slice(0, 10),
          language: i18n.language === "ar" ? "ar" : "en",
        }),
        timeoutPromise,
      ]) as { messages: Array<{ company: string; subject: string; body: string }> };
      setMessages(
        (result.messages || []).map((m) => ({ ...m, approved: false }))
      );
    } catch (e: any) {
      if (e?.message === 'timeout') {
        setError('انتهت المهلة (240 ثانية). حاول مرة أخرى.');
      } else {
        setError(e?.message || t("new.err.genFailed", "فشل إنشاء الرسائل"));
      }
    } finally {
      setGenerating(false);
    }
  }

  function updateMessage(idx: number, field: "subject" | "body", value: string) {
    setMessages((prev) => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  function toggleApprove(idx: number) {
    setMessages((prev) => prev.map((m, i) => i === idx ? { ...m, approved: !m.approved } : m));
  }

  function approveAll() {
    setMessages((prev) => prev.map((m) => ({ ...m, approved: true })));
  }

  async function launch() {
    setLaunching(true);
    setError(null);
    try {
      await trpc.campaign.create({
        campaignName: data.name || "Untitled Campaign",
        jobTitle: data.titles || "Marketing",
        targetCompanies: companies,
        recipientCount: Math.min(Number(data.count) || 10, 100),
        language: i18n.language === "ar" ? "ar" : "en",
      });
      setStep(5);
    } catch (e: any) {
      setError(e?.message || "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  // When entering review step, auto-generate if no messages yet
  function goToStep(target: number) {
    if (target === 3 && messages.length === 0) {
      setStep(3);
      generatePreview();
    } else {
      setStep(target);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-4xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--wsl-ink)]">
            {t("new.title", "حملة جديدة")}
          </h1>
          <p className="text-gray-500 mt-2">{t("new.subtitle5", "خمس خطوات لإطلاق حملتك الذكية")}</p>
        </motion.div>

        {/* Stepper */}
        <div className="flex items-center justify-between relative">
          <div className="absolute top-5 start-0 end-0 h-0.5 bg-gray-200" />
          <motion.div
            className="absolute top-5 start-0 h-0.5 bg-[#0A8F84]"
            initial={{ width: "0%" }} animate={{ width: `${(Math.min(step, steps.length - 1) / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
          {steps.map((s, i) => (
            <div key={s.key} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div
                animate={{ scale: step === i ? 1.1 : 1, backgroundColor: step >= i ? "#0A8F84" : "#ffffff" }}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow ${step >= i ? "border-[#0A8F84] text-white" : "border-gray-200 text-gray-400"}`}
              >
                {step > i ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
              </motion.div>
              <span className={`text-xs font-semibold hidden sm:block ${step >= i ? "text-[var(--wsl-ink)]" : "text-gray-400"}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 md:p-8 min-h-[360px]">
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Step 0: Target */}
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

              {/* Step 1: Audience */}
              {step === 1 && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label={t("new.f.industry", "الشركات المستهدفة")}>
                      <input value={data.industry} onChange={(e) => set("industry", e.target.value)} placeholder="أرامكو, STC, stc pay, Tamara" className={inputCls} />
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
                    <input type="number" min={1} max={100} value={data.count} onChange={(e) => set("count", Math.min(100, +e.target.value))} className={inputCls} />
                    <p className="text-xs text-gray-400 mt-1">{t("new.maxCount", "الحد الأقصى 100 مستلم لكل حملة")}</p>
                  </Field>
                </>
              )}

              {/* Step 2: Message settings */}
              {step === 2 && (
                <>
                  <Field label={t("new.f.tone", "نبرة الكتابة")}>
                    <div className="flex flex-wrap gap-2">
                      {["professional", "friendly", "formal"].map((tn) => (
                        <button key={tn} onClick={() => set("tone", tn)}
                          className={`px-4 py-2 rounded-xl border text-sm font-semibold transition ${data.tone === tn ? "border-[#0A8F84] bg-teal-50 text-[#0A8F84]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                          {tn === "professional" ? t("new.tp", "احترافي") : tn === "friendly" ? t("new.tf", "ودّي") : t("new.tfm", "رسمي")}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={t("new.f.subject", "عنوان الإيميل (اختياري)")}>
                    <input value={data.subject} onChange={(e) => set("subject", e.target.value)} placeholder={t("new.ph.subject", "فكرة سريعة لـ {company}")} className={inputCls} />
                  </Field>
                  <Field label={t("new.f.body", "ملاحظات إضافية (اختياري)")}>
                    <textarea value={data.body} onChange={(e) => set("body", e.target.value)} rows={4} placeholder={t("new.ph.body", "سيتم توليد الرسالة تلقائيًا بالذكاء الاصطناعي وتخصيصها لكل مستلم...")} className={inputCls + " resize-none"} />
                  </Field>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-teal-50 border border-teal-200">
                    <WasselLogo size={44} />
                    <p className="text-sm text-[var(--wsl-ink)]">{t("new.aiNote", "سينشئ الذكاء الاصطناعي رسائل مخصصة لكل شركة في الخطوة التالية")}</p>
                  </div>
                </>
              )}

              {/* Step 3: Message Review (NEW) */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-[var(--wsl-ink)] flex items-center gap-2">
                      <Eye className="w-5 h-5 text-[#0A8F84]" />
                      {t("new.reviewTitle", "مراجعة الرسائل")}
                    </h3>
                    {messages.length > 0 && !allApproved && (
                      <button onClick={approveAll}
                        className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold hover:bg-emerald-100 transition flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> {t("new.approveAll", "موافقة على الكل")}
                      </button>
                    )}
                  </div>

                  {generating && (
                    <div className="flex flex-col items-center py-12 gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-[#0A8F84]" />
                      <p className="text-gray-500 font-medium">{t("new.generating", "الذكاء الاصطناعي ينشئ رسائل مخصصة لكل شركة...")}</p>
                      <p className="text-xs text-gray-400">{t("new.generatingWait", "قد يستغرق 30-60 ثانية")}</p>
                    </div>
                  )}

                  {!generating && messages.length === 0 && (
                    <div className="text-center py-12">
                      <WasselLogo size={44} />
                      <p className="text-gray-500">{t("new.noMessages", "اضغط لإنشاء رسائل مخصصة بالذكاء الاصطناعي")}</p>
                      <button onClick={generatePreview}
                        className="mt-4 px-6 py-3 rounded-xl bg-[#0A8F84] hover:bg-[#064E49] text-white font-semibold inline-flex items-center gap-2 transition">
                        <WasselLogo size={44} /> {t("new.generateBtn", "إنشاء الرسائل")}
                      </button>
                    </div>
                  )}

                  {!generating && messages.map((msg, idx) => (
                    <motion.div key={idx}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                      className={`rounded-xl border-2 p-5 transition-all ${msg.approved ? "border-emerald-300 bg-emerald-50/50" : "border-gray-200 bg-white"}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-[var(--wsl-ink)]">{msg.company}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => toggleApprove(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${msg.approved ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-teal-50 hover:text-[#0A8F84] hover:border-teal-200"}`}>
                            {msg.approved ? <><CheckCircle2 className="w-3 h-3" /> {t("new.approved", "تمت الموافقة")}</> : t("new.approve", "موافق")}
                          </button>
                        </div>
                      </div>

                      {editingIdx === idx ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">{t("new.subject", "الموضوع")}</label>
                            <input value={msg.subject} onChange={(e) => updateMessage(idx, "subject", e.target.value)} className={inputCls + " text-sm"} />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1 block">{t("new.body", "النص")}</label>
                            <textarea value={msg.body} onChange={(e) => updateMessage(idx, "body", e.target.value)} rows={5} className={inputCls + " text-sm resize-none"} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-gray-400 mb-1">{msg.subject}</p>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line line-clamp-4">{msg.body}</p>
                        </>
                      )}
                    </motion.div>
                  ))}

                  {!generating && messages.length > 0 && (
                    <button onClick={generatePreview}
                      className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2">
                      <WasselLogo size={44} /> {t("new.regenerate", "إعادة إنشاء الرسائل")}
                    </button>
                  )}
                </div>
              )}

              {/* Step 4: Launch */}
              {step === 4 && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[var(--wsl-teal)] to-[var(--wsl-gold)] flex items-center justify-center shadow-xl shadow-[#0A8F84]/30 mb-5">
                    <Rocket className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--wsl-ink)] mb-2">{t("new.confirm", "كل شيء جاهز!")}</h3>
                  <p className="text-gray-500 mb-2">{data.name || "Campaign"} — {companies.length} {t("new.companies", "شركات")} — {data.count} {t("new.emails", "إيميل")}</p>
                  <p className="text-gray-400 text-sm mb-6">{t("new.tokenCost", "التكلفة")}: {data.count} {t("new.tokensUnit", "رمز")}</p>
                  <button onClick={launch} disabled={launching}
                    className="px-8 py-3 rounded-xl bg-[#0A8F84] hover:bg-[#064E49] disabled:opacity-50 text-white font-semibold shadow-lg shadow-[#0A8F84]/30 inline-flex items-center gap-2 transition">
                    {launching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                    {launching ? t("new.launching", "جاري الإطلاق...") : t("new.launch", "إطلاق الحملة")}
                  </button>
                  {error && (
                    <div className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{error}</div>
                  )}
                </div>
              )}

              {/* Step 5: Success */}
              {step === 5 && (
                <div className="text-center py-8">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-[var(--wsl-ink)] mb-2">{t("new.launched", "تم إطلاق الحملة!")}</h3>
                  <p className="text-gray-500">{t("new.launchedD", "ستصلك تحديثات عبر البريد الإلكتروني")}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        {error && step !== 4 && step !== 5 && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm">{error}</div>
        )}

        {step < 4 && (
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              className="px-5 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2 transition">
              <ChevronRight className="w-4 h-4 rtl:rotate-180" /> {t("new.prev", "السابق")}
            </button>
            {step === 3 ? (
              <button onClick={() => goToStep(4)} disabled={!allApproved}
                className="px-5 py-3 rounded-xl bg-[var(--wsl-teal)] hover:bg-[var(--wsl-teal-dark)] disabled:opacity-40 text-white font-semibold flex items-center gap-2 transition">
                {t("new.toLaunch", "متابعة الإطلاق")} <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              </button>
            ) : (
              <button onClick={() => goToStep(step + 1)}
                className="px-5 py-3 rounded-xl bg-[var(--wsl-teal)] hover:bg-[var(--wsl-teal-dark)] text-white font-semibold flex items-center gap-2 transition">
                {t("new.next", "التالي")} <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              </button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#0A8F84] focus:outline-none focus:ring-2 focus:ring-[#0A8F84]/20 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

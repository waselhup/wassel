import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Linkedin, User, Target, CheckCircle2 } from 'lucide-react';
import { WasselLogo } from '../components/WasselLogo';

export default function Onboarding() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ linkedin: "", role: "", goal: "" });
  const set = (k: string, v: string) => setData((d) => ({ ...d, [k]: v }));

  const steps = [
    { key: "link", title: t("on.s1.title", "اربط ملفك على LinkedIn"), desc: t("on.s1.desc", "ألصق رابط ملفك الشخصي لنقوم بتحليله"), icon: Linkedin },
    { key: "role", title: t("on.s2.title", "ما دورك الحالي؟"), desc: t("on.s2.desc", "ساعدنا على تخصيص التجربة لك"), icon: User },
    { key: "goal", title: t("on.s3.title", "ما هدفك من وصل؟"), desc: t("on.s3.desc", "سنرشدك للميزة الأنسب"), icon: Target },
  ];

  const goals = [
    t("on.goal.job", "البحث عن وظيفة"),
    t("on.goal.clients", "جذب عملاء B2B"),
    t("on.goal.brand", "بناء علامتي الشخصية"),
    t("on.goal.network", "توسيع شبكة العلاقات"),
  ];
  const roles = [
    t("on.role.exec", "تنفيذي / إداري"),
    t("on.role.sales", "مبيعات / تسويق"),
    t("on.role.tech", "مهندس / تقني"),
    t("on.role.founder", "مؤسس / مستقل"),
  ];

  const done = step === steps.length;

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-10 -start-20 w-96 h-96 rounded-full bg-teal-100/40 blur-3xl" />
      <div className="absolute bottom-10 -end-20 w-96 h-96 rounded-full bg-blue-100/40 blur-3xl" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl p-8 md:p-10"
      >
        {!done && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((_, i) => (
              <motion.div key={i}
                animate={{ width: step === i ? 32 : 8, backgroundColor: step >= i ? "#14b8a6" : "#e5e7eb" }}
                className="h-2 rounded-full"
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div key={step}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--wsl-teal)] to-[var(--wsl-gold)] flex items-center justify-center shadow-xl shadow-[#14b8a6]/30">
                  {(() => { const Icon = steps[step].icon; return <Icon className="w-8 h-8 text-white" />; })()}
                </div>
              </div>
              <h2 className="text-2xl font-bold text-[var(--wsl-ink)] text-center mb-2">{steps[step].title}</h2>
              <p className="text-gray-500 text-center mb-7">{steps[step].desc}</p>

              {step === 0 && (
                <input value={data.linkedin} onChange={(e) => set("linkedin", e.target.value)}
                  placeholder="https://linkedin.com/in/your-profile"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#14b8a6] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/20 transition text-center"
                />
              )}
              {step === 1 && (
                <div className="grid grid-cols-2 gap-3">
                  {roles.map((r) => (
                    <button key={r} onClick={() => set("role", r)}
                      className={`p-4 rounded-xl border-2 text-sm font-semibold transition ${data.role === r ? "border-[#14b8a6] bg-teal-50 text-[#14b8a6]" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
              {step === 2 && (
                <div className="grid grid-cols-1 gap-3">
                  {goals.map((g) => (
                    <button key={g} onClick={() => set("goal", g)}
                      className={`p-4 rounded-xl border-2 text-sm font-semibold transition text-start ${data.goal === g ? "border-[#14b8a6] bg-teal-50 text-[#14b8a6]" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <Done onFinish={() => setLocation("/app")} />
          )}
        </AnimatePresence>

        {!done && (
          <div className="flex items-center justify-between mt-8">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
              className="px-5 py-3 rounded-xl text-gray-500 font-semibold hover:bg-gray-50 disabled:opacity-40 flex items-center gap-2 transition">
              <ChevronRight className="w-4 h-4 rtl:rotate-180" /> {t("on.back", "رجوع")}
            </button>
            <button onClick={() => setStep(step + 1)}
              className="px-6 py-3 rounded-xl bg-[#14b8a6] hover:bg-[#0f766e] text-white font-semibold shadow-lg shadow-[#14b8a6]/30 flex items-center gap-2 transition">
              {step === steps.length - 1 ? t("on.finish", "إنهاء") : t("on.next", "التالي")}
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Done({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
      <Confetti />
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
        className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5"
      >
        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
      </motion.div>
      <h2 className="text-2xl font-bold text-[var(--wsl-ink)] mb-2">{t("on.done.title", "مرحبًا بك في وصل!")}</h2>
      <p className="text-gray-500 mb-6">{t("on.done.desc", "حسابك جاهز. لنبدأ رحلتك نحو الفرصة التالية")}</p>
      <button onClick={onFinish}
        className="px-8 py-3 rounded-xl bg-[#14b8a6] hover:bg-[#0f766e] text-white font-semibold shadow-lg shadow-[#14b8a6]/30 inline-flex items-center gap-2 transition">
        <WasselLogo size={44} /> {t("on.start", "ابدأ الآن")}
      </button>
    </motion.div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 24 });
  const colors = ["#14b8a6", "#C9922A", "#0f766e", "#10b981", "#0d9488"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => (
        <motion.div key={i}
          initial={{ y: -20, x: (i % 2 ? 1 : -1) * (20 + Math.random() * 100), opacity: 1, rotate: 0 }}
          animate={{ y: 400, opacity: 0, rotate: 360 + Math.random() * 180 }}
          transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.4 }}
          className="absolute start-1/2 top-1/4 w-2 h-3 rounded-sm"
          style={{ backgroundColor: colors[i % colors.length] }}
        />
      ))}
    </div>
  );
}

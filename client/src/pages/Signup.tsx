import { useState, useMemo, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, AlertCircle, Loader2, Check } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";

function strengthOf(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0..4
}

export default function Signup() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const isRTL = i18n.language === "ar";
  const strength = useMemo(() => strengthOf(password), [password]);
  const strengthColor = ["#e5e7eb", "#ef4444", "#f59e0b", "#eab308", "#10b981"][strength];
  const strengthLabel = [
    t("auth.strength.none", "أدخل كلمة مرور"),
    t("auth.strength.weak", "ضعيفة"),
    t("auth.strength.fair", "مقبولة"),
    t("auth.strength.good", "جيدة"),
    t("auth.strength.strong", "قوية"),
  ][strength];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (strength < 2) {
      setError(t("auth.error.weak", "كلمة المرور ضعيفة جداً"));
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setLoading(true);
    try {
      await signUp?.(email, password, name);
      setLocation("/app/setup");
    } catch (err: any) {
      setError(err?.message || t("auth.error.signup", "فشل إنشاء الحساب"));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.signup.title", "ابدأ رحلتك المهنية")}
      subtitle={t("auth.signup.subtitle", "أنشئ حساباً مجانياً خلال 30 ثانية")}
    >
      <motion.form
        animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        onSubmit={onSubmit}
        className="space-y-5"
      >
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        <div className="relative">
          <User className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "end-4" : "start-4"} w-5 h-5 text-[#6b7280]`} />
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.name", "الاسم الكامل")}
            className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white focus:border-[#0A8F84] focus:ring-2 focus:ring-[#0A8F84]/20 outline-none transition`}
          />
        </div>

        <div className="relative">
          <Mail className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "end-4" : "start-4"} w-5 h-5 text-[#6b7280]`} />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.email", "البريد الإلكتروني")}
            className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white focus:border-[#0A8F84] focus:ring-2 focus:ring-[#0A8F84]/20 outline-none transition`}
          />
          {email.includes("@") && email.includes(".") && (
            <Check className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "start-4" : "end-4"} w-5 h-5 text-green-500`} />
          )}
        </div>

        <div>
          <div className="relative">
            <Lock className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "end-4" : "start-4"} w-5 h-5 text-[#6b7280]`} />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.password.placeholder", "كلمة المرور (8 أحرف أو أكثر)")}
              className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white focus:border-[#0A8F84] focus:ring-2 focus:ring-[#0A8F84]/20 outline-none transition`}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <motion.div
                animate={{ width: `${(strength / 4) * 100}%`, backgroundColor: strengthColor }}
                className="h-full rounded-full"
              />
            </div>
            <span className="text-xs text-[#6b7280]">{strengthLabel}</span>
          </div>
        </div>

        <div className="text-xs text-[#6b7280] leading-relaxed">
          {t("auth.terms", "بإنشاء الحساب فإنك توافق على")}{" "}
          <a href="#" className="text-[#0A8F84] hover:underline">{t("auth.terms.link", "الشروط والأحكام")}</a>
          {" "}{t("auth.and", "و")}{" "}
          <a href="#" className="text-[#0A8F84] hover:underline">{t("auth.privacy.link", "سياسة الخصوصية")}</a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-xl bg-[#0A8F84] text-white font-bold text-base shadow-lg shadow-[#0A8F84]/30 hover:bg-[#12B5A8] hover:shadow-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              {t("auth.signup.cta", "أنشئ حسابي المجاني")}
              <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
            </>
          )}
        </button>

        <div className="text-center text-sm text-[#6b7280]">
          {t("auth.haveAccount", "لديك حساب بالفعل؟")}{" "}
          <Link href="/login" className="text-[#0A8F84] font-semibold hover:underline">
            {t("auth.login.link", "سجّل دخولك")}
          </Link>
        </div>
      </motion.form>
    </AuthLayout>
  );
}

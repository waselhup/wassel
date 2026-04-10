import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const isRTL = i18n.language === "ar";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn?.(email, password);
      setLocation("/app");
    } catch (err: any) {
      setError(err?.message || t("auth.error.generic", "فشل تسجيل الدخول. تأكد من البيانات."));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.login.title", "مرحباً بعودتك")}
      subtitle={t("auth.login.subtitle", "سجّل دخولك للوصول إلى لوحة التحكم")}
    >
      <motion.form
        animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        onSubmit={onSubmit}
        className="space-y-5"
      >
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        <div className="relative">
          <Mail className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "end-4" : "start-4"} w-5 h-5 text-[#6b7280]`} />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.email", "البريد الإلكتروني")}
            className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white text-[#1f2937] placeholder:text-[#9ca3af] focus:border-[#ff6b35] focus:ring-2 focus:ring-[#ff6b35]/20 outline-none transition`}
          />
        </div>

        <div className="relative">
          <Lock className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "end-4" : "start-4"} w-5 h-5 text-[#6b7280]`} />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("auth.password", "كلمة المرور")}
            className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white text-[#1f2937] placeholder:text-[#9ca3af] focus:border-[#ff6b35] focus:ring-2 focus:ring-[#ff6b35]/20 outline-none transition`}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-[#6b7280]">
            <input type="checkbox" className="rounded border-gray-300 text-[#ff6b35] focus:ring-[#ff6b35]" />
            {t("auth.remember", "تذكّرني")}
          </label>
          <Link href="/reset-password" className="text-[#ff6b35] font-semibold hover:underline">
            {t("auth.forgot", "نسيت كلمة المرور؟")}
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-xl bg-[#ff6b35] text-white font-bold text-base shadow-lg shadow-[#ff6b35]/30 hover:bg-[#ff8a5c] hover:shadow-xl hover:shadow-[#ff6b35]/40 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {t("auth.login.cta", "تسجيل الدخول")}
              <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
            </>
          )}
        </button>

        <div className="text-center text-sm text-[#6b7280]">
          {t("auth.noAccount", "ليس لديك حساب؟")}{" "}
          <Link href="/signup" className="text-[#ff6b35] font-semibold hover:underline">
            {t("auth.signup.link", "أنشئ حساب مجاني")}
          </Link>
        </div>
      </motion.form>
    </AuthLayout>
  );
}

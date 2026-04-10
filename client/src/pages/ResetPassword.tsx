import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Mail, ArrowRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPassword() {
  const { t, i18n } = useTranslation();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRTL = i18n.language === "ar";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword?.(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || t("auth.reset.error", "فشل الإرسال. حاول مجدداً."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.reset.title", "استعادة كلمة المرور")}
      subtitle={t("auth.reset.subtitle", "أدخل بريدك وسنرسل لك رابط إعادة التعيين")}
    >
      {success ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-2xl bg-green-50 border border-green-200 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">
            {t("auth.reset.sent.title", "تم الإرسال!")}
          </h3>
          <p className="text-[#6b7280] mb-6">
            {t("auth.reset.sent.desc", "تحقق من بريدك الإلكتروني واتبع الرابط لإعادة تعيين كلمة المرور.")}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[#ff6b35] font-semibold hover:underline"
          >
            {t("auth.reset.backToLogin", "العودة لتسجيل الدخول")}
            <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </motion.div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
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
              className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white focus:border-[#ff6b35] focus:ring-2 focus:ring-[#ff6b35]/20 outline-none transition`}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-xl bg-[#ff6b35] text-white font-bold shadow-lg shadow-[#ff6b35]/30 hover:bg-[#ff8a5c] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {t("auth.reset.cta", "أرسل رابط الاستعادة")}
                <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
              </>
            )}
          </button>
          <div className="text-center text-sm text-[#6b7280]">
            <Link href="/login" className="text-[#ff6b35] font-semibold hover:underline">
              {t("auth.reset.backToLogin", "العودة لتسجيل الدخول")}
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

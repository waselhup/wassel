import { useState, useEffect, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Mail, ArrowRight, CheckCircle2, Loader2, AlertCircle, Lock, Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const { t, i18n } = useTranslation();
  const { resetPassword } = useAuth();
  const [, navigate] = useLocation();
  const isRTL = i18n.language === "ar";

  // Mode: "loading" | "request" | "sent" | "newpw" | "done"
  const [mode, setMode] = useState<"loading" | "request" | "sent" | "newpw" | "done">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount: check URL hash for recovery token
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token") && hash.includes("type=recovery")) {
      // Supabase client auto-detects hash tokens on init, but let's ensure session is set
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token") || "";

      if (accessToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error: sessionErr }) => {
            if (sessionErr) {
              console.error("[RESET] setSession error:", sessionErr);
              setError(t("auth.reset.linkExpired", "رابط الاستعادة منتهي الصلاحية. اطلب رابطاً جديداً."));
              setMode("request");
            } else {
              setMode("newpw");
            }
          });
      } else {
        setMode("request");
      }
    } else {
      // Also check if there's already a session (user navigated here directly after clicking email link)
      supabase.auth.getSession().then(({ data }) => {
        // Don't auto-switch to newpw if user is just logged in normally
        // Only switch if the URL had a recovery hash
        setMode("request");
      });
    }
  }, []);

  // Request reset email
  async function onRequestReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword?.(email);
      setMode("sent");
    } catch (err: any) {
      setError(err?.message || t("auth.reset.error", "فشل الإرسال. حاول مجدداً."));
    } finally {
      setLoading(false);
    }
  }

  // Save new password
  async function onSavePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("auth.reset.minLength", "كلمة المرور يجب أن تكون 8 أحرف على الأقل"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.reset.mismatch", "كلمتا المرور غير متطابقتين"));
      return;
    }

    setLoading(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }
    setMode("done");
    // Clear the hash from URL
    window.history.replaceState(null, "", "/reset-password");
    setTimeout(() => navigate("/app"), 2000);
  }

  // LOADING
  if (mode === "loading") {
    return (
      <AuthLayout
        title={t("auth.reset.title", "استعادة كلمة المرور")}
        subtitle={t("auth.reset.loading", "جاري التحقق...")}
      >
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#0A8F84]" />
        </div>
      </AuthLayout>
    );
  }

  // SUCCESS — password changed
  if (mode === "done") {
    return (
      <AuthLayout
        title={t("auth.reset.doneTitle", "تم التغيير!")}
        subtitle={t("auth.reset.doneSubtitle", "سيتم توجيهك للوحة التحكم")}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-2xl bg-green-50 border border-green-200 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-[#064E49] mb-2">
            {t("auth.reset.changed", "تم تغيير كلمة المرور بنجاح!")}
          </h3>
          <p className="text-[#6b7280]">
            {t("auth.reset.redirecting", "جاري التوجيه للوحة التحكم...")}
          </p>
        </motion.div>
      </AuthLayout>
    );
  }

  // EMAIL SENT confirmation
  if (mode === "sent") {
    return (
      <AuthLayout
        title={t("auth.reset.title", "استعادة كلمة المرور")}
        subtitle={t("auth.reset.subtitle", "تحقق من بريدك الإلكتروني")}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-2xl bg-green-50 border border-green-200 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-[#064E49] mb-2">
            {t("auth.reset.sent.title", "تم الإرسال!")}
          </h3>
          <p className="text-[#6b7280] mb-6">
            {t("auth.reset.sent.desc", "تحقق من بريدك الإلكتروني واتبع الرابط لإعادة تعيين كلمة المرور.")}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[#0A8F84] font-semibold hover:underline"
          >
            {t("auth.reset.backToLogin", "العودة لتسجيل الدخول")}
            <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </motion.div>
      </AuthLayout>
    );
  }

  // NEW PASSWORD FORM (user came from email link)
  if (mode === "newpw") {
    return (
      <AuthLayout
        title={t("auth.reset.newPwTitle", "كلمة مرور جديدة")}
        subtitle={t("auth.reset.newPwSubtitle", "أدخل كلمة مرور قوية لحسابك")}
      >
        <form onSubmit={onSavePassword} className="space-y-5">
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* New Password */}
          <div className="relative">
            <Lock className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "end-4" : "start-4"} w-5 h-5 text-[#6b7280]`} />
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.reset.newPw", "كلمة المرور الجديدة")}
              className={`w-full h-14 ${isRTL ? "pe-12 ps-12" : "ps-12 pe-12"} rounded-xl border border-gray-200 bg-white focus:border-[#0A8F84] focus:ring-2 focus:ring-[#0A8F84]/20 outline-none transition`}
            />
            <button
              type="button"
              onClick={() => setShowPw((p) => !p)}
              className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "start-4" : "end-4"} text-[#6b7280] hover:text-[#064E49]`}
            >
              {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <Lock className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "end-4" : "start-4"} w-5 h-5 text-[#6b7280]`} />
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("auth.reset.confirmPw", "تأكيد كلمة المرور")}
              className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white focus:border-[#0A8F84] focus:ring-2 focus:ring-[#0A8F84]/20 outline-none transition`}
            />
          </div>

          {/* Password strength hint */}
          <p className="text-xs text-[#6b7280]">
            {t("auth.reset.hint", "يجب أن تكون 8 أحرف على الأقل")}
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-xl bg-[#0A8F84] text-white font-bold shadow-lg shadow-[#0A8F84]/30 hover:bg-[#12B5A8] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {t("auth.reset.savePw", "حفظ كلمة المرور الجديدة")}
                <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
              </>
            )}
          </button>
        </form>
      </AuthLayout>
    );
  }

  // REQUEST RESET LINK FORM (default)
  return (
    <AuthLayout
      title={t("auth.reset.title", "استعادة كلمة المرور")}
      subtitle={t("auth.reset.subtitle", "أدخل بريدك وسنرسل لك رابط إعادة التعيين")}
    >
      <form onSubmit={onRequestReset} className="space-y-5">
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
            className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white focus:border-[#0A8F84] focus:ring-2 focus:ring-[#0A8F84]/20 outline-none transition`}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-xl bg-[#0A8F84] text-white font-bold shadow-lg shadow-[#0A8F84]/30 hover:bg-[#12B5A8] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              {t("auth.reset.cta", "أرسل رابط الاستعادة")}
              <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
            </>
          )}
        </button>
        <div className="text-center text-sm text-[#6b7280]">
          <Link href="/login" className="text-[#0A8F84] font-semibold hover:underline">
            {t("auth.reset.backToLogin", "العودة لتسجيل الدخول")}
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

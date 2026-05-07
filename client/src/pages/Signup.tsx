import { useState, useMemo, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, AlertCircle, Loader2, Check, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

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
  const [oauthLoading, setOauthLoading] = useState<"google" | "linkedin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const isRTL = i18n.language === "ar";

  async function handleGoogleLogin() {
    setError(null);
    setOauthLoading("google");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || t("auth.error.oauth", "فشل تسجيل الدخول عبر OAuth"));
      setOauthLoading(null);
    }
  }

  async function handleLinkedInLogin() {
    setError(null);
    setOauthLoading("linkedin");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "linkedin_oidc",
        options: {
          redirectTo: `${window.location.origin}/app`,
          scopes: "openid profile email",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || t("auth.error.oauth", "فشل تسجيل الدخول عبر OAuth"));
      setOauthLoading(null);
    }
  }
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

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            const token = parsed?.access_token || parsed?.currentSession?.access_token;
            if (token) {
              fetch('/api/email/welcome', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
              })
                .then((r) => r.json())
                .then((j) => console.log('[signup] welcome email:', j))
                .catch((e) => console.error('[signup] welcome email failed:', e));
              break;
            }
          }
        }
      } catch (e) {
        console.error('[signup] welcome email trigger error:', e);
      }

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

        {/* OAuth Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={oauthLoading !== null || loading}
            className="w-full h-12 rounded-lg bg-white border border-[#dadce0] text-[#3c4043] font-semibold text-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            style={{ fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}
          >
            {oauthLoading === "google" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span>{t("auth.loginWithGoogle", "الدخول بحساب Google")}</span>
          </button>

          <button
            type="button"
            onClick={handleLinkedInLogin}
            disabled={oauthLoading !== null || loading}
            className="w-full h-12 rounded-lg bg-[#0077B5] text-white font-semibold text-sm hover:bg-[#005f8d] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {oauthLoading === "linkedin" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            )}
            <span>{t("auth.loginWithLinkedIn", "الدخول بحساب LinkedIn")}</span>
          </button>
        </div>

        <div className="flex items-center gap-4 my-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-[#9ca3af] uppercase tracking-wider">
            {t("auth.orDivider", "أو")}
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="relative">
          <User className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "end-4" : "start-4"} w-5 h-5 text-[#6b7280]`} />
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.name", "الاسم الكامل")}
            className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 outline-none transition`}
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
            className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 outline-none transition`}
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
              className={`w-full h-14 ${isRTL ? "pe-12 ps-4" : "ps-12 pe-4"} rounded-xl border border-gray-200 bg-white focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 outline-none transition`}
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
          <a href="#" className="text-[#14b8a6] hover:underline">{t("auth.terms.link", "الشروط والأحكام")}</a>
          {" "}{t("auth.and", "و")}{" "}
          <a href="#" className="text-[#14b8a6] hover:underline">{t("auth.privacy.link", "سياسة الخصوصية")}</a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-xl bg-[#14b8a6] text-white font-bold text-base shadow-lg shadow-[#14b8a6]/30 hover:bg-[#0d9488] hover:shadow-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
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
          <Link href="/login" className="text-[#14b8a6] font-semibold hover:underline">
            {t("auth.login.link", "سجّل دخولك")}
          </Link>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-[#9ca3af]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t("auth.secureOAuth", "تسجيل دخول آمن عبر OAuth 2.0")}</span>
        </div>
      </motion.form>
    </AuthLayout>
  );
}

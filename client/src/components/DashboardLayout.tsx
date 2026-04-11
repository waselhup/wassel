import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, BarChart2, FileText, Send, Coins, User,
  Sparkles, Menu, X, LogOut, Globe2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props { children: ReactNode; tokens?: number }

export default function DashboardLayout({ children, tokens: tokensProp }: Props) {
  const { t, i18n } = useTranslation();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isRTL = i18n.language === "ar";
  const { user, profile, signOut, refreshProfile } = useAuth();

  // Always read balance from profile (source of truth). Fallback to prop, then 0.
  const tokens = profile?.token_balance ?? tokensProp ?? 0;

  // Refresh profile every time user navigates (keeps sidebar balance in sync)
  useEffect(() => {
    if (user && refreshProfile) {
      refreshProfile();
    }
  }, [location, user]);

  const nav = [
    { href: "/app", icon: Home, label: t("nav.home", "الرئيسية") },
    { href: "/app/linkedin", icon: BarChart2, label: t("nav.linkedin", "تحليل LinkedIn") },
    { href: "/app/cv", icon: FileText, label: t("nav.cv", "تخصيص السيرة") },
    { href: "/app/campaigns", icon: Send, label: t("nav.campaigns", "الحملات") },
    { href: "/app/tokens", icon: Coins, label: t("nav.tokens", "الرصيد") },
    { href: "/app/profile", icon: User, label: t("nav.profile", "الملف الشخصي") },
  ];

  const initial = (user?.email || "U").charAt(0).toUpperCase();

  const Sidebar = (
    <aside className="w-64 bg-white border-e border-gray-200 flex flex-col h-full">
      <div className="p-6 border-b border-gray-100">
        <Link href="/app" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#ff6b35]" />
          </div>
          <span className="text-xl font-extrabold text-[#1e3a5f]">
            {t("brand.name", "وصّل")}
          </span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? "bg-[#ff6b35]/10 text-[#ff6b35]"
                  : "text-[#1e3a5f]/70 hover:bg-gray-50 hover:text-[#1e3a5f]"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute start-0 top-2 bottom-2 w-1 rounded-full bg-[#ff6b35]"
                />
              )}
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-3">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-[#fff5f0] to-white border border-[#ff6b35]/20">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#ff6b35]" />
            <span className="text-xs font-semibold text-[#6b7280]">
              {t("nav.balance", "الرصيد")}
            </span>
          </div>
          <span className="text-sm font-extrabold text-[#1e3a5f]">{tokens}</span>
        </div>

        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#ff6b35] flex items-center justify-center text-white font-bold shadow">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-[#1e3a5f] truncate">
              {user?.email || t("nav.guest", "زائر")}
            </div>
            <span className="text-[10px] font-semibold text-[#ff6b35] uppercase">
              {t("nav.plan.free", "مجاني")}
            </span>
          </div>
          <button
            onClick={() => signOut?.()}
            className="p-2 rounded-lg hover:bg-red-50 text-[#6b7280] hover:text-red-500 transition"
            aria-label={t("nav.logout", "تسجيل الخروج")}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => i18n.changeLanguage(isRTL ? "en" : "ar")}
          className="w-full flex items-center justify-center gap-2 text-xs text-[#6b7280] hover:text-[#1e3a5f] py-2 rounded-lg"
        >
          <Globe2 className="w-3 h-3" />
          {isRTL ? "English" : "العربية"}
        </button>
      </div>
    </aside>
  );

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen bg-[#fafafa] text-[#1f2937] flex"
      style={{ fontFamily: isRTL ? "Cairo, sans-serif" : "Inter, sans-serif" }}
    >
      {/* Desktop sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen">{Sidebar}</div>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <Link href="/app" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1e3a5f] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#ff6b35]" />
          </div>
          <span className="font-extrabold text-[#1e3a5f]">{t("brand.name", "وصّل")}</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <Menu className="w-5 h-5 text-[#1e3a5f]" />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/40 z-50"
            />
            <motion.div
              initial={{ x: isRTL ? 300 : -300 }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? 300 : -300 }}
              transition={{ type: "spring", damping: 25 }}
              className="lg:hidden fixed top-0 bottom-0 start-0 z-50"
            >
              <div className="relative h-full">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="absolute top-4 end-4 p-2 rounded-lg hover:bg-gray-100 z-10"
                >
                  <X className="w-5 h-5" />
                </button>
                {Sidebar}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <main className="flex-1 lg:ms-0 pt-20 lg:pt-0 min-w-0">
        <div className="p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}

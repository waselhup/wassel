import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Coins, BarChart2, FileText, Send, TrendingUp, Clock, Linkedin, ArrowUpRight, Activity, Star, Sparkles } from 'lucide-react';
import { WasselLogo } from '../components/WasselLogo';
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";

function useCountUp(target: number, duration = 1200) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

type Stat = {
  key: string; label: string; value: number; delta: string;
  icon: any; gradient: string; iconBg: string;
};

type Action = {
  key: string; title: string; desc: string; href: string;
  icon: any; color: string;
};

type ActivityItem = {
  id: string; icon: any; title: string; time: string; color: string;
};

export default function DashboardHome() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === "ar";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t("home.greet.morning", "صباح الخير")
    : hour < 18 ? t("home.greet.afternoon", "مساء الخير")
    : t("home.greet.evening", "مساء الخير");
  const name =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    (user?.email?.split("@")[0] ?? "");
  const avatarUrl =
    profile?.avatar_url ||
    (user?.user_metadata?.avatar_url as string) ||
    (user?.user_metadata?.picture as string) ||
    "";

  const [counts, setCounts] = useState({ tokens: 0, analyses: 0, cvs: 0, campaigns: 0 });
  useEffect(() => {
    (async () => {
      const [bal, lh, ch, cl] = await Promise.allSettled([
        trpc.token.balance(),
        trpc.linkedin.history(),
        trpc.cv.history(),
        trpc.campaign.list(),
      ]);
      setCounts({
        tokens: bal.status === "fulfilled" ? (bal.value?.balance ?? 0) : 0,
        analyses: lh.status === "fulfilled" && Array.isArray(lh.value) ? lh.value.length : 0,
        cvs: ch.status === "fulfilled" && Array.isArray(ch.value) ? ch.value.length : 0,
        campaigns: cl.status === "fulfilled" && Array.isArray(cl.value) ? cl.value.length : 0,
      });
    })();
  }, []);

  const stats: Stat[] = [
    { key: "tokens", label: t("home.stats.tokens", "رصيد التوكنز"), value: counts.tokens, delta: "",
      icon: Coins, gradient: "from-teal-50 to-emerald-50", iconBg: "bg-amber-500" },
    { key: "analyses", label: t("home.stats.analyses", "تحليلات LinkedIn"), value: counts.analyses, delta: "",
      icon: BarChart2, gradient: "from-blue-50 to-cyan-50", iconBg: "bg-blue-500" },
    { key: "cvs", label: t("home.stats.cvs", "سير مُنشأة"), value: counts.cvs, delta: "",
      icon: FileText, gradient: "from-emerald-50 to-teal-50", iconBg: "bg-emerald-500" },
    { key: "campaigns", label: t("home.stats.campaigns", "حملات مُرسلة"), value: counts.campaigns, delta: "",
      icon: Send, gradient: "from-purple-50 to-fuchsia-50", iconBg: "bg-purple-500" },
  ];

  const actions: Action[] = [
    { key: "linkedin", title: t("home.actions.linkedin.title", "حلّل ملفك على LinkedIn"),
      desc: t("home.actions.linkedin.desc", "احصل على تقييم فوري واقتراحات لتحسين ملفك"),
      href: "/app/profile-analysis", icon: Linkedin, color: "from-[#0077b5] to-[#00a0dc]" },
    { key: "cv", title: t("home.actions.cv.title", "خصّص سيرتك الذاتية"),
      desc: t("home.actions.cv.desc", "أنشئ سيرة ذاتية مُحسّنة لكل وظيفة تتقدم لها"),
      href: "/app/cv", icon: FileText, color: "from-emerald-500 to-teal-600" },
    { key: "campaign", title: t("home.actions.campaign.title", "أطلق حملة جديدة"),
      desc: t("home.actions.campaign.desc", "ابحث عن متخذي القرار وأرسل إيميلات ذكية"),
      href: "/app/campaigns/new", icon: Send, color: "from-[var(--wsl-teal)] to-[var(--wsl-gold)]" },
    { key: "posts", title: t("posts.quickAction", "أنشئ منشور LinkedIn"),
      desc: t("posts.quickActionDesc", "بالذكاء الاصطناعي خلال ثوانٍ"),
      href: "/app/posts", icon: Sparkles, color: "from-[#0A8F84] to-[#0ea5e9]" },
  ];

  const activity: ActivityItem[] = [
    { id: "1", icon: BarChart2, title: t("home.activity.analysis", "تم تحليل ملفك على LinkedIn — النتيجة 87/100"),
      time: t("home.time.hours", "منذ ساعتين"), color: "bg-blue-100 text-blue-600" },
    { id: "2", icon: FileText, title: t("home.activity.cv", "تم إنشاء سيرة ذاتية لوظيفة مدير تسويق"),
      time: t("home.time.today", "اليوم"), color: "bg-emerald-100 text-emerald-600" },
    { id: "3", icon: Send, title: t("home.activity.campaign", "حملة «توسع GCC» أرسلت 120 إيميل"),
      time: t("home.time.yesterday", "أمس"), color: "bg-purple-100 text-purple-600" },
    { id: "4", icon: Coins, title: t("home.activity.tokens", "تم شراء 1000 توكن"),
      time: t("home.time.days", "منذ يومين"), color: "bg-amber-100 text-amber-600" },
    { id: "5", icon: Star, title: t("home.activity.welcome", "مرحباً بك في وصّل — أكمل ملفك لتبدأ"),
      time: t("home.time.week", "منذ أسبوع"), color: "bg-teal-100 text-teal-700" },
  ];

  const chartData = [32, 45, 28, 67, 52, 78, 61];
  const days = isAr
    ? ["السبت","الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة"]
    : ["Sat","Sun","Mon","Tue","Wed","Thu","Fri"];
  const maxVal = Math.max(...chartData);

  return (
    <DashboardLayout>
      <div className="space-y-8 p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name || ""}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full border-2 border-[#0A8F84] shadow-sm object-cover shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#0A8F84]/10 flex items-center justify-center text-[#0A8F84] text-xl font-bold shrink-0" style={{ fontFamily: "Cairo, sans-serif" }}>
              {(name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--wsl-ink)] truncate">
              {greeting}{name ? `، ${name}` : ""} 👋
            </h1>
            <p className="text-gray-500 mt-1">{t("home.subtitle", "إليك نظرة سريعة على نشاطك اليوم")}</p>
          </div>
        </motion.div>

        <motion.div
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {stats.map((s) => <StatCard key={s.key} stat={s} />)}
        </motion.div>

        <div>
          <h2 className="text-lg font-bold text-[var(--wsl-ink)] mb-4">{t("home.quickActions", "إجراءات سريعة")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {actions.map((a, i) => (
              <motion.div key={a.key}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}>
                <Link href={a.href}>
                  <a className="group block rounded-2xl bg-white border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center mb-4 shadow-md`}>
                      <a.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[var(--wsl-ink)] mb-1">{a.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">{a.desc}</p>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-[#0A8F84] group-hover:rotate-45 transition-all shrink-0" />
                    </div>
                  </a>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.45 }}
            className="lg:col-span-2 rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-[var(--wsl-ink)] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#0A8F84]" />
                  {t("home.chart.title", "نشاط آخر 7 أيام")}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{t("home.chart.subtitle", "إجمالي الأنشطة المنفذة")}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-emerald-600 font-semibold">
                <TrendingUp className="w-4 h-4" /> +24%
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 md:gap-4 h-40">
              {chartData.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <motion.div
                    initial={{ height: 0 }} whileInView={{ height: `${(v / maxVal) * 100}%` }}
                    viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
                    className="w-full rounded-t-lg bg-gradient-to-t from-[#0A8F84] to-[#ff8f5e] min-h-[4px]"
                  />
                  <span className="text-xs text-gray-400">{days[i]}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.45, delay: 0.1 }}
            className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
          >
            <h3 className="font-bold text-[var(--wsl-ink)] flex items-center gap-2 mb-5">
              <Clock className="w-5 h-5 text-[#0A8F84]" />
              {t("home.activity.title", "آخر النشاطات")}
            </h3>
            <ul className="space-y-4">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${a.color} flex items-center justify-center shrink-0`}>
                    <a.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--wsl-ink)] leading-snug line-clamp-2">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{a.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const n = useCountUp(stat.value);
  const Icon = stat.icon;
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
      whileHover={{ y: -4 }}
      className={`rounded-2xl p-5 border border-gray-100 bg-gradient-to-br ${stat.gradient} shadow-sm hover:shadow-lg transition-all`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${stat.iconBg} flex items-center justify-center shadow-md`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-xs font-semibold text-emerald-600 bg-white/60 px-2 py-1 rounded-full">
          {stat.delta}
        </span>
      </div>
      <div className="text-3xl font-bold text-[var(--wsl-ink)] tabular-nums">{n.toLocaleString("en-US")}</div>
      <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
    </motion.div>
  );
}

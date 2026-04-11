import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Coins, Zap, Crown, Sparkles, Check, TrendingUp, ArrowDownRight, ArrowUpRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

const packages = [
  { key: "starter", name: "البداية", tokens: 500, price: 49, pop: false, color: "from-blue-500 to-cyan-500", icon: Zap,
    features: ["500 توكن", "صالحة لمدة سنة", "دعم بالبريد"] },
  { key: "pro", name: "المحترف", tokens: 2000, price: 149, pop: true, color: "from-[var(--wsl-teal)] to-[var(--wsl-gold)]", icon: Sparkles,
    features: ["2000 توكن", "خصم 25%", "صالحة لمدة سنة", "دعم أولوية"] },
  { key: "elite", name: "النخبة", tokens: 5000, price: 299, pop: false, color: "from-purple-600 to-fuchsia-600", icon: Crown,
    features: ["5000 توكن", "خصم 40%", "صلاحية دائمة", "مدير حساب مخصص"] },
];

type HistoryItem = { id: string; type: string; desc: string; amount: number; date: string };

export default function Tokens() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState("pro");
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const b = await trpc.token.balance();
        setBalance(b?.balance ?? 0);
      } catch {}
      try {
        const h = await trpc.token.history();
        setHistory(
          (Array.isArray(h) ? h : []).map((r: any) => ({
            id: String(r.id ?? Math.random()),
            type: (r.amount ?? 0) < 0 ? "spend" : "purchase",
            desc: r.description || r.reason || (r.amount < 0 ? "استهلاك" : "إضافة رصيد"),
            amount: Number(r.amount ?? 0),
            date: r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
          }))
        );
      } catch {}
    })();
  }, []);
  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--wsl-ink)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-md">
              <Coins className="w-5 h-5 text-white" />
            </div>
            {t("tk.title", "الرصيد والتوكنز")}
          </h1>
          <p className="text-gray-500 mt-2">{t("tk.subtitle", "أدر رصيدك واشتر باقات جديدة بأسعار الخليج")}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-[var(--wsl-teal)] via-[var(--wsl-teal-dark)] to-[#064E49] text-white p-6 md:p-8 shadow-xl overflow-hidden relative"
        >
          <div className="absolute -top-20 -end-20 w-64 h-64 rounded-full bg-[#0A8F84]/20 blur-3xl" />
          <div className="relative">
            <div className="text-white/70 text-sm mb-2">{t("tk.balance", "رصيدك الحالي")}</div>
            <div className="flex items-baseline gap-2">
              <div className="text-5xl md:text-6xl font-bold tabular-nums">{balance.toLocaleString("en-US")}</div>
              <div className="text-white/60">{t("tk.tokens", "توكن")}</div>
            </div>
            <div className="flex items-center gap-2 mt-4 text-emerald-300 text-sm font-semibold">
              <TrendingUp className="w-4 h-4" /> +1500 {t("tk.thisMonth", "هذا الشهر")}
            </div>
          </div>
        </motion.div>

        <div>
          <h2 className="font-bold text-[var(--wsl-ink)] mb-4">{t("tk.packages", "اختر باقة")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {packages.map((p, i) => {
              const active = selected === p.key;
              return (
                <motion.button
                  key={p.key} onClick={() => setSelected(p.key)} whileHover={{ y: -4 }}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className={`text-start rounded-2xl p-6 border-2 transition-all relative ${active ? "border-[#0A8F84] shadow-xl bg-white" : "border-gray-100 bg-white shadow-sm hover:shadow-lg"} ${p.pop ? "md:-mt-4 md:mb-4" : ""}`}
                >
                  {p.pop && (
                    <div className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 px-3 py-1 rounded-full bg-[#0A8F84] text-white text-xs font-bold shadow-lg">
                      {t("tk.popular", "الأكثر طلبًا")}
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-4 shadow-md`}>
                    <p.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="font-bold text-[var(--wsl-ink)] text-lg">{p.name}</div>
                  <div className="mt-3 mb-4">
                    <span className="text-3xl font-bold text-[var(--wsl-ink)] tabular-nums">{p.price}</span>
                    <span className="text-gray-500 ms-1">SAR</span>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {p.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className={`w-full py-3 rounded-xl font-semibold text-center transition ${active ? "bg-[#0A8F84] text-white shadow-lg shadow-[#0A8F84]/30" : "bg-gray-50 text-gray-700"}`}>
                    {active ? t("tk.selected", "محدّد ✓") : t("tk.select", "اختر")}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
        >
          <h3 className="font-bold text-[var(--wsl-ink)] mb-5">{t("tk.history", "سجل المعاملات")}</h3>
          <ul className="space-y-3">
            {history.map((h) => {
              const isSpend = h.amount < 0;
              return (
                <li key={h.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${isSpend ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"} flex items-center justify-center`}>
                      {isSpend ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--wsl-ink)] text-sm">{h.desc}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{h.date}</div>
                    </div>
                  </div>
                  <div className={`font-bold tabular-nums ${isSpend ? "text-red-500" : "text-emerald-600"}`}>
                    {isSpend ? "" : "+"}{h.amount.toLocaleString("en-US")}
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

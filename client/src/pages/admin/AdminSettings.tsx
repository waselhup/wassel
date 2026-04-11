import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Settings, Save, Flag, DollarSign, Zap } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminSettings() {
  const { t } = useTranslation();
  const [flags, setFlags] = useState({
    linkedinAnalyzer: true,
    cvTailor: true,
    campaigns: true,
    aiMessages: true,
    newSignups: true,
    payments: true,
  });
  const [prices, setPrices] = useState({ starter: 49, pro: 149, elite: 299 });
  const [saved, setSaved] = useState(false);

  const flagKeys = Object.keys(flags) as (keyof typeof flags)[];
  const flagLabels: Record<string, string> = {
    linkedinAnalyzer: "تحليل LinkedIn",
    cvTailor: "تخصيص السيرة",
    campaigns: "الحملات البريدية",
    aiMessages: "رسائل AI",
    newSignups: "تسجيل جديد",
    payments: "المدفوعات",
  };

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-4xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--wsl-ink)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-md">
              <Settings className="w-5 h-5 text-white" />
            </div>
            {t("as.title", "إعدادات النظام")}
          </h1>
          <p className="text-gray-500 mt-2">{t("as.subtitle", "إدارة الميزات والأسعار وبيانات النظام")}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <Flag className="w-5 h-5 text-[#0A8F84]" />
            <h3 className="font-bold text-[var(--wsl-ink)]">{t("as.flags", "الميزات المفعّلة (Feature Flags)")}</h3>
          </div>
          <div className="space-y-3">
            {flagKeys.map((k) => (
              <label key={k} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-semibold text-[var(--wsl-ink)]">{flagLabels[k]}</span>
                </div>
                <button onClick={() => setFlags({ ...flags, [k]: !flags[k] })}
                  className={`relative w-11 h-6 rounded-full transition ${flags[k] ? "bg-[#0A8F84]" : "bg-gray-300"}`}>
                  <motion.span
                    animate={{ x: flags[k] ? 20 : 0 }}
                    className="absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow"
                  />
                </button>
              </label>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <DollarSign className="w-5 h-5 text-[#0A8F84]" />
            <h3 className="font-bold text-[var(--wsl-ink)]">{t("as.prices", "أسعار الباقات (SAR)")}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["starter", "pro", "elite"] as const).map((k) => (
              <div key={k}>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 capitalize">{k}</label>
                <div className="relative">
                  <input type="number" value={prices[k]} onChange={(e) => setPrices({ ...prices, [k]: +e.target.value })}
                    className="w-full px-4 py-3 pe-14 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#0A8F84] focus:outline-none focus:ring-2 focus:ring-[#0A8F84]/20 transition tabular-nums" />
                  <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">SAR</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex justify-end">
          <button onClick={save}
            className="px-6 py-3 rounded-xl bg-[#0A8F84] hover:bg-[#064E49] text-white font-semibold shadow-lg shadow-[#0A8F84]/30 inline-flex items-center gap-2 transition">
            <Save className="w-5 h-5" /> {saved ? t("as.saved", "تم الحفظ ✓") : t("as.save", "حفظ التغييرات")}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

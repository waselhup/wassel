import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Users, DollarSign, Activity, Server, Mail, Database, TrendingUp, TrendingDown, Cpu } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const stats = [
  { key: "users", label: "إجمالي المستخدمين", value: "1,248", delta: "+12%", up: true, icon: Users, color: "from-blue-50 to-cyan-50", iconBg: "bg-blue-500" },
  { key: "mrr", label: "الإيرادات الشهرية", value: "18,450 SAR", delta: "+24%", up: true, icon: DollarSign, color: "from-emerald-50 to-teal-50", iconBg: "bg-emerald-500" },
  { key: "active", label: "نشط اليوم", value: "342", delta: "+8%", up: true, icon: Activity, color: "from-purple-50 to-fuchsia-50", iconBg: "bg-purple-500" },
  { key: "emails", label: "إيميل مُرسل", value: "24,891", delta: "+18%", up: true, icon: Mail, color: "from-amber-50 to-orange-50", iconBg: "bg-amber-500" },
  { key: "api", label: "استدعاءات API", value: "89,234", delta: "-3%", up: false, icon: Server, color: "from-rose-50 to-pink-50", iconBg: "bg-rose-500" },
  { key: "db", label: "حجم قاعدة البيانات", value: "2.4 GB", delta: "+5%", up: true, icon: Database, color: "from-indigo-50 to-violet-50", iconBg: "bg-indigo-500" },
];

const services = [
  { name: "Supabase", status: "operational", latency: "42ms" },
  { name: "Anthropic API", status: "operational", latency: "820ms" },
  { name: "Apify", status: "operational", latency: "1.2s" },
  { name: "Vercel Edge", status: "operational", latency: "18ms" },
  { name: "Moyasar", status: "degraded", latency: "2.8s" },
];

export default function AdminDashboard() {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold mb-2">
            <Cpu className="w-3 h-3" /> {t("adm.admin", "الإدارة")}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e]">{t("adm.title", "لوحة تحكم المشرف")}</h1>
          <p className="text-gray-500 mt-2">{t("adm.subtitle", "نظرة شاملة على صحة المنصة والأداء")}</p>
        </motion.div>

        <motion.div
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {stats.map((s) => (
            <motion.div key={s.key}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -4 }}
              className={`rounded-2xl p-5 border border-gray-100 bg-gradient-to-br ${s.color} shadow-sm hover:shadow-lg transition-all`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl ${s.iconBg} flex items-center justify-center shadow-md`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-white/60 ${s.up ? "text-emerald-600" : "text-red-500"}`}>
                  {s.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {s.delta}
                </span>
              </div>
              <div className="text-2xl font-bold text-[#1a1a2e] tabular-nums">{s.value}</div>
              <div className="text-sm text-gray-600 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-[#1a1a2e]">{t("adm.health", "صحة النظام")}</h3>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {t("adm.allOk", "جميع الأنظمة تعمل")}
            </span>
          </div>
          <ul className="divide-y divide-gray-50">
            {services.map((s) => (
              <li key={s.name} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.status === "operational" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="font-semibold text-[#1a1a2e] text-sm">{s.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 tabular-nums">{s.latency}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.status === "operational" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {s.status === "operational" ? "Operational" : "Degraded"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Mail, Eye, MessageSquare, TrendingUp, Download, Filter, Linkedin } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const stats = [
  { key: "sent", label: "مُرسل", value: 120, pct: "+5%", icon: Mail, color: "from-blue-50 to-cyan-50", iconBg: "bg-blue-500" },
  { key: "open", label: "فتح", value: 78, pct: "65%", icon: Eye, color: "from-emerald-50 to-teal-50", iconBg: "bg-emerald-500" },
  { key: "reply", label: "رد", value: 14, pct: "18%", icon: MessageSquare, color: "from-purple-50 to-fuchsia-50", iconBg: "bg-purple-500" },
  { key: "meet", label: "اجتماع", value: 6, pct: "8%", icon: TrendingUp, color: "from-amber-50 to-orange-50", iconBg: "bg-amber-500" },
];

const rows = [
  { name: "أحمد الراشد", company: "أرامكو", email: "ahmed@aramco.com", status: "replied", ln: "#" },
  { name: "نورة العتيبي", company: "STC", email: "noura@stc.com.sa", status: "opened", ln: "#" },
  { name: "خالد الشمري", company: "SABIC", email: "khalid@sabic.com", status: "meeting", ln: "#" },
  { name: "سارة القحطاني", company: "NEOM", email: "sara@neom.com", status: "opened", ln: "#" },
  { name: "فيصل الدوسري", company: "PIF", email: "faisal@pif.gov.sa", status: "sent", ln: "#" },
];

const statusColors: Record<string, string> = {
  replied: "bg-emerald-50 text-emerald-700",
  opened: "bg-blue-50 text-blue-700",
  sent: "bg-gray-100 text-gray-600",
  meeting: "bg-purple-50 text-purple-700",
};
const statusLabels: Record<string, string> = {
  replied: "رد", opened: "فتح", sent: "مُرسل", meeting: "اجتماع",
};

export default function CampaignReport() {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e]">{t("rep.title", "تقرير الحملة")}</h1>
            <p className="text-gray-500 mt-2">{t("rep.subtitle", "توسّع في السوق السعودي · تم الإطلاق منذ 3 أيام")}</p>
          </div>
          <button className="px-5 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold flex items-center gap-2 transition">
            <Download className="w-4 h-4" /> {t("rep.export", "تصدير CSV")}
          </button>
        </motion.div>

        <motion.div
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {stats.map((s) => (
            <motion.div key={s.key}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              className={`rounded-2xl p-5 border border-gray-100 bg-gradient-to-br ${s.color} shadow-sm`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center shadow-md`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-white/60 px-2 py-1 rounded-full">{s.pct}</span>
              </div>
              <div className="text-3xl font-bold text-[#1a1a2e] tabular-nums">{s.value}</div>
              <div className="text-sm text-gray-600 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-[#1a1a2e]">{t("rep.contacts", "قائمة جهات الاتصال")}</h3>
            <button className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0A8F84] transition">
              <Filter className="w-4 h-4" /> {t("rep.filter", "تصفية")}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs font-semibold text-gray-500 border-b border-gray-100">
                  <th className="pb-3 text-start">{t("rep.name", "الاسم")}</th>
                  <th className="pb-3 text-start">{t("rep.company", "الشركة")}</th>
                  <th className="pb-3 text-start">{t("rep.email", "البريد")}</th>
                  <th className="pb-3 text-start">{t("rep.status", "الحالة")}</th>
                  <th className="pb-3 text-center">LinkedIn</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                    <td className="py-3 font-semibold text-[#1a1a2e]">{r.name}</td>
                    <td className="py-3 text-gray-600">{r.company}</td>
                    <td className="py-3 text-gray-500 ltr-text" dir="ltr">{r.email}</td>
                    <td className="py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[r.status]}`}>
                        {statusLabels[r.status]}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <a href={r.ln} target="_blank" rel="noreferrer" className="inline-flex w-8 h-8 rounded-lg bg-[#0077b5]/10 text-[#0077b5] items-center justify-center hover:bg-[#0077b5] hover:text-white transition">
                        <Linkedin className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

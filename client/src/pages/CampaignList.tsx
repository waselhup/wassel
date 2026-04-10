import { Link } from "wouter";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Send, Plus, Mail, Users, TrendingUp, Clock, CheckCircle2, Pause } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

type Status = "running" | "completed" | "paused" | "draft";

const campaigns = [
  { id: "1", name: "توسّع في السوق السعودي", status: "running" as Status, sent: 120, opens: 78, replies: 14, updated: "منذ ساعتين" },
  { id: "2", name: "شركات التقنية - الرياض", status: "completed" as Status, sent: 200, opens: 145, replies: 32, updated: "أمس" },
  { id: "3", name: "قطاع البنوك GCC", status: "paused" as Status, sent: 85, opens: 51, replies: 9, updated: "منذ 3 أيام" },
  { id: "4", name: "حملة ChatGPT للشركات", status: "draft" as Status, sent: 0, opens: 0, replies: 0, updated: "منذ أسبوع" },
];

const statusMap: Record<Status, { label: string; color: string; icon: any }> = {
  running: { label: "نشطة", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: TrendingUp },
  completed: { label: "مكتملة", color: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  paused: { label: "متوقفة", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Pause },
  draft: { label: "مسودة", color: "bg-gray-50 text-gray-600 border-gray-200", icon: Clock },
};

export default function CampaignList() {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#f7931e] flex items-center justify-center shadow-md">
                <Send className="w-5 h-5 text-white" />
              </div>
              {t("camp.title", "الحملات البريدية")}
            </h1>
            <p className="text-gray-500 mt-2">{t("camp.subtitle", "أدر حملات الإيميل الذكية الخاصة بك في مكان واحد")}</p>
          </div>
          <Link href="/app/campaigns/new">
            <a className="px-5 py-3 rounded-xl bg-[#ff6b35] hover:bg-[#e55a2b] text-white font-semibold shadow-lg shadow-[#ff6b35]/30 flex items-center gap-2 transition-all">
              <Plus className="w-5 h-5" /> {t("camp.new", "حملة جديدة")}
            </a>
          </Link>
        </motion.div>

        <motion.div
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {campaigns.map((c) => {
            const s = statusMap[c.status];
            const openRate = c.sent ? Math.round((c.opens / c.sent) * 100) : 0;
            return (
              <motion.div key={c.id}
                variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                whileHover={{ y: -4 }}
              >
                <Link href={`/app/campaigns/${c.id}`}>
                  <a className="block rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl p-6 transition-all">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <h3 className="font-bold text-[#1a1a2e] text-lg">{c.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${s.color}`}>
                        <s.icon className="w-3 h-3" /> {s.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 py-4 border-y border-gray-100">
                      <Metric icon={Mail} value={c.sent} label="مُرسل" />
                      <Metric icon={Users} value={c.opens} label="فتح" />
                      <Metric icon={TrendingUp} value={c.replies} label="رد" />
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-xs text-gray-400">{c.updated}</div>
                      <div className="text-sm font-semibold text-[#ff6b35]">{openRate}% فتح</div>
                    </div>
                  </a>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function Metric({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 text-gray-400 mx-auto mb-1" />
      <div className="text-xl font-bold text-[#1a1a2e] tabular-nums">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

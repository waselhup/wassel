import { Link } from "wouter";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Send, Plus, Mail, Users, TrendingUp, Clock, CheckCircle2, Pause, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpcQuery } from "@/lib/trpc";
import { useEffect, useState } from "react";

type Status = "running" | "completed" | "paused" | "draft";

interface Campaign {
  id: string;
  campaign_name: string;
  status: Status;
  total_recipients: number;
  emails_sent: number;
  opens_count: number;
  replies_count: number;
  created_at: string;
  completed_at: string | null;
}

const statusMap: Record<Status, { labelKey: string; color: string; icon: any }> = {
  running: { labelKey: "camp.statusRunning", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: TrendingUp },
  completed: { labelKey: "camp.statusCompleted", color: "bg-blue-50 text-blue-700 border-blue-200", icon: CheckCircle2 },
  paused: { labelKey: "camp.statusPaused", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Pause },
  draft: { labelKey: "camp.statusDraft", color: "bg-gray-50 text-gray-600 border-gray-200", icon: Clock },
};
export default function CampaignList() {
  const { t } = useTranslation();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trpcQuery<Campaign[]>("campaign.list")
      .then((data) => setCampaigns(data || []))
      .catch((err) => console.error("[CampaignList] fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--wsl-ink)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--wsl-teal)] to-[var(--wsl-gold)] flex items-center justify-center shadow-md">
                <Send className="w-5 h-5 text-white" />
              </div>
              {t("camp.title", "حملات البريد الإلكتروني")}
            </h1>
            <p className="text-gray-500 mt-2">{t("camp.subtitle", "أدر حملاتك البريدية والتواصل مع العملاء من مكان واحد")}</p>
          </div>
          <Link href="/app/campaigns/new">
            <a className="px-5 py-3 rounded-xl bg-[#0A8F84] hover:bg-[#064E49] text-white font-semibold shadow-lg shadow-[#0A8F84]/30 flex items-center gap-2 transition-all">
              <Plus className="w-5 h-5" /> {t("camp.new", "حملة جديدة")}
            </a>
          </Link>
        </motion.div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#0A8F84]" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Send className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">{t("camp.empty", "لا توجد حملات بعد")}</p>
            <p className="text-sm mt-1">{t("camp.emptyDesc", "أنشئ أول حملة بريدية للتواصل مع العملاء")}</p>
          </div>
        ) : (
          <motion.div
            initial="hidden" animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {campaigns.map((c) => {
              const s = statusMap[c.status] || statusMap.draft;
              const openRate = c.emails_sent ? Math.round((c.opens_count / c.emails_sent) * 100) : 0;
              return (
                <motion.div key={c.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                  whileHover={{ y: -4 }}
                >
                  <Link href={`/app/campaigns/${c.id}`}>
                    <a className="block rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl p-6 transition-all">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <h3 className="font-bold text-[var(--wsl-ink)] text-lg">{c.campaign_name}</h3>                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${s.color}`}>
                          <s.icon className="w-3 h-3" /> {t(s.labelKey)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 py-4 border-y border-gray-100">
                        <Metric icon={Mail} value={c.emails_sent || 0} label={t("camp.sent", "مُرسل")} />
                        <Metric icon={Users} value={c.opens_count || 0} label={t("camp.opens", "فتح")} />
                        <Metric icon={TrendingUp} value={c.replies_count || 0} label={t("camp.replies", "رد")} />
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="text-xs text-gray-400">{c.completed_at ? new Date(c.completed_at).toLocaleDateString('ar-SA') : new Date(c.created_at).toLocaleDateString('ar-SA')}</div>
                        <div className="text-sm font-semibold text-[#0A8F84]">{openRate}% {t("camp.openRate", "فتح")}</div>
                      </div>
                    </a>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Metric({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 text-gray-400 mx-auto mb-1" />
      <div className="text-xl font-bold text-[var(--wsl-ink)] tabular-nums">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
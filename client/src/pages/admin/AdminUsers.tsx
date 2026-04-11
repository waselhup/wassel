import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Search, Filter, MoreVertical, UserPlus, Coins, CheckCircle2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const users = [
  { id: "1", name: "أحمد الراشد", email: "ahmed@example.com", plan: "Pro", tokens: 2450, status: "active", joined: "2025-11-12" },
  { id: "2", name: "نورة العتيبي", email: "noura@example.com", plan: "Free", tokens: 120, status: "active", joined: "2026-01-04" },
  { id: "3", name: "خالد الشمري", email: "khalid@example.com", plan: "Elite", tokens: 4200, status: "active", joined: "2025-09-22" },
  { id: "4", name: "سارة القحطاني", email: "sara@example.com", plan: "Pro", tokens: 890, status: "banned", joined: "2025-12-01" },
  { id: "5", name: "فيصل الدوسري", email: "faisal@example.com", plan: "Free", tokens: 50, status: "active", joined: "2026-02-14" },
];

export default function AdminUsers() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [addAmt, setAddAmt] = useState(500);

  const filtered = users.filter((u) =>
    u.name.includes(q) || u.email.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--wsl-ink)]">{t("au.title", "المستخدمون")}</h1>
            <p className="text-gray-500 mt-2">{t("au.subtitle", "إدارة حسابات المستخدمين والتوكنز")}</p>
          </div>
          <button className="px-5 py-3 rounded-xl bg-[#0A8F84] hover:bg-[#064E49] text-white font-semibold shadow-lg shadow-[#0A8F84]/30 flex items-center gap-2 transition">
            <UserPlus className="w-5 h-5" /> {t("au.add", "إضافة مستخدم")}
          </button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
          <div className="flex flex-col md:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("au.search", "ابحث بالاسم أو البريد...")}
                className="w-full ps-10 pe-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#0A8F84] focus:outline-none focus:ring-2 focus:ring-[#0A8F84]/20 transition" />
            </div>
            <button className="px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold flex items-center gap-2 transition">
              <Filter className="w-4 h-4" /> {t("au.filter", "تصفية")}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs font-semibold text-gray-500 border-b border-gray-100">
                  <th className="pb-3 text-start">{t("au.name", "الاسم")}</th>
                  <th className="pb-3 text-start">{t("au.plan", "الخطة")}</th>
                  <th className="pb-3 text-start">{t("au.tokens", "التوكنز")}</th>
                  <th className="pb-3 text-start">{t("au.status", "الحالة")}</th>
                  <th className="pb-3 text-start">{t("au.joined", "انضم")}</th>
                  <th className="pb-3 text-end">{t("au.actions", "")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition">
                    <td className="py-3">
                      <div className="font-semibold text-[var(--wsl-ink)]">{u.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5" dir="ltr">{u.email}</div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.plan === "Free" ? "bg-gray-100 text-gray-600" : u.plan === "Pro" ? "bg-teal-50 text-[#0A8F84]" : "bg-purple-50 text-purple-700"}`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-[var(--wsl-ink)] tabular-nums">{u.tokens.toLocaleString("en-US")}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${u.status === "active" ? "text-emerald-600" : "text-red-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                        {u.status === "active" ? t("au.active", "نشط") : t("au.banned", "محظور")}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-gray-500 tabular-nums" dir="ltr">{u.joined}</td>
                    <td className="py-3 text-end">
                      <button onClick={() => setModal(u.id)} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#0A8F84] inline-flex items-center justify-center transition">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setModal(null)}
          >
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[var(--wsl-ink)] text-lg">{t("au.addTokens", "إضافة توكنز")}</h3>
                <button onClick={() => setModal(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 inline-flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t("au.amount", "الكمية")}</label>
              <div className="relative">
                <Coins className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                <input type="number" value={addAmt} onChange={(e) => setAddAmt(+e.target.value)}
                  className="w-full ps-10 pe-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#0A8F84] focus:outline-none focus:ring-2 focus:ring-[#0A8F84]/20 transition" />
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition">
                  {t("au.cancel", "إلغاء")}
                </button>
                <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-xl bg-[#0A8F84] hover:bg-[#064E49] text-white font-semibold shadow-lg shadow-[#0A8F84]/30 inline-flex items-center justify-center gap-2 transition">
                  <CheckCircle2 className="w-4 h-4" /> {t("au.confirm", "تأكيد")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

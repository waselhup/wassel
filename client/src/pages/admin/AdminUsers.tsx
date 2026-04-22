import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  Search, MoreVertical, Coins, CheckCircle2, X, AlertTriangle, RefreshCw,
  Ban, ShieldCheck, Users as UsersIcon, Activity, Sparkles, Award,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";

interface Toast { id: number; type: "success" | "error"; message: string; }
interface AdminUser {
  id: string;
  email: string | null;
  full_name: string | null;
  plan: "free" | "starter" | "pro" | "elite" | string;
  token_balance: number;
  is_banned: boolean;
  is_admin?: boolean;
  created_at: string;
  avatar_url: string | null;
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const View = () => (
    <div style={{ position: "fixed", top: 20, insetInlineEnd: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 40 }}
            style={{
              padding: "12px 18px", borderRadius: 12, minWidth: 280,
              background: t.type === "success" ? "#ECFDF5" : "#FEF2F2",
              color: t.type === "success" ? "#065F46" : "#991B1B",
              border: `1px solid ${t.type === "success" ? "#A7F3D0" : "#FECACA"}`,
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              fontFamily: "Cairo, Inter, sans-serif", fontWeight: 700, fontSize: 13,
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            {t.type === "success" ? <CheckCircle2 size={16} /> : <X size={16} />}
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, View };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return "-";
  }
}

function initials(name: string | null, email: string | null): string {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return v;
}

const PRESET_AMOUNTS = [100, 500, 1000, 2500];

export default function AdminUsers() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const toast = useToast();

  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<{ totalUsers: number; activeUsers: number; tokensPurchased: number; mrr: number } | null>(null);

  const [grantModal, setGrantModal] = useState<AdminUser | null>(null);
  const [grantAmount, setGrantAmount] = useState(500);
  const [grantReason, setGrantReason] = useState("");
  const [grantSubmitting, setGrantSubmitting] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const isAdmin = !!profile?.is_admin;

  const fetchUsers = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await trpc.admin.users(search ? { search } : undefined);
      setUsers(data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const s = await trpc.admin.stats();
      setStats(s);
    } catch {
      // silent — stats are nice-to-have
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers(debouncedQ);
  }, [debouncedQ, isAdmin, fetchUsers]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchStats();
  }, [isAdmin, fetchStats]);

  const paidUsers = useMemo(
    () => users.filter((u) => u.plan && u.plan !== "free").length,
    [users]
  );

  async function handleGrant() {
    if (!grantModal) return;
    const amount = Math.floor(grantAmount);
    const reason = grantReason.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.push("error", t("au.errAmount", "الكمية يجب أن تكون أكبر من صفر"));
      return;
    }
    if (reason.length < 3) {
      toast.push("error", t("au.errReason", "السبب مطلوب (3 أحرف على الأقل)"));
      return;
    }
    setGrantSubmitting(true);
    try {
      await trpc.admin.addTokens({
        userId: grantModal.id,
        amount,
        reason,
      });
      const name = grantModal.full_name || grantModal.email || "";
      toast.push(
        "success",
        t("au.grantSuccess", "تمت إضافة {{amount}} توكن لـ {{name}}", {
          amount: amount.toLocaleString("en-US"),
          name,
        })
      );
      setGrantModal(null);
      setGrantReason("");
      setGrantAmount(500);
      fetchUsers(debouncedQ);
      fetchStats();
    } catch (e: any) {
      toast.push("error", e?.message || t("au.grantFail", "فشلت إضافة التوكنز"));
    } finally {
      setGrantSubmitting(false);
    }
  }

  async function handleToggleBan(u: AdminUser) {
    const willBan = !u.is_banned;
    if (willBan) {
      const ok = window.confirm(
        t("au.confirmBan", "هل أنت متأكد من حظر {{name}}؟", {
          name: u.full_name || u.email || "",
        })
      );
      if (!ok) return;
    }
    try {
      const res = await trpc.admin.toggleBan({ userId: u.id });
      toast.push(
        "success",
        res.banned
          ? t("au.bannedNow", "تم حظر المستخدم")
          : t("au.unbannedNow", "تم إلغاء الحظر")
      );
      setOpenMenuId(null);
      fetchUsers(debouncedQ);
    } catch (e: any) {
      toast.push("error", e?.message || t("au.banFail", "فشل تحديث الحالة"));
    }
  }

  // Safety rail — non-admin lands here
  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-8 max-w-xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 inline-flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--wsl-ink)] mb-2">
            {t("au.notAuthorized", "غير مصرح")}
          </h1>
          <p className="text-gray-500 mb-6">
            {t("au.notAuthorizedDesc", "هذه الصفحة مخصصة للمشرفين فقط")}
          </p>
          <Link href="/app">
            <a className="inline-block px-5 py-3 rounded-xl bg-[#14b8a6] text-white font-semibold shadow-lg shadow-[#14b8a6]/30 hover:bg-[#0f766e] transition">
              {t("au.backToApp", "العودة للتطبيق")}
            </a>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <toast.View />
      <div className="p-6 md:p-8 max-w-6xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--wsl-ink)]">
              {t("au.title", "المستخدمون")}
            </h1>
            <p className="text-gray-500 mt-2">
              {t("au.subtitle", "إدارة حسابات المستخدمين والتوكنز")}
            </p>
          </div>
          <button
            onClick={() => {
              fetchUsers(debouncedQ);
              fetchStats();
            }}
            className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className="w-4 h-4" /> {t("au.refresh", "تحديث")}
          </button>
        </motion.div>

        {/* Stats cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <StatCard
            icon={<UsersIcon className="w-5 h-5" />}
            label={t("au.stat.total", "إجمالي المستخدمين")}
            value={stats?.totalUsers ?? null}
            tint="teal"
          />
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label={t("au.stat.active", "نشط (7 أيام)")}
            value={stats?.activeUsers ?? null}
            tint="emerald"
          />
          <StatCard
            icon={<Sparkles className="w-5 h-5" />}
            label={t("au.stat.paid", "مشتركون مدفوع")}
            value={paidUsers}
            tint="purple"
          />
          <StatCard
            icon={<Award className="w-5 h-5" />}
            label={t("au.stat.tokens", "إجمالي التوكنز الممنوحة")}
            value={stats?.tokensPurchased ?? null}
            tint="amber"
          />
        </motion.div>

        {/* Main table card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
        >
          <div className="flex flex-col md:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("au.search", "ابحث بالاسم أو البريد...")}
                className="w-full ps-10 pe-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#14b8a6] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/20 transition"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-700">
                  {t("au.errorTitle", "حدث خطأ")}
                </p>
                <p className="text-sm text-red-600 mt-1" dir="ltr">
                  {error}
                </p>
              </div>
              <button
                onClick={() => fetchUsers(debouncedQ)}
                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold"
              >
                {t("au.retry", "إعادة المحاولة")}
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-500 border-b border-gray-100">
                  <th className="pb-3 text-start">{t("au.name", "الاسم")}</th>
                  <th className="pb-3 text-start">{t("au.plan", "الخطة")}</th>
                  <th className="pb-3 text-start">{t("au.tokens", "التوكنز")}</th>
                  <th className="pb-3 text-start">{t("au.status", "الحالة")}</th>
                  <th className="pb-3 text-start">{t("au.joined", "انضم")}</th>
                  <th className="pb-3 text-end">{t("au.actions", "")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="border-b border-gray-50 last:border-0">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="py-4">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? "70%" : j === 5 ? "30%" : "50%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="inline-flex flex-col items-center gap-2 text-gray-500">
                        <UsersIcon className="w-10 h-10 text-gray-300" />
                        <p className="font-semibold">
                          {debouncedQ
                            ? t("au.noResults", "لا نتائج لـ '{{q}}'", { q: debouncedQ })
                            : t("au.empty", "لا يوجد مستخدمون بعد")}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 text-[#14b8a6] font-bold text-xs inline-flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              initials(u.full_name, u.email)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--wsl-ink)] flex items-center gap-1.5">
                              {u.full_name || t("au.noName", "—")}
                              {u.is_admin && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-purple-50 text-purple-700 font-bold">
                                  {t("au.adminBadge", "مشرف")}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]" dir="ltr">
                              {u.email || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <PlanBadge plan={u.plan} />
                      </td>
                      <td className="py-3 font-semibold text-[var(--wsl-ink)] tabular-nums" dir="ltr">
                        {(u.token_balance || 0).toLocaleString("en-US")}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            u.is_banned ? "text-red-500" : "text-emerald-600"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.is_banned ? "bg-red-500" : "bg-emerald-500"
                            }`}
                          />
                          {u.is_banned
                            ? t("au.banned", "محظور")
                            : t("au.active", "نشط")}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-gray-500 tabular-nums" dir="ltr">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="py-3 text-end">
                        <div className="relative inline-block">
                          <button
                            onClick={() =>
                              setOpenMenuId(openMenuId === u.id ? null : u.id)
                            }
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#14b8a6] inline-flex items-center justify-center transition"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuId === u.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div className="absolute end-0 mt-1 w-48 rounded-xl bg-white border border-gray-100 shadow-xl py-1 z-20">
                                <button
                                  onClick={() => {
                                    setGrantModal(u);
                                    setGrantAmount(500);
                                    setGrantReason("");
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-start px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                >
                                  <Coins className="w-4 h-4 text-amber-500" />
                                  {t("au.grantTokens", "منح توكنز")}
                                </button>
                                <button
                                  onClick={() => handleToggleBan(u)}
                                  className={`w-full text-start px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                                    u.is_banned ? "text-emerald-600" : "text-red-600"
                                  }`}
                                >
                                  {u.is_banned ? (
                                    <>
                                      <ShieldCheck className="w-4 h-4" />
                                      {t("au.unban", "إلغاء الحظر")}
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-4 h-4" />
                                      {t("au.ban", "حظر")}
                                    </>
                                  )}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Grant Tokens Modal */}
      {grantModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => !grantSubmitting && setGrantModal(null)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[var(--wsl-ink)] text-lg">
                {t("au.grantTitle", "منح توكنز")}
              </h3>
              <button
                onClick={() => !grantSubmitting && setGrantModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 inline-flex items-center justify-center"
                disabled={grantSubmitting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="font-semibold text-[var(--wsl-ink)]">
                {grantModal.full_name || t("au.noName", "—")}
              </div>
              <div className="text-xs text-gray-500 mt-1" dir="ltr">
                {grantModal.email || "—"}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {t("au.currentBalance", "الرصيد الحالي")}:{" "}
                <span className="font-bold text-[var(--wsl-ink)] tabular-nums" dir="ltr">
                  {(grantModal.token_balance || 0).toLocaleString("en-US")}
                </span>
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              {t("au.amount", "الكمية")}
            </label>
            <div className="relative mb-2">
              <Coins className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
              <input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(+e.target.value)}
                min={1}
                className="w-full ps-10 pe-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#14b8a6] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/20 transition tabular-nums"
                dir="ltr"
                disabled={grantSubmitting}
              />
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {PRESET_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setGrantAmount(a)}
                  disabled={grantSubmitting}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition tabular-nums ${
                    grantAmount === a
                      ? "bg-[#14b8a6] text-white border-[#14b8a6]"
                      : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                  }`}
                  dir="ltr"
                >
                  {a.toLocaleString("en-US")}
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              {t("au.reason", "السبب")} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              rows={3}
              placeholder={t("au.reasonPh", "مكافأة بيتا، دعم، ترقية، إلخ...")}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#14b8a6] focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/20 transition resize-none"
              disabled={grantSubmitting}
            />

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => !grantSubmitting && setGrantModal(null)}
                disabled={grantSubmitting}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition disabled:opacity-50"
              >
                {t("au.cancel", "إلغاء")}
              </button>
              <button
                onClick={handleGrant}
                disabled={grantSubmitting}
                className="flex-1 py-3 rounded-xl bg-[#14b8a6] hover:bg-[#0f766e] text-white font-semibold shadow-lg shadow-[#14b8a6]/30 inline-flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {grantSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {grantSubmitting ? t("au.granting", "جاري...") : t("au.confirmGrant", "تأكيد")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </DashboardLayout>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const label = plan || "free";
  const tint =
    label === "elite"
      ? "bg-purple-50 text-purple-700"
      : label === "pro"
      ? "bg-teal-50 text-[#14b8a6]"
      : label === "starter"
      ? "bg-blue-50 text-blue-700"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${tint}`}>
      {label}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  tint: "teal" | "emerald" | "purple" | "amber";
}) {
  const tintMap: Record<string, string> = {
    teal: "bg-teal-50 text-[#14b8a6]",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl inline-flex items-center justify-center ${tintMap[tint]}`}>
          {icon}
        </div>
      </div>
      <div className="text-xs text-gray-500 font-semibold">{label}</div>
      <div className="text-2xl font-bold text-[var(--wsl-ink)] mt-1 tabular-nums" dir="ltr">
        {value === null ? (
          <span className="inline-block w-12 h-7 bg-gray-100 rounded animate-pulse" />
        ) : (
          value.toLocaleString("en-US")
        )}
      </div>
    </div>
  );
}

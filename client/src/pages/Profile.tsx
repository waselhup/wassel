import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { User, Mail, Phone, MapPin, Briefcase, Linkedin, Save, Camera } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function Profile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: (user?.user_metadata?.name as string) || "",
    email: user?.email || "",
    phone: "",
    city: "الرياض",
    role: "",
    company: "",
    linkedin: "",
    bio: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const filled = Object.values(form).filter(Boolean).length;
  const total = Object.keys(form).length;
  const pct = Math.round((filled / total) * 100);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const initials = form.name
    ? form.name.split(" ").map((w) => w[0]).slice(0, 2).join("")
    : (user?.email?.[0] || "W").toUpperCase();

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-5xl space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e]">{t("pr.title", "الملف الشخصي")}</h1>
          <p className="text-gray-500 mt-2">{t("pr.subtitle", "أكمل بياناتك لتحصل على نتائج أفضل من وصّل")}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 h-fit"
          >
            <div className="flex flex-col items-center">
              <CompletenessRing pct={pct}>
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#f7931e] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {initials}
                </div>
              </CompletenessRing>
              <button className="mt-3 text-xs font-semibold text-[#ff6b35] inline-flex items-center gap-1 hover:underline">
                <Camera className="w-3 h-3" /> {t("pr.changePhoto", "تغيير الصورة")}
              </button>
              <div className="font-bold text-[#1a1a2e] mt-4">{form.name || t("pr.noName", "لم يُضف اسم")}</div>
              <div className="text-xs text-gray-400 mt-1" dir="ltr">{form.email}</div>
              <div className="mt-5 w-full pt-5 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">{t("pr.completeness", "اكتمال الملف")}</span>
                  <span className="font-bold text-[#ff6b35]">{pct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-[#ff6b35] to-[#f7931e]" />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldIcon icon={User} label={t("pr.name", "الاسم الكامل")}>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} className={cls} />
              </FieldIcon>
              <FieldIcon icon={Mail} label={t("pr.email", "البريد الإلكتروني")}>
                <input value={form.email} disabled className={cls + " opacity-60"} dir="ltr" />
              </FieldIcon>
              <FieldIcon icon={Phone} label={t("pr.phone", "رقم الجوال")}>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+966 5X XXX XXXX" className={cls} dir="ltr" />
              </FieldIcon>
              <FieldIcon icon={MapPin} label={t("pr.city", "المدينة")}>
                <select value={form.city} onChange={(e) => set("city", e.target.value)} className={cls}>
                  <option>الرياض</option><option>جدة</option><option>الدمام</option><option>مكة</option><option>المدينة</option><option>الأحساء</option>
                </select>
              </FieldIcon>
              <FieldIcon icon={Briefcase} label={t("pr.role", "المسمى الوظيفي")}>
                <input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder={t("pr.rolePh", "مدير تسويق رقمي")} className={cls} />
              </FieldIcon>
              <FieldIcon icon={Briefcase} label={t("pr.company", "الشركة")}>
                <input value={form.company} onChange={(e) => set("company", e.target.value)} className={cls} />
              </FieldIcon>
            </div>
            <FieldIcon icon={Linkedin} label={t("pr.linkedin", "رابط LinkedIn")}>
              <input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." className={cls} dir="ltr" />
            </FieldIcon>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t("pr.bio", "نبذة عنك")}</label>
              <textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={4} placeholder={t("pr.bioPh", "اكتب نبذة قصيرة عن خبراتك واهتماماتك...")}
                className={cls + " resize-none"} />
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={save}
                className="px-6 py-3 rounded-xl bg-[#ff6b35] hover:bg-[#e55a2b] text-white font-semibold shadow-lg shadow-[#ff6b35]/30 inline-flex items-center gap-2 transition">
                <Save className="w-5 h-5" /> {saved ? t("pr.saved", "تم الحفظ ✓") : t("pr.save", "حفظ")}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

const cls = "w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#ff6b35] focus:outline-none focus:ring-2 focus:ring-[#ff6b35]/20 transition";

function FieldIcon({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-gray-400" /> {label}
      </label>
      {children}
    </div>
  );
}

function CompletenessRing({ pct, children }: { pct: number; children: React.ReactNode }) {
  const r = 50, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} stroke="#f3f4f6" strokeWidth="7" fill="none" />
        <motion.circle cx="60" cy="60" r={r} stroke="#ff6b35" strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: off }} transition={{ duration: 1.2, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

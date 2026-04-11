ï»¿import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FileText, Download, Sparkles, Loader2, CheckCircle2, Briefcase, Target, Palette, Upload } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

type Template = "modern" | "classic" | "creative";

export default function CVTailor() {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<Template>("modern");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [form, setForm] = useState({
    jobTitle: "", company: "", jobDescription: "",
    name: "", email: "", phone: "",
    currentRole: "", experience: "", skills: "",
    education: "", achievements: "", languages: "",
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setError(null);
    try {
      // Read file as base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1] || result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await trpc.cv.parseUpload(base64, file.name);
      
      // Auto-fill form with extracted data
      setForm(prev => ({
        ...prev,
        name: result.name || prev.name,
        email: result.email || prev.email,
        phone: result.phone || prev.phone,
        currentRole: result.currentRole || prev.currentRole,
        experience: result.experience || prev.experience,
        skills: result.skills || prev.skills,
        education: result.education || prev.education,
        achievements: result.achievements || prev.achievements,
        languages: result.languages || prev.languages,
      }));
    } catch (e: any) {
      setError(e?.message || t("cv.uploadError", "Failed to upload file"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const fields = [
    { key: "jobTitle", label: t("cv.f.jobTitle", "الوظيفة المستهدفة"), ph: t("cv.ph.jobTitle", "مدير تسويق رقمي") },
    { key: "company", label: t("cv.f.company", "اسم الشركة"), ph: t("cv.ph.company", "أرامكو السعودية") },
    { key: "jobDescription", label: t("cv.f.jobDesc", "وصف الوظيفة"), ph: t("cv.ph.jobDesc", "ألصق نص الوصف الوظيفي"), full: true },
    { key: "name", label: t("cv.f.name", "الاسم الكامل"), ph: t("cv.ph.name", "أحمد محمد الراشد") },
    { key: "email", label: t("cv.f.email", "البريد الإلكتروني"), ph: "ahmed@example.com" },
    { key: "phone", label: t("cv.f.phone", "رقم الجوال"), ph: "+966 5X XXX XXXX" },
    { key: "currentRole", label: t("cv.f.currentRole", "المنصب الحالي"), ph: t("cv.ph.currentRole", "أخصائي تسويق") },
    { key: "experience", label: t("cv.f.exp", "سنوات الخبرة"), ph: "5" },
    { key: "skills", label: t("cv.f.skills", "المهارات"), ph: t("cv.ph.skills", "Google Ads, SEO, Analytics") },
    { key: "education", label: t("cv.f.edu", "المؤهل العلمي"), ph: t("cv.ph.edu", "بكالوريوس إدارة أعمال") },
    { key: "achievements", label: t("cv.f.ach", "أبرز الإنجازات"), ph: t("cv.ph.ach", "زيادة المبيعات 40% في 2024"), full: true },
    { key: "languages", label: t("cv.f.lang", "اللغات"), ph: t("cv.ph.lang", "العربية، الإنجليزية") },
  ];

  const templates: { key: Template; name: string; desc: string; color: string; icon: any }[] = [
    { key: "modern", name: t("cv.t.modern", "عصري"), desc: t("cv.t.modernD", "تصميم نظيف بألوان جريئة"), color: "from-[#ff6b35] to-[#f7931e]", icon: Sparkles },
    { key: "classic", name: t("cv.t.classic", "كلاسيكي"), desc: t("cv.t.classicD", "احترافي وملائم للقطاعات الرسمية"), color: "from-[#1e3a5f] to-[#2c5282]", icon: Briefcase },
    { key: "creative", name: t("cv.t.creative", "إبداعي"), desc: t("cv.t.creativeD", "مميز للأدوار التصميمية والتسويقية"), color: "from-purple-600 to-fuchsia-600", icon: Palette },
  ];

  async function generate() {
    if (!form.jobTitle.trim()) {
      setError(t("cv.err.noTitle", "أدخل الوظيفة المستهدفة أولاً"));
      return;
    }
    setLoading(true); setDone(false); setError(null); setVersions([]);
    try {
      // Send job title as the field, with full context
      const fields = [form.jobTitle];
      const context = {
        name: form.name,
        jobTitle: form.jobTitle,
        company: form.company,
        jobDescription: form.jobDescription,
        currentRole: form.currentRole,
        experience: form.experience,
        skills: form.skills,
        education: form.education,
        achievements: form.achievements,
        languages: form.languages,
      };
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 60000)
      );
      const result = await Promise.race([
        trpc.cv.generate(fields, context),
        timeoutPromise,
      ]) as { versions: any[]; tokensRemaining: number };
      setVersions(Array.isArray(result?.versions) ? result.versions : []);
      setDone(true);
    } catch (e: any) {
      if (e?.message === 'timeout') {
        setError('انتهت المهلة (60 ثانية). حاول مرة أخرى.');
      } else {
        setError(e?.message || t("cv.err.failed", "فشل الإنشاء. حاول مرة أخرى."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout pageTitle={t('cvTailor.title')}>
      <div className="p-6 md:p-8 space-y-8 max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-[#1a1a2e] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 text-white" />
            </div>
            {t("cv.title", "تخصيص السيرة الذاتية")}
          </h1>
          <p className="text-gray-500 mt-2">{t("cv.subtitle", "أدخل بياناتك واختر قالبًا، وسنولّد لك سيرة ذاتية مُحسّنة بالذكاء الاصطناعي")}</p>
        </motion.div>


        {/* File Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-6"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-[#1a1a2e] flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                {t("cv.uploadCV", "Upload My CV")}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{t("cv.acceptedFormats", "Accepted: PDF, DOCX, TXT")}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.doc"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all"
            >
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {uploading ? t("cv.uploading", "Uploading...") : t("cv.uploadCV", "Upload My CV")}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 md:p-8"
        >
          <div className="flex items-center gap-2 mb-5">
            <Target className="w-5 h-5 text-[#ff6b35]" />
            <h2 className="font-bold text-[#1a1a2e]">{t("cv.info", "معلوماتك")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map((f) => (
              <div key={f.key} className={f.full ? "md:col-span-2 lg:col-span-3" : ""}>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{f.label}</label>
                {f.full ? (
                  <textarea
                    value={(form as any)[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.ph} rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#ff6b35] focus:outline-none focus:ring-2 focus:ring-[#ff6b35]/20 transition resize-none"
                  />
                ) : (
                  <input
                    value={(form as any)[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.ph}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#ff6b35] focus:outline-none focus:ring-2 focus:ring-[#ff6b35]/20 transition"
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div>
          <h2 className="font-bold text-[#1a1a2e] mb-4">{t("cv.chooseTemplate", "اختر القالب")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {templates.map((tpl) => {
              const active = template === tpl.key;
              return (
                <motion.button
                  key={tpl.key} onClick={() => setTemplate(tpl.key)} whileHover={{ y: -4 }}
                  className={`text-start rounded-2xl p-5 border-2 transition-all ${active ? "border-[#ff6b35] shadow-xl bg-white" : "border-gray-100 bg-white shadow-sm hover:shadow-lg"}`}
                >
                  <div className={`w-full h-32 rounded-xl bg-gradient-to-br ${tpl.color} mb-4 flex items-center justify-center relative overflow-hidden`}>
                    <tpl.icon className="w-12 h-12 text-white/90" />
                    {active && (
                      <motion.div layoutId="cvCheck" className="absolute top-2 end-2 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow">
                        <CheckCircle2 className="w-5 h-5 text-[#ff6b35]" />
                      </motion.div>
                    )}
                  </div>
                  <div className="font-bold text-[#1a1a2e]">{tpl.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{tpl.desc}</div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-4 text-sm">{error}</div>
        )}

        {versions.length > 0 && (
          <div className="space-y-6">
            <h3 className="font-bold text-[#1a1a2e] text-lg">{t("cv.versions", "النسخ المُنشأة")}</h3>
            {versions.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2c5282] px-5 py-3">
                  <h4 className="text-white font-bold text-lg">{v.headline || v.fieldName || form.jobTitle}</h4>
                  <p className="text-white/70 text-sm mt-1">{v.fieldName || `Version ${i + 1}`}</p>
                </div>
                <div className="p-4 space-y-4">
                  {v.summary && (
                    <div>
                      <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">{t("cv.section.summary", "الملخص المهني")}</h5>
                      <p className="text-sm text-gray-700 leading-relaxed">{v.summary}</p>
                    </div>
                  )}
                  {v.skills && v.skills.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">{t("cv.section.skills", "المهارات")}</h5>
                      <div className="flex flex-wrap gap-2">
                        {v.skills.map((s: string, si: number) => (
                          <span key={si} className="px-3 py-1 rounded-full bg-orange-50 text-[#ff6b35] text-xs font-semibold border border-orange-200">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {v.experience && v.experience.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-gray-400 uppercase mb-3">{t("cv.section.experience", "الخبرات")}</h5>
                      <div className="space-y-3">
                        {v.experience.map((exp: any, ei: number) => (
                          <div key={ei} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-[#1a1a2e] text-sm">{exp.title}</span>
                              <span className="text-xs text-gray-400">{exp.duration}</span>
                            </div>
                            <span className="text-xs text-[#ff6b35] font-medium">{exp.company}</span>
                            <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{exp.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2c5282] p-6 md:p-8 shadow-lg">
          <div className="text-white">
            <h3 className="font-bold text-lg">{t("cv.ready", "جاهز للإنشاء؟")}</h3>
            <p className="text-white/70 text-sm mt-1">{t("cv.cost", "يستخدم 10 رموز لكل سيرة ذاتية")}</p>
          </div>
          <div className="flex gap-3">
            {done && (
              <button onClick={() => window.print()} className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-2 transition">
                <Download className="w-5 h-5" /> {t("cv.downloadPDF", "Download PDF")}
              </button>
            )}
            <button onClick={generate} disabled={loading}
              className="px-6 py-3 rounded-xl bg-[#ff6b35] hover:bg-[#e55a2b] disabled:opacity-50 text-white font-semibold shadow-lg shadow-[#ff6b35]/30 flex items-center gap-2 transition-all">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? t("cv.generating", "جاري الإنشاء...") : done ? t("cv.regen", "إعادة الإنشاء") : t("cv.generate", "أنشئ السيرة")}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Upload, FileText, Download, Trash2, RefreshCw, Loader2, CheckCircle2,
  X, Sparkles, Plus, Target,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';

type Template = 'mit-classic' | 'harvard-executive';
type Language = 'ar' | 'en';

interface Toast { id: number; kind: 'ok' | 'err'; msg: string }

interface ExperienceItem {
  title: string; company: string; location: string;
  startDate: string; endDate: string; bullets: string[];
}
interface EducationItem {
  school: string; degree: string; field: string; year: string; achievements: string[];
}
interface CertItem { name: string; issuer: string; year: string }
interface LangItem { name: string; proficiency: string }

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  currentRole: string;
  currentCompany: string;
  yearsExperience: number;
  summary: string;
  skills: string[];
  languages: LangItem[];
  education: EducationItem[];
  experience: ExperienceItem[];
  certifications: CertItem[];
  achievements: string[];
}

const EMPTY_FORM: FormData = {
  fullName: '', email: '', phone: '', location: '', linkedinUrl: '',
  currentRole: '', currentCompany: '', yearsExperience: 0, summary: '',
  skills: [], languages: [], education: [], experience: [],
  certifications: [], achievements: [],
};

export default function CVTailor() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [template, setTemplate] = useState<Template>('mit-classic');
  const [language, setLanguage] = useState<Language>('en');

  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((kind: 'ok' | 'err', msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, kind, msg }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4000);
  }, []);

  const loadingMessages = useMemo(() => [
    t('cv.generate.loadingMessages.0', isAr ? 'نحلّل خبراتك ومهاراتك...' : 'Analyzing your experience and skills...'),
    t('cv.generate.loadingMessages.1', isAr ? 'نستخرج الكلمات المفتاحية للـ ATS...' : 'Extracting ATS keywords...'),
    t('cv.generate.loadingMessages.2', isAr ? 'نكتب نقاطاً قوية بأفعال تنفيذية...' : 'Writing achievement-forward bullets...'),
    t('cv.generate.loadingMessages.3', isAr ? 'نضيف النتائج القابلة للقياس...' : 'Adding measurable outcomes...'),
    t('cv.generate.loadingMessages.4', isAr ? 'ننسّق بفورمات MIT/Harvard...' : 'Applying MIT/Harvard formatting...'),
    t('cv.generate.loadingMessages.5', isAr ? 'نُخرج DOCX + PDF جاهزين...' : 'Generating DOCX + PDF...'),
  ], [t, isAr]);

  useEffect(() => {
    if (!generating) return;
    const iv = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % loadingMessages.length);
    }, 3500);
    return () => clearInterval(iv);
  }, [generating, loadingMessages.length]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await trpc.cv.list();
      setHistory(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      console.error('[cv.list]', e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function handleFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      pushToast('err', t('cv.upload.tooLarge', isAr ? 'الملف أكبر من 5MB' : 'File exceeds 5MB'));
      return;
    }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const res = await trpc.cv.parseUpload({
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type || '',
      });
      const ext = res.extracted;
      setForm({
        fullName: ext.fullName || '',
        email: ext.email || '',
        phone: ext.phone || '',
        location: ext.location || '',
        linkedinUrl: ext.linkedinUrl || '',
        currentRole: ext.currentRole || '',
        currentCompany: ext.currentCompany || '',
        yearsExperience: Number(ext.yearsExperience) || 0,
        summary: ext.summary || '',
        skills: Array.isArray(ext.skills) ? ext.skills : [],
        languages: Array.isArray(ext.languages) ? ext.languages : [],
        education: Array.isArray(ext.education) ? ext.education : [],
        experience: Array.isArray(ext.experience) ? ext.experience : [],
        certifications: Array.isArray(ext.certifications) ? ext.certifications : [],
        achievements: Array.isArray(ext.achievements) ? ext.achievements : [],
      });
      if (ext.currentRole && !targetRole) setTargetRole(ext.currentRole);
      pushToast('ok', t('cv.upload.successToast', isAr ? 'تم استخراج البيانات' : 'Extracted successfully'));
    } catch (e: any) {
      pushToast('err', e?.message || t('cv.upload.errorToast', isAr ? 'فشل الاستخراج' : 'Upload failed'));
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    if (!form.fullName.trim()) {
      pushToast('err', isAr ? 'الاسم الكامل مطلوب' : 'Full name is required');
      return;
    }
    if (!targetRole.trim()) {
      pushToast('err', isAr ? 'المسمى الوظيفي المستهدف مطلوب' : 'Target role is required');
      return;
    }
    setGenerating(true);
    setLoadingMsgIdx(0);
    try {
      const res = await trpc.cv.generate({
        userData: form,
        targetRole: targetRole.trim(),
        targetCompany: targetCompany.trim(),
        jobDescription: jobDescription.trim(),
        template,
        language,
      });
      pushToast('ok', t('cv.generate.success', isAr ? 'تم الإنشاء!' : 'Generated!'));
      if (res.docxUrl) window.open(res.docxUrl, '_blank');
      if (res.pdfUrl) window.open(res.pdfUrl, '_blank');
      await loadHistory();
    } catch (e: any) {
      pushToast('err', e?.message || t('cv.generate.error', isAr ? 'فشل الإنشاء' : 'Generation failed'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('cv.history.confirmDelete', isAr ? 'هل أنت متأكد من حذف هذه السيرة؟' : 'Delete this CV?'))) {
      return;
    }
    try {
      await trpc.cv.deleteById({ id });
      setHistory((h) => h.filter((r) => r.id !== id));
      pushToast('ok', t('cv.history.deleted', isAr ? 'تم الحذف' : 'Deleted'));
    } catch (e: any) {
      pushToast('err', e?.message || 'Delete failed');
    }
  }

  async function handleRegenerate(cv: any) {
    try {
      const full = await trpc.cv.getById({ id: cv.id });
      setForm(full.input_data || EMPTY_FORM);
      setTargetRole(full.target_role || '');
      setTargetCompany(full.target_company || '');
      setJobDescription(full.job_description || '');
      setTemplate(full.template as Template);
      setLanguage(full.language as Language);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      pushToast('ok', isAr ? 'تم تحميل البيانات — اضغط إنشاء' : 'Loaded — press Generate');
    } catch (e: any) {
      pushToast('err', e?.message || 'Load failed');
    }
  }

  const updateField = (k: keyof FormData, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const updateSkillsText = (txt: string) => {
    const arr = txt.split(',').map((s) => s.trim()).filter(Boolean);
    updateField('skills', arr);
  };

  return (
    <DashboardLayout pageTitle={t('cv.title', isAr ? 'تخصيص السيرة الذاتية' : 'CV Tailor')}>
      <div style={{ position: 'fixed', top: 16, insetInlineEnd: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              style={{
                background: t.kind === 'ok' ? '#ECFDF5' : '#FEF2F2',
                color: t.kind === 'ok' ? '#065F46' : '#991B1B',
                border: `1px solid ${t.kind === 'ok' ? '#A7F3D0' : '#FECACA'}`,
                padding: '10px 14px', borderRadius: 10, fontSize: 13,
                fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700,
                boxShadow: '0 6px 18px rgba(0,0,0,0.08)', minWidth: 240,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {t.kind === 'ok' ? <CheckCircle2 size={14} /> : <X size={14} />}
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '4px' }} dir={isAr ? 'rtl' : 'ltr'}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 24 }}>
          <h1 style={{
            fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 28,
            color: 'var(--wsl-ink)', letterSpacing: '-0.5px', margin: 0,
          }}>
            {t('cv.title', isAr ? 'تخصيص السيرة الذاتية' : 'CV Tailor')}
          </h1>
          <p style={{
            marginTop: 6, color: 'var(--wsl-ink-3)',
            fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14,
          }}>
            {t('cv.subtitle', isAr
              ? 'سيرة بفورمات MIT و Harvard — محسّنة لاجتياز أنظمة ATS'
              : 'MIT & Harvard formats — ATS-optimized for every application')}
          </p>
        </motion.div>

        <Section title={t('cv.upload.title', isAr ? 'رفع سيرتي الذاتية' : 'Upload My CV')}
          subtitle={t('cv.upload.subtitle', isAr ? 'اختياري — ارفع سيرتك الحالية لاستخراج البيانات تلقائياً' : 'Optional — upload to auto-fill the form below')}
          icon={<Upload size={18} />}>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            style={{
              border: '2px dashed var(--wsl-border, #D1D5DB)',
              borderRadius: 12, padding: 28, textAlign: 'center', cursor: 'pointer',
              background: '#F9FAFB', transition: 'all 180ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0A8F84'; e.currentTarget.style.background = 'rgba(10,143,132,0.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = '#F9FAFB'; }}
          >
            {uploading ? (
              <>
                <Loader2 size={28} style={{ color: '#0A8F84', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--wsl-ink)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                  {t('cv.upload.parsing', isAr ? 'نستخرج بياناتك...' : 'Parsing your CV...')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', marginTop: 4 }}>
                  {t('cv.upload.parsingHint', isAr ? '10-20 ثانية' : '10-20 seconds')}
                </div>
              </>
            ) : (
              <>
                <Upload size={28} style={{ color: '#0A8F84', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--wsl-ink)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                  {t('cv.upload.hint', isAr ? 'اسحب وأفلِت أو انقر للتصفح' : 'Drag & drop or click to browse')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', marginTop: 4, fontFamily: 'Cairo, Inter, sans-serif' }}>
                  {t('cv.upload.formats', isAr ? 'PDF، DOCX، TXT — حتى 5MB' : 'PDF, DOCX, TXT — up to 5MB')}
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef} type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
        </Section>

        <Section title={t('cv.form.sectionYourInfo', isAr ? 'معلوماتك الشخصية' : 'Your Information')}
          icon={<FileText size={18} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <Field label={t('cv.form.fullName', isAr ? 'الاسم الكامل *' : 'Full Name *')}
              value={form.fullName} onChange={(v) => updateField('fullName', v)} />
            <Field label={t('cv.form.email', isAr ? 'البريد الإلكتروني' : 'Email')}
              value={form.email} onChange={(v) => updateField('email', v)} type="email" />
            <Field label={t('cv.form.phone', isAr ? 'رقم الجوال' : 'Phone')}
              value={form.phone} onChange={(v) => updateField('phone', v)} />
            <Field label={t('cv.form.location', isAr ? 'المدينة، الدولة' : 'City, Country')}
              value={form.location} onChange={(v) => updateField('location', v)} />
            <Field label={t('cv.form.linkedinUrl', isAr ? 'رابط LinkedIn' : 'LinkedIn URL')}
              value={form.linkedinUrl} onChange={(v) => updateField('linkedinUrl', v)} />
            <Field label={t('cv.form.currentRole', isAr ? 'الدور الحالي' : 'Current Role')}
              value={form.currentRole} onChange={(v) => updateField('currentRole', v)} />
            <Field label={t('cv.form.currentCompany', isAr ? 'الشركة الحالية' : 'Current Company')}
              value={form.currentCompany} onChange={(v) => updateField('currentCompany', v)} />
            <Field label={t('cv.form.yearsExperience', isAr ? 'سنوات الخبرة' : 'Years of Experience')}
              value={String(form.yearsExperience || '')} onChange={(v) => updateField('yearsExperience', Number(v) || 0)}
              type="number" />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>
              {t('cv.form.summary', isAr ? 'نبذة مهنية (اختياري)' : 'Professional Summary (optional)')}
            </label>
            <textarea
              value={form.summary}
              onChange={(e) => updateField('summary', e.target.value)}
              rows={3}
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>
              {t('cv.form.skills', isAr ? 'المهارات (مفصولة بفواصل)' : 'Skills (comma-separated)')}
            </label>
            <textarea
              value={form.skills.join(', ')}
              onChange={(e) => updateSkillsText(e.target.value)}
              rows={2}
              style={inputStyle}
              placeholder="SolidWorks, AutoCAD, MATLAB..."
            />
            {form.skills.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', marginTop: 4, fontFamily: 'Cairo, Inter, sans-serif' }}>
                {form.skills.length} {isAr ? 'مهارة' : 'skills'}
              </div>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelStyle, margin: 0 }}>
                {t('cv.form.experience', isAr ? 'الخبرات' : 'Experience')} ({form.experience.length})
              </label>
              <button type="button" onClick={() => updateField('experience', [...form.experience, { title: '', company: '', location: '', startDate: '', endDate: '', bullets: [] }])}
                style={addBtnStyle}>
                <Plus size={12} /> {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
            {form.experience.map((x, i) => (
              <ExpCard
                key={i}
                item={x}
                onChange={(next) => {
                  const arr = [...form.experience]; arr[i] = next;
                  updateField('experience', arr);
                }}
                onRemove={() => updateField('experience', form.experience.filter((_, j) => j !== i))}
                isAr={isAr}
              />
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelStyle, margin: 0 }}>
                {t('cv.form.education', isAr ? 'التعليم' : 'Education')} ({form.education.length})
              </label>
              <button type="button" onClick={() => updateField('education', [...form.education, { school: '', degree: '', field: '', year: '', achievements: [] }])}
                style={addBtnStyle}>
                <Plus size={12} /> {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
            {form.education.map((x, i) => (
              <EduCard
                key={i}
                item={x}
                onChange={(next) => {
                  const arr = [...form.education]; arr[i] = next;
                  updateField('education', arr);
                }}
                onRemove={() => updateField('education', form.education.filter((_, j) => j !== i))}
                isAr={isAr}
              />
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelStyle, margin: 0 }}>
                {t('cv.form.certifications', isAr ? 'الشهادات' : 'Certifications')} ({form.certifications.length})
              </label>
              <button type="button" onClick={() => updateField('certifications', [...form.certifications, { name: '', issuer: '', year: '' }])}
                style={addBtnStyle}>
                <Plus size={12} /> {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
            {form.certifications.map((c, i) => (
              <div key={i} style={{ ...subCardStyle }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 36px', gap: 10, alignItems: 'center' }}>
                  <input value={c.name} onChange={(e) => {
                    const arr = [...form.certifications]; arr[i] = { ...c, name: e.target.value };
                    updateField('certifications', arr);
                  }} placeholder={isAr ? 'اسم الشهادة' : 'Certification name'}
                    style={{ ...inputStyle, marginBottom: 0 }} />
                  <input value={c.issuer} onChange={(e) => {
                    const arr = [...form.certifications]; arr[i] = { ...c, issuer: e.target.value };
                    updateField('certifications', arr);
                  }} placeholder={isAr ? 'الجهة المصدرة' : 'Issuer'}
                    style={{ ...inputStyle, marginBottom: 0 }} />
                  <input value={c.year} onChange={(e) => {
                    const arr = [...form.certifications]; arr[i] = { ...c, year: e.target.value };
                    updateField('certifications', arr);
                  }} placeholder={isAr ? 'السنة' : 'Year'}
                    style={{ ...inputStyle, marginBottom: 0 }} />
                  <button onClick={() => updateField('certifications', form.certifications.filter((_, j) => j !== i))}
                    style={removeBtnStyle}><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelStyle, margin: 0 }}>
                {t('cv.form.languages', isAr ? 'اللغات' : 'Languages')} ({form.languages.length})
              </label>
              <button type="button" onClick={() => updateField('languages', [...form.languages, { name: '', proficiency: '' }])}
                style={addBtnStyle}>
                <Plus size={12} /> {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
            {form.languages.map((lang, i) => (
              <div key={i} style={{ ...subCardStyle }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 36px', gap: 10, alignItems: 'center' }}>
                  <input value={lang.name} onChange={(e) => {
                    const arr = [...form.languages]; arr[i] = { ...lang, name: e.target.value };
                    updateField('languages', arr);
                  }} placeholder={isAr ? 'اللغة' : 'Language'}
                    style={{ ...inputStyle, marginBottom: 0 }} />
                  <input value={lang.proficiency} onChange={(e) => {
                    const arr = [...form.languages]; arr[i] = { ...lang, proficiency: e.target.value };
                    updateField('languages', arr);
                  }} placeholder={isAr ? 'المستوى' : 'Proficiency'}
                    style={{ ...inputStyle, marginBottom: 0 }} />
                  <button onClick={() => updateField('languages', form.languages.filter((_, j) => j !== i))}
                    style={removeBtnStyle}><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>
              {t('cv.form.achievements', isAr ? 'أبرز الإنجازات (كل إنجاز في سطر)' : 'Key Achievements (one per line)')}
            </label>
            <textarea
              value={form.achievements.join('\n')}
              onChange={(e) => updateField('achievements', e.target.value.split('\n').map((a) => a.trim()).filter(Boolean))}
              rows={4}
              style={inputStyle}
            />
          </div>
        </Section>

        <Section title={t('cv.form.sectionTargetJob', isAr ? 'الوظيفة المستهدفة' : 'Target Job')}
          icon={<Target size={18} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            <Field label={t('cv.form.targetRole', isAr ? 'المسمى الوظيفي المستهدف *' : 'Target Role *')}
              value={targetRole} onChange={setTargetRole} />
            <Field label={t('cv.form.targetCompany', isAr ? 'الشركة المستهدفة' : 'Target Company')}
              value={targetCompany} onChange={setTargetCompany} />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>
              {t('cv.form.jobDescription', isAr ? 'الوصف الوظيفي' : 'Job Description')}
            </label>
            <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', marginBottom: 4, fontFamily: 'Cairo, Inter, sans-serif' }}>
              {t('cv.form.jobDescriptionHint', isAr
                ? 'الصق وصف الوظيفة — سنستخلص الكلمات المفتاحية للـ ATS'
                : 'Paste the JD — we extract keywords for ATS tailoring')}
            </div>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={6}
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>{isAr ? 'اللغة' : 'Language'}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['en', 'ar'] as Language[]).map((l) => (
                <button key={l} onClick={() => setLanguage(l)} style={{
                  padding: '8px 16px', borderRadius: 8, border: language === l ? '2px solid #0A8F84' : '1px solid var(--wsl-border)',
                  background: language === l ? 'rgba(10,143,132,0.08)' : '#fff',
                  color: language === l ? '#0A8F84' : 'var(--wsl-ink-2)',
                  fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  fontFamily: 'Cairo, Inter, sans-serif',
                }}>
                  {l === 'en' ? 'English' : 'العربية'}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title={t('cv.templates.chooseTitle', isAr ? 'اختر القالب' : 'Choose Template')}
          subtitle={t('cv.templates.chooseSubtitle', isAr ? 'قالبان مُختبران ضد أنظمة ATS' : 'Two ATS-tested templates')}
          icon={<Sparkles size={18} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <TemplateCard
              id="mit-classic"
              selected={template === 'mit-classic'}
              onClick={() => setTemplate('mit-classic')}
              title={t('cv.templates.mit.name', isAr ? 'MIT الكلاسيكي' : 'MIT Classic')}
              desc={t('cv.templates.mit.desc', isAr
                ? 'قالب أكاديمي صارم بأقسام واضحة — معتمد في الهندسة والتقنية والحكومية'
                : 'Austere academic layout with crisp sections — engineering, tech, gov')}
              tags={isAr ? ['هندسة', 'تقنية', 'أكاديمي', 'حكومي'] : ['Engineering', 'Tech', 'Academic', 'Gov']}
              preview="mit"
            />
            <TemplateCard
              id="harvard-executive"
              selected={template === 'harvard-executive'}
              onClick={() => setTemplate('harvard-executive')}
              title={t('cv.templates.harvard.name', isAr ? 'Harvard التنفيذي' : 'Harvard Executive')}
              desc={t('cv.templates.harvard.desc', isAr
                ? 'تصميم عصري يُبرز الإنجازات القابلة للقياس — أعمال واستشارات'
                : 'Modern design with achievement-forward bullets — business, consulting')}
              tags={isAr ? ['أعمال', 'استشارات', 'إدارة', 'مبيعات'] : ['Business', 'Consulting', 'Leadership', 'Sales']}
              preview="harvard"
            />
          </div>
        </Section>

        <Section title={t('cv.generate.title', isAr ? 'جاهز للإنشاء؟' : 'Ready to Generate?')}
          subtitle={t('cv.generate.subtitle', isAr ? '10 توكن لكل سيرة (DOCX + PDF)' : '10 tokens per CV (DOCX + PDF)')}
          icon={<Download size={18} />}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
              background: generating
                ? 'var(--wsl-border, #E5E7EB)'
                : 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)',
              color: generating ? 'var(--wsl-ink-3)' : '#fff',
              fontWeight: 900, fontSize: 15, cursor: generating ? 'not-allowed' : 'pointer',
              fontFamily: 'Cairo, Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: generating ? 'none' : '0 6px 18px rgba(10,143,132,0.3)',
              transition: 'all 180ms',
            }}
          >
            {generating ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                {loadingMessages[loadingMsgIdx]}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {t('cv.generate.button', isAr ? 'إنشاء السيرة — 10 توكن' : 'Generate CV — 10 tokens')}
              </>
            )}
          </button>
        </Section>

        <Section title={t('cv.history.title', isAr ? 'سيرك السابقة' : 'Your Previous CVs')}
          icon={<FileText size={18} />}>
          {historyLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Loader2 size={24} style={{ color: '#0A8F84', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
              <FileText size={32} style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontWeight: 900, fontSize: 15 }}>
                {t('cv.history.emptyTitle', isAr ? 'لم تُنشئ أي سيرة بعد' : 'No CVs generated yet')}
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                {t('cv.history.emptyDesc', isAr ? 'اتبع الخطوات أعلاه لإنشاء سيرتك الأولى' : 'Follow the steps above to create your first CV')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((cv) => (
                <div key={cv.id} style={{
                  padding: 14, borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)',
                  background: '#fff', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                      {cv.target_role}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', marginTop: 2, fontFamily: 'Cairo, Inter, sans-serif' }}>
                      {cv.target_company || t('cv.history.noCompany', isAr ? 'بدون شركة محددة' : 'No specific company')}
                      {' · '}
                      <span style={{ textTransform: 'capitalize' }}>{cv.template.replace('-', ' ')}</span>
                      {' · '}
                      {new Date(cv.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {cv.docxUrl && (
                      <a href={cv.docxUrl} target="_blank" rel="noopener noreferrer" style={actionBtn}>
                        <Download size={12} /> DOCX
                      </a>
                    )}
                    {cv.pdfUrl && (
                      <a href={cv.pdfUrl} target="_blank" rel="noopener noreferrer" style={actionBtn}>
                        <Download size={12} /> PDF
                      </a>
                    )}
                    <button onClick={() => handleRegenerate(cv)} style={actionBtn}>
                      <RefreshCw size={12} /> {t('cv.history.regenerate', isAr ? 'إعادة إنشاء' : 'Regenerate')}
                    </button>
                    <button onClick={() => handleDelete(cv.id)} style={{ ...actionBtn, color: '#DC2626', borderColor: '#FECACA' }}>
                      <Trash2 size={12} /> {t('cv.history.delete', isAr ? 'حذف' : 'Delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </DashboardLayout>
  );
}

function Section({ title, subtitle, icon, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        background: '#fff', border: '1px solid var(--wsl-border, #E5E7EB)',
        borderRadius: 14, padding: 20, marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: subtitle ? 4 : 14 }}>
        {icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(10,143,132,0.08)', color: '#0A8F84',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
        )}
        <div style={{
          fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 16,
          color: 'var(--wsl-ink)',
        }}>
          {title}
        </div>
      </div>
      {subtitle && (
        <div style={{
          fontSize: 12, color: 'var(--wsl-ink-3)', marginBottom: 14, marginInlineStart: 42,
          fontFamily: 'Cairo, Inter, sans-serif',
        }}>
          {subtitle}
        </div>
      )}
      {children}
    </motion.div>
  );
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

function ExpCard({ item, onChange, onRemove, isAr }: {
  item: ExperienceItem;
  onChange: (next: ExperienceItem) => void;
  onRemove: () => void;
  isAr: boolean;
}) {
  return (
    <div style={subCardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
          {isAr ? 'خبرة' : 'Experience'}
        </span>
        <button onClick={onRemove} style={removeBtnStyle}><X size={12} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input value={item.title} onChange={(e) => onChange({ ...item, title: e.target.value })}
          placeholder={isAr ? 'المسمى الوظيفي' : 'Job title'} style={{ ...inputStyle, marginBottom: 0 }} />
        <input value={item.company} onChange={(e) => onChange({ ...item, company: e.target.value })}
          placeholder={isAr ? 'الشركة' : 'Company'} style={{ ...inputStyle, marginBottom: 0 }} />
        <input value={item.location} onChange={(e) => onChange({ ...item, location: e.target.value })}
          placeholder={isAr ? 'الموقع' : 'Location'} style={{ ...inputStyle, marginBottom: 0 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input value={item.startDate} onChange={(e) => onChange({ ...item, startDate: e.target.value })}
            placeholder={isAr ? 'من' : 'Start'} style={{ ...inputStyle, marginBottom: 0 }} />
          <input value={item.endDate} onChange={(e) => onChange({ ...item, endDate: e.target.value })}
            placeholder={isAr ? 'إلى' : 'End'} style={{ ...inputStyle, marginBottom: 0 }} />
        </div>
      </div>
      <textarea
        value={(item.bullets || []).join('\n')}
        onChange={(e) => onChange({ ...item, bullets: e.target.value.split('\n').map((b) => b.trim()).filter(Boolean) })}
        rows={3}
        placeholder={isAr ? 'النقاط (كل نقطة في سطر)' : 'Bullets (one per line)'}
        style={{ ...inputStyle, marginTop: 8, marginBottom: 0 }}
      />
    </div>
  );
}

function EduCard({ item, onChange, onRemove, isAr }: {
  item: EducationItem;
  onChange: (next: EducationItem) => void;
  onRemove: () => void;
  isAr: boolean;
}) {
  return (
    <div style={subCardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
          {isAr ? 'تعليم' : 'Education'}
        </span>
        <button onClick={onRemove} style={removeBtnStyle}><X size={12} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input value={item.school} onChange={(e) => onChange({ ...item, school: e.target.value })}
          placeholder={isAr ? 'الجامعة/المؤسسة' : 'School'} style={{ ...inputStyle, marginBottom: 0 }} />
        <input value={item.degree} onChange={(e) => onChange({ ...item, degree: e.target.value })}
          placeholder={isAr ? 'الشهادة' : 'Degree'} style={{ ...inputStyle, marginBottom: 0 }} />
        <input value={item.field} onChange={(e) => onChange({ ...item, field: e.target.value })}
          placeholder={isAr ? 'التخصص' : 'Field'} style={{ ...inputStyle, marginBottom: 0 }} />
        <input value={item.year} onChange={(e) => onChange({ ...item, year: e.target.value })}
          placeholder={isAr ? 'السنة' : 'Year'} style={{ ...inputStyle, marginBottom: 0 }} />
      </div>
    </div>
  );
}

function TemplateCard({ selected, onClick, title, desc, tags, preview }: {
  id: string; selected: boolean; onClick: () => void;
  title: string; desc: string; tags: string[]; preview: 'mit' | 'harvard';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'start', padding: 16, borderRadius: 14, cursor: 'pointer',
        border: selected ? '2px solid #0A8F84' : '2px solid var(--wsl-border, #E5E7EB)',
        background: selected ? 'rgba(10,143,132,0.04)' : '#fff',
        transition: 'all 180ms',
        fontFamily: 'Cairo, Inter, sans-serif',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <TemplatePreview kind={preview} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--wsl-ink)', marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', lineHeight: 1.5, marginBottom: 8 }}>
            {desc}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tags.map((tag) => (
              <span key={tag} style={{
                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(10,143,132,0.08)', color: '#0A8F84',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        {selected && (
          <CheckCircle2 size={18} style={{ color: '#0A8F84', flexShrink: 0 }} />
        )}
      </div>
    </button>
  );
}

function TemplatePreview({ kind }: { kind: 'mit' | 'harvard' }) {
  if (kind === 'mit') {
    return (
      <svg width="60" height="78" viewBox="0 0 60 78" style={{ flexShrink: 0, borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}>
        <rect width="60" height="78" fill="#fff" stroke="#E5E7EB" />
        <text x="30" y="14" fontSize="6" fontWeight="900" fill="#000" textAnchor="middle">NAME</text>
        <line x1="8" y1="17" x2="52" y2="17" stroke="#000" strokeWidth="0.4" />
        <text x="30" y="23" fontSize="3" fill="#555" textAnchor="middle">contact info</text>
        <text x="8" y="33" fontSize="4" fontWeight="900" fill="#000">EXPERIENCE</text>
        <line x1="8" y1="35" x2="52" y2="35" stroke="#000" strokeWidth="0.6" />
        <rect x="8" y="38" width="34" height="2" fill="#333" />
        <rect x="8" y="42" width="28" height="1.5" fill="#888" />
        <rect x="10" y="46" width="40" height="1" fill="#ccc" />
        <rect x="10" y="48.5" width="36" height="1" fill="#ccc" />
        <text x="8" y="58" fontSize="4" fontWeight="900" fill="#000">EDUCATION</text>
        <line x1="8" y1="60" x2="52" y2="60" stroke="#000" strokeWidth="0.6" />
        <rect x="8" y="63" width="30" height="1.5" fill="#333" />
        <rect x="10" y="67" width="38" height="1" fill="#ccc" />
      </svg>
    );
  }
  return (
    <svg width="60" height="78" viewBox="0 0 60 78" style={{ flexShrink: 0, borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}>
      <rect width="60" height="78" fill="#fff" stroke="#E5E7EB" />
      <text x="8" y="14" fontSize="7" fontWeight="900" fill="#1e3a5f">Name</text>
      <text x="8" y="20" fontSize="3" fill="#777">location | email</text>
      <text x="8" y="31" fontSize="4" fontWeight="900" fill="#1e3a5f">EXPERIENCE</text>
      <line x1="8" y1="33" x2="52" y2="33" stroke="#1e3a5f" strokeWidth="0.8" />
      <text x="8" y="39" fontSize="3.5" fontWeight="900" fill="#1e3a5f">Title</text>
      <text x="52" y="39" fontSize="3" fill="#888" textAnchor="end">2024</text>
      <text x="8" y="43" fontSize="3" fill="#555" fontStyle="italic">Company</text>
      <rect x="10" y="46" width="12" height="1" fill="#1e3a5f" />
      <rect x="23" y="46" width="28" height="1" fill="#ccc" />
      <rect x="10" y="48.5" width="14" height="1" fill="#1e3a5f" />
      <rect x="25" y="48.5" width="25" height="1" fill="#ccc" />
      <text x="8" y="58" fontSize="4" fontWeight="900" fill="#1e3a5f">EDUCATION</text>
      <line x1="8" y1="60" x2="52" y2="60" stroke="#1e3a5f" strokeWidth="0.8" />
      <rect x="8" y="63" width="30" height="1.5" fill="#333" />
      <rect x="10" y="67" width="38" height="1" fill="#ccc" />
    </svg>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 800,
  color: 'var(--wsl-ink-2)', marginBottom: 4,
  fontFamily: 'Cairo, Inter, sans-serif',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--wsl-border, #E5E7EB)', fontSize: 13,
  fontFamily: 'Cairo, Inter, sans-serif', outline: 'none',
  background: '#fff', marginBottom: 4, boxSizing: 'border-box',
};

const subCardStyle: React.CSSProperties = {
  padding: 12, borderRadius: 10, background: '#F9FAFB',
  border: '1px solid var(--wsl-border, #E5E7EB)', marginBottom: 8,
};

const addBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(10,143,132,0.3)',
  background: 'rgba(10,143,132,0.08)', color: '#0A8F84', fontSize: 12, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'Cairo, Inter, sans-serif',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};

const removeBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid #FECACA',
  background: '#FEF2F2', color: '#DC2626', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const actionBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid var(--wsl-border, #E5E7EB)',
  background: '#fff', color: 'var(--wsl-ink-2)', fontSize: 12, fontWeight: 800,
  cursor: 'pointer', fontFamily: 'Cairo, Inter, sans-serif', textDecoration: 'none',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Upload, FileText, Download, Trash2, RefreshCw, Loader2, CheckCircle2,
  X, Sparkles, Plus, Target, BarChart3, GitCompare, Mail, AlertTriangle,
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

  // v3 state
  const [includeCoverLetter, setIncludeCoverLetter] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseMethod, setParseMethod] = useState<'docx' | 'pdf-text' | 'pdf-ocr' | 'manual'>('manual');
  const [lastResult, setLastResult] = useState<any | null>(null);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<any | null>(null);
  const [comparing, setComparing] = useState(false);

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
    setParseError(null);
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
      setParseMethod(res.parseMethod || 'manual');
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
      const msg = e?.message || (isAr ? 'فشل الاستخراج' : 'Upload failed');
      setParseError(msg);
      pushToast('err', msg);
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
    setLastResult(null);
    try {
      const res = await trpc.cv.generate({
        userData: form,
        targetRole: targetRole.trim(),
        targetCompany: targetCompany.trim(),
        jobDescription: jobDescription.trim(),
        template,
        language,
        includeCoverLetter,
        calculateATS: true,
        sourceParseMethod: parseMethod,
      });
      setLastResult(res);
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

  function toggleCompareSelection(id: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  async function openCompareView() {
    if (selectedForCompare.length !== 2) return;
    setComparing(true);
    try {
      const rows = history.filter((h) => selectedForCompare.includes(h.id));
      const sorted = rows.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const data = await trpc.cv.compareCvs({
        olderId: sorted[0].id,
        newerId: sorted[1].id,
      });
      setCompareData(data);
    } catch (e: any) {
      pushToast('err', e?.message || (isAr ? 'فشل المقارنة' : 'Compare failed'));
    } finally {
      setComparing(false);
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

          {/* Upload Helper Card — v3 */}
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10,
            padding: 14, marginBottom: 14, fontFamily: 'Cairo, Inter, sans-serif',
          }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#1E3A8A', marginBottom: 8 }}>
              {t('cv.upload.supportedFormats', isAr ? 'الصيغ المدعومة' : 'Supported formats')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--wsl-ink-2, #374151)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#16a34a', fontSize: 16, lineHeight: 1 }}>●</span>
                <span>
                  <strong>DOCX</strong> — {t('cv.upload.docxDesc', isAr ? 'مستند Word — دقة الاستخراج 95%+' : 'Word document — 95%+ extraction accuracy')}
                  <span style={{ color: '#16a34a', fontSize: 11, marginInlineStart: 6 }}>
                    {t('cv.upload.bestAccuracy', isAr ? '(الأفضل)' : '(Best)')}
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#0A8F84', fontSize: 16, lineHeight: 1 }}>●</span>
                <span>
                  <strong>PDF (from Word)</strong> — {t('cv.upload.pdfWordDesc', isAr ? 'PDF مُنشأ من Word — دقة 85-90%' : 'PDF created from Word — 85-90% accuracy')}
                  <span style={{ color: '#0A8F84', fontSize: 11, marginInlineStart: 6 }}>
                    {t('cv.upload.goodAccuracy', isAr ? '(جيد)' : '(Good)')}
                  </span>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#d97706', fontSize: 16, lineHeight: 1 }}>●</span>
                <span>
                  <strong>PDF (Scanned)</strong> — {t('cv.upload.pdfScannedDesc', isAr ? 'PDF ممسوح ضوئياً — يستخدم OCR' : 'Scanned PDF — uses OCR')}
                  <span style={{ color: '#d97706', fontSize: 11, marginInlineStart: 6 }}>
                    {t('cv.upload.slowerOcr', isAr ? '(أبطأ)' : '(Slower)')}
                  </span>
                </span>
              </div>
            </div>
          </div>

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

          {/* Smart Error Message — v3 */}
          {parseError && (
            <div style={{
              marginTop: 14, padding: 14, borderRadius: 10,
              background: '#FEF2F2', border: '1px solid #FECACA',
              fontFamily: 'Cairo, Inter, sans-serif',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} style={{ color: '#B91C1C' }} />
                <div style={{ fontWeight: 900, fontSize: 13, color: '#991B1B' }}>
                  {t('cv.errors.parseFailed', isAr ? 'لم نتمكن من قراءة الملف' : 'Could not read the file')}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#7F1D1D', marginBottom: 10 }}>{parseError}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--wsl-ink-2)' }}>
                <div>✅ {t('cv.errors.solution1', isAr ? 'ارفع ملف Word (.docx) — أدق استخراج' : 'Upload a Word file (.docx) — highest accuracy')}</div>
                <div>✅ {t('cv.errors.solution2', isAr ? 'أو أعد إنشاء PDF من Word/Google Docs' : 'Or re-export the PDF from Word/Google Docs')}</div>
                <button
                  onClick={() => { setParseError(null); setParseMethod('manual'); pushToast('ok', isAr ? 'يمكنك الآن ملء البيانات يدوياً' : 'You can now fill fields manually'); }}
                  style={{
                    marginTop: 8, padding: '6px 12px', border: '1px solid #0A8F84',
                    background: '#fff', color: '#0A8F84', borderRadius: 6,
                    fontWeight: 800, fontSize: 12, cursor: 'pointer', alignSelf: 'flex-start',
                    fontFamily: 'Cairo, Inter, sans-serif',
                  }}
                >
                  {t('cv.errors.fillManually', isAr ? 'املأ البيانات يدوياً' : 'Fill manually')} →
                </button>
              </div>
            </div>
          )}
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

          {/* Cover Letter Checkbox — v3 */}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12,
            background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
            marginBottom: 12, cursor: 'pointer', fontFamily: 'Cairo, Inter, sans-serif',
          }}>
            <input
              type="checkbox"
              checked={includeCoverLetter}
              onChange={(e) => setIncludeCoverLetter(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#D97706' }}
            />
            <div style={{ flex: 1, fontSize: 13, color: 'var(--wsl-ink-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Mail size={14} style={{ color: '#D97706' }} />
                <strong>{t('cv.coverLetter.label', isAr ? 'أضف خطاب تقديم (Cover Letter)' : 'Add a Cover Letter')}</strong>
                <span style={{ background: '#D97706', color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
                  +5 {t('common.tokens', isAr ? 'توكن' : 'tokens')}
                </span>
              </div>
              <div style={{ marginTop: 4, color: 'var(--wsl-ink-3)', fontSize: 12 }}>
                {t('cv.coverLetter.description', isAr ? 'بنفس لغة ونبرة السيرة الذاتية، مخصص للوظيفة' : 'Same language & tone as the CV, tailored to the job')}
              </div>
            </div>
          </label>

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
                {includeCoverLetter
                  ? (isAr ? 'إنشاء السيرة + خطاب التقديم — 15 توكن' : 'Generate CV + Cover Letter — 15 tokens')
                  : t('cv.generate.button', isAr ? 'إنشاء السيرة — 10 توكن' : 'Generate CV — 10 tokens')}
              </>
            )}
          </button>

          {/* ATS Score + Cover Letter downloads — v3 */}
          {lastResult && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {lastResult.atsScore && (
                <ATSScoreCard atsScore={lastResult.atsScore} isAr={isAr} t={t} />
              )}
              {lastResult.coverLetter && (lastResult.coverLetter.docxUrl || lastResult.coverLetter.pdfUrl) && (
                <div style={{
                  padding: 14, borderRadius: 10,
                  background: '#FFFBEB', border: '1px solid #FCD34D',
                  fontFamily: 'Cairo, Inter, sans-serif',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Mail size={16} style={{ color: '#D97706' }} />
                    <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink)' }}>
                      {t('cv.coverLetter.ready', isAr ? 'خطاب التقديم جاهز' : 'Cover Letter Ready')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {lastResult.coverLetter.docxUrl && (
                      <a href={lastResult.coverLetter.docxUrl} target="_blank" rel="noopener noreferrer" style={actionBtn}>
                        <Download size={12} /> {t('cv.coverLetter.downloadDocx', isAr ? 'تحميل خطاب التقديم DOCX' : 'Download Cover Letter DOCX')}
                      </a>
                    )}
                    {lastResult.coverLetter.pdfUrl && (
                      <a href={lastResult.coverLetter.pdfUrl} target="_blank" rel="noopener noreferrer" style={actionBtn}>
                        <Download size={12} /> {t('cv.coverLetter.downloadPdf', isAr ? 'تحميل خطاب التقديم PDF' : 'Download Cover Letter PDF')}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title={t('cv.history.title', isAr ? 'سيرك السابقة' : 'Your Previous CVs')}
          icon={<FileText size={18} />}>

          {/* Compare header — v3 */}
          {history.length >= 2 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10, padding: '8px 12px', borderRadius: 8,
              background: '#F3F4F6', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 12,
              color: 'var(--wsl-ink-2)', gap: 10, flexWrap: 'wrap',
            }}>
              <div>
                {t('cv.history.compareHint', isAr ? 'حدّد سيرتين من القائمة لمقارنتهما' : 'Select two CVs below to compare')}
                {selectedForCompare.length > 0 && (
                  <span style={{ marginInlineStart: 8, fontWeight: 800, color: '#0A8F84' }}>
                    ({selectedForCompare.length}/2)
                  </span>
                )}
              </div>
              {selectedForCompare.length === 2 && (
                <button
                  onClick={openCompareView}
                  disabled={comparing}
                  style={{
                    padding: '6px 14px', borderRadius: 8, border: 'none',
                    background: comparing ? '#E5E7EB' : 'linear-gradient(135deg, #0A8F84, #0ea5e9)',
                    color: comparing ? '#9CA3AF' : '#fff',
                    fontWeight: 900, fontSize: 12, cursor: comparing ? 'not-allowed' : 'pointer',
                    fontFamily: 'Cairo, Inter, sans-serif',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {comparing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <GitCompare size={12} />}
                  {t('cv.history.compareSelected', isAr ? 'قارن المحدد' : 'Compare Selected')}
                </button>
              )}
            </div>
          )}

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
              {history.map((cv) => {
                const isSelected = selectedForCompare.includes(cv.id);
                const disabled = !isSelected && selectedForCompare.length >= 2;
                const atsOverall = cv.ats_score?.overall;
                return (
                  <div key={cv.id} style={{
                    padding: 14, borderRadius: 10,
                    border: isSelected ? '2px solid #0A8F84' : '1px solid var(--wsl-border, #E5E7EB)',
                    background: isSelected ? 'rgba(10,143,132,0.04)' : '#fff',
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                  }}>
                    {history.length >= 2 && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={disabled}
                        onChange={() => toggleCompareSelection(cv.id)}
                        style={{ width: 16, height: 16, cursor: disabled ? 'not-allowed' : 'pointer', accentColor: '#0A8F84' }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--wsl-ink)', fontFamily: 'Cairo, Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {cv.target_role}
                        {typeof atsOverall === 'number' && atsOverall > 0 && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 900,
                            background: atsOverall >= 85 ? '#DCFCE7' : atsOverall >= 70 ? '#FEF9C3' : atsOverall >= 50 ? '#FFEDD5' : '#FEE2E2',
                            color: atsOverall >= 85 ? '#166534' : atsOverall >= 70 ? '#854D0E' : atsOverall >= 50 ? '#9A3412' : '#991B1B',
                          }}>
                            <BarChart3 size={10} /> ATS {atsOverall}
                          </span>
                        )}
                        {cv.cover_letter_generated && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                            background: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D',
                          }}>
                            <Mail size={10} /> CL
                          </span>
                        )}
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
                      {cv.coverLetterDocxUrl && (
                        <a href={cv.coverLetterDocxUrl} target="_blank" rel="noopener noreferrer" style={{ ...actionBtn, borderColor: '#FCD34D', color: '#92400E' }}>
                          <Mail size={12} /> CL DOCX
                        </a>
                      )}
                      {cv.coverLetterPdfUrl && (
                        <a href={cv.coverLetterPdfUrl} target="_blank" rel="noopener noreferrer" style={{ ...actionBtn, borderColor: '#FCD34D', color: '#92400E' }}>
                          <Mail size={12} /> CL PDF
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
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {/* Compare Modal — v3 */}
      {compareData && (
        <CompareModal
          data={compareData}
          isAr={isAr}
          t={t}
          onClose={() => { setCompareData(null); setSelectedForCompare([]); }}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </DashboardLayout>
  );
}

function ATSScoreCard({ atsScore, isAr, t }: { atsScore: any; isAr: boolean; t: any }) {
  const overall = atsScore.overall || 0;
  const color = overall >= 85 ? '#16a34a' : overall >= 70 ? '#ca8a04' : overall >= 50 ? '#ea580c' : '#dc2626';
  const bg = overall >= 85 ? '#DCFCE7' : overall >= 70 ? '#FEF9C3' : overall >= 50 ? '#FFEDD5' : '#FEE2E2';
  const bd = atsScore.breakdown || {};
  const km = bd.keywordMatch || {};
  const fs = bd.formatSafety || {};
  const ln = bd.length || {};
  const st = bd.structure || {};
  const improvements: string[] = Array.isArray(atsScore.improvements) ? atsScore.improvements : [];
  const missing: string[] = Array.isArray(km.missing) ? km.missing : [];

  return (
    <div style={{
      padding: 18, borderRadius: 12, background: '#fff',
      border: '1px solid var(--wsl-border, #E5E7EB)',
      fontFamily: 'Cairo, Inter, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <BarChart3 size={18} style={{ color: '#0A8F84' }} />
        <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--wsl-ink)' }}>
          {t('cv.ats.title', isAr ? 'درجة توافق ATS' : 'ATS Compatibility Score')}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 96, height: 96, borderRadius: '50%', background: bg,
          color, fontSize: 28, fontWeight: 900,
        }}>
          {overall}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color }}>{atsScore.verdict || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', marginTop: 4 }}>
            {t('cv.ats.basedOnJd', isAr ? 'محسوبة من وصف الوظيفة' : 'Based on the job description')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 12, marginBottom: 14 }}>
        <ScoreBar label={t('cv.ats.keywordMatch', isAr ? 'مطابقة الكلمات المفتاحية' : 'Keyword Match')} score={km.score || 0} max={50} />
        <ScoreBar label={t('cv.ats.formatSafety', isAr ? 'سلامة التنسيق' : 'Format Safety')} score={fs.score || 0} max={20} />
        <ScoreBar label={t('cv.ats.length', isAr ? 'الطول' : 'Length')} score={ln.score || 0} max={15} />
        <ScoreBar label={t('cv.ats.structure', isAr ? 'الهيكل' : 'Structure')} score={st.score || 0} max={15} />
      </div>

      {missing.length > 0 && (
        <div style={{ padding: 10, borderRadius: 8, background: '#FFFBEB', border: '1px solid #FCD34D', marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 12, color: '#92400E', marginBottom: 6 }}>
            {t('cv.ats.missingKeywords', isAr ? 'كلمات مفقودة' : 'Missing Keywords')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {missing.map((kw, i) => (
              <span key={i} style={{
                padding: '3px 8px', background: '#fff', border: '1px solid #FCD34D',
                borderRadius: 999, fontSize: 11, color: '#92400E', fontWeight: 800,
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {improvements.length > 0 && (
        <div>
          <div style={{ fontWeight: 900, fontSize: 12, color: 'var(--wsl-ink)', marginBottom: 6 }}>
            {t('cv.ats.improvements', isAr ? 'اقتراحات للتحسين' : 'Improvements')}
          </div>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, color: 'var(--wsl-ink-2)', lineHeight: 1.6 }}>
            {improvements.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--wsl-ink-2)' }}>
        <span style={{ fontWeight: 800, fontFamily: 'Cairo, Inter, sans-serif' }}>{label}</span>
        <span style={{ fontWeight: 900, fontFamily: 'Cairo, Inter, sans-serif' }}>{score}/{max}</span>
      </div>
      <div style={{ height: 6, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0A8F84, #0ea5e9)' }} />
      </div>
    </div>
  );
}

function CompareModal({ data, isAr, t, onClose }: { data: any; isAr: boolean; t: any; onClose: () => void }) {
  const metrics = data.metrics || {};
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, maxWidth: 920, width: '100%',
          maxHeight: '90vh', overflow: 'auto', padding: 24,
          fontFamily: 'Cairo, Inter, sans-serif',
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitCompare size={20} style={{ color: '#0A8F84' }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--wsl-ink)' }}>
              {t('cv.compare.title', isAr ? 'مقارنة السيرتين' : 'CV Comparison')}
            </h2>
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: '#F3F4F6', cursor: 'pointer',
            width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ padding: 12, borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#991B1B', marginBottom: 4 }}>
              {isAr ? 'الأقدم' : 'Older'}
            </div>
            <div style={{ fontWeight: 900, fontSize: 13, color: 'var(--wsl-ink)' }}>{data.older?.targetRole || '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', marginTop: 2, textTransform: 'capitalize' }}>
              {(data.older?.template || '').replace('-', ' ')}
              {' · '}
              {data.older?.createdAt && new Date(data.older.createdAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            {typeof data.older?.atsScore === 'number' && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#991B1B', fontWeight: 800 }}>ATS {data.older.atsScore}</div>
            )}
          </div>
          <div style={{ padding: 12, borderRadius: 10, border: '1px solid #A7F3D0', background: '#ECFDF5' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#065F46', marginBottom: 4 }}>
              {isAr ? 'الأحدث' : 'Newer'}
            </div>
            <div style={{ fontWeight: 900, fontSize: 13, color: 'var(--wsl-ink)' }}>{data.newer?.targetRole || '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', marginTop: 2, textTransform: 'capitalize' }}>
              {(data.newer?.template || '').replace('-', ' ')}
              {' · '}
              {data.newer?.createdAt && new Date(data.newer.createdAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            {typeof data.newer?.atsScore === 'number' && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#065F46', fontWeight: 800 }}>ATS {data.newer.atsScore}</div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 8, color: 'var(--wsl-ink)' }}>
            {t('cv.compare.changes', isAr ? 'الفروقات' : 'Changes')}
          </div>
          <div style={{
            padding: 14, borderRadius: 10, border: '1px solid var(--wsl-border, #E5E7EB)',
            background: '#FAFAFA', fontSize: 12, lineHeight: 1.7,
            whiteSpace: 'pre-wrap', maxHeight: 380, overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}>
            {(data.segments || []).map((seg: any, i: number) => (
              <span
                key={i}
                style={{
                  background: seg.type === 'added' ? '#DCFCE7' : seg.type === 'removed' ? '#FEE2E2' : 'transparent',
                  color: seg.type === 'added' ? '#166534' : seg.type === 'removed' ? '#991B1B' : 'var(--wsl-ink-2)',
                  textDecoration: seg.type === 'removed' ? 'line-through' : 'none',
                  padding: seg.type === 'unchanged' ? 0 : '1px 2px',
                  borderRadius: 3,
                }}
              >
                {seg.text}
              </span>
            ))}
          </div>
        </div>

        <div style={{
          padding: 12, borderRadius: 10, background: '#EFF6FF',
          border: '1px solid #BFDBFE', fontSize: 12,
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <span>✅ <strong>{metrics.wordsAdded || 0}</strong> {t('cv.compare.wordsAdded', isAr ? 'كلمة مضافة' : 'words added')}</span>
          <span>❌ <strong>{metrics.wordsRemoved || 0}</strong> {t('cv.compare.wordsRemoved', isAr ? 'كلمة محذوفة' : 'words removed')}</span>
          {metrics.atsDelta !== null && typeof metrics.atsDelta === 'number' && (
            <span style={{ color: metrics.atsDelta >= 0 ? '#166534' : '#991B1B', fontWeight: 800 }}>
              📊 ATS Delta: {metrics.atsDelta >= 0 ? '+' : ''}{metrics.atsDelta}
            </span>
          )}
        </div>
      </div>
    </div>
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

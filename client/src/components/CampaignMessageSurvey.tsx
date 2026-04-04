import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

interface CampaignMessageSurveyProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: {
    purpose: string;
    tone: string;
    context: string;
  }) => Promise<void>;
  messageType: 'connection_note' | 'follow_up';
  prospectName?: string;
  prospectTitle?: string;
  prospectCompany?: string;
}

const PURPOSES = [
  { id: 'networking', icon: '🤝', label: { ar: 'تواصل مهني', en: 'Networking' } },
  { id: 'sales',      icon: '💼', label: { ar: 'مبيعات',    en: 'Sales' } },
  { id: 'recruiting', icon: '🎯', label: { ar: 'توظيف',     en: 'Recruiting' } },
  { id: 'partnership',icon: '🤲', label: { ar: 'شراكة',     en: 'Partnership' } },
];

const TONES = [
  { id: 'professional', label: { ar: 'رسمي',   en: 'Professional' } },
  { id: 'friendly',     label: { ar: 'ودي',    en: 'Friendly' } },
  { id: 'direct',       label: { ar: 'مباشر',  en: 'Direct' } },
];

export default function CampaignMessageSurvey({
  isOpen, onClose, onGenerate,
  messageType, prospectName, prospectTitle,
}: CampaignMessageSurveyProps) {
  const { i18n } = useTranslation();
  const { accessToken } = useAuth();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const isAr = lang === 'ar';

  const [purpose, setPurpose] = useState('');
  const [tone, setTone] = useState('');
  const [context, setContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputLang, setOutputLang] = useState<'ar' | 'en'>(lang);
  const [senderProfile, setSenderProfile] = useState<{ name: string; headline: string; photoUrl: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPurpose('');
      setTone('');
      setContext('');
      setIsGenerating(false);
      return;
    }
    if (!accessToken) return;
    fetch('/api/linkedin/profile', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => {
        if (d.fullName) setSenderProfile({ name: d.fullName, headline: d.headline || '', photoUrl: d.photoUrl || '' });
      })
      .catch(() => {});
  }, [isOpen, accessToken]);

  const handleGenerate = async () => {
    if (!purpose || !tone) return;
    setIsGenerating(true);
    try {
      await onGenerate({ purpose, tone, context });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />

          {/* Side Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-96 bg-[var(--bg-card)] shadow-2xl z-50 flex flex-col overflow-hidden"
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm">✨</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {isAr ? 'وصل AI' : 'Wassel AI'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {isAr ? 'اكتب الرسالة المثالية فوراً' : 'Write the perfect message instantly'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Sender profile card */}
              {senderProfile && (
                <div className="flex items-center gap-3 bg-[var(--bg-base)] rounded-xl p-3">
                  {senderProfile.photoUrl ? (
                    <img
                      src={`/api/proxy-image?url=${encodeURIComponent(senderProfile.photoUrl)}`}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {senderProfile.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{senderProfile.name}</p>
                    {senderProfile.headline && (
                      <p className="text-xs text-gray-500 truncate">{senderProfile.headline}</p>
                    )}
                  </div>
                  <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">in</span>
                  </div>
                </div>
              )}

              {/* Prospect pill */}
              {prospectName && (
                <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
                  <span className="text-blue-500 text-xs font-medium">
                    {isAr ? '← إلى:' : 'To:'}
                  </span>
                  <span className="text-blue-800 text-xs font-semibold truncate">
                    {prospectName}{prospectTitle && ` · ${prospectTitle}`}
                  </span>
                </div>
              )}

              {/* Language Toggle */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  {isAr ? 'لغة الرسالة' : 'Message Language'}
                </label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    onClick={() => setOutputLang('ar')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      outputLang === 'ar' ? 'bg-[var(--bg-card)] shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    🇸🇦 <span>عربي</span>
                  </button>
                  <button
                    onClick={() => setOutputLang('en')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      outputLang === 'en' ? 'bg-[var(--bg-card)] shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    🇬🇧 <span>English</span>
                  </button>
                </div>
              </div>

              {/* Q1: Purpose */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  {isAr ? 'الهدف (مطلوب)' : 'Target (required)'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PURPOSES.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPurpose(p.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        purpose === p.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-[var(--bg-card)]'
                      }`}
                    >
                      <span className="text-base">{p.icon}</span>
                      <span className="truncate">{p.label[lang]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2: Tone */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  {isAr ? 'أسلوب الرسالة (مطلوب)' : 'Tone (required)'}
                </label>
                <div className="flex gap-2">
                  {TONES.map(tn => (
                    <button
                      key={tn.id}
                      onClick={() => setTone(tn.id)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                        tone === tn.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      {tn.label[lang]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q3: Context */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                  {isAr ? 'ملاحظة سريعة (اختياري)' : 'Quick context (optional)'}
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={e => setContext(e.target.value.slice(0, 100))}
                  placeholder={isAr
                    ? 'مثال: أبحث عن شراكة في قطاع التقنية...'
                    : 'e.g. looking for tech sector partnerships...'}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
                  dir={isAr ? 'rtl' : 'ltr'}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{context.length}/100</p>
              </div>

            </div>

            {/* Footer — Generate button */}
            <div className="px-5 py-4 border-t border-gray-100 bg-[var(--bg-card)]">
              <button
                onClick={handleGenerate}
                disabled={!purpose || !tone || isGenerating}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  purpose && tone && !isGenerating
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90 shadow-lg shadow-blue-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {isAr ? 'جاري الكتابة...' : 'Writing...'}
                  </>
                ) : (
                  <>✨ {isAr ? 'كتابة الرسالة' : 'Generate Message'}</>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                {isAr ? 'رسالة جديدة في كل مرة ✨' : 'Fresh message every time ✨'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

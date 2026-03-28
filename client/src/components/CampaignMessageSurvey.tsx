import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const isAr = lang === 'ar';

  const [purpose, setPurpose] = useState('');
  const [tone, setTone] = useState('');
  const [context, setContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPurpose('');
      setTone('');
      setContext('');
      setIsGenerating(false);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 text-base">
              ✨ {isAr ? 'اكتب مع وصل AI' : 'Write with Wassel AI'}
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Prospect pill */}
          {prospectName && (
            <div className="bg-blue-50 rounded-xl px-3 py-2 mb-4 flex items-center gap-2">
              <span className="text-blue-600 text-xs">
                👤 {isAr ? 'إلى:' : 'To:'}
              </span>
              <span className="text-blue-800 text-xs font-medium truncate">
                {prospectName}{prospectTitle && ` · ${prospectTitle}`}
              </span>
            </div>
          )}

          {/* Q1: Purpose */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-2" style={{ textAlign: isAr ? 'right' : 'left' }}>
              {isAr ? 'ما هدف رسالتك؟' : 'What is your goal?'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PURPOSES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPurpose(p.id)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all ${
                    purpose === p.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className="text-lg">{p.icon}</span>
                  <span>{p.label[lang]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Q2: Tone */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-600 mb-2" style={{ textAlign: isAr ? 'right' : 'left' }}>
              {isAr ? 'أسلوب الرسالة' : 'Message tone'}
            </p>
            <div className="flex gap-2">
              {TONES.map(tn => (
                <button
                  key={tn.id}
                  onClick={() => setTone(tn.id)}
                  className={`flex-1 py-2 px-1 rounded-xl border-2 text-xs font-medium transition-all ${
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

          {/* Q3: Quick context */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-600 mb-2" style={{ textAlign: isAr ? 'right' : 'left' }}>
              {isAr ? 'ملاحظة سريعة (اختياري)' : 'Quick context (optional)'}
            </p>
            <input
              type="text"
              value={context}
              onChange={e => setContext(e.target.value.slice(0, 100))}
              placeholder={isAr ? 'مثال: أعمل في تقنية، أبحث عن شراكة...' : 'e.g. I work in tech, looking for partnership...'}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 placeholder:text-gray-400"
              style={{ textAlign: isAr ? 'right' : 'left' }}
              dir={isAr ? 'rtl' : 'ltr'}
            />
            <p className="text-xs text-gray-400 mt-1" style={{ textAlign: isAr ? 'right' : 'left' }}>
              {context.length}/100
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={!purpose || !tone || isGenerating}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                purpose && tone && !isGenerating
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90'
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
                <>✨ {isAr ? 'كتابة الرسالة' : 'Write Message'}</>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

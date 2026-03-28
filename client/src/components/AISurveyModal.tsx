import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type Purpose = 'sales' | 'job_search' | 'recruiting' | 'hiring' | 'networking' | 'partnership';
type Tone = 'professional' | 'friendly' | 'casual';
type PostType = 'opinion' | 'results' | 'success' | 'question';

export interface AIMessageConfig {
  purpose: Purpose;
  tone: Tone;
  senderContext: string;
  specificGoal: string;
  postType?: PostType;
}

interface AISurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: AIMessageConfig) => void;
  isGenerating?: boolean;
  showPostType?: boolean;
  prospectName?: string;
  prospectTitle?: string;
  prospectCompany?: string;
}

const purposeOptions: { key: Purpose; icon: string; labelKey: string }[] = [
  { key: 'sales', icon: '💼', labelKey: 'ai.purposeSales' },
  { key: 'job_search', icon: '🔍', labelKey: 'ai.purposeJobSearch' },
  { key: 'recruiting', icon: '🎯', labelKey: 'ai.purposeRecruiting' },
  { key: 'hiring', icon: '📢', labelKey: 'ai.purposeHiring' },
  { key: 'networking', icon: '🤝', labelKey: 'ai.purposeNetworking' },
  { key: 'partnership', icon: '🤝', labelKey: 'ai.purposePartnership' },
];

const toneOptions: { key: Tone; labelKey: string }[] = [
  { key: 'professional', labelKey: 'ai.toneProfessional' },
  { key: 'friendly', labelKey: 'ai.toneFriendly' },
  { key: 'casual', labelKey: 'ai.toneCasual' },
];

const postTypeOptions: { key: PostType; icon: string; labelKey: string }[] = [
  { key: 'opinion', icon: '💡', labelKey: 'ai.postTypeOpinion' },
  { key: 'results', icon: '📊', labelKey: 'ai.postTypeResults' },
  { key: 'success', icon: '📖', labelKey: 'ai.postTypeSuccess' },
  { key: 'question', icon: '❓', labelKey: 'ai.postTypeQuestion' },
];

export default function AISurveyModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating = false,
  showPostType = false,
}: AISurveyModalProps) {
  const { t, i18n } = useTranslation();
  const { accessToken } = useAuth();
  const isAr = i18n.language === 'ar';

  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [tone, setTone] = useState<Tone | null>(null);
  const [senderContext, setSenderContext] = useState('');
  const [specificGoal, setSpecificGoal] = useState('');
  const [postType, setPostType] = useState<PostType | null>(null);
  const [outputLang, setOutputLang] = useState<'ar' | 'en'>(isAr ? 'ar' : 'en');
  const [senderProfile, setSenderProfile] = useState<{ name: string; headline: string; photoUrl: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !accessToken) return;
    fetch('/api/linkedin/profile', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => {
        if (d.fullName) setSenderProfile({ name: d.fullName, headline: d.headline || '', photoUrl: d.photoUrl || '' });
      })
      .catch(() => {});
  }, [isOpen, accessToken]);

  const canGenerate = purpose && tone && !isGenerating;

  const handleGenerate = () => {
    if (!purpose || !tone) return;
    onGenerate({
      purpose,
      tone,
      senderContext,
      specificGoal,
      postType: postType || undefined,
    });
  };

  const selStyle = (selected: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 10,
    border: selected ? '2px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
    background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: selected ? 600 : 400,
    color: selected ? '#a78bfa' : 'var(--text-secondary)',
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
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
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9998, backdropFilter: 'blur(2px)' }}
          />

          {/* Side Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            dir={isAr ? 'rtl' : 'ltr'}
            style={{
              position: 'fixed', right: 0, top: 0, height: '100%', width: 400,
              background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-subtle)',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
              zIndex: 9999, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>✨</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {t('ai.modalTitle')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {isAr ? 'اكتب الرسالة المثالية فوراً' : 'Write the perfect message instantly'}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, borderRadius: 8 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Sender profile card */}
              {senderProfile && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  {senderProfile.photoUrl ? (
                    <img
                      src={`/api/proxy-image?url=${encodeURIComponent(senderProfile.photoUrl)}`}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: '#fff',
                    }}>
                      {senderProfile.name.charAt(0)}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {senderProfile.name}
                    </div>
                    {senderProfile.headline && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {senderProfile.headline}
                      </div>
                    )}
                  </div>
                  <div style={{
                    width: 24, height: 24, background: '#0a66c2', borderRadius: 4, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#fff',
                  }}>in</div>
                </div>
              )}

              {/* Language Toggle */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {isAr ? 'لغة الرسالة' : 'Message Language'}
                </div>
                <div style={{ display: 'flex', gap: 6, padding: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                  {(['ar', 'en'] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => setOutputLang(l)}
                      style={{
                        flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: outputLang === l ? 'rgba(124,58,237,0.15)' : 'transparent',
                        border: outputLang === l ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                        color: outputLang === l ? '#a78bfa' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      {l === 'ar' ? <><span>🇸🇦</span> عربي</> : <><span>🇬🇧</span> English</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q1 — Purpose */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {t('ai.purpose')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {purposeOptions.map(opt => (
                    <div key={opt.key} onClick={() => setPurpose(opt.key)} style={selStyle(purpose === opt.key)}>
                      <span style={{ fontSize: 18, display: 'block', marginBottom: 2 }}>{opt.icon}</span>
                      {t(opt.labelKey)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Q2 — Tone */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {t('ai.tone')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {toneOptions.map(opt => (
                    <div key={opt.key} onClick={() => setTone(opt.key)} style={{ ...selStyle(tone === opt.key), flex: 1 }}>
                      {t(opt.labelKey)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Q5 — Post Type (posts only) */}
              {showPostType && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    {t('ai.postType')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {postTypeOptions.map(opt => (
                      <div key={opt.key} onClick={() => setPostType(opt.key)} style={selStyle(postType === opt.key)}>
                        <span style={{ fontSize: 16, marginInlineEnd: 4 }}>{opt.icon}</span>
                        {t(opt.labelKey)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Q3 — Sender Context */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  {t('ai.context')}
                </div>
                <input
                  type="text"
                  value={senderContext}
                  onChange={e => setSenderContext(e.target.value.slice(0, 150))}
                  placeholder={t('ai.contextPlaceholder')}
                  style={inputStyle}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', float: 'inline-end' }}>{senderContext.length}/150</span>
              </div>

              {/* Q4 — Goal */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  {t('ai.goal')}
                </div>
                <input
                  type="text"
                  value={specificGoal}
                  onChange={e => setSpecificGoal(e.target.value.slice(0, 150))}
                  placeholder={t('ai.goalPlaceholder')}
                  style={inputStyle}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', float: 'inline-end' }}>{specificGoal.length}/150</span>
              </div>

            </div>

            {/* Footer — Generate button */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  style={{
                    flex: 2, padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    background: canGenerate ? 'linear-gradient(135deg, #7c3aed, #3b82f6)' : 'rgba(255,255,255,0.08)',
                    border: 'none', color: canGenerate ? '#fff' : 'var(--text-muted)',
                    cursor: canGenerate ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: canGenerate ? 1 : 0.5,
                    boxShadow: canGenerate ? '0 4px 20px rgba(124,58,237,0.3)' : 'none',
                  }}
                >
                  {isGenerating ? (
                    <><Loader2 size={14} className="animate-spin" /> {t('ai.generating')}</>
                  ) : (
                    <>✨ {t('ai.generate')}</>
                  )}
                </button>
              </div>
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                {isAr ? 'رسالة جديدة في كل مرة ✨' : 'Fresh message every time ✨'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import { useState, useEffect } from 'react';
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
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [tone, setTone] = useState<Tone | null>(null);
  const [senderContext, setSenderContext] = useState('');
  const [specificGoal, setSpecificGoal] = useState('');
  const [postType, setPostType] = useState<PostType | null>(null);
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

  if (!isOpen) return null;

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

  const cardStyle = (selected: boolean): React.CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 10,
    border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
    background: selected ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.04)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: selected ? 600 : 400,
    color: selected ? 'var(--accent-secondary)' : 'var(--text-secondary)',
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
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 16, padding: 28, maxWidth: 480, width: '90%',
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('ai.modalTitle')}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Sender profile card */}
        {senderProfile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, padding: '8px 12px', marginBottom: 16,
          }}>
            {senderProfile.photoUrl ? (
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(senderProfile.photoUrl)}`}
                alt=""
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff',
              }}>
                {senderProfile.name.charAt(0)}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {senderProfile.name}
              </div>
              {senderProfile.headline && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {senderProfile.headline}
                </div>
              )}
            </div>
            <span style={{ fontSize: 11, color: '#0a66c2', fontWeight: 700, flexShrink: 0 }}>in</span>
          </div>
        )}

        {/* Q1 — Purpose */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            {t('ai.purpose')}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {purposeOptions.map(opt => (
              <div
                key={opt.key}
                onClick={() => setPurpose(opt.key)}
                style={cardStyle(purpose === opt.key)}
              >
                <span style={{ fontSize: 18, display: 'block', marginBottom: 2 }}>{opt.icon}</span>
                {t(opt.labelKey)}
              </div>
            ))}
          </div>
        </div>

        {/* Q2 — Tone */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            {t('ai.tone')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {toneOptions.map(opt => (
              <div
                key={opt.key}
                onClick={() => setTone(opt.key)}
                style={{ ...cardStyle(tone === opt.key), flex: 1 }}
              >
                {t(opt.labelKey)}
              </div>
            ))}
          </div>
        </div>

        {/* Q5 — Post Type (posts only) */}
        {showPostType && (
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {t('ai.postType')}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {postTypeOptions.map(opt => (
                <div
                  key={opt.key}
                  onClick={() => setPostType(opt.key)}
                  style={cardStyle(postType === opt.key)}
                >
                  <span style={{ fontSize: 16, marginInlineEnd: 4 }}>{opt.icon}</span>
                  {t(opt.labelKey)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Q3 — Sender Context */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {t('ai.context')}
          </label>
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
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {t('ai.goal')}
          </label>
          <input
            type="text"
            value={specificGoal}
            onChange={e => setSpecificGoal(e.target.value.slice(0, 150))}
            placeholder={t('ai.goalPlaceholder')}
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', float: 'inline-end' }}>{specificGoal.length}/150</span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
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
              flex: 2, padding: '11px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: canGenerate ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.08)',
              border: 'none', color: canGenerate ? '#fff' : 'var(--text-muted)',
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: canGenerate ? 1 : 0.5,
            }}
          >
            {isGenerating ? (
              <><Loader2 size={14} className="animate-spin" /> {t('ai.generating')}</>
            ) : (
              t('ai.generate')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2, AlertTriangle, Lightbulb, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SectionView } from './types';

interface Props {
  section: SectionView;
  active: boolean;
  isRTL: boolean;
  onClick: () => void;
}

function statusVisual(status: SectionView['status']) {
  if (status === 'good') return { Icon: CheckCircle2, color: '#16a34a', bg: '#dcfce7' };
  if (status === 'needs_improvement') return { Icon: AlertTriangle, color: '#d97706', bg: '#fef3c7' };
  return { Icon: Lightbulb, color: '#ca8a04', bg: '#fef9c3' };
}

export default function SectionListItem({ section, active, isRTL, onClick }: Props) {
  const { Icon: StatusIcon, color: statusColor, bg: statusBg } = statusVisual(section.status);
  const SectionIcon = section.icon;
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
      onMouseUp={(e) => e.currentTarget.style.transform = ''}
      onMouseLeave={(e) => e.currentTarget.style.transform = ''}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        background: active ? '#0f172a' : '#ffffff',
        color: active ? '#f8fafc' : '#1f2937',
        border: `1px solid ${active ? '#0f172a' : '#e5e7eb'}`,
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: isRTL ? 'right' : 'left',
        fontFamily: 'Cairo, Inter, sans-serif',
        transition: 'transform 120ms, background 120ms',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
      onFocus={(e) => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
      onBlur={(e) => { if (!active) e.currentTarget.style.background = '#ffffff'; }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        display: 'grid', placeItems: 'center',
        background: active ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
        flexShrink: 0,
      }}>
        <SectionIcon size={16} color={active ? '#e2e8f0' : '#475569'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{section.name}</span>
          {section.isPerfect && (
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
              color: active ? '#022c22' : '#065f46',
              background: active ? '#5eead4' : '#a7f3d0',
              padding: '1px 6px', borderRadius: 999, flexShrink: 0,
            }}>
              {isRTL ? 'مثالي' : 'PERFECT'}
            </span>
          )}
        </div>
        {typeof section.score === 'number' && (
          <div style={{ fontSize: 11, fontWeight: 600,
              color: active ? '#cbd5e1' : '#64748b', marginTop: 2 }}>
            {section.score} / 100
          </div>
        )}
      </div>
      <div style={{
        width: 24, height: 24, borderRadius: 999,
        background: active ? 'rgba(255,255,255,0.15)' : statusBg,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <StatusIcon size={14} color={active ? '#f8fafc' : statusColor} />
      </div>
      <ChevronIcon size={14} color={active ? '#cbd5e1' : '#94a3b8'} style={{ flexShrink: 0 }} />
    </button>
  );
}

import { useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CheckCircle2,
  AlertTriangle, Lightbulb, ExternalLink, ClipboardList,
} from 'lucide-react';
import type { SectionView } from './types';

interface Props {
  section: SectionView;
  index: number;
  total: number;
  isRTL: boolean;
  labels: {
    backToList: string;
    prev: string;
    next: string;
    sectionCounter: string; // "{current} / {total}"
    lookingGood: string;
    needsImprovement: string;
    opportunity: string;
    noFeedback: string;
    openOnLinkedIn: string;
    currentLabel: string;
    suggestedLabel: string;
    checklist: string;
    moreInfo: string;
    copy: string;
    copied: string;
  };
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCopy: (text: string) => void;
}

function statusMeta(section: SectionView, labels: Props['labels']) {
  if (section.status === 'good') {
    return {
      Icon: CheckCircle2,
      label: labels.lookingGood,
      bg: '#dcfce7',
      border: '#86efac',
      fg: '#166534',
    };
  }
  if (section.status === 'needs_improvement') {
    return {
      Icon: AlertTriangle,
      label: labels.needsImprovement,
      bg: '#fef3c7',
      border: '#fcd34d',
      fg: '#92400e',
    };
  }
  return {
    Icon: Lightbulb,
    label: labels.opportunity,
    bg: '#fef9c3',
    border: '#fde68a',
    fg: '#854d0e',
  };
}

export default function SectionDetailPanel({
  section, index, total, isRTL, labels,
  onBack, onPrev, onNext, onCopy,
}: Props) {
  // Keyboard navigation: Escape = back, ArrowLeft/ArrowRight = prev/next
  // (swapped in RTL so the arrow matches the visual direction)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onBack(); return; }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isRTL) onNext(); else onPrev();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isRTL) onPrev(); else onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isRTL, onBack, onPrev, onNext]);

  const meta = statusMeta(section, labels);
  const StatusIcon = meta.Icon;
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  const hasVerdict = !!section.verdict;
  const hasCurrent = !!section.currentText;
  const hasSuggested = !!section.suggestedText;
  const hasWhy = !!section.why;
  const hasChecklist = !!(section.checklist && section.checklist.length);
  const hasAnyBody = hasVerdict || hasCurrent || hasSuggested || hasWhy;

  const counter = labels.sectionCounter
    .replace('{current}', String(index + 1))
    .replace('{total}', String(total));

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      overflow: 'hidden',
      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top row: Back + counter */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
      }}>
        <button type="button" onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, color: '#0f766e',
            fontFamily: 'inherit',
          }}>
          <BackIcon size={14} />
          {labels.backToList}
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{counter}</span>
      </div>

      {/* Prev / Name / Next */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: '#0f172a', color: '#f8fafc',
      }}>
        <button type="button" onClick={onPrev} aria-label={labels.prev}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.08)', border: 'none',
            color: '#f8fafc', cursor: 'pointer', borderRadius: 8, padding: '6px 10px',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          }}>
          <PrevIcon size={14} />
          {labels.prev}
        </button>
        <div style={{ fontSize: 15, fontWeight: 800, textAlign: 'center', flex: 1, padding: '0 8px' }}>
          {section.name}
        </div>
        <button type="button" onClick={onNext} aria-label={labels.next}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.08)', border: 'none',
            color: '#f8fafc', cursor: 'pointer', borderRadius: 8, padding: '6px 10px',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          }}>
          {labels.next}
          <NextIcon size={14} />
        </button>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Description — static, 1 sentence */}
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{section.description}</div>

        {/* Status badge + verdict text */}
        <div style={{
          padding: 12, background: meta.bg, border: `1px solid ${meta.border}`,
          borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusIcon size={16} color={meta.fg} />
            <span style={{ fontSize: 13, fontWeight: 800, color: meta.fg }}>{meta.label}</span>
            {typeof section.score === 'number' && (
              <span style={{
                marginInlineStart: 'auto',
                fontSize: 12, fontWeight: 800, color: meta.fg,
                background: '#ffffff', padding: '2px 8px', borderRadius: 999,
                border: `1px solid ${meta.border}`,
              }}>
                {section.score} / 100
              </span>
            )}
          </div>
          {hasVerdict && (
            <div style={{ fontSize: 13, color: meta.fg, lineHeight: 1.6 }}>{section.verdict}</div>
          )}
        </div>

        {/* Current / Suggested */}
        {hasCurrent && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#64748b',
              letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
            }}>{labels.currentLabel}</div>
            <div style={{
              fontSize: 13, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}>{section.currentText}</div>
            <button type="button"
              onClick={() => onCopy(section.currentText || '')}
              style={{
                marginTop: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                border: '1px solid #cbd5e1', background: '#fff', color: '#475569',
                borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
              }}>{labels.copy}</button>
          </div>
        )}

        {hasSuggested && (
          <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, padding: 12 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#0f766e',
              letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6,
            }}>{labels.suggestedLabel}</div>
            <div style={{
              fontSize: 13, color: '#0f766e', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontWeight: 600,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}>{section.suggestedText}</div>
            <button type="button"
              onClick={() => onCopy(section.suggestedText || '')}
              style={{
                marginTop: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                border: 'none', background: '#14b8a6', color: '#fff',
                borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
              }}>{labels.copy}</button>
          </div>
        )}

        {/* Checklist — only if there's at least one item */}
        {hasChecklist && (
          <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, background: '#ffffff' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 8,
            }}>
              <ClipboardList size={14} />
              {labels.checklist}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {section.checklist!.map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <CheckCircle2 size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* More info — only if section.why exists */}
        {hasWhy && (
          <div style={{
            padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 10,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 800, color: '#1e40af', marginBottom: 6,
            }}>
              <Lightbulb size={14} />
              {labels.moreInfo}
            </div>
            <div style={{ fontSize: 13, color: '#1e3a8a', lineHeight: 1.6 }}>{section.why}</div>
          </div>
        )}

        {/* Empty-state fallback */}
        {!hasAnyBody && !hasChecklist && (
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, textAlign: 'center', padding: '14px 0' }}>
            {labels.noFeedback}
          </div>
        )}

        {/* LinkedIn deep-link for empty sections */}
        {section.editUrl && (
          <a href={section.editUrl} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 12px', fontSize: 13, fontWeight: 700,
              color: '#0f766e', background: '#ffffff', border: '1px dashed #14b8a6',
              borderRadius: 10, textDecoration: 'none',
            }}>
            {labels.openOnLinkedIn}
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ProjectorContent =
  | { type: 'text'; title?: string; body: string }
  | { type: 'kpi'; title?: string; metrics: Array<{ label: string; value: string | number; trend?: 'up' | 'down' | 'flat' }> }
  | { type: 'table'; title?: string; columns: string[]; rows: Array<Array<string | number>> }
  | { type: 'chart'; title?: string; bars: Array<{ label: string; value: number }>; max?: number }
  | { type: 'funnel'; title?: string; stages: Array<{ label: string; count: number }> }
  | { type: 'comparison'; title?: string; left: { label: string; value: string }; right: { label: string; value: string } }
  | { type: 'image'; title?: string; src: string; alt?: string };

export interface ProjectorScreenProps {
  content: ProjectorContent | null;
  /** ms to keep visible before auto-fade. Default 30000. */
  displayMs?: number;
  language?: 'ar' | 'en';
}

export default function ProjectorScreen({ content, displayMs = 30000, language = 'ar' }: ProjectorScreenProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!content) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), displayMs);
    return () => clearTimeout(t);
  }, [content, displayMs]);

  if (!content) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.4 }}
          style={{
            width: '100%',
            height: '100%',
            color: '#0F172A',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            direction: language === 'ar' ? 'rtl' : 'ltr',
            textAlign: language === 'ar' ? 'right' : 'left',
          }}
        >
          {content.title && (
            <div style={{ fontWeight: 800, fontSize: 14, color: '#7C2D12' }}>{content.title}</div>
          )}
          {renderBody(content)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function renderBody(c: ProjectorContent) {
  switch (c.type) {
    case 'text':
      return (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#0F172A' }}>{c.body}</div>
      );

    case 'kpi':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(c.metrics.length, 4)}, 1fr)`, gap: 12 }}>
          {c.metrics.map((m, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.6)', padding: 8, borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#7C2D12' }}>{m.label}</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#0F172A' }}>{m.value}</div>
              {m.trend && (
                <div style={{ fontSize: 10, color: m.trend === 'up' ? '#16A34A' : m.trend === 'down' ? '#DC2626' : '#475569' }}>
                  {m.trend === 'up' ? '▲' : m.trend === 'down' ? '▼' : '—'}
                </div>
              )}
            </div>
          ))}
        </div>
      );

    case 'table':
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {c.columns.map((col, i) => (
                <th
                  key={i}
                  style={{
                    background: 'rgba(124,45,18,0.12)',
                    padding: '4px 6px',
                    fontWeight: 700,
                    borderBottom: '1px solid rgba(124,45,18,0.3)',
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid rgba(124,45,18,0.1)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '3px 6px' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );

    case 'chart': {
      const max = c.max ?? Math.max(...c.bars.map((b) => b.value), 1);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {c.bars.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 80, color: '#0F172A' }}>{b.label}</span>
              <div style={{ flex: 1, background: 'rgba(124,45,18,0.1)', borderRadius: 4, height: 14, position: 'relative' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(b.value / max) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, #F59E0B, #EA580C)', borderRadius: 4 }}
                />
              </div>
              <span style={{ width: 40, textAlign: 'end', color: '#0F172A', fontWeight: 700 }}>{b.value}</span>
            </div>
          ))}
        </div>
      );
    }

    case 'funnel':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {c.stages.map((s, i) => {
            const max = c.stages[0]?.count || 1;
            const pct = (s.count / max) * 100;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 90 }}>{s.label}</span>
                <div style={{ flex: 1, height: 18, background: 'rgba(124,45,18,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    style={{
                      height: '100%',
                      background: `hsl(${20 + i * 18}, 70%, 50%)`,
                    }}
                  />
                </div>
                <span style={{ width: 50, textAlign: 'end', fontWeight: 700 }}>{s.count}</span>
              </div>
            );
          })}
        </div>
      );

    case 'comparison':
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.6)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#7C2D12' }}>{c.left.label}</div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{c.left.value}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.6)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#7C2D12' }}>{c.right.label}</div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>{c.right.value}</div>
          </div>
        </div>
      );

    case 'image':
      return (
        <img
          src={c.src}
          alt={c.alt || ''}
          style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 }}
        />
      );
  }
}

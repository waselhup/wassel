import { motion } from 'framer-motion';

export interface CohortAction {
  label: string;
  onClick: (userId: string) => void;
  variant?: 'primary' | 'secondary';
}

export interface CohortRow {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url?: string | null;
  meta: string; // short formatted text like "5 analyses · 12d old · 8 tokens left"
  badge?: { label: string; color: string; bg: string };
}

interface CohortCardProps {
  title: string;
  subtitle: string;
  emoji: string;
  accentColor: string;
  rows: CohortRow[];
  emptyLabel: string;
  viewAllLabel: string;
  actions?: CohortAction[];
  index?: number;
}

function initials(name: string | null, email: string | null): string {
  const base = (name || email || '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function CohortCard({
  title,
  subtitle,
  emoji,
  accentColor,
  rows,
  emptyLabel,
  viewAllLabel,
  actions = [],
  index = 0,
}: CohortCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '1px solid var(--wsl-border, #E5E7EB)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: 320,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontWeight: 900,
            fontSize: 15,
            color: 'var(--wsl-ink, #0F172A)',
          }}
        >
          <span style={{ fontSize: 18 }}>{emoji}</span>
          {title}
          <span
            dir="ltr"
            style={{
              padding: '2px 7px',
              borderRadius: 999,
              background: accentColor + '15',
              color: accentColor,
              fontSize: 11,
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              marginInlineStart: 'auto',
            }}
          >
            {rows.length}
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--wsl-ink-3, #6B7280)',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            fontWeight: 500,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 280,
          overflowY: 'auto',
          margin: '0 -4px',
          padding: '0 4px',
        }}
      >
        {rows.length === 0 ? (
          <div
            style={{
              padding: '36px 12px',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--wsl-ink-3, #6B7280)',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            }}
          >
            {emptyLabel}
          </div>
        ) : (
          rows.slice(0, 5).map((row) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 10,
                background: '#F9FAFB',
                border: '1px solid transparent',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = 'var(--wsl-border, #E5E7EB)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#F9FAFB';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: accentColor + '15',
                  color: accentColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  fontWeight: 900,
                  fontSize: 11,
                  overflow: 'hidden',
                }}
              >
                {row.avatar_url ? (
                  <img src={row.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initials(row.full_name, row.email)
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    fontWeight: 800,
                    fontSize: 12,
                    color: 'var(--wsl-ink, #0F172A)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.full_name || row.email || '—'}
                  {row.badge && (
                    <span
                      style={{
                        marginInlineStart: 6,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: row.badge.bg,
                        color: row.badge.color,
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                      }}
                    >
                      {row.badge.label}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--wsl-ink-3, #6B7280)',
                    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.meta}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 4 }}>
                {actions.map((a, ai) => (
                  <button
                    key={ai}
                    onClick={(e) => {
                      e.stopPropagation();
                      a.onClick(row.id);
                    }}
                    title={a.label}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--wsl-border, #E5E7EB)',
                      background: a.variant === 'primary' ? accentColor : '#fff',
                      color: a.variant === 'primary' ? '#fff' : accentColor,
                      cursor: 'pointer',
                      fontSize: 10,
                      fontWeight: 900,
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      whiteSpace: 'nowrap',
                      transition: 'transform 100ms ease',
                    }}
                    onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
                    onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {rows.length > 5 && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: accentColor,
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          {viewAllLabel} ({rows.length})
        </div>
      )}
    </motion.div>
  );
}

interface PaymentRow {
  id: string;
  user?: { email?: string | null; full_name?: string | null; plan?: string | null } | null;
  amount_sar?: number | string;
  amount?: number;
  status?: string;
  type?: string;
  description?: string;
  muyassar_transaction_id?: string | null;
  muyassar_invoice_id?: string | null;
  created_at: string;
  completed_at?: string | null;
}

interface PaymentTableProps {
  rows: PaymentRow[];
  emptyLabel: string;
  variant?: 'success' | 'failed' | 'refund';
  fmtSar: (n: number) => string;
  fmtDate: (iso: string) => string;
  isAr: boolean;
}

export default function PaymentTable({
  rows, emptyLabel, variant = 'success', fmtSar, fmtDate, isAr,
}: PaymentTableProps) {
  const variantColor = variant === 'failed' ? '#DC2626'
    : variant === 'refund' ? '#F59E0B'
    : '#10B981';
  const variantBg = variant === 'failed' ? '#FEF2F2'
    : variant === 'refund' ? '#FFFBEB'
    : '#ECFDF5';

  if (rows.length === 0) {
    return (
      <div style={{
        padding: '28px 16px', textAlign: 'center',
        background: variant === 'success' ? '#ECFDF5' : '#F9FAFB',
        borderRadius: 10,
        border: `1px solid ${variant === 'success' ? '#A7F3D0' : 'var(--wsl-border, #E5E7EB)'}`,
        fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        fontWeight: 700, fontSize: 12,
        color: variant === 'success' ? '#065F46' : 'var(--wsl-ink-3, #6B7280)',
      }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
      {rows.map((r) => {
        const amt = typeof r.amount_sar === 'string' ? Number(r.amount_sar) : (r.amount_sar ?? Math.abs(r.amount ?? 0));
        const moyasarId = r.muyassar_transaction_id || r.muyassar_invoice_id;
        return (
          <div
            key={r.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              background: '#F9FAFB',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {r.user?.full_name || r.user?.email || (isAr ? 'مجهول' : 'Unknown')}
              </div>
              <div dir="ltr" style={{ fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)', fontFamily: '"Thmanyah Sans", system-ui, sans-serif' }}>
                {fmtDate(r.completed_at || r.created_at)}
                {r.user?.plan ? <span style={{ marginInlineStart: 6, fontWeight: 800 }}>· {r.user.plan}</span> : null}
              </div>
            </div>

            {moyasarId && (
              <a
                href={`https://dashboard.moyasar.com/payments/${moyasarId}`}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                style={{
                  fontSize: 9, fontWeight: 700,
                  color: 'var(--wsl-ink-3, #6B7280)',
                  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                  textDecoration: 'underline', maxWidth: 90, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {moyasarId.slice(0, 12)}…
              </a>
            )}

            <span dir="ltr" style={{
              padding: '2px 8px', borderRadius: 999,
              background: variantBg, color: variantColor,
              fontSize: 10, fontWeight: 900,
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              textTransform: 'uppercase',
            }}>
              {r.status || r.type}
            </span>

            <span dir="ltr" style={{
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
              fontWeight: 900, fontSize: 13, color: variantColor,
              fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'end',
            }}>
              {fmtSar(amt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

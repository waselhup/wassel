import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  issue_date: string | null;
  total_sar: number | null;
  status: string | null;
  pdf_url: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

function fmtSar(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return iso;
  }
}

export default function ZatcaInvoicesTable() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await trpc.mohammed.listInvoices({ limit: 50 });
        if (!cancelled) setRows((data as InvoiceRow[]) || []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div style={{ padding: 24, color: '#9CA3AF', fontSize: 13 }}>{t('finance.zatcaLoading')}</div>;
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
        <FileText size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
        <div>{t('finance.zatcaEmpty')}</div>
      </div>
    );
  }

  const th: React.CSSProperties = {
    textAlign: 'start',
    padding: '10px 12px',
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
    fontWeight: 800, fontSize: 11, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.4,
    borderBottom: '1px solid #E5E7EB',
  };
  const td: React.CSSProperties = {
    padding: '12px',
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
    fontSize: 13, color: '#0F172A',
    borderBottom: '1px solid #F3F4F6',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>{t('finance.zatcaColInvoice')}</th>
            <th style={th}>{t('finance.zatcaColDate')}</th>
            <th style={th}>{t('finance.zatcaColCustomer')}</th>
            <th style={th}>{t('finance.zatcaColAmount')}</th>
            <th style={th}>{t('finance.zatcaColStatus')}</th>
            <th style={th}>{t('finance.zatcaColPdf')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ ...td, fontWeight: 700 }}>{r.invoice_number || '—'}</td>
              <td style={td}>{fmtDate(r.issue_date)}</td>
              <td style={td}>{r.profiles?.full_name || r.profiles?.email || '—'}</td>
              <td style={{ ...td, fontWeight: 700 }}>{fmtSar(r.total_sar)} ﷼</td>
              <td style={td}>
                <span style={{
                  display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                  background: r.status === 'paid' ? '#ECFDF5' : '#FEF3C7',
                  color: r.status === 'paid' ? '#065F46' : '#92400E',
                  fontSize: 11, fontWeight: 800,
                }}>
                  {r.status || '—'}
                </span>
              </td>
              <td style={td}>
                {r.pdf_url ? (
                  <a href={r.pdf_url} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    color: '#D4AF37', textDecoration: 'none', fontWeight: 700, fontSize: 12,
                  }}>
                    <Download size={12} /> PDF
                  </a>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

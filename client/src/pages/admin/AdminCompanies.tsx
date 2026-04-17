import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Building2, Search, Plus, Sparkles, CheckCircle2, XCircle,
  Loader2, Mail, MapPin, Briefcase, Trash2, Edit,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface Company {
  id: string;
  name: string;
  name_ar?: string | null;
  website?: string | null;
  industry?: string | null;
  city?: string | null;
  size?: string | null;
  primary_email?: string | null;
  contact_emails?: string[];
  verified?: boolean;
  last_enriched_at?: string | null;
}

type Toast = { id: number; type: 'success' | 'error'; message: string };

export default function AdminCompanies() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    name_ar: '',
    website: '',
    industry: '',
    city: 'Riyadh',
    size: 'medium' as 'startup' | 'small' | 'medium' | 'large' | 'enterprise',
    primary_email: '',
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  function pushToast(type: Toast['type'], message: string) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }

  async function load() {
    setLoading(true);
    try {
      const [list, inds] = await Promise.all([
        trpc.companies.list({ limit: 200 }),
        trpc.companies.industries(),
      ]);
      setCompanies(list);
      setIndustries(inds);
    } catch (e: any) {
      pushToast('error', e?.message || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      if (filterIndustry && c.industry !== filterIndustry) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !(c.name_ar || '').includes(search) &&
          !(c.industry || '').toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [companies, search, filterIndustry]);

  async function handleEnrich(c: Company) {
    setEnrichingId(c.id);
    try {
      const res = await trpc.companies.enrich({ id: c.id });
      pushToast('success', `Found ${res.emailsFound} email${res.emailsFound === 1 ? '' : 's'}`);
      await load();
    } catch (e: any) {
      pushToast('error', e?.message || 'Enrichment failed');
    } finally {
      setEnrichingId(null);
    }
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      pushToast('error', 'Name is required');
      return;
    }
    try {
      await trpc.companies.create({
        name: form.name,
        name_ar: form.name_ar || undefined,
        website: form.website || undefined,
        industry: form.industry || undefined,
        city: form.city,
        size: form.size,
        primary_email: form.primary_email || undefined,
      });
      pushToast('success', isAr ? 'تمت الإضافة' : 'Company added');
      setAddOpen(false);
      setForm({ name: '', name_ar: '', website: '', industry: '', city: 'Riyadh', size: 'medium', primary_email: '' });
      await load();
    } catch (e: any) {
      pushToast('error', e?.message || 'Create failed');
    }
  }

  async function handleDelete(c: Company) {
    if (!confirm(`Delete ${c.name}?`)) return;
    try {
      await trpc.companies.delete({ id: c.id });
      pushToast('success', 'Deleted');
      await load();
    } catch (e: any) {
      pushToast('error', e?.message || 'Delete failed');
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Toasts */}
      <div style={{ position: 'fixed', top: 20, insetInlineEnd: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              minWidth: 260,
              background: t.type === 'success' ? '#ECFDF5' : '#FEF2F2',
              color: t.type === 'success' ? '#065F46' : '#991B1B',
              border: `1px solid ${t.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
              fontFamily: 'Cairo, Inter, sans-serif',
              fontWeight: 700,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {t.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {t.message}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Building2 size={20} color="#0A8F84" />
          <h2 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink)', margin: 0 }}>
            {isAr ? 'دليل الشركات السعودية' : 'Saudi Companies Directory'}
          </h2>
          <span style={{ padding: '3px 10px', borderRadius: 999, background: '#F3F4F6', fontSize: 11, fontWeight: 800, color: '#6B7280' }}>
            {companies.length}
          </span>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            background: '#0A8F84',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Cairo, sans-serif',
            fontWeight: 800,
            fontSize: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={14} /> {isAr ? 'إضافة شركة' : 'Add company'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث...' : 'Search...'}
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              borderRadius: 10,
              border: '1px solid #E5E7EB',
              fontSize: 13,
              fontFamily: 'Cairo, sans-serif',
            }}
          />
        </div>
        <select
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'Cairo, sans-serif' }}
        >
          <option value="">{isAr ? 'كل الصناعات' : 'All industries'}</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Loader2 size={32} style={{ color: '#0A8F84', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ borderRadius: 14, background: '#fff', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#F9FAFB' }}>
              <tr>
                {(isAr
                  ? ['الشركة', 'الصناعة', 'المدينة', 'الحجم', 'البريد', 'إجراءات']
                  : ['Company', 'Industry', 'City', 'Size', 'Email', 'Actions']).map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'start',
                      fontFamily: 'Cairo, sans-serif',
                      fontWeight: 900,
                      fontSize: 11,
                      color: '#6B7280',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid #E5E7EB',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 14px', fontFamily: 'Cairo, sans-serif', fontSize: 13 }}>
                    <div style={{ fontWeight: 800, color: 'var(--wsl-ink)' }}>{c.name}</div>
                    {c.name_ar && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{c.name_ar}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#6B7280' }}>
                    {c.industry ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Briefcase size={11} /> {c.industry}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#6B7280' }}>
                    {c.city ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} /> {c.city}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#6B7280' }}>{c.size || '—'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12 }}>
                    {c.primary_email ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#065F46' }}>
                        <Mail size={11} /> {c.primary_email}
                      </span>
                    ) : (
                      <span style={{ color: '#D97706' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleEnrich(c)}
                        disabled={enrichingId === c.id}
                        title={isAr ? 'إثراء عبر Hunter.io' : 'Enrich via Hunter.io'}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: '#F0FDF4',
                          color: '#065F46',
                          border: '1px solid #BBF7D0',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {enrichingId === c.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={11} />}
                        {isAr ? 'إثراء' : 'Enrich'}
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: '#FEF2F2',
                          color: '#991B1B',
                          border: '1px solid #FECACA',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    {isAr ? 'لا توجد نتائج' : 'No results'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add company modal */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setAddOpen(false)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 14, padding: 24, width: '94vw', maxWidth: 460 }}>
            <h3 style={{ margin: '0 0 16px', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 17 }}>
              {isAr ? 'إضافة شركة جديدة' : 'Add new company'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Company name (EN)" />
              <Input value={form.name_ar} onChange={(v) => setForm({ ...form, name_ar: v })} placeholder="اسم الشركة (AR)" />
              <Input value={form.website} onChange={(v) => setForm({ ...form, website: v })} placeholder="website.com" />
              <Input value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} placeholder="Industry" />
              <Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="City" />
              <select
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value as any })}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'Cairo, sans-serif' }}
              >
                <option value="startup">Startup</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <Input value={form.primary_email} onChange={(v) => setForm({ ...form, primary_email: v })} placeholder="info@company.com" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setAddOpen(false)}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleAdd}
                style={{ padding: '8px 14px', borderRadius: 10, background: '#0A8F84', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'Cairo, sans-serif' }}
              >
                {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid #E5E7EB',
        fontSize: 13,
        fontFamily: 'Cairo, sans-serif',
      }}
    />
  );
}

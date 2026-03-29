import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, RefreshCw, Check, ExternalLink, X, Loader2, ArrowLeft, ArrowRight, Import } from 'lucide-react';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Prospect {
  name: string;
  title: string;
  company: string;
  location: string;
  linkedin_url: string;
  email: string;
  source: string;
  apollo_id?: string;
}

const INDUSTRIES = [
  'Technology', 'Oil & Gas', 'Finance', 'Healthcare',
  'Real Estate', 'Education', 'Government', 'Retail',
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

export default function ApolloSearch() {
  const { i18n } = useTranslation();
  const { accessToken } = useAuth();
  const isAr = i18n.language === 'ar';

  // Filter state
  const [jobTitlesInput, setJobTitlesInput] = useState('');
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [locationsInput, setLocationsInput] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [companySize, setCompanySize] = useState('');
  const [keywords, setKeywords] = useState('');
  const [limit, setLimit] = useState(25);

  // Results state
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [imported, setImported] = useState(false);

  function addTag(value: string, list: string[], setter: (v: string[]) => void, inputSetter: (v: string) => void) {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) setter([...list, trimmed]);
    inputSetter('');
  }

  function removeTag(index: number, list: string[], setter: (v: string[]) => void) {
    setter(list.filter((_, i) => i !== index));
  }

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    setSelected(new Set());
    setImported(false);
    try {
      const res = await fetch('/api/apollo/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ jobTitles, locations, industries: selectedIndustries, companySize, keywords, limit }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || 'فشل البحث');
        setProspects([]);
      } else {
        setProspects(data.prospects || []);
        setTotal(data.total || 0);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setJobTitles([]); setJobTitlesInput('');
    setLocations([]); setLocationsInput('');
    setSelectedIndustries([]); setCompanySize('');
    setKeywords(''); setLimit(25);
    setProspects([]); setSearched(false); setSelected(new Set());
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === prospects.length) setSelected(new Set());
    else setSelected(new Set(prospects.map((_, i) => i)));
  };

  const handleImport = async () => {
    if (!selected.size) return;
    setImporting(true);
    try {
      const toImport = [...selected].map(i => prospects[i]);
      const res = await fetch('/api/apollo/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ prospects: toImport }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'فشل الاستيراد'); return; }
      toast.success(`تم استيراد ${data.imported} عميل بنجاح ✅`);
      setImported(true);
      setShowConfirm(false);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  const tagStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 100,
    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
    fontSize: 12, color: '#A5B4FC', cursor: 'default',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8, color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block',
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', direction: isAr ? 'rtl' : 'ltr' }}>
      <ClientNav />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Page header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔍</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {isAr ? 'بحث Apollo' : 'Apollo Search'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              {isAr ? 'ابحث عن عملاء محتملين واستوردهم مباشرة' : 'Find and import prospects directly'}
            </p>
          </div>
          {imported && (
            <a href="/app/leads" style={{ marginInlineStart: 'auto', fontSize: 13, color: '#6366F1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              {isAr ? 'عرض في قائمة العملاء' : 'View in Leads'} <ArrowLeft size={14} />
            </a>
          )}
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ─── LEFT SIDEBAR: Filters ─── */}
          <aside style={{
            width: 280, flexShrink: 0, borderInlineEnd: '1px solid var(--border-subtle)',
            overflowY: 'auto', padding: 20,
            background: 'var(--bg-surface)',
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
              {isAr ? 'فلاتر البحث' : 'Search Filters'}
            </h2>

            {/* Job Titles */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{isAr ? 'المسمى الوظيفي' : 'Job Title'}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {jobTitles.map((t, i) => (
                  <span key={i} style={tagStyle}>
                    {t}
                    <button onClick={() => removeTag(i, jobTitles, setJobTitles)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', padding: 0, display: 'flex' }}><X size={10} /></button>
                  </span>
                ))}
              </div>
              <input
                style={inputStyle}
                value={jobTitlesInput}
                onChange={e => setJobTitlesInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag(jobTitlesInput, jobTitles, setJobTitles, setJobTitlesInput)}
                placeholder={isAr ? 'CEO, مدير مبيعات... (Enter)' : 'CEO, Sales Manager... (Enter)'}
              />
            </div>

            {/* Locations */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{isAr ? 'الموقع' : 'Location'}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {locations.map((t, i) => (
                  <span key={i} style={tagStyle}>
                    {t}
                    <button onClick={() => removeTag(i, locations, setLocations)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', padding: 0, display: 'flex' }}><X size={10} /></button>
                  </span>
                ))}
              </div>
              <input
                style={inputStyle}
                value={locationsInput}
                onChange={e => setLocationsInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag(locationsInput, locations, setLocations, setLocationsInput)}
                placeholder={isAr ? 'الرياض، Saudi Arabia... (Enter)' : 'Riyadh, Saudi Arabia... (Enter)'}
              />
            </div>

            {/* Industries */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{isAr ? 'القطاع' : 'Industry'}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {INDUSTRIES.map(ind => (
                  <label key={ind} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={selectedIndustries.includes(ind)}
                      onChange={() => setSelectedIndustries(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind])}
                      style={{ accentColor: '#6366F1' }}
                    />
                    {ind}
                  </label>
                ))}
              </div>
            </div>

            {/* Company Size */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{isAr ? 'حجم الشركة' : 'Company Size'}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {COMPANY_SIZES.map(size => (
                  <label key={size} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <input
                      type="radio"
                      name="companySize"
                      value={size}
                      checked={companySize === size}
                      onChange={() => setCompanySize(size)}
                      style={{ accentColor: '#6366F1' }}
                    />
                    {size}
                  </label>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{isAr ? 'كلمات مفتاحية' : 'Keywords'}</label>
              <input
                style={inputStyle}
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder={isAr ? 'e.g. SaaS, B2B...' : 'e.g. SaaS, B2B...'}
              />
            </div>

            {/* Results limit */}
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>{isAr ? `عدد النتائج: ${limit}` : `Results: ${limit}`}</label>
              <input type="range" min={10} max={100} step={5} value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ width: '100%', accentColor: '#6366F1' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                <span>10</span><span>100</span>
              </div>
            </div>

            {/* Buttons */}
            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                color: '#fff', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 10, fontFamily: 'inherit',
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {isAr ? 'بحث' : 'Search'}
            </button>
            <button onClick={handleReset} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
              <RefreshCw size={14} /> {isAr ? 'إعادة تعيين' : 'Reset'}
            </button>
          </aside>

          {/* ─── RIGHT: Results ─── */}
          <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {!searched && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                <div style={{ fontSize: 64 }}>🔍</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {isAr ? 'ابحث عن عملائك المحتملين' : 'Search for prospects'}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 360 }}>
                  {isAr ? 'استخدم الفلاتر على اليمين للبحث عن عملاء محتملين من Apollo.io' : 'Use filters on the right to search prospects from Apollo.io'}
                </p>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                <Loader2 size={40} style={{ color: '#6366F1', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{isAr ? 'جاري البحث...' : 'Searching...'}</p>
              </div>
            )}

            {searched && !loading && prospects.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                <div style={{ fontSize: 48 }}>😔</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{isAr ? 'لا نتائج. جرّب تعديل الفلاتر.' : 'No results. Try adjusting filters.'}</p>
              </div>
            )}

            {searched && !loading && prospects.length > 0 && (
              <>
                {/* Results header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isAr ? `تم العثور على ${total} عميل محتمل` : `Found ${total} prospects`}
                  </span>
                  <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={toggleAll} style={{ fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
                      <Check size={14} /> {isAr ? 'تحديد الكل' : 'Select All'}
                    </button>
                    {selected.size > 0 && (
                      <button
                        onClick={() => setShowConfirm(true)}
                        style={{ fontSize: 13, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontFamily: 'inherit' }}
                      >
                        <Import size={14} /> {isAr ? `استيراد (${selected.size})` : `Import (${selected.size})`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Prospects table */}
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                  {/* Table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr 40px', gap: 0, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <div />
                    <div>{isAr ? 'الاسم' : 'Name'}</div>
                    <div>{isAr ? 'المسمى' : 'Title'}</div>
                    <div>{isAr ? 'الشركة' : 'Company'}</div>
                    <div>{isAr ? 'الموقع' : 'Location'}</div>
                    <div>LI</div>
                  </div>
                  {prospects.map((p, i) => (
                    <div
                      key={i}
                      onClick={() => toggleSelect(i)}
                      style={{
                        display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr 40px',
                        gap: 0, padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: selected.has(i) ? 'rgba(99,102,241,0.08)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!selected.has(i)) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected.has(i) ? 'rgba(99,102,241,0.08)' : 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: `2px solid ${selected.has(i) ? '#6366F1' : 'var(--border-subtle)'}`,
                          background: selected.has(i) ? '#6366F1' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {selected.has(i) && <Check size={11} style={{ color: '#fff' }} />}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${(i * 47) % 360},60%,50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {p.name?.charAt(0) || '?'}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || '—'}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>{p.title || '—'}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>{p.company || '—'}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>{p.location || '—'}</div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {p.linkedin_url ? (
                          <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#0A66C2' }}>
                            <ExternalLink size={14} />
                          </a>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Import Confirm Modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 16, padding: 28, maxWidth: 400, width: '100%', direction: isAr ? 'rtl' : 'ltr' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              {isAr ? 'تأكيد الاستيراد' : 'Confirm Import'}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
              {isAr
                ? `هل تريد استيراد ${selected.size} عميل محتمل إلى قائمة العملاء؟`
                : `Import ${selected.size} prospects to your leads list?`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                style={{ flex: 2, padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', border: 'none', color: '#fff', cursor: importing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Import size={16} />}
                {isAr ? 'استيراد' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

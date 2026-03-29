import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Users, Plus, ChevronDown, Loader2, Check } from 'lucide-react';
import ClientNav from '@/components/ClientNav';
import { useAuth } from '@/contexts/AuthContext';

const JOB_TITLES = [
  'CEO', 'CFO', 'COO', 'CTO', 'CMO',
  'HR Manager', 'HR Director', 'Talent Acquisition',
  'Sales Manager', 'Sales Director', 'Business Development',
  'Marketing Manager', 'Operations Manager',
  'Project Manager', 'General Manager',
  'Procurement Manager', 'Supply Chain Manager',
];

const LOCATIONS = [
  'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar',
  'Bahrain', 'Oman', 'Egypt', 'Jordan',
  'Lebanon', 'Morocco',
];

const INDUSTRIES = [
  'Oil & Gas', 'Technology', 'Healthcare',
  'Finance', 'Real Estate', 'Construction',
  'Education', 'Retail', 'Manufacturing', 'Government',
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

const AVATAR_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];

// ─── Multi-Select Dropdown ─────────────────────────────────────
function MultiSelect({
  label, options, selected, onChange, placeholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);

  return (
    <div className="mb-4">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
        {label}
      </label>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-blue-400 transition-all focus:outline-none"
        >
          <span className="truncate">
            {selected.length > 0 ? `${selected.length} selected` : placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-sm text-left transition-colors"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected.includes(opt) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {selected.includes(opt) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="truncate">{opt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ProspectDiscovery() {
  const { i18n } = useTranslation();
  const { accessToken } = useAuth();
  const isAr = i18n.language === 'ar';

  // Filters
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [limit, setLimit] = useState(50);

  // Results
  const [prospects, setProspects] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  // Selection / import
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const toggleSelect = (idx: number) => {
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);
  };
  const selectAll = () => setSelected(new Set(prospects.map((_, i) => i)));
  const clearAll = () => setSelected(new Set());

  const hasFilters = jobTitles.length > 0 || locations.length > 0 ||
    industries.length > 0 || companySizes.length > 0 || !!keywords;

  const handleSearch = async () => {
    if (!hasFilters) {
      setError(isAr ? 'اختر فلتراً واحداً على الأقل' : 'Select at least one filter');
      return;
    }
    setError('');
    setLoading(true);
    setSearched(true);
    setSelected(new Set());
    setImportedCount(0);
    try {
      const res = await fetch('/api/prospects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ jobTitles, locations, industries, companySizes, keywords, limit }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = isAr ? 'فشل البحث' : 'Search failed';
        try { msg = JSON.parse(text).error || msg; } catch { msg = `Server error (${res.status})`; }
        throw new Error(msg);
      }
      const data = await res.json();
      setProspects(data.prospects || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
      setProspects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selected.size) return;
    setImporting(true);
    try {
      const toImport = [...selected].map(i => prospects[i]);
      const res = await fetch('/api/prospects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ prospects: toImport }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = isAr ? 'فشل الاستيراد' : 'Import failed';
        try { msg = JSON.parse(text).error || msg; } catch { msg = `Server error (${res.status})`; }
        throw new Error(msg);
      }
      const data = await res.json();
      setImportedCount(data.imported || 0);
      setSelected(new Set());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)', direction: isAr ? 'rtl' : 'ltr' }}>
      <ClientNav />

      {/* ─── Filters Sidebar ─── */}
      <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden" style={{ background: 'var(--bg-surface)', borderInlineEnd: '1px solid var(--border-subtle)' }}>

        {/* Sidebar header */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {isAr ? 'اكتشاف العملاء' : 'Find Prospects'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isAr ? 'ابحث عن عملائك المثاليين' : 'Search your ideal prospects'}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Override MultiSelect styles to match dark theme when needed */}
          <style>{`
            .prospect-filter select, .prospect-filter input {
              color-scheme: light;
            }
          `}</style>

          <div className="prospect-filter">
            <MultiSelect
              label={isAr ? 'المسمى الوظيفي' : 'Job Title'}
              options={JOB_TITLES}
              selected={jobTitles}
              onChange={setJobTitles}
              placeholder={isAr ? 'اختر المسمى...' : 'Select titles...'}
            />

            <MultiSelect
              label={isAr ? 'الموقع الجغرافي' : 'Location'}
              options={LOCATIONS}
              selected={locations}
              onChange={setLocations}
              placeholder={isAr ? 'اختر الدولة...' : 'Select locations...'}
            />

            <MultiSelect
              label={isAr ? 'القطاع' : 'Industry'}
              options={INDUSTRIES}
              selected={industries}
              onChange={setIndustries}
              placeholder={isAr ? 'اختر القطاع...' : 'Select industry...'}
            />

            <MultiSelect
              label={isAr ? 'حجم الشركة' : 'Company Size'}
              options={COMPANY_SIZES}
              selected={companySizes}
              onChange={setCompanySizes}
              placeholder={isAr ? 'اختر الحجم...' : 'Select size...'}
            />
          </div>

          {/* Keywords */}
          <div className="mb-4">
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {isAr ? 'كلمات مفتاحية' : 'Keywords'}
            </label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={isAr ? 'مثال: أرامكو، رؤية 2030...' : 'e.g. Aramco, fintech...'}
              className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all placeholder:text-gray-400"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', direction: isAr ? 'rtl' : 'ltr' }}
            />
          </div>

          {/* Limit slider */}
          <div className="mb-6">
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {isAr ? `عدد النتائج: ${limit}` : `Results: ${limit}`}
            </label>
            <input type="range" min={10} max={500} step={10} value={limit} onChange={e => setLimit(Number(e.target.value))} className="w-full accent-indigo-500" />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              <span>10</span><span>500</span>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs mb-3 text-center">{error}</p>}
        </div>

        {/* Search button */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handleSearch}
            disabled={loading || !hasFilters}
            className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: hasFilters && !loading ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.06)',
              color: hasFilters && !loading ? '#fff' : 'var(--text-muted)',
              cursor: hasFilters && !loading ? 'pointer' : 'not-allowed',
              boxShadow: hasFilters && !loading ? '0 4px 20px rgba(99,102,241,0.35)' : 'none',
            }}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {isAr ? 'جاري البحث...' : 'Searching...'}</> : <><Search className="w-4 h-4" /> {isAr ? 'بحث عن عملاء' : 'Find Prospects'}</>}
          </button>
        </div>
      </div>

      {/* ─── Results Area ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Results header */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {!searched ? (isAr ? 'النتائج' : 'Results')
                : loading ? (isAr ? 'جاري البحث...' : 'Searching...')
                : isAr ? `${prospects.length} عميل محتمل` : `${prospects.length} prospects found`}
            </h3>
            {!loading && total > prospects.length && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isAr ? `من أصل ${total.toLocaleString()} نتيجة` : `of ${total.toLocaleString()} total`}
              </p>
            )}
          </div>

          {prospects.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {selected.size} {isAr ? 'محدد' : 'selected'}
              </span>
              <button onClick={selectAll} className="text-xs" style={{ color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer' }}>
                {isAr ? 'تحديد الكل' : 'Select all'}
              </button>
              <button onClick={clearAll} className="text-xs" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {isAr ? 'إلغاء' : 'Clear'}
              </button>
              <button
                onClick={handleImport}
                disabled={!selected.size || importing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: selected.size && !importing ? '#10B981' : 'rgba(255,255,255,0.06)',
                  color: selected.size && !importing ? '#fff' : 'var(--text-muted)',
                  border: 'none', cursor: selected.size && !importing ? 'pointer' : 'not-allowed',
                }}
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {isAr ? `إضافة للعملاء (${selected.size})` : `Add to Leads (${selected.size})`}
              </button>
            </div>
          )}
        </div>

        {/* Import success banner */}
        {importedCount > 0 && (
          <div className="mx-6 mt-4 flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-sm font-medium" style={{ color: '#10B981' }}>
              {isAr ? `تم إضافة ${importedCount} عميل إلى قائمة العملاء ✅` : `${importedCount} prospects added to your leads ✅`}
            </p>
            <a href="/app/leads" className="text-xs underline ms-auto" style={{ color: '#10B981' }}>
              {isAr ? 'عرض القائمة' : 'View leads'}
            </a>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-auto p-6">

          {/* Empty state */}
          {!searched && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <Search className="w-8 h-8" style={{ color: '#6366F1' }} />
              </div>
              <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                {isAr ? 'ابدأ البحث عن عملائك' : 'Start finding your prospects'}
              </h4>
              <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
                {isAr ? 'اختر الفلاتر من الشريط الجانبي واضغط بحث' : 'Select filters from the sidebar and click search'}
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-xs">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: '#6366F1' }} />
                <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {isAr ? 'جاري البحث عن عملائك...' : 'Finding your prospects...'}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {isAr ? 'قد يستغرق هذا 30-60 ثانية' : 'This may take 30-60 seconds'}
                </p>
                <div className="mt-4 flex justify-center gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#6366F1', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* No results */}
          {!loading && searched && prospects.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-muted)' }}>
                  {isAr ? 'لا توجد نتائج. جرّب فلاتر مختلفة.' : 'No results. Try different filters.'}
                </p>
              </div>
            </div>
          )}

          {/* Results table */}
          {!loading && prospects.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <table className="w-full">
                <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.size === prospects.length && prospects.length > 0}
                        onChange={e => e.target.checked ? selectAll() : clearAll()}
                        className="rounded accent-indigo-500"
                      />
                    </th>
                    {[
                      isAr ? 'الاسم' : 'Name',
                      isAr ? 'المسمى' : 'Title',
                      isAr ? 'الشركة' : 'Company',
                      isAr ? 'الموقع' : 'Location',
                      'LinkedIn',
                    ].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p, idx) => (
                    <tr
                      key={idx}
                      onClick={() => toggleSelect(idx)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--border-subtle)', background: selected.has(idx) ? 'rgba(99,102,241,0.08)' : 'transparent' }}
                      onMouseEnter={e => { if (!selected.has(idx)) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selected.has(idx) ? 'rgba(99,102,241,0.08)' : 'transparent'; }}
                    >
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleSelect(idx)} className="rounded accent-indigo-500" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt={p.name}
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${AVATAR_COLORS[idx % 5]}`}>
                              {p.avatar_initials || p.name?.[0] || '?'}
                            </div>
                          )}
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{p.title || '—'}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{p.company || '—'}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{p.location || '—'}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {p.linkedin_url ? (
                          <a
                            href={p.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium"
                            style={{ color: '#0A66C2', textDecoration: 'none' }}
                          >
                            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#0A66C2' }}>
                              <span className="text-white font-bold" style={{ fontSize: 8 }}>in</span>
                            </div>
                            Profile
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

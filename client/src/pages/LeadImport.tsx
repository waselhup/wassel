import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ClientNav from '@/components/ClientNav';
import { Upload, Plus, Loader2, CheckCircle, AlertCircle, Users, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

export default function LeadImport() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<'csv' | 'manual'>('csv');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [manualLeads, setManualLeads] = useState<any[]>([
    { linkedin_url: '', first_name: '', last_name: '', company: '' }
  ]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Build auth headers
  const getHeaders = () => {
    const token = localStorage.getItem('supabase_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const preview = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
          linkedin_url: values[headers.indexOf('linkedin_url')] || values[0],
          name: values[headers.indexOf('name')] || `${values[headers.indexOf('first_name')] || ''} ${values[headers.indexOf('last_name')] || ''}`.trim(),
          company: values[headers.indexOf('company')] || '',
          title: values[headers.indexOf('title')] || values[headers.indexOf('headline')] || '',
        };
      });
      setCsvPreview(preview);
    };
    reader.readAsText(file);
  };

  const handleImportCSV = async () => {
    if (!csvFile) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const prospects = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
          linkedin_url: values[headers.indexOf('linkedin_url')] || values[0],
          name: `${values[headers.indexOf('first_name')] || ''} ${values[headers.indexOf('last_name')] || ''}`.trim() || values[headers.indexOf('name')] || '',
          company: values[headers.indexOf('company')] || '',
          title: values[headers.indexOf('title')] || values[headers.indexOf('headline')] || '',
        };
      }).filter(p => p.linkedin_url);

      try {
        const res = await fetch('/api/ext/import', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ prospects, source_url: 'csv_import' }),
        });
        const data = await res.json();
        setImportResult(data);
      } catch (e: any) {
        setImportResult({ error: e.message });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(csvFile);
  };

  const handleImportManual = async () => {
    const validLeads = manualLeads.filter(l => l.linkedin_url);
    if (validLeads.length === 0) return;
    setImporting(true);
    try {
      const prospects = validLeads.map(l => ({
        linkedin_url: l.linkedin_url,
        name: `${l.first_name} ${l.last_name}`.trim(),
        company: l.company,
        title: '',
      }));
      const res = await fetch('/api/ext/import', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prospects, source_url: 'manual_import' }),
      });
      const data = await res.json();
      setImportResult(data);
    } catch (e: any) {
      setImportResult({ error: e.message });
    } finally {
      setImporting(false);
    }
  };

  const addManualLead = () => {
    setManualLeads([...manualLeads, { linkedin_url: '', first_name: '', last_name: '', company: '' }]);
  };

  const updateManualLead = (index: number, field: string, value: string) => {
    const updated = [...manualLeads];
    updated[index][field] = value;
    setManualLeads(updated);
  };

  const removeManualLead = (index: number) => {
    setManualLeads(manualLeads.filter((_, i) => i !== index));
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <ClientNav />
      <main className="main-content" style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        {/* Back button */}
        <button
          onClick={() => navigate('/app')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: '14px', marginBottom: '20px', padding: '6px 0',
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Import Prospects
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
          Add prospects to your workspace via CSV or manual entry
        </p>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          {(['csv', 'manual'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: mode === m ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)',
                color: mode === m ? 'var(--accent-secondary)' : 'var(--text-secondary)',
              }}
            >
              {m === 'csv' ? <><Upload size={16} /> CSV Import</> : <><Plus size={16} /> Manual Entry</>}
            </button>
          ))}
        </div>

        {/* CSV Import */}
        {mode === 'csv' && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Import from CSV</h2>
            <label
              htmlFor="csv-input"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px',
                border: '2px dashed rgba(124,58,237,0.3)', borderRadius: '12px', cursor: 'pointer',
                background: 'rgba(124,58,237,0.05)', marginBottom: '20px', textAlign: 'center',
              }}
            >
              <Upload size={32} style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {csvFile ? csvFile.name : 'Click to select CSV file'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                Required columns: linkedin_url, name or first_name + last_name
              </span>
              <input id="csv-input" type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
            </label>

            {csvPreview.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Preview (first 5 rows)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr>
                        {['Name', 'LinkedIn URL', 'Title', 'Company'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{row.name}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '12px' }}>{row.linkedin_url}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{row.title}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{row.company}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button
              onClick={handleImportCSV}
              disabled={!csvFile || importing}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: csvFile && !importing ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.1)',
                color: 'white', fontSize: '15px', fontWeight: 600, cursor: csvFile && !importing ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {importing ? <><Loader2 size={18} className="animate-spin" /> Importing...</> : <><Upload size={18} /> Import Now</>}
            </button>
          </div>
        )}

        {/* Manual Entry */}
        {mode === 'manual' && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Manual Entry</h2>
            {manualLeads.map((lead, idx) => (
              <div
                key={idx}
                style={{
                  padding: '20px', border: '1px solid var(--border-subtle)', borderRadius: '10px',
                  marginBottom: '12px', background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>LinkedIn URL *</label>
                    <input
                      type="url" placeholder="https://linkedin.com/in/..." value={lead.linkedin_url}
                      onChange={e => updateManualLead(idx, 'linkedin_url', e.target.value)} style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>First Name</label>
                    <input
                      type="text" placeholder="John" value={lead.first_name}
                      onChange={e => updateManualLead(idx, 'first_name', e.target.value)} style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Last Name</label>
                    <input
                      type="text" placeholder="Doe" value={lead.last_name}
                      onChange={e => updateManualLead(idx, 'last_name', e.target.value)} style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Company</label>
                    <input
                      type="text" placeholder="Company" value={lead.company}
                      onChange={e => updateManualLead(idx, 'company', e.target.value)} style={inputStyle}
                    />
                  </div>
                </div>
                {manualLeads.length > 1 && (
                  <button
                    onClick={() => removeManualLead(idx)}
                    style={{
                      marginTop: '12px', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
                      background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addManualLead}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: '2px dashed rgba(124,58,237,0.3)',
                background: 'rgba(124,58,237,0.05)', color: 'var(--accent-primary)', fontSize: '14px', fontWeight: 500,
                cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <Plus size={16} /> Add Another
            </button>

            <button
              onClick={handleImportManual}
              disabled={importing}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: !importing ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.1)',
                color: 'white', fontSize: '15px', fontWeight: 600, cursor: !importing ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {importing ? <><Loader2 size={18} className="animate-spin" /> Importing...</> : <><Plus size={18} /> Import {manualLeads.length} Prospect{manualLeads.length > 1 ? 's' : ''}</>}
            </button>
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div
            style={{
              marginTop: '20px', padding: '20px', borderRadius: '12px',
              background: importResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              border: `1px solid ${importResult.error ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
              display: 'flex', alignItems: 'center', gap: '12px',
            }}
          >
            {importResult.error ? (
              <>
                <AlertCircle size={20} style={{ color: '#ef4444' }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '4px' }}>Import Failed</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{importResult.error}</div>
                </div>
              </>
            ) : (
              <>
                <CheckCircle size={20} style={{ color: '#22c55e' }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#22c55e', marginBottom: '4px' }}>Import Successful!</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {importResult.imported || importResult.count || 0} prospects imported
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, Plus, Loader2, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { trpc } from '@/lib/trpc';

type ImportMode = 'csv' | 'manual';

export default function LeadImport() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ImportMode>('csv');
  const [campaignId, setCampaignId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [manualLeads, setManualLeads] = useState<any[]>([
    { linkedin_url: '', first_name: '', last_name: '', company: '' }
  ]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Fetch campaigns
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery();

  // Import leads mutation
  const importLeads = trpc.leads.importLeads.useMutation({
    onSuccess: (result: any) => {
      setImportResult(result);
      setImporting(false);
    },
    onError: (error: any) => {
      setImportResult({ error: error.message });
      setImporting(false);
    },
  });

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
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
          first_name: values[headers.indexOf('first_name')] || '',
          last_name: values[headers.indexOf('last_name')] || '',
          company: values[headers.indexOf('company')] || '',
          headline: values[headers.indexOf('headline')] || '',
        };
      });
      
      setCsvPreview(preview);
    };
    reader.readAsText(file);
  };

  const handleImportCSV = async () => {
    if (!csvFile || !campaignId) {
      alert('الرجاء اختيار ملف CSV وحملة');
      return;
    }

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const leads = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
          linkedin_url: values[headers.indexOf('linkedin_url')] || values[0],
          first_name: values[headers.indexOf('first_name')] || '',
          last_name: values[headers.indexOf('last_name')] || '',
          company: values[headers.indexOf('company')] || '',
          headline: values[headers.indexOf('headline')] || '',
          email: values[headers.indexOf('email')] || '',
        };
      }).filter(lead => lead.linkedin_url);

      await importLeads.mutateAsync({
        campaignId,
        leads,
      });
    };
    reader.readAsText(csvFile);
  };

  const handleImportManual = async () => {
    if (!campaignId) {
      alert('الرجاء اختيار حملة');
      return;
    }

    const validLeads = manualLeads.filter(lead => lead.linkedin_url);
    if (validLeads.length === 0) {
      alert('الرجاء إضافة عملاء محتملين');
      return;
    }

    setImporting(true);
    await importLeads.mutateAsync({
      campaignId,
      leads: validLeads,
    });
  };

  const addManualLead = () => {
    setManualLeads([
      ...manualLeads,
      { linkedin_url: '', first_name: '', last_name: '', company: '' }
    ]);
  };

  const updateManualLead = (index: number, field: string, value: string) => {
    const updated = [...manualLeads];
    updated[index][field] = value;
    setManualLeads(updated);
  };

  const removeManualLead = (index: number) => {
    setManualLeads(manualLeads.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            استيراد العملاء المحتملين
          </h1>
          <p className="text-gray-600">أضف عملاء محتملين إلى حملتك من CSV أو يدوياً</p>
        </div>

        {/* Campaign Selection */}
        <Card className="p-6 mb-8 bg-white border-blue-200">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            اختر الحملة *
          </label>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- اختر حملة --</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </Card>

        {/* Mode Selection */}
        <div className="flex gap-4 mb-8">
          <Button
            onClick={() => setMode('csv')}
            className={`flex-1 py-3 font-semibold flex items-center gap-2 justify-center ${
              mode === 'csv'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border-2 border-gray-300'
            }`}
          >
            <Upload className="w-5 h-5" />
            استيراد CSV
          </Button>
          <Button
            onClick={() => setMode('manual')}
            className={`flex-1 py-3 font-semibold flex items-center gap-2 justify-center ${
              mode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border-2 border-gray-300'
            }`}
          >
            <Plus className="w-5 h-5" />
            إدخال يدوي
          </Button>
        </div>

        {/* CSV Import */}
        {mode === 'csv' && (
          <Card className="p-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">استيراد من CSV</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                اختر ملف CSV
              </label>
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                  id="csv-input"
                />
                <label htmlFor="csv-input" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                  <p className="text-gray-700 font-medium">اسحب ملف CSV هنا أو انقر للاختيار</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {csvFile ? csvFile.name : 'الصيغ المدعومة: CSV فقط'}
                  </p>
                </label>
              </div>
            </div>

            {/* CSV Preview */}
            {csvPreview.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">معاينة البيانات</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-right font-semibold text-gray-900">رابط LinkedIn</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-900">الاسم الأول</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-900">الاسم الأخير</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-900">الشركة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((lead, idx) => (
                        <tr key={idx} className="border-b border-gray-200">
                          <td className="px-4 py-3 text-gray-700">{lead.linkedin_url}</td>
                          <td className="px-4 py-3 text-gray-700">{lead.first_name}</td>
                          <td className="px-4 py-3 text-gray-700">{lead.last_name}</td>
                          <td className="px-4 py-3 text-gray-700">{lead.company}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  معاينة أول 5 صفوف. سيتم استيراد جميع الصفوف.
                </p>
              </div>
            )}

            <Button
              onClick={handleImportCSV}
              disabled={!csvFile || !campaignId || importing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 flex items-center gap-2 justify-center"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الاستيراد...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  استيراد الآن
                </>
              )}
            </Button>
          </Card>
        )}

        {/* Manual Entry */}
        {mode === 'manual' && (
          <Card className="p-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">إدخال يدوي</h2>
            
            <div className="space-y-6 mb-6">
              {manualLeads.map((lead, idx) => (
                <div key={idx} className="p-6 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        رابط LinkedIn *
                      </label>
                      <Input
                        type="url"
                        placeholder="https://linkedin.com/in/..."
                        value={lead.linkedin_url}
                        onChange={(e) => updateManualLead(idx, 'linkedin_url', e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الاسم الأول
                      </label>
                      <Input
                        type="text"
                        placeholder="محمد"
                        value={lead.first_name}
                        onChange={(e) => updateManualLead(idx, 'first_name', e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الاسم الأخير
                      </label>
                      <Input
                        type="text"
                        placeholder="علي"
                        value={lead.last_name}
                        onChange={(e) => updateManualLead(idx, 'last_name', e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الشركة
                      </label>
                      <Input
                        type="text"
                        placeholder="شركة التقنية"
                        value={lead.company}
                        onChange={(e) => updateManualLead(idx, 'company', e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        البريد الإلكتروني
                      </label>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={lead.email || ''}
                        onChange={(e) => updateManualLead(idx, 'email', e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-end">
                      {manualLeads.length > 1 && (
                        <Button
                          onClick={() => removeManualLead(idx)}
                          variant="outline"
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          حذف
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={addManualLead}
              variant="outline"
              className="w-full mb-6 border-2 border-blue-300 text-blue-600 hover:bg-blue-50 font-semibold py-2 flex items-center gap-2 justify-center"
            >
              <Plus className="w-5 h-5" />
              إضافة عميل آخر
            </Button>

            <Button
              onClick={handleImportManual}
              disabled={!campaignId || importing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 flex items-center gap-2 justify-center"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الاستيراد...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  استيراد {manualLeads.length} عميل
                </>
              )}
            </Button>
          </Card>
        )}

        {/* Import Result */}
        {importResult && (
          <Card className={`p-6 ${importResult.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-start gap-4">
              {importResult.error ? (
                <>
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-red-900 mb-2">خطأ في الاستيراد</h3>
                    <p className="text-red-700">{importResult.error}</p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-green-900 mb-2">✓ تم الاستيراد بنجاح</h3>
                    <p className="text-green-700">
                      تم استيراد {importResult.imported} عميل محتمل
                    </p>
                    {importResult.duplicates > 0 && (
                      <p className="text-green-700 text-sm mt-2">
                        تم تخطي {importResult.duplicates} عميل مكرر
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Edit2, Trash2, Eye, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';

type Mode = 'list' | 'create' | 'edit' | 'preview';

interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  content: string;
  variables: string[];
  usage_count: number;
}

export default function Templates() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'عام',
    subject: '',
    content: '',
  });
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch templates
  const { data: templates = [], refetch } = trpc.templates.list.useQuery();

  // Create template mutation
  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => {
      setFormData({ name: '', category: 'عام', subject: '', content: '' });
      setMode('list');
      setMessage({ type: 'success', text: 'تم إنشاء القالب بنجاح' });
      refetch();
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.message });
    },
  });

  // Update template mutation
  const updateTemplate = trpc.templates.update.useMutation({
    onSuccess: () => {
      setFormData({ name: '', category: 'عام', subject: '', content: '' });
      setSelectedTemplate(null);
      setMode('list');
      setMessage({ type: 'success', text: 'تم تحديث القالب بنجاح' });
      refetch();
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.message });
    },
  });

  // Delete template mutation
  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => {
      setMessage({ type: 'success', text: 'تم حذف القالب بنجاح' });
      refetch();
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (error: any) => {
      setMessage({ type: 'error', text: error.message });
    },
  });

  // Preview mutation
  const { data: preview } = trpc.templates.preview.useQuery(
    {
      content: formData.content,
      variables: previewVars,
    },
    { enabled: mode === 'preview' && formData.content.length > 0 }
  );

  const handleCreate = async () => {
    if (!formData.name || !formData.content) {
      setMessage({ type: 'error', text: 'الرجاء ملء جميع الحقول المطلوبة' });
      return;
    }

    setSaving(true);
    await createTemplate.mutateAsync({
      name: formData.name,
      category: formData.category,
      subject: formData.subject,
      content: formData.content,
    });
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!selectedTemplate || !formData.name || !formData.content) {
      setMessage({ type: 'error', text: 'الرجاء ملء جميع الحقول المطلوبة' });
      return;
    }

    setSaving(true);
    await updateTemplate.mutateAsync({
      templateId: selectedTemplate.id,
      name: formData.name,
      category: formData.category,
      subject: formData.subject,
      content: formData.content,
    });
    setSaving(false);
  };

  const handleDelete = async (templateId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا القالب؟')) {
      await deleteTemplate.mutateAsync({ templateId });
    }
  };

  const startEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      subject: template.subject,
      content: template.content,
    });
    setMode('edit');
  };

  const startPreview = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      subject: template.subject,
      content: template.content,
    });
    // Extract variables from content
    const vars: Record<string, string> = {};
    const regex = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = regex.exec(template.content)) !== null) {
      vars[match[1]] = '';
    }
    setPreviewVars(vars);
    setMode('preview');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">قوالب الرسائل</h1>
            <p className="text-gray-600 mt-2">أنشئ وأدر قوالب الرسائل الخاصة بك</p>
          </div>
          {mode === 'list' && (
            <Button
              onClick={() => {
                setFormData({ name: '', category: 'عام', subject: '', content: '' });
                setMode('create');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              قالب جديد
            </Button>
          )}
        </div>

        {/* Messages */}
        {message && (
          <Card className={`p-4 mb-6 flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {message.text}
            </p>
          </Card>
        )}

        {/* List Mode */}
        {mode === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.length === 0 ? (
              <Card className="col-span-full p-12 text-center">
                <p className="text-gray-600 mb-4">لا توجد قوالب حتى الآن</p>
                <Button
                  onClick={() => {
                    setFormData({ name: '', category: 'عام', subject: '', content: '' });
                    setMode('create');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  إنشاء أول قالب
                </Button>
              </Card>
            ) : (
              templates.map((template: Template) => (
                <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{template.category}</p>
                  <p className="text-gray-700 line-clamp-3 mb-4 text-sm">{template.content}</p>
                  <div className="flex items-center gap-2 mb-4">
                    {template.variables.map((v) => (
                      <span key={v} className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">
                        {v}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => startPreview(template)}
                      variant="outline"
                      className="flex-1 text-blue-600 hover:bg-blue-50 font-medium py-2 flex items-center gap-2 justify-center"
                    >
                      <Eye className="w-4 h-4" />
                      معاينة
                    </Button>
                    <Button
                      onClick={() => startEdit(template)}
                      variant="outline"
                      className="flex-1 text-blue-600 hover:bg-blue-50 font-medium py-2 flex items-center gap-2 justify-center"
                    >
                      <Edit2 className="w-4 h-4" />
                      تعديل
                    </Button>
                    <Button
                      onClick={() => handleDelete(template.id)}
                      variant="outline"
                      className="flex-1 text-red-600 hover:bg-red-50 font-medium py-2 flex items-center gap-2 justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Create/Edit Mode */}
        {(mode === 'create' || mode === 'edit') && (
          <Card className="p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              {mode === 'create' ? 'قالب جديد' : 'تعديل القالب'}
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم القالب *
                </label>
                <Input
                  type="text"
                  placeholder="مثال: رسالة الترحيب"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الفئة
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>عام</option>
                    <option>ترحيب</option>
                    <option>متابعة</option>
                    <option>عرض</option>
                    <option>شكر</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الموضوع
                  </label>
                  <Input
                    type="text"
                    placeholder="موضوع الرسالة"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  محتوى القالب *
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  استخدم متغيرات مثل name و company داخل أقواس مزدوجة
                </p>
                <textarea
                  placeholder="السلام عليكم {{name}}، أتمنى أن تكون بخير..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => startPreview(formData as any)}
                  variant="outline"
                  className="flex-1 text-blue-600 hover:bg-blue-50 font-semibold py-2 flex items-center gap-2 justify-center"
                >
                  <Eye className="w-4 h-4" />
                  معاينة
                </Button>
                <Button
                  onClick={mode === 'create' ? handleCreate : handleUpdate}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 flex items-center gap-2 justify-center"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري الحفظ
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      حفظ
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setMode('list');
                    setFormData({ name: '', category: 'عام', subject: '', content: '' });
                  }}
                  variant="outline"
                  className="flex-1 text-gray-600 hover:bg-gray-50 font-semibold py-2"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Preview Mode */}
        {mode === 'preview' && (
          <Card className="p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">معاينة القالب</h2>

            {selectedTemplate?.variables && selectedTemplate.variables.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-gray-700 mb-3">أدخل قيم المتغيرات:</p>
                <div className="space-y-3">
                  {selectedTemplate.variables.map((v) => (
                    <div key={v}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {v}
                      </label>
                      <Input
                        type="text"
                        placeholder={`أدخل قيمة ${v}`}
                        value={previewVars[v] || ''}
                        onChange={(e) =>
                          setPreviewVars({ ...previewVars, [v]: e.target.value })
                        }
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 mb-6">
              <div className="whitespace-pre-wrap font-mono text-sm text-gray-700">
                {preview?.preview || formData.content}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setMode(selectedTemplate ? 'edit' : 'create')}
                variant="outline"
                className="flex-1 text-blue-600 hover:bg-blue-50 font-semibold py-2"
              >
                العودة للتعديل
              </Button>
              <Button
                onClick={() => {
                  setMode('list');
                  setFormData({ name: '', category: 'عام', subject: '', content: '' });
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2"
              >
                تم
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

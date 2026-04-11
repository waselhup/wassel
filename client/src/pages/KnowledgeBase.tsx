import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Download, Linkedin, Mail, Lightbulb, Trash2,
  Loader2, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface KnowledgeItem {
  id: string;
  type: 'linkedin_analysis' | 'campaign_result' | 'market_insight';
  title: string;
  content: any;
  tags: string[];
  created_at: string;
}

export default function KnowledgeBase() {
  const { t } = useTranslation();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'linkedin_analysis' | 'campaign_result' | 'market_insight'>('all');

  const marketTips = [
    { title: t('kb.tip1', 'LinkedIn هو الشبكة المهنية الأولى في السعودية'), desc: t('kb.tip1d', 'أكثر من 10 مليون مستخدم في المملكة') },
    { title: t('kb.tip2', 'المحتوى العربي يحصل على تفاعل أعلى 3 أضعاف'), desc: t('kb.tip2d', 'استخدم العربية الفصحى في ملفك المهني') },
    { title: t('kb.tip3', 'كلمات رؤية 2030 تعزز الظهور'), desc: t('kb.tip3d', 'أضف كلمات مثل التحول الرقمي والابتكار') },
    { title: t('kb.tip4', 'الشهادات والتوصيات مهمة جداً'), desc: t('kb.tip4d', 'أصحاب العمل في الخليج يقدرون التوصيات المهنية') },
    { title: t('kb.tip5', 'أفضل وقت للنشر: 8-10 صباحاً'), desc: t('kb.tip5d', 'بتوقيت السعودية للوصول لأقصى جمهور') },
    { title: t('kb.tip6', 'الخبرة عبر الثقافات مطلوبة'), desc: t('kb.tip6d', 'الشركات متعددة الجنسيات تقدر التنوع الثقافي') },
  ];

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      const data = await trpc.knowledge.list();
      setItems(data as KnowledgeItem[]);
    } catch (err) {
      console.error('Failed to load knowledge items:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await trpc.knowledge.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wassel-knowledge-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await trpc.knowledge.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  const filteredItems = activeTab === 'all' ? items : items.filter((i) => i.type === activeTab);

  const typeIcon = (type: string) => {
    switch (type) {
      case 'linkedin_analysis': return <Linkedin className="w-4 h-4 text-blue-600" />;
      case 'campaign_result': return <Mail className="w-4 h-4 text-green-600" />;
      case 'market_insight': return <Lightbulb className="w-4 h-4 text-yellow-600" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'linkedin_analysis': return t('kb.type.linkedin', 'تحليل LinkedIn');
      case 'campaign_result': return t('kb.type.campaign', 'نتيجة حملة');
      case 'market_insight': return t('kb.type.insight', 'رؤية سوقية');
      default: return type;
    }
  };

  const tabs = [
    { key: 'all' as const, label: t('kb.tab.all', 'الكل'), count: items.length },
    { key: 'linkedin_analysis' as const, label: t('kb.tab.linkedin', 'تحليلات LinkedIn'), count: items.filter((i) => i.type === 'linkedin_analysis').length },
    { key: 'campaign_result' as const, label: t('kb.tab.campaigns', 'نتائج الحملات'), count: items.filter((i) => i.type === 'campaign_result').length },
    { key: 'market_insight' as const, label: t('kb.tab.insights', 'رؤى السوق'), count: items.filter((i) => i.type === 'market_insight').length },
  ];

  return (
    <DashboardLayout pageTitle={t('kb.title', 'قاعدة المعرفة')}>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2c5282] flex items-center justify-center shadow-md">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                {t('kb.title', 'قاعدة المعرفة')}
              </h1>
              <p className="text-gray-500 mt-2">{t('kb.subtitle', 'اجمع تحليلاتك ونتائج حملاتك لبناء قاعدة معرفة ذكية')}</p>
            </div>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="bg-[#1e3a5f] hover:bg-[#2c5282] text-white flex items-center gap-2"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {t('kb.export', 'تصدير للـ NotebookLM')}
            </Button>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === tab.key
                  ? 'bg-[#ff6b35] text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-[#ff6b35] hover:text-[#ff6b35]'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Export Info Card */}
        <Card className="border-[#1e3a5f]/20 bg-gradient-to-r from-[#1e3a5f]/5 to-[#2c5282]/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#2c5282] flex items-center justify-center flex-shrink-0">
                <ExternalLink className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-[#1a1a2e]">{t('kb.notebooklm', 'تكامل NotebookLM')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('kb.notebooklmDesc', 'صدّر بياناتك كملف JSON وارفعه إلى NotebookLM من Google لبناء قاعدة معرفة ذكية يمكنك سؤالها عن تحليلاتك وحملاتك.')}
                </p>
                <a
                  href="https://notebooklm.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#ff6b35] hover:underline mt-2 font-medium"
                >
                  {t('kb.openNotebook', 'افتح NotebookLM')} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Knowledge Items List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#ff6b35]" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('kb.empty', 'لا توجد عناصر بعد. حلل ملفك على LinkedIn أو أطلق حملة لبدء بناء قاعدة معرفتك.')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          className="flex items-start gap-3 flex-1 text-start"
                        >
                          <div className="mt-1">{typeIcon(item.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#1a1a2e]">{item.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">{typeLabel(item.type)}</Badge>
                              <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString()}</span>
                            </div>
                            {item.tags.length > 0 && (
                              <div className="flex gap-1 mt-2 flex-wrap">
                                {item.tags.map((tag, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[#ff6b35]/10 text-[#ff6b35]">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {expandedId === item.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <AnimatePresence>
                        {expandedId === item.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-3 pt-3 border-t border-gray-100"
                          >
                            <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap">
                              {JSON.stringify(item.content, null, 2)}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Saudi Market Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="font-cairo flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              {t('kb.marketTips', 'رؤى السوق السعودي')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {marketTips.map((tip, i) => (
                <div key={i} className="p-4 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-100">
                  <h4 className="font-semibold text-[#1a1a2e] text-sm">{tip.title}</h4>
                  <p className="text-xs text-gray-600 mt-1">{tip.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

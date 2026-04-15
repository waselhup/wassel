import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Send, Plus, Mail, Users, TrendingUp, Clock, CheckCircle2, Pause, Loader2, Check, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpcQuery } from "@/lib/trpc";
import { useEffect, useState, useMemo } from "react";

type Status = "running" | "completed" | "paused" | "draft";
interface Campaign {
  id: string; campaign_name: string; status: Status;
  total_recipients: number; emails_sent: number; opens_count: number;
  replies_count: number; created_at: string; completed_at: string | null;
}
interface Toast { id: number; type: 'success' | 'error'; message: string; }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (type: Toast['type'], message: string) => {
    const id = Date.now(); setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };
  const View = () => (
    <div style={{ position: 'fixed', top: 20, insetInlineEnd: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}
            style={{ padding: '12px 18px', borderRadius: 12, minWidth: 260, background: t.type === 'success' ? '#ECFDF5' : '#FEF2F2', color: t.type === 'success' ? '#065F46' : '#991B1B', border: `1px solid ${t.type === 'success' ? '#A7F3D0' : '#FECACA'}`, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            {t.type === 'success' ? <Check size={16} /> : <X size={16} />}{t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, View };
}

const statusMap: Record<Status, { labelAr: string; labelEn: string; bg: string; color: string; icon: any }> = {
  running:   { labelAr: 'نشطة',   labelEn: 'Active',    bg: '#D1FAE5', color: '#065F46', icon: TrendingUp },
  completed: { labelAr: 'منتهية', labelEn: 'Completed', bg: '#DBEAFE', color: '#1D4ED8', icon: CheckCircle2 },
  paused:    { labelAr: 'متوقفة', labelEn: 'Paused',    bg: '#FEF3C7', color: '#92400E', icon: Pause },
  draft:     { labelAr: 'مسودة',  labelEn: 'Draft',     bg: '#F3F4F6', color: '#4B5563', icon: Clock },
};

type TabId = 'all' | Status;

export default function CampaignList() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('all');

  useEffect(() => {
    trpcQuery<Campaign[]>("campaign.list")
      .then(data => setCampaigns(data || []))
      .catch(() => toast.push('error', isAr ? 'خطأ في تحميل الحملات' : 'Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all: campaigns.length,
    running: campaigns.filter(c => c.status === 'running').length,
    completed: campaigns.filter(c => c.status === 'completed').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
    draft: campaigns.filter(c => c.status === 'draft').length,
  }), [campaigns]);

  const filtered = tab === 'all' ? campaigns : campaigns.filter(c => c.status === tab);

  const tabs: { id: TabId; labelAr: string; labelEn: string }[] = [
    { id: 'all', labelAr: 'الكل', labelEn: 'All' },
    { id: 'running', labelAr: 'نشطة', labelEn: 'Active' },
    { id: 'paused', labelAr: 'متوقفة', labelEn: 'Paused' },
    { id: 'completed', labelAr: 'منتهية', labelEn: 'Completed' },
    { id: 'draft', labelAr: 'مسودة', labelEn: 'Draft' },
  ];

  return (
    <DashboardLayout pageTitle={t('camp.title', 'الحملات')}>
      <toast.View />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 30, color: 'var(--wsl-ink)', letterSpacing: '-0.5px', margin: 0 }}>
              {t('camp.title', 'الحملات')}
            </h1>
            <p style={{ marginTop: 6, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14 }}>
              {t('camp.subtitle', 'أدر حملاتك البريدية والتواصل مع العملاء')}
            </p>
          </div>
          <Link href="/app/campaigns/new">
            <a style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)', color: '#fff', textDecoration: 'none', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 14, boxShadow: '0 6px 16px rgba(10,143,132,0.25)' }}>
              <Plus size={16} /> {t('camp.new', 'حملة جديدة')}
            </a>
          </Link>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--wsl-surf-2, #F3F4F6)', marginBottom: 20, overflowX: 'auto' }}>
          {tabs.map(tb => {
            const active = tab === tb.id;
            const count = counts[tb.id];
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{ flex: 1, minWidth: 80, padding: '9px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? 'var(--wsl-ink)' : 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13, boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 150ms ease' }}>
                {isAr ? tb.labelAr : tb.labelEn}
                <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 900, background: active ? 'var(--wsl-teal-bg, #E0F7F5)' : 'rgba(0,0,0,0.06)', color: active ? 'var(--wsl-teal, #0A8F84)' : 'var(--wsl-ink-3)', fontFamily: 'Inter' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 20, border: '1px solid var(--wsl-border, #E5E7EB)', height: 160, animation: 'pulse 1.5s ease-in-out infinite' }}>
                <div style={{ height: 16, background: '#E5E7EB', borderRadius: 8, width: '60%', marginBottom: 12 }} />
                <div style={{ height: 12, background: '#E5E7EB', borderRadius: 8, width: '40%', marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 12 }}>
                  {[1, 2, 3].map(j => (<div key={j} style={{ height: 40, background: '#F3F4F6', borderRadius: 8, flex: 1 }} />))}
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: '#fff', border: '2px dashed var(--wsl-border, #E5E7EB)', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px', background: 'linear-gradient(135deg, rgba(10,143,132,0.1), rgba(14,165,233,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={32} color="#0A8F84" />
            </div>
            <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink)', marginBottom: 6 }}>
              {t('camp.empty', 'لا توجد حملات بعد')}
            </div>
            <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontSize: 13, color: 'var(--wsl-ink-3)', marginBottom: 20 }}>
              {t('camp.emptyDesc', 'أنشئ أول حملة بريدية للتواصل مع العملاء')}
            </div>
            <Link href="/app/campaigns/new">
              <a style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: 'linear-gradient(135deg, #0A8F84, #0ea5e9)', color: '#fff', textDecoration: 'none', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13 }}>
                <Plus size={14} /> {t('camp.new', 'حملة جديدة')}
              </a>
            </Link>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {filtered.map((c, idx) => {
              const s = statusMap[c.status] || statusMap.draft;
              const openRate = c.emails_sent ? Math.round((c.opens_count / c.emails_sent) * 100) : 0;
              return (
                <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }} whileHover={{ y: -3 }}>
                  <Link href={`/app/campaigns/${c.id}`}>
                    <a style={{ display: 'block', textDecoration: 'none', background: '#fff', borderRadius: 14, padding: 18, border: '1px solid var(--wsl-border, #E5E7EB)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'box-shadow 200ms' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 15, color: 'var(--wsl-ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.campaign_name}
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800, fontFamily: 'Cairo, Inter, sans-serif', flexShrink: 0, marginInlineStart: 8 }}>
                          {isAr ? s.labelAr : s.labelEn}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '12px 0', borderTop: '1px solid var(--wsl-border, #E5E7EB)', borderBottom: '1px solid var(--wsl-border, #E5E7EB)', marginBottom: 12 }}>
                        {[{ icon: Mail, val: c.emails_sent || 0, label: t('camp.sent', 'مُرسل') }, { icon: Users, val: c.opens_count || 0, label: t('camp.opens', 'فتح') }, { icon: TrendingUp, val: c.replies_count || 0, label: t('camp.replies', 'رد') }].map(({ icon: Icon, val, label }) => (
                          <div key={label} style={{ textAlign: 'center' }}>
                            <Icon size={14} style={{ color: '#9CA3AF', margin: '0 auto 4px' }} />
                            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Inter' }}>{val}</div>
                            <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                        <span>{(c.completed_at || c.created_at) ? new Date(c.completed_at || c.created_at).toLocaleDateString(isAr ? 'ar-SA' : 'en-US') : ''}</span>
                        <span style={{ color: '#0A8F84', fontWeight: 800 }}>{openRate}% {t('camp.openRate', 'فتح')}</span>
                      </div>
                    </a>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

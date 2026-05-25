import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Calendar, Sparkles, Rss, Zap,
  Snowflake, Linkedin, Instagram, MessageCircle, Mail, FileText, Twitter,
  Play, X, AlertTriangle, BarChart3,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  border: '1px solid var(--border-subtle, #E5E7EB)',
  padding: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink, #0F172A)',
  margin: 0, display: 'flex', alignItems: 'center', gap: 8,
};

const PLATFORM_ICONS: Record<string, any> = {
  snapchat: Snowflake, linkedin: Linkedin, instagram: Instagram,
  tiktok: Play, twitter: Twitter, whatsapp: MessageCircle,
  email: Mail, blog: FileText,
};

const PLATFORM_COLORS: Record<string, string> = {
  snapchat: '#FFFC00', linkedin: '#0A66C2', instagram: '#E1306C',
  tiktok: '#000000', twitter: '#1DA1F2', whatsapp: '#25D366',
  email: '#6B7280', blog: '#F59E0B',
};

const ALL_PLATFORMS = ['snapchat', 'linkedin', 'instagram', 'tiktok', 'twitter', 'whatsapp'];

export default function GrowthDashboard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [calendar, setCalendar] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchOpen, setBatchOpen] = useState(false);
  const [rssOpen, setRssOpen] = useState(false);
  const [adOpen, setAdOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<{ tasksCreated: number; totalEstimatedCostSar: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cal, camps] = await Promise.all([
        trpc.sayed.listContentCalendar({}),
        trpc.sayed.listAdCampaigns({}),
      ]);
      setCalendar(cal.items);
      setCampaigns(camps.campaigns);
    } catch (e) {
      console.error('[growth] refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const stats = useMemo(() => {
    const awaiting = calendar.filter((c) => c.status === 'awaiting_approval').length;
    const approved = calendar.filter((c) => c.status === 'approved').length;
    const published = calendar.filter((c) => c.status === 'published').length;
    return { awaiting, approved, published, total: calendar.length };
  }, [calendar]);

  const channelStats = useMemo(() => {
    const m = new Map<string, { spend: number; conversions: number; cac: number; status: string }>();
    for (const c of campaigns) {
      const k = c.channel;
      const acc = m.get(k) || { spend: 0, conversions: 0, cac: 0, status: c.status };
      acc.spend += Number(c.total_spend_sar || 0);
      acc.conversions += Number(c.conversions || 0);
      m.set(k, acc);
    }
    return Array.from(m.entries()).map(([channel, v]) => ({
      channel, spend: v.spend, conversions: v.conversions,
      cac: v.conversions > 0 ? v.spend / v.conversions : 0,
    }));
  }, [campaigns]);

  if (loading && !calendar.length) {
    return <div style={{ padding: 24, fontFamily: '"Thmanyah Sans"' }}>{tr('جاري التحميل…', 'Loading…')}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* SAYED HEADER */}
      <section style={{ ...CARD, background: 'linear-gradient(135deg, #ECFDF5, #fff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #10B981, #047857)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          }}>
            <Megaphone size={26} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0F172A' }}>
              {tr('سيد — قائد المحتوى والإعلانات', 'Sayed — Content & Ads Maestro')}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              {tr(
                `يولّد المحتوى لجميع منصاتك وقنوات الإعلان. كل شيء بانتظار موافقتك في مركز القيادة. هذا الشهر: ${stats.total} عنصر مجدول، ${stats.awaiting} بانتظار الموافقة، ${stats.published} منشور.`,
                `Generates content for all your platforms + ad channels. Everything awaits your approval in HQ. This month: ${stats.total} items scheduled, ${stats.awaiting} pending, ${stats.published} published.`,
              )}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setBatchOpen(true)} style={primaryBtnStyle('#10B981')}>
            <Sparkles size={14} /> {tr('توليد محتوى الشهر', 'Generate 30-Day Batch')}
          </button>
          <button onClick={() => setRssOpen(true)} style={primaryBtnStyle('#0EA5E9')}>
            <Rss size={14} /> {tr('إعادة صياغة من المدونة', 'Repurpose from Blog')}
          </button>
          <button onClick={() => setAdOpen(true)} style={primaryBtnStyle('#F59E0B')}>
            <Zap size={14} /> {tr('تصميم حملة إعلانية', 'Draft Ad Campaign')}
          </button>
        </div>

        {lastRun && (
          <div style={{ marginTop: 12, padding: 10, background: '#D1FAE5', borderRadius: 8, fontSize: 12, color: '#047857' }}>
            ✓ {tr(`أضاف سيد ${lastRun.tasksCreated} مهمة. التكلفة التقديرية: ${lastRun.totalEstimatedCostSar} ر.س. شيك مركز القيادة.`,
                  `Sayed queued ${lastRun.tasksCreated} tasks. Estimated cost: ${lastRun.totalEstimatedCostSar} SAR. Check Workforce HQ.`)}
          </div>
        )}
      </section>

      {/* CONTENT CALENDAR */}
      <section style={CARD}>
        <h2 style={SECTION_TITLE}>
          <Calendar size={18} color="#10B981" />
          {tr('تقويم المحتوى', 'Content Calendar')} ({stats.total})
        </h2>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: tr('بانتظار الموافقة', 'Pending approval'), value: stats.awaiting, color: '#F59E0B' },
            { label: tr('موافق عليها', 'Approved'), value: stats.approved, color: '#10B981' },
            { label: tr('منشورة', 'Published'), value: stats.published, color: '#3B82F6' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#F9FAFB', padding: '8px 12px', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflow: 'auto' }}>
          {calendar.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              {tr('لا محتوى مجدول بعد. اضغط "توليد محتوى الشهر" لبدء.', 'No content scheduled. Click "Generate 30-Day Batch" to start.')}
            </div>
          )}
          {calendar.slice(0, 30).map((item: any) => {
            const Icon = PLATFORM_ICONS[item.platform] || FileText;
            const color = PLATFORM_COLORS[item.platform] || '#6B7280';
            const date = new Date(item.scheduled_at);
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 10, background: '#F9FAFB', borderRadius: 8,
                border: `1px solid ${item.status === 'awaiting_approval' ? '#FDE68A' : 'transparent'}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: color, color: item.platform === 'snapchat' ? '#000' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title || item.caption.slice(0, 80)}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {date.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}
                    {' · '}
                    {date.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {item.language.toUpperCase()}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: statusBg(item.status), color: statusFg(item.status),
                }}>
                  {item.status}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* AD CAMPAIGNS */}
      <section style={CARD}>
        <h2 style={SECTION_TITLE}>
          <Zap size={18} color="#F59E0B" />
          {tr('الحملات الإعلانية', 'Ad Campaigns')} ({campaigns.length})
        </h2>
        <div style={{ marginTop: 12, overflow: 'auto' }}>
          {campaigns.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              {tr('لا حملات بعد', 'No campaigns yet')}
            </div>
          )}
          {campaigns.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={thStyle(isAr)}>{tr('القناة', 'Channel')}</th>
                  <th style={thStyle(isAr)}>{tr('الاسم', 'Name')}</th>
                  <th style={thStyle(isAr)}>{tr('ميزانية يومية', 'Daily')}</th>
                  <th style={thStyle(isAr)}>{tr('إنفاق', 'Spend')}</th>
                  <th style={thStyle(isAr)}>{tr('تحويلات', 'Conversions')}</th>
                  <th style={thStyle(isAr)}>CAC</th>
                  <th style={thStyle(isAr)}>{tr('الحالة', 'Status')}</th>
                  <th style={thStyle(isAr)}></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c: any) => {
                  const cac = c.conversions > 0 ? (c.total_spend_sar / c.conversions) : 0;
                  const cacAlert = cac > 50;
                  return (
                    <tr key={c.id} style={{ background: cacAlert ? '#FEF2F2' : 'transparent' }}>
                      <td style={tdStyle(isAr)}>{c.channel}</td>
                      <td style={tdStyle(isAr)}>{c.name}</td>
                      <td style={tdStyle(isAr)}>{c.daily_budget_sar} ر.س</td>
                      <td style={tdStyle(isAr)}>{c.total_spend_sar} ر.س</td>
                      <td style={tdStyle(isAr)}>{c.conversions}</td>
                      <td style={tdStyle(isAr)}>{cac > 0 ? cac.toFixed(0) : '—'} ر.س</td>
                      <td style={tdStyle(isAr)}>{c.status}</td>
                      <td style={tdStyle(isAr)}>
                        {c.status === 'active' && (
                          <button
                            onClick={async () => {
                              const reason = window.prompt(tr('سبب الإيقاف؟', 'Reason to kill?'));
                              if (reason) {
                                await trpc.sayed.killCampaign({ campaignId: c.id, reason });
                                refresh();
                              }
                            }}
                            style={primaryBtnStyle('#EF4444')}
                          >
                            <X size={10} /> {tr('إيقاف', 'Kill')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* CHANNEL PERFORMANCE */}
      {channelStats.length > 0 && (
        <section style={CARD}>
          <h2 style={SECTION_TITLE}>
            <BarChart3 size={18} color="#10B981" />
            {tr('أداء القنوات', 'Channel Performance')}
          </h2>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {channelStats.map((c) => {
              const max = Math.max(...channelStats.map((x) => x.cac), 1);
              const pct = (c.cac / max) * 100;
              return (
                <div key={c.channel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: '#0F172A' }}>{c.channel}</span>
                    <span style={{ color: '#374151' }}>
                      CAC {c.cac.toFixed(0)} ر.س · {tr('إنفاق', 'Spend')} {c.spend.toFixed(0)} ر.س · {c.conversions} {tr('تحويل', 'conv')}
                    </span>
                  </div>
                  <div style={{ height: 10, background: '#F3F4F6', borderRadius: 999 }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: PLATFORM_COLORS[c.channel] || '#10B981',
                      borderRadius: 999,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* GENERATE BATCH MODAL */}
      <AnimatePresence>
        {batchOpen && (
          <BatchModal
            onClose={() => setBatchOpen(false)}
            onDone={(res: { tasksCreated: number; totalEstimatedCostSar: number }) => { setLastRun(res); setBatchOpen(false); refresh(); }}
            busy={busy} setBusy={setBusy} tr={tr}
          />
        )}
        {rssOpen && (
          <RssModal
            onClose={() => setRssOpen(false)}
            onDone={(r: { itemsRead: number; tasksQueued: number }) => { setRssOpen(false); refresh(); alert(tr(`تم! ${r.itemsRead} مقال، ${r.tasksQueued} مهمة في القائمة.`, `Done! ${r.itemsRead} articles, ${r.tasksQueued} tasks queued.`)); }}
            busy={busy} setBusy={setBusy} tr={tr}
          />
        )}
        {adOpen && (
          <AdModal
            onClose={() => setAdOpen(false)}
            onDone={() => { setAdOpen(false); refresh(); }}
            busy={busy} setBusy={setBusy} tr={tr}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BatchModal({ onClose, onDone, busy, setBusy, tr }: any) {
  const [selected, setSelected] = useState<string[]>(['snapchat', 'linkedin']);
  const [postsPerPlatform, setPostsPerPlatform] = useState(10);

  const toggle = (p: string) => {
    setSelected((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]);
  };

  const run = async () => {
    setBusy(true);
    try {
      const res = await trpc.sayed.generateMonthlyBatch({ platforms: selected, postsPerPlatform });
      onDone(res);
    } catch (e: any) {
      alert(`Failed: ${e?.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ margin: 0, fontWeight: 900, fontSize: 18 }}>
        {tr('توليد محتوى الشهر', 'Generate 30-Day Batch')}
      </h3>
      <p style={{ marginTop: 6, fontSize: 13, color: '#6B7280' }}>
        {tr('اختر المنصات وعدد المنشورات لكل منصة. كل المنشورات تُحفظ في انتظار موافقتك.', 'Pick platforms and posts per platform. Everything is queued for your approval.')}
      </p>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>{tr('المنصات', 'Platforms')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_PLATFORMS.map((p) => {
            const Icon = PLATFORM_ICONS[p];
            const active = selected.includes(p);
            return (
              <button key={p} onClick={() => toggle(p)} style={{
                ...primaryBtnStyle(active ? '#10B981' : '#fff'),
                color: active ? '#fff' : '#374151',
                border: `1px solid ${active ? '#10B981' : '#E5E7EB'}`,
              }}>
                <Icon size={12} /> {p}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
          {tr('عدد المنشورات لكل منصة:', 'Posts per platform:')} <strong>{postsPerPlatform}</strong>
        </div>
        <input type="range" min={5} max={30} value={postsPerPlatform} onChange={(e) => setPostsPerPlatform(Number(e.target.value))} style={{ width: '100%' }} />
      </div>
      <div style={{ marginTop: 16, padding: 10, background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E' }}>
        <AlertTriangle size={12} style={{ display: 'inline', marginInlineEnd: 6 }} />
        {tr(
          `سيُنشئ سيد ${selected.length * postsPerPlatform} مهمة. كل واحدة تستهلك Claude tokens. كل شيء بانتظار موافقتك.`,
          `Sayed will create ${selected.length * postsPerPlatform} tasks. Each consumes Claude tokens. All await your approval.`,
        )}
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={chipBtnStyle()} disabled={busy}>{tr('إلغاء', 'Cancel')}</button>
        <button onClick={run} disabled={busy || !selected.length} style={primaryBtnStyle('#10B981')}>
          {busy ? tr('جاري التوليد…', 'Generating…') : tr('تشغيل', 'Run')}
        </button>
      </div>
    </ModalShell>
  );
}

function RssModal({ onClose, onDone, busy, setBusy, tr }: any) {
  const [url, setUrl] = useState('');
  const run = async () => {
    setBusy(true);
    try { onDone(await trpc.sayed.repurposeFromRss({ feedUrl: url })); }
    catch (e: any) { alert(`Failed: ${e?.message}`); }
    finally { setBusy(false); }
  };
  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ margin: 0, fontWeight: 900, fontSize: 18 }}>
        {tr('إعادة صياغة من المدونة (RSS)', 'Repurpose from Blog (RSS)')}
      </h3>
      <p style={{ marginTop: 6, fontSize: 13, color: '#6B7280' }}>
        {tr('أعطني رابط RSS وسأحوّل كل مقال إلى 3 منشورات (لينكدن + تويتر + سناب).', 'Give me an RSS URL and I\'ll repurpose each article into 3 posts (LinkedIn + Twitter + Snap).')}
      </p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://blog.wasselhub.com/rss.xml"
        style={{ marginTop: 12, width: '100%', padding: 10, border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13 }}
      />
      <div style={{ marginTop: 14, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={chipBtnStyle()} disabled={busy}>{tr('إلغاء', 'Cancel')}</button>
        <button onClick={run} disabled={busy || !url} style={primaryBtnStyle('#0EA5E9')}>
          {busy ? tr('جاري المعالجة…', 'Processing…') : tr('تشغيل', 'Run')}
        </button>
      </div>
    </ModalShell>
  );
}

function AdModal({ onClose, onDone, busy, setBusy, tr }: any) {
  const [channel, setChannel] = useState('snapchat');
  const [objective, setObjective] = useState('');
  const [budget, setBudget] = useState(100);
  const [audience, setAudience] = useState('');

  const run = async () => {
    setBusy(true);
    try {
      const res = await trpc.sayed.draftAdCampaign({
        channel, objective, dailyBudgetSar: budget, targetAudience: audience,
      });
      onDone(res);
    } catch (e: any) { alert(`Failed: ${e?.message}`); }
    finally { setBusy(false); }
  };

  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ margin: 0, fontWeight: 900, fontSize: 18 }}>
        {tr('تصميم حملة إعلانية', 'Draft Ad Campaign')}
      </h3>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} style={inputStyle()}>
          {['snapchat', 'linkedin', 'google', 'tiktok', 'instagram', 'meta'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder={tr('الهدف (مثل: تسجيلات جديدة)', 'Objective (e.g. signups)')} style={inputStyle()} />
        <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} placeholder={tr('ميزانية يومية ر.س', 'Daily budget SAR')} style={inputStyle()} />
        <textarea value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={tr('وصف الجمهور (مثل: مهنيون سعوديون 25-40)', 'Audience description (e.g. Saudi pros 25-40)')} style={{ ...inputStyle(), minHeight: 60, resize: 'vertical' }} />
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={chipBtnStyle()} disabled={busy}>{tr('إلغاء', 'Cancel')}</button>
        <button onClick={run} disabled={busy || !objective || !audience} style={primaryBtnStyle('#F59E0B')}>
          {busy ? tr('جاري التصميم…', 'Drafting…') : tr('تصميم', 'Draft')}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: { children: any; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, padding: 22,
          width: '95%', maxWidth: 520,
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function statusBg(s: string): string {
  if (s === 'awaiting_approval') return '#FEF3C7';
  if (s === 'approved') return '#D1FAE5';
  if (s === 'published') return '#DBEAFE';
  if (s === 'failed') return '#FEE2E2';
  return '#F3F4F6';
}
function statusFg(s: string): string {
  if (s === 'awaiting_approval') return '#92400E';
  if (s === 'approved') return '#065F46';
  if (s === 'published') return '#1E40AF';
  if (s === 'failed') return '#991B1B';
  return '#374151';
}

function thStyle(isAr: boolean): React.CSSProperties {
  return {
    padding: 10, textAlign: isAr ? 'right' : 'left', fontSize: 11,
    fontWeight: 800, color: '#6B7280', borderBottom: '1px solid #E5E7EB',
  };
}
function tdStyle(isAr: boolean): React.CSSProperties {
  return {
    padding: 10, textAlign: isAr ? 'right' : 'left', fontSize: 12,
    color: '#0F172A', borderBottom: '1px solid #F3F4F6',
  };
}

function chipBtnStyle(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#fff', color: '#374151',
    border: '1px solid #E5E7EB', borderRadius: 8,
    padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  };
}
function primaryBtnStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: color, color: '#fff',
    border: 'none', borderRadius: 8,
    padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  };
}
function inputStyle(): React.CSSProperties {
  return {
    padding: '8px 10px', fontSize: 13,
    border: '1px solid #E5E7EB', borderRadius: 8,
    fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
  };
}

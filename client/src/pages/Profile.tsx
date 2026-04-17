import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { User, Mail, Phone, MapPin, Briefcase, Linkedin, Save, Camera, Coins, Check, X, Edit2, Shield, Settings, CreditCard, Star, Loader2, MessageSquare, Globe, Bell } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { trpc, trpcMutation, trpcQuery } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import UserAvatar from "@/components/UserAvatar";

type Tab = 'personal' | 'subscription' | 'settings' | 'security' | 'reviews';

interface Toast { id: number; type: 'success' | 'error'; message: string }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };
  const View = () => (
    <div style={{ position: 'fixed', top: 20, insetInlineEnd: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}
            style={{ padding: '12px 18px', borderRadius: 12, minWidth: 260, background: t.type === 'success' ? '#ECFDF5' : '#FEF2F2', color: t.type === 'success' ? '#065F46' : '#991B1B', border: `1px solid ${t.type === 'success' ? '#A7F3D0' : '#FECACA'}`, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            {t.type === 'success' ? <Check size={16} /> : <X size={16} />} {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, View };
}

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === 'ar';
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('personal');
  const [tokenBalance, setTokenBalance] = useState(0);
  const [userPlan, setUserPlan] = useState('free');
  const [editingName, setEditingName] = useState(false);
  const [form, setForm] = useState({
    name: (profile?.full_name as string) || (user?.user_metadata?.name as string) || "",
    email: user?.email || "",
    phone: (profile as any)?.phone || "",
    city: (profile as any)?.location || "الرياض",
    role: (profile as any)?.job_title || (profile as any)?.title || "",
    company: (profile as any)?.company_name || (profile as any)?.company || "",
    linkedin: (profile as any)?.linkedin_url || "",
    bio: (profile as any)?.bio || "",
    telegram_chat_id: (profile as any)?.telegram_chat_id || "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Settings state
  const [emailNotif, setEmailNotif] = useState(true);
  const [telegramNotif, setTelegramNotif] = useState(false);

  // Reviews state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [myReviews, setMyReviews] = useState<any[]>([]);

  const filled = Object.values(form).filter(Boolean).length;
  const total = Object.keys(form).length;
  const pct = Math.round((filled / total) * 100);
  const provider = user?.app_metadata?.provider || 'email';

  useEffect(() => {
    trpc.token.balance().then((b: any) => setTokenBalance(b?.balance ?? 0)).catch(() => {});
    if (user?.id) {
      supabase.from('profiles').select('plan, email_notifications, telegram_notifications').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            setUserPlan(data.plan || 'free');
            setEmailNotif(data.email_notifications !== false);
            setTelegramNotif(data.telegram_notifications === true);
          }
        });
    }
  }, [user?.id]);

  useEffect(() => {
    if (tab === 'reviews') {
      trpc.reviews.myReviews().then(setMyReviews).catch(() => {});
    }
  }, [tab]);

  async function save() {
    setSaving(true);
    try {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('profiles').update({
        full_name: form.name,
        phone: form.phone,
        location: form.city,
        job_title: form.role,
        company_name: form.company,
        linkedin_url: form.linkedin,
        bio: form.bio,
        telegram_chat_id: form.telegram_chat_id,
      }).eq('id', user.id);
      if (error) throw error;
      toast.push('success', isAr ? 'تم الحفظ بنجاح' : 'Saved successfully');
    } catch (e: any) {
      console.error('[Profile] Save error:', e);
      toast.push('error', e?.message || 'Failed to save');
    }
    setSaving(false);
  }

  async function saveSettings() {
    try {
      if (!user?.id) return;
      const { error } = await supabase.from('profiles').update({
        email_notifications: emailNotif,
        telegram_notifications: telegramNotif,
        locale: i18n.language,
      }).eq('id', user.id);
      if (error) throw error;
      toast.push('success', isAr ? 'تم حفظ الإعدادات' : 'Settings saved');
    } catch (e: any) {
      toast.push('error', e?.message || 'Failed');
    }
  }

  async function submitReview() {
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      await trpc.reviews.submit({ rating: reviewRating, comment: reviewComment });
      toast.push('success', isAr ? 'تم إرسال مراجعتك! ستظهر بعد الموافقة.' : 'Review submitted! Will appear after approval.');
      setReviewComment('');
      setReviewRating(5);
      trpc.reviews.myReviews().then(setMyReviews).catch(() => {});
    } catch (e: any) {
      console.error('[Profile] Review error:', e);
      toast.push('error', e?.message || 'Failed to submit');
    }
    setSubmittingReview(false);
  }

  const initials = form.name ? form.name.split(" ").map(w => w[0]).slice(0, 2).join("") : (user?.email?.[0] || "W").toUpperCase();

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'personal', label: t('profile.tabs.personal', 'المعلومات الشخصية'), icon: User },
    { id: 'subscription', label: t('profile.tabs.subscription', 'الاشتراك'), icon: CreditCard },
    { id: 'settings', label: t('profile.tabs.settings', 'الإعدادات'), icon: Settings },
    { id: 'security', label: t('profile.tabs.security', 'الأمان'), icon: Shield },
    { id: 'reviews', label: t('profile.tabs.reviews', 'المراجعات'), icon: Star },
  ];

  const providerLabel = provider === 'linkedin' ? 'LinkedIn' : provider === 'google' ? 'Google' : 'Email';
  const providerColor = provider === 'linkedin' ? '#0077B5' : provider === 'google' ? '#EA4335' : '#6B7280';

  const planFeatures: Record<string, string[]> = {
    free: [isAr ? 'تحليل لينكدإن واحد' : '1 LinkedIn analysis', isAr ? '10 رسائل شهرياً' : '10 messages/month'],
    starter: [isAr ? 'تحليلات غير محدودة' : 'Unlimited analyses', isAr ? '100 رسالة' : '100 messages', isAr ? 'تخصيص السيرة الذاتية' : 'CV customization'],
    pro: [isAr ? 'كل ما في المبتدئ' : 'Everything in Starter', isAr ? '500 رسالة' : '500 messages', isAr ? 'اكتشاف متقدم' : 'Advanced discovery', isAr ? 'أولوية الدعم' : 'Priority support'],
    elite: [isAr ? 'كل ما في المحترف' : 'Everything in Pro', isAr ? '1500 رسالة' : '1500 messages', isAr ? 'حسابات متعددة' : 'Multiple accounts'],
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: '#FEF3C7', color: '#92400E', label: isAr ? 'قيد المراجعة' : 'Pending' },
      approved: { bg: '#D1FAE5', color: '#065F46', label: isAr ? 'مقبولة' : 'Approved' },
      rejected: { bg: '#FEE2E2', color: '#DC2626', label: isAr ? 'مرفوضة' : 'Rejected' },
    };
    const s = map[status] || map.pending;
    return <span style={{ padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 800 }}>{s.label}</span>;
  };

  return (
    <DashboardLayout pageTitle={t('profile.title', 'الملف الشخصي')}>
      <toast.View />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px' }}>
        {/* Identity Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border, #E5E7EB)', padding: 24, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <UserAvatar
              avatarUrl={profile?.avatar_url || (user?.user_metadata as any)?.avatar_url || (user?.user_metadata as any)?.picture}
              name={form.name || profile?.full_name}
              email={user?.email}
              size="xl"
            />
            <button style={{ position: 'absolute', bottom: 0, insetInlineEnd: 0, width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '2px solid var(--wsl-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Camera size={12} style={{ color: '#6B7280' }} /></button>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {editingName ? (
                <input value={form.name} onChange={e => set('name', e.target.value)} onBlur={() => setEditingName(false)} autoFocus
                  style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Cairo, sans-serif', border: '1.5px solid #0A8F84', borderRadius: 8, padding: '4px 10px', outline: 'none', background: '#F0FDF9' }} />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif' }}>{form.name || (isAr ? 'لم يُضف اسم' : 'No name')}</span>
              )}
              <button onClick={() => setEditingName(!editingName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><Edit2 size={14} /></button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--wsl-ink-3)', fontFamily: 'Inter', direction: 'ltr' }}>{form.email}</div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: providerColor + '15', color: providerColor, fontSize: 11, fontWeight: 800 }}>{providerLabel}</span>
            </div>
          </div>
          <div style={{ minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', marginBottom: 4 }}>{isAr ? 'اكتمال الملف' : 'Profile'}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626', fontFamily: 'Inter' }}>{pct}%</div>
            <div style={{ height: 4, borderRadius: 999, background: '#E5E7EB', overflow: 'hidden', marginTop: 4 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} style={{ height: '100%', background: 'linear-gradient(90deg, #0A8F84, #0ea5e9)', borderRadius: 999 }} />
            </div>
          </div>
        </motion.div>

        {/* Tokens Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ background: 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 8px 24px rgba(10,143,132,0.25)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, fontFamily: 'Cairo, sans-serif', fontWeight: 700, marginBottom: 4 }}>{t('profile.tokensCard.title', 'رصيد التوكنز الحالي')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Inter' }}>{tokenBalance.toLocaleString('en-US')}</span>
              <span style={{ fontSize: 16, opacity: 0.8, fontFamily: 'Cairo, sans-serif' }}>{t('profile.tokensCard.balance', 'توكن')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/pricing"><a style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', color: '#fff', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 13, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)' }}>{t('profile.tokensCard.buyMore', 'شراء توكنز')}</a></Link>
            <Link href="/pricing"><a style={{ padding: '10px 18px', borderRadius: 10, background: '#fff', color: '#0A8F84', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 13, textDecoration: 'none' }}>{t('profile.tokensCard.upgrade', 'ترقية الباقة')}</a></Link>
          </div>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--wsl-surf-2, #F3F4F6)', marginBottom: 20, overflowX: 'auto' }}>
          {tabs.map(tb => {
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{ flex: 1, minWidth: 100, padding: '9px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? 'var(--wsl-ink)' : 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 12, boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 150ms ease', whiteSpace: 'nowrap' }}>
                <tb.icon size={13} /> {tb.label}
              </button>
            );
          })}
        </div>

        {/* Personal Tab */}
        {tab === 'personal' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border)', padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
              <FieldIcon icon={User} label={t('pr.name', 'الاسم الكامل')}><input value={form.name} onChange={e => set("name", e.target.value)} className="wsl-input" /></FieldIcon>
              <FieldIcon icon={Mail} label={t('pr.email', 'البريد الإلكتروني')}><input value={form.email} disabled style={{ opacity: 0.6 }} className="wsl-input" dir="ltr" /></FieldIcon>
              <FieldIcon icon={Phone} label={t('pr.phone', 'رقم الجوال')}><input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+966 5X XXX XXXX" className="wsl-input" dir="ltr" /></FieldIcon>
              <FieldIcon icon={MapPin} label={t('pr.city', 'المدينة')}>
                <select value={form.city} onChange={e => set("city", e.target.value)} className="wsl-input">
                  <option>الرياض</option><option>جدة</option><option>الدمام</option><option>مكة</option><option>المدينة</option><option>الأحساء</option>
                </select>
              </FieldIcon>
              <FieldIcon icon={Briefcase} label={t('pr.role', 'المسمى الوظيفي')}><input value={form.role} onChange={e => set("role", e.target.value)} placeholder={t('pr.rolePh', 'مدير تسويق رقمي')} className="wsl-input" /></FieldIcon>
              <FieldIcon icon={Briefcase} label={t('pr.company', 'الشركة')}><input value={form.company} onChange={e => set("company", e.target.value)} className="wsl-input" /></FieldIcon>
            </div>
            <FieldIcon icon={Linkedin} label={t('pr.linkedin', 'رابط LinkedIn')}><input value={form.linkedin} onChange={e => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." className="wsl-input" dir="ltr" /></FieldIcon>
            <div style={{ marginTop: 16 }}>
              <FieldIcon icon={MessageSquare} label={t('pr.telegram', 'Telegram Chat ID')}><input value={form.telegram_chat_id} onChange={e => set("telegram_chat_id", e.target.value)} placeholder="123456789" className="wsl-input" dir="ltr" /></FieldIcon>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--wsl-ink-2)', marginBottom: 6, fontFamily: 'Cairo, sans-serif' }}>{t('pr.bio', 'نبذة عنك')}</label>
              <textarea value={form.bio} onChange={e => set("bio", e.target.value)} rows={4} placeholder={t('pr.bioPh', 'اكتب نبذة قصيرة...')} className="wsl-input" style={{ resize: 'none', width: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={save} disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #0A8F84, #0ea5e9)', color: '#fff', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(10,143,132,0.3)', opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : t('pr.save', 'حفظ')}
              </button>
            </div>
          </motion.div>
        )}

        {/* Subscription Tab */}
        {tab === 'subscription' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border)', padding: 24 }}>
              <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, marginBottom: 16 }}>{isAr ? 'باقتك الحالية' : 'Current Plan'}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{ padding: '6px 16px', borderRadius: 999, background: userPlan === 'pro' ? '#D1FAE5' : userPlan === 'starter' ? '#FEF3C7' : '#F3F4F6', color: userPlan === 'pro' ? '#065F46' : userPlan === 'starter' ? '#92400E' : '#6B7280', fontWeight: 900, fontSize: 16, fontFamily: 'Cairo, sans-serif', textTransform: 'capitalize' }}>{userPlan}</span>
              </div>
              <h4 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 800, fontSize: 14, color: 'var(--wsl-ink-2)', marginBottom: 10 }}>{isAr ? 'مميزات باقتك:' : 'Your plan features:'}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {(planFeatures[userPlan] || planFeatures.free).map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14, color: 'var(--wsl-ink-2)', fontFamily: 'Cairo, Inter, sans-serif' }}>
                    <Check size={14} style={{ color: '#0A8F84' }} /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/pricing"><a style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 20, padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg, #0A8F84, #0ea5e9)', color: '#fff', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 13, textDecoration: 'none' }}>{isAr ? 'ترقية الباقة' : 'Upgrade Plan'}</a></Link>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border)', padding: 24 }}>
              <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, marginBottom: 12 }}>{isAr ? 'إحصائيات الاستخدام' : 'Usage Stats'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                <div style={{ padding: 16, borderRadius: 12, background: '#F0FDF9', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#0A8F84', fontFamily: 'Inter' }}>{tokenBalance}</div>
                  <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>{isAr ? 'توكنز متبقية' : 'Tokens Remaining'}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border)', padding: 24 }}>
            <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, marginBottom: 20 }}>{isAr ? 'الإعدادات' : 'Settings'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, border: '1px solid var(--wsl-border)', background: '#F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bell size={18} style={{ color: '#0A8F84' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, fontFamily: 'Cairo, sans-serif' }}>{isAr ? 'إشعارات البريد' : 'Email Notifications'}</div>
                    <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)' }}>{isAr ? 'تلقي تحديثات عبر البريد' : 'Receive updates via email'}</div>
                  </div>
                </div>
                <label style={{ position: 'relative', width: 44, height: 24, cursor: 'pointer' }}>
                  <input type="checkbox" checked={emailNotif} onChange={e => setEmailNotif(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: emailNotif ? '#0A8F84' : '#D1D5DB', transition: 'background 200ms' }}>
                    <span style={{ position: 'absolute', top: 2, left: emailNotif ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, border: '1px solid var(--wsl-border)', background: '#F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MessageSquare size={18} style={{ color: '#0A8F84' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, fontFamily: 'Cairo, sans-serif' }}>{isAr ? 'إشعارات تيليجرام' : 'Telegram Notifications'}</div>
                    <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)' }}>{isAr ? 'تلقي تنبيهات عبر تيليجرام' : 'Receive alerts via Telegram'}</div>
                  </div>
                </div>
                <label style={{ position: 'relative', width: 44, height: 24, cursor: 'pointer' }}>
                  <input type="checkbox" checked={telegramNotif} onChange={e => setTelegramNotif(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: telegramNotif ? '#0A8F84' : '#D1D5DB', transition: 'background 200ms' }}>
                    <span style={{ position: 'absolute', top: 2, left: telegramNotif ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, border: '1px solid var(--wsl-border)', background: '#F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Globe size={18} style={{ color: '#0A8F84' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, fontFamily: 'Cairo, sans-serif' }}>{isAr ? 'اللغة' : 'Language'}</div>
                    <div style={{ fontSize: 12, color: 'var(--wsl-ink-3)' }}>{isAr ? 'العربية مفعّلة حالياً' : 'English is active'}</div>
                  </div>
                </div>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#0A8F84' }}>{isAr ? 'العربية' : 'English'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={saveSettings} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #0A8F84, #0ea5e9)', color: '#fff', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
                <Save size={16} /> {isAr ? 'حفظ الإعدادات' : 'Save Settings'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Security Tab */}
        {tab === 'security' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border)', padding: 24 }}>
            <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, marginBottom: 16 }}>{isAr ? 'الأمان' : 'Security'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--wsl-border)', background: '#F9FAFB' }}>
                <div style={{ fontWeight: 800, fontSize: 14, fontFamily: 'Cairo, sans-serif', marginBottom: 4 }}>{isAr ? 'طريقة تسجيل الدخول' : 'Login Method'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--wsl-ink-2)' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: providerColor + '15', color: providerColor, fontSize: 11, fontWeight: 800 }}>{providerLabel}</span>
                  {form.email}
                </div>
              </div>
              <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--wsl-border)', background: '#F9FAFB' }}>
                <div style={{ fontWeight: 800, fontSize: 14, fontFamily: 'Cairo, sans-serif', marginBottom: 4 }}>{isAr ? 'آخر تسجيل دخول' : 'Last Login'}</div>
                <div style={{ fontSize: 13, color: 'var(--wsl-ink-3)' }}>{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '-'}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Reviews Tab */}
        {tab === 'reviews' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Submit review */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border)', padding: 24 }}>
              <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Star size={18} style={{ color: '#D97706' }} />
                {isAr ? 'اكتب مراجعة' : 'Write a Review'}
              </h3>
              <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setReviewRating(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <Star size={28} style={{ color: s <= reviewRating ? '#D97706' : '#E5E7EB', fill: s <= reviewRating ? '#D97706' : 'none', transition: 'color 150ms' }} />
                  </button>
                ))}
              </div>
              <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={4}
                placeholder={isAr ? 'شاركنا تجربتك مع وصّل...' : 'Share your experience with Wassel...'}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--wsl-border)', fontFamily: 'Cairo, Inter, sans-serif', fontSize: 14, lineHeight: 1.6, resize: 'none', outline: 'none', background: '#F9FAFB', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={submitReview} disabled={submittingReview || !reviewComment.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: !reviewComment.trim() ? '#E5E7EB' : 'linear-gradient(135deg, #0A8F84, #0ea5e9)', color: !reviewComment.trim() ? '#9CA3AF' : '#fff', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 13, cursor: !reviewComment.trim() ? 'not-allowed' : 'pointer' }}>
                  {submittingReview ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Star size={14} />}
                  {isAr ? 'إرسال المراجعة' : 'Submit Review'}
                </button>
              </div>
            </div>

            {/* My Reviews */}
            {myReviews.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border)', padding: 24 }}>
                <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 16, marginBottom: 16 }}>{isAr ? 'مراجعاتي' : 'My Reviews'}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {myReviews.map(r => (
                    <div key={r.id} style={{ padding: 16, borderRadius: 12, border: '1px solid var(--wsl-border)', background: '#F9FAFB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} style={{ color: s <= r.rating ? '#D97706' : '#E5E7EB', fill: s <= r.rating ? '#D97706' : 'none' }} />)}
                        </div>
                        {statusBadge(r.status)}
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--wsl-ink-2)', lineHeight: 1.7, fontFamily: 'Cairo, Inter, sans-serif', margin: 0 }}>{r.comment}</p>
                      <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', marginTop: 8 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
      <style>{`.wsl-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--wsl-border, #E5E7EB); background: #F9FAFB; font-family: Cairo, Inter, sans-serif; font-size: 13px; outline: none; transition: border-color 150ms; box-sizing: border-box; } .wsl-input:focus { border-color: #0A8F84; background: #fff; } @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </DashboardLayout>
  );
}

function FieldIcon({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'flex', fontSize: 12, fontWeight: 800, color: 'var(--wsl-ink-2)', marginBottom: 6, fontFamily: 'Cairo, sans-serif', alignItems: 'center', gap: 4 }}>
        <Icon size={12} style={{ color: '#9CA3AF' }} /> {label}
      </label>
      {children}
    </div>
  );
}

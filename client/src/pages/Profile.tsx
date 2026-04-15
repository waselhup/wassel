import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { User, Mail, Phone, MapPin, Briefcase, Linkedin, Save, Camera, Coins, Check, X, Edit2, Shield, Settings, CreditCard } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

type Tab = 'personal' | 'subscription' | 'settings' | 'security';

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === 'ar';
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>('personal');
  const [tokenBalance, setTokenBalance] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [form, setForm] = useState({
    name: (profile?.full_name as string) || (user?.user_metadata?.name as string) || "",
    email: user?.email || "",
    phone: "",
    city: "الرياض",
    role: (profile as any)?.job_title || "",
    company: "",
    linkedin: (profile as any)?.linkedin_url || "",
    bio: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const filled = Object.values(form).filter(Boolean).length;
  const total = Object.keys(form).length;
  const pct = Math.round((filled / total) * 100);
  const provider = user?.app_metadata?.provider || 'email';

  useEffect(() => {
    trpc.token.balance().then((b: any) => setTokenBalance(b?.balance ?? 0)).catch(() => {});
  }, []);

  function save() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  const initials = form.name
    ? form.name.split(" ").map((w) => w[0]).slice(0, 2).join("")
    : (user?.email?.[0] || "W").toUpperCase();

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'personal', label: t('profile.tabs.personal', 'المعلومات الشخصية'), icon: User },
    { id: 'subscription', label: t('profile.tabs.subscription', 'الاشتراك'), icon: CreditCard },
    { id: 'settings', label: t('profile.tabs.settings', 'الإعدادات'), icon: Settings },
    { id: 'security', label: t('profile.tabs.security', 'الأمان'), icon: Shield },
  ];

  const providerLabel = provider === 'linkedin' ? 'LinkedIn' : provider === 'google' ? 'Google' : 'Email';
  const providerColor = provider === 'linkedin' ? '#0077B5' : provider === 'google' ? '#EA4335' : '#6B7280';

  return (
    <DashboardLayout pageTitle={t('profile.title', 'الملف الشخصي')}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px' }}>

        {/* Identity Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border, #E5E7EB)', padding: 24, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            {(profile?.avatar_url || user?.user_metadata?.avatar_url) ? (
              <img src={profile?.avatar_url || user?.user_metadata?.avatar_url} alt={form.name}
                referrerPolicy="no-referrer"
                style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--wsl-teal, #0A8F84)' }} />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #0A8F84, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 900, fontFamily: 'Cairo, sans-serif' }}>
                {initials}
              </div>
            )}
            <button style={{ position: 'absolute', bottom: 0, insetInlineEnd: 0, width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '2px solid var(--wsl-border, #E5E7EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Camera size={12} style={{ color: '#6B7280' }} />
            </button>
          </div>
          {/* Name + email */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {editingName ? (
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  onBlur={() => setEditingName(false)} autoFocus
                  style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Cairo, sans-serif', border: '1.5px solid #0A8F84', borderRadius: 8, padding: '4px 10px', outline: 'none', background: '#F0FDF9' }} />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--wsl-ink)', fontFamily: 'Cairo, sans-serif' }}>
                  {form.name || (isAr ? 'لم يُضف اسم' : 'No name')}
                </span>
              )}
              <button onClick={() => setEditingName(!editingName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                <Edit2 size={14} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--wsl-ink-3)', fontFamily: 'Inter', direction: 'ltr' }}>{form.email}</div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: providerColor + '15', color: providerColor, fontSize: 11, fontWeight: 800, fontFamily: 'Cairo, sans-serif' }}>
                {providerLabel}
              </span>
              {provider === 'linkedin' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 800, fontFamily: 'Cairo, sans-serif' }}>
                  <Check size={10} /> {t('profile.identity.syncedFromLinkedin', 'مزامنة من LinkedIn ✓')}
                </span>
              )}
            </div>
          </div>
          {/* Profile completeness */}
          <div style={{ minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--wsl-ink-3)', fontFamily: 'Cairo, sans-serif', marginBottom: 4 }}>
              {isAr ? 'اكتمال الملف' : 'Profile'}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#DC2626', fontFamily: 'Inter' }}>{pct}%</div>
            <div style={{ height: 4, borderRadius: 999, background: '#E5E7EB', overflow: 'hidden', marginTop: 4 }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #0A8F84, #0ea5e9)', borderRadius: 999 }} />
            </div>
          </div>
        </motion.div>

        {/* Tokens Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ background: 'linear-gradient(135deg, #0A8F84 0%, #0ea5e9 100%)', borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: '0 8px 24px rgba(10,143,132,0.25)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8, fontFamily: 'Cairo, sans-serif', fontWeight: 700, marginBottom: 4 }}>
              {t('profile.tokensCard.title', 'رصيد التوكنز الحالي')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Inter' }}>{tokenBalance.toLocaleString('en-US')}</span>
              <span style={{ fontSize: 16, opacity: 0.8, fontFamily: 'Cairo, sans-serif' }}>{t('profile.tokensCard.balance', 'توكن')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/pricing">
              <a style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.2)', color: '#fff', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 13, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer' }}>
                {t('profile.tokensCard.buyMore', 'شراء توكنز')}
              </a>
            </Link>
            <Link href="/pricing">
              <a style={{ padding: '10px 18px', borderRadius: 10, background: '#fff', color: '#0A8F84', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
                {t('profile.tokensCard.upgrade', 'ترقية الباقة')}
              </a>
            </Link>
          </div>
        </motion.div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--wsl-surf-2, #F3F4F6)', marginBottom: 20, overflowX: 'auto' }}>
          {tabs.map(tb => {
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{ flex: 1, minWidth: 120, padding: '9px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? 'var(--wsl-ink)' : 'var(--wsl-ink-3)', fontFamily: 'Cairo, Inter, sans-serif', fontWeight: 900, fontSize: 13, boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 150ms ease' }}>
                <tb.icon size={14} />
                {tb.label}
              </button>
            );
          })}
        </div>

        {/* Personal Info Tab */}
        {tab === 'personal' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border, #E5E7EB)', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
              <FieldIcon icon={User} label={t('pr.name', 'الاسم الكامل')}>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} className="wsl-input" />
              </FieldIcon>
              <FieldIcon icon={Mail} label={t('pr.email', 'البريد الإلكتروني')}>
                <input value={form.email} disabled style={{ opacity: 0.6 }} className="wsl-input" dir="ltr" />
              </FieldIcon>
              <FieldIcon icon={Phone} label={t('pr.phone', 'رقم الجوال')}>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+966 5X XXX XXXX" className="wsl-input" dir="ltr" />
              </FieldIcon>
              <FieldIcon icon={MapPin} label={t('pr.city', 'المدينة')}>
                <select value={form.city} onChange={(e) => set("city", e.target.value)} className="wsl-input">
                  <option>الرياض</option><option>جدة</option><option>الدمام</option><option>مكة</option><option>المدينة</option><option>الأحساء </option>
                </select>
              </FieldIcon>
              <FieldIcon icon={Briefcase} label={t('pr.role', 'المسمى الوظيفي')}>
                <input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder={t('pr.rolePh', 'مدير تسويق رقمي')} className="wsl-input" />
              </FieldIcon>
              <FieldIcon icon={Briefcase} label={t('pr.company', 'الشًكة')}>
                <input value={form.company} onChange={(e) => set("company", e.target.value)} className="wsl-input" />
              </FieldIcon>
            </div>
            <FieldIcon icon={Linkedin} label={t('pr.linkedin', 'رابط LinkedIn')}>
              <input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." className="wsl-input" dir="ltr" />
            </FieldIcon>
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--wsl-ink-2)', marginBottom: 6, fontFamily: 'Cairo, sans-serif' }}>{t('pr.bio', 'نبذة عنك')}</label>
              <textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={4} placeholder={t('pr.bioPh', 'اكتت نبذة قصيرة.ث�.')} className="wsl-input" style={{ resize: 'none', width: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={save}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #0A8F84, #0ea5e9)', color: '#fff', fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(10,143,132,0.3)' }}>
                {saved ? <><Check size={16} /> {t('pr.saved', 'تم الحفظ ✓')}</> : <><Save size={16} /> {t('pr.save', 'حفظ')}</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* Other tabs placeholder */}
        {tab !== 'personal' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--wsl-border, #E5E7EB)', padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px', background: 'var(--wsl-teal-bg, #E0F7F5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tab === 'subscription' ? <CreditCard size={28} style={{ color: '#0A8F84' }} /> : tab === 'settings' ? <Settings size={28} style={{ color: '#0A8F84' }} /> : <Shield size={28} style={{ color: '#0A8F84' }} />}
            </div>
            <div style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: 18, color: 'var(--wsl-ink)', marginBottom: 6 }}>
              {isAr ? 'قريباً' : 'Coming Soon'}
            </div>
          </motion.div>
        )}
      </div>
      <style>{`.wsl-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--wsl-border, #E5E7EB); background: #F9FAFB; font-family: Cairo, Inter, sans-serif; font-size: 13px; outline: none; transition: border-color 150ms; box-sizing: border-box; } .wsl-input:focus { border-color: #0A8F84; background: #fff; }`}</style>
    </DashboardLayout>
  );
}

function FieldIcon({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--wsl-ink-2)', marginBottom: 6, fontFamily: 'Cairo, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon size={12} style={{ color: '#9CA3AF' }} /> {label}
      </label>
      {children}
    </div>
  );
}

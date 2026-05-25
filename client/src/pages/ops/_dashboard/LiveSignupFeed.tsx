import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { timeAgo, maskEmail } from './timeAgo';

interface FeedEvent {
  id: string;
  user_id: string | null;
  email: string | null;
  event_type: string;
  step_name: string | null;
  metadata: any;
  created_at: string;
}

interface Props {
  events: FeedEvent[];
  emptyLabel: string;
  abandonedLastHour: number;
}

const EVENT_ICON: Record<string, string> = {
  signup_started: '🆕',
  email_verified: '✅',
  profile_completed: '👤',
  onboarding_started: '🎯',
  onboarding_step: '🪜',
  onboarding_completed: '🎯',
  first_action: '🚀',
  abandoned: '💤',
};

const EVENT_LABEL_KEY: Record<string, string> = {
  signup_started: 'ops.eventSignupStarted',
  email_verified: 'ops.eventEmailVerified',
  profile_completed: 'ops.eventProfileCompleted',
  onboarding_started: 'ops.eventOnboardingStarted',
  onboarding_step: 'ops.eventOnboardingStep',
  onboarding_completed: 'ops.eventOnboardingCompleted',
  first_action: 'ops.eventFirstAction',
  abandoned: 'ops.eventAbandoned',
};

export default function LiveSignupFeed({ events, emptyLabel, abandonedLastHour }: Props) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {abandonedLastHour > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: '#FFFBEB', border: '1px solid #FDE68A',
          color: '#92400E', fontSize: 12, fontWeight: 800,
          fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span>{t('ops.feedAbandonedBanner', { n: abandonedLastHour })}</span>
          <button
            disabled
            title={t('ops.notImplemented') as string}
            style={{
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid #FDE68A', background: '#fff', color: '#92400E',
              fontSize: 11, fontWeight: 800, opacity: 0.6, cursor: 'not-allowed',
              fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
            }}
          >{t('ops.feedSendRecovery')}</button>
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        maxHeight: 480, overflowY: 'auto',
      }}>
        {events.length === 0 ? (
          <div style={{
            padding: '36px 12px', textAlign: 'center',
            fontSize: 12, fontWeight: 600, color: 'var(--wsl-ink-3, #6B7280)',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          }}>{emptyLabel}</div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((e) => {
              const icon = EVENT_ICON[e.event_type] || '•';
              const labelKey = EVENT_LABEL_KEY[e.event_type] || e.event_type;
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: -6, backgroundColor: 'rgba(16,185,129,0.12)' }}
                  animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(249,250,251,1)' }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.45 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                      fontWeight: 800, fontSize: 12, color: 'var(--wsl-ink, #0F172A)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span>{t(labelKey)}</span>
                      {e.step_name && (
                        <span dir="ltr" style={{
                          padding: '1px 6px', borderRadius: 4,
                          background: '#E0F2FE', color: '#075985',
                          fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                        }}>{e.step_name}</span>
                      )}
                    </div>
                    <div dir="ltr" style={{
                      fontSize: 10, color: 'var(--wsl-ink-3, #6B7280)',
                      fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
                    }}>{maskEmail(e.email)} · {timeAgo(e.created_at, t)}</div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

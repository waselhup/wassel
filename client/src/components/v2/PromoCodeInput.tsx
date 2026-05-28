import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { trpcMutation } from '@/lib/trpc';

interface Props {
  onSuccess?: (result: { granted_tokens: number; granted_plan: string; granted_months: number }) => void;
}

export default function PromoCodeInput({ onSuccess }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const ERROR_MAP: Record<string, string> = {
    CODE_NOT_FOUND: t('beta.promo.errors.notFound'),
    CODE_EXPIRED:   t('beta.promo.errors.expired'),
    CODE_EXHAUSTED: t('beta.promo.errors.exhausted'),
    ALREADY_REDEEMED: t('beta.promo.errors.alreadyRedeemed'),
  };

  async function handleRedeem() {
    if (!code.trim()) return;
    setLoading(true);
    setStatus('idle');
    setMessage('');
    try {
      const result = await trpcMutation<{
        success: boolean;
        error?: string;
        granted_tokens?: number;
        granted_plan?: string;
        granted_months?: number;
      }>('beta.redeemCode', { code: code.trim() });

      if (!result.success) {
        setStatus('error');
        setMessage(ERROR_MAP[result.error ?? ''] ?? t('beta.promo.errors.unknown'));
        return;
      }
      setStatus('success');
      setMessage(
        t('beta.promo.success', {
          tokens: result.granted_tokens,
          months: result.granted_months,
        })
      );
      onSuccess?.({
        granted_tokens: result.granted_tokens ?? 0,
        granted_plan: result.granted_plan ?? '',
        granted_months: result.granted_months ?? 0,
      });
      setCode('');
    } catch {
      setStatus('error');
      setMessage(t('beta.promo.errors.unknown'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-v2-muted" />
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleRedeem()}
            placeholder={t('beta.promo.placeholder')}
            disabled={loading}
            className="w-full rounded-lg border border-v2-line bg-v2-surface ps-9 pe-3 py-2 text-sm text-v2-text placeholder:text-v2-muted focus:border-v2-accent focus:outline-none disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleRedeem}
          disabled={loading || !code.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-v2-accent px-4 py-2 text-sm font-medium text-white hover:bg-v2-accent/90 disabled:opacity-50 transition-colors"
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : t('beta.promo.redeem')}
        </button>
      </div>

      {status !== 'idle' && (
        <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
          status === 'success'
            ? 'bg-emerald-500/10 text-emerald-600'
            : 'bg-red-500/10 text-red-600'
        }`}>
          {status === 'success'
            ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}

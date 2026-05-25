import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const FinanceDashboard = lazy(() => import('@/pages/finance/FinanceDashboard'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function FinancePanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="finance"
      title={t('finance.headerTitle')}
      accentColor="#D4AF37"
      Icon={Wallet}
    >
      <Suspense fallback={<Fallback />}>
        <FinanceDashboard />
      </Suspense>
    </PortalLayout>
  );
}

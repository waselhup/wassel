import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const RevenueLabDashboard = lazy(() => import('@/pages/revenue-lab/RevenueLabDashboard'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function RevenueLabPanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="revenue_lab"
      title={t('revenueLab.headerTitle', 'Revenue Lab')}
      accentColor="#EF4444"
      Icon={TrendingUp}
    >
      <Suspense fallback={<Fallback />}>
        <RevenueLabDashboard />
      </Suspense>
    </PortalLayout>
  );
}

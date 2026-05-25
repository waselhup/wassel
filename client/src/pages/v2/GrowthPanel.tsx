import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const GrowthDashboard = lazy(() => import('@/pages/growth/GrowthDashboard'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function GrowthPanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="growth"
      title={t('growth.headerTitle')}
      accentColor="#10B981"
      Icon={Megaphone}
    >
      <Suspense fallback={<Fallback />}>
        <GrowthDashboard />
      </Suspense>
    </PortalLayout>
  );
}

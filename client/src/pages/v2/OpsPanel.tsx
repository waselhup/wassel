import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const OpsDashboard = lazy(() => import('@/pages/ops/OpsDashboard'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function OpsPanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="ops"
      title={t('ops.headerTitle')}
      accentColor="#0EA5E9"
      Icon={Activity}
    >
      <Suspense fallback={<Fallback />}>
        <OpsDashboard />
      </Suspense>
    </PortalLayout>
  );
}

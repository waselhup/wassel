import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const WorkforceDashboard = lazy(() => import('@/pages/workforce/WorkforceDashboard'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function WorkforcePanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="workforce"
      title={t('workforce.headerTitle')}
      accentColor="#8B5CF6"
      Icon={LayoutDashboard}
    >
      <Suspense fallback={<Fallback />}>
        <WorkforceDashboard />
      </Suspense>
    </PortalLayout>
  );
}

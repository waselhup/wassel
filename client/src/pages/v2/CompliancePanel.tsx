import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const ComplianceDashboard = lazy(() => import('@/pages/compliance/ComplianceDashboard'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function CompliancePanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="compliance"
      title={t('compliance.headerTitle', 'Compliance')}
      accentColor="#6366F1"
      Icon={ShieldCheck}
    >
      <Suspense fallback={<Fallback />}>
        <ComplianceDashboard />
      </Suspense>
    </PortalLayout>
  );
}

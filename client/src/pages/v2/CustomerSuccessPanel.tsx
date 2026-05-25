import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartHandshake } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const CustomerSuccessDashboard = lazy(() => import('@/pages/customer-success/CustomerSuccessDashboard'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function CustomerSuccessPanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="customer_success"
      title={t('customerSuccess.headerTitle', 'Customer Success')}
      accentColor="#F59E0B"
      Icon={HeartHandshake}
    >
      <Suspense fallback={<Fallback />}>
        <CustomerSuccessDashboard />
      </Suspense>
    </PortalLayout>
  );
}

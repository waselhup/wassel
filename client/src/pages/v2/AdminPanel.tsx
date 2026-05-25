import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function AdminPanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="marketing"
      title={t('admin.cc.headerTitle')}
      accentColor="#8B5CF6"
      Icon={Megaphone}
    >
      <Suspense fallback={<Fallback />}>
        <AdminDashboard />
      </Suspense>
    </PortalLayout>
  );
}

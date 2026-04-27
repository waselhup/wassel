import { lazy, Suspense } from 'react';
import { EmbeddedShellProvider } from '@/contexts/EmbeddedShellContext';
import Skeleton from '@/components/v2/Skeleton';

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));

function Fallback() {
  return (
    <div className="px-[22px] pt-6">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function AdminPanel() {
  return (
    <EmbeddedShellProvider>
      <Suspense fallback={<Fallback />}>
        <AdminDashboard />
      </Suspense>
    </EmbeddedShellProvider>
  );
}

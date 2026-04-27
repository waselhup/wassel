import { lazy, Suspense } from 'react';
import { EmbeddedShellProvider } from '@/contexts/EmbeddedShellContext';
import Skeleton from '@/components/v2/Skeleton';

const CVTailor = lazy(() => import('@/pages/CVTailor'));

function Fallback() {
  return (
    <div className="px-[22px] pt-6">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function CVBuilder() {
  return (
    <EmbeddedShellProvider>
      <Suspense fallback={<Fallback />}>
        <CVTailor />
      </Suspense>
    </EmbeddedShellProvider>
  );
}

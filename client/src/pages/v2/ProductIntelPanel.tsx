import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Microscope } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const ProductIntelDashboard = lazy(() => import('@/pages/product-intel/ProductIntelDashboard'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

export default function ProductIntelPanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="product_intel"
      title={t('productIntel.headerTitle', 'Product Intelligence')}
      accentColor="#EC4899"
      Icon={Microscope}
    >
      <Suspense fallback={<Fallback />}>
        <ProductIntelDashboard />
      </Suspense>
    </PortalLayout>
  );
}

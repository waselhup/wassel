import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Inbox } from 'lucide-react';
import PortalLayout from '@/components/PortalLayout';
import Skeleton from '@/components/v2/Skeleton';

const SupportInbox = lazy(() => import('@/pages/admin/SupportInbox'));

function Fallback() {
  return (
    <div className="pt-2">
      <Skeleton variant="text" lines={2} className="mb-6" />
      <Skeleton variant="card" className="mb-4" />
      <Skeleton variant="card" />
    </div>
  );
}

/**
 * SupportInboxPanel — the admin Support inbox, wrapped in PortalLayout to match
 * the other admin portals (Marketing, Finance, Ops…). Admin-only is enforced
 * server-side by the support.admin.* endpoints (is_admin → FORBIDDEN); this
 * panel simply renders the inbox inside the portal chrome.
 */
export default function SupportInboxPanel() {
  const { t } = useTranslation();
  return (
    <PortalLayout
      persona="customer_success"
      title={t('support.admin.headerTitle', 'محادثات الدعم')}
      accentColor="#0D9488"
      Icon={Inbox}
    >
      <Suspense fallback={<Fallback />}>
        <SupportInbox />
      </Suspense>
    </PortalLayout>
  );
}

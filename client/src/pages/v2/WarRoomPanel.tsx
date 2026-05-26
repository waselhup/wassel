import { Suspense, lazy } from 'react';

const WarRoom = lazy(() => import('../war-room/WarRoom'));

export default function WarRoomPanel() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #334155 100%)',
            color: '#94A3B8',
            fontFamily: '"Thmanyah Sans", system-ui, sans-serif',
          }}
        >
          جارٍ تحميل غرفة القيادة...
        </div>
      }
    >
      <WarRoom />
    </Suspense>
  );
}

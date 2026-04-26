import Sheet from '@/components/v2/Sheet';
import JobsCenterContent from '@/components/v2/JobsCenterContent';

export interface JobsCenterProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Mobile JobsCenter — bottom sheet that hosts the shared JobsCenterContent.
 * Desktop variant lives in DesktopJobsCenter (slide-from-end drawer).
 */
function JobsCenter({ open, onClose }: JobsCenterProps) {
  return (
    <Sheet open={open} onClose={onClose} title="مركز المهام" snapPoints={[50, 90]}>
      <JobsCenterContent onClose={onClose} />
    </Sheet>
  );
}

export default JobsCenter;

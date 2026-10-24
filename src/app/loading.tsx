import { Shell } from '@/components/layout/Shell';
import { Spinner } from '@/components/ui/Spinner';

export default function Loading() {
  return (
    <Shell className="flex flex-1 items-center justify-center py-24">
      <Spinner size={48} label="Loading…" />
    </Shell>
  );
}

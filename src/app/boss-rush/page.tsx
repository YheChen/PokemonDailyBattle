import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Shell } from '@/components/layout/Shell';
import { Spinner } from '@/components/ui/Spinner';
import { BossRush } from './BossRush';

export const metadata: Metadata = {
  title: 'Boss Rush',
  description: 'Fight every trainer back to back, from the easiest to the hardest. How far can you get?',
};

export default function BossRushPage() {
  return (
    <Shell width="wide">
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner size={40} label="Loading Boss Rush…" />
          </div>
        }
      >
        <BossRush />
      </Suspense>
    </Shell>
  );
}

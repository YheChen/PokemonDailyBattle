import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Shell } from '@/components/layout/Shell';
import { Spinner } from '@/components/ui/Spinner';
import { FreeBattle } from './FreeBattle';

export const metadata: Metadata = {
  title: 'Free Battle',
  description: 'Pick any Champion or famous trainer, generate a random team of six, choose your lead and battle.',
};

export default function BattlePage() {
  return (
    <Shell width="wide">
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner size={40} label="Loading Free Battle…" />
          </div>
        }
      >
        <FreeBattle />
      </Suspense>
    </Shell>
  );
}

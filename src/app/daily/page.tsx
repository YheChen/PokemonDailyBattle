import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Shell } from '@/components/layout/Shell';
import { Spinner } from '@/components/ui/Spinner';
import { DailyChallenge } from './DailyChallenge';

export const metadata: Metadata = {
  title: 'Daily Challenge',
  description: "One trainer, one team, one attempt per day. Everyone in the world gets the same team and opponent — share your result.",
};

export default function DailyPage() {
  return (
    <Shell width="wide">
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner size={40} label="Loading today's challenge…" />
          </div>
        }
      >
        <DailyChallenge />
      </Suspense>
    </Shell>
  );
}

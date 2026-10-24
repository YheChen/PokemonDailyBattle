import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Shell } from '@/components/layout/Shell';
import { Spinner } from '@/components/ui/Spinner';
import { CustomBattle } from './CustomBattle';

export const metadata: Metadata = {
  title: 'Custom Battle',
  description: 'Choose the opponent, generation pool, level, randomization mode, AI difficulty, legendaries and format for a custom battle.',
};

export default function CustomPage() {
  return (
    <Shell width="wide">
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner size={40} label="Loading Custom Battle…" />
          </div>
        }
      >
        <CustomBattle />
      </Suspense>
    </Shell>
  );
}

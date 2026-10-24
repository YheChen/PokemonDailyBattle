import type { Metadata } from 'next';
import { Shell } from '@/components/layout/Shell';
import { Heading } from '@/components/ui/Heading';
import { StatsDashboard } from '@/components/stats/StatsDashboard';

export const metadata: Metadata = {
  title: 'Statistics',
  description: 'Your battle record in Pokémon Champions: wins, streaks, trainers defeated and battle history.',
};

export default function StatsPage() {
  return (
    <Shell className="space-y-8">
      <Heading level={1} kicker="Your record" size="lg">
        Statistics
      </Heading>
      <p className="max-w-2xl text-muted">
        Everything is stored in this browser only. Daily streaks count consecutive UTC days with a Daily Challenge win.
      </p>
      <StatsDashboard />
    </Shell>
  );
}

'use client';
import { useHydrated, useStats } from '@/lib/storage/useStorage';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { BattleHistory } from './BattleHistory';
import { ResetStatsButton } from './ResetStatsButton';
import { BattleTiles, StreakTiles } from './StatTiles';
import { TrainersDefeated } from './TrainersDefeated';

/**
 * The whole /stats page body. Reads `pc:stats` reactively; renders a spinner until hydrated
 * (so the server HTML never contains storage-derived values) and an empty state when nothing was played.
 */
export function StatsDashboard() {
  const hydrated = useHydrated();
  const stats = useStats();

  if (!hydrated) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading your statistics" />
      </div>
    );
  }

  if (stats.totalBattles === 0) {
    return (
      <EmptyState
        title="No battles yet"
        description="Your wins, streaks and battle history will show up here once you've fought a trainer."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button href="/daily" variant="primary">
              Play today&apos;s challenge
            </Button>
            <Button href="/trainers" variant="ghost">
              Pick a trainer
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-label="Totals">
        <BattleTiles stats={stats} />
        <StreakTiles stats={stats} />
      </section>

      <Panel title="Trainers defeated">
        <TrainersDefeated defeated={stats.trainersDefeated} />
      </Panel>

      <Panel title="Battle history">
        <BattleHistory history={stats.history} />
      </Panel>

      <Panel title="Danger zone" actions={<ResetStatsButton />}>
        <p className="text-sm text-muted">
          Resetting wipes every number on this page. Settings and today&apos;s daily attempt are not affected.
        </p>
      </Panel>
    </div>
  );
}

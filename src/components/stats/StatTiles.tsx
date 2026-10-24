import type { PlayerStats } from '@/lib/storage/types';
import { effectiveDailyStreak, winRate } from '@/lib/storage';
import { cn } from '@/components/ui/cn';

export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'green' | 'accent' | 'blue';
  className?: string;
}

const TONE = {
  default: 'text-yellow',
  green: 'text-green',
  accent: 'text-accent',
  blue: 'text-blue',
} as const;

/** One big number in a DS panel. */
export function StatTile({ label, value, hint, tone = 'default', className }: StatTileProps) {
  return (
    <div className={cn('ds-panel flex flex-col items-center gap-1 px-3 py-4 text-center', className)}>
      <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.15em] text-muted">{label}</span>
      <span className={cn('font-display text-xl sm:text-2xl', TONE[tone])}>{value}</span>
      {hint ? <span className="font-pixel text-base leading-none text-muted">{hint}</span> : null}
    </div>
  );
}

/** Totals: battles, wins, losses, win rate (with a CSS bar). */
export function BattleTiles({ stats }: { stats: PlayerStats }) {
  const rate = winRate(stats);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile label="Battles" value={stats.totalBattles} />
      <StatTile label="Wins" value={stats.wins} tone="green" />
      <StatTile label="Losses" value={stats.losses} tone="accent" />
      <div className="ds-panel flex flex-col items-center gap-2 px-3 py-4 text-center">
        <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.15em] text-muted">Win rate</span>
        <span className="font-display text-xl text-blue sm:text-2xl">{rate}%</span>
        <div
          className="h-2.5 w-full overflow-hidden rounded-sm border border-border bg-bg"
          role="meter"
          aria-label="Win rate"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rate}
        >
          <div className="h-full bg-blue transition-[width] duration-500" style={{ width: `${rate}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Daily streaks and the best Boss Rush run. */
export function StreakTiles({ stats }: { stats: PlayerStats }) {
  const streak = effectiveDailyStreak(stats);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile label="Current daily streak" value={streak} hint={streak === 1 ? 'day' : 'days'} />
      <StatTile
        label="Longest daily streak"
        value={stats.longestDailyStreak}
        hint={stats.longestDailyStreak === 1 ? 'day' : 'days'}
      />
      <StatTile
        label="Best Boss Rush"
        value={stats.bestBossRush}
        hint={stats.bestBossRush === 1 ? 'trainer defeated' : 'trainers defeated'}
        tone="blue"
      />
    </div>
  );
}

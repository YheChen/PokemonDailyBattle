'use client';
import Link from 'next/link';
import { effectiveDailyStreak, winRate } from '@/lib/storage';
import { useHydrated, useStats } from '@/lib/storage/useStorage';

/**
 * Compact strip with the player's streak, wins and win rate. Renders nothing on the
 * server and until stats exist, so there is never a hydration mismatch.
 */
export function StatsStrip() {
  const hydrated = useHydrated();
  const stats = useStats();
  if (!hydrated || stats.totalBattles === 0) return null;

  const streak = effectiveDailyStreak(stats);
  const items = [
    { label: 'Daily streak', value: streak, suffix: streak === 1 ? 'day' : 'days' },
    { label: 'Wins', value: stats.wins, suffix: `of ${stats.totalBattles}` },
    { label: 'Win rate', value: `${winRate(stats)}%`, suffix: '' },
    { label: 'Best Boss Rush', value: stats.bestBossRush, suffix: stats.bestBossRush === 1 ? 'trainer' : 'trainers' },
  ];

  return (
    <Link
      href="/stats"
      className="ds-panel grid grid-cols-2 gap-px overflow-hidden p-0 transition-colors hover:brightness-110 sm:grid-cols-4"
      aria-label="Your statistics"
    >
      {items.map((it) => (
        <div key={it.label} className="flex flex-col items-center gap-1 px-3 py-3 text-center odd:bg-bg/30">
          <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.15em] text-muted">{it.label}</span>
          <span className="font-display text-base text-yellow sm:text-lg">{it.value}</span>
          {it.suffix ? <span className="font-pixel text-base leading-none text-muted">{it.suffix}</span> : null}
        </div>
      ))}
    </Link>
  );
}

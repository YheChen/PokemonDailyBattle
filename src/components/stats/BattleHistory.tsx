'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { BattleResult } from '@/lib/battle/types';
import { getTrainer } from '@/data/trainers';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

export interface BattleHistoryProps {
  /** Most recent first (as stored). */
  history: BattleResult[];
  pageSize?: number;
}

export const MODE_LABEL: Record<BattleResult['mode'], string> = {
  daily: 'Daily',
  free: 'Free Battle',
  'boss-rush': 'Boss Rush',
  custom: 'Custom',
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Paginated battle history table (25 rows per page by default), most recent first. */
export function BattleHistory({ history, pageSize = 25 }: BattleHistoryProps) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(history.length / pageSize));
  const current = Math.min(page, pages - 1);
  const rows = history.slice(current * pageSize, current * pageSize + pageSize);

  if (history.length === 0) {
    return <p className="font-pixel text-xl leading-tight text-muted">No battles recorded yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-ds border-2 border-border">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-bg/60 text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-muted">
            <tr>
              <th scope="col" className="px-3 py-2">Date</th>
              <th scope="col" className="px-3 py-2">Mode</th>
              <th scope="col" className="px-3 py-2">Trainer</th>
              <th scope="col" className="px-3 py-2">Result</th>
              <th scope="col" className="px-3 py-2 text-right">Turns</th>
              <th scope="col" className="px-3 py-2 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const trainer = r.trainerId ? getTrainer(r.trainerId) : undefined;
              return (
                <tr key={`${r.finishedAt}-${i}`} className="border-t border-border/60 odd:bg-surface-2/40">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDate(r.finishedAt)}</td>
                  <td className="px-3 py-2">{MODE_LABEL[r.mode] ?? r.mode}</td>
                  <td className="px-3 py-2">
                    {trainer ? (
                      <Link href={`/trainers/${encodeURIComponent(trainer.id)}`} className="font-extrabold text-blue underline-offset-2 hover:underline">
                        {trainer.name}
                      </Link>
                    ) : (
                      <span className="text-muted">{r.trainerId ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('font-extrabold', r.won ? 'text-green' : 'text-accent')}>{r.won ? 'Won' : 'Lost'}</span>
                    {r.forfeited ? <span className="ml-1 text-xs text-muted">(forfeit)</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right font-pixel text-base tabular-nums">{r.turns}</td>
                  <td className="px-3 py-2 text-right font-pixel text-base tabular-nums" title="Your Pokémon left vs the opponent's">
                    {r.playerRemaining} – {r.opponentRemaining}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <Button variant="ghost" size="sm" onClick={() => setPage(current - 1)} disabled={current === 0}>
            ← Newer
          </Button>
          <span>
            Page {current + 1} of {pages} · {history.length} battles
          </span>
          <Button variant="ghost" size="sm" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>
            Older →
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">{history.length} {history.length === 1 ? 'battle' : 'battles'} (the last 100 are kept)</p>
      )}
    </div>
  );
}

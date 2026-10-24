/**
 * Boss Rush: fight every trainer in ascending difficulty. Pure helpers operate on `BossRushRun`
 * values; the storage wrappers at the bottom persist them.
 */
import type { PokemonSet } from '@pkmn/sim';
import { bossRushOrder, getTrainer } from '@/data/trainers';
import type { Trainer } from '@/data/trainers/types';
import type { BossRushRun } from '@/lib/storage/types';
import { clearBossRushRun, getBossRushRun, recordBossRushBest, saveBossRushRun } from '@/lib/storage';

/** Save key used by the battle screen for the current Boss Rush fight. */
export const BOSS_RUSH_SAVE_KEY = 'bossrush';

/* ---------------- pure ---------------- */

/** A fresh run over `bossRushOrder()`. `team` is required when `keepTeam` is true (may be set later, before the first battle). */
export function startRun(keepTeam: boolean, team?: PokemonSet[], now: Date = new Date()): BossRushRun {
  return {
    startedAt: now.toISOString(),
    order: bossRushOrder().map((t) => t.id),
    index: 0,
    defeated: 0,
    keepTeam,
    team: keepTeam && team ? team.map((s) => ({ ...s })) : null,
    status: 'active',
  };
}

export function totalStages(run: BossRushRun): number {
  return run.order.length;
}

/** The trainer of the current stage, or null when the run is over. */
export function currentTrainer(run: BossRushRun): Trainer | null {
  if (run.status !== 'active') return null;
  const id = run.order[run.index];
  return id ? getTrainer(id) ?? null : null;
}

/** True once every trainer in the order has been defeated. */
export function isComplete(run: BossRushRun): boolean {
  return run.defeated >= run.order.length;
}

/** Records a stage win: moves to the next trainer, or finishes the run after the last one. */
export function advance(run: BossRushRun): BossRushRun {
  if (run.status !== 'active') return run;
  const defeated = Math.min(run.order.length, run.defeated + 1);
  const index = run.index + 1;
  const done = index >= run.order.length;
  return { ...run, defeated, index: done ? run.order.length : index, status: done ? 'finished' : 'active' };
}

/** Ends the run (loss, forfeit or abandon) keeping the defeated count. */
export function finish(run: BossRushRun): BossRushRun {
  return run.status === 'finished' ? run : { ...run, status: 'finished' };
}

/** Stores the team to use for the rest of a keep-team run. */
export function withTeam(run: BossRushRun, team: PokemonSet[]): BossRushRun {
  return { ...run, team: team.map((s) => ({ ...s })) };
}

/** Seed string for the team generated at a given stage of a fresh-team run. */
export function stageTeamSeed(run: BossRushRun, index: number = run.index): string {
  return `bossrush-${run.startedAt}-${index}`;
}

/** Minimal shape check for a run read from storage. */
export function isValidRun(run: unknown): run is BossRushRun {
  if (!run || typeof run !== 'object') return false;
  const r = run as Partial<BossRushRun>;
  return (
    Array.isArray(r.order) &&
    r.order.length > 0 &&
    typeof r.index === 'number' &&
    typeof r.defeated === 'number' &&
    typeof r.keepTeam === 'boolean' &&
    (r.status === 'active' || r.status === 'finished') &&
    (r.team === null || r.team === undefined || Array.isArray(r.team))
  );
}

/* ---------------- storage wrappers ---------------- */

/** Starts and persists a new run. */
export function beginRun(keepTeam: boolean, team?: PokemonSet[]): BossRushRun {
  const run = startRun(keepTeam, team);
  saveBossRushRun(run);
  return run;
}

/** The active run from storage, or null (finished/corrupt runs are discarded). */
export function loadActiveRun(): BossRushRun | null {
  const run = getBossRushRun();
  if (!isValidRun(run)) {
    if (run) clearBossRushRun();
    return null;
  }
  if (run.status !== 'active' || !currentTrainer(run)) {
    clearBossRushRun();
    return null;
  }
  return run;
}

/** Persists a run as-is (e.g. after `withTeam`). */
export function persistRun(run: BossRushRun): BossRushRun {
  saveBossRushRun(run);
  return run;
}

/**
 * Records a stage win. The returned run is still active when there are more trainers; when the last
 * one falls it is finished, the best score is recorded and storage is cleared.
 */
export function recordStageWin(run: BossRushRun): BossRushRun {
  const next = advance(run);
  if (next.status === 'finished') {
    recordBossRushBest(next.defeated);
    clearBossRushRun();
  } else {
    saveBossRushRun(next);
  }
  return next;
}

/** Ends the run after a loss/forfeit/abandon: records the best score and clears storage. */
export function endRun(run: BossRushRun): BossRushRun {
  const done = finish(run);
  recordBossRushBest(done.defeated);
  clearBossRushRun();
  return done;
}

/**
 * Daily challenge determinism: the same UTC date gives every player the same team, trainer and battle seed.
 */
import { daysSinceEpoch, utcDateKey } from '@/lib/util/seed';
import { TRAINERS } from '@/data/trainers';
import { DEFAULT_TEAM_SETTINGS, type TeamGenSettings } from '@/lib/teams/types';

export interface DailyInfo {
  /** YYYY-MM-DD (UTC) */
  date: string;
  trainerId: string;
  teamSeed: string;
  battleSeed: string;
  settings: TeamGenSettings;
}

/** Rotation order: as listed in TRAINERS (champions first). */
export const DAILY_ROTATION: string[] = TRAINERS.map((t) => t.id);

export function getDailyInfo(date: string = utcDateKey()): DailyInfo {
  const day = daysSinceEpoch(date);
  // Offset so the rotation doesn't start at Red on the epoch; keeps variety across weeks.
  const idx = ((day * 7 + 3) % DAILY_ROTATION.length + DAILY_ROTATION.length) % DAILY_ROTATION.length;
  return {
    date,
    trainerId: DAILY_ROTATION[idx],
    teamSeed: `daily-team-${date}`,
    battleSeed: `daily-battle-${date}`,
    settings: DEFAULT_TEAM_SETTINGS,
  };
}

/** Milliseconds until the next UTC midnight (for the "next challenge in" countdown). */
export function msUntilNextDaily(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

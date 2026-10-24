/**
 * localStorage persistence. Every accessor is SSR-safe (returns defaults on the server) and tolerates corrupt JSON.
 * Keys: pc:stats, pc:settings, pc:daily:<date>, pc:battle:<saveKey> (one slot per battle save key), pc:bossrush.
 * The pre-per-key single slot pc:battle:current is migrated to its own key the first time saves are read.
 */
import type { BattleResult } from '@/lib/battle/types';
import { DEFAULT_TEAM_SETTINGS } from '@/lib/teams/types';
import { utcDateKey } from '@/lib/util/seed';
import {
  DEFAULT_STATS,
  type BossRushRun,
  type DailyRecord,
  type PlayerStats,
  type SavedBattle,
  type UserSettings,
} from './types';

export * from './types';
export { matchesSavedBattle } from './battleSave';

export const STORAGE_KEYS = {
  stats: 'pc:stats',
  settings: 'pc:settings',
  daily: (date: string) => `pc:daily:${date}`,
  /** One saved battle per save key (daily-<date>, free, custom, bossrush, …). */
  battle: (saveKey: string) => `${BATTLE_KEY_PREFIX}${saveKey}`,
  /** The single slot used before per-key saves; read once and migrated. */
  legacyBattle: 'pc:battle:current',
  bossRush: 'pc:bossrush',
} as const;

export const BATTLE_KEY_PREFIX = 'pc:battle:';

export const DEFAULT_SETTINGS: UserSettings = {
  playerName: 'Player',
  battleSpeed: 'normal',
  difficulty: 'trainer',
  teamSettings: DEFAULT_TEAM_SETTINGS,
  soundEnabled: false,
  renderMode: 'classic',
  reducedMotion: false,
};

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    notify(key);
  } catch {
    /* quota exceeded or private mode — ignore */
  }
}

export function removeKey(key: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(key);
    notify(key);
  } catch {
    /* ignore */
  }
}

/* ---- change notifications (so React hooks can re-render) ---- */
type Listener = (key: string) => void;
const listeners = new Set<Listener>();
function notify(key: string) {
  for (const l of listeners) l(key);
}
export function subscribeStorage(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ---- stats ---- */
export function getStats(): PlayerStats {
  const s = readJSON<Partial<PlayerStats>>(STORAGE_KEYS.stats, {});
  return { ...DEFAULT_STATS, ...s, trainersDefeated: { ...(s.trainersDefeated ?? {}) }, history: s.history ?? [] };
}

export function saveStats(stats: PlayerStats): void {
  writeJSON(STORAGE_KEYS.stats, stats);
}

export function resetStats(): void {
  removeKey(STORAGE_KEYS.stats);
}

export function winRate(stats: PlayerStats): number {
  return stats.totalBattles ? Math.round((stats.wins / stats.totalBattles) * 1000) / 10 : 0;
}

/**
 * The daily streak as it stands *today*: `currentDailyStreak` is only rewritten when a daily result is
 * recorded, so after a missed day it still holds the old value. A streak is alive only while the last
 * counted daily is today or yesterday (UTC); otherwise it reads as 0.
 */
export function effectiveDailyStreak(
  stats: Pick<PlayerStats, 'currentDailyStreak' | 'lastDailyDate'>,
  today: string = utcDateKey(),
): number {
  if (!stats.lastDailyDate || stats.currentDailyStreak <= 0) return 0;
  const gap = daysBetween(stats.lastDailyDate, today);
  return gap === 0 || gap === 1 ? stats.currentDailyStreak : 0;
}

/**
 * Records a finished battle. Daily results also update the streak (consecutive UTC days with a daily win).
 * Returns the updated stats.
 */
export function recordBattleResult(result: BattleResult, opts: { dailyDate?: string } = {}): PlayerStats {
  const stats = getStats();
  stats.totalBattles += 1;
  if (result.won) {
    stats.wins += 1;
    if (result.trainerId) stats.trainersDefeated[result.trainerId] = (stats.trainersDefeated[result.trainerId] ?? 0) + 1;
  } else {
    stats.losses += 1;
  }
  if (opts.dailyDate) {
    if (result.won) {
      const prev = stats.lastDailyDate;
      const consecutive = prev ? daysBetween(prev, opts.dailyDate) === 1 : false;
      stats.currentDailyStreak = consecutive ? stats.currentDailyStreak + 1 : 1;
      stats.longestDailyStreak = Math.max(stats.longestDailyStreak, stats.currentDailyStreak);
    } else {
      stats.currentDailyStreak = 0;
    }
    stats.lastDailyDate = opts.dailyDate;
  }
  stats.history = [result, ...stats.history].slice(0, 100);
  saveStats(stats);
  return stats;
}

export function recordBossRushBest(defeated: number): PlayerStats {
  const stats = getStats();
  if (defeated > stats.bestBossRush) {
    stats.bestBossRush = defeated;
    saveStats(stats);
  }
  return stats;
}

/** Whole days from date key `a` to date key `b` (YYYY-MM-DD, UTC); negative when `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/* ---- settings ---- */
export function getSettings(): UserSettings {
  const s = readJSON<Partial<UserSettings>>(STORAGE_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...s, teamSettings: { ...DEFAULT_TEAM_SETTINGS, ...(s.teamSettings ?? {}) } };
}

export function saveSettings(settings: UserSettings): void {
  writeJSON(STORAGE_KEYS.settings, settings);
}

export function updateSettings(patch: Partial<UserSettings>): UserSettings {
  const next = { ...getSettings(), ...patch };
  saveSettings(next);
  return next;
}

/* ---- daily ---- */
export function getDailyRecord(date: string): DailyRecord | null {
  return readJSON<DailyRecord | null>(STORAGE_KEYS.daily(date), null);
}

export function saveDailyRecord(record: DailyRecord): void {
  writeJSON(STORAGE_KEYS.daily(record.date), record);
}

/** Removes a daily record (only for attempts whose battle never started). */
export function clearDailyRecord(date: string): void {
  removeKey(STORAGE_KEYS.daily(date));
}

/* ---- in-progress battles (refresh resume), one slot per save key ---- */

function isSavedBattle(value: unknown): value is SavedBattle {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<SavedBattle>;
  return !!v.setup && typeof v.setup === 'object' && typeof v.setup.saveKey === 'string' && !!v.serialized && Array.isArray(v.serialized.inputLog);
}

/**
 * Moves the pre-per-key slot (`pc:battle:current`) to `pc:battle:<its saveKey>` and removes it. Safe to
 * call repeatedly; a no-op once the legacy key is gone. Never overwrites an existing per-key save.
 */
export function migrateLegacyBattleSave(): void {
  if (!hasStorage()) return;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEYS.legacyBattle);
  } catch {
    return;
  }
  if (raw == null) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSavedBattle(parsed)) {
      const key = parsed.setup.saveKey as string;
      // A save keyed "current" already lives at the legacy address: leave it alone.
      if (key === 'current') return;
      if (window.localStorage.getItem(STORAGE_KEYS.battle(key)) == null) writeJSON(STORAGE_KEYS.battle(key), parsed);
    }
  } catch {
    /* corrupt legacy save — drop it */
  }
  removeKey(STORAGE_KEYS.legacyBattle);
}

/** The saved battle for a save key (null when none, when corrupt, or when its setup carries another key). */
export function getSavedBattle(saveKey: string | null | undefined): SavedBattle | null {
  if (!saveKey) return null;
  migrateLegacyBattleSave();
  const saved = readJSON<unknown>(STORAGE_KEYS.battle(saveKey), null);
  return isSavedBattle(saved) && saved.setup.saveKey === saveKey ? saved : null;
}

/** Writes the save under its own key (`saved.setup.saveKey`); setups without a save key are never persisted. */
export function saveBattle(saved: SavedBattle): void {
  const key = saved.setup?.saveKey;
  if (!key) return;
  writeJSON(STORAGE_KEYS.battle(key), saved);
}

export function clearSavedBattle(saveKey: string | null | undefined): void {
  if (!saveKey) return;
  removeKey(STORAGE_KEYS.battle(saveKey));
}

/** Every saved battle, most recently saved first. */
export function listSavedBattles(): SavedBattle[] {
  if (!hasStorage()) return [];
  migrateLegacyBattleSave();
  const out: SavedBattle[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(BATTLE_KEY_PREFIX)) continue;
      const saved = readJSON<unknown>(k, null);
      if (isSavedBattle(saved) && STORAGE_KEYS.battle(saved.setup.saveKey as string) === k) out.push(saved);
    }
  } catch {
    return out;
  }
  return out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

/* ---- boss rush ---- */
export function getBossRushRun(): BossRushRun | null {
  return readJSON<BossRushRun | null>(STORAGE_KEYS.bossRush, null);
}

export function saveBossRushRun(run: BossRushRun): void {
  writeJSON(STORAGE_KEYS.bossRush, run);
}

export function clearBossRushRun(): void {
  removeKey(STORAGE_KEYS.bossRush);
}

/* ---- danger zone ---- */
export function clearAllData(): void {
  if (!hasStorage()) return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith('pc:')) keys.push(k);
  }
  keys.forEach(removeKey);
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BattleSetup } from '@/lib/battle/types';
import {
  BATTLE_KEY_PREFIX,
  STORAGE_KEYS,
  clearAllData,
  clearSavedBattle,
  daysBetween,
  effectiveDailyStreak,
  getSavedBattle,
  listSavedBattles,
  matchesSavedBattle,
  migrateLegacyBattleSave,
  recordBattleResult,
  saveBattle,
  getStats,
  type SavedBattle,
} from './index';
import { DEFAULT_STATS } from './types';

/** Minimal in-memory localStorage so the SSR-safe accessors run under the node test environment. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  };
}

/** The node environment has no `window`; the accessors only touch `window.localStorage`. */
type WithWindow = { window?: { localStorage: Storage } };
const g = globalThis as unknown as WithWindow;

function setup(mode: BattleSetup['mode'], saveKey: string | null, seed: string, trainerId = 'cynthia', opponentName = 'Cynthia'): BattleSetup {
  return {
    mode,
    saveKey,
    trainerId,
    config: {
      seed,
      player: { name: 'Red', team: [] },
      opponent: { name: opponentName, team: [], difficulty: 'champion', trainerId },
    },
  };
}

function saved(s: BattleSetup, savedAt = '2026-10-24T10:00:00.000Z'): SavedBattle {
  return { setup: s, serialized: { version: 1, config: s.config, inputLog: ['>start', '>player p1', '>player p2'] }, savedAt };
}

describe('storage', () => {
  beforeEach(() => {
    g.window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete g.window;
  });

  describe('per-key battle saves', () => {
    it('stores one save per key and never lets another key overwrite it', () => {
      const daily = saved(setup('daily', 'daily-2026-10-24', '1,2,3,4'));
      const free = saved(setup('free', 'free', '5,6,7,8', 'red', 'Red'));
      saveBattle(daily);
      saveBattle(free);
      expect(getSavedBattle('daily-2026-10-24')?.setup.mode).toBe('daily');
      expect(getSavedBattle('free')?.setup.mode).toBe('free');
      expect(getSavedBattle('custom')).toBeNull();
      expect(getSavedBattle(null)).toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEYS.battle('free'))).not.toBeNull();
      expect(STORAGE_KEYS.battle('free')).toBe(`${BATTLE_KEY_PREFIX}free`);

      clearSavedBattle('free');
      expect(getSavedBattle('free')).toBeNull();
      expect(getSavedBattle('daily-2026-10-24')?.setup.mode).toBe('daily');
      clearSavedBattle(null); // no-op
      expect(getSavedBattle('daily-2026-10-24')).not.toBeNull();
    });

    it('ignores setups without a save key and corrupt entries', () => {
      saveBattle(saved(setup('custom', null, '1,2,3,4')));
      expect(listSavedBattles()).toEqual([]);
      window.localStorage.setItem(STORAGE_KEYS.battle('custom'), '{not json');
      expect(getSavedBattle('custom')).toBeNull();
      window.localStorage.setItem(STORAGE_KEYS.battle('custom'), JSON.stringify({ setup: { saveKey: 'other' } }));
      expect(getSavedBattle('custom')).toBeNull();
      expect(listSavedBattles()).toEqual([]);
    });

    it('lists every save, most recent first', () => {
      saveBattle(saved(setup('free', 'free', '1,1,1,1'), '2026-10-20T00:00:00.000Z'));
      saveBattle(saved(setup('daily', 'daily-2026-10-24', '2,2,2,2'), '2026-10-24T00:00:00.000Z'));
      saveBattle(saved(setup('boss-rush', 'bossrush', '3,3,3,3'), '2026-10-22T00:00:00.000Z'));
      expect(listSavedBattles().map((s) => s.setup.saveKey)).toEqual(['daily-2026-10-24', 'bossrush', 'free']);
    });

    it('migrates the legacy single slot to its own key once and removes it', () => {
      const legacy = saved(setup('daily', 'daily-2026-10-23', '9,9,9,9'));
      window.localStorage.setItem(STORAGE_KEYS.legacyBattle, JSON.stringify(legacy));
      expect(getSavedBattle('daily-2026-10-23')?.setup.config.seed).toBe('9,9,9,9');
      expect(window.localStorage.getItem(STORAGE_KEYS.legacyBattle)).toBeNull();
      // Idempotent.
      migrateLegacyBattleSave();
      expect(getSavedBattle('daily-2026-10-23')).not.toBeNull();
    });

    it('does not overwrite an existing per-key save during migration and drops a corrupt legacy slot', () => {
      saveBattle(saved(setup('free', 'free', '1,2,3,4')));
      window.localStorage.setItem(STORAGE_KEYS.legacyBattle, JSON.stringify(saved(setup('free', 'free', '5,5,5,5'))));
      migrateLegacyBattleSave();
      expect(getSavedBattle('free')?.setup.config.seed).toBe('1,2,3,4');
      expect(window.localStorage.getItem(STORAGE_KEYS.legacyBattle)).toBeNull();

      window.localStorage.setItem(STORAGE_KEYS.legacyBattle, 'garbage');
      expect(listSavedBattles()).toHaveLength(1);
      expect(window.localStorage.getItem(STORAGE_KEYS.legacyBattle)).toBeNull();
    });

    it('clearAllData removes every per-key save', () => {
      saveBattle(saved(setup('free', 'free', '1,2,3,4')));
      saveBattle(saved(setup('daily', 'daily-2026-10-24', '1,2,3,4')));
      clearAllData();
      expect(listSavedBattles()).toEqual([]);
      expect(window.localStorage.length).toBe(0);
    });
  });

  describe('matchesSavedBattle (resume identity)', () => {
    const cynthia = setup('free', 'free', '1,2,3,4');

    it('matches the exact setup it was saved from (same key, seed and opponent)', () => {
      expect(matchesSavedBattle(saved(cynthia), cynthia)).toBe(true);
      expect(matchesSavedBattle(saved(cynthia), { ...cynthia })).toBe(true);
    });

    it('rejects a fresh battle under the same key (new seed) or against another trainer', () => {
      expect(matchesSavedBattle(saved(cynthia), setup('free', 'free', '4,3,2,1'))).toBe(false);
      expect(matchesSavedBattle(saved(cynthia), setup('free', 'free', '1,2,3,4', 'red', 'Red'))).toBe(false);
      expect(matchesSavedBattle(saved(cynthia), setup('free', 'custom', '1,2,3,4'))).toBe(false);
      expect(matchesSavedBattle(saved(cynthia), setup('free', null, '1,2,3,4'))).toBe(false);
      expect(matchesSavedBattle(null, cynthia)).toBe(false);
      expect(matchesSavedBattle({ ...saved(cynthia), serialized: undefined as never }, cynthia)).toBe(false);
    });

    it('matches a daily setup rebuilt deterministically for the same date', () => {
      const a = setup('daily', 'daily-2026-10-24', '7,7,7,7', 'steven', 'Steven');
      const b = setup('daily', 'daily-2026-10-24', '7,7,7,7', 'steven', 'Steven');
      expect(matchesSavedBattle(saved(a), b)).toBe(true);
    });
  });

  describe('effectiveDailyStreak', () => {
    it('keeps the streak while the last daily was today or yesterday and decays it after a missed day', () => {
      const stats = { ...DEFAULT_STATS, currentDailyStreak: 4, lastDailyDate: '2026-10-23' };
      expect(effectiveDailyStreak(stats, '2026-10-23')).toBe(4);
      expect(effectiveDailyStreak(stats, '2026-10-24')).toBe(4);
      expect(effectiveDailyStreak(stats, '2026-10-25')).toBe(0);
      expect(effectiveDailyStreak(stats, '2026-11-25')).toBe(0);
      expect(effectiveDailyStreak({ ...stats, lastDailyDate: null }, '2026-10-24')).toBe(0);
      expect(effectiveDailyStreak({ ...stats, currentDailyStreak: 0 }, '2026-10-24')).toBe(0);
      expect(daysBetween('2026-10-23', '2026-10-25')).toBe(2);
      expect(daysBetween('2026-10-25', '2026-10-23')).toBe(-2);
    });

    it('agrees with recordBattleResult across a gap', () => {
      const win = { won: true, forfeited: false, turns: 10, playerRemaining: 3, opponentRemaining: 0, playerTeamStatus: [], opponentTeamStatus: [], mode: 'daily' as const, finishedAt: '' };
      recordBattleResult(win, { dailyDate: '2026-10-20' });
      recordBattleResult(win, { dailyDate: '2026-10-21' });
      expect(getStats().currentDailyStreak).toBe(2);
      expect(effectiveDailyStreak(getStats(), '2026-10-22')).toBe(2);
      expect(effectiveDailyStreak(getStats(), '2026-10-23')).toBe(0);
      recordBattleResult(win, { dailyDate: '2026-10-23' });
      expect(getStats().currentDailyStreak).toBe(1);
      recordBattleResult({ ...win, won: false, forfeited: true }, { dailyDate: '2026-10-24' });
      expect(getStats().currentDailyStreak).toBe(0);
      expect(getStats().losses).toBe(1);
    });
  });
});

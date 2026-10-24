import type { BattleResult, SerializedBattle, BattleSetup } from '@/lib/battle/types';
import type { TeamGenSettings } from '@/lib/teams/types';
import type { Difficulty } from '@/lib/battle/types';

export interface PlayerStats {
  totalBattles: number;
  wins: number;
  losses: number;
  currentDailyStreak: number;
  longestDailyStreak: number;
  /** Last daily date (YYYY-MM-DD) that counted toward the streak. */
  lastDailyDate: string | null;
  /** trainerId → number of victories against them. */
  trainersDefeated: Record<string, number>;
  bestBossRush: number;
  /** Most recent first, capped at 100 entries. */
  history: BattleResult[];
}

export const DEFAULT_STATS: PlayerStats = {
  totalBattles: 0,
  wins: 0,
  losses: 0,
  currentDailyStreak: 0,
  longestDailyStreak: 0,
  lastDailyDate: null,
  trainersDefeated: {},
  bestBossRush: 0,
  history: [],
};

export type BattleSpeed = 'normal' | 'fast' | 'instant';

export interface UserSettings {
  playerName: string;
  battleSpeed: BattleSpeed;
  /** Default AI difficulty for Free Battle when the trainer's own rating isn't used. */
  difficulty: Difficulty | 'trainer';
  teamSettings: TeamGenSettings;
  soundEnabled: boolean;
  /** 'classic' = gen5ani sprites. 'modern' reserved for a future 3D mode. */
  renderMode: 'classic' | 'modern';
  reducedMotion: boolean;
}

export interface DailyRecord {
  date: string;
  trainerId: string;
  status: 'in-progress' | 'won' | 'lost';
  result?: BattleResult;
  startedAt: string;
}

export interface SavedBattle {
  setup: BattleSetup;
  serialized: SerializedBattle;
  savedAt: string;
}

export interface BossRushRun {
  startedAt: string;
  order: string[];
  index: number;
  defeated: number;
  keepTeam: boolean;
  /** The team used for the whole run when keepTeam is true (Showdown sets). */
  team: import('@pkmn/sim').PokemonSet[] | null;
  status: 'active' | 'finished';
}

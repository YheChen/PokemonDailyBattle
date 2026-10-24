/**
 * Helpers shared by every game mode: building a `BattleSetup` for <BattleScreen />, resolving the AI
 * difficulty and summarizing a finished `BattleResult`.
 */
import type { PokemonSet } from '@pkmn/sim';
import type { BattleResult, BattleSetup, Difficulty } from '@/lib/battle/types';
import { DEFAULT_FORMAT } from '@/lib/battle/types';
import type { Trainer } from '@/data/trainers/types';
import type { SavedBattle } from '@/lib/storage/types';
import type { BattleLevel } from '@/lib/teams/types';
import { randomSeed } from '@/lib/util/seed';
import { isGen9OnlyFormat, stripGimmickItems, trainerToSets } from './trainerTeam';

export type DifficultyChoice = Difficulty | 'trainer';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  normal: 'Normal',
  hard: 'Hard',
  champion: 'Champion',
};

/** Resolves the AI difficulty: `'trainer'` (or nothing) means the trainer's own rating. */
export function difficultyFor(trainer: Trainer, override?: DifficultyChoice | null): Difficulty {
  if (!override || override === 'trainer') return trainer.ai;
  return override;
}

export interface BuildSetupOptions {
  mode: BattleSetup['mode'];
  /** Storage key for refresh-resume, or null to never persist. */
  saveKey: string | null;
  trainer: Trainer;
  playerName: string;
  /** The player's team in battle order (lead = index 0). */
  playerTeam: PokemonSet[];
  level: BattleLevel;
  /** AI difficulty override; defaults to the trainer's rating. */
  difficulty?: DifficultyChoice | null;
  /** PRNG seed string; random when omitted. */
  seed?: string;
  /** Showdown format id; DEFAULT_FORMAT when omitted. */
  formatid?: string;
}

/** Assembles everything <BattleScreen /> needs for a battle against a trainer. */
export function buildBattleSetup(opts: BuildBattleSetupInput): BattleSetup {
  const { trainer } = opts;
  const level = opts.level;
  const formatid = opts.formatid ?? DEFAULT_FORMAT;
  const gen9Only = isGen9OnlyFormat(formatid);
  const opponentTeam = opts.opponentTeam
    ? gen9Only ? stripGimmickItems(opts.opponentTeam) : opts.opponentTeam
    : trainerToSets(trainer, level, { formatid });
  const playerTeam = (gen9Only ? stripGimmickItems(opts.playerTeam) : opts.playerTeam).map((s) => ({ ...s, level }));
  return {
    mode: opts.mode,
    saveKey: opts.saveKey,
    trainerId: trainer.id,
    config: {
      formatid,
      seed: opts.seed ?? randomSeed(),
      player: {
        name: opts.playerName?.trim() || 'Player',
        team: playerTeam,
      },
      opponent: {
        name: trainer.name,
        team: opponentTeam,
        avatar: trainer.avatar,
        difficulty: difficultyFor(trainer, opts.difficulty),
        trainerId: trainer.id,
      },
    },
  };
}

export type BuildBattleSetupInput = BuildSetupOptions & {
  /** Pre-built opponent sets (defaults to `trainerToSets(trainer, level)`). */
  opponentTeam?: PokemonSet[];
};

export interface ForfeitResultInput {
  mode: BattleSetup['mode'];
  trainerId?: string;
  playerTeam: readonly { species: string }[];
  opponentTeam: readonly { species: string }[];
  /** Player actions already taken (shown as turns). */
  turns?: number;
  finishedAt?: string;
}

/**
 * The result of giving up a battle without playing it to the end (discarding a Daily or Boss Rush save):
 * a forfeit loss. No final snapshot exists, so both teams are reported as they were sent out.
 */
export function forfeitResult(input: ForfeitResultInput): BattleResult {
  return {
    won: false,
    forfeited: true,
    turns: Math.max(0, input.turns ?? 0),
    playerRemaining: input.playerTeam.length,
    opponentRemaining: input.opponentTeam.length,
    playerTeamStatus: input.playerTeam.map((p) => ({ species: p.species, fainted: false })),
    opponentTeamStatus: input.opponentTeam.map((p) => ({ species: p.species, fainted: false })),
    trainerId: input.trainerId,
    mode: input.mode,
    finishedAt: input.finishedAt ?? new Date().toISOString(),
  };
}

/** Number of player choices recorded in a saved battle's input log. */
export function savedTurns(saved: SavedBattle): number {
  return saved.serialized.inputLog.filter((l) => l.startsWith('>p1 ')).length;
}

/** `forfeitResult` for a saved (unfinished) battle. */
export function forfeitResultFromSave(saved: SavedBattle, finishedAt?: string): BattleResult {
  return forfeitResult({
    mode: saved.setup.mode,
    trainerId: saved.setup.trainerId,
    playerTeam: saved.setup.config.player.team,
    opponentTeam: saved.setup.config.opponent.team,
    turns: savedTurns(saved),
    finishedAt,
  });
}

export interface RemainingCounts {
  player: number;
  playerTotal: number;
  opponent: number;
  opponentTotal: number;
}

/** Pokémon still standing on each side at the end of a battle. */
export function remainingCounts(result: BattleResult): RemainingCounts {
  const playerTotal = result.playerTeamStatus.length || 6;
  const opponentTotal = result.opponentTeamStatus.length || 6;
  const player = result.playerTeamStatus.length
    ? result.playerTeamStatus.filter((p) => !p.fainted).length
    : result.playerRemaining;
  const opponent = result.opponentTeamStatus.length
    ? result.opponentTeamStatus.filter((p) => !p.fainted).length
    : result.opponentRemaining;
  return { player, playerTotal, opponent, opponentTotal };
}

/** "WIN" / "LOSS" / "FORFEIT" label for a result. */
export function outcomeLabel(result: BattleResult): 'WIN' | 'LOSS' | 'FORFEIT' {
  if (result.won) return 'WIN';
  return result.forfeited ? 'FORFEIT' : 'LOSS';
}

/** Rounded win percentage (one decimal) for a wins/total pair. */
export function winPercent(wins: number, total: number): number {
  return total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;
}
